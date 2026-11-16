#!/usr/bin/env node
/* Vérifie recettes.json avant une mise en ligne : node verifier-recettes.js */
const data = JSON.parse(require("fs").readFileSync(__dirname + "/recettes.json", "utf8"));
const ids = new Set();
const errors = [];
const COLORS = ["tomate", "herbe", "curry", "nuit"];

data.groupes.forEach(g => g.items.forEach(([id]) => {
  if (ids.has(id)) errors.push(`Ingrédient en double : "${id}"`);
  ids.add(id);
}));
const check = (where, id) => { if (!ids.has(id)) errors.push(`${where} : "${id}" n'existe pas dans les groupes`); };

(data.colisExemple || []).forEach(id => check("colisExemple", id));
const regimeIds = new Set();
(data.regimes || []).forEach(r => {
  if (!r.id || !r.nom) errors.push("Régime sans id ou sans nom");
  if (ids.has(r.id) || regimeIds.has(r.id)) errors.push(`Régime "${r.id}" : identifiant déjà utilisé`);
  regimeIds.add(r.id);
  (r.exclut || []).forEach(id => check(`Régime ${r.nom}`, id));
});
const titles = new Set();
data.recettes.forEach(r => {
  const t = r.title || "(recette sans titre)";
  if (titles.has(t)) errors.push(`${t} : titre en double`);
  titles.add(t);
  if (r.time > 35) errors.push(`${t} : plus de 35 minutes, trop long pour l'appli`);
  ["title", "tool", "swap"].forEach(k => { if (!r[k]) errors.push(`${t} : champ "${k}" manquant`); });
  if (!COLORS.includes(r.color)) errors.push(`${t} : couleur "${r.color}" inconnue (${COLORS.join(", ")})`);
  if (!(r.time > 0)) errors.push(`${t} : temps invalide`);
  if (!Array.isArray(r.need) || !r.need.length) errors.push(`${t} : "need" vide`);
  (r.need || []).forEach(opts => opts.forEach(id => check(t + " / need", id)));
  (r.extra || []).forEach(id => check(t + " / extra", id));
  (r.equip || []).forEach(id => check(t + " / equip", id));
  if (!Array.isArray(r.steps) || !r.steps.length) errors.push(`${t} : aucune étape`);
});

// Nutrition : chaque ingrédient doit avoir ses valeurs [kcal, protéines, glucides, lipides, portion]
const equipIds = new Set(data.groupes.filter(g => g.type === "equip").flatMap(g => g.items.map(([id]) => id)));
const ingredientIds = [...ids].filter(id => !equipIds.has(id));
if (data.nutrition) {
  ingredientIds.forEach(id => {
    const n = data.nutrition[id];
    if (!Array.isArray(n) || n.length !== 5 || n.some(x => typeof x !== "number")) errors.push(`Nutrition : valeurs manquantes ou invalides pour "${id}"`);
  });
}
data.recettes.forEach(r => Object.keys(r.qte || {}).forEach(id => check(`${r.title} / qte`, id)));
(data.conservation || []).forEach(c => {
  if (!c.titre || !c.texte) errors.push("Conseil de conservation sans titre ou sans texte");
  (c.ids || []).forEach(id => check(`Conservation « ${c.titre} »`, id));
});
(data.openFoodFacts || []).forEach(([id]) => check("openFoodFacts", id));

if (errors.length) { console.error("❌ " + errors.length + " problème(s) :\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`✅ recettes.json est valide : ${data.recettes.length} recettes, ${ids.size} ingrédients.`);
