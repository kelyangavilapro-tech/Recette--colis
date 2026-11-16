"use strict";
/* Page associations : fabrique le lien « colis du jour » (?colis=id.id.id&asso=Nom) et son QR code. */

const DRAFT_KEY = "colis-asso-brouillon";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let GROUPS = [];
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
  const f = $("asso-link");
  f.select(); f.setSelectionRange(0, text.length);
  try { return document.execCommand("copy"); } catch (err) { return false; }
}

async function init() {
  try {
    const data = await (await fetch("recettes.json", { cache: "no-cache" })).json();
    GROUPS = data.groupes.filter(g => !g.type);
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
}

init();
