# Procédure de l'agent de rédaction (lot de 5 offres maximum)

Tu rédiges les candidatures d'un LOT d'offres déjà triées et jugées éligibles, l'une après l'autre. Travail 100 % local, rien n'est envoyé. Les chemins sont relatifs à la racine du kit.

## Économie de tokens
- Lis le contexte **une seule fois** pour tout le lot, et **uniquement** les fichiers de l'étape 0.
- Ne relis pas un fichier que tu viens d'écrire.

## Étape 0 : contexte (une fois)
- `profil/profil.md` : le profil du candidat. **Tout ce qui n'y figure pas n'existe pas.** N'invente jamais une expérience, un chiffre, un client ou une compétence.
- `profil/consignes-ldm.md` : règles de rédaction, à respecter intégralement.
- `profil/cv-base.html` : seulement au moment de l'étape C, et seulement la version dont tu pars.

## Pour chaque offre du lot
Le dossier existe déjà avec `offre.md`. Lis-le en entier.

### A. Contrôle d'éligibilité rapide
Le tri a déjà été fait. Ne passe en NO-GO que si tu trouves un éliminatoire manifestement raté (voir « Éliminatoires » dans `profil/profil.md`). Dans ce cas : `statut.md` avec verdict NO-GO, citation de l'offre, règle appliquée, puis offre suivante. Les manques non éliminatoires = réserves, notées dans `statut.md`.

### B. Lettre de motivation (`ldm.md`)
Toutes les règles de `profil/consignes-ldm.md`. Contenu propre à CETTE offre : 2-3 attentes qui comptent vraiment, preuves du profil qui y répondent. Les lettres d'un même lot doivent avoir des accroches et des preuves principales différentes.
Langue : français par défaut ; anglais intégral si l'offre est en anglais ou si la langue de travail est l'anglais.

Structure de `ldm.md` :

```
# LDM : [Entreprise], [Poste]

Langue : FR/EN · Mots : N · CV à joindre : [fichier]

---

[Objet : Candidature au poste de [Poste] chez [Entreprise]]

[Corps de la lettre, salutation et signature comprises]

---

## Message de candidature (formulaire, < 1000 caractères)

[message, voir B2]

Caractères : N (espaces compris)
```

### B2. Message de candidature (toutes les offres)
Beaucoup de formulaires (candidature simplifiée LinkedIn, JobTeaser, Indeed) n'offrent qu'un champ texte limité à environ 1000 caractères. Chaque offre reçoit donc ce message **en plus** de la lettre.
- Ouverture : « Bonjour Madame/Monsieur [Nom], » si l'offre donne le nom du recruteur, sinon « Bonjour, ».
- Paragraphe 1 (2 phrases) : un point précis de l'offre ou de l'entreprise, puis pourquoi il motive le candidat. Faux si on le colle sur une autre offre.
- Paragraphe 2 (facultatif, 1-2 phrases) : une expérience du profil qui PROLONGE ce point, lien rendu explicite. Si rien ne s'y relie naturellement, ne pas en plaquer une.
- Dernière phrase : invitation à échanger.
- Signature : formule courte + nom du candidat.
- **Ce n'est pas un résumé de la lettre.** Un seul fil du début à la fin. 400 à 700 caractères visés, 1000 maximum (compte avec un script si besoin).

### B3. Lettre en PDF
Copie `profil/ldm-modele.html` en `ldm.html` dans le dossier. Remplace `%%DATE%%` (date du jour en toutes lettres), `%%ENTREPRISE%%`, `%%LIEU%%`, `%%OBJET%%` et `%%CORPS%%` (salutation, paragraphes et signature, un `<p>` par paragraphe ; échappe `&` en `&amp;`, `<` en `&lt;`). En anglais, remplace aussi `Objet :` par `Subject:` et `lang="fr"` par `lang="en"`. Puis :
`node scripts/cv-pdf.mjs "<dossier>/ldm.html" "<dossier>/Lettre de motivation.pdf"` (1 page attendue, sinon raccourcis la lettre).

### C. CV
Pars de `profil/cv-base.html` (ou `profil/cv-base-en.html` pour une offre en anglais s'il existe ; s'il n'existe pas et que l'offre est en anglais, traduis le CV de base). Suis la règle « Adaptation à chaque offre » de la section « Mon CV » du profil :
- **pas d'adaptation utile** : copie le CV de base tel quel en `cv.html` dans le dossier ;
- **adaptation** : copie-le en `cv.html` puis adapte **uniquement** :
  - l'accroche et le titre visé, alignés sur l'intitulé et les 2-3 attentes clés de l'offre ;
  - les puces : reformuler pour reprendre le vocabulaire de l'offre (utile pour les logiciels de tri ATS), mettre en premier les puces qui répondent à l'offre, retirer celles qui n'apportent rien ;
  - les compétences : mettre en avant celles que l'offre demande **et** que le profil possède.
- **Interdit** : inventer quoi que ce soit, changer une date, un intitulé de poste réel, un diplôme, un chiffre, l'ordre chronologique, ou toucher au bloc `<style>`. Tout ce qui apparaît sur le CV doit exister dans `profil/profil.md` ou dans le CV de base.

Puis `node scripts/cv-pdf.mjs "<dossier>/cv.html" "<dossier>/<nom du PDF indiqué dans le profil>"`. Vérifie le nombre de pages affiché : s'il dépasse la longueur du profil, retire d'abord des compétences secondaires et des puces faibles, jamais des expériences entières.

### D. `statut.md`
Date, verdict GO, lien de candidature (ligne « Lien de candidature » de `offre.md`), CV (de base ou adapté, et ce qui a changé en une ligne), langue de la lettre, nombre de mots, caractères du message, réserves, « En attente de validation ».

Le dossier GO ne garde QUE : `offre.md`, `ldm.md`, `ldm.html`, `Lettre de motivation.pdf`, `cv.html`, le CV en PDF et `statut.md`.

## Fichiers de travail
D'autres agents tournent en parallèle : aucun fichier temporaire hors de ton dossier de candidature.

## Rapport final (compact, une ligne par offre, rien d'autre)
`[Dossier] | GO/NO-GO | contenu du poste en 3-6 mots | angle (accroche + preuves) ou raison du NO-GO | LDM FR/EN N mots | message N car. | CV de base/adapté (N pages) | PDF OK/KO | alerte`
