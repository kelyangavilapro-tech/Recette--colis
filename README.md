# Qu'est-ce que je cuisine avec mon colis ?

Application web installable (PWA) pour aider les étudiants à cuisiner avec ce qu'ils ont déjà : colis d'aide alimentaire, épicerie solidaire, restes du frigo.

**En ligne :** https://kelyangavilapro-tech.github.io/Recette--colis/
**Pour les associations :** https://kelyangavilapro-tech.github.io/Recette--colis/asso.html

## Ce que fait l'appli

**Interface (version 18)** : une appli mobile avec une barre d'onglets en bas, aux couleurs terracotta.
- **Accueil** : compteur de recettes possibles, catégories qui défilent (sans cuisson, micro-ondes, moins de 10 min, végé, sucré, petit budget…), « Recette du jour » en carrousel, puis des sélections en carrousels : « Ce soir avec ton colis », « À finir vite », « Il ne te manque qu'un ingrédient », « De saison » (partie `"saisons"` de `recettes.json`), « Moins de 1 € la portion ».
- **Recherche** : tuiles thématiques (« Étudiant fauché », « Végétarien »…), filtres rapides, filtres détaillés en accordéon avec « Valider » et « Réinitialiser ».
- **Mon frigo** (bouton rond au centre) : les ingrédients seulement, le scanner, « À finir vite », et une barre « N recettes possibles » toujours visible.
- **Carnet** : favoris, mes recettes et mes notes personnelles (clé `colis-notes`), liste de courses et menu de la semaine.
- **Profil** : équipement, régime, allergies, nombre de personnes, affichage, taille du texte, langue, aide.
- **Page recette en plein écran** : grande photo, ingrédients à cocher, nombre de personnes réglable, préparation, ma note, valeurs nutritionnelles. Le mode pas à pas montre une étape par écran : on glisse le doigt pour passer à la suivante.
- Les adresses des écrans sont partageables : `#recherche`, `#frigo`, `#recette/crepes`…

