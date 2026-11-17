"use strict";
/* Qu'est-ce que je cuisine avec mon colis ?
   Les ingrédients, recettes, valeurs nutritionnelles et conseils sont dans recettes.json,
   les liens dans config.js : on les modifie là, pas ici. */

const KEYS = {
  have: "colis-have", groups: "colis-groupes-ouverts", favs: "colis-favoris",
  shop: "colis-courses", theme: "colis-theme", portions: "colis-portions", welcome: "colis-bienvenue-vue", lang: "colis-langue",
  voice: "colis-voix", history: "colis-repas", urgent: "colis-a-finir", mine: "colis-mes-recettes", menu: "colis-menu",
  text: "colis-texte", photos: "colis-mes-photos", notes: "colis-notes"
};
const MOBILE = window.matchMedia("(max-width: 880px)");
const DARK = window.matchMedia("(prefers-color-scheme: dark)");
const CONFIG = window.CONFIG || {};

const COLORS = {
  tomate: { bar: "var(--tomate)", txt: "var(--tomate-txt)", tint: "var(--tomate-tint)" },
  herbe: { bar: "var(--herbe)", txt: "var(--herbe-txt)", tint: "var(--herbe-tint)" },
  curry: { bar: "var(--curry)", txt: "var(--curry-txt)", tint: "var(--curry-tint)" },
  nuit: { bar: "var(--nuit)", txt: "var(--nuit-txt)", tint: "var(--nuit-tint)" }
};

let GROUPS = [];
let RECIPES = [];
let REGIMES = [];
let NUTRI = {};
let TIPS = [];
let BASICS = [];          // fiches « Les bases »
let OFF = [];
let PHOTOS = { recettes: {}, ingredients: {} }; // photos facultatives, déclarées dans recettes.json
let PRIX = {}; // euros par kg (ou par litre), estimations
let EXEMPLE = [];
let portions = 2; // nombre de personnes choisi
const filters = new Set();
let recipeQuery = "";
const NAMES = {};
const NUTRI_NOTE = "Estimations par portion, sur les ingrédients indispensables : ordres de grandeur, pas des valeurs exactes. Le coût est calculé aux prix moyens en supermarché ; avec un colis, c'est gratuit.";
const INGREDIENTS = new Set(); // ingrédients seulement (ni équipement, ni régime)
let have = new Set();
let urgent = new Set();   // produits à finir vite
let history = [];         // repas cuisinés : { id, date, euros }
let BASE = [];            // recettes de l'appli (sans celles créées par l'étudiant)
let mine = [];            // recettes créées par l'étudiant, gardées sur son téléphone
let myPhotos = {};        // photos prises par l'étudiant : identifiant de recette -> image
let favs = new Set();
let shop = [];
let SEASON = new Set();   // recettes de la saison en cours
let openGroups = null; // null = état par défaut (ouverts sur ordinateur, repliés sur téléphone)
let searching = false;

const $ = id => document.getElementById(id);

/* ---------- Langue ---------- */
/* Les textes sont écrits en français ; dans une autre langue, t() cherche la traduction dans i18n-<langue>.json.
   Les {mots} entre accolades sont remplacés par les valeurs données. */
const LANGS = ["fr", "en", "es"];
let LANG = "fr";
let DICT = {};           // français -> langue choisie
function t(fr, vars) {
  let out = (LANG !== "fr" && DICT[fr]) || fr;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return out;
}
const plural = (n, one, many, vars) => t(n === 1 ? one : many, Object.assign({ n }, vars || {}));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- Mémoire sur l'appareil ---------- */

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (err) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* stockage indisponible */ }
}
const save = () => writeJSON(KEYS.have, [...have]);
const saveFavs = () => writeJSON(KEYS.favs, [...favs]);
const saveShop = () => writeJSON(KEYS.shop, shop);

/* ---------- Statistiques anonymes (désactivées si config.js n'a pas de code) ---------- */

