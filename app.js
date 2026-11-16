"use strict";
/* Qu'est-ce que je cuisine avec mon colis ?
   Les ingrédients et les recettes sont dans recettes.json : on les modifie là, pas ici. */

const STORAGE_KEY = "colis-have";

const COLORS = {
  tomate: { bar: "var(--tomate)", txt: "var(--tomate-txt)", tint: "var(--tomate-tint)" },
  herbe: { bar: "var(--herbe)", txt: "var(--herbe)", tint: "var(--herbe-tint)" },
  curry: { bar: "var(--curry)", txt: "var(--curry-txt)", tint: "var(--curry-tint)" },
  nuit: { bar: "var(--nuit)", txt: "var(--nuit)", tint: "var(--nuit-tint)" }
};

let GROUPS = [];
let RECIPES = [];
const NAMES = {};
let have = new Set();

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function load(defaults) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved)) return { set: new Set(saved), fromExample: false };
  } catch (err) { /* stockage indisponible : on garde l'exemple */ }
  return { set: new Set(defaults), fromExample: true };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...have])); } catch (err) {}
}

function renderPantry() {
  const box = document.getElementById("pantry-groups");
  box.innerHTML = GROUPS.map(g => `
    <fieldset>
      <legend>${esc(g.titre)}</legend>
      <div class="chips">
        ${g.items.map(([id, name]) => `
          <span class="chip">
            <input type="checkbox" id="c-${esc(id)}" data-id="${esc(id)}" ${have.has(id) ? "checked" : ""}>
            <label for="c-${esc(id)}">${esc(name)}</label>
          </span>`).join("")}
      </div>
      ${g.type === "equip" ? '<p class="note">Rien coché : on te montre les recettes sans cuisson.</p>' : ""}
    </fieldset>`).join("");
  box.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    document.getElementById("example-note").hidden = true;
    save(); renderResults();
  }));
}

/* missing = groupes de "need" dont aucun id n'est coché ; equipOk = sans cuisson ou un équipement coché. */
function analyse(r) {
  const missing = r.need.filter(opts => !opts.some(o => have.has(o)));
  const equipOk = r.equip.length === 0 || r.equip.some(e => have.has(e));
  return { missing, equipOk };
}

const chevron = () => '<svg class="chev" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const clock = () => '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const lower = id => NAMES[id].toLowerCase();

function card(r, a, state) {
  const c = COLORS[r.color] || COLORS.nuit;
  let pill;
  if (!a.equipOk) {
    pill = `<span class="pill eq">Il faut : ${esc(r.equip.map(lower).join(" ou "))}</span>`;
  } else if (a.missing.length === 0) {
    pill = '<span class="pill ok">Tu as tout ce qu\'il faut</span>';
  } else {
    const names = a.missing.map(opts => opts.map(lower).slice(0, 3).join(" ou "));
    pill = `<span class="pill miss">Il te manque : ${esc(names.join(", "))}</span>`;
  }
  const ings = r.need.map(opts => {
    const got = opts.filter(o => have.has(o));
    const label = got.length ? NAMES[got[0]] : opts.map(o => NAMES[o]).slice(0, 3).join(" ou ");
    return `<li class="ing ${got.length ? "have" : "missing"}"><span class="mark" aria-hidden="true">${got.length ? "✓" : "!"}</span><span>${esc(label)}${got.length ? "" : " (à trouver)"}</span></li>`;
  }).join("");
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  const steps = r.steps.map((s, i) => `<li class="step"><b style="background: ${c.bar}">${i + 1}</b><span>${esc(s)}</span></li>`).join("");
  return `
  <details class="recipe" data-state="${state}">
    <summary>
      <span class="bar" style="background: ${c.bar}" aria-hidden="true"></span>
      <span class="recipe-main">
        <h3>${esc(r.title)}</h3>
        <span class="meta"><span>${clock()} ${r.time} min</span><span>· ${esc(r.tool)}</span><span>· 2 portions</span></span>
        ${pill}
      </span>
      ${chevron()}
    </summary>
    <div class="recipe-body">
      <div>
        <h4 style="color: ${c.txt}">Indispensable</h4>
        <ul>${ings}</ul>
        ${extras.length ? `<p class="note" style="margin-top: 10px">Tu peux aussi ajouter : ${esc(extras.join(", "))}.</p>` : ""}
      </div>
      <div>
        <h4 style="color: ${c.txt}">Étapes</h4>
        <ol>${steps}</ol>
      </div>
      <p class="swap" style="background: ${c.tint}"><strong style="color: ${c.txt}">Selon ton colis :</strong> ${esc(r.swap)}</p>
    </div>
  </details>`;
}

function renderResults() {
  const rows = RECIPES.map(r => ({ r, a: analyse(r) }));
  const byTime = (x, y) => x.r.time - y.r.time;
  const ready = rows.filter(x => x.a.equipOk && x.a.missing.length === 0).sort(byTime);
  const almost = rows.filter(x => x.a.equipOk && x.a.missing.length === 1).sort(byTime);
  const later = rows.filter(x => !(x.a.equipOk && x.a.missing.length <= 1))
    .sort((x, y) => (x.a.equipOk === y.a.equipOk ? 0 : x.a.equipOk ? -1 : 1) || x.a.missing.length - y.a.missing.length);

  document.getElementById("count").textContent = ready.length;
  document.getElementById("count-text").textContent = ready.length === 1
    ? "recette possible tout de suite avec ce que tu as."
    : "recettes possibles tout de suite avec ce que tu as.";

  let html = ready.length
    ? ready.map(x => card(x.r, x.a, "ready")).join("")
    : '<p class="empty">Aucune recette complète pour l\'instant. Regarde juste en dessous celles où il ne manque qu\'un ingrédient.</p>';
  if (almost.length) html += '<p class="later-title">Il ne te manque qu\'un ingrédient</p>' + almost.map(x => card(x.r, x.a, "almost")).join("");
  if (later.length) html += '<p class="later-title">Pour plus tard</p>' + later.map(x => card(x.r, x.a, "later")).join("");

  const list = document.getElementById("list");
  const openTitles = [...list.querySelectorAll("details[open] h3")].map(h => h.textContent);
  list.innerHTML = html;
  list.querySelectorAll("details").forEach(d => { if (openTitles.includes(d.querySelector("h3").textContent)) d.open = true; });
}

async function init() {
  let data;
  try {
    const res = await fetch("recettes.json", { cache: "no-cache" });
    data = await res.json();
  } catch (err) {
    document.getElementById("count-text").textContent = "Impossible de charger les recettes. Vérifie ta connexion et recharge la page.";
    return;
  }
  GROUPS = data.groupes;
  RECIPES = data.recettes;
  GROUPS.forEach(g => g.items.forEach(([id, n]) => { NAMES[id] = n; }));

  const loaded = load(data.colisExemple || []);
  have = loaded.set;
  document.getElementById("example-note").hidden = !loaded.fromExample;

  document.getElementById("clear").addEventListener("click", () => {
    have.clear(); save(); renderPantry(); renderResults();
    document.getElementById("example-note").hidden = true;
  });

  renderPantry();
  renderResults();
  const first = document.querySelector("#list details");
  if (first) first.open = true;
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
