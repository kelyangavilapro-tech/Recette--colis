# Qu'est-ce que je cuisine avec mon colis ?

Application web installable (PWA) pour aider les étudiants à cuisiner avec ce qu'ils ont déjà : colis d'aide alimentaire, épicerie solidaire, restes du frigo.

**En ligne :** https://kelyangavilapro-tech.github.io/Recette--colis/
**Pour les associations :** https://kelyangavilapro-tech.github.io/Recette--colis/asso.html

## Ce que fait l'appli

- **Pour les étudiants.** On coche ce qu'on a (avec une recherche rapide) et son équipement : plaque, micro-ondes ou rien. L'appli classe 26 recettes en trois niveaux : faisables tout de suite, un seul ingrédient manquant, pour plus tard.
- **Régimes.** Végétarien, sans lactose, sans gluten. Aucune recette ne contient de viande, donc toutes sont compatibles halal.
- **Dans chaque recette :** un mode cuisine (étapes une par une en plein écran, écran maintenu allumé, minuteur quand une étape indique une durée), le partage (WhatsApp, SMS…), les favoris et l'impression sur une page A4.
- **Pour les associations.** La page `asso.html` permet de cocher le contenu d'un colis. Elle donne un lien et un QR code qui pré-cochent ces produits chez l'étudiant, et une affiche A4 à imprimer.
- **Vie privée.** Aucun compte, aucun cookie. Les cases cochées et les favoris restent sur l'appareil.
- Marche hors connexion après la première ouverture, s'installe sur l'écran d'accueil, et se met à jour toute seule.

## Fichiers

| Fichier | Rôle |
|---|---|
| `recettes.json` | **Les ingrédients, les régimes et les recettes.** C'est là qu'on fait évoluer le contenu. |
| `config.js` | **Les réglages** : lien du questionnaire d'avis, code des statistiques. |
| `index.html`, `style.css`, `app.js` | L'appli. |
| `asso.html`, `asso.js`, `lib/qrcode.js` | La page associations et le générateur de QR code (bibliothèque sous licence MIT). |
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
