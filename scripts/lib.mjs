// Fonctions communes aux trois scrapers (LinkedIn, Indeed, JobTeaser).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CANDIDATURES = path.join(ROOT, "candidatures");

// ---------- Arguments : --cle=valeur ou --drapeau ----------
export const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

export const iso = (d) => d.toISOString().slice(0, 10);
export const today = iso(new Date());

// ---------- Configuration (config.json à la racine) ----------
export function loadConfig() {
  const f = path.join(ROOT, "config.json");
  if (!fs.existsSync(f)) throw new Error("config.json introuvable à la racine du kit. Lance /setup dans Claude Code.");
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

// ---------- Token Apify : variable APIFY_TOKEN, sinon fichier .env à la racine ----------
export function apifyToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN.trim();
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, "utf8").match(/^\s*APIFY_TOKEN\s*=\s*"?([^"\r\n]+)"?/m);
    if (m && !m[1].includes("xxx")) return m[1].trim();
  }
  throw new Error("Token Apify introuvable : copie .env.example en .env et colle ton token (console.apify.com > Settings > API & Integrations).");
}

// Lance un acteur Apify et attend ses résultats. Les appels partent un par un :
// en parallèle, le plan gratuit renvoie une erreur 402 (limite mémoire).
export async function runActor(actor, input, token, label = actor) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify ${label} : ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- État (offres déjà vues, date du dernier run) ----------
export function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return { lastRun: null, lastRunAt: null, seen: [], history: [] }; }
}
export function writeState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// ---------- Texte ----------
export const norm = (s = "") => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const plain = (s = "") => String(s).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Liste de mots-clés -> regex insensible à la casse et aux accents, sur des mots entiers.
// Un astérisque final accepte toutes les fins de mot : "commerc*" couvre commercial, commerciale, commerce...
export function keywordRegex(list = []) {
  const words = list.map((w) => norm(w).trim()).filter(Boolean);
  if (!words.length) return null;
  // Espaces, tirets, apostrophes et points du mot-clé acceptent n'importe quel séparateur ("saint-denis" = "Saint Denis")
  const pat = (w) => w.split(/[\s'’.-]+/).filter(Boolean).map(escapeRe).join("[^a-z0-9]{0,2}");
  const alt = words.map((w) => (w.endsWith("*") ? pat(w.slice(0, -1)) : `${pat(w)}(?=$|[^a-z0-9])`));
  return new RegExp(`(?:^|[^a-z0-9])(?:${alt.join("|")})`, "i");
}
export const matches = (re, s) => !!re && re.test(norm(s));

// Clé entreprise + intitulé, sans ponctuation ni mention H/F
export const coKey = (c = "") => norm(c).replace(/[^a-z0-9]/g, "");
export const pairKey = (c = "", t = "") =>
  coKey(c) + "|" + norm(t).replace(/\(?\b[hfm]\/[hfmx](\/[hfmx])?\)?/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// ---------- Filtres communs ----------
// Années d'expérience exigées : "3 ans d'expérience", "5+ years of experience", "minimum 4 ans"...
// "strong" = formulation clairement exigée (pas "présents depuis 10 ans en Europe").
export function yearsRequired(txt = "") {
  const t = String(txt).replace(/\s+/g, " ");
  const re = /(?:minimum|au moins|at least|min\.?)?\s*(\d{1,2})\s*(?:\+|ans? ou plus|à\s*\d+|-\s*\d+|–\s*\d+)?\s*(?:ans?|années?|years?)\s*(?:minimum\s*)?(?:d['’]\s*|de\s+|of\s+)?(?:exp|expérience|experience|professional|en |in |dans |within )/gi;
  let max = 0, quote = "";
  for (const m of t.matchAll(re)) {
    const n = Number(m[1]);
    if (n > max && n <= 15) { max = n; quote = m[0].trim(); }
  }
  const strong = /exp|minimum|au moins|at least|\+/i.test(quote);
  return { years: max, quote, strong };
}

// Lieu accepté : mots-clés de config.filtreLieu.motsCles, ou code postal dans config.filtreLieu.departements.
// Les deux listes vides = pas de filtre de lieu.
export function locationFilter(cfg) {
  const kw = keywordRegex(cfg.filtreLieu?.motsCles || []);
  const depts = (cfg.filtreLieu?.departements || []).map(String);
  if (!kw && !depts.length) return () => true;
  return (loc = "", postal = "") => {
    if (matches(kw, loc)) return true;
    const codes = [String(postal), ...(String(loc).match(/\b\d{5}\b/g) || [])].filter(Boolean);
    return codes.some((c) => depts.some((d) => c.startsWith(d)));
  };
}

// Signal "poste accessible à un débutant"
export const JUNIOR = /junior|jeune dipl[ôo]m|premi[èe]re exp[ée]rience|d[ée]butant|entry.level|graduate|recent grad|new grad|early career|0\s*(?:[-à]|to)\s*[12]\s*(?:ans?|years?)|sortie? d.[ée]cole|fin d.[ée]tudes/i;

// ---------- Déjà candidaté ----------
// Lit candidatures/<date>/<dossier>/offre.md : ligne "**Référence :** <Source> <id>" et titre "# Poste — Entreprise".
export function appliedOffers() {
  const refs = new Set(), pairs = new Set(), companies = new Set();
  if (!fs.existsSync(CANDIDATURES)) return { refs, pairs, companies };
  for (const day of fs.readdirSync(CANDIDATURES)) {
    const dayDir = path.join(CANDIDATURES, day);
    if (!fs.statSync(dayDir).isDirectory()) continue;
    for (const d of fs.readdirSync(dayDir)) {
      const f = path.join(dayDir, d, "offre.md");
      if (!fs.existsSync(f)) continue;
      const txt = fs.readFileSync(f, "utf8");
      const r = txt.match(/\*\*Référence :\*\*\s*(\w+)\s+(\S+)/);
      if (r) refs.add(`${r[1].toLowerCase()}:${r[2]}`);
      const h = txt.match(/^# (.+?) — (.+)$/m);
      if (h) { pairs.add(pairKey(h[2], h[1])); pairs.add(pairKey(h[1], h[2])); companies.add(coKey(h[2])); }
    }
  }
  return { refs, pairs, companies };
}
export const sameCompany = (applied, company) => {
  const ck = coKey(company);
  return ck.length > 3 && [...applied.companies].some((c) => c.length > 3 && (ck.startsWith(c) || c.startsWith(ck)));
};

// ---------- Fichiers de sortie ----------
// Vide un dossier fichier par fichier (supprimer le dossier échoue s'il est ouvert ou synchronisé par OneDrive / Drive)
export function resetDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true, recursive: true });
}

// Fiche offre.md commune aux trois sources (format lu par appliedOffers)
export function offerMd(o) {
  const lines = [
    `# ${o.title} — ${o.company || "Entreprise non affichée"}`,
    "",
    `- **Source :** ${o.source} — ${o.url}`,
    `- **Référence :** ${o.source} ${o.id}`,
    `- **Lien de candidature :** ${o.applyUrl || o.url}`,
    `- **Contrat :** ${o.contract || "non précisé"}`,
    `- **Lieu :** ${o.location || "non précisé"}`,
    `- **Salaire :** ${o.salary || "non affiché"}`,
    `- **Publiée le :** ${o.postedAt || "?"}${o.extra?.posted ? ` (${o.extra.posted})` : ""}`,
    ...(o.extra?.lines || []),
    `- **Expérience détectée :** ${o._years ? `${o._years} an(s) (« ${o._yearsQuote} »)` : "rien de chiffré"}${o._junior ? " · signal junior / débutant" : ""}`,
    ...(o._note ? [`- **Attention :** ${o._note}`] : []),
    `- **Extraction :** ${today}`,
    "",
    "## Description complète",
    "",
    (o.description || "(non renseignée)").trim(),
    "",
  ];
  return lines.join("\n");
}

// Fiches courtes pour l'agent de tri : en-tête + extrait de la partie "profil recherché"
const PROFILE = /(profil recherch|votre profil|ton profil|le profil|profil :|qualifications|requirements|about you|who you are|what you.ll bring|what we.re looking|you have|you bring|vous (?:êtes|avez|disposez)|tu (?:es|as)\b|comp[ée]tences|expérience requise|ce que nous recherchons|ce qu.on cherche)/i;
export function shortSheets(source, list) {
  return `# ${source} : fiches courtes pour le tri (${today})

${list.length} offres. Une fiche = en-tête + extrait des exigences. Lire l'offre complète (offres-md/<id>.md) seulement pour trancher un doute.

` + list.map((o) => {
    const d = (o.description || "").replace(/\s+/g, " ");
    const i = d.search(PROFILE);
    const excerpt = (i >= 0 ? d.slice(i, i + 700) : d.slice(0, 500)).trim();
    const tags = [plain(o.location), o.postedAt, ...(o.extra?.tags || []), o._junior ? "SIGNAL JUNIOR" : "", o._years ? `${o._years} an(s) détecté(s)` : "", o.salary ? plain(o.salary) : "", o._note || ""].filter(Boolean);
    return `## ${o.id} · ${plain(o.title)} · ${plain(o.company)}
${tags.join(" · ")}
> ${excerpt}${i < 0 ? " [section profil non repérée : début de l'offre]" : ""}
`;
  }).join("\n");
}

export function report(source, header, kept, dropped) {
  const row = (o, extra) => `| ${o.id} | ${o.postedAt || "?"} | ${plain(o.title)} | ${plain(o.company)} | ${plain(o.location)} | ${extra} |`;
  return `# ${source} : run du ${today}

${header}

## Retenues pour le tri (${kept.length})

| id | Publiée | Poste | Entreprise | Lieu | Repères |
|---|---|---|---|---|---|
${kept.map((o) => row(o, [...(o.extra?.tags || []), o._junior ? "junior" : "", o._note || ""].filter(Boolean).join(", "))).join("\n")}

## Écartées par le script (${dropped.length})

| id | Publiée | Poste | Entreprise | Lieu | Raison |
|---|---|---|---|---|---|
${dropped.map((o) => row(o, o._reason)).join("\n")}
`;
}

// Applique les filtres communs à une offre normalisée. Renvoie la raison d'exclusion, ou null si gardée.
export function commonFilter(o, cfg, ctx) {
  if (matches(ctx.titleOut, o.title)) return "intitulé exclu (config.intitulesExclus)";
  if (ctx.titleIn && !matches(ctx.titleIn, o.title)) return "intitulé hors périmètre (config.intitulesRequis)";
  if (ctx.checkLocation !== false && !ctx.locOk(o.location, o.postal)) return "hors zone (config.filtreLieu)";
  const max = cfg.experienceMaxAns;
  if (max != null && o._years > max && o._strong) return `${o._years} ans d'expérience exigés (« ${o._yearsQuote} »)`;
  return null;
}

export function filterContext(cfg) {
  return {
    titleOut: keywordRegex(cfg.intitulesExclus || []),
    titleIn: keywordRegex(cfg.intitulesRequis || []),
    locOk: locationFilter(cfg),
  };
}

export function enrich(o) {
  const { years, quote, strong } = yearsRequired(o.description);
  return { ...o, _years: years, _yearsQuote: quote, _strong: strong, _junior: JUNIOR.test(o.title) || JUNIOR.test(o.description || "") };
}

export function writeOutputs(outDir, source, header, kept, dropped) {
  fs.writeFileSync(path.join(outDir, "offres-retenues.json"), JSON.stringify(kept, null, 1));
  fs.writeFileSync(path.join(outDir, "rapport.md"), report(source, header, kept, dropped));
  const mdDir = path.join(outDir, "offres-md");
  resetDir(mdDir);
  for (const o of kept) fs.writeFileSync(path.join(mdDir, `${o.id}.md`), offerMd(o));
  fs.writeFileSync(path.join(outDir, "resume-tri.md"), shortSheets(source, kept));
}

export function countReasons(dropped) {
  const r = {};
  for (const o of dropped) { const k = o._reason.replace(/\s*\(.*$|« .*$/g, "").replace(/^\d+ ans/, "N ans").trim(); r[k] = (r[k] || 0) + 1; }
  return r;
}