- **Pour les étudiants.** On coche ce qu'on a (avec une recherche rapide) ou on **scanne les codes-barres** de ses produits. On indique son équipement : plaque, micro-ondes, four, air fryer, bouilloire, mixeur, grille-pain, cuiseur à riz, autocuiseur, gaufrier, appareil à croque-monsieur. L'appli classe 51 recettes en trois niveaux : faisables tout de suite, un seul ingrédient manquant, pour plus tard.
- **Premier lancement guidé** : trois questions (équipement, régime, cocher / scanner / voir un exemple).
- **Portions** : pour 1, 2 ou 4 personnes ; les quantités des étapes s'ajustent, avec des repères sans balance (« ≈ un verre », « ≈ 2 grosses poignées »). Les recettes individuelles (mug cake, porridge…) portent `"portions": 1`, celles écrites par personne `"portions": "par personne"`.
- **Filtres et recherche** : 10 min ou moins, sans cuisson, micro-ondes, sucré (`"sucree": true`), riche en protéines ; recherche par nom ou ingrédient.
- **Coût estimé par portion**, d'après les prix moyens de la partie `"prix"` de `recettes.json` (euros par kg ou par litre).
- **Mode cuisine** : lecture des étapes à voix haute (voix du téléphone), puis « J'ai cuisiné ça ! » qui retire de « Ce que j'ai » les ingrédients finis et compte le repas.
- **Compteur** (menu › Mes repas) : repas cuisinés ce mois-ci et courses évitées, calculés sur le coût estimé.
- **Menu de la semaine** : 5 repas variés avec ce qu'on a, chaque jour peut être changé, et ce qui manque part dans la liste de courses.
- **Les bases de la cuisine** (menu) : 10 fiches courtes, comme cuire du riz, couper un oignon ou savoir si un œuf est frais. Elles sont dans la partie `"bases"` de `recettes.json`.
- **Photo de mon plat** : dans chaque recette, l'étudiant peut ajouter sa propre photo. Elle est réduite et gardée sur son téléphone (clé `colis-mes-photos`).
- **Partage par lien** : une recette créée par l'étudiant se partage avec un lien qui l'ajoute chez la personne qui l'ouvre (`?recette=`). La liste de courses se partage aussi entre colocataires (`?courses=`).
- **Petit budget** : un filtre pour les recettes à 0,50 € la portion ou moins, et le coût estimé du menu de la semaine.
- **Colocation** : portions pour 1, 2, 4 ou 6 personnes.
- **Taille du texte** (menu) : normal, grand ou très grand.
- **À finir vite** : on marque ce qui va bientôt périmer ; les recettes qui l'utilisent passent en premier.
- **Mes recettes** : chaque étudiant peut créer, modifier et supprimer ses propres recettes. Elles restent sur son téléphone (clé `colis-mes-recettes`) et profitent de tout le reste : portions, repères, mode cuisine, coût, valeurs nutritionnelles.
- **Régimes.** Végétarien, végan, halal / sans porc, sans lactose, sans gluten, et allergies : sans œufs, sans poisson, sans arachides, sans fruits à coque, sans soja. Ces filtres retirent les ingrédients concernés, mais on rappelle de toujours vérifier les étiquettes (traces possibles).
- **Dans chaque recette :** une illustration, les valeurs nutritionnelles estimées (calories, protéines, glucides, lipides), un mode cuisine (étapes en plein écran, écran maintenu allumé, minuteur), « Ajouter à ma liste » pour ce qui manque, le partage, les favoris et l'impression A4.
- **Menu latéral :** scanner, une idée au hasard, liste de courses, favoris, conseils de conservation, thème clair / sombre / automatique, régime, équipement, remise à zéro.
- **Pour les associations.** La page `asso.html` permet de cocher le contenu d'un colis. Elle donne un lien et un QR code qui pré-cochent ces produits chez l'étudiant, et une affiche A4. Une case « Proposer une recette » (en test) met une recette au bon format, à copier ou partager.
- **Vie privée.** Aucun compte, aucun cookie. Tout reste sur l'appareil. Pour le scan, seul le code-barres est envoyé à Open Food Facts.
- Marche hors connexion après la première ouverture (sauf le scan), s'installe sur l'écran d'accueil, et se met à jour toute seule.

## Fichiers

| Fichier | Rôle |
|---|---|
| `recettes.json` | **Tout le contenu** : ingrédients, régimes, recettes, valeurs nutritionnelles (pour 100 g et portion habituelle), conseils de conservation, correspondances codes-barres → ingrédients. |
| `config.js` | **Les réglages** : lien du questionnaire d'avis, code des statistiques. |
| `index.html`, `style.css`, `app.js` | L'appli. |
| `asso.html`, `asso.js` | La page associations. |
| `lib/` | Bibliothèques sous licence MIT : QR codes (`qrcode.js`) et lecture des codes-barres quand le téléphone n'a pas de lecteur intégré (`zxing.min.js`). |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation et mode hors connexion. |
| `verifier-recettes.js` | Vérifie `recettes.json`. |
| `nouvelle-version.js` | Augmente le numéro de version avant une mise en ligne. |

## Ajouter ou modifier une recette

Dans `recettes.json`, une recette ressemble à ceci :

```json
{ "title": "Pain perdu anti-gaspi", "color": "nuit", "time": 10, "equip": ["plaque"], "tool": "1 poêle",
  "need": [["pain"], ["oeufs"], ["lait"]],
  "extra": ["sucre", "fromage", "huile"],
  "steps": ["…", "…"],
  "swap": "Pas de lait : de l'eau marche aussi." }
```

