# Qu'est-ce que je cuisine avec mon colis ?

Application web installable (PWA) pour aider les étudiants à cuisiner avec ce qu'ils ont déjà : colis d'aide alimentaire, épicerie solidaire, restes du frigo.

On coche ce qu'on a, et l'appli classe les recettes en trois niveaux : faisables tout de suite, un seul ingrédient manquant, pour plus tard.

- Aucun serveur, aucun compte, aucune donnée envoyée : les cases cochées restent sur le téléphone.
- Marche hors connexion après la première ouverture.
- S'installe sur l'écran d'accueil (Android : « Installer l'application » ; iPhone : Partager › « Sur l'écran d'accueil »).

## Fichiers

| Fichier | Rôle |
|---|---|
| `recettes.json` | **Les ingrédients et les recettes.** C'est le seul fichier à modifier pour faire évoluer le contenu. |
| `index.html`, `style.css`, `app.js` | L'interface et la logique de correspondance. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Ce qui rend l'appli installable et utilisable hors connexion. |
| `verifier-recettes.js` | Vérifie `recettes.json` avant une mise en ligne. |

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
- Les identifiants (`pain`, `oeufs`…) doivent exister dans `groupes`.

Ensuite :

```bash
node verifier-recettes.js
```

Puis augmente `VERSION` dans `sw.js` (`v1` → `v2`) pour que les téléphones récupèrent la mise à jour.

## Tester en local

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. Ouvrir `index.html` directement ne marche pas : le navigateur bloque la lecture de `recettes.json`.

## Mettre en ligne

N'importe quel hébergement de fichiers statiques gratuit convient : GitHub Pages, Netlify, Cloudflare Pages. Le HTTPS est obligatoire pour l'installation et le mode hors connexion, et ces trois services le fournissent.

---
Projet étudiant de Kelyan Gavila, Université Toulouse Capitole.