function setupStats() {
  if (!CONFIG.goatcounter) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`;
  document.head.appendChild(s);
}
function track(path, title) {
  try {
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title: title || path, event: true });
  } catch (err) { /* les statistiques ne doivent jamais gêner l'appli */ }
}

/* ---------- Petits outils d'interface ---------- */

let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function flash(btn, text) {
  const label = btn.querySelector("[data-label]");
  if (!label) return;
  const old = label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = old; }, 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (err) { /* on essaie l'ancienne méthode */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (err) { return false; }
}

async function shareText(title, text, btn) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; }
    catch (err) { if (err.name === "AbortError") return; }
  }
  const ok = await copyText(text);
  if (btn) flash(btn, ok ? t("Copié !") : t("Copie impossible"));
  else toast(ok ? t("Copié !") : t("Copie impossible"));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* Fenêtres (menu, panneaux, mode cuisine), avec un secours pour les navigateurs sans <dialog>. */
function openDialog(dlg) {
  if (dlg.hasAttribute("open")) return;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else {
    dlg.setAttribute("open", ""); dlg.classList.add("dlg-fallback"); document.body.style.overflow = "hidden";
    const first = dlg.querySelector("[data-close], button, input, a[href]");
    if (first) setTimeout(() => first.focus(), 0);
  }
}
function closeDialog(dlg) {
  if (!dlg.hasAttribute("open")) return;
  if (typeof dlg.close === "function" && !dlg.classList.contains("dlg-fallback")) { dlg.close(); return; }
  dlg.removeAttribute("open"); dlg.classList.remove("dlg-fallback"); document.body.style.overflow = "";
  dlg.dispatchEvent(new Event("close"));
}
function setupDialogs() {
  /* Navigateurs sans <dialog> : Échap ferme la fenêtre ouverte. */
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const open = [...document.querySelectorAll("dialog.dlg-fallback[open]")].pop();
    if (open) closeDialog(open);
  });
  document.querySelectorAll("dialog").forEach(dlg => {
    dlg.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeDialog(dlg)));
    /* Toucher le fond grisé ferme le menu et les panneaux (pas le mode cuisine). */
    if (dlg.id !== "cook") dlg.addEventListener("click", e => { if (e.target === dlg) closeDialog(dlg); });
  });
}

/* ---------- Icônes ---------- */

const svg = (d, size = 20) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  chevron: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  cook: '<path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z"/><path d="M2 11h20M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3"/>',
  check: '<path d="M5 12l5 5L19 7"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
};
/* Illustration de chaque recette, d'après son ustensile. */
const TOOL_ART = {
  pan: '<circle cx="10" cy="13" r="7"/><path d="M16.5 10.5 22 6"/><path d="M7 12c1-1.5 3-1.5 4 0"/>',
  pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h20M8 6c0 1 1 1 1 2M12 5c0 1 1 1 1 2M16 6c0 1 1 1 1 2"/>',
  oven: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M11 6.5h.01"/><rect x="7" y="12" width="10" height="5" rx="1"/>',
  mug: '<path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  plate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3"/>'
};
function toolArt(tool) {
  const t = norm(tool);
  if (t.includes("poele")) return TOOL_ART.pan;
  if (t.includes("casserole")) return TOOL_ART.pot;
  if (t.includes("four")) return TOOL_ART.oven;
  if (t.includes("tasse") || t.includes("ramequin")) return TOOL_ART.mug;
  if (t.includes("assiette")) return TOOL_ART.plate;
  return TOOL_ART.bowl;
}

/* ---------- Thème clair / sombre ---------- */

function currentTheme() {
  const t = readJSON(KEYS.theme);
  return t === "light" || t === "dark" ? t : "auto";
}
function applyTheme(mode) {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  const dark = mode === "dark" || (mode === "auto" && DARK.matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#121411" : "#F4F5F0");
  const radio = $("theme-" + mode);
  if (radio) radio.checked = true;
}
function setupTheme() {
  applyTheme(currentTheme());
  document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener("change", () => {
    writeJSON(KEYS.theme, r.value);
    applyTheme(r.value);
  }));
  const onSystem = () => { if (currentTheme() === "auto") applyTheme("auto"); };
  if (DARK.addEventListener) DARK.addEventListener("change", onSystem);
}

/* ---------- Taille du texte ---------- */

const TEXT_SIZES = ["normal", "grand", "tres-grand"];
function applyTextSize(size) {
  if (size === "normal") document.documentElement.removeAttribute("data-text");
  else document.documentElement.setAttribute("data-text", size);
  const radio = $("text-" + size);
  if (radio) radio.checked = true;
}
function setupTextSize() {
  const saved = readJSON(KEYS.text);
  applyTextSize(TEXT_SIZES.includes(saved) ? saved : "normal");
  document.querySelectorAll('input[name="textsize"]').forEach(r => r.addEventListener("change", () => {
    writeJSON(KEYS.text, r.value);
    applyTextSize(r.value);
  }));
}

/* ---------- Mon frigo ---------- */

function groupState(g) {
  const got = g.items.filter(([id]) => have.has(id)).map(([, n]) => n);
  return { count: got.length, names: got.length ? got.join(", ") : t("Rien de coché") };
}

/* Les groupes du frigo sont ouverts, sauf ceux que l'étudiant a refermés. */
function isGroupOpen(gi) {
  return !(openGroups && openGroups.includes(-1 - gi));
}

/* Photo d'une recette ou d'un ingrédient, si elle a été ajoutée (dossier photos/). */
const photoOf = (kind, key) => {
  const ph = PHOTOS[kind] && PHOTOS[kind][key];
  return ph && /^photos\/[a-z0-9/_-]+\.(jpe?g|webp|png)$/.test(ph.src) ? ph : null;
};

const chipHtml = (prefix, id, name) => `
  <span class="chip" data-name="${esc(norm(name))}">
    <input type="checkbox" id="${prefix}-${esc(id)}" data-id="${esc(id)}" ${have.has(id) ? "checked" : ""}>
    <label for="${prefix}-${esc(id)}">${photoOf("ingredients", id) ? `<img class="chip-pic" src="${esc(photoOf("ingredients", id).src)}" alt="" width="28" height="28" loading="lazy">` : ""}${esc(name)}</label>
  </span>`;

/* Mon frigo ne montre que les ingrédients : l'équipement et le régime sont dans le profil. */
function renderPantry() {
  const box = $("pantry-groups");
  box.innerHTML = GROUPS.map((g, gi) => {
    if (g.type) return "";
    const s = groupState(g);
    return `
    <details class="group" data-g="${gi}" ${isGroupOpen(gi) ? "open" : ""}>
      <summary class="group-head">
        <span class="group-title">${esc(g.titre)}</span>
        <span class="group-count" data-count>${s.count} / ${g.items.length}</span>
        ${svg(ICON.chevron)}
        <span class="group-names" data-names>${esc(s.names)}</span>
      </summary>
      <fieldset>
        <legend class="sr-only">${esc(g.titre)}</legend>
        <div class="chips">${g.items.map(([id, name]) => chipHtml("c", id, name)).join("")}</div>
      </fieldset>
    </details>`;
  }).join("");

  box.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    $("example-note").hidden = true;
    updateGroupHead(inp.closest("details"));
    save(); renderUrgent(); renderResults();
  }));
  box.querySelectorAll("details.group").forEach(d => d.addEventListener("toggle", () => {
    if (searching) return; // la recherche ouvre les groupes sans changer tes préférences
    openGroups = [...box.querySelectorAll("details.group:not([open])")].map(x => -1 - Number(x.dataset.g));
    writeJSON(KEYS.groups, openGroups);
  }));
  const q = $("search").value;
  if (q) filterPantry(q);
}

function updateGroupHead(details) {
  const g = GROUPS[Number(details.dataset.g)];
  const s = groupState(g);
  details.querySelector("[data-count]").textContent = `${s.count} / ${g.items.length}`;
  details.querySelector("[data-names]").textContent = s.names;
}

/* Tout ce qui change « ce que j'ai » passe par ici, pour que tout l'écran reste à jour. */
function haveChanged() {
  save();
  if ($("urgent-count")) renderUrgent();
  renderPantry();
  renderProfile();
  renderResults();
}

/* Recherche : on ne garde que les ingrédients qui correspondent et on ouvre leurs groupes. */
function filterPantry(raw) {
  const q = norm(raw.trim());
  searching = true;
  let found = 0;
  document.querySelectorAll("#pantry-groups details.group").forEach(d => {
    let inGroup = 0;
    d.querySelectorAll(".chip").forEach(chip => {
      const ok = !q || chip.dataset.name.includes(q);
      chip.hidden = !ok;
      if (ok) inGroup++;
    });
    found += q ? inGroup : 0;
    d.hidden = !!q && inGroup === 0;
    d.open = q ? inGroup > 0 : isGroupOpen(Number(d.dataset.g));
  });
  $("search-empty").hidden = !q || found > 0;
  setTimeout(() => { searching = false; }, 0);
}

/* ---------- Profil : équipement, régime, allergies, réglages ---------- */

const DIETS = ["vege", "vegan", "halal"]; // le reste des régimes, ce sont des allergies
function renderProfile() {
  const equip = GROUPS.find(g => g.type === "equip");
  const regime = GROUPS.find(g => g.type === "regime");
  $("profile-equip").innerHTML = equip ? equip.items.map(([id, n]) => chipHtml("p", id, n)).join("") : "";
  $("profile-regime").innerHTML = regime ? regime.items.filter(([id]) => DIETS.includes(id)).map(([id, n]) => chipHtml("p", id, n)).join("") : "";
  $("profile-allergy").innerHTML = regime ? regime.items.filter(([id]) => !DIETS.includes(id)).map(([id, n]) => chipHtml("p", id, n)).join("") : "";
  $("profile-allergy-note").textContent = `${t("On cache les recettes qui ne te conviennent pas.")} ${regime && regime.note ? regime.note : ""}`;
  renderStats();
  $("drawer-shop-count").textContent = shop.filter(x => !x.done).length;
}
function setupProfile() {
  $("screen-profil").addEventListener("change", e => {
    const inp = e.target;
    if (!inp.dataset.id) return;
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    save(); renderResults();
  });
  $("reset-app").addEventListener("click", () => {
    if (!window.confirm(t("Tout remettre à zéro ? Tes ingrédients cochés, tes favoris, ta liste de courses et tes réglages seront effacés de ce téléphone."))) return;
    Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch (err) {} });
    window.location.href = location.pathname;
  });
  /* Boutons « raccourcis » présents un peu partout (accueil, carnet, profil). */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) {
      const go = b.dataset.go;
      if (go === "scan") openScan();
      if (go === "shop") openShop();
      if (go === "keep") openTips();
      if (go === "basics") openBasics();
      if (go === "menu") openMenu();
      if (go === "welcome") openWelcome(true);
      return;
    }
    if (e.target.closest("[data-open-shop]")) openShop();
  });
}

/* ---------- Correspondance ---------- */

function excluded() {
  const ex = new Set();
  REGIMES.forEach(rg => { if (have.has(rg.id)) rg.exclut.forEach(id => ex.add(id)); });
  return ex;
}

/* La recette vue à travers le régime : on retire les ingrédients exclus des alternatives. */
function adapt(r, ex) {
  if (!ex.size) return r;
  return Object.assign({}, r, {
    need: r.need.map(opts => opts.filter(o => !ex.has(o))),
    extra: r.extra.filter(o => !ex.has(o))
  });
}
const compatible = r => r.need.every(opts => opts.length > 0);

/* missing = groupes de "need" dont aucun id n'est coché ; equipOk = sans cuisson ou un équipement coché. */
function analyse(r) {
  const missing = r.need.filter(opts => !opts.some(o => have.has(o)));
  const equipOk = r.equip.length === 0 || r.equip.some(e => have.has(e));
  return { missing, equipOk };
}

const lower = id => NAMES[id].toLowerCase();
/* L'ingrédient utilisé pour une ligne de « need » : celui qu'on a, sinon le premier proposé. */
const pick = opts => opts.find(o => have.has(o)) || opts[0];
/* Libellé d'un ingrédient indispensable : celui qu'on a, sinon les alternatives. */
const needLabel = opts => {
  const got = opts.filter(o => have.has(o));
  return got.length ? NAMES[got[0]] : opts.map(o => NAMES[o]).slice(0, 3).join(" ou ");
};

/* Valeurs nutritionnelles estimées par portion, pour les ingrédients indispensables. */
function nutrition(r) {
  const sum = { kcal: 0, prot: 0, gluc: 0, lip: 0 };
  r.need.forEach(opts => {
    const id = pick(opts);
    const n = NUTRI[id];
    if (!n) return;
    const grams = r.qte && r.qte[id] != null ? r.qte[id] : n[4];
    const f = grams / 100;
    sum.kcal += n[0] * f; sum.prot += n[1] * f; sum.gluc += n[2] * f; sum.lip += n[3] * f;
  });
  return { kcal: Math.round(sum.kcal / 10) * 10, prot: Math.round(sum.prot), gluc: Math.round(sum.gluc), lip: Math.round(sum.lip) };
}

/* ---------- Quantités : portions et repères sans balance ---------- */

const PAR_VERRE = { riz: 170, semoule: 140, farine: 110, avoine: 80 }; // grammes dans un verre de 20 cl
const fmtNum = x => {
  const whole = Math.floor(x), half = x - whole >= 0.5;
  return whole === 0 ? (half ? "½" : "0") : `${whole}${half ? " ½" : ""}`;
};
/* Ce qui change d'une langue à l'autre pour lire et ajuster les quantités des étapes. */
const QTY = {
  fr: {
    count: /(\d+)(\s+(?:ou|à)\s+)?(\d+)?\s+(œufs?|pommes? de terre|cuillères?)/g,
    sing: { "œufs": "œuf", "cuillères": "cuillère", "pommes de terre": "pomme de terre" },
    plur: { "œuf": "œufs", "cuillère": "cuillères", "pomme de terre": "pommes de terre" },
    spoon: /^cuill/, perPerson: /par personne/,
    kw: { pates: /pates/, poulet: /poulet/, riz: /riz/, semoule: /semoule/, farine: /farine/, avoine: /avoine/ },
    glass: { 0: "quelques cuillères", 0.25: "un quart de verre", 0.5: "un demi-verre", 0.75: "trois quarts de verre", 1: "un verre",
      1.25: "un peu plus d'un verre", 1.5: "un verre et demi", 1.75: "presque 2 verres", 2: "2 verres", 2.25: "un peu plus de 2 verres", 2.5: "2 verres et demi" },
    glasses: n => `${fmtNum(n)} verres`,
    handful: n => n === 0.5 ? "une petite poignée" : `${fmtNum(n)} grosse${n > 1 ? "s" : ""} poignée${n > 1 ? "s" : ""}`,
    breast: n => `${fmtNum(n)} blanc${n > 1 ? "s" : ""} de poulet`
  },
  en: {
    count: /(\d+)(\s+(?:or|to)\s+)?(\d+)?\s+(eggs?|potato(?:es)?|tablespoons?|teaspoons?|spoons?)/g,
    sing: { eggs: "egg", potatoes: "potato", tablespoons: "tablespoon", teaspoons: "teaspoon", spoons: "spoon" },
    plur: { egg: "eggs", potato: "potatoes", tablespoon: "tablespoons", teaspoon: "teaspoons", spoon: "spoons" },
    spoon: /spoon/, perPerson: /per person/,
    kw: { pates: /pasta/, poulet: /chicken/, riz: /rice/, semoule: /semolina|couscous/, farine: /flour/, avoine: /oat/ },
    glass: { 0: "a few spoonfuls", 0.25: "a quarter of a glass", 0.5: "half a glass", 0.75: "three quarters of a glass", 1: "1 glass",
      1.25: "just over a glass", 1.5: "1 ½ glasses", 1.75: "almost 2 glasses", 2: "2 glasses", 2.25: "just over 2 glasses", 2.5: "2 ½ glasses" },
    glasses: n => `${fmtNum(n)} glasses`,
    handful: n => n === 0.5 ? "a small handful" : `${fmtNum(n)} big handful${n > 1 ? "s" : ""}`,
    breast: n => `${fmtNum(n)} chicken breast${n > 1 ? "s" : ""}`
  },
  es: {
    count: /(\d+)(\s+(?:o|a)\s+)?(\d+)?\s+(huevos?|patatas?|cucharaditas?|cucharadas?)/g,
    sing: { huevos: "huevo", patatas: "patata", cucharadas: "cucharada", cucharaditas: "cucharadita" },
    plur: { huevo: "huevos", patata: "patatas", cucharada: "cucharadas", cucharadita: "cucharaditas" },
    spoon: /cuchar/, perPerson: /por persona/,
    kw: { pates: /pasta|macarrones|espaguetis/, poulet: /pollo/, riz: /arroz/, semoule: /semola|cuscus/, farine: /harina/, avoine: /avena/ },
    glass: { 0: "unas cucharadas", 0.25: "un cuarto de vaso", 0.5: "medio vaso", 0.75: "tres cuartos de vaso", 1: "1 vaso",
      1.25: "algo más de un vaso", 1.5: "1 vaso y medio", 1.75: "casi 2 vasos", 2: "2 vasos", 2.25: "algo más de 2 vasos", 2.5: "2 vasos y medio" },
    glasses: n => `${fmtNum(n)} vasos`,
    handful: n => n === 0.5 ? "un puñado pequeño" : `${fmtNum(n)} puñado${n > 1 ? "s" : ""} grande${n > 1 ? "s" : ""}`,
    breast: n => `${fmtNum(n)} pechuga${n > 1 ? "s" : ""} de pollo`
  }
};
const Q = () => QTY[LANG] || QTY.fr;
function verres(ml) {
  const q = Math.round(ml / 200 * 4) / 4;
  return Q().glass[q] || Q().glasses(Math.round(q * 2) / 2);
}
/* Repère sans balance pour une quantité en grammes ou en millilitres, d'après l'ingrédient cité autour. */
function repere(qty, unit, around) {
  if (unit === "ml") return verres(qty);
  const t = norm(around), kw = Q().kw;
  if (kw.pates.test(t)) return Q().handful(Math.max(0.5, Math.round(qty / 100 * 2) / 2));
  if (kw.poulet.test(t)) return Q().breast(Math.max(0.5, Math.round(qty / 125 * 2) / 2));
  for (const [k, g] of Object.entries(PAR_VERRE)) if (kw[k].test(t)) return verres(qty / g * 200);
  return "";
}
/* Facteur de multiplication d'une recette selon le nombre de personnes choisi. */
const recipeFactor = r => (r.portions === 1 || r.portions === "par personne") ? 1 : portions / 2;
const portionLabel = r => r.portions === 1 ? t("1 portion") : plural(portions, "1 portion", "{n} portions");

/* Texte d'une étape avec les quantités ajustées et un repère sans balance entre parenthèses. */
function stepText(text, factor) {
  const L = Q();
  let out = text.replace(new RegExp(L.count.source, "g"), (m, a, sep, b, word, offset, whole) => {
    if (factor === 1 || L.perPerson.test(whole.slice(offset, offset + m.length + 30))) return m;
    const min = L.spoon.test(word) ? 0.5 : 1;
    const sc = v => { const x = Math.max(min, Math.round(Number(v) * factor * 2) / 2); return min === 1 ? Math.max(1, Math.round(x)) : x; };
    const A = sc(a), B = b ? sc(b) : null;
    const top = B != null ? B : A;
    let w = word;
    if (top > 1 && L.plur[w]) w = L.plur[w];
    if (top <= 1 && L.sing[w]) w = L.sing[w];
    if (B != null && B === A) return `${fmtNum(A)} ${w}`;
    return `${fmtNum(A)}${B != null ? sep + fmtNum(B) : ""} ${w}`;
  });
  out = out.replace(/(\d+)\s*(g|ml)\b/g, (m, v, unit, offset, whole) => {
    const perPerson = L.perPerson.test(whole.slice(offset, offset + 40));
    let q = Number(v) * (perPerson ? 1 : factor);
    q = unit === "g" ? (q < 50 ? Math.round(q / 5) * 5 : Math.round(q / 10) * 10) : Math.round(q / 10) * 10;
    const rp = repere(q, unit, whole.slice(Math.max(0, offset - 30), offset + m.length + 30));
    return `${q} ${unit}${rp ? ` (≈ ${rp})` : ""}`;
  });
  return out;
}
const stepsOf = r => r.steps.map(s => stepText(s, recipeFactor(r)));

/* Coût estimé par portion, aux prix moyens en supermarché, pour les ingrédients indispensables. */
function costOf(r) {
  let euros = 0;
  r.need.forEach(opts => {
    const id = pick(opts);
    const n = NUTRI[id];
    if (!n || PRIX[id] == null) return;
    const grams = r.qte && r.qte[id] != null ? r.qte[id] : n[4];
    euros += PRIX[id] * grams / 1000;
  });
  return euros;
}
const fmtEuros = e => {
  const v = (Math.round(Math.max(e, 0.1) * 20) / 20).toFixed(2);
  if (LANG === "en") return e < 0.1 ? "under €0.10" : `€${v}`;
  if (LANG === "es") return e < 0.1 ? "menos de 0,10 €" : `${v.replace(".", ",")} €`;
  return e < 0.1 ? "moins de 0,10 €" : `${v.replace(".", ",")} €`;
};

/* ---------- Filtres de recherche ---------- */

const fitsDiet = (r, id) => {
  const rg = REGIMES.find(x => x.id === id);
  return !rg || compatible(adapt(r, new Set(rg.exclut)));
};
const OTHER_TOOLS = ["mixeur", "grillepain", "cuiseur", "autocuiseur", "gaufrier", "croque"];
/* [identifiant, libellé, groupe, test]. Dans un même groupe, il suffit d'un filtre ; entre groupes, il faut tous. */
const FILTERS = [
  ["sucre", "Sucré", "cat", r => !!r.sucree],
  ["sale", "Salé", "cat", r => !r.sucree],
  ["froid", "Sans cuisson", "equip", r => r.equip.length === 0],
  ["micro", "Micro-ondes", "equip", r => r.equip.includes("micro")],
  ["plaque", "Plaque de cuisson", "equip", r => r.equip.includes("plaque")],
  ["four", "Four ou air fryer", "equip", r => r.equip.includes("four") || r.equip.includes("airfryer")],
  ["appareil", "Autres appareils", "equip", r => r.equip.some(e => OTHER_TOOLS.includes(e))],
  ["rapide", "Moins de 10 min", "time", r => r.time <= 10],
  ["t20", "20 min ou moins", "time", r => r.time <= 20],
  ["budget", "Petit budget", "price", r => costOf(r) <= 0.5],
  ["moins1", "Moins de 1 € la portion", "price", r => costOf(r) < 1],
  ["vege", "Végé", "diet", r => fitsDiet(r, "vege")],
  ["vegan", "Végan", "diet", r => fitsDiet(r, "vegan")],
  ["prot", "Riche en protéines", "diet", r => nutrition(r).prot >= 20],
  ["pret", "J'ai tout", "dispo", (r, a) => a.equipOk && a.missing.length === 0],
  ["presque", "Il me manque 1 ingrédient au plus", "dispo", (r, a) => a.equipOk && a.missing.length <= 1],
  ["saison", "De saison", "hidden", r => SEASON.has(r.id)],
  ["urgent", "À finir vite", "hidden", r => urgentUsed(r).length > 0],
  ["mine", "Mes recettes", "hidden", r => !!r.mine]
];
const FILTER_GROUPS = [["cat", "Catégories"], ["equip", "Équipement"], ["time", "Temps"], ["price", "Prix"], ["diet", "Régime"], ["dispo", "Avec ce que j'ai"], ["hidden", ""]];
const QUICK = ["froid", "micro", "rapide", "vege", "sucre", "budget"];
const filterLabel = id => t((FILTERS.find(f => f[0] === id) || [, id])[1]);
let searchShown = false; // résultats affichés (après « Valider », un filtre ou une recherche)

function matchesFilters(x) {
  for (const [g] of FILTER_GROUPS) {
    const on = FILTERS.filter(f => f[2] === g && filters.has(f[0]));
    if (on.length && !on.some(f => f[3](x.r, x.a))) return false;
  }
  if (recipeQuery) {
    const r = x.r;
    const words = norm(r.title) + " " + r.need.flat().map(id => norm(NAMES[id] || "")).join(" ");
    if (!words.includes(recipeQuery)) return false;
  }
  return true;
}
function renderFilters() {
  $("filters").innerHTML = QUICK.map(id =>
    `<button type="button" class="tab tab-sm" data-filter="${id}" aria-pressed="${filters.has(id)}">${esc(filterLabel(id))}</button>`).join("");
}
function renderRefine() {
  $("refine").innerHTML = FILTER_GROUPS.filter(([g]) => g !== "hidden").map(([g, label]) => {
    const list = FILTERS.filter(f => f[2] === g);
    const n = list.filter(f => filters.has(f[0])).length;
    return `<details class="acc" data-acc="${g}">
      <summary><span>${esc(t(label))}</span>${n ? `<span class="acc-n">${n}</span>` : ""}${svg(ICON.chevron, 26)}</summary>
      <div class="chips">${list.map(([id, l]) => `<span class="chip"><input type="checkbox" id="rf-${id}" data-filter="${id}" ${filters.has(id) ? "checked" : ""}><label for="rf-${id}">${esc(t(l))}</label></span>`).join("")}</div>
    </details>`;
  }).join("");
}
function setFilters(ids, show) {
  filters.clear();
  ids.forEach(id => filters.add(id));
  recipeQuery = ""; $("recipe-search").value = "";
  searchShown = !!show;
  renderFilters(); renderRefine();
}

/* ---------- Cartes de recettes ---------- */

const rowState = x => isReady(x) ? "ready" : x.a.equipOk && x.a.missing.length === 1 ? "almost" : "later";
function stateBadge(x, cls) {
  const r = x.r, a = x.a;
  if (!a.equipOk) return `<span class="pill eq ${cls}">${t("Il faut :")} ${esc(r.equip.map(lower).slice(0, 2).join(t(" ou ")))}</span>`;
  if (!a.missing.length) return `<span class="pill ok ${cls}">${svg(ICON.check, 14)} ${t("Tu as tout")}</span>`;
  return `<span class="pill miss ${cls}">${plural(a.missing.length, "Il manque 1 ingrédient", "Il manque {n} ingrédients")}</span>`;
}
function artHtml(r) {
  const c = COLORS[r.color] || COLORS.nuit;
  return `<span class="art" style="background-color: ${c.tint}; color: ${c.txt}" aria-hidden="true">${svg(toolArt(r.tool), 64).replace('stroke-width="2.2"', 'stroke-width="1.4"')}</span>`;
}
const recipeHref = r => "#recette/" + slug(r.id);
function rcard(x) {
  const r = x.r, photo = recipePhoto(r);
  return `<a class="rcard" href="${recipeHref(r)}" data-state="${rowState(x)}">
    <span class="rcard-img">${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy" width="320" height="240">` : artHtml(r)}
      ${stateBadge(x, "rcard-badge")}
      ${favs.has(r.id) ? `<span class="rcard-fav">${svg(ICON.star, 18)}<span class="sr-only">${t("Favori :")}</span></span>` : ""}
    </span>
    <span class="rcard-body">
      <span class="rcard-title">${esc(r.title)}</span>
      <span class="rcard-meta"><span>${svg(ICON.clock, 14)} ${r.time} min</span><span>≈ ${fmtEuros(costOf(r))}</span></span>
    </span>
  </a>`;
}
/* Ordre : faisables d'abord (celles qui finissent un produit « à finir vite » en tête), puis presque, puis le reste. */
function rankRows(rows) {
  const w = x => (rowState(x) === "ready" ? 0 : rowState(x) === "almost" ? 1 : 2);
  return rows.slice().sort((x, y) => w(x) - w(y) || urgentUsed(y.r).length - urgentUsed(x.r).length || x.r.time - y.r.time);
}

const appUrl = () => new URL("./", location.href).href;

function computeRows() {
  const ex = excluded();
  const all = RECIPES.map((r, i) => ({ r: adapt(r, ex), i }));
  const ok = all.filter(x => compatible(x.r));
  return { hidden: all.length - ok.length, rows: ok.map(x => Object.assign(x, { a: analyse(x.r) })) };
}
const isReady = x => x.a.equipOk && x.a.missing.length === 0;

/* ---------- Accueil ---------- */

const CATS = [
  ["froid", "Sans cuisson", '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 11c0-3 2-5 4-6M13 11c0-2 1.5-4 4-4"/>'],
  ["micro", "Micro-ondes", '<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="10" height="8" rx="1"/><path d="M18 9v.01M18 12v.01M18 15v.01"/>'],
  ["rapide", "Moins de 10 min", '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'],
  ["vege", "Végé", '<path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z"/><path d="M5 20 14 11"/>'],
  ["sucre", "Sucré", '<path d="M6 11h12l-2 9H8z"/><path d="M5 11a7 5 0 0 1 14 0"/><path d="M12 3v3"/>'],
  ["budget", "Petit budget", '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7 11h6M7 13.5h6"/>'],
  ["prot", "Riche en protéines", '<path d="M12 3c3.5 0 7 6 7 10a7 7 0 0 1-14 0c0-4 3.5-10 7-10z"/>'],
  ["saison", "De saison", '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>']
];
function renderCats() {
  $("cats").innerHTML = CATS.map(([id, label, ico]) =>
    `<button type="button" class="cat" data-cat="${id}"><span class="cat-ico">${svg(ico, 28)}</span>${esc(t(label))}</button>`).join("");
}
const SEASON_NAMES = { hiver: "L'hiver", printemps: "Le printemps", ete: "L'été", automne: "L'automne" };
function currentSeason() {
  const m = new Date().getMonth() + 1;
  return m === 12 || m <= 2 ? "hiver" : m <= 5 ? "printemps" : m <= 8 ? "ete" : "automne";
}
/* Petit nombre stable pour la journée : la recette du jour ne change pas à chaque ouverture. */
const dayHash = s => { let h = 0; const k = s + new Date().toISOString().slice(0, 10); for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function dailyPicks(rows) {
  const ready = rows.filter(isReady).sort((x, y) => dayHash(x.r.id) - dayHash(y.r.id));
  const almost = rows.filter(x => rowState(x) === "almost").sort((x, y) => dayHash(x.r.id) - dayHash(y.r.id));
  const rest = rows.filter(x => rowState(x) === "later" && x.a.equipOk).sort((x, y) => dayHash(x.r.id) - dayHash(y.r.id));
  return ready.concat(almost, rest).slice(0, 5);
}
function renderDaily(rows) {
  const picks = dailyPicks(rows);
  $("daily-track").innerHTML = picks.map((x, k) => {
    const photo = recipePhoto(x.r);
    return `<a class="daily-slide" href="${recipeHref(x.r)}" aria-label="${esc((k === 0 ? t("Recette du jour") : t("Idée")) + " : " + x.r.title)}">
      ${photo ? `<img src="${esc(photo.src)}" alt="" ${k ? 'loading="lazy"' : ""}>` : artHtml(x.r)}
      <span class="daily-label">${k === 0 ? t("Recette du jour") : t("Idée du jour")}</span>
      <span class="daily-text"><span class="daily-title">${esc(x.r.title)}</span>
        <span class="daily-meta"><span>${svg(ICON.clock, 16)} ${x.r.time} min</span>${stateBadge(x, "")}</span></span>
    </a>`;
  }).join("");
  $("daily-dots").innerHTML = picks.map((_, k) => `<span class="${k === 0 ? "on" : ""}"></span>`).join("");
  $("daily-track").scrollLeft = 0;
}
function homeSection(id, title, sub, list, see, empty) {
  if (!list.length && !empty) return "";
  return `<section class="home-section" aria-labelledby="hs-${id}">
    <div class="section-head">
      <div><h2 class="section-title" id="hs-${id}">${esc(title)}</h2>${sub ? `<p class="section-sub">${esc(sub)}</p>` : ""}</div>
      ${see && list.length > 2 ? `<button type="button" class="see-all" data-see="${see}" aria-label="${esc(t("Tout voir : {x}", { x: title }))}">${svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', 24)}</button>` : ""}
    </div>
    ${list.length ? `<div class="carousel">${list.slice(0, 12).map(rcard).join("")}</div>` : empty}
  </section>`;
}
function renderHome(rows) {
  renderDaily(rows);
  const ranked = rankRows(rows);
  const ready = ranked.filter(isReady), almost = ranked.filter(x => rowState(x) === "almost");
  const urgentRows = ranked.filter(x => urgentUsed(x.r).length && rowState(x) !== "later");
  const season = ranked.filter(x => SEASON.has(x.r.id) && x.a.equipOk);
  const cheap = ranked.filter(x => costOf(x.r) < 1 && x.a.equipOk);
  const mineRows = ranked.filter(x => x.r.mine);
  const emptyReady = `<a class="empty home-empty" href="#frigo">${t("Aucune recette complète pour l'instant.")} <strong>${t("Coche ce que tu as dans Mon frigo")}</strong></a>`;
  $("home-sections").innerHTML = [
    homeSection("ready", t("Ce soir avec ton colis"), t("Tu as tout ce qu'il faut"), ready, "pret", emptyReady),
    homeSection("urgent", t("À finir vite"), t("Ces recettes utilisent ce qui va bientôt périmer"), urgentRows, "urgent"),
    homeSection("almost", t("Il ne te manque qu'un ingrédient"), "", almost, "presque"),
    homeSection("season", t("De saison"), t(SEASON_NAMES[currentSeason()]), season, "saison"),
    homeSection("cheap", t("Moins de 1 € la portion"), t("Prix moyens en supermarché ; avec un colis, c'est gratuit"), cheap, "moins1"),
    homeSection("mine", t("Mes recettes"), "", mineRows, "mine")
  ].join("");
}
function setupHome() {
  renderCats();
  $("cats").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    setFilters([b.dataset.cat], true);
    track("categorie/" + b.dataset.cat, "Catégorie");
    location.hash = "#recherche";
  });
  $("home-sections").addEventListener("click", e => {
    const b = e.target.closest("[data-see]");
    if (!b) return;
    setFilters([b.dataset.see], true);
    location.hash = "#recherche";
  });
  /* Points du carrousel « Recette du jour » */
  const track_ = $("daily-track");
  track_.addEventListener("scroll", () => {
    const k = Math.round(track_.scrollLeft / Math.max(1, track_.clientWidth));
    $("daily-dots").querySelectorAll("span").forEach((d, j) => d.classList.toggle("on", j === k));
  }, { passive: true });
  $("fridge-bar").addEventListener("click", () => setFilters(["pret"], true));
}

/* ---------- Recherche ---------- */

const THEMES = [
  ["budget", "Étudiant fauché", "Pâtes au fromage express"],
  ["vege", "Végétarien", "Curry express de légumineuses"],
  ["froid", "Sans cuisson", "Salade express sans cuisson"],
  ["rapide", "Express : 10 min", "Omelette en tasse au micro-ondes"],
  ["micro", "Au micro-ondes", "Bol de riz au micro-ondes"],
  ["sucre", "Envie de sucré", "Crêpes"],
  ["prot", "Plein de protéines", "Poulet au curry"],
  ["pret", "Avec ce que j'ai", "Riz sauté vide-frigo"]
];
function renderThemes() {
  $("theme-grid").innerHTML = THEMES.map(([id, label, title]) => {
    const r = BASE.find(x => x.id === title);
    const photo = r ? photoOf("recettes", slug(r.id)) : null;
    return `<button type="button" class="theme" data-theme="${id}">${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy">` : r ? artHtml(r) : ""}<span>${esc(t(label))}</span></button>`;
  }).join("");
}
function renderSearch(rows, hiddenByRegime) {
  const active = searchShown || filters.size > 0 || !!recipeQuery;
  $("search-home").hidden = active;
  $("search-results").hidden = !active;
  $("filters").querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(filters.has(b.dataset.filter))));
  if (!active) return;
  const shown = rankRows(rows.filter(matchesFilters));
  const labels = [...filters].map(filterLabel);
  if (recipeQuery) labels.unshift(`« ${$("recipe-search").value.trim()} »`);
  $("filter-text").textContent = plural(shown.length, "1 recette", "{n} recettes") + (labels.length ? " · " + labels.join(", ") : "");
  $("regime-note").hidden = hiddenByRegime === 0;
  $("regime-note").textContent = hiddenByRegime === 1
    ? t("1 recette est cachée parce qu'elle ne correspond pas à ton régime.")
    : t("{n} recettes sont cachées parce qu'elles ne correspondent pas à ton régime.", { n: hiddenByRegime });
  if (!shown.length) {
    $("list").innerHTML = `<div class="empty-state">${emptyArt('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>')}<p>${t("Aucune recette ne correspond à ces filtres. Enlève un filtre ou change ta recherche.")}</p></div>`;
    return;
  }
  const parts = [["ready", t("Tu as tout ce qu'il faut")], ["almost", t("Il ne te manque qu'un ingrédient")], ["later", t("Pour plus tard")]];
  const several = new Set(shown.map(rowState)).size > 1;
  $("list").innerHTML = parts.map(([st, title]) => {
    const list = shown.filter(x => rowState(x) === st);
    return list.length ? (several ? `<p class="later-title">${esc(title)}</p>` : "") + list.map(rcard).join("") : "";
  }).join("");
}
function setupSearch() {
  renderFilters(); renderRefine(); renderThemes();
  $("filters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    const id = b.dataset.filter;
    if (filters.has(id)) filters.delete(id); else filters.add(id);
    searchShown = filters.size > 0 || !!recipeQuery;
    renderRefine(); renderResults();
  });
  $("refine").addEventListener("change", e => {
    const id = e.target.dataset.filter;
    if (!id) return;
    if (e.target.checked) filters.add(id); else filters.delete(id);
    const acc = e.target.closest(".acc");
    const n = acc.querySelectorAll("input:checked").length;
    const old = acc.querySelector(".acc-n");
    if (old) old.remove();
    if (n) acc.querySelector("summary span").insertAdjacentHTML("afterend", `<span class="acc-n">${n}</span>`);
    renderFilters();
  });
  $("refine-go").addEventListener("click", () => { searchShown = true; renderResults(); window.scrollTo(0, 0); });
  $("refine-reset").addEventListener("click", () => { setFilters([], false); renderResults(); });
  $("filter-clear").addEventListener("click", () => { setFilters([], false); renderResults(); });
  $("theme-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-theme]");
    if (!b) return;
    setFilters([b.dataset.theme], true);
    track("theme/" + b.dataset.theme, "Thème de recherche");
    renderResults(); window.scrollTo(0, 0);
  });
  $("recipe-search").addEventListener("input", e => {
    recipeQuery = norm(e.target.value.trim());
    if (!recipeQuery && !filters.size) searchShown = false;
    renderResults();
  });
}

