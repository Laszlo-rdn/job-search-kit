# /wttj

> Veille Welcome to the Jungle : offres publiées depuis `config.wttj.jours` jours (7 par défaut) dans un rayon autour
> du point de `config.wttj`, filtrées selon `config.json`, tri, validation par l'utilisateur, puis rédaction par lots de 5.
> Rien n'est envoyé.

## Vue d'ensemble

```
Phase 1  node scripts/wttj/pull.mjs       → fenêtre de N jours, jamais vues, filtres de config.json
Phase 2  1 agent de tri (Sonnet)          → comparaison de TOUT le lot, 1 par entreprise, 20 meilleures max
         présentation                     → STOP, validation de l'utilisateur
Phase 3  agents de rédaction par lots de 5
Phase 4  récap + nettoyage
```

Si `profil/profil.md` contient encore des `[crochets]` à remplir, s'arrêter et proposer `/setup`.

## Phase 1 : collecte

Vérifier le crédit Apify : `node scripts/credit.mjs`. Coût : environ 0,0008 $ par offre, ≈ 0,10 $ pour 5 recherches de 25 offres (plafonné par recherche).

Puis lancer, en arrière-plan :

```
node scripts/wttj/pull.mjs
```

Le script interroge l'acteur Apify `bebity/welcome-to-the-jungle-jobs-scraper` pour chaque mot-clé de `config.wttj.recherches` (rayon `rayonKm` autour de `latitude` / `longitude`, contrats `contrats`, triées par date, détails inclus). Il écarte les offres déjà vues ou déjà candidatées, les intitulés exclus ou hors périmètre, hors zone, plus de `experienceMaxAns` ans exigés (le chiffre écrit dans l'offre prime sur le champ WTTJ, peu fiable) et un salaire maximum affiché sous `salaireMinAnnuel`.

Sorties dans `scripts/wttj/out/<aujourd'hui>/` : `rapport.md`, `resume-tri.md`, `offres-md/<id>.md`.

Arguments : `--days=N`, `--max=N`, `--no-state`, `--reuse`, `--ignore-seen`.

- 0 offre sur toutes les recherches : l'acteur est probablement cassé. Le dire, proposer d'en chercher un autre sur Apify, ne pas insister.
- Aucune offre retenue : le dire et s'arrêter.

**Ne pas lire `offres-md/` ni `resume-tri.md` dans la session principale.**

## Phase 2 : tri (POINT D'ARRÊT)

Un agent `general-purpose`, **`model: "sonnet"`**, au premier plan. Prompt :

> Tu tries les offres Welcome to the Jungle du run. Tu n'écris aucune candidature.
>
> Lis `profil/profil.md`, puis `scripts/wttj/out/[DATE]/resume-tri.md`. Étudie TOUTES les fiches. N'ouvre l'offre complète (`offres-md/<id>.md`) que pour trancher un doute.
>
> Pour chaque offre :
> 1. **Périmètre** : écarter ce qui ne correspond pas aux postes visés ni à « Ce que je veux éviter » du profil.
> 2. **Éliminatoires** du profil (citer la phrase de l'offre), plus : statut non salarié (agent commercial, freelance) présenté comme un CDI.
> 3. **Ne pas éliminer** pour une « expérience significative » sans chiffre ou une compétence absente du profil : c'est une réserve.
> 4. **Une seule offre par entreprise.**
> 5. Classer (accessibilité, puis fit, puis fraîcheur) et garder **les 20 meilleures au maximum**.
>
> Rapport, rien d'autre :
> - `RETENUES` : tableau `# | id | Entreprise | Poste | Lieu | Publiée | Salaire | Contenu du poste (3-6 mots) | Réserves (1 ligne)`.
> - `ÉCARTÉES` : tableau `Entreprise | Poste | Motif court`, groupé par motif.

Présenter à l'utilisateur :

```
WTTJ, run du [DATE] · publiées depuis le [début]
[N] collectées, [M] nouvelles, [K] passées au tri, [R] retenues · coût Apify ≈ [x] $

| # | Entreprise | Poste | Lieu | Salaire | Contenu du poste | Réserves |

Écartées au tri : [résumé par motif]

Tu valides ? (retire les numéros que tu ne veux pas, ou repêche une offre écartée)
```

**S'arrêter là et attendre la réponse.**

## Phases 3 et 4

Suivre `scripts/pipeline-commun.md` (source : WTTJ). La candidature intégrée de WTTJ propose un champ message : le message de `ldm.md` y va. Le lien de candidature est celui de `offre.md`.
