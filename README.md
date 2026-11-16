# Qu'est-ce que je cuisine avec mon colis ?

Application web installable (PWA) pour aider les étudiants à cuisiner avec ce qu'ils ont déjà : colis d'aide alimentaire, épicerie solidaire, restes du frigo.

**En ligne :** https://kelyangavilapro-tech.github.io/Recette--colis/
**Pour les associations :** https://kelyangavilapro-tech.github.io/Recette--colis/asso.html

## Ce que fait l'appli

- **Pour les étudiants.** On coche ce qu'on a (avec une recherche rapide) ou on **scanne les codes-barres** de ses produits. On indique son équipement : plaque, micro-ondes, four, air fryer, bouilloire. L'appli classe 37 recettes en trois niveaux : faisables tout de suite, un seul ingrédient manquant, pour plus tard.
- **Régimes.** Végétarien, halal / sans porc, sans lactose, sans gluten.
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
