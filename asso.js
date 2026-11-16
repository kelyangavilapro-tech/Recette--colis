"use strict";
/* Page associations : fabrique le lien « colis du jour » (?colis=id.id.id&asso=Nom) et son QR code. */

const DRAFT_KEY = "colis-asso-brouillon";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let GROUPS = [];
let EQUIP = [];
let RECIPES = [];
let chosen = new Set();

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: $("asso-name").value, items: [...chosen] })); } catch (err) {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (err) { return null; }
}

function renderGroups() {
  $("asso-groups").innerHTML = GROUPS.map(g => `
    <fieldset>
      <legend>${esc(g.titre)}</legend>
      <div class="chips">
        ${g.items.map(([id, name]) => `
          <span class="chip">
            <input type="checkbox" id="a-${esc(id)}" data-id="${esc(id)}" ${chosen.has(id) ? "checked" : ""}>
            <label for="a-${esc(id)}">${esc(name)}</label>
          </span>`).join("")}
      </div>
    </fieldset>`).join("");
  $("asso-groups").querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) chosen.add(inp.dataset.id); else chosen.delete(inp.dataset.id);
    saveDraft(); update();
  }));
}

/* Recettes faisables avec le colis + du sel, de l'huile et l'équipement donné. */
function doable(equip) {
  const have = new Set([...chosen, equip]);
  return RECIPES.filter(r =>
    (r.equip.length === 0 || r.equip.includes(equip)) &&
    r.need.every(opts => opts.some(o => have.has(o))));
}

function buildLink() {
  const url = new URL("./", location.href);
  url.searchParams.set("colis", [...chosen].join("."));
  const name = $("asso-name").value.trim();
  if (name) url.searchParams.set("asso", name);
  return url.href;
}

function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

function update() {
  const plaque = doable("plaque");
  const micro = doable("micro");
  $("asso-count").textContent = plaque.length;
  $("asso-count-text").textContent = plaque.length === 1
    ? "recette possible avec ce colis et une plaque de cuisson."
    : "recettes possibles avec ce colis et une plaque de cuisson.";
  $("asso-micro").textContent = `Avec seulement un micro-ondes : ${micro.length}. Sans aucun équipement : ${doable("aucun").length}.`;

  const has = chosen.size > 0;
  $("out").hidden = !has;
  $("out-empty").hidden = has;
  $("asso-recipes").innerHTML = plaque.length
    ? `<p class="later-title">Les recettes que l'étudiant verra en premier</p><ul class="recipe-names">${plaque.map(r => `<li>${esc(r.title)} <span>· ${r.time} min</span></li>`).join("")}</ul>`
    : "";
  if (!has) return;

  const link = buildLink();
  $("asso-link").value = link;
  $("asso-test").href = link;
  const svg = qrSvg(link);
  $("qr").innerHTML = svg;
  $("poster-qr").innerHTML = svg;
  const name = $("asso-name").value.trim();
  $("poster-asso").textContent = name ? `Colis ${name}` : "Colis du jour";
  $("poster-count").textContent = `${plaque.length} recette${plaque.length > 1 ? "s" : ""} possibles avec ce colis`;
}

function flash(btn, text) {
  const label = btn.querySelector("[data-label]");
  const old = label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = old; }, 2200);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (err) { /* ancienne méthode */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (err) { return false; }
}

