# /setup

> Configuration du kit : vérifie l'installation, remplit le profil et adapte `config.json` à la recherche de l'utilisateur.
> À lancer une fois au début, puis quand la recherche change (nouveau lieu, nouveaux postes).

## Étape 1 : vérifier l'installation

1. `node --version` : il faut Node 18 ou plus. Sinon, donner le lien https://nodejs.org (version LTS) et s'arrêter.
2. Token Apify : vérifier que `.env` existe et contient `APIFY_TOKEN=` suivi d'un vrai token. Sinon, expliquer :
   - créer un compte gratuit sur https://console.apify.com (5 $ de crédit offerts chaque mois, largement suffisant) ;
   - copier le token dans Settings > API & Integrations ;
   - copier `.env.example` en `.env` et y coller le token.
   Si `.env` n'existe pas, le créer toi-même en copiant `.env.example`, puis demander à l'utilisateur d'ouvrir `.env` (Bloc-notes) et de coller son token à la place de `apify_api_xxxxxxxxxxxxxxxx`. **Ne jamais lui demander de coller le token dans la conversation**, ni l'afficher.
   S'il ne compte utiliser que `/civiweb`, Apify n'est pas nécessaire : passer à l'étape 2.
3. `node scripts/credit.mjs` : si ça affiche le crédit, Apify est prêt. (Apify sert à LinkedIn, Indeed, JobTeaser et WTTJ. `/civiweb` n'en a pas besoin.)

## Étape 2 : le profil

Le kit est livré avec un exemple (postes commerciaux juniors à Paris) : **tout doit être réécrit pour la recherche de l'utilisateur**, quel que soit son métier. Ne garder aucune hypothèse de l'exemple.

Si `profil/profil.md` contient encore des `[crochets]`, le remplir avec l'utilisateur :
- Demander d'abord son CV actuel (PDF ou Word) à déposer dans `profil/cv/`. Le lire et pré-remplir tout ce qui peut l'être (formation, expériences, outils, langues).
- Puis poser les questions qui manquent, **par petits groupes** (2-3 questions à la fois, pas un questionnaire de 20 lignes) : métier et postes visés, contrats, lieu, salaire minimum, niveau d'expérience visé, ce qu'il veut éviter, ce qui le motive, éliminatoires, faits chiffrés de chaque expérience, et la section « Mon CV » (longueur, adaptation à chaque offre ou seulement si utile, ce qui ne bouge jamais).
- Rien d'inventé : une info inconnue reste vide ou est demandée.

## Étape 3 : le CV et la lettre en HTML

1. Copier `profil/cv-modele.html` en `profil/cv-base.html` et y reporter **fidèlement** le contenu du CV actuel (mêmes sections, mêmes intitulés, mêmes dates, mêmes puces). Ajouter des `<section>` si son CV en a d'autres (projets, bénévolat, certifications...). S'il a une version anglaise, faire de même dans `profil/cv-base-en.html`.
2. Générer le PDF : `node scripts/cv-pdf.mjs profil/cv-base.html profil/cv/apercu-cv.pdf`, le lire, et demander à l'utilisateur de l'ouvrir. Ajuster le style (couleur `--accent`, police, marges `@page`, taille de police) jusqu'à ce qu'il en soit content et que la longueur corresponde. Le contenu ne doit pas changer à cette étape.
3. Dans `profil/ldm-modele.html`, remplacer `Prénom NOM`, le téléphone et l'email par les siens.

Si Chrome ou Edge est introuvable, le script le dit : demander à l'utilisateur le chemin de son navigateur et l'indiquer dans `CHROME_PATH`.

Proposer ensuite de relire `profil/consignes-ldm.md` et d'ajouter ses règles personnelles en bas (formulations qu'il n'aime pas, expériences à ne jamais citer...).

## Étape 4 : config.json

Réécrire `config.json` pour SA recherche (mots-clés de son métier, sa ville, son niveau), en expliquant chaque changement en une ligne :
- `experienceMaxAns` : nombre d'années d'expérience au-delà duquel une offre est écartée d'office.
- `filtreLieu.motsCles` (villes acceptées, `*` final = toutes les fins de mot) et `filtreLieu.departements` (débuts de code postal). Les deux vides = pas de filtre de lieu.
- `intitulesExclus` : mots qui écartent une offre s'ils sont dans l'intitulé (séniorité, stage...).
- `intitulesRequis` : l'intitulé doit contenir au moins un de ces mots (vide = pas de contrainte). Indispensable pour JobTeaser, qui ramène tous les CDI d'une ville.
- `contratsExclus` (Indeed).
- `linkedin.lieu`, `linkedin.recherches` (mots-clés ; `"max": 40` pour les recherches prioritaires ; `"sansExclusions": true` pour ne pas appliquer `intitulesExclus` à une recherche, ex. Graduate Program).
- `indeed.pays` (`fr`, `be`, `ch`...), `indeed.lieu`, `indeed.recherches`.
- `jobteaser.requetes` : `type` parmi `cdi`, `graduate_program`, `vie` (d'autres types JobTeaser peuvent exister : tester), `lieu` facultatif, `"filtrerLieu": false` pour les offres à l'étranger.
- `salaireMinAnnuel` : salaire annuel brut minimum (0 = pas de filtre). Appliqué seulement quand le salaire est affiché de façon structurée (WTTJ) ; ailleurs, c'est l'agent de tri qui juge.
- `wttj` : `latitude` / `longitude` du centre de recherche (trouver les coordonnées de sa ville), `rayonKm`, `contrats` (`FULL_TIME` = CDI ; vide = tous), `recherches`.
- `civiweb` : `types` (`VIE`, `VIA`), `pays` (vide = tous), `paysExclus`, `dureeMinMois`. Seulement si l'utilisateur vise un VIE ; sinon, lui dire qu'il peut ignorer `/civiweb`.

Demander quelles plateformes il compte utiliser, et ne régler que celles-là.

Garder 8 à 15 recherches par plateforme : chaque recherche coûte un peu de crédit Apify.

## Étape 5 : test

Proposer un premier run réduit pour vérifier que tout marche sans dépenser : `node scripts/linkedin/pull.mjs --max=5 --no-state`. Lire le JSON affiché, puis expliquer les commandes `/linkedin`, `/indeed`, `/jobteaser` et le rythme conseillé (LinkedIn chaque jour, Indeed et JobTeaser 2 à 3 fois par semaine).