- `need` : les ingrédients indispensables. Chaque ligne est satisfaite par **n'importe lequel** des ingrédients qu'elle contient : `["thon", "sardines"]` veut dire « thon ou sardines ».
- `extra` : les ingrédients facultatifs, affichés seulement si l'utilisateur les a.
- `equip` : `["plaque"]`, `["micro"]`, les deux, ou `[]` pour une recette sans cuisson.
- `color` : `tomate`, `herbe`, `curry` ou `nuit`.
- Dans `steps`, une durée écrite en toutes lettres (« 10 minutes », « 30 secondes ») fait apparaître le minuteur.
- `qte` (facultatif) : les grammes par portion quand ils diffèrent de la portion habituelle, pour les valeurs nutritionnelles. Exemple : `{"riz": 35, "lait": 250}`.
- Les régimes n'ont pas besoin d'étiquettes. L'appli retire les ingrédients exclus (par exemple thon et sardines pour « Végétarien ») et cache la recette s'il ne reste aucune alternative.

## Photos

Les photos des plats (`photos/recettes/`) et des ingrédients (`photos/ingredients/`) sont des photos libres de droits trouvées sur [Openverse](https://openverse.org) : CC0, domaine public, CC BY ou CC BY-SA. Elles sont recadrées, et chacune est créditée dans l'appli (bas de page › « Crédits photos »), avec l'auteur, la licence et un lien vers l'original.

Pour ajouter ou remplacer une photo, par exemple une vraie photo d'un plat cuisiné par un étudiant :
1. Mets l'image dans `photos/recettes/` (640 × 480 conseillé), nommée d'après le titre de la recette en minuscules, sans accents, avec des tirets : `puree-maison-a-la-fourchette.jpg`.
2. Déclare-la dans la partie `"photos"` de `recettes.json` : `"puree-maison-a-la-fourchette": {"src": "photos/recettes/puree-maison-a-la-fourchette.jpg", "credit": "Prénom Nom, avec son accord"}`.
3. Lance `node verifier-recettes.js` : il signale un nom ou un fichier incorrect, ou un crédit manquant.

Une recette ou un ingrédient sans photo garde son illustration.

## Langues

L'appli existe en français, en anglais et en espagnol. Elle choisit la langue du téléphone à la première ouverture : français, espagnol, ou anglais pour les autres langues. Les personnes qui l'utilisaient déjà restent en français. On change de langue dans Menu › « Langue · Language · Idioma ».

- `i18n-en.json`, `i18n-es.json` : les textes de l'interface. La clé est le texte français, la valeur sa traduction.
- `recettes.en.json`, `recettes.es.json` : les noms des ingrédients, les régimes, les recettes (titre, ustensile, étapes, astuce) et les conseils de conservation, rangés d'après leur nom français.
- `node verifier-recettes.js` signale toute recette, tout ingrédient ou tout texte d'interface sans traduction anglaise ou espagnole.

Dans les étapes traduites, écris les quantités comme en français (« 200 g », « 400 ml », « 2 eggs » / « 2 huevos », « 1 teaspoon » / « 1 cucharadita », « per person » / « por persona ») : l'appli les ajuste au nombre de personnes et ajoute les repères.

La page pour les associations suit la langue choisie dans l'appli. On peut aussi en changer en bas de cette page.

## Mettre en ligne une modification

```bash
node verifier-recettes.js
```

```bash
node nouvelle-version.js
```

Puis envoie les modifications sur la branche `main` : GitHub Pages publie tout seul en moins d'une minute, et les téléphones se mettent à jour à la prochaine ouverture.

## Activer les statistiques anonymes

1. Crée un compte gratuit sur https://www.goatcounter.com, par exemple avec le code `moncolis`.
2. Dans `config.js`, mets `goatcounter: "moncolis"`.
3. Mets en ligne. La mention dans « Confidentialité » s'affiche automatiquement.

Les statistiques comptent les visites, les recettes ouvertes en mode cuisine, les partages, les impressions, les favoris, les liens d'association utilisés et les clics sur « Donner mon avis ».

## Tester en local

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. Ouvrir `index.html` directement ne marche pas : le navigateur bloque la lecture de `recettes.json`.

---
Projet étudiant de Kelyan Gavila, Université Toulouse Capitole.
