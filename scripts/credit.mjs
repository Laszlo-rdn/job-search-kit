#!/usr/bin/env node
// Affiche le crédit Apify consommé ce mois-ci (plan gratuit : 5 $ par mois).
import { apifyToken } from "./lib.mjs";

const res = await fetch("https://api.apify.com/v2/users/me/limits", { headers: { Authorization: `Bearer ${apifyToken()}` } });
if (!res.ok) { console.error(`ERREUR Apify : ${res.status}`); process.exit(1); }
const { data } = await res.json();
const used = data.current.monthlyUsageUsd, max = data.limits.maxMonthlyUsageUsd;
console.log(`Apify : ${used.toFixed(2)} $ consommés sur ${max} $ ce mois-ci (reste ${(max - used).toFixed(2)} $)`);
