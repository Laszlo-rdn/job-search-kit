#!/usr/bin/env node
// Scraper Civiweb (mon-vie-via.businessfrance.fr) : offres VIE / VIA. API publique, gratuite, sans Apify.
// Fenêtre : du JOUR du dernier run (inclus) à aujourd'hui, moins les références déjà vues
// (Civiweb ne donne que le jour de diffusion, pas l'heure : on rattrape ainsi les offres publiées après le run).
// Filtres de config.json : intitulés exclus / requis, expérience max, et config.civiweb (pays, types, durée).
// Pas de filtre de ville : les missions sont à l'étranger.
//
// Usage :
//   node scripts/civiweb/pull.mjs                  fenêtre = [jour du dernier run, aujourd'hui] ; 7 jours au premier run
//   node scripts/civiweb/pull.mjs --days=N         force une fenêtre de N jours
//   node scripts/civiweb/pull.mjs --no-state       ne met pas à jour state.json (test)
//   node scripts/civiweb/pull.mjs --ignore-seen    reprend les offres déjà vues mais jamais candidatées
//
// La clé API est celle que le site public injecte dans son code JavaScript (ce n'est pas un secret).
// Si l'API renvoie 401 : ouvrir le code source de https://mon-vie-via.businessfrance.fr/offres,
// chercher API_KEY:"..." et remplacer la constante ci-dessous.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  args, today, iso, loadConfig, readState, writeState, pairKey, keywordRegex, matches,
  appliedOffers, sameCompany, filterContext, commonFilter, enrich, writeOutputs, countReasons,
} from "../lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const API = "https://civiweb-api-prd.azurewebsites.net/api/Offers/search";
const API_KEY = "l+KwpoLPiXlsjxNT/NQ2iOFz8+iuygxAODs9FeAEWYM=";
const PAGE = 200;
const cfg = loadConfig();
const C = cfg.civiweb || {};

async function fetchAll() {
  const all = new Map();
  let skip = 0, count = Infinity;
  while (skip < count) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
      body: JSON.stringify({ limit: PAGE, skip, query: "" }),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 500)
        throw new Error(`API Civiweb : ${res.status}. La clé a probablement changé : la ré-extraire depuis le code source de https://mon-vie-via.businessfrance.fr/offres (API_KEY).`);
      throw new Error(`API Civiweb : ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const d = await res.json();
    count = d.count ?? 0;
    for (const o of d.result || []) all.set(o.id, o);
    if (!d.result?.length) break;
    skip += PAGE;
  }
  return [...all.values()];
}

function normalize(o) {
  // contactURL contient parfois une adresse email au lieu d'un lien : la candidature passe alors par la plateforme
  const ext = /^https?:\/\//i.test(o.contactURL || "") ? o.contactURL : "";
  return {
    source: "Civiweb",
    id: String(o.reference),
    url: `https://mon-vie-via.businessfrance.fr/offres/${o.id}`,
    applyUrl: ext,
    title: o.missionTitle || "",
    company: o.organizationName || "",
    location: [o.cityName, o.countryName].filter(Boolean).join(", "),
    contract: `${o.missionType || "VIE"} ${o.missionDuration || "?"} mois`,
    salary: o.indemnite ? `${Math.round(o.indemnite)} € par mois (indemnité)` : "",
    postedAt: String(o.startBroadcastDate || "").slice(0, 10),
    description: `## Description\n\n${o.missionDescription || "(non renseignée)"}\n\n## Profil recherché\n\n${o.missionProfile || "(non renseigné)"}`,
    _country: o.countryName || "",
    _type: o.missionType || "",
    _months: Number(o.missionDuration) || 0,
    extra: {
      lines: [
        `- **Contact (référent de l'offre) :** ${o.contactName || "non indiqué"}${o.contactEmail ? ` · ${o.contactEmail}` : ""}`,
        `- **Mode de candidature :** ${ext ? `lien externe (${ext})` : "via la plateforme Civiweb (CV + lettre + message personnalisé)"}${o.contactURL && !ext ? ` · autre contact indiqué : ${o.contactURL}` : ""}`,
        `- **Mission :** du ${String(o.missionStartDate || "?").slice(0, 10)} au ${String(o.missionEndDate || "?").slice(0, 10)}`,
        `- **Fin de diffusion :** ${String(o.endBroadcastDate || "?").slice(0, 10)}`,
        `- **Télétravail :** ${o.teleworkingAvailable ? "oui" : "non"}`,
      ],
      tags: [`${o.missionType || "VIE"} ${o.missionDuration || "?"} mois`],
    },
  };
}

