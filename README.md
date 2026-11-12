# Job Search Kit pour Claude Code

Des commandes Claude Code qui font la veille des offres d'emploi sur **LinkedIn**, **Indeed**, **JobTeaser**, **Welcome to the Jungle** et **Civiweb** (VIE / VIA), les trient selon ton profil, puis rédigent pour chaque offre retenue une **lettre de motivation**, un **message de candidature** et un **CV adapté à l'offre**, en PDF.

Rien n'est envoyé automatiquement : tu relis et tu postules toi-même.

```
/linkedin  →  collecte des offres  →  tri des meilleures  →  tu valides  →  lettres + CV adaptés en PDF
```

Pas besoin de savoir coder, ni d'avoir un CV dans un format spécial : ton CV actuel en PDF ou Word suffit.

---

## Ce qu'il te faut

| Outil | Pourquoi | Coût |
|---|---|---|
| **Claude Code** | fait tourner les commandes, trie et rédige | inclus dans un abonnement Claude Pro ou Max |
| **Node.js** (version 18 ou plus) | lance les scripts de collecte | gratuit |
| **Un compte Apify** | LinkedIn, Indeed, JobTeaser et WTTJ bloquent les robots : Apify fait la collecte à ta place | gratuit : 5 $ de crédit offerts chaque mois, un run coûte 0,05 à 0,15 $ |
| **Chrome ou Edge** | transforme le CV et la lettre en PDF | déjà sur ton ordinateur |

Civiweb n'a pas besoin d'Apify : `/civiweb` fonctionne dès que Claude Code et Node sont installés.

---

## Installation pas à pas (15 minutes, une seule fois)

### 1. Récupérer le kit

Sur cette page GitHub : bouton vert **`Code`** > **`Download ZIP`**. Dézippe le dossier où tu veux, par exemple dans `Documents`.
(Si tu connais git : `git clone https://github.com/Laszlo-rdn/job-search-kit.git`.)

### 2. Installer Node.js

Télécharge la version **LTS** sur https://nodejs.org et installe-la avec les options par défaut.
Pour vérifier : ouvre un terminal (sous Windows : touche Windows, tape `PowerShell`, Entrée) et tape `node --version`. Un numéro comme `v22.x.x` doit s'afficher.

### 3. Installer Claude Code

Deux possibilités, au choix :
- **Application de bureau Claude** (le plus simple) : télécharge-la sur https://claude.ai/download, connecte-toi, puis ouvre l'onglet **Code** et choisis le dossier du kit.
- **Terminal** : suis https://docs.claude.com/en/docs/claude-code/overview, puis dans un terminal :
  ```
  cd "C:\chemin\vers\job-search-kit"
  claude
  ```
- Ou l'extension **Claude Code pour VS Code** : ouvre le dossier du kit dans VS Code, puis le panneau Claude.

Dans tous les cas, Claude Code doit être **ouvert dans le dossier du kit** : c'est ce qui lui fait trouver les commandes `/setup`, `/linkedin`, etc.

### 4. Créer ton compte Apify et lier ton token

1. Crée un compte gratuit sur https://console.apify.com (connexion Google possible). Aucune carte bancaire n'est demandée pour le plan gratuit.
2. Dans la console : **Settings** (en bas à gauche) > **API & Integrations** > copie ton **Personal API token** (il commence par `apify_api_`).
3. Dans le dossier du kit, fais une copie du fichier **`.env.example`** et renomme-la **`.env`** (juste `.env`, sans rien d'autre).
   - Sous Windows, si tu ne vois pas le fichier : dans l'explorateur, onglet **Affichage** > coche **Éléments masqués** et **Extensions de noms de fichiers**.
   - Ou laisse faire Claude : à l'étape 6, `/setup` peut créer le fichier pour toi, tu n'auras qu'à coller le token dedans.
4. Ouvre `.env` avec le Bloc-notes et remplace `apify_api_xxxxxxxxxxxxxxxx` par ton token. Enregistre.

Ton token reste sur ton ordinateur : `.env` n'est jamais envoyé sur GitHub. **Ne le colle pas dans la conversation avec Claude.**

Pas besoin d'« ajouter » ou de « louer » les scrapers sur Apify : les scripts les appellent directement avec ton token, et chaque offre collectée est décomptée de ton crédit gratuit.

### 5. Déposer ton CV

Mets ton CV actuel (**PDF ou Word**) dans le dossier **`profil/cv/`**. Si tu en as une version anglaise, mets-la aussi.

### 6. Lancer `/setup`

Dans Claude Code, tape **`/setup`** puis Entrée. Claude va :
1. vérifier que Node et Apify fonctionnent (il te dira quoi corriger sinon) ;
2. lire ton CV et te poser des questions sur ta recherche, par petits groupes : métier, postes visés, ville, niveau d'expérience, ce que tu veux éviter, tes résultats chiffrés... ;
3. remplir `profil/profil.md` avec tes réponses ;
4. **recréer ton CV dans un modèle HTML** (`profil/cv-base.html`), en générer un aperçu PDF et ajuster l'apparence avec toi (couleur, police, longueur) ;
5. réécrire les mots-clés de recherche de `config.json` pour **ton** métier et **ta** ville ;
6. faire un petit test de collecte.

Compte 15 à 20 minutes. C'est l'étape qui fait la qualité de tout le reste : plus ton profil est précis et chiffré, meilleures seront les lettres.

---

## Utilisation au quotidien

| Commande | Ce qu'elle fait | Rythme conseillé |
|---|---|---|
| `/linkedin` | offres publiées depuis ton dernier run, les 12 meilleures | chaque jour |
| `/indeed` | offres des 7 derniers jours jamais vues, 12 à 20 | 2 à 3 fois par semaine |
| `/jobteaser` | offres depuis ton dernier run (CDI, Graduate Programmes, VIE), 20 max | 2 à 3 fois par semaine |
| `/wttj` | offres Welcome to the Jungle des 7 derniers jours, 20 max | 2 à 3 fois par semaine |
| `/civiweb` | VIE / VIA publiés depuis ton dernier run (gratuit) | chaque jour si tu vises un VIE |

Chaque commande :
1. **collecte** les offres et applique tes filtres : lieu, intitulés, expérience maximale, offres déjà vues ou déjà candidatées ;
2. **trie** le lot en le comparant à ton profil et te présente un tableau ;
3. **s'arrête** : tu retires ou repêches des offres ;
4. **rédige** chaque candidature dans `candidatures/<date>/<entreprise>/` :
   - `Lettre de motivation.pdf` (et le texte dans `ldm.md`) ;
   - un **message court** (moins de 1000 caractères) pour les formulaires qui n'acceptent pas de lettre ;
   - **ton CV en PDF, adapté à l'offre** (accroche, ordre des puces, vocabulaire de l'offre) sans jamais rien inventer ni changer une date ;
   - `statut.md` avec le lien pour postuler et les points d'attention.