/* ---------- Carnet : favoris, mes recettes, mes notes ---------- */

let bookTab = "favs";
let notes = {};             // notes personnelles : identifiant de recette -> texte
const emptyArt = path => `<span class="empty-art">${svg(path, 92).replace('stroke-width="2.2"', 'stroke-width="1.5"')}</span>`;
function renderBook(rows) {
  const favRows = rankRows(rows.filter(x => favs.has(x.r.id)));
  const mineRows = rankRows(rows.filter(x => x.r.mine));
  const noteRows = rows.filter(x => (notes[x.r.id] || "").trim());
  $("view-favs-count").textContent = favRows.length;
  $("view-mine-count").textContent = mineRows.length;
  $("view-notes-count").textContent = noteRows.length;
  ["favs", "mine", "notes"].forEach(v => { $("book-" + v).checked = bookTab === v; });
  let html = "";
  if (bookTab === "favs") {
    html = favRows.length ? `<div class="tile-grid">${favRows.map(rcard).join("")}</div>`
      : `<div class="empty-state">${emptyArt(ICON.star)}<p>${t("Tu n'as pas encore de favoris. Touche l'étoile d'une recette pour la garder ici.")}</p>
         <a class="btn btn-brand btn-pill" href="#accueil">${t("Découvrir des recettes")}</a></div>`;
  }
  if (bookTab === "mine") {
    html = mineRows.length
      ? `<button type="button" class="btn btn-brand btn-pill" data-create>${svg(ICON.plus)} ${t("Créer ma recette")}</button><div class="tile-grid">${mineRows.map(rcard).join("")}</div>`
      : `<div class="empty-state">${emptyArt(ICON.edit)}<p>${t("Tu n'as pas encore créé de recette. Ta recette de famille, une astuce de colocataire : ajoute-la, elle apparaîtra ici avec les autres.")}</p>
         <button type="button" class="btn btn-brand btn-pill" data-create>${t("Créer ma recette")}</button></div>`;
  }
  if (bookTab === "notes") {
    html = noteRows.length
      ? noteRows.map(x => `<a class="note-item" href="${recipeHref(x.r)}"><strong>${esc(x.r.title)}</strong><span>${esc(notes[x.r.id])}</span></a>`).join("")
      : `<div class="empty-state">${emptyArt('<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h5"/>')}<p>${t("Pas encore de note. Dans une recette, écris ton astuce ou ce que tu changerais : elle sera gardée ici.")}</p>
         <a class="btn btn-brand btn-pill" href="#accueil">${t("Découvrir des recettes")}</a></div>`;
  }
  $("book-body").innerHTML = html;
}
function setupBook() {
  const saved = readJSON(KEYS.notes);
  if (saved && typeof saved === "object") notes = saved;
  document.querySelectorAll('input[name="book"]').forEach(r => r.addEventListener("change", () => { bookTab = r.value; renderResults(); }));
}

