#!/usr/bin/env node
// Scraper Indeed via Apify (acteur valig/indeed-jobs-scraper). Indeed bloque les requêtes directes, d'où Apify.
// Récupère les offres publiées depuis N jours (config.indeed.jours, 7 par défaut), écarte celles déjà vues
// ou déjà candidatées, les contrats exclus et applique les filtres de config.json.
//
// Usage :
//   node scripts/indeed/pull.mjs                run complet (met à jour state.json)
//   node scripts/indeed/pull.mjs --days=3       fenêtre plus courte (valeurs Indeed : 1, 3, 7, 14)
//   node scripts/indeed/pull.mjs --max=N        nombre max d'offres par requête
//   node scripts/indeed/pull.mjs --no-state     ne met pas à jour state.json (test)
//   node scripts/indeed/pull.mjs --reuse        retraite les raw-*.json du jour sans rappeler Apify (gratuit)
//   node scripts/indeed/pull.mjs --ignore-seen  ne filtre pas les offres déjà vues (test)
//
// Coût : ≈ 0,0001 $ par offre (≈ 0,10 $ pour 1 000 offres).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  args, today, iso, loadConfig, apifyToken, runActor, readState, writeState, norm, pairKey, keywordRegex, matches,
  appliedOffers, sameCompany, filterContext, commonFilter, enrich, writeOutputs, countReasons,
} from "../lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const ACTOR = "valig~indeed-jobs-scraper";
const cfg = loadConfig();
const I = cfg.indeed || {};
const DAYS = Number(args.days || I.jours || 7);
const MAX = Number(args.max || I.maxParRecherche || 100);
const CONTRACT_OUT = keywordRegex(cfg.contratsExclus || []);

const company = (o) => o.employer?.name || o.parentEmployer?.name || "";
const contract = (o) => Object.values(o.jobTypes || o.attributes || {}).join(" / ");

function normalize(o) {
  const s = o.baseSalary || {};
  return {
    source: "Indeed",
    id: String(o.key),
    url: o.url,
    applyUrl: o.jobUrl && o.jobUrl !== o.url ? o.jobUrl : "",
    title: o.title || "",
    company: company(o),
    location: [o.location?.city, o.location?.postalCode].filter(Boolean).join(" "),
    postal: o.location?.postalCode || o.location?.admin2Code || "",
    contract: contract(o),
    salary: s.min || s.max ? `${s.min ?? "?"} à ${s.max ?? "?"} ${s.currencyCode || ""} / ${s.unitOfWork || "?"}` : "",
    postedAt: String(o.datePublished || o.dateOnIndeed || "").slice(0, 10),
    description: o.description?.text || "",
    expired: o.expired,
    extra: { lines: [...(o.employer?.employeesCount ? [`- **Taille :** ${o.employer.employeesCount} salariés`] : [])], tags: [] },
  };
}

(async () => {
  const state = readState(STATE_FILE);
  const seen = new Set(state.seen || []);
  const outDir = path.join(DIR, "out", today);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Collecte, requête par requête
  const raw = [];
  if (args.reuse) {
    for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith("raw-")))
      raw.push(...JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")));
  } else {
    const token = apifyToken();
    const datePosted = String([1, 3, 7, 14].find((d) => d >= DAYS) || 14);
    for (const q of I.recherches || []) {
      const input = { country: I.pays || "fr", title: q, location: I.lieu, limit: MAX, datePosted };
      const items = (await runActor(ACTOR, input, token, `« ${q} »`)).filter((o) => o.key && o.title);
      fs.writeFileSync(path.join(outDir, `raw-${norm(q).replace(/[^a-z0-9]+/g, "-")}.json`), JSON.stringify(items, null, 1));
      process.stderr.write(`Apify « ${q} » : ${items.length} offres\n`);
      raw.push(...items);
    }
  }

  // 2. Fenêtre + dédoublonnage + filtres
  const winStart = iso(new Date(Date.now() - DAYS * 86400000));
  const applied = appliedOffers();
  const ctx = filterContext(cfg);
  const byKey = new Map();
  for (const o of raw) if (o.key && !byKey.has(o.key)) byKey.set(o.key, o);
  const fresh = [], kept = [], dropped = [], pairs = new Set();
  let alreadySeen = 0, alreadyApplied = 0;
  for (const r of byKey.values()) {
    const o = enrich(normalize(r));
    if (!o.postedAt || o.postedAt < winStart || o.expired) continue;
    if (!args["ignore-seen"] && seen.has(o.id)) { alreadySeen++; continue; }
    const pair = pairKey(o.company, o.title);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (applied.refs.has(`indeed:${o.id}`) || (o.company && applied.pairs.has(pair))) { alreadyApplied++; continue; }
    fresh.push(o);

    const drop = (reason) => dropped.push({ ...o, _reason: reason });
    if (matches(CONTRACT_OUT, o.contract)) { drop(`contrat exclu (${o.contract})`); continue; }
    const why = commonFilter(o, cfg, ctx);
    if (why) { drop(why); continue; }
    if (!o.contract) o.extra.tags.push("contrat non précisé");
    if (/recrutement|recruitment|interim|adecco|randstad|manpower|michael page|page personnel|hays|robert (half|walters)|expectra|walters people/i.test(o.company) || r.isPlacement)
      o.extra.tags.push("cabinet de recrutement");
    if (sameCompany(applied, o.company)) o._note = "entreprise déjà candidatée (autre poste)";
    kept.push(o);
  }
  kept.sort((a, b) => (b._junior - a._junior) || b.postedAt.localeCompare(a.postedAt));

  writeOutputs(outDir, "Indeed", `Publication depuis le ${winStart} (${DAYS} jours) · offres nouvelles : ${fresh.length} · retenues pour le tri : ${kept.length}`, kept, dropped);

  console.log(JSON.stringify({
    window: { start: winStart, end: today, days: DAYS },
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
    state.history = [...(state.history || []), { date: today, days: DAYS, collected: raw.length, fresh: fresh.length, kept: kept.length }];
    state.lastRun = today;
    state.lastRunAt = new Date().toISOString();
    writeState(STATE_FILE, state);
    process.stderr.write(`state.json : ${seen.size} offres vues\n`);
  } else process.stderr.write("state.json inchangé\n");
})().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
