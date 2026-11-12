#!/usr/bin/env node
// Convertit un CV HTML en PDF avec Chrome ou Edge en mode headless (aucune installation supplémentaire).
//
// Usage : node scripts/cv-pdf.mjs <cv.html> <sortie.pdf>
// Affiche le nombre de pages du PDF produit, pour vérifier que le CV tient sur la longueur voulue.
// Navigateur introuvable : définir la variable CHROME_PATH avec le chemin de chrome.exe / msedge.exe.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node scripts/cv-pdf.mjs <cv.html> <sortie.pdf>");
  process.exit(1);
}

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pf = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...pf.flatMap((p) => [
      path.join(p, "Google/Chrome/Application/chrome.exe"),
      path.join(p, "Microsoft/Edge/Application/msedge.exe"),
    ]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge",
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error("Chrome ou Edge introuvable : définir CHROME_PATH.");
  return found;
}

const src = path.resolve(input), dest = path.resolve(output);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cv-pdf-")); // profil jetable : n'interfère pas avec le navigateur ouvert
try {
  execFileSync(findBrowser(), [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}`, "--no-pdf-header-footer", "--print-to-pdf-no-header",
    `--print-to-pdf=${dest}`, pathToFileURL(src).href,
  ], { stdio: "ignore", timeout: 60000 });
} finally {
  fs.rmSync(profile, { recursive: true, force: true });
}
if (!fs.existsSync(dest)) { console.error("ERREUR : PDF non produit."); process.exit(1); }
const pages = (fs.readFileSync(dest, "latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
console.log(`PDF : ${dest} (${pages} page${pages > 1 ? "s" : ""})`);