/* ---------- Tout l'affichage dépend d'ici ---------- */

let lastCount = null;
function renderResults() {
  const { rows, hidden } = computeRows();
  const n = rows.filter(isReady).length;
  $("count").textContent = n;
  $("count-text").textContent = n === 1 ? t("recette possible tout de suite avec ce que tu as.") : t("recettes possibles tout de suite avec ce que tu as.");
  $("fridge-count").textContent = n;
  $("fridge-count-text").textContent = n === 1 ? t("recette possible") : t("recettes possibles");
  $("tab-count").textContent = n;
  $("tab-count").hidden = n === 0;
  if (lastCount !== null && n !== lastCount) { const b = $("fridge-bar"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  lastCount = n;
  renderHome(rows);
  renderSearch(rows, hidden);
  renderBook(rows);
  if (screenNow === "recette") renderRecipePage();
}

/* ---------- Page recette en plein écran ---------- */

let recipeNow = -1;
const checked = new Map(); // ingrédients cochés pendant la préparation (pas gardés)
const currentRecipe = i => adapt(RECIPES[i], excluded());
function renderRecipePage() {
  const i = recipeNow, base = RECIPES[i];
  if (!base) return;
  const r = currentRecipe(i), a = analyse(r), x = { r, a, i };
  const c = COLORS[r.color] || COLORS.nuit;
  const photo = recipePhoto(r), fav = favs.has(r.id), nut = nutrition(r), cost = costOf(r);
  const done = checked.get(r.id) || new Set();
  const urg = urgentUsed(r);
  const ings = r.need.map((opts, k) => {
    const ok = opts.some(o => have.has(o));
    return `<li class="check-item ${ok ? "" : "is-missing"}"><label><input type="checkbox" data-check="${k}" ${done.has(k) ? "checked" : ""}><span>${esc(needLabel(opts))}</span>${ok ? "" : `<span class="miss-tag">${t("À trouver")}</span>`}</label></li>`;
  }).join("");
  const extras = r.extra.filter(id => have.has(id)).map(lower);
  const scaled = stepsOf(r);
  const factor = recipeFactor(r);
  const notesTxt = [];
  if (r.portions === 1 && portions > 1) notesTxt.push(t("Recette pour 1 personne : prépare-la {n} fois.", { n: portions }));
  const usesCan = r.steps.some(s => /boîte|\btin\b|\bcan\b|\blata\b/.test(s));
  if (usesCan && factor < 1) notesTxt.push(t("Pour 1 personne, utilise une demi-boîte et garde le reste au frigo dans un bol fermé, 2 à 3 jours."));
  if (usesCan && factor > 1) notesTxt.push(factor >= 3 ? t("Pour {n} personnes, prends 3 boîtes.", { n: portions }) : t("Pour {n} personnes, prends 2 boîtes.", { n: portions }));
  if (scaled.some(s => s.includes("(≈"))) notesTxt.push(t("Repères : un verre = un verre à eau (20 cl), une poignée = ce que tient ta main."));
  $("recipe-page").innerHTML = `
    <div class="rp-hero">
      ${photo ? `<img src="${esc(photo.src)}" alt="${esc(r.title)}">` : artHtml(r)}
      <div class="rp-top">
        <button type="button" class="round-btn" data-action="back" aria-label="${esc(t("Retour"))}">${svg('<path d="M15 5l-7 7 7 7"/>', 24)}</button>
        <div>
          <button type="button" class="round-btn" data-action="fav" aria-pressed="${fav}" aria-label="${esc(fav ? t("Dans mes favoris") : t("Ajouter à mes favoris"))}">${svg(ICON.star, 22)}</button>
          <button type="button" class="round-btn" data-action="share" aria-label="${esc(t("Partager"))}">${svg(ICON.share, 22)}</button>
        </div>
      </div>
    </div>
    <div class="rp-card">
      <div class="rp-badges">${r.mine ? `<span class="pill mine">${t("Ma recette")}</span>` : ""}${stateBadge(x, "")}${urg.length ? `<span class="pill urgent">${t("À finir vite :")} ${esc(urg.map(lower).join(", "))}</span>` : ""}${nut.prot >= 20 ? `<span class="pill prot">${t("Riche en protéines")}</span>` : ""}</div>
      <h1 class="rp-title" id="rp-title" tabindex="-1">${esc(r.title)}</h1>
      <div class="rp-facts">
        <div class="rp-fact">${svg(ICON.clock, 22)}<b>${r.time} min</b>${t("Temps")}</div>
        <div class="rp-fact">${svg(toolArt(r.tool), 22)}<b>${esc(r.tool)}</b>${t("Ustensile")}</div>
        <div class="rp-fact">${svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7 11h6M7 13.5h6"/>', 22)}<b>≈ ${fmtEuros(cost)}</b>${t("la portion")}</div>
      </div>
      <div class="stepper" role="group" aria-label="${esc(t("Je cuisine pour"))}">
        <button type="button" data-action="less" aria-label="${esc(t("Une personne de moins"))}" ${portions <= 1 ? "disabled" : ""}>−</button>
        <output aria-live="polite">${esc(plural(portions, "Pour 1 personne", "Pour {n} personnes"))}</output>
        <button type="button" data-action="more" aria-label="${esc(t("Une personne de plus"))}" ${portions >= 8 ? "disabled" : ""}>+</button>
      </div>
      <button type="button" class="btn btn-brand rp-start" data-action="cook">${svg(ICON.cook)} ${t("Commencer pas à pas")}</button>
      <section class="rp-section" aria-labelledby="rp-ings">
        <h2 class="rp-h" id="rp-ings">${t("Ingrédients")}</h2>
        <ul class="checklist">${ings}</ul>
        ${extras.length ? `<p class="note">${t("Tu peux aussi ajouter :")} ${esc(extras.join(", "))}.</p>` : ""}
        ${a.missing.length ? `<button type="button" class="btn btn-soft" data-action="shop">${svg(ICON.cart)} <span data-label>${t("Ajouter ce qui manque à ma liste")}</span></button>` : ""}
      </section>
      <section class="rp-section" aria-labelledby="rp-steps">
        <h2 class="rp-h" id="rp-steps">${t("Préparation")}</h2>
        <ol class="steps-list">${scaled.map((s, n) => `<li><b aria-hidden="true">${n + 1}</b><span>${esc(s)}</span></li>`).join("")}</ol>
        ${notesTxt.map(n => `<p class="note">${esc(n)}</p>`).join("")}
      </section>
      ${r.swap ? `<p class="tip-box"><strong>${t("Selon ton colis :")}</strong> ${esc(r.swap)}</p>` : ""}
      <section class="rp-section my-note-wrap" aria-labelledby="rp-note">
        <h2 class="rp-h" id="rp-note"><label for="my-note">${t("Ma note")}</label></h2>
        <textarea class="field my-note" id="my-note" rows="3" maxlength="600" placeholder="${esc(t("Ton astuce, ce que tu changerais la prochaine fois…"))}">${esc(notes[r.id] || "")}</textarea>
        <p class="note-saved" id="note-saved" aria-live="polite"></p>
      </section>
      <section class="rp-section" aria-labelledby="rp-nutri">
        <h2 class="rp-h" id="rp-nutri">${t("Valeurs nutritionnelles")}</h2>
        <div class="nutri">
          <span class="nutri-item"><b>${nut.kcal}</b> kcal</span>
          <span class="nutri-item"><b>${nut.prot} g</b> ${t("protéines")}</span>
          <span class="nutri-item"><b>${nut.gluc} g</b> ${t("glucides")}</span>
          <span class="nutri-item"><b>${nut.lip} g</b> ${t("lipides")}</span>
          <p class="nutri-note">${t(NUTRI_NOTE)}</p>
        </div>
      </section>
      <div class="rp-actions">
        <button type="button" class="btn btn-sec" data-action="photo">${svg(ICON.camera)} <span>${photo && photo.mine ? t("Changer ma photo") : t("Photo de mon plat")}</span></button>
        <button type="button" class="btn btn-sec" data-action="print">${svg(ICON.print)} ${t("Imprimer")}</button>
        ${r.mine ? `<button type="button" class="btn btn-sec" data-action="edit">${svg(ICON.edit)} ${t("Modifier")}</button>
        <button type="button" class="btn btn-sec" data-action="delete">${svg(ICON.trash)} ${t("Supprimer")}</button>` : ""}
      </div>
      ${photo && photo.mine ? `<p class="rp-photo-credit">${t("Ta photo")} · <button type="button" class="link-btn" data-action="unphoto">${t("Retirer ma photo")}</button></p>`
        : photo && photo.credit ? `<p class="rp-photo-credit">${t("Photo :")} ${esc(photo.credit)}</p>` : ""}
      <p class="print-only print-foot">${t("Recette trouvée avec « Qu'est-ce que je cuisine avec mon colis ? » :")} ${esc(appUrl())}</p>
    </div>`;
  document.documentElement.style.setProperty("--recipe-accent", c.bar);
}
let noteTimer = null;
function setupRecipePage() {
  const page = $("recipe-page");
  page.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const i = recipeNow, r = currentRecipe(i), act = btn.dataset.action;
    if (act === "back") goBack();
    if (act === "cook") openCook(r);
    if (act === "share") shareRecipe(r, btn);
    if (act === "fav") toggleFav(r);
    if (act === "print") printRecipe(i);
    if (act === "shop") addMissingToShop(r, analyse(r));
    if (act === "edit") openCreate(RECIPES[i]);
    if (act === "delete") deleteMine(RECIPES[i]);
    if (act === "photo") pickPhoto(r.id);
    if (act === "unphoto") { delete myPhotos[r.id]; savePhotos(); renderResults(); }
    if (act === "less" || act === "more") {
      portions = Math.max(1, Math.min(8, portions + (act === "more" ? 1 : -1)));
      writeJSON(KEYS.portions, portions);
      syncPortionRadios();
      renderRecipePage();
      const again = page.querySelector(`[data-action="${act}"]`);
      if (again && !again.disabled) again.focus();
    }
  });
  page.addEventListener("change", e => {
    const k = e.target.dataset.check;
    if (k == null) return;
    const id = RECIPES[recipeNow].id;
    const set = checked.get(id) || new Set();
    if (e.target.checked) set.add(Number(k)); else set.delete(Number(k));
    checked.set(id, set);
  });
  page.addEventListener("input", e => {
    if (e.target.id !== "my-note") return;
    const id = RECIPES[recipeNow].id, v = e.target.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      if (v.trim()) notes[id] = v; else delete notes[id];
      writeJSON(KEYS.notes, notes);
      const s = $("note-saved"); if (s) s.textContent = t("Note enregistrée sur ce téléphone");
      const { rows } = computeRows(); renderBook(rows);
    }, 500);
  });
}

/* ---------- Navigation entre les écrans ---------- */

