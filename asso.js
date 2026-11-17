"use strict";
/* Page associations : fabrique le lien « colis du jour » (?colis=id.id.id&asso=Nom) et son QR code. */

const DRAFT_KEY = "colis-asso-brouillon";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let GROUPS = [];
let EQUIP = [];
let RECIPES = [];
let chosen = new Set();

/* ---------- Langue : la même que celle choisie dans l'appli ---------- */

const LANGS = ["fr", "en", "es"];
let LANG = "fr";
let DICT = {};
function t(fr, vars) {
  let out = (LANG !== "fr" && DICT[fr]) || fr;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return out;
}
const plural = (n, one, many, vars) => t(n === 1 ? one : many, Object.assign({ n }, vars || {}));
function pickLang() {
  try { const saved = JSON.parse(localStorage.getItem("colis-langue") || "null"); if (LANGS.includes(saved)) return saved; } catch (err) {}
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "fr";
  return /^fr\b/i.test(nav) ? "fr" : /^es\b/i.test(nav) ? "es" : "en";
}
function translateStatic() {
  const key = v => v.replace(/\s+/g, " ").trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => { const k = key(n.nodeValue); if (k && DICT[k]) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), DICT[k]); });
  document.querySelectorAll("[placeholder],[aria-label]").forEach(el => ["placeholder", "aria-label"].forEach(a => {
    const v = el.getAttribute(a);
    if (v && DICT[key(v)]) el.setAttribute(a, DICT[key(v)]);
  }));
  if (DICT[document.title]) document.title = DICT[document.title];
}
function translateData(data, tr) {
  data.groupes.forEach(g => {
    if (tr.groupes && tr.groupes[g.titre]) g.titre = tr.groupes[g.titre];
    g.items.forEach(item => { if (tr.noms && tr.noms[item[0]]) item[1] = tr.noms[item[0]]; });
  });
  data.recettes.forEach(r => { const x = tr.recettes && tr.recettes[r.title]; if (x && x.title) r.title = x.title; });
}
function setupLangLinks() {
  document.querySelectorAll("[data-lang]").forEach(a => {
    a.setAttribute("aria-current", a.dataset.lang === LANG ? "true" : "false");
    a.addEventListener("click", e => {
      e.preventDefault();
      try { localStorage.setItem("colis-langue", JSON.stringify(a.dataset.lang)); } catch (err) {}
      location.reload();
    });
  });
}

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
    ? t("recette possible avec ce colis et une plaque de cuisson.")
    : t("recettes possibles avec ce colis et une plaque de cuisson.");
  $("asso-micro").textContent = t("Avec seulement un micro-ondes : {a}. Sans aucun équipement : {b}.", { a: micro.length, b: doable("aucun").length });

  const has = chosen.size > 0;
  $("out").hidden = !has;
  $("out-empty").hidden = has;
  $("asso-recipes").innerHTML = plaque.length
    ? `<p class="later-title">${t("Les recettes que l'étudiant verra en premier")}</p><ul class="recipe-names">${plaque.map(r => `<li>${esc(r.title)} <span>· ${r.time} min</span></li>`).join("")}</ul>`
    : "";
  if (!has) return;

  const link = buildLink();
  $("asso-link").value = link;
  $("asso-test").href = link;
  const svg = qrSvg(link);
  $("qr").innerHTML = svg;
  $("poster-qr").innerHTML = svg;
  const name = $("asso-name").value.trim();
  $("poster-asso").textContent = name ? `${t("Colis")} ${name}` : t("Colis du jour");
  $("poster-count").textContent = plural(plaque.length, "1 recette possible avec ce colis", "{n} recettes possibles avec ce colis");
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
  LANG = pickLang();
  document.documentElement.lang = LANG;
  let tr = null;
  if (LANG !== "fr") {
    try {
      const [ui, content] = await Promise.all([
        fetch(`i18n-${LANG}.json?v=17`, { cache: "no-cache" }).then(r => r.json()),
        fetch(`recettes.${LANG}.json?v=17`, { cache: "no-cache" }).then(r => r.json())
      ]);
      DICT = ui; tr = content;
      translateStatic();
    } catch (err) { LANG = "fr"; document.documentElement.lang = "fr"; }
  }
  setupLangLinks();
  try {
    const data = await (await fetch("recettes.json", { cache: "no-cache" })).json();
    if (tr) translateData(data, tr);
    GROUPS = data.groupes.filter(g => !g.type);
    EQUIP = (data.groupes.find(g => g.type === "equip") || { items: [] }).items;
    RECIPES = data.recettes;
  } catch (err) {
    $("out-empty").textContent = t("Impossible de charger la liste des produits. Vérifie ta connexion et recharge la page.");
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
    flash(e.currentTarget, (await copy(buildLink())) ? t("Lien copié !") : t("Copie impossible"));
  });
  $("asso-share").addEventListener("click", async e => {
    const name = $("asso-name").value.trim();
    const text = name ? t("Qu'est-ce que je cuisine avec mon colis {x} ? Ouvre ce lien pour voir les recettes possibles :", { x: name })
      : t("Qu'est-ce que je cuisine avec mon colis ? Ouvre ce lien pour voir les recettes possibles :");
    if (navigator.share) {
      try { await navigator.share({ title: t("Recettes avec ton colis"), text, url: buildLink() }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    flash(e.currentTarget, (await copy(buildLink())) ? t("Lien copié !") : t("Copie impossible"));
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
    if (!document.querySelector("#prop-ings input:checked")) { $("prop-msg").textContent = t("Coche au moins un ingrédient indispensable."); return false; }
    $("prop-msg").textContent = "";
    return true;
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!valid()) return;
    const btn = form.querySelector('button[type="submit"]');
    flash(btn, (await copy(proposalText())) ? t("Recette copiée !") : t("Copie impossible"));
  });
  $("prop-share").addEventListener("click", async e => {
    if (!valid()) return;
    const btn = e.currentTarget, text = proposalText();
    if (navigator.share) {
      try { await navigator.share({ title: t("Proposition de recette"), text }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    flash(btn, (await copy(text)) ? t("Recette copiée !") : t("Copie impossible"));
  });
}

init();
