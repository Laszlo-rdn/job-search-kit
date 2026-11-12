#!/usr/bin/env node
// Scraper LinkedIn Jobs via Apify (acteur valig/linkedin-jobs-scraper : recherche publique, SANS cookie ni compte).
// Récupère les offres publiées (ou republiées) depuis le dernier run, écarte celles déjà vues ou déjà candidatées,
// applique les filtres de config.json et classe par nombre de candidats.
//
// Usage :
//   node scripts/linkedin/pull.mjs                 veille : tout ce qui est sorti depuis le dernier run (+ 2 h de marge)
//   node scripts/linkedin/pull.mjs --days=N        force une fenêtre de N jours
//   node scripts/linkedin/pull.mjs --max=N         offres max par recherche (sinon config.linkedin.maxParRecherche)
//   node scripts/linkedin/pull.mjs --no-state      ne met pas à jour state.json (test)
//   node scripts/linkedin/pull.mjs --reuse         retraite raw.json du jour sans rappeler Apify (gratuit)
//   node scripts/linkedin/pull.mjs --ignore-seen   reprend les offres déjà vues mais jamais candidatées
//
// Coût (plan gratuit Apify, 5 $/mois) : ≈ 0,0004 $ par offre + 0,001 $ par recherche.
// Les identifiants déjà vus sont passés à l'acteur (skipJobId) : ils ne sont pas refacturés.
// Ne jamais utiliser un acteur qui demande ton cookie LinkedIn (risque de restriction du compte).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  args, today, loadConfig, apifyToken, runActor, readState, writeState, plain, pairKey, keywordRegex, matches,
  appliedOffers, sameCompany, filterContext, commonFilter, enrich, writeOutputs, countReasons,
} from "../lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const ACTOR = "valig~linkedin-jobs-scraper";
const cfg = loadConfig();
const L = cfg.linkedin || {};
const MAX = Number(args.max || L.maxParRecherche || 25);
const APPLICANTS_SKIP = L.candidatsMax ?? 200;      // au-delà : écartée d'office
const APPLICANTS_STRICT = L.candidatsPalier ?? 100; // entre les deux : gardée seulement si le fit est vraiment bon (jugé au tri)

// Fenêtre à la seconde près (paramètre LinkedIn f_TPR) : depuis le dernier run + 2 h de marge, 24 h au premier run, 7 jours max.
const MARGIN_SEC = 2 * 3600, MAX_WINDOW_SEC = 7 * 86400;
function windowSeconds(state) {
  if (args.days) return Math.round(Number(args.days) * 86400);
  if (!state.lastRunAt) return 86400;
  const since = Math.round((Date.now() - new Date(state.lastRunAt).getTime()) / 1000) + MARGIN_SEC;
  return Math.min(Math.max(since, 3600), MAX_WINDOW_SEC);
}
const fmtWindow = (s) => (s >= 86400 ? `${(s / 86400).toFixed(1).replace(".0", "")} j` : `${Math.round(s / 3600)} h`);

const applicants = (v) => {
  if (typeof v === "number") return v;
  const m = String(v || "").match(/(\d[\d,.\s]*)/);
  return m ? Number(m[1].replace(/[^\d]/g, "")) : 0;
};

// Republication probable : identifiant nettement plus ancien que le gros du lot (les identifiants LinkedIn croissent
// dans le temps ; au repost, LinkedIn garde le compteur de candidats d'origine).
function repostThreshold(items) {
  const ids = items.map((o) => Number(o.id)).filter(Boolean).sort((a, b) => a - b);
  return ids.length ? ids[Math.floor(ids.length * 0.9)] - 12_000_000 : 0;
}

// HTML de description -> texte lisible (le champ texte brut de l'acteur colle les phrases entre elles)
function htmlToText(html = "") {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|ul|ol)>/gi, "\n\n").replace(/<li[^>]*>/gi, "- ").replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// L'acteur a connu deux formats de sortie : on lit les deux noms de champ à chaque fois
function normalize(o) {
  const n = applicants(o.applicationsCount ?? o.applicantsCount);
  const level = o.experienceLevel || o.seniorityLevel;
  const sector = o.sector || o.industries;
  const poster = o.recruiterName || o.jobPosterName;
  return {
    source: "LinkedIn",
    id: String(o.id),
    url: String(o.url || o.link || `https://www.linkedin.com/jobs/view/${o.id}`).split("?")[0],
    applyUrl: o.applyUrl || "",
    title: o.title || "",
    company: o.companyName || "",
    location: o.location || "",
    contract: o.contractType || o.employmentType || "",
    salary: o.salary || "",
    postedAt: String(o.postedDate || o.postedAt || "").slice(0, 10),
    description: o.descriptionHtml ? htmlToText(o.descriptionHtml) : o.description || o.descriptionText || "",
    _applicants: n,
    _search: o._search,
    extra: {
      posted: o.postedTimeAgo,
      lines: [
        `- **Mode de candidature :** ${o.applyType === "EASY_APPLY" ? "candidature simplifiée LinkedIn" : o.applyType === "EXTERNAL" ? "site externe (via la page LinkedIn)" : "?"}`,
        `- **Candidats LinkedIn :** ${n || "?"}`,
        `- **Niveau (champ LinkedIn, peu fiable) :** ${level || "?"}`,
        `- **Secteurs :** ${sector || "?"}`,
        ...(poster ? [`- **Publiée par :** ${poster}`] : []),
      ],
    },
  };
}