const SCREENS = ["accueil", "recherche", "frigo", "carnet", "profil"];
let screenNow = null;
let navDepth = 0;           // nombre de pages ouvertes dans l'appli : le bouton retour revient en arrière si possible
const scrollMem = {};
function goBack() {
  if (navDepth > 0) window.history.back(); else location.hash = "#accueil";
}
function route(initial) {
  const h = decodeURIComponent(location.hash.slice(1));
  let name = h || "accueil";
  if (h.startsWith("recette/")) {
    const i = RECIPES.findIndex(r => slug(r.id) === h.slice(8));
    if (i >= 0) { name = "recette"; recipeNow = i; } else name = "accueil";
  } else if (!SCREENS.includes(name)) {
    if (!initial) return; // un lien interne (ex. « Aller au contenu ») : on reste sur l'écran
    name = "accueil";
  }
  if (screenNow && screenNow !== "recette") scrollMem[screenNow] = window.scrollY;
  document.querySelectorAll(".screen").forEach(sc => { sc.hidden = sc.dataset.screen !== name; });
  document.body.classList.toggle("on-recipe", name === "recette");
  document.querySelectorAll("[data-tab]").forEach(a => {
    if (a.dataset.tab === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  screenNow = name;
  if (!initial && (name === "recherche" || name === "carnet")) renderResults(); // filtres choisis ailleurs (catégorie, « tout voir »)
  if (name === "recette") {
    renderRecipePage();
    window.scrollTo(0, 0);
    track("recette/" + slug(RECIPES[recipeNow].id), "Recette ouverte");
  } else {
    window.scrollTo(0, scrollMem[name] || 0);
  }
  if (!initial) {
    const head = name === "recette" ? $("rp-title") : document.querySelector(`#screen-${name} h1`);
    if (head) { if (!head.hasAttribute("tabindex")) head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
  }
}
function syncPortionRadios() {
  document.querySelectorAll('input[name="portions"]').forEach(r => { r.checked = Number(r.value) === portions; });
}

/* ---------- Une idée au hasard ---------- */

let startHash = "";        // écran d'arrivée imposé par un lien (ex. recette partagée -> carnet)
let lastRandom = null;
function randomRecipe() {
  const { rows } = computeRows();
  let pool = rows.filter(isReady);
  if (!pool.length) pool = rows.filter(x => x.a.equipOk && x.a.missing.length === 1);
  if (!pool.length) pool = rows;
  if (!pool.length) return;
  if (pool.length > 1) pool = pool.filter(x => x.i !== lastRandom);
  const pickRow = pool[Math.floor(Math.random() * pool.length)];
  lastRandom = pickRow.i;
  track("hasard", "Une idée au hasard");
  location.hash = recipeHref(pickRow.r);
}

/* ---------- Partager une recette ---------- */

function recipeText(r) {
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  return [
    `${r.title}`,
    `${r.time} min · ${r.tool} · ${portionLabel(r)}`,
    "",
    t("Il faut :"),
    ...r.need.map(opts => `- ${needLabel(opts)}`),
    ...(extras.length ? [`${t("En plus si tu as :")} ${extras.join(", ")}`] : []),
    "",
    t("Étapes :"),
    ...stepsOf(r).map((s, n) => `${n + 1}. ${s}`),
    "",
    ...(r.swap ? [`${t("Selon ton colis :")} ${r.swap}`, ""] : []),
    ...(r.mine ? [t("Pour ajouter cette recette dans ton appli, ouvre ce lien :"), recipeLink(r), ""] : []),
    `${t("Trouvé avec « Qu'est-ce que je cuisine avec mon colis ? » :")} ${appUrl()}`
  ].join("\n");
}

function shareRecipe(r, btn) {
  track("partage/" + slug(r.id), "Partage : " + r.id);
  shareText(r.title, recipeText(r), btn);
}

/* ---------- Favoris ---------- */

function toggleFav(r) {
  if (favs.has(r.id)) favs.delete(r.id);
  else { favs.add(r.id); track("favori/" + slug(r.id), "Favori : " + r.id); }
  saveFavs();
  renderResults();
}

/* ---------- Liste de courses ---------- */

function updateShopBadge() {
  const n = shop.filter(x => !x.done).length;
  document.querySelectorAll("[data-shop-badge]").forEach(b => { b.textContent = n; b.hidden = n === 0; });
  $("drawer-shop-count").textContent = n;
}

function addMissingToShop(r, a, quiet) {
  let added = 0;
  a.missing.forEach(opts => {
    const id = opts[0];
    if (shop.some(x => x.id === id && !x.done)) return;
    const others = opts.slice(1, 3).map(lower);
    shop.push({ id, label: NAMES[id] + (others.length ? ` (${t("ou")} ${others.join(", ")})` : ""), from: r.title, done: false });
    added++;
  });
  saveShop(); updateShopBadge();
  track("courses/ajout", "Ajout à la liste de courses");
  if (quiet) return added;
  toast(added ? plural(added, "1 ingrédient ajouté à ta liste de courses", "{n} ingrédients ajoutés à ta liste de courses") : t("C'est déjà dans ta liste de courses"));
}

function renderShop() {
  const list = $("shop-list");
  list.innerHTML = shop.map((x, k) => `
    <li class="shop-item ${x.done ? "done" : ""}">
      <label><input type="checkbox" data-k="${k}" ${x.done ? "checked" : ""}>
        <span>${esc(x.label)}${x.from ? `<small class="from">${t("Pour :")} ${esc(x.from)}</small>` : ""}</span></label>
      <button type="button" class="icon-btn" data-del="${k}" aria-label="${esc(t("Retirer {x} de la liste", { x: x.label }))}">${svg(ICON.trash)}</button>
    </li>`).join("");
  $("shop-empty").hidden = shop.length > 0;
  $("shop-actions").hidden = shop.length === 0;
  $("shop-store").disabled = !shop.some(x => x.done);
  updateShopBadge();
}

function openShop() {
  renderShop();
  openDialog($("shop"));
}

function setupShop() {
  $("shop-list").addEventListener("change", e => {
    const k = e.target.dataset.k;
    if (k == null) return;
    shop[Number(k)].done = e.target.checked;
    saveShop(); renderShop();
  });
  $("shop-list").addEventListener("click", e => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    shop.splice(Number(b.dataset.del), 1);
    saveShop(); renderShop();
  });
  $("shop-form").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("shop-input").value.trim();
    if (!v) return;
    const known = [...INGREDIENTS].find(id => norm(NAMES[id]) === norm(v));
    shop.push({ id: known || null, label: known ? NAMES[known] : v, from: null, done: false });
    $("shop-input").value = "";
    saveShop(); renderShop();
  });
  $("shop-store").addEventListener("click", () => {
    const bought = shop.filter(x => x.done);
    bought.forEach(x => { if (x.id) have.add(x.id); });
    shop = shop.filter(x => !x.done);
    saveShop(); renderShop(); haveChanged();
    toast(plural(bought.length, "1 achat rangé dans tes ingrédients", "{n} achats rangés dans tes ingrédients"));
  });
  $("shop-share").addEventListener("click", e => {
    const todo = shop.filter(x => !x.done);
    const items = todo.map(x => `- ${x.label}`);
    shareText(t("Ma liste de courses"), [t("Ma liste de courses") + " :", ...items, "",
      t("Pour ajouter cette liste dans ton appli (colocation, famille), ouvre ce lien :"), shopLink(todo)].join("\n"), e.currentTarget);
  });
  $("shop-clear").addEventListener("click", () => {
    if (!window.confirm(t("Vider toute la liste de courses ?"))) return;
    shop = []; saveShop(); renderShop();
  });
}

/* ---------- Les bases de la cuisine ---------- */

function openBasics() {
  $("basics-list").innerHTML = BASICS.map((b, k) => `
    <details class="basic">
      <summary><span>${esc(b.titre)}</span>${svg(ICON.chevron)}</summary>
      <ol>${b.etapes.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    </details>`).join("");
  openDialog($("basics"));
  track("bases", "Les bases de la cuisine");
}

/* ---------- Conservation ---------- */

function openTips() {
  const mine = t => (t.ids || []).some(id => have.has(id));
  const sorted = TIPS.slice().sort((a, b) => Number(mine(b)) - Number(mine(a)));
  $("tips").innerHTML = sorted.map(tip => `
    <article class="tip">
      <h3>${esc(tip.titre)}${mine(tip) ? `<span class="tag">${t("Tu en as")}</span>` : ""}</h3>
      <p>${esc(tip.texte)}</p>
    </article>`).join("");
  openDialog($("keep"));
  track("conservation", "Conseils de conservation");
}

/* ---------- Imprimer une recette ---------- */

function printRecipe(i) {
  track("imprime/" + slug(RECIPES[i].title), "Impression : " + RECIPES[i].title);
  if (screenNow !== "recette" || recipeNow !== i) { location.hash = recipeHref(RECIPES[i]); setTimeout(() => window.print(), 300); return; }
  window.print();
}

/* ---------- Scanner de code-barres ---------- */

const scan = { stream: null, track: null, loop: null, last: "", lastAt: 0, frame: 0, canvas: null, decode: null };

function scanStatus(text) { $("scan-status").textContent = text; }

function matchProduct(p) {
  const tags = p.categories_tags || [];
  for (const [id, cats] of OFF) if (cats.some(c => tags.includes(c))) return id;
  const name = norm([p.product_name_fr, p.product_name, p.generic_name_fr].filter(Boolean).join(" "));
  for (const [id, , words] of OFF) if ((words || []).some(w => name.includes(norm(w)))) return id;
  return null;
}

/* Photo du produit fournie par Open Food Facts (licence libre). On n'accepte que leurs adresses d'images. */
function productImage(p) {
  const url = p && (p.image_front_small_url || p.image_small_url || p.image_front_url || "");
  return /^https:\/\/(images|static)\.openfoodfacts\.org\//.test(url) ? url : "";
}

function addFound(ok, title, detail, img) {
  const li = document.createElement("li");
  const pic = img
    ? `<img class="scan-pic" src="${esc(img)}" alt="" width="64" height="64" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="scan-pic scan-pic-empty" aria-hidden="true">${ok ? "✓" : "?"}</span>`;
  li.innerHTML = `${pic}<span class="scan-txt"><span class="${ok ? "ok" : "ko"}">${ok && img ? "✓ " : ""}${esc(title)}</span>${detail ? `<small>${esc(detail)}</small>` : ""}</span>`;
  const im = li.querySelector("img");
  if (im) im.addEventListener("error", () => { im.replaceWith(Object.assign(document.createElement("span"), { className: "scan-pic scan-pic-empty", textContent: ok ? "✓" : "?" })); });
  $("scan-found").prepend(li);
}

async function lookupCode(code) {
  code = String(code).replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(code)) { scanStatus(t("Ce code ne ressemble pas à un code-barres (8 à 14 chiffres).")); return; }
  scanStatus(t("Recherche du produit…"));
  let product = null;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_fr,generic_name_fr,brands,categories_tags,image_front_small_url,image_small_url`);
    const j = await res.json();
    if (j && j.status === 1 && j.product) product = j.product;
  } catch (err) {
    scanStatus(t("Pas de connexion : impossible de reconnaître le produit pour l'instant."));
    return;
  }
  const name = product ? (product.product_name_fr || product.product_name || t("Produit sans nom")) : "";
  const brand = product && product.brands ? product.brands.split(",")[0].trim() : "";
  const id = product ? matchProduct(product) : null;
  if (id) {
    const already = have.has(id);
    have.add(id);
    haveChanged();
    addFound(true, `${NAMES[id]} ${already ? t("(déjà coché)") : t("coché")}`, [name, brand].filter(Boolean).join(" · "), productImage(product));
    scanStatus(t(already ? "{name} : déjà dans tes ingrédients. Scanne le suivant !" : "{name} : ajouté à tes ingrédients. Scanne le suivant !", { name: NAMES[id] }));
    track("scan/reconnu", "Scan reconnu");
  } else if (product) {
    addFound(false, name, t("On ne sait pas encore à quel ingrédient il correspond : coche-le à la main."), productImage(product));
    scanStatus(t("Produit trouvé, mais pas reconnu."));
    track("scan/non-reconnu", "Scan non reconnu");
  } else {
    addFound(false, `${t("Code")} ${code}`, t("Produit inconnu d'Open Food Facts : coche-le à la main."));
    scanStatus(t("Produit inconnu."));
    track("scan/inconnu", "Scan inconnu");
  }
}

function onCode(code) {
  const now = Date.now();
  if (code === scan.last && now - scan.lastAt < 4000) return; // même produit encore devant la caméra
  scan.last = code; scan.lastAt = now;
  if (navigator.vibrate) navigator.vibrate(60);
  lookupCode(code);
}

/* Somme de contrôle des codes EAN-8, EAN-13 et UPC-A : écarte les lectures ratées. */
function validCode(code) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = code.split("").map(Number), check = d.pop();
  const sum = d.reverse().reduce((acc, n, k) => acc + n * (k % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/* Prépare la fonction qui lit un code-barres dans une image : lecteur du téléphone si possible, sinon ZXing. */
async function makeDecoder() {
  let formats = [];
  if ("BarcodeDetector" in window) formats = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
  if (formats.includes("ean_13")) {
    const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"].filter(f => formats.includes(f)) });
    return async canvas => {
      const codes = await detector.detect(canvas);
      return codes.length ? codes[0].rawValue : null;
    };
  }
  if (!window.ZXing) await loadScript("lib/zxing.min.js?v=18");
  const Z = window.ZXing;
  const reader = new Z.MultiFormatReader();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return async canvas => {
    const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
    /* Deux façons de séparer les barres du fond : l'une marche mieux sur les images nettes, l'autre sur les floues. */
    for (const Binarizer of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
      try { return reader.decodeWithState(new Z.BinaryBitmap(new Binarizer(source))).getText(); }
      catch (err) { /* rien trouvé avec cette méthode */ }
    }
    return null;
  };
}

/* Accentue les bords des barres (masque flou horizontal) et pousse le contraste.
   Testé : rend lisibles les codes-barres un peu flous, fréquents quand le téléphone fait mal la mise au point de près. */
function sharpenBars(canvas, amount, radius) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const lum = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  const n = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += lum[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      out[row + x] = lum[row + x] + amount * (lum[row + x] - acc / n);
      acc += lum[row + Math.min(w - 1, x + radius + 1)] - lum[row + Math.max(0, x - radius)];
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < out.length; i += 7) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, (out[i] - lo) * 255 / span));
    d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/* Traitements essayés à tour de rôle, une image sur quatre chacun :
   la zone du cadre telle quelle, puis accentuée, une zone plus serrée accentuée (petits codes), puis l'image entière. */
const PASSES = [
  { w: 0.8, h: 0.4, sharpen: 0 },
  { w: 0.8, h: 0.4, sharpen: 2 },
  { w: 0.5, h: 0.25, sharpen: 3 },
  { w: 1, h: 1, sharpen: 0 }
];

async function scanFrame() {
  const video = $("scan-video");
  if (!scan.stream || !scan.decode) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (vw && vh) {
    const pass = PASSES[scan.frame++ % PASSES.length];
    const sw = Math.round(vw * pass.w), sh = Math.round(vh * pass.h);
    const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
    /* Petite image (caméra en basse définition) : on l'agrandit 2 fois, sinon on la garde telle quelle. */
    const k = pass.w < 1 && sw < 600 ? 2 : (pass.w === 1 && sw > 1920 ? 1920 / sw : 1);
    const c = scan.canvas;
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = k !== 1;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
    try {
      if (pass.sharpen) sharpenBars(c, pass.sharpen, Math.max(2, Math.round(2 * k)));
      const code = await scan.decode(c);
      if (code && validCode(code)) onCode(code);
    } catch (err) { /* image suivante */ }
  }
  if (scan.stream) scan.loop = setTimeout(scanFrame, 80);
}

/* Zoom et lampe, quand le téléphone les propose (surtout Android). */
function setupCameraControls() {
  const box = $("scan-controls");
  box.innerHTML = "";
  const track = scan.track;
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  if (caps.focusMode && caps.focusMode.includes("continuous")) {
    track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
  }
  let html = "";
  if (caps.zoom && caps.zoom.max > 1) {
    const levels = [1, 2, 3].filter(z => z >= caps.zoom.min && z <= caps.zoom.max);
    if (caps.zoom.max > 3 && caps.zoom.max < 4) levels.push(Math.floor(caps.zoom.max * 10) / 10);
    html += `<div class="zoom" role="group" aria-label="Zoom">${levels.map(z => `<button type="button" class="tab" data-zoom="${z}" aria-pressed="false">${z}×</button>`).join("")}</div>`;
  }
  if (caps.torch) html += `<button type="button" class="tab" id="scan-torch" aria-pressed="false">${t("Lampe")}</button>`;
  box.innerHTML = html;
  box.hidden = !html;
  const setZoom = z => {
    track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {});
    box.querySelectorAll("[data-zoom]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.zoom) === z)));
  };
  box.querySelectorAll("[data-zoom]").forEach(b => b.addEventListener("click", () => setZoom(Number(b.dataset.zoom))));
  /* Zoom 2× par défaut : on tient le téléphone plus loin, l'image est nette et le code reste assez grand. */
  if (caps.zoom && caps.zoom.max >= 2) setZoom(2);
  const torch = $("scan-torch");
  if (torch) torch.addEventListener("click", () => {
    const on = torch.getAttribute("aria-pressed") !== "true";
    track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
    torch.setAttribute("aria-pressed", String(on));
    torch.textContent = on ? t("Lampe allumée") : t("Lampe");
  });
}

async function startCamera() {
  const video = $("scan-video");
  $("scan-video-box").hidden = false;
  $("scan-controls").hidden = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $("scan-video-box").hidden = true;
    scanStatus(t("La caméra n'est pas disponible ici : tape le code-barres à la main."));
    return;
  }
  scanStatus(t("Ouverture de la caméra…"));
  try {
    scan.decode = await makeDecoder();
    if (!$("scan").hasAttribute("open")) return; // fermé pendant le chargement
    /* On demande une image en haute définition : avec l'image par défaut (souvent 640 × 480),
       les barres d'un petit code-barres ne font qu'un pixel et deviennent illisibles. */
    scan.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    if (!$("scan").hasAttribute("open")) { stopCamera(); return; }
    scan.track = scan.stream.getVideoTracks()[0];
    video.srcObject = scan.stream;
    await video.play();
    scan.canvas = scan.canvas || document.createElement("canvas");
    setupCameraControls();
    scanStatus(t("Vise un code-barres…"));
    scanFrame();
  } catch (err) {
    stopCamera();
    $("scan-video-box").hidden = true;
    scanStatus(err && err.name === "NotAllowedError"
      ? t("Tu as refusé l'accès à la caméra. Autorise-le dans les réglages du navigateur, ou tape le code-barres.")
      : t("Impossible d'ouvrir la caméra : tape le code-barres à la main."));
  }
}

function stopCamera() {
  clearTimeout(scan.loop);
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
  scan.track = null;
  const v = $("scan-video");
  if (v) v.srcObject = null;
  const box = $("scan-controls");
  if (box) box.hidden = true;
}

function openScan() {
  $("scan-found").innerHTML = "";
  scan.last = "";
  openDialog($("scan"));
  track("scan/ouvert", "Scanner ouvert");
  startCamera();
}

function setupScan() {
  $("scan-open").addEventListener("click", openScan);
  $("scan").addEventListener("close", stopCamera);
  $("scan-form").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("scan-input").value.trim();
    if (v) { lookupCode(v); $("scan-input").value = ""; }
  });
}

/* ---------- Mode cuisine ---------- */

const cook = { r: null, step: 0, wake: null, timer: null };

async function keepAwake() {
  if (!("wakeLock" in navigator)) return false;
  try { cook.wake = await navigator.wakeLock.request("screen"); return true; }
  catch (err) { return false; }
}
function releaseAwake() {
  if (cook.wake) { cook.wake.release().catch(() => {}); cook.wake = null; }
}

/* Durée trouvée dans le texte d'une étape : « 10 à 12 minutes » -> 10 min, « 30 secondes » -> 30 s. */
function stepDuration(text) {
  const m = text.match(/(\d+)\s*(?:(?:à|to|a)\s*\d+\s*)?(minutes?|minutos?|min\b|secondes?|seconds?|segundos?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const secs = /^s/i.test(m[2]) ? n : n * 60;
  return secs > 0 && secs <= 3600 ? secs : null;
}
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const durLabel = s => s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; // pareil en anglais

let audioCtx = null;
function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.4, 0.8].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.3);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.32);
    });
  } catch (err) { /* pas de son possible */ }
}

function startTimer(secs) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !audioCtx) audioCtx = new Ctx();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) { /* son indisponible */ }
  stopTimer();
  cook.timer = { end: Date.now() + secs * 1000, done: false, id: setInterval(tickTimer, 250) };
  tickTimer();
}
function stopTimer() {
  if (cook.timer) clearInterval(cook.timer.id);
  cook.timer = null;
  $("cook-timer").hidden = true;
  $("cook-timer").classList.remove("done");
}
function tickTimer() {
  const timer = cook.timer;
  if (!timer) return;
  const left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
  $("cook-timer").hidden = false;
  if (left > 0) {
    $("cook-timer-text").textContent = fmt(left);
    $("cook-timer-stop").textContent = t("Arrêter");
  } else if (!timer.done) {
    timer.done = true;
    clearInterval(timer.id);
    $("cook-timer").classList.add("done");
    $("cook-timer-text").textContent = t("C'est l'heure !");
    $("cook-timer-stop").textContent = "OK";
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
}

function renderCook() {
  const r = cook.r, c = COLORS[r.color] || COLORS.nuit, total = r.steps.length;
  const dlg = $("cook");
  dlg.style.setProperty("--accent", "var(--brand)");
  dlg.style.setProperty("--accent-tint", "var(--brand-tint)");
  $("cook-title").textContent = r.title;
  const finish = cook.step > total;
  $("cook-progress").textContent = cook.step === 0 ? t("Avant de commencer") : finish ? t("Bon appétit !") : t("Étape {a} sur {b}", { a: cook.step, b: total });
  $("cook-bar").innerHTML = Array.from({ length: total + 2 }, (_, n) => `<span class="${n <= cook.step ? "on" : ""}"></span>`).join("");
  if (cook.step === 0) {
    const extras = r.extra.filter(x => have.has(x)).map(lower);
    $("cook-step").innerHTML = `
      ${recipePhoto(r) ? `<img class="cook-photo" src="${esc(recipePhoto(r).src)}" alt="" loading="lazy">` : ""}
      <p class="cook-lead">${t("Sors tout ça :")}</p>
      <ul class="cook-ings">
        ${r.need.map(opts => `<li>${svg(ICON.check, 22)}<span>${esc(needLabel(opts))}</span></li>`).join("")}
        <li>${svg(ICON.check, 22)}<span>${esc(r.tool)}</span></li>
      </ul>
      ${extras.length ? `<p class="cook-extra">${t("Si tu veux :")} ${esc(extras.join(", "))}.</p>` : ""}`;
  } else if (finish) {
    const used = usedIngredients(r);
    const cans = likelyFinished(r);
    $("cook-step").innerHTML = `
      <p class="cook-lead">${t("Tu as fini un ingrédient ?")}</p>
      <p class="cook-extra">${t("Coche ce qu'il ne te reste plus : on le retire de tes ingrédients.")}${cans.size ? " " + t("Les boîtes utilisées sont déjà cochées : décoche-les s'il t'en reste.") : ""}</p>
      <div class="chips">${used.map(id => `<span class="chip"><input type="checkbox" id="fin-${esc(id)}" data-id="${esc(id)}" ${cans.has(id) ? "checked" : ""}><label for="fin-${esc(id)}">${esc(NAMES[id])}</label></span>`).join("")}</div>`;
  } else {
    const text = stepsOf(r)[cook.step - 1];
    const secs = stepDuration(text);
    $("cook-step").innerHTML = `<p class="cook-text">${esc(text)}</p>
      ${secs ? `<button type="button" class="btn btn-sec cook-timer-btn" data-secs="${secs}">${svg(ICON.timer)} ${t("Lancer un minuteur de {d}", { d: durLabel(secs) })}</button>` : ""}`;
  }
  $("cook-prev").disabled = cook.step === 0;
  $("cook-next").textContent = cook.step === 0 ? t("C'est parti") : finish ? t("J'ai cuisiné ça !") : cook.step === total ? t("Terminé !") : t("Étape suivante");
  if (cook.step > 0 && !finish) speak(stepsOf(r)[cook.step - 1]); else stopSpeaking();
}

/* Ingrédients qu'on a utilisés pour cette recette (ceux qu'on avait). */
function usedIngredients(r) {
  const ids = [];
  r.need.forEach(opts => { const id = opts.find(o => have.has(o)); if (id && !ids.includes(id)) ids.push(id); });
  r.extra.forEach(id => { if (have.has(id) && !ids.includes(id) && INGREDIENTS.has(id)) ids.push(id); });
  return ids.filter(id => INGREDIENTS.has(id));
}

/* Boîtes de conserve qu'une recette utilise en entier : on les propose comme finies.
   Pas quand la recette n'en prend que la moitié, ni quand on cuisine pour 1. */
function likelyFinished(r) {
  const cans = new Set((GROUPS.find(g => g.items.some(([id]) => id === "thon")) || { items: [] }).items.map(([id]) => id));
  const half = r.steps.some(s => /demi-boîte|half a tin|media lata/i.test(s));
  if (half || recipeFactor(r) < 1) return new Set();
  return new Set(usedIngredients(r).filter(id => cans.has(id)));
}

/* Fin de recette : on retire ce qui est fini et on compte le repas. */
function finishCooking() {
  const r = cook.r;
  const done = [...$("cook-step").querySelectorAll("input[data-id]:checked")].map(i => i.dataset.id);
  done.forEach(id => { have.delete(id); urgent.delete(id); });
  const people = r.portions === 1 ? 1 : portions;
  history.push({ id: r.id, date: new Date().toISOString().slice(0, 10), euros: Math.round(costOf(r) * people * 100) / 100 });
  writeJSON(KEYS.history, history.slice(-500));
  writeJSON(KEYS.urgent, [...urgent]);
  track("cuisine/termine", "Recette cuisinée");
  closeDialog($("cook"));
  haveChanged();
  const n = monthStats().meals;
  toast(plural(n, "Bravo ! 1er repas cuisiné ce mois-ci.", "Bravo ! {n} repas cuisinés ce mois-ci."));
}

/* ---------- Menu de la semaine ---------- */

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
let weekMenu = [];        // identifiants des recettes, un par jour
/* Recettes possibles pour un repas : faisables ou presque, pas les desserts, celles « à finir vite » d'abord. */
function menuCandidates() {
  const { rows } = computeRows();
  const ok = rows.filter(x => x.a.equipOk && x.a.missing.length <= 1 && !x.r.sucree);
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const score = x => (x.a.missing.length === 0 ? 0 : 10) - urgentUsed(x.r).length * 3;
  return shuffle(ok).sort((x, y) => score(x) - score(y));
}
const mainOf = r => pick(r.need[0]);
/* Choisit une recette en évitant de répéter le même ingrédient principal. */
function pickForMenu(cands, taken) {
  const usedMain = new Set(taken.map(id => { const r = RECIPES.find(x => x.id === id); return r ? mainOf(r) : null; }));
  return cands.find(x => !taken.includes(x.r.id) && !usedMain.has(mainOf(x.r))) || cands.find(x => !taken.includes(x.r.id));
}
function newMenu() {
  const cands = menuCandidates();
  weekMenu = [];
  DAYS.forEach(() => { const x = pickForMenu(cands, weekMenu); if (x) weekMenu.push(x.r.id); });
  writeJSON(KEYS.menu, weekMenu);
}
function changeDay(k) {
  const cands = menuCandidates();
  const others = weekMenu.filter((_, j) => j !== k);
  const pool = cands.filter(x => x.r.id !== weekMenu[k]);
  const x = pickForMenu(pool, others);
  if (x) weekMenu[k] = x.r.id;
  writeJSON(KEYS.menu, weekMenu);
  renderMenu();
}
function renderMenu() {
  const { rows } = computeRows();
  const byId = new Map(rows.map(x => [x.r.id, x]));
  weekMenu = weekMenu.filter(id => byId.has(id));
  $("menu-list").innerHTML = weekMenu.length ? weekMenu.map((id, k) => {
    const x = byId.get(id), ready = isReady(x);
    const state = ready ? `<span class="pill ok">${t("Tu as tout")}</span>`
      : `<span class="pill miss">${t("Il te manque :")} ${esc(x.a.missing.map(o => lower(o[0])).join(", "))}</span>`;
    return `<li class="menu-day">
      <span class="menu-dayname">${t(DAYS[k])}</span>
      <button type="button" class="menu-recipe" data-open="${x.i}">${esc(x.r.title)}<small>${x.r.time} min · ≈ ${fmtEuros(costOf(x.r))} ${t("la portion")}</small></button>
      ${state}
      <button type="button" class="link-btn" data-change="${k}">${t("Changer")}</button>
    </li>`;
  }).join("") : `<li class="note">${t("Pas assez de recettes possibles avec ce que tu as. Coche plus d'ingrédients ou ton équipement.")}</li>`;
  $("menu-shop").disabled = !weekMenu.some(id => !isReady(byId.get(id)));
  const total = weekMenu.reduce((sum, id) => sum + costOf(byId.get(id).r) * portions, 0); // coût par portion × nombre de personnes
  $("menu-cost").hidden = !weekMenu.length;
  $("menu-cost").innerHTML = t("Coût estimé de la semaine : <strong>≈ {e}</strong> pour {p}, soit ≈ {d} par repas et par personne. Avec un colis, c'est gratuit.", {
    e: fmtEuros(total), p: plural(portions, "1 personne", "{n} personnes"), d: fmtEuros(total / weekMenu.length / portions) });
}
function openMenu() {
  const saved = readJSON(KEYS.menu);
  if (Array.isArray(saved) && saved.length) weekMenu = saved; else newMenu();
  renderMenu();
  openDialog($("menu"));
  track("menu/ouvert", "Menu de la semaine");
}
function setupMenu() {
  $("menu-open-btn").addEventListener("click", openMenu);
  $("menu-new").addEventListener("click", () => { newMenu(); renderMenu(); });
  $("menu-list").addEventListener("click", e => {
    const ch = e.target.closest("[data-change]");
    if (ch) { changeDay(Number(ch.dataset.change)); return; }
    const op = e.target.closest("[data-open]");
    if (op) {
      closeDialog($("menu"));
      location.hash = recipeHref(RECIPES[Number(op.dataset.open)]);
    }
  });
  $("menu-shop").addEventListener("click", () => {
    const { rows } = computeRows();
    const byId = new Map(rows.map(x => [x.r.id, x]));
    let added = 0;
    weekMenu.forEach(id => { const x = byId.get(id); if (x && !isReady(x)) added += addMissingToShop(x.r, x.a, true); });
    toast(added ? plural(added, "1 ingrédient ajouté à ta liste de courses", "{n} ingrédients ajoutés à ta liste de courses") : t("C'est déjà dans ta liste de courses"));
  });
  $("menu-share").addEventListener("click", e => {
    const lines = weekMenu.map((id, k) => { const r = RECIPES.find(x => x.id === id); return r ? `${t(DAYS[k])} : ${r.title}` : ""; }).filter(Boolean);
    shareText(t("Mon menu de la semaine"), [t("Mon menu de la semaine") + " :", ...lines, "", appUrl()].join("\n"), e.currentTarget);
  });
}

/* ---------- Mes recettes : créées par l'étudiant ---------- */

const MINE_COLORS = ["herbe", "tomate", "curry", "nuit"];
/* Met une recette personnelle au format des autres (identifiant stable, valeurs par défaut). */
function prepareMine(m) {
  return {
    id: "mine:" + m.uid, uid: m.uid, mine: true, title: m.title, time: m.time || 15,
    equip: m.equip || [], tool: m.tool || t("Ma recette"), need: m.need.map(id => Array.isArray(id) ? id : [id]),
    extra: m.extra || [], steps: m.steps, swap: m.swap || "", color: MINE_COLORS[m.uid.charCodeAt(m.uid.length - 1) % 4],
    portions: m.portions === 1 ? 1 : undefined
  };
}
function saveMine() {
  writeJSON(KEYS.mine, mine);
  RECIPES = BASE.concat(mine.map(prepareMine));
  renderResults();
}
let editingUid = null;
let crPhoto = { file: null, removed: false }; // photo choisie dans le formulaire, enregistrée avec la recette
function showCreatePhoto(src) {
  $("cr-photo-preview").hidden = !src;
  if (src) $("cr-photo-preview").src = src; else $("cr-photo-preview").removeAttribute("src");
  $("cr-photo-remove").hidden = !src;
  $("cr-photo-label").textContent = src ? t("Changer la photo") : t("Ajouter une photo");
}
function openCreate(r) {
  editingUid = r && r.mine ? r.uid : null;
  const m = editingUid ? mine.find(x => x.uid === editingUid) : null;
  const equip = GROUPS.find(g => g.type === "equip");
  $("create-title").textContent = m ? t("Modifier ma recette") : t("Créer ma recette");
  $("cr-name").value = m ? m.title : "";
  $("cr-time").value = m ? m.time : "";
  $("cr-tool").value = m ? (m.tool || "") : "";
  $("cr-steps").value = m ? m.steps.join("\n") : "";
  $("cr-swap").value = m ? (m.swap || "") : "";
  $("cr-single").checked = !!(m && m.portions === 1);
  const chosenNeed = new Set(m ? m.need.map(x => Array.isArray(x) ? x[0] : x) : []);
  const chosenEquip = new Set(m ? m.equip : []);
  $("cr-equip").innerHTML = equip.items.map(([id, n]) => `<span class="chip"><input type="checkbox" id="cre-${esc(id)}" data-id="${esc(id)}" ${chosenEquip.has(id) ? "checked" : ""}><label for="cre-${esc(id)}">${esc(n)}</label></span>`).join("");
  $("cr-ings").innerHTML = GROUPS.filter(g => !g.type).map(g => `
    <p class="cr-group">${esc(g.titre)}</p>
    <div class="chips">${g.items.map(([id, n]) => `<span class="chip"><input type="checkbox" id="crn-${esc(id)}" data-id="${esc(id)}" ${chosenNeed.has(id) ? "checked" : ""}><label for="crn-${esc(id)}">${esc(n)}</label></span>`).join("")}</div>`).join("");
  $("cr-msg").textContent = "";
  crPhoto = { file: null, removed: false };
  showCreatePhoto(editingUid ? myPhotos["mine:" + editingUid] : null);
  openDialog($("create"));
}
async function submitCreate(e) {
  e.preventDefault();
  const title = $("cr-name").value.trim().slice(0, 60);
  const need = [...$("cr-ings").querySelectorAll("input:checked")].map(i => [i.dataset.id]);
  const steps = $("cr-steps").value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 15);
  if (!title) { $("cr-msg").textContent = t("Donne un nom à ta recette."); $("cr-name").focus(); return; }
  if (!need.length) { $("cr-msg").textContent = t("Coche au moins un ingrédient indispensable."); return; }
  if (!steps.length) { $("cr-msg").textContent = t("Écris au moins une étape (une par ligne)."); $("cr-steps").focus(); return; }
  const rec = {
    uid: editingUid || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title, time: Math.max(1, Math.min(180, Number($("cr-time").value) || 15)),
    equip: [...$("cr-equip").querySelectorAll("input:checked")].map(i => i.dataset.id),
    tool: $("cr-tool").value.trim().slice(0, 40), need, extra: [], steps,
    swap: $("cr-swap").value.trim().slice(0, 200), portions: $("cr-single").checked ? 1 : 2
  };
  if (editingUid) mine = mine.map(x => x.uid === editingUid ? rec : x); else mine.push(rec);
  const photoId = "mine:" + rec.uid;
  if (crPhoto.file) await storePhoto(photoId, crPhoto.file);
  else if (crPhoto.removed && myPhotos[photoId]) { delete myPhotos[photoId]; savePhotos(); }
  track(editingUid ? "ma-recette/modifiee" : "ma-recette/creee", "Recette personnelle");
  closeDialog($("create"));
  bookTab = "mine";
  saveMine();
  toast(editingUid ? t("Recette modifiée") : t("Recette ajoutée : tu la retrouves dans « Mes recettes »."));
  const target = "#recette/" + slug("mine:" + rec.uid);
  if (location.hash !== target) location.hash = target; else renderRecipePage();
}
function deleteMine(r) {
  if (!window.confirm(t("Supprimer la recette « {x} » ?", { x: r.title }))) return;
  mine = mine.filter(x => x.uid !== r.uid);
  favs.delete(r.id); saveFavs();
  if (myPhotos[r.id]) { delete myPhotos[r.id]; savePhotos(); }
  if (screenNow === "recette") { bookTab = "mine"; location.hash = "#carnet"; }
  saveMine();
}
function setupCreate() {
  $("create-form").addEventListener("submit", submitCreate);
  $("create-cancel").addEventListener("click", () => closeDialog($("create")));
  $("cr-photo").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    crPhoto = { file, removed: false };
    showCreatePhoto(URL.createObjectURL(file));
  });
  $("cr-photo-remove").addEventListener("click", () => {
    crPhoto = { file: null, removed: true };
    $("cr-photo").value = "";
    showCreatePhoto(null);
  });
}

/* ---------- Photo de mon plat : prise par l'étudiant, gardée sur son téléphone ---------- */

function recipePhoto(r) {
  if (myPhotos[r.id]) return { src: myPhotos[r.id], mine: true };
  return r.mine ? null : photoOf("recettes", slug(r.id));
}
function savePhotos() {
  try { localStorage.setItem(KEYS.photos, JSON.stringify(myPhotos)); return true; }
  catch (err) { return false; }
}
/* Réduit la photo (640 px au plus) pour qu'elle prenne peu de place. */
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
    img.src = url;
  });
}
async function storePhoto(id, file) {
  let data;
  try { data = await shrinkPhoto(file); } catch (err) { toast(t("Impossible de lire cette photo.")); return false; }
  const before = myPhotos[id];
  myPhotos[id] = data;
  if (!savePhotos()) {
    if (before) myPhotos[id] = before; else delete myPhotos[id];
    toast(t("Plus assez de place sur ce téléphone pour cette photo. Retire d'anciennes photos."));
    return false;
  }
  track("photo/ajoutee", "Photo de mon plat");
  return true;
}
let photoFor = null;
function pickPhoto(id) {
  photoFor = id;
  $("photo-input").value = "";
  $("photo-input").click();
}
function setupPhotos() {
  const saved = readJSON(KEYS.photos);
  if (saved && typeof saved === "object") myPhotos = saved;
  $("photo-input").addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0];
    if (!file || !photoFor) return;
    if (await storePhoto(photoFor, file)) { renderResults(); toast(t("Photo ajoutée à la recette")); }
  });
}

/* ---------- Liens de partage : une recette perso, une liste de courses ---------- */

const toB64 = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = b64 => decodeURIComponent(escape(atob(b64.replace(/-/g, "+").replace(/_/g, "/"))));
function recipeLink(r) {
  const m = mine.find(x => x.uid === r.uid) || r;
  const data = { t: m.title, m: m.time, e: m.equip, o: m.tool, n: m.need.map(x => Array.isArray(x) ? x[0] : x), s: m.steps, w: m.swap, p: m.portions === 1 ? 1 : 2 };
  const url = new URL("./", location.href);
  url.searchParams.set("recette", toB64(JSON.stringify(data)));
  return url.href;
}
function shopLink(items) {
  const url = new URL("./", location.href);
  url.searchParams.set("courses", items.map(x => x.id ? x.id : "~" + x.label).join("|"));
  return url.href;
}
function showBanner(html, undo) {
  $("colis-banner-text").innerHTML = html;
  $("colis-banner").hidden = false;
  $("colis-undo").onclick = () => { undo(); $("colis-banner").hidden = true; };
}
const dropParam = () => { try { window.history.replaceState(null, "", location.pathname + location.hash); } catch (err) { /* rien */ } };
/* Une recette envoyée par un ami : on l'ajoute à « Mes recettes ». */
function applyRecipeLink() {
  const raw = new URLSearchParams(location.search).get("recette");
  if (!raw) return false;
  dropParam();
  let d;
  try { d = JSON.parse(fromB64(raw)); } catch (err) { return false; }
  const equipIds = new Set((GROUPS.find(g => g.type === "equip") || { items: [] }).items.map(([id]) => id));
  const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const rec = {
    uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: str(d.t, 60), time: Math.max(1, Math.min(180, Number(d.m) || 15)),
    equip: (Array.isArray(d.e) ? d.e : []).filter(id => equipIds.has(id)),
    tool: str(d.o, 40), need: (Array.isArray(d.n) ? d.n : []).filter(id => INGREDIENTS.has(id)).map(id => [id]), extra: [],
    steps: (Array.isArray(d.s) ? d.s : []).map(x => str(x, 400)).filter(Boolean).slice(0, 15),
    swap: str(d.w, 200), portions: d.p === 1 ? 1 : 2
  };
  if (!rec.title || !rec.need.length || !rec.steps.length) return false;
  const same = mine.find(x => x.title === rec.title && x.steps.join("|") === rec.steps.join("|"));
  bookTab = "mine";
  startHash = "#carnet";
  if (same) { toast(t("Cette recette est déjà dans « Mes recettes ».")); return true; }
  mine.push(rec);
  writeJSON(KEYS.mine, mine);
  startHash = "#recette/" + slug("mine:" + rec.uid);
  setTimeout(() => toast(t("Recette « {x} » ajoutée à « Mes recettes ».", { x: rec.title })), 400);
  RECIPES = BASE.concat(mine.map(prepareMine));
  track("ma-recette/recue", "Recette reçue par lien");
  showBanner(t("Recette « <strong>{x}</strong> » ajoutée à « Mes recettes ».", { x: esc(rec.title) }), () => {
    mine = mine.filter(x => x.uid !== rec.uid);
    saveMine();
  });
  return true;
}
/* Une liste de courses envoyée par un colocataire : on l'ajoute à la sienne. */
function applyShopLink() {
  const raw = new URLSearchParams(location.search).get("courses");
  if (raw == null) return false;
  dropParam();
  const added = [];
  raw.split("|").slice(0, 60).forEach(part => {
    const item = part.startsWith("~")
      ? { id: null, label: part.slice(1).trim().slice(0, 60) }
      : INGREDIENTS.has(part) ? { id: part, label: NAMES[part] } : null;
    if (!item || !item.label) return;
    if (shop.some(x => !x.done && (item.id ? x.id === item.id : norm(x.label) === norm(item.label)))) return;
    const entry = { id: item.id, label: item.label, from: t("Liste partagée"), done: false };
    shop.push(entry); added.push(entry);
  });
  saveShop();
  track("courses/recue", "Liste de courses reçue par lien");
  if (!added.length) { toast(t("C'est déjà dans ta liste de courses")); return true; }
  showBanner(plural(added.length, "Liste partagée : 1 article ajouté à ta liste de courses.", "Liste partagée : {n} articles ajoutés à ta liste de courses."), () => {
    shop = shop.filter(x => !added.includes(x));
    saveShop(); updateShopBadge();
  });
  return true;
}

/* ---------- Produits à finir vite ---------- */

/* Produits « à finir vite » que la recette utilise vraiment (parmi ceux qu'on a). */
const urgentUsed = r => usedIngredients(r).filter(id => urgent.has(id));
function renderUrgent() {
  [...urgent].forEach(id => { if (!have.has(id)) urgent.delete(id); });
  const mine = [...INGREDIENTS].filter(id => have.has(id));
  $("urgent-list").innerHTML = mine.length
    ? mine.map(id => `<span class="chip"><input type="checkbox" id="u-${esc(id)}" data-id="${esc(id)}" ${urgent.has(id) ? "checked" : ""}><label for="u-${esc(id)}">${esc(NAMES[id])}</label></span>`).join("")
    : `<p class="note">${t("Coche d'abord tes ingrédients : tu pourras ensuite choisir ceux à finir vite.")}</p>`;
  $("urgent-count").textContent = urgent.size;
}
function setupUrgent() {
  $("urgent-open").addEventListener("click", () => { renderUrgent(); openDialog($("urgent")); });
  $("urgent-list").addEventListener("change", e => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.checked) urgent.add(id); else urgent.delete(id);
    writeJSON(KEYS.urgent, [...urgent]);
    $("urgent-count").textContent = urgent.size;
    renderResults();
  });
}

/* ---------- Lecture à voix haute ---------- */

const canSpeak = () => "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
const voiceOn = () => readJSON(KEYS.voice) === true;
function speak(text) {
  if (!canSpeak() || !voiceOn() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\(≈[^)]*\)/g, ""));
    u.lang = { en: "en-GB", es: "es-ES" }[LANG] || "fr-FR";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch (err) { /* pas de voix disponible */ }
}
function stopSpeaking() { try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (err) {} }
function updateVoiceButton() {
  const b = $("cook-voice");
  b.hidden = !canSpeak();
  b.setAttribute("aria-pressed", String(voiceOn()));
  b.querySelector("[data-label]").textContent = voiceOn() ? t("Voix activée") : t("Lire à voix haute");
}

/* ---------- Compteur de repas et d'économies ---------- */

function monthStats() {
  const month = new Date().toISOString().slice(0, 7);
  const list = history.filter(h => (h.date || "").startsWith(month));
  return { meals: list.length, euros: list.reduce((a, h) => a + (h.euros || 0), 0), total: history.length };
}
function renderStats() {
  const st = monthStats();
  $("stats-meals").textContent = plural(st.meals, "1 repas cuisiné ce mois-ci", "{n} repas cuisinés ce mois-ci");
  $("stats-euros").textContent = st.meals ? t("≈ {e} de courses évitées", { e: fmtEuros(st.euros) }) : t("Termine une recette en mode cuisine pour commencer le compteur.");
}

async function openCook(r) {
  track("cuisine/" + slug(r.id), "Mode cuisine : " + r.id);
  cook.r = r; cook.step = 0;
  stopTimer();
  updateVoiceButton();
  renderCook();
  openDialog($("cook"));
  $("cook-next").focus();
  const ok = await keepAwake();
  $("cook-wake").textContent = ok
    ? t("L'écran reste allumé pendant que tu cuisines.")
    : t("Ton téléphone peut se mettre en veille : touche l'écran de temps en temps.");
}

function moveCook(delta) {
  const next = cook.step + delta;
  if (next > cook.r.steps.length + 1) { finishCooking(); return; }
  if (next < 0) return;
  cook.step = next;
  renderCook();
  const st = $("cook-step");
  st.classList.remove("slide-l", "slide-r"); void st.offsetWidth;
  st.classList.add(delta > 0 ? "slide-l" : "slide-r");
}

function setupCook() {
  const dlg = $("cook");
  $("cook-next").addEventListener("click", () => moveCook(1));
  $("cook-prev").addEventListener("click", () => moveCook(-1));
  $("cook-close").addEventListener("click", () => closeDialog(dlg));
  $("cook-timer-stop").addEventListener("click", stopTimer);
  $("cook-step").addEventListener("click", e => {
    const b = e.target.closest(".cook-timer-btn");
    if (b) startTimer(Number(b.dataset.secs));
  });
  dlg.addEventListener("close", () => { releaseAwake(); stopTimer(); stopSpeaking(); });
  $("cook-voice").addEventListener("click", () => {
    writeJSON(KEYS.voice, !voiceOn());
    updateVoiceButton();
    if (voiceOn() && cook.step > 0 && cook.step <= cook.r.steps.length) speak(stepsOf(cook.r)[cook.step - 1]);
    else stopSpeaking();
  });
  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") moveCook(1);
    if (e.key === "ArrowLeft") moveCook(-1);
  });
  /* On glisse le doigt vers la gauche pour l'étape suivante, vers la droite pour revenir. */
  let sx = null, sy = 0;
  dlg.addEventListener("touchstart", e => {
    if (e.target.closest("input, label, button, .chips")) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  dlg.addEventListener("touchend", e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && cook.step <= cook.r.steps.length) moveCook(1);
    if (dx > 0) moveCook(-1);
  }, { passive: true });
  /* Le verrou d'écran saute quand on change d'appli : on le reprend au retour. */
  document.addEventListener("visibilitychange", () => {
    if (dlg.hasAttribute("open") && document.visibilityState === "visible") { keepAwake(); tickTimer(); }
  });
}

/* ---------- Lien « colis du jour » envoyé par une association ---------- */

function applyColisLink(firstVisit) {
  const params = new URLSearchParams(location.search);
  const raw = params.get("colis");
  if (!raw) return false;
  const ids = raw.split(/[.,\s]+/).filter(id => INGREDIENTS.has(id));
  const asso = (params.get("asso") || "").trim().slice(0, 40);
  try { window.history.replaceState(null, "", location.pathname + location.hash); } catch (err) { /* rien */ }
  if (!ids.length) return false;

  const before = new Set(have);
  if (firstVisit) have = new Set(["plaque"]); // on ne mélange pas avec le colis d'exemple
  ids.forEach(id => have.add(id));
  save();
  track("colis/" + (slug(asso) || "sans-nom"), "Lien colis : " + (asso || "sans nom"));

  const who = asso ? `${t("Colis")} « <strong>${esc(asso)}</strong> »` : t("Colis du jour");
  $("colis-banner-text").innerHTML = `${who} ${plural(ids.length, "coché : 1 produit.", "coché : {n} produits.")} ${firstVisit ? t("Ajoute ce que tu as déjà chez toi et vérifie ton équipement.") : t("Ajoute ce que tu as déjà chez toi.")}`;
  $("colis-banner").hidden = false;
  $("colis-undo").onclick = () => {
    have = before;
    haveChanged();
    $("colis-banner").hidden = true;
  };
  return true;
}

/* ---------- Avis et confidentialité ---------- */

function renderCredits() {
  const items = [];
  RECIPES.forEach(r => { const ph = photoOf("recettes", slug(r.id)); if (ph && ph.credit) items.push([r.title, ph]); });
  Object.keys(PHOTOS.ingredients || {}).forEach(id => { const ph = photoOf("ingredients", id); if (ph && ph.credit && NAMES[id]) items.push([NAMES[id], ph]); });
  $("credits").hidden = items.length === 0;
  const link = ph => /^https:\/\//.test(ph.source || "") ? ` (<a href="${esc(ph.source)}" target="_blank" rel="noopener">source</a>)` : "";
  $("credits-list").innerHTML = items.map(([what, ph]) => `<li><strong>${esc(what)}</strong> : ${esc(ph.credit)}${link(ph)}</li>`).join("");
}

function setupFeedback() {
  const url = CONFIG.avisUrl;
  document.querySelectorAll("[data-avis]").forEach(el => {
    if (!url) { el.hidden = true; return; }
    const a = el.tagName === "A" ? el : el.querySelector("a");
    a.href = url;
    a.addEventListener("click", () => track("avis", "Clic sur Donner mon avis"));
  });
  $("privacy-stats").hidden = !CONFIG.goatcounter;
}


/* ---------- Langue : choix et traduction de la page ---------- */

function pickLang() {
  const saved = readJSON(KEYS.lang);
  if (LANGS.includes(saved)) return saved;
  /* Quelqu'un qui utilisait déjà l'appli (en français) le reste : pas de changement surprise. */
  if (readJSON(KEYS.have) !== null) return "fr";
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "fr";
  if (/^fr\b/i.test(nav)) return "fr";
  if (/^es\b/i.test(nav)) return "es";
  return "en";
}
/* Traduit les textes fixes de la page (titres, boutons, aides) d'après le dictionnaire. */
function translateStatic() {
  const key = v => v.replace(/\s+/g, " ").trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const k = key(n.nodeValue);
    if (k && DICT[k]) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), DICT[k]);
  });
  document.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(el => {
    ["placeholder", "aria-label", "title", "alt"].forEach(a => {
      const v = el.getAttribute(a);
      if (v && DICT[key(v)]) el.setAttribute(a, DICT[key(v)]);
    });
  });
  if (DICT[document.title]) document.title = DICT[document.title];
  const desc = document.querySelector('meta[name="description"]');
  if (desc && DICT[desc.content]) desc.content = DICT[desc.content];
}
/* Applique la traduction du contenu (ingrédients, recettes, conseils). */
function applyContent(en, data) {
  data.groupes.forEach(g => {
    if (en.groupes && en.groupes[g.titre]) g.titre = en.groupes[g.titre];
    g.items.forEach(item => { if (en.noms && en.noms[item[0]]) item[1] = en.noms[item[0]]; });
  });
  (data.regimes || []).forEach(rg => { if (en.regimes && en.regimes[rg.id]) rg.nom = en.regimes[rg.id]; });
  if (en.noteRegimes) data.noteRegimes = en.noteRegimes;
  data.recettes.forEach(r => {
    const tr = en.recettes && en.recettes[r.id];
    if (!tr) return;
    ["title", "tool", "swap"].forEach(k => { if (tr[k]) r[k] = tr[k]; });
    if (Array.isArray(tr.steps) && tr.steps.length === r.steps.length) r.steps = tr.steps;
  });
  (data.bases || []).forEach(b => {
    const tr = en.bases && en.bases[b.titre];
    if (tr && Array.isArray(tr.etapes)) { b.titre = tr.titre; b.etapes = tr.etapes; }
  });
  (data.conservation || []).forEach(c => {
    const tr = en.conservation && en.conservation[c.titre];
    if (tr) { c.titre = tr.titre; c.texte = tr.texte; }
  });
}
function setupLang() {
  document.querySelectorAll('input[name="lang"]').forEach(r => {
    r.checked = r.value === LANG;
    r.addEventListener("change", () => { writeJSON(KEYS.lang, r.value); window.location.reload(); });
  });
}

/* ---------- Démarrage ---------- */

async function init() {
  LANG = pickLang();
  document.documentElement.lang = LANG;
  let enContent = null;
  if (LANG !== "fr") {
    try {
      const [ui, content] = await Promise.all([
        fetch(`i18n-${LANG}.json?v=18`, { cache: "no-cache" }).then(r => r.json()),
        fetch(`recettes.${LANG}.json?v=18`, { cache: "no-cache" }).then(r => r.json())
      ]);
      DICT = ui; enContent = content;
      translateStatic();
    } catch (err) { LANG = "fr"; document.documentElement.lang = "fr"; }
  }
  setupLang();
  setupTheme();
  setupTextSize();
  setupStats();
  setupFeedback();
  setupDialogs();
  setupCook();

  let data;
  try {
    const res = await fetch("recettes.json", { cache: "no-cache" });
    data = await res.json();
  } catch (err) {
    $("count-text").textContent = t("Impossible de charger les recettes. Vérifie ta connexion et recharge la page.");
    return;
  }
  data.recettes.forEach(r => { r.id = r.title; }); // identifiant stable : le titre français
  if (enContent) applyContent(enContent, data);
  REGIMES = data.regimes || [];
  BASE = data.recettes;
  const savedMine = readJSON(KEYS.mine);
  if (Array.isArray(savedMine)) mine = savedMine.filter(x => x && x.uid && x.title && Array.isArray(x.need) && Array.isArray(x.steps));
  RECIPES = BASE.concat(mine.map(prepareMine));
  NUTRI = data.nutrition || {};
  TIPS = data.conservation || [];
  SEASON = new Set(((data.saisons || {})[currentSeason()] || []));
  BASICS = data.bases || [];
  OFF = data.openFoodFacts || [];
  PHOTOS = Object.assign({ recettes: {}, ingredients: {} }, data.photos || {});
  PRIX = data.prix || {};
  EXEMPLE = data.colisExemple || [];
  const savedPortions = readJSON(KEYS.portions);
  if (Number.isInteger(savedPortions) && savedPortions >= 1 && savedPortions <= 8) portions = savedPortions;
  GROUPS = data.groupes.slice();
  GROUPS.forEach(g => g.items.forEach(([id, n]) => { NAMES[id] = n; if (!g.type) INGREDIENTS.add(id); }));
  if (REGIMES.length) {
    const equipAt = GROUPS.findIndex(g => g.type === "equip");
    GROUPS.splice(equipAt + 1, 0, { titre: t("Mon régime"), type: "regime", note: data.noteRegimes, items: REGIMES.map(rg => [rg.id, rg.nom]) });
  }

  const saved = readJSON(KEYS.have);
  const firstVisit = !Array.isArray(saved);
  have = new Set(firstVisit ? (data.colisExemple || []) : saved);
  const savedFavs = readJSON(KEYS.favs);
  if (Array.isArray(savedFavs)) favs = new Set(savedFavs);
  const savedShop = readJSON(KEYS.shop);
  if (Array.isArray(savedShop)) shop = savedShop.filter(x => x && typeof x.label === "string");
  const savedUrgent = readJSON(KEYS.urgent);
  if (Array.isArray(savedUrgent)) urgent = new Set(savedUrgent);
  const savedHistory = readJSON(KEYS.history);
  if (Array.isArray(savedHistory)) history = savedHistory.filter(h => h && h.id);
  const savedGroups = readJSON(KEYS.groups);
  if (Array.isArray(savedGroups)) openGroups = savedGroups;
  const fromLink = applyColisLink(firstVisit) | applyRecipeLink() | applyShopLink();
  $("example-note").hidden = !firstVisit || fromLink;
  const showWelcome = firstVisit && !fromLink && !readJSON(KEYS.welcome);

  setupProfile();
  setupShop();
  setupScan();
  setupWelcome();
  setupUrgent();
  setupCreate();
  setupMenu();
  setupPhotos();
  setupBook();
  setupHome();
  setupSearch();
  setupRecipePage();

  $("clear").addEventListener("click", () => {
    have = new Set([...have].filter(id => !INGREDIENTS.has(id))); // on garde l'équipement et le régime
    haveChanged();
    $("example-note").hidden = true;
    $("colis-banner").hidden = true;
  });
  $("search").addEventListener("input", e => filterPantry(e.target.value));
  document.addEventListener("click", e => { if (e.target.closest("[data-create]")) openCreate(null); });
  $("random-btn").addEventListener("click", randomRecipe);
  syncPortionRadios();
  document.querySelectorAll('input[name="portions"]').forEach(r => {
    r.addEventListener("change", () => { portions = Number(r.value); writeJSON(KEYS.portions, portions); renderResults(); });
  });

  renderPantry();
  renderProfile();
  updateShopBadge();
  renderCredits();
  renderUrgent();
  renderResults();
  if (startHash && location.hash !== startHash) { try { window.history.replaceState(null, "", startHash); } catch (err) {} }
  route(true);
  window.addEventListener("hashchange", () => { navDepth++; route(false); });
  if (showWelcome) openWelcome();
}

/* ---------- Premier lancement : trois questions rapides ---------- */

let welcomeStep = 1;
let welcomeReplay = false; // « Revoir la présentation » depuis le profil : on ne touche pas à ce qui est coché
function renderWelcome() {
  const equip = GROUPS.find(g => g.type === "equip"), regime = GROUPS.find(g => g.type === "regime");
  $("welcome-progress").textContent = t("Étape {a} sur {b}", { a: welcomeStep, b: 3 });
  $("welcome-bar").innerHTML = [1, 2, 3].map(n => `<span class="${n <= welcomeStep ? "on" : ""}"></span>`).join("");
  let body = "";
  if (welcomeStep === 1) body = `<h2 id="welcome-title" tabindex="-1">${t("Avec quoi peux-tu cuisiner ?")}</h2>
    <p class="note">${t("Coche tout ce que tu as. Rien du tout ? Pas de souci, il y a des recettes sans cuisson.")}</p>
    <div class="chips">${equip.items.map(([id, n]) => chipHtml("w", id, n)).join("")}</div>`;
  if (welcomeStep === 2) body = `<h2 id="welcome-title" tabindex="-1">${t("Tu suis un régime ?")}</h2>
    <p class="note">${t("On cachera les recettes qui ne te conviennent pas. Tu pourras changer ça plus tard dans le menu.")}</p>
    <div class="chips">${regime ? regime.items.map(([id, n]) => chipHtml("w", id, n)).join("") : ""}</div>`;
  if (welcomeStep === 3) body = `<h2 id="welcome-title" tabindex="-1">${t("Comment veux-tu commencer ?")}</h2>
    <div class="welcome-choices">
      <button type="button" class="btn btn-pri" data-start="check">${t("Je coche mes ingrédients")}</button>
      <button type="button" class="btn btn-sec" data-start="scan">${t("Je scanne mes produits")}</button>
      <button type="button" class="btn btn-sec" data-start="example">${t("Montre-moi un exemple de colis")}</button>
    </div>`;
  $("welcome-body").innerHTML = body;
  $("welcome-body").querySelectorAll("input[data-id]").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
  }));
  $("welcome-next").hidden = welcomeStep === 3;
  $("welcome-back").disabled = welcomeStep === 1;
  setTimeout(() => { const t = $("welcome-title"); if (t) t.focus({ preventScroll: true }); }, 0);
}
function openWelcome(replay) {
  welcomeReplay = !!replay;
  /* Premier lancement : on repart de zéro, l'étudiant choisit lui-même au lieu du colis d'exemple. */
  if (!welcomeReplay) have = new Set();
  welcomeStep = 1;
  renderWelcome();
  openDialog($("welcome"));
}
function finishWelcome(start) {
  writeJSON(KEYS.welcome, true);
  if (start === "example") EXEMPLE.forEach(id => { if (INGREDIENTS.has(id)) have.add(id); });
  $("example-note").hidden = start !== "example";
  if (start === "skip" && !welcomeReplay) { have = new Set(EXEMPLE); $("example-note").hidden = false; }
  closeDialog($("welcome"));
  haveChanged();
  if (start === "scan") openScan();
  if (start === "check") location.hash = "#frigo";
}
function setupWelcome() {
  $("welcome-next").addEventListener("click", () => { welcomeStep = Math.min(3, welcomeStep + 1); renderWelcome(); });
  $("welcome-back").addEventListener("click", () => { welcomeStep = Math.max(1, welcomeStep - 1); renderWelcome(); });
  $("welcome-skip").addEventListener("click", () => finishWelcome("skip"));
  $("welcome-body").addEventListener("click", e => {
    const b = e.target.closest("[data-start]");
    if (b) finishWelcome(b.dataset.start);
  });
  $("welcome").addEventListener("close", () => { if (!readJSON(KEYS.welcome)) finishWelcome("skip"); });
}

init();

/* Mode hors connexion. Quand une nouvelle version est publiée, l'appli se recharge une fois toute seule. */
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(reg => reg.update())
      .catch(() => {});
  });
}
