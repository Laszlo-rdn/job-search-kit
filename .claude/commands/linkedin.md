# /linkedin

> Veille quotidienne LinkedIn : offres publiées ou republiées **depuis le dernier run**, filtrées selon `config.json`,
> triées par comparaison de tout le lot (les 12 meilleures, pas les 12 premières), validation par l'utilisateur,
> puis rédaction des candidatures par lots de 5. Rien n'est envoyé.

## Vue d'ensemble

```
Phase 1  node scripts/linkedin/pull.mjs   → offres depuis le dernier run, jamais vues, filtres de config.json
Phase 2  1 agent de tri (Sonnet)          → comparaison de TOUT le lot, 1 par entreprise, 12 meilleures
         présentation                     → STOP, validation de l'utilisateur
Phase 3  agents de rédaction par lots de 5
Phase 4  récap + nettoyage
```

Si `profil/profil.md` contient encore des `[crochets]` à remplir, s'arrêter et proposer `/setup`.

## Phase 1 : collecte

Vérifier le crédit Apify : `node scripts/credit.mjs`. Un run quotidien coûte environ 0,15 $. S'il reste moins de 0,20 $, le dire et proposer `--max=15` ou d'attendre la remise à zéro mensuelle.

Puis lancer, en arrière-plan (une recherche après l'autre, quelques minutes) :

```
node scripts/linkedin/pull.mjs
```

Le script interroge l'acteur Apify `valig/linkedin-jobs-scraper` (recherche publique, sans compte ni cookie) pour chaque recherche de `config.linkedin.recherches`, sur la fenêtre « depuis le dernier run + 2 h » (24 h au premier run, 7 jours max). Il écarte les offres déjà vues, déjà candidatées (dossiers de `candidatures/`), au-delà de `candidatsMax` candidats, les intitulés exclus ou hors périmètre, hors zone, et celles qui exigent plus de `experienceMaxAns` ans. Il signale sans écarter : palier de candidats, republication probable, signal junior, entreprise déjà candidatée.

Sorties dans `scripts/linkedin/out/<aujourd'hui>/` : `rapport.md`, `resume-tri.md` (fiches courtes), `offres-md/<id>.md`.

Arguments : `--days=N`, `--max=N`, `--no-state`, `--reuse` (retraiter le jour sans rappeler Apify), `--ignore-seen`.

- 0 offre collectée : LinkedIn bloque probablement l'acteur. Le dire, proposer d'en chercher un autre **sans cookie**, ne pas insister.
- Aucune offre retenue : le dire et s'arrêter.

**Ne pas lire `offres-md/` ni `resume-tri.md` dans la session principale** : c'est le travail de l'agent de tri. Lire seulement le JSON affiché par le script.

## Phase 2 : tri comparatif (POINT D'ARRÊT)

Un agent `general-purpose`, **`model: "sonnet"`**, au premier plan. Prompt :

> Tu tries les offres LinkedIn du run. Tu n'écris aucune candidature.
>
> Lis `profil/profil.md`, puis `scripts/linkedin/out/[DATE]/resume-tri.md` (une fiche courte par offre). Étudie TOUTES les fiches avant de choisir : c'est une comparaison, pas une recherche des premières qui conviennent. N'ouvre l'offre complète (`offres-md/<id>.md`) que pour trancher un doute sur une candidate au top (une vingtaine d'ouvertures au plus).
>
> Pour chaque offre :
> 1. **Périmètre** : écarter ce qui ne correspond pas aux postes visés ni à « Ce que je veux éviter » du profil.
> 2. **Éliminatoires** du profil (citer la phrase de l'offre). Expérience : plus de [experienceMaxAns de config.json] ans exigés = écarter, y compris formulé autrement (« solide expérience », « confirmé », poste clairement senior).
> 3. **Candidats** : sous [candidatsPalier], accepter les petits écarts ; au-dessus, ne garder que si le fit est vraiment bon.
> 4. **Une seule offre par entreprise.**
> 5. Classer (accessibilité, puis fit, puis nombre de candidats, puis fraîcheur) et garder **les 12 meilleures** (moins s'il n'y en a pas assez de bonnes, jamais pour remplir).
>
> Rapport, rien d'autre :
> - `RETENUES` : tableau `# | id | Entreprise | Poste | Lieu | Publiée | Candidats | Contenu du poste (3-6 mots) | Réserves (1 ligne)`.
> - `ÉCARTÉES` : tableau `Entreprise | Poste | Motif court`, groupé par motif.

Présenter à l'utilisateur :

```
LinkedIn, veille du [DATE] · fenêtre [x]
[N] collectées, [M] nouvelles, [K] passées au tri, [R] retenues · coût Apify ≈ [x] $

| # | Entreprise | Poste | Lieu | Candidats | Contenu du poste | Réserves |

Écartées au tri : [résumé par motif]

Tu valides ? (retire les numéros que tu ne veux pas, ou repêche une offre écartée)
```

**S'arrêter là et attendre la réponse.**

## Phases 3 et 4

Suivre `scripts/pipeline-commun.md` (source : LinkedIn). Le lien de candidature est la page LinkedIn de l'offre, sauf si `offre.md` donne un lien externe.
