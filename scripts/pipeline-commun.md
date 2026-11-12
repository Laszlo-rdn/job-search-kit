# Phases communes aux commandes /linkedin, /indeed et /jobteaser

Lu par la session principale après la validation de la liste par l'utilisateur.

## Phase 3 : agents de rédaction

### 3a. Même entreprise = même CV
Avant de lancer les agents, regarder dans `candidatures/` (toutes sources) si l'utilisateur a déjà candidaté chez l'entreprise. Si oui, imposer dans le prompt de l'agent le même CV que la fois précédente (seule la langue peut changer).

### 3b. Créer les dossiers
Pour chaque offre validée : `candidatures/<AUJOURD'HUI>/<Entreprise>-<Contrat>-<PosteCourt>-<Lieu>/` (ex. `Payplug-CDI-PartnerSuccessManager-Paris`). Date = date du jour, jamais la date de publication. Copier `scripts/<source>/out/<aujourd'hui>/offres-md/<id>.md` vers `offre.md` dans le dossier.

### 3c. Lots
`ceil(N / 5)` agents, offres réparties équitablement (13 offres : 5 / 4 / 4), regroupées par langue de lettre et par proximité de secteur.

### 3d. Lancer les agents en parallèle
Un agent `general-purpose` par lot, tous dans le même message, en arrière-plan. Modèle par défaut (qualité de rédaction). Prompt :

> Lis d'abord en entier `scripts/procedure-agent.md` et applique-le à ton lot. Date du jour : [DATE]. Source des offres : [LinkedIn / Indeed / JobTeaser].
>
> Ton lot (dossiers dans `candidatures/[DATE]/`) :
> 1. `[Dossier]` ([langue probable], [angle ou point d'attention en une ligne])
> 2. ...
>
> Les lettres du lot doivent avoir des accroches et des preuves principales différentes. Termine par le rapport compact demandé.

## Phase 4 : récap et nettoyage

1. Relevé de diversité à partir des rapports : signaler seulement les lettres réellement interchangeables.
2. Vérifier par un `grep` qu'aucune lettre ne contient de tiret long (`—`) ou demi-tiret (`–`).
3. Écrire `candidatures/<AUJOURD'HUI>/_<source>-run.md` : fenêtre, volumes (collectées, nouvelles, tri, retenues), tableau GO, écartées au tri, NO-GO tardifs, coût Apify.
4. Supprimer les dossiers des NO-GO tardifs. Un seul `ls` pour vérifier que chaque dossier GO contient ses deux PDF (lettre et CV) et seulement les fichiers attendus (`offre.md`, `ldm.md`, `ldm.html`, `cv.html`, `statut.md`, les PDF).
5. Présenter :

```
Run /[source] terminé, [DATE]

[N] candidatures rédigées · [x] agents · coût Apify ≈ [x] $

GO ([n]) :
| Entreprise | Poste | Lieu | Contenu du poste | CV | Réserves |
|---|---|---|---|---|---|

NO-GO tardifs ([n]) : [Entreprise] : [raison courte]

Dossiers : candidatures/[DATE]/
Pour chaque offre : relis la lettre et le CV (PDF du dossier), postule via le lien de statut.md. Si le formulaire n'accepte qu'un texte, colle le message de ldm.md.
Une correction ? Dis-la-moi, je modifie le .html et je régénère le PDF.
```

Rien n'est jamais envoyé automatiquement.
