# Job Search Kit pour Claude Code

Trois commandes Claude Code qui font la veille des offres d'emploi sur **LinkedIn**, **Indeed** et **JobTeaser**, les trient selon ton profil, puis rédigent pour chaque offre retenue une **lettre de motivation**, un **message de candidature** et un **CV adapté**, en PDF.

Rien n'est envoyé automatiquement : tu relis et tu postules toi-même.

```
/linkedin   →  collecte  →  tri des 12 meilleures  →  tu valides  →  lettres + CV adaptés
```

## Ce qu'il te faut

| Outil | Pourquoi | Coût |
|---|---|---|
| [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) | fait tourner les commandes et rédige | abonnement Claude Pro ou Max |
| [Node.js](https://nodejs.org) 18 ou plus (version LTS) | lance les scripts de collecte | gratuit |
| Un compte [Apify](https://console.apify.com) | LinkedIn, Indeed et JobTeaser bloquent les robots : Apify fait la collecte | gratuit (5 $ de crédit par mois, ≈ 0,10 à 0,15 $ par run) |
| Chrome ou Edge | transforme le CV et la lettre en PDF | déjà sur ton PC |

Pas besoin de savoir coder, ni d'avoir un CV en LaTeX : ton CV actuel (PDF ou Word) suffit.

## Installation (10 minutes)

1. **Récupère le kit** : bouton vert `Code` > `Download ZIP` sur cette page, puis dézippe-le où tu veux. Ou, si tu as git : `git clone <url de ce dépôt>`.
2. **Installe Node.js** (version LTS) depuis https://nodejs.org.
3. **Installe Claude Code** en suivant https://docs.claude.com/en/docs/claude-code/overview, ou utilise l'extension VS Code.
4. **Crée ton compte Apify** sur https://console.apify.com, puis copie ton token dans *Settings > API & Integrations*.
5. Dans le dossier du kit, **copie `.env.example` en `.env`** et colle ton token après `APIFY_TOKEN=`.
6. **Dépose ton CV** (PDF ou Word) dans `profil/cv/`.
7. Ouvre le dossier dans Claude Code et lance **`/setup`**.

`/setup` vérifie l'installation, te pose des questions sur ta recherche (métier, ville, niveau, ce que tu veux éviter...), remplit ton profil, recrée ton CV dans un modèle HTML que tu peux styliser, et adapte les mots-clés de recherche à ton métier.

## Utilisation

| Commande | Ce qu'elle fait | Rythme conseillé |
|---|---|---|
| `/linkedin` | offres publiées depuis ton dernier run, les 12 meilleures | chaque jour |
| `/indeed` | offres des 7 derniers jours jamais vues, 12 à 20 | 2 à 3 fois par semaine |
| `/jobteaser` | offres depuis ton dernier run (CDI, Graduate Programmes, VIE), 20 max | 2 à 3 fois par semaine |

Chaque commande :
1. **collecte** les offres via Apify et applique tes filtres (`config.json`) : lieu, intitulés, expérience maximale, offres déjà vues ou déjà candidatées ;
2. **trie** le lot par comparaison avec ton profil (un agent dédié) et te présente un tableau ;
3. **s'arrête** : tu retires ou repêches des offres ;
4. **rédige** chaque candidature dans `candidatures/<date>/<entreprise>/` :
   - `Lettre de motivation.pdf` (et son texte dans `ldm.md`) ;
   - un message court (moins de 1000 caractères) pour les formulaires qui n'acceptent pas de lettre ;
   - ton CV en PDF, adapté à l'offre (accroche, ordre des puces, vocabulaire de l'offre) **sans jamais rien inventer** ;
   - `statut.md` avec le lien pour postuler et les points d'attention.

Une correction sur une lettre ou un CV ? Demande-la simplement à Claude, il modifie le fichier `.html` et régénère le PDF.

## Personnaliser

- **`profil/profil.md`** : qui tu es, ce que tu cherches, tes expériences et leurs chiffres. C'est la seule source des agents : ce qui n'y est pas n'existe pas pour eux.
- **`profil/consignes-ldm.md`** : le style des lettres (longueur, ton, formules interdites). Ajoute tes propres règles en bas.
- **`profil/cv-base.html`** : ton CV de base. L'apparence se règle dans le bloc `<style>` (couleur, police, marges).
- **`config.json`** : les critères de collecte.

### config.json

| Clé | Rôle |
|---|---|
| `experienceMaxAns` | offres exigeant plus d'années d'expérience écartées d'office |
| `filtreLieu.motsCles` / `filtreLieu.departements` | villes acceptées (un `*` final couvre toutes les fins de mot) et débuts de code postal. Les deux vides = pas de filtre |
| `intitulesExclus` | mots qui écartent une offre s'ils sont dans l'intitulé (senior, stage...) |
| `intitulesRequis` | l'intitulé doit contenir au moins un de ces mots (vide = pas de contrainte) |
| `contratsExclus` | contrats écartés (Indeed) |
| `linkedin.recherches` | mots-clés LinkedIn. `"max": 40` pour les prioritaires, `"sansExclusions": true` pour ignorer `intitulesExclus` |
| `linkedin.candidatsMax` / `candidatsPalier` | au-delà de `candidatsMax` candidats : écartée ; au-delà du palier : gardée seulement si le fit est très bon |
| `indeed.pays` / `lieu` / `recherches` | pays Indeed (`fr`, `be`, `ch`...), ville, mots-clés |
| `jobteaser.requetes` | types de contrat (`cdi`, `graduate_program`, `vie`), lieu facultatif, `"filtrerLieu": false` pour l'étranger |

Le `config.json` livré est un **exemple** (postes commerciaux juniors à Paris) : `/setup` le réécrit pour ta recherche.

## Coût et sécurité

- Les scripts s'arrêtent sur le crédit Apify gratuit : vérifie-le avec `node scripts/credit.mjs`.
- LinkedIn est interrogé en **recherche publique**, sans ton compte ni ton cookie : aucun risque pour ton profil LinkedIn.
- Ton token (`.env`), ton profil rempli, tes CV et tes candidatures restent sur ton ordinateur : ils sont exclus de git (`.gitignore`). Si tu forkes ce dépôt, ne commite pas `profil/profil.md` une fois rempli.

## Commandes utiles des scripts

```
node scripts/credit.mjs                          crédit Apify restant
node scripts/linkedin/pull.mjs --max=5 --no-state   petit test sans mémoriser
node scripts/indeed/pull.mjs --reuse             retraiter la collecte du jour sans repayer
node scripts/cv-pdf.mjs profil/cv-base.html apercu.pdf   régénérer un PDF
```