Une correction sur une lettre ou un CV ? Demande-la à Claude : il modifie le fichier `.html` et régénère le PDF.

---

## Personnaliser

| Fichier | Contenu |
|---|---|
| `profil/profil.md` | qui tu es, ce que tu cherches, tes expériences et leurs chiffres. **La seule source des agents** : ce qui n'y est pas n'existe pas pour eux |
| `profil/consignes-ldm.md` | le style des lettres (longueur, ton, formules interdites). Ajoute tes propres règles en bas |
| `profil/cv-base.html` | ton CV de base. L'apparence se règle dans le bloc `<style>` (ou demande à Claude) |
| `config.json` | les critères de collecte (détail ci-dessous) |

Relance `/setup` quand ta recherche change (nouvelle ville, nouveaux postes).

### config.json

Le fichier livré est un **exemple** (postes commerciaux juniors à Paris) : `/setup` le réécrit pour toi.

| Clé | Rôle |
|---|---|
| `experienceMaxAns` | offres exigeant plus d'années d'expérience écartées d'office |
| `salaireMinAnnuel` | salaire brut annuel minimum (0 = pas de filtre), appliqué quand le salaire est affiché |
| `filtreLieu.motsCles` / `departements` | villes acceptées (un `*` final couvre toutes les fins de mot) et débuts de code postal. Les deux vides = pas de filtre |
| `intitulesExclus` | mots qui écartent une offre s'ils sont dans l'intitulé (senior, stage...) |
| `intitulesRequis` | l'intitulé doit contenir au moins un de ces mots (vide = pas de contrainte) |
| `contratsExclus` | contrats écartés (Indeed) |
| `linkedin` | `lieu`, `recherches` (`"max": 40` pour les prioritaires, `"sansExclusions": true` pour ignorer `intitulesExclus`), `candidatsMax` / `candidatsPalier` |
| `indeed` | `pays` (`fr`, `be`, `ch`...), `lieu`, `jours`, `recherches` |
| `jobteaser` | `requetes` : `type` (`cdi`, `graduate_program`, `vie`), `lieu` facultatif, `"filtrerLieu": false` pour l'étranger |
| `wttj` | `latitude` / `longitude` du centre, `rayonKm`, `contrats` (`FULL_TIME` = CDI), `recherches` |
| `civiweb` | `types` (`VIE`, `VIA`), `pays` (vide = tous), `paysExclus`, `dureeMinMois` |

---

## En cas de problème

| Message | Solution |
|---|---|
| `Token Apify introuvable` | le fichier `.env` n'existe pas, s'appelle `.env.txt`, ou contient encore `xxx` (étape 4) |
| `Apify ... 402` | crédit du mois épuisé (`node scripts/credit.mjs`) : attends le renouvellement mensuel ou baisse `maxParRecherche` |
| `0 offres` partout sur une plateforme | le site a bloqué le scraper : demande à Claude de chercher un autre acteur Apify |
| `Chrome ou Edge introuvable` | indique à Claude le chemin de ton navigateur (variable `CHROME_PATH`) |
| `API Civiweb : 401` | la clé publique du site a changé : demande à Claude de la mettre à jour (procédure dans `scripts/civiweb/pull.mjs`) |
| `node` n'est pas reconnu | Node.js n'est pas installé, ou le terminal a été ouvert avant l'installation : ferme-le et rouvre-le |

---

## Confidentialité et sécurité

- LinkedIn est interrogé en **recherche publique**, sans ton compte ni ton cookie : aucun risque pour ton profil LinkedIn.
- Ton token (`.env`), tes CV, ton CV HTML et tes candidatures restent sur ton ordinateur : ils sont exclus de git (`.gitignore`).
- `profil/profil.md` est un fichier du dépôt : si tu forkes le kit sur ton propre GitHub, **ne pousse pas ta version remplie** (ou garde ton fork privé).

## Commandes utiles des scripts

```
node scripts/credit.mjs                                 crédit Apify restant
node scripts/linkedin/pull.mjs --max=5 --no-state       petit test sans mémoriser les offres
node scripts/indeed/pull.mjs --reuse                    retraiter la collecte du jour sans repayer
node scripts/civiweb/pull.mjs --days=3 --no-state       test Civiweb gratuit
node scripts/cv-pdf.mjs profil/cv-base.html apercu.pdf  régénérer un PDF
```
