# /jobteaser

> Veille JobTeaser : offres publiées **depuis le dernier run** (types de contrat et lieux de `config.jobteaser.requetes`),
> filtrées selon `config.json`, tri, validation par l'utilisateur, puis rédaction par lots de 5. Rien n'est envoyé.

## Vue d'ensemble

```
Phase 1  node scripts/jobteaser/pull.mjs  → offres depuis le dernier run, jamais vues, filtres de config.json
Phase 2  1 agent de tri (Sonnet)          → NO-GO éliminés, 1 par entreprise, 20 meilleures max
         présentation                     → STOP, validation de l'utilisateur
Phase 3  agents de rédaction par lots de 5
Phase 4  récap + nettoyage
```

Si `profil/profil.md` contient encore des `[crochets]` à remplir, s'arrêter et proposer `/setup`.

## Phase 1 : collecte

Vérifier le crédit Apify : `node scripts/credit.mjs`. Coût : environ 0,001 $ par offre renvoyée (un run quotidien coûte quelques centimes, un premier run sur 7 jours jusqu'à 0,50 $).

Puis lancer, en arrière-plan :

```
node scripts/jobteaser/pull.mjs
```

Le script interroge l'acteur Apify `shahidirfan/JobTeaser-Job-Scraper` (JobTeaser bloque les requêtes directes), une requête par type de contrat, lieu et langue (FR et EN). Fenêtre : depuis le dernier run, 7 jours au premier run. Il écarte les offres déjà vues ou déjà candidatées, les intitulés exclus ou hors périmètre, hors zone (sauf pour les requêtes marquées `"filtrerLieu": false`, ex. VIE et Graduate Programmes à l'étranger), et celles qui exigent plus de `experienceMaxAns` ans.

Sorties dans `scripts/jobteaser/out/<aujourd'hui>/` : `rapport.md`, `resume-tri.md`, `offres-md/<id>.md`.

Arguments : `--days=N`, `--max=N`, `--no-state`, `--reuse`, `--ignore-seen`.

- 0 offre sur toutes les requêtes : l'acteur est probablement bloqué. Le dire, proposer d'en chercher un autre, ne pas insister.
- Aucune offre retenue : le dire et s'arrêter.

**Ne pas lire `offres-md/` ni `resume-tri.md` dans la session principale.**

## Phase 2 : tri (POINT D'ARRÊT)

Un agent `general-purpose`, **`model: "sonnet"`**, au premier plan. Prompt :

> Tu tries les offres JobTeaser du run. Tu n'écris aucune candidature.
>
> Lis `profil/profil.md`, puis `scripts/jobteaser/out/[DATE]/resume-tri.md`. Étudie TOUTES les fiches. N'ouvre l'offre complète (`offres-md/<id>.md`) que pour trancher un doute.
>
> Pour chaque offre :
> 1. **Périmètre** : écarter ce qui ne correspond pas aux postes visés (ex. programme générique sans voie qui colle au profil).
> 2. **Éliminatoires** du profil (citer la phrase de l'offre), plus : droit de travail local exigé sans sponsor (UK, US, Singapour...), promotion de diplôme exigée qui exclut le candidat. Si l'offre est tronquée sur un point décisif (visa, langue), une recherche web rapide est permise.
> 3. **Une seule offre par entreprise** (même groupe, même marque).
> 4. Classer (accessibilité, puis fit, puis fraîcheur) et garder **les 20 meilleures au maximum**.
>
> Rapport, rien d'autre :
> - `RETENUES` : tableau `# | id | Type | Entreprise | Poste | Lieu | Publiée | Contenu du poste (3-6 mots) | Réserves (1 ligne)`.
> - `ÉCARTÉES` : tableau `Entreprise | Poste | Motif court`, groupé par motif.

Présenter à l'utilisateur :

```
JobTeaser, run du [DATE] · publiées depuis le [début]
[N] collectées, [M] nouvelles, [K] passées au tri, [R] retenues · coût Apify ≈ [x] $

| # | Type | Entreprise | Poste | Lieu | Contenu du poste | Réserves |

Écartées au tri : [résumé par motif]

Tu valides ? (retire les numéros que tu ne veux pas, ou repêche une offre écartée)
```

**S'arrêter là et attendre la réponse.**

## Phases 3 et 4

Suivre `scripts/pipeline-commun.md` (source : JobTeaser). Sur JobTeaser, la candidature simplifiée n'accepte souvent qu'un message de 1000 caractères sans lettre : le message de `ldm.md` sert alors seul.