(async () => {
  const state = readState(STATE_FILE);
  const runStartedAt = new Date().toISOString();
  const WINDOW_SEC = windowSeconds(state);
  process.stderr.write(`Fenêtre : ${fmtWindow(WINDOW_SEC)}${state.lastRunAt && !args.days ? ` (depuis le run du ${state.lastRunAt} + 2 h de marge)` : ""}\n`);
  const seen = new Set(state.seen || []);
  const outDir = path.join(DIR, "out", today);
  fs.mkdirSync(outDir, { recursive: true });
  const rawFile = path.join(outDir, "raw.json");
  const applied = appliedOffers();

  // 1. Collecte
  let raw;
  if (args.reuse) raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  else {
    const token = apifyToken();
    const appliedIds = [...applied.refs].filter((r) => r.startsWith("linkedin:")).map((r) => r.slice(9));
    const skip = args["ignore-seen"] ? appliedIds : [...new Set([...seen, ...appliedIds])];
    const titleExclude = cfg.intitulesExclus || [];
    raw = [];
    for (const s of L.recherches || []) {
      const input = {
        keywords: s.mots,
        location: L.lieu,
        limit: Number(args.max || s.max || MAX),
        skipJobId: skip,
        // Les intitulés exclus sont filtrés côté acteur : ils ne sont pas facturés
        titleExclude: s.sansExclusions ? [] : titleExclude,
        urlParam: [{ key: "f_TPR", value: `r${WINDOW_SEC}` }],
      };
      if (L.tempsPleinSeulement !== false && !s.toutContrat) input.urlParam.push({ key: "f_JT", value: "F" });
      const items = await runActor(ACTOR, input, token, `« ${s.mots} »`);
      process.stderr.write(`Apify « ${s.mots} » : ${items.length} offres\n`);
      raw.push(...items.map((o) => ({ ...o, _search: s.mots })));
    }
    fs.writeFileSync(rawFile, JSON.stringify(raw, null, 1));
  }
  raw = raw.filter((o) => o.id && o.title);
  process.stderr.write(`Collecte : ${raw.length} offres\n`);

  // 2. Dédoublonnage + filtres
  const threshold = repostThreshold(raw);
  const byId = new Map();
  for (const o of raw) if (!byId.has(String(o.id))) byId.set(String(o.id), o);
  const ctx = filterContext(cfg);
  const exempt = keywordRegex((L.recherches || []).filter((s) => s.sansExclusions).map((s) => s.mots));
  const fresh = [], kept = [], dropped = [], pairs = new Set();
  let alreadySeen = 0, alreadyApplied = 0;
  for (const r of byId.values()) {
    const o = enrich(normalize(r));
    if (!args.reuse && !args["ignore-seen"] && seen.has(o.id)) { alreadySeen++; continue; }
    const pair = pairKey(o.company, o.title);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (applied.refs.has(`linkedin:${o.id}`) || applied.pairs.has(pair)) { alreadyApplied++; continue; }
    fresh.push(o);
    o._repost = Number(o.id) < threshold;
    o.extra.tags = [`${o._applicants || "?"} candidats`, o._repost ? "repost probable" : ""].filter(Boolean);
    if (o._repost) o.extra.lines.push("- **Republication probable :** identifiant ancien, compteur de candidats d'origine");

    const drop = (reason) => dropped.push({ ...o, _reason: reason });
    if (o._applicants >= APPLICANTS_SKIP) { drop(`${APPLICANTS_SKIP}+ candidats`); continue; }
    const why = commonFilter(o, cfg, { ...ctx, titleOut: matches(exempt, o._search) ? null : ctx.titleOut });
    if (why) { drop(why); continue; }
    if (sameCompany(applied, o.company)) o._note = "entreprise déjà candidatée (autre poste)";
    if (o._applicants >= APPLICANTS_STRICT) o._note = [o._note, `palier ${APPLICANTS_STRICT}-${APPLICANTS_SKIP - 1} candidats : garder seulement si le fit est vraiment bon`].filter(Boolean).join(" ; ");
    kept.push(o);
  }
  // Signal junior d'abord, puis moins de candidats que le palier, puis les plus récentes
  kept.sort((a, b) => (b._junior - a._junior) || ((a._applicants >= APPLICANTS_STRICT) - (b._applicants >= APPLICANTS_STRICT)) || b.postedAt.localeCompare(a.postedAt));

  writeOutputs(outDir, "LinkedIn", `Fenêtre : ${fmtWindow(WINDOW_SEC)} · offres nouvelles : ${fresh.length} · retenues pour le tri : ${kept.length}`, kept, dropped);

  console.log(JSON.stringify({
    window: fmtWindow(WINDOW_SEC),
    collected: raw.length,
    already_seen: alreadySeen,
    already_applied: alreadyApplied,
    fresh: fresh.length,
    dropped_by_reason: countReasons(dropped),
    kept: kept.length,
    kept_junior_signal: kept.filter((o) => o._junior).length,
    kept_over_applicants_step: kept.filter((o) => o._applicants >= APPLICANTS_STRICT).length,
    out_dir: outDir,
  }, null, 2));

  if (!args["no-state"] && !args.reuse) {
    for (const o of fresh) seen.add(o.id);
    state.seen = [...seen];
    state.history = [...(state.history || []), { date: today, at: runStartedAt, window: fmtWindow(WINDOW_SEC), collected: raw.length, fresh: fresh.length, kept: kept.length }];
    state.lastRun = today;
    state.lastRunAt = runStartedAt; // heure de DÉBUT de collecte : la fenêtre suivante repart de là
    writeState(STATE_FILE, state);
    process.stderr.write(`state.json : ${seen.size} offres vues\n`);
  } else process.stderr.write("state.json inchangé\n");
})().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
