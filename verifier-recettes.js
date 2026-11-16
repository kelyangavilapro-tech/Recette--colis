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

// Prix (facultatifs) : un nombre positif ou nul par ingrédient
if (data.prix) ingredientIds.forEach(id => { if (typeof data.prix[id] !== "number" || data.prix[id] < 0) errors.push(`Prix manquant ou invalide pour "${id}"`); });
data.recettes.forEach(r => { if (r.portions != null && r.portions !== 1 && r.portions !== 2 && r.portions !== "par personne") errors.push(`${r.title} : "portions" doit valoir 1, 2 ou "par personne"`); });

// Photos (facultatives) : le fichier doit exister, correspondre à une recette ou un ingrédient, et avoir un crédit
const norm = t => String(t).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slug = t => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const recipeSlugs = new Set(data.recettes.map(r => slug(r.title)));
const photos = data.photos || {};
for (const [kind, keys] of [["recettes", recipeSlugs], ["ingredients", ids]]) {
  Object.entries(photos[kind] || {}).forEach(([key, ph]) => {
    if (!keys.has(key)) errors.push(`Photo ${kind} « ${key} » : aucune ${kind === "recettes" ? "recette" : "ingrédient"} ne porte ce nom${kind === "recettes" ? " (le nom attendu est le titre en minuscules, sans accents, avec des tirets)" : ""}`);
    if (!ph || !/^photos\/[a-z0-9/_-]+\.(jpe?g|webp|png)$/.test(ph.src || "")) errors.push(`Photo ${kind} « ${key} » : chemin invalide (attendu : photos/…/nom.jpg)`);
    else if (!require("fs").existsSync(__dirname + "/" + ph.src)) errors.push(`Photo ${kind} « ${key} » : fichier introuvable (${ph.src})`);
    if (!ph || !ph.credit) errors.push(`Photo ${kind} « ${key} » : crédit manquant (auteur et licence)`);
  });
}

// Traductions (facultatives mais conseillées) : chaque recette, ingrédient, conseil et texte d'interface doit y être
const fs = require("fs");
const js = fs.existsSync(__dirname + "/app.js") ? fs.readFileSync(__dirname + "/app.js", "utf8") : "";
const uiKeys = new Set();
for (const m of js.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) uiKeys.add(JSON.parse(`"${m[1]}"`));
for (const m of js.matchAll(/plural\([^,]+,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g)) { uiKeys.add(JSON.parse(`"${m[1]}"`)); uiKeys.add(JSON.parse(`"${m[2]}"`)); }
for (const [code, langue] of [["en", "Anglais"], ["es", "Espagnol"]]) {
  const file = `/recettes.${code}.json`;
  if (fs.existsSync(__dirname + file)) {
    const tr = JSON.parse(fs.readFileSync(__dirname + file, "utf8"));
    data.recettes.forEach(r => {
      const x = (tr.recettes || {})[r.title];
      if (!x) errors.push(`${langue} : la recette « ${r.title} » n'est pas traduite (recettes.${code}.json)`);
      else if (!Array.isArray(x.steps) || x.steps.length !== r.steps.length) errors.push(`${langue} : « ${r.title} » n'a pas le même nombre d'étapes qu'en français`);
    });
    [...ids].forEach(id => { if (!(tr.noms || {})[id]) errors.push(`${langue} : le nom de "${id}" n'est pas traduit`); });
    (data.regimes || []).map(g => g.id).forEach(id => { if (!(tr.regimes || {})[id]) errors.push(`${langue} : le régime "${id}" n'est pas traduit`); });
    (data.conservation || []).forEach(c => { if (!(tr.conservation || {})[c.titre]) errors.push(`${langue} : le conseil « ${c.titre} » n'est pas traduit`); });
  }
  if (js && fs.existsSync(__dirname + `/i18n-${code}.json`)) {
    const ui = JSON.parse(fs.readFileSync(__dirname + `/i18n-${code}.json`, "utf8"));
    [...uiKeys].filter(k => !ui[k] && k !== "Code").forEach(k => errors.push(`${langue} : texte d'interface non traduit dans i18n-${code}.json : « ${k} »`));
  }
}

if (errors.length) { console.error("❌ " + errors.length + " problème(s) :\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`✅ recettes.json est valide : ${data.recettes.length} recettes, ${ids.size} ingrédients.`);
