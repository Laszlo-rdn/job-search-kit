#!/usr/bin/env node
// Scraper Welcome to the Jungle via Apify (acteur bebity/welcome-to-the-jungle-jobs-scraper).
// Récupère les offres publiées depuis N jours (config.wttj.jours, 7 par défaut) dans un rayon autour d'un point,
// écarte celles déjà vues ou déjà candidatées et applique les filtres de config.json
// (expérience : le chiffre écrit dans l'offre prime sur le champ WTTJ, peu fiable).
//
// Usage :
//   node scripts/wttj/pull.mjs                run complet (met à jour state.json)
//   node scripts/wttj/pull.mjs --days=14      élargit la fenêtre
//   node scripts/wttj/pull.mjs --max=N        offres max par recherche
//   node scripts/wttj/pull.mjs --no-state     ne met pas à jour state.json (test)
//   node scripts/wttj/pull.mjs --reuse        retraite les raw-*.json du jour sans rappeler Apify (gratuit)
//   node scripts/wttj/pull.mjs --ignore-seen  reprend les offres déjà vues mais jamais candidatées
//
// Coût : ≈ 0,0008 $ par offre (annonce + détail), plafonné par recherche ; ≈ 0,10 $ pour 5 recherches de 25 offres.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  args, today, iso, loadConfig, apifyToken, readState, writeState, norm, pairKey, yearsRequired,
  appliedOffers, sameCompany, filterContext, commonFilter, enrich, writeOutputs, countReasons,
} from "../lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const ACTOR = "bebity~welcome-to-the-jungle-jobs-scraper";
const cfg = loadConfig();
const W = cfg.wttj || {};
const DAYS = Number(args.days || W.jours || 7);
const MAX = Number(args.max || W.maxParRecherche || 25);

async function runSearch(query, token) {
  const input = {
    action: "get-jobs", query, orderBy: "published_at", postedWithinDays: DAYS,
    latitude: String(W.latitude), longitude: String(W.longitude), radiusKm: W.rayonKm ?? 15,
    includeDetails: true, maxItems: MAX,
  };
  if (W.contrats?.length) input.contractType = W.contrats;
  const cap = (MAX * 0.0008 + 0.005).toFixed(3); // plafond de dépense par recherche
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240&maxTotalChargeUsd=${cap}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify « ${query} » : ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).map(fromBebity);
}

// Sortie de l'acteur -> format compact (c'est ce format qui est stocké dans raw-*.json)
function fromBebity(o) {
  const org = o.organization || {};
  const canonical = (o.urls || []).find((u) => u.kind === "canonical")?.href;
  return {
    id: o.reference, name: o.name, organizationName: org.name,
    url: canonical || o.publicUrl, applyUrl: o.apply_url,
    offices: o.offices?.length ? o.offices : o.office ? [o.office] : [],
    contractType: o.contract_type, remote: o.remote,
    salaryMin: o.salary_minimum, salaryMax: o.salary_maximum, salaryCurrency: o.salary_currency, salaryPeriod: o.salary_period,
    experienceLevel: o.experience_level_minimum, educationLevel: o.education_level,
    startDate: o.start_date, publishedAt: o.published_at,
    organizationEmployees: org.nb_employees, organizationCreationYear: org.creation_year, organizationWebsite: org.media_website_url,
    companySummary: o.company_summary, keyMissions: o.key_missions, description: o.description, profile: o.profile,
    recruitmentProcess: o.recruitment_process, organizationDescription: org.description || o.company_description,
  };
}

const text = (html) => (html || "").replace(/<\/(p|li|h\d)>/g, "\n").replace(/<br\s*\/?>/g, "\n").replace(/<li>/g, "- ")
  .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
const place = (o) => (o.offices || []).map((x) => [x.city, x.zip_code].filter(Boolean).join(" ")).join(" ; ");
const salary = (o) => (!o.salaryMin && !o.salaryMax ? "" : `${o.salaryMin ?? "?"} à ${o.salaryMax ?? "?"} ${o.salaryCurrency || "EUR"} (${o.salaryPeriod || "?"})`);

