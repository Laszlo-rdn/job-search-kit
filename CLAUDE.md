# CLAUDE.md

Kit de recherche d'emploi pour Claude Code : veille des offres LinkedIn, Indeed, JobTeaser, Welcome to the Jungle (via Apify) et Civiweb (API publique), tri par un agent, puis rédaction des lettres de motivation et des messages de candidature. **Rien n'est jamais envoyé** : tout reste dans `candidatures/`, l'utilisateur postule lui-même.

## Comment m'aider

- Réponds en français, de façon directe et concise.
- Sois honnête sur les offres : si une offre ne colle pas au profil, dis-le.
- Le profil de l'utilisateur est dans `profil/profil.md`. N'invente jamais une expérience, un chiffre ou une compétence qui n'y figure pas.
- Si `profil/profil.md` contient encore des `[crochets]`, propose `/setup` avant toute autre commande.

## Commandes

| Commande | Rôle |
|---|---|
| `/setup` | Installation, profil, adaptation de `config.json` |
| `/linkedin` | Veille LinkedIn depuis le dernier run, 12 meilleures offres |
| `/indeed` | Veille Indeed sur 7 jours, 12 à 20 offres |
| `/jobteaser` | Veille JobTeaser depuis le dernier run, 20 offres max |
| `/wttj` | Veille Welcome to the Jungle sur 7 jours, 20 offres max |
| `/civiweb` | Veille des VIE / VIA Civiweb depuis le dernier run (gratuit, sans Apify) |

Chaque commande s'arrête après le tri pour que l'utilisateur valide la liste avant la rédaction.

## Structure

```
config.json                 critères de recherche (lieu, mots-clés, expérience max...)
profil/profil.md            le profil candidat (lu par les agents)
profil/consignes-ldm.md     règles de rédaction des lettres
profil/cv/                  CV d'origine (PDF ou Word)
profil/cv-base.html         CV de base en HTML (créé par /setup), adapté à chaque offre
profil/cv-modele.html       modèle vierge du CV
profil/ldm-modele.html      modèle de lettre
scripts/cv-pdf.mjs          HTML -> PDF avec Chrome ou Edge
scripts/<source>/pull.mjs   collecte Apify + filtres
scripts/lib.mjs             fonctions communes aux scripts
scripts/procedure-agent.md  procédure des agents de rédaction
scripts/pipeline-commun.md  phases 3 et 4 communes aux commandes
candidatures/<date>/        un dossier par candidature (non versionné)
```

`profil/`, `candidatures/`, `.env` et les `state.json` contiennent des données personnelles : ils ne sont pas poussés sur GitHub (voir `.gitignore`).
