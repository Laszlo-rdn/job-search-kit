#!/usr/bin/env node
// Scraper JobTeaser via Apify (acteur shahidirfan/JobTeaser-Job-Scraper). JobTeaser bloque les requêtes directes (Cloudflare).
// Récupère les offres publiées depuis le dernier run, écarte celles déjà vues ou déjà candidatées
// et applique les filtres de config.json.
//
// Usage :
//   node scripts/jobteaser/pull.mjs                run complet (fenêtre = depuis le dernier run, met à jour state.json)
//   node scripts/jobteaser/pull.mjs --days=7       force une fenêtre de N jours
//   node scripts/jobteaser/pull.mjs --max=N        nombre max d'offres par requête
//   node scripts/jobteaser/pull.mjs --no-state     ne met pas à jour state.json (test)
//   node scripts/jobteaser/pull.mjs --reuse        retraite les raw-*.json du jour sans rappeler Apify (gratuit)
//   node scripts/jobteaser/pull.mjs --ignore-seen  reprend les offres déjà vues mais jamais candidatées
//
// Coût : ≈ 0,001 $ par offre renvoyée. Le filtre de l'acteur n'a que 3 crans (24h, 7d, 30d) :
// le script prend le plus petit qui couvre l'écart depuis le dernier run, puis filtre à la date exacte.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  args, today, iso, loadConfig, apifyToken, runActor, readState, writeState, pairKey,
  appliedOffers, sameCompany, filterContext, commonFilter, enrich, writeOutputs, countReasons,
} from "../lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const ACTOR = "shahidirfan~JobTeaser-Job-Scraper";
const cfg = loadConfig();
const J = cfg.jobteaser || {};
const MAX = Number(args.max || J.maxParRequete || 300);

const STATE0 = readState(STATE_FILE);
const SINCE_MS = args.days ? Date.now() - Number(args.days) * 86400000
  : STATE0.lastRunAt ? Date.parse(STATE0.lastRunAt) - 2 * 3600000
  : Date.now() - 7 * 86400000; // premier run : 7 jours
const HOURS = (Date.now() - SINCE_MS) / 3600000;
const POSTED_WITHIN = HOURS <= 24 ? "24h" : HOURS <= 168 ? "7d" : "30d";

// Une requête par (type de contrat x lieu x langue). Le filtre langue de l'acteur est exclusif : on interroge FR et EN.
function queries() {
  const out = [];
  for (const r of J.requetes || []) for (const language of J.langues || ["fr", "en"]) out.push({ ...r, language });
  return out;
}

function normalize(o, q) {
  return {
    source: "JobTeaser",
    id: String(o.job_id),
    url: o.job_url,
    title: o.title || "",
    company: o.company || "",
    location: o.location || "",
    contract: o.job_type || q.type,
    salary: o.salary || "",
    postedAt: String(o.date_posted || o.original_publish_date || "").slice(0, 10),
    description: o.description_text || "",
    _type: q.type,
    _checkLocation: q.filtrerLieu !== false,
    extra: {
      lines: [`- **Catégorie JobTeaser :** ${o.job_category || "?"}`, `- **Télétravail :** ${o.remote_type || "?"}`],
      tags: [q.type],
    },
  };
}

(async () => {
  const state = STATE0;
  const seen = new Set(state.seen || []);
  const outDir = path.join(DIR, "out", today);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Collecte
  const raw = [];
  if (args.reuse) {
    for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith("raw-")))
      raw.push(...JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")));
  } else {
    const token = apifyToken();
    for (const [i, q] of queries().entries()) {
      const input = { jobTypes: [q.type], language: q.language, posted_within: POSTED_WITHIN, results_wanted: MAX };
      if (q.lieu) input.location = q.lieu;
      const label = `${q.type}${q.lieu ? ` ${q.lieu}` : ""} ${q.language}`;
      const items = (await runActor(ACTOR, input, token, label)).filter((o) => o.job_id && o.title).map((o) => ({ ...o, _q: q }));
      fs.writeFileSync(path.join(outDir, `raw-${i}.json`), JSON.stringify(items, null, 1));
      process.stderr.write(`Apify ${label} : ${items.length} offres\n`);
      raw.push(...items);
    }
  }

  // 2. Fenêtre + dédoublonnage + filtres
  const winStart = iso(new Date(SINCE_MS));
  const applied = appliedOffers();
  const ctx = filterContext(cfg);
  const byId = new Map();
  for (const o of raw) if (!byId.has(o.job_id)) byId.set(o.job_id, o);
  const fresh = [], kept = [], dropped = [], pairs = new Set();
  let alreadySeen = 0, alreadyApplied = 0;
  for (const r of byId.values()) {
    const o = enrich(normalize(r, r._q || { type: r.job_type }));
    if (!o.postedAt || o.postedAt < winStart) continue; // pas de date fiable ou trop ancienne
    if (!args.reuse && !args["ignore-seen"] && seen.has(o.id)) { alreadySeen++; continue; }
    const pair = pairKey(o.company, o.title);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (applied.refs.has(`jobteaser:${o.id}`) || applied.pairs.has(pair)) { alreadyApplied++; continue; }
    fresh.push(o);

    const why = commonFilter(o, cfg, { ...ctx, checkLocation: o._checkLocation });
    if (why) { dropped.push({ ...o, _reason: why }); continue; }
    if (sameCompany(applied, o.company)) o._note = "entreprise déjà candidatée (autre poste)";
    kept.push(o);
  }
  kept.sort((a, b) => (b._junior - a._junior) || b.postedAt.localeCompare(a.postedAt));

  writeOutputs(outDir, "JobTeaser", `Publication depuis le ${winStart} (filtre Apify ${POSTED_WITHIN}) · offres nouvelles : ${fresh.length} · retenues pour le tri : ${kept.length}`, kept, dropped);

  console.log(JSON.stringify({
    window: { start: winStart, end: today, apify_filter: POSTED_WITHIN },
    collected: raw.length,
    already_seen: alreadySeen,
    already_applied: alreadyApplied,
    fresh: fresh.length,
    dropped_by_reason: countReasons(dropped),
    kept: kept.length,
    kept_junior_signal: kept.filter((o) => o._junior).length,
    out_dir: outDir,
  }, null, 2));

  if (!args["no-state"] && !args.reuse) {
    for (const o of fresh) seen.add(o.id);
    state.seen = [...seen];
    state.history = [...(state.history || []), { date: today, since: winStart, collected: raw.length, fresh: fresh.length, kept: kept.length }];
    state.lastRun = today;
    state.lastRunAt = new Date().toISOString();
    writeState(STATE_FILE, state);
    process.stderr.write(`state.json : ${seen.size} offres vues\n`);
  } else process.stderr.write("state.json inchangé\n");
})().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