async function init() {
  try {
    const data = await (await fetch("recettes.json", { cache: "no-cache" })).json();
    GROUPS = data.groupes.filter(g => !g.type);
    EQUIP = (data.groupes.find(g => g.type === "equip") || { items: [] }).items;
    RECIPES = data.recettes;
  } catch (err) {
    $("out-empty").textContent = "Impossible de charger la liste des produits. Vérifie ta connexion et recharge la page.";
    return;
  }
  const draft = loadDraft();
  if (draft) {
    chosen = new Set(draft.items || []);
    $("asso-name").value = draft.name || "";
  }
  renderGroups();
  update();

  $("asso-name").addEventListener("input", () => { saveDraft(); update(); });
  $("asso-clear").addEventListener("click", () => { chosen.clear(); saveDraft(); renderGroups(); update(); });
  $("asso-copy").addEventListener("click", async e => {
    flash(e.currentTarget, (await copy(buildLink())) ? "Lien copié !" : "Copie impossible");
  });
  $("asso-share").addEventListener("click", async e => {
    const name = $("asso-name").value.trim();
    const text = `Qu'est-ce que je cuisine avec mon colis${name ? " " + name : ""} ? Ouvre ce lien pour voir les recettes possibles :`;
    if (navigator.share) {
      try { await navigator.share({ title: "Recettes avec ton colis", text, url: buildLink() }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    flash(e.currentTarget, (await copy(buildLink())) ? "Lien copié !" : "Copie impossible");
  });
  $("asso-print").addEventListener("click", () => window.print());
  setupProposal();
}

/* ---------- Proposer une recette (en test) ---------- */

const chipsOf = (prefix, items) => items.map(([id, name]) => `
  <span class="chip"><input type="checkbox" id="${prefix}-${esc(id)}" data-id="${esc(id)}"><label for="${prefix}-${esc(id)}">${esc(name)}</label></span>`).join("");

function proposalText() {
  const name = $("asso-name").value.trim();
  const checked = sel => [...document.querySelectorAll(sel + " input:checked")].map(i => i.dataset.id);
  const label = id => { for (const g of [{ items: EQUIP }, ...GROUPS]) for (const [i, n] of g.items) if (i === id) return n; return id; };
  const steps = $("prop-etapes").value.split("\n").map(x => x.trim()).filter(Boolean);
  const recipe = {
    title: $("prop-titre").value.trim(),
    time: Number($("prop-temps").value),
    equip: checked("#prop-equip"),
    need: checked("#prop-ings").map(id => [id]),
    steps,
    swap: $("prop-astuce").value.trim()
  };
  return [
    `Proposition de recette${name ? " de " + name : ""} pour « Qu'est-ce que je cuisine avec mon colis ? »`,
    "",
    `Nom : ${recipe.title}`,
    `Temps : ${recipe.time} min`,
    `Équipement : ${recipe.equip.length ? recipe.equip.map(label).join(" ou ") : "aucun (sans cuisson)"}`,
    `Ingrédients : ${recipe.need.map(([id]) => label(id)).join(", ") || "à préciser"}`,
    "Étapes :",
    ...steps.map((x, n) => `${n + 1}. ${x}`),
    recipe.swap ? `Astuce : ${recipe.swap}` : "",
    "",
    "Format pour l'appli :",
    JSON.stringify(recipe)
  ].filter((line, n, all) => line !== "" || all[n - 1] !== "").join("\n");
}

function setupProposal() {
  $("prop-equip").innerHTML = chipsOf("pe", EQUIP);
  $("prop-ings").innerHTML = GROUPS.map(g => chipsOf("pi", g.items)).join("");
  const form = $("prop-form");
  const valid = () => {
    if (!form.reportValidity()) return false;
    if (!document.querySelector("#prop-ings input:checked")) { $("prop-msg").textContent = "Coche au moins un ingrédient indispensable."; return false; }
    $("prop-msg").textContent = "";
    return true;
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!valid()) return;
    const btn = form.querySelector('button[type="submit"]');
    flash(btn, (await copy(proposalText())) ? "Recette copiée !" : "Copie impossible");
  });
  $("prop-share").addEventListener("click", async e => {
    if (!valid()) return;
    const btn = e.currentTarget, text = proposalText();
    if (navigator.share) {
      try { await navigator.share({ title: "Proposition de recette", text }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    flash(btn, (await copy(text)) ? "Recette copiée !" : "Copie impossible");
  });
}

init();
