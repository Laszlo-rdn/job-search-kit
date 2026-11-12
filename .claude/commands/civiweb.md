# /civiweb

> Veille des offres VIE / VIA de Civiweb (mon-vie-via.businessfrance.fr) publiées depuis le dernier run.
> API publique et gratuite, sans Apify. Filtres de `config.json`, tri, validation par l'utilisateur, puis rédaction par lots de 5.
> Rien n'est envoyé.

## Vue d'ensemble

```
Phase 1  node scripts/civiweb/pull.mjs    → offres diffusées depuis le jour du dernier run, jamais vues, filtres
Phase 2  1 agent de tri (Sonnet)          → NO-GO éliminés, 1 par entreprise, 20 meilleures max
         présentation                     → STOP, validation de l'utilisateur
Phase 3  agents de rédaction par lots de 5
Phase 4  récap + nettoyage
```

Si `profil/profil.md` contient encore des `[crochets]` à remplir, s'arrêter et proposer `/setup`.

## Phase 1 : collecte

```
node scripts/civiweb/pull.mjs
```

Gratuit, environ 30 secondes. Le script récupère toutes les offres de l'API Civiweb, garde celles diffusées depuis le jour du dernier run (7 jours au premier run), écarte les références déjà vues ou déjà candidatées, puis applique : `config.civiweb` (types VIE / VIA, pays acceptés ou exclus, durée minimale), `intitulesExclus`, `intitulesRequis` et `experienceMaxAns`. Pas de filtre de ville : les missions sont à l'étranger.

Sorties dans `scripts/civiweb/out/<aujourd'hui>/` : `rapport.md`, `resume-tri.md`, `offres-md/<référence>.md`.

Arguments : `--days=N` (force une fenêtre, ne met pas à jour l'état), `--no-state`, `--ignore-seen`.

- Erreur 401 : la clé publique du site a changé. Ouvrir le code source de https://mon-vie-via.businessfrance.fr/offres, chercher `API_KEY:"..."`, remplacer la constante `API_KEY` dans `scripts/civiweb/pull.mjs`, relancer.
- Aucune offre nouvelle : le dire et s'arrêter.

Les intitulés VIE sont souvent atypiques : jeter un œil à la section « Écartées par le script » de `rapport.md` (motif « intitulé hors périmètre ») et signaler les 2-3 offres qui semblent quand même coller au profil.

**Ne pas lire `offres-md/` ni `resume-tri.md` dans la session principale.**

## Phase 2 : tri (POINT D'ARRÊT)

Un agent `general-purpose`, **`model: "sonnet"`**, au premier plan. Prompt :

> Tu tries les offres VIE / VIA Civiweb du run. Tu n'écris aucune candidature.
>
> Lis `profil/profil.md`, puis `scripts/civiweb/out/[DATE]/resume-tri.md`. Étudie TOUTES les fiches. N'ouvre l'offre complète (`offres-md/<référence>.md`) que pour trancher un doute.
>
> Pour chaque offre :
> 1. **Périmètre** : écarter ce qui ne correspond pas aux postes visés.
> 2. **Éliminatoires** du profil (citer la phrase de l'offre), surtout la **langue de travail exigée** (fréquente en VIE : allemand, néerlandais, espagnol courant...) et le diplôme d'une autre filière strictement exigé. Rappel VIE : il faut avoir moins de 29 ans au départ et la nationalité d'un pays de l'Espace économique européen ; si le profil indique le contraire, tout est NO-GO.
> 3. **Une seule offre par entreprise.**
> 4. Classer (accessibilité, puis fit, puis préférences de pays du profil, puis fraîcheur) et garder **les 20 meilleures au maximum**.
>
> Rapport, rien d'autre :
> - `RETENUES` : tableau `# | référence | Entreprise | Poste | Lieu | Durée | Indemnité | Contenu du poste (3-6 mots) | Réserves (1 ligne)`.
> - `ÉCARTÉES` : tableau `Entreprise | Poste | Motif court (citation si éliminatoire)`, groupé par motif.

Présenter à l'utilisateur :

```
Civiweb, run du [DATE] · diffusées depuis le [début]
[N] nouvelles, [K] passées au tri, [R] retenues

| # | Réf | Entreprise | Poste | Lieu | Durée | Indemnité | Contenu du poste | Réserves |

Écartées au tri : [une ligne par NO-GO avec le motif]

Tu valides ? (retire les numéros que tu ne veux pas, ou repêche une offre écartée)
```

**S'arrêter là et attendre la réponse.**

## Phases 3 et 4

Suivre `scripts/pipeline-commun.md` (source : Civiweb), avec ces précisions à ajouter au prompt des agents :

> Offres VIE / VIA Civiweb. La candidature se fait sur la plateforme (CV + lettre + champ « message personnalisé »), sauf lien externe indiqué dans `offre.md`. Le message de l'étape B2 s'intitule « Message personnalisé (champ Civiweb) » et commence par « Bonjour Madame/Monsieur [Nom], » avec le nom de la ligne Contact de `offre.md`. Si `profil/profil.md` donne un numéro d'identifiant VIE, ajoute-le dans `ldm.html` sous l'email de l'en-tête (`<br>Numéro d'identifiant VIE : ...`). Le lieu de la lettre est la ville et le pays de la mission.

Conseil à donner dans le récap : relancer par email le contact de l'offre (ligne Contact de `offre.md`) 4 à 5 jours ouvrés après la candidature, si la plateforme ne donne pas de nouvelles.
