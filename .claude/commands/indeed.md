# /indeed

> Veille Indeed : offres publiées depuis `config.indeed.jours` jours (7 par défaut), jamais vues à un run précédent,
> filtrées selon `config.json`, tri comparatif, validation par l'utilisateur, puis rédaction par lots de 5. Rien n'est envoyé.

## Vue d'ensemble

```
Phase 1  node scripts/indeed/pull.mjs     → fenêtre de N jours, jamais vues, filtres de config.json
Phase 2  1 agent de tri (Sonnet)          → comparaison de TOUT le lot, 1 par entreprise, 12 à 20 meilleures
         présentation                     → STOP, validation de l'utilisateur
Phase 3  agents de rédaction par lots de 5
Phase 4  récap + nettoyage
```

Si `profil/profil.md` contient encore des `[crochets]` à remplir, s'arrêter et proposer `/setup`.

## Phase 1 : collecte

Vérifier le crédit Apify : `node scripts/credit.mjs`. Un run coûte environ 0,10 $ (≈ 1 000 offres). S'il reste moins de 0,15 $, le dire et proposer `--max=50`.

Puis lancer, **en arrière-plan** (une requête après l'autre, plusieurs minutes) :

```
node scripts/indeed/pull.mjs
```

Le script interroge l'acteur Apify `valig/indeed-jobs-scraper` (Indeed bloque les requêtes directes) pour chaque mot-clé de `config.indeed.recherches`. Il écarte : offres déjà vues ou déjà candidatées, contrats de `contratsExclus`, intitulés exclus ou hors périmètre, hors zone, plus de `experienceMaxAns` ans exigés. Il signale sans écarter : contrat non précisé, cabinet de recrutement, signal junior, entreprise déjà candidatée.

Sorties dans `scripts/indeed/out/<aujourd'hui>/` : `rapport.md`, `resume-tri.md`, `offres-md/<id>.md`.

Arguments : `--days=N` (1, 3, 7 ou 14), `--max=N`, `--no-state`, `--reuse`, `--ignore-seen`.

Aucune offre retenue : le dire et s'arrêter. **Ne pas lire `offres-md/` ni `resume-tri.md` dans la session principale.**

## Phase 2 : tri comparatif (POINT D'ARRÊT)

Un agent `general-purpose`, **`model: "sonnet"`**, au premier plan. Prompt :

> Tu tries les offres Indeed du run. Tu n'écris aucune candidature.
>
> Lis `profil/profil.md`, puis `scripts/indeed/out/[DATE]/resume-tri.md`. Étudie TOUTES les fiches avant de choisir. N'ouvre l'offre complète (`offres-md/<id>.md`) que pour trancher un doute (une trentaine d'ouvertures au plus).
>
> Pour chaque offre :
> 1. **Périmètre** : écarter le bruit fréquent sur Indeed (poste en réalité hors cible, terrain porte-à-porte, téléconseil, cabinet qui publie pour un client anonyme sans information utile) et ce que le profil veut éviter.
> 2. **Éliminatoires** du profil (citer la phrase de l'offre). Plus de [experienceMaxAns] ans exigés = écarter, y compris formulé autrement.
> 3. **Une seule offre par entreprise.**
> 4. Classer (accessibilité, puis fit, puis fraîcheur). Garder **environ 12 offres, jusqu'à 20** si elles sont vraiment pertinentes (jamais pour remplir).
>
> Rapport, rien d'autre :
> - `RETENUES` : tableau `# | id | Entreprise | Poste | Lieu | Publiée | Contenu du poste (3-6 mots) | Réserves (1 ligne)`.
> - `ÉCARTÉES` : tableau `Entreprise | Poste | Motif court`, groupé par motif.

Présenter à l'utilisateur :

```
Indeed, run du [DATE] · publiées depuis le [DATE - N j]
[N] collectées, [M] nouvelles, [K] passées au tri, [R] retenues · coût Apify ≈ [x] $

| # | Entreprise | Poste | Lieu | Contenu du poste | Réserves |

Écartées au tri : [résumé par motif]

Lesquelles je traite ? (retire les numéros que tu ne veux pas, ou repêche une offre écartée)
```

**S'arrêter là et attendre la réponse.**

## Phases 3 et 4

Suivre `scripts/pipeline-commun.md` (source : Indeed). Le lien de candidature est la ligne « Lien de candidature » de `offre.md`.