function normalize(o) {
  const description = [
    o.keyMissions?.length ? `## Missions clés\n\n${o.keyMissions.map((m) => `- ${m}`).join("\n")}` : "",
    `## Descriptif du poste\n\n${text(o.description) || "(non renseigné)"}`,
    `## Profil recherché\n\n${text(o.profile) || "(non renseigné)"}`,
    o.recruitmentProcess ? `## Processus de recrutement\n\n${text(o.recruitmentProcess)}` : "",
    o.organizationDescription ? `## Entreprise\n\n${text(o.organizationDescription)}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    source: "WTTJ",
    id: String(o.id),
    url: o.url,
    applyUrl: o.applyUrl || "",
    title: o.name || "",
    company: o.organizationName || "",
    location: place(o),
    postal: (o.offices || [])[0]?.zip_code || "",
    contract: o.contractType || "",
    salary: salary(o),
    postedAt: String(o.publishedAt || "").slice(0, 10),
    description,
    _fieldYears: typeof o.experienceLevel === "number" ? o.experienceLevel : null,
    _salaryMaxYear: o.salaryPeriod === "yearly" ? o.salaryMax : null,
    extra: {
      lines: [
        `- **Télétravail :** ${o.remote || "?"}`,
        `- **Expérience (champ WTTJ, peu fiable) :** ${o.experienceLevel ?? "?"} an(s)`,
        `- **Niveau d'études :** ${o.educationLevel || "?"}`,
        `- **Date de début :** ${String(o.startDate || "?").slice(0, 10)}`,
        `- **Entreprise :** ${o.organizationEmployees ?? "?"} salariés${o.organizationCreationYear ? `, créée en ${o.organizationCreationYear}` : ""}${o.organizationWebsite ? `, ${o.organizationWebsite}` : ""}`,
        ...(o.companySummary ? [`- **Activité :** ${o.companySummary}`] : []),
      ],
      tags: [],
    },
  };
}

(async () => {
  const state = readState(STATE_FILE);
  const seen = new Set(state.seen || []);
  const outDir = path.join(DIR, "out", today);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Collecte
  const raw = [];
  if (args.reuse) {
    for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith("raw-")))
      raw.push(...JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")));
  } else {
    if (W.latitude == null || W.longitude == null) throw new Error("config.wttj.latitude / longitude manquants.");
    const token = apifyToken();
    for (const q of W.recherches || []) {
      const items = (await runSearch(q, token)).filter((o) => o.id && o.name);
      fs.writeFileSync(path.join(outDir, `raw-${norm(q).replace(/[^a-z0-9]+/g, "-")}.json`), JSON.stringify(items, null, 1));
      process.stderr.write(`Apify « ${q} » : ${items.length} offres\n`);
      raw.push(...items);
    }
  }

  // 2. Fenêtre + dédoublonnage + filtres
  const winStart = iso(new Date(Date.now() - DAYS * 86400000));
  const applied = appliedOffers();
  const ctx = filterContext(cfg);
  const salaryMin = cfg.salaireMinAnnuel || 0;
  const byId = new Map();
  for (const o of raw) if (!byId.has(o.id)) byId.set(o.id, o);
  const fresh = [], kept = [], dropped = [], pairs = new Set();
  let alreadySeen = 0, alreadyApplied = 0;
  for (const r of byId.values()) {
    let o = enrich(normalize(r));
    if (!o.postedAt || o.postedAt < winStart) continue;
    if (!args.reuse && !args["ignore-seen"] && seen.has(o.id)) { alreadySeen++; continue; }
    const pair = pairKey(o.company, o.title);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (applied.refs.has(`wttj:${o.id}`) || applied.pairs.has(pair)) { alreadyApplied++; continue; }
    fresh.push(o);

    // Pas de chiffre dans le texte : on se rabat sur le champ WTTJ
    if (!yearsRequired(o.description).years && o._fieldYears) o = { ...o, _years: o._fieldYears, _yearsQuote: "champ WTTJ", _strong: true };
    const drop = (reason) => dropped.push({ ...o, _reason: reason });
    const why = commonFilter(o, cfg, ctx);
    if (why) { drop(why); continue; }
    if (salaryMin && o._salaryMaxYear && o._salaryMaxYear < salaryMin) { drop(`salaire max ${o._salaryMaxYear} < ${salaryMin}`); continue; }
    if (sameCompany(applied, o.company)) o._note = "entreprise déjà candidatée (autre poste)";
    kept.push(o);
  }
  kept.sort((a, b) => (b._junior - a._junior) || b.postedAt.localeCompare(a.postedAt));

  writeOutputs(outDir, "WTTJ", `Publication depuis le ${winStart} (${DAYS} jours) · offres nouvelles : ${fresh.length} · retenues pour le tri : ${kept.length}`, kept, dropped);

  console.log(JSON.stringify({
    window: { start: winStart, end: today, days: DAYS },
    collected: raw.length,
    already_seen: alreadySeen,
    already_applied: alreadyApplied,
    fresh: fresh.length,
    dropped_by_reason: countReasons(dropped),
    kept: kept.length,
    kept_junior_signal: kept.filter((o) => o._junior).length,
    est_cost_usd: args.reuse ? 0 : +(raw.length * 0.0008).toFixed(2),
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