(async () => {
  const state = readState(STATE_FILE);
  const seen = new Set(state.seen || []);
  const winStart = args.days ? iso(new Date(Date.now() - Number(args.days) * 86400000))
    : state.lastRun || iso(new Date(Date.now() - 7 * 86400000));
  process.stderr.write(`Fenêtre de diffusion : ${winStart} -> ${today}\n`);

  const all = await fetchAll();
  const applied = appliedOffers();
  const ctx = filterContext(cfg);
  const countryIn = keywordRegex(C.pays || []);
  const countryOut = keywordRegex(C.paysExclus || []);
  const types = (C.types || []).map((t) => t.toUpperCase());
  const fresh = [], kept = [], dropped = [], pairs = new Set();
  let alreadySeen = 0, alreadyApplied = 0;
  for (const r of all) {
    const o = enrich(normalize(r));
    if (!o.postedAt || o.postedAt < winStart || o.postedAt > today) continue;
    if (!args["ignore-seen"] && seen.has(o.id)) { alreadySeen++; continue; }
    const pair = pairKey(o.company, o.title);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (applied.refs.has(`civiweb:${o.id}`) || applied.pairs.has(pair)) { alreadyApplied++; continue; }
    fresh.push(o);

    const drop = (reason) => dropped.push({ ...o, _reason: reason });
    if (types.length && !types.includes(o._type.toUpperCase())) { drop(`type ${o._type}`); continue; }
    if (countryIn && !matches(countryIn, o._country)) { drop(`pays hors liste (${o._country})`); continue; }
    if (matches(countryOut, o._country)) { drop(`pays exclu (${o._country})`); continue; }
    if (C.dureeMinMois && o._months && o._months < C.dureeMinMois) { drop(`mission de ${o._months} mois`); continue; }
    const why = commonFilter(o, cfg, { ...ctx, checkLocation: false });
    if (why) { drop(why); continue; }
    if (sameCompany(applied, o.company)) o._note = "entreprise déjà candidatée (autre poste)";
    kept.push(o);
  }
  kept.sort((a, b) => b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id));

  const outDir = path.join(DIR, "out", today);
  fs.mkdirSync(outDir, { recursive: true });
  writeOutputs(outDir, "Civiweb", `Fenêtre de diffusion : ${winStart} à ${today} · offres nouvelles : ${fresh.length} · retenues pour le tri : ${kept.length}`, kept, dropped);

  console.log(JSON.stringify({
    window: { start: winStart, end: today },
    total_api: all.length,
    already_seen: alreadySeen,
    already_applied: alreadyApplied,
    fresh: fresh.length,
    dropped_by_reason: countReasons(dropped),
    kept: kept.length,
    out_dir: outDir,
  }, null, 2));

  if (!args["no-state"] && !args.days) {
    for (const o of fresh) seen.add(o.id);
    state.seen = [...seen];
    state.history = [...(state.history || []), { date: today, since: winStart, fresh: fresh.length, kept: kept.length }];
    state.lastRun = today;
    state.lastRunAt = new Date().toISOString();
    writeState(STATE_FILE, state);
    process.stderr.write(`state.json : ${seen.size} offres vues\n`);
  } else process.stderr.write("state.json inchangé\n");
})().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
