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
data.recettes.forEach(r => {
  const t = r.title || "(recette sans titre)";
  ["title", "tool", "swap"].forEach(k => { if (!r[k]) errors.push(`${t} : champ "${k}" manquant`); });
  if (!COLORS.includes(r.color)) errors.push(`${t} : couleur "${r.color}" inconnue (${COLORS.join(", ")})`);
  if (!(r.time > 0)) errors.push(`${t} : temps invalide`);
  if (!Array.isArray(r.need) || !r.need.length) errors.push(`${t} : "need" vide`);
  (r.need || []).forEach(opts => opts.forEach(id => check(t + " / need", id)));
  (r.extra || []).forEach(id => check(t + " / extra", id));
  (r.equip || []).forEach(id => check(t + " / equip", id));
  if (!Array.isArray(r.steps) || !r.steps.length) errors.push(`${t} : aucune étape`);
});

if (errors.length) { console.error("❌ " + errors.length + " problème(s) :\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`✅ recettes.json est valide : ${data.recettes.length} recettes, ${ids.size} ingrédients.`);
