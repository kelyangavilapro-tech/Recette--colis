"use strict";
/* Qu'est-ce que je cuisine avec mon colis ?
   Les ingrédients, recettes, valeurs nutritionnelles et conseils sont dans recettes.json,
   les liens dans config.js : on les modifie là, pas ici. */

const KEYS = {
  have: "colis-have", groups: "colis-groupes-ouverts", favs: "colis-favoris",
  shop: "colis-courses", theme: "colis-theme"
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
let OFF = [];
const NAMES = {};
const INGREDIENTS = new Set(); // ingrédients seulement (ni équipement, ni régime)
let have = new Set();
let favs = new Set();
let shop = [];
let view = "all"; // "all" ou "favs"
let openGroups = null; // null = état par défaut (ouverts sur ordinateur, repliés sur téléphone)
let searching = false;

const $ = id => document.getElementById(id);
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
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
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
  if (btn) flash(btn, ok ? "Copié !" : "Copie impossible");
  else toast(ok ? "Copié !" : "Copie impossible");
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
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
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

/* ---------- Garde-manger ---------- */

function groupState(g) {
  const got = g.items.filter(([id]) => have.has(id)).map(([, n]) => n);
  const none = g.type === "regime" ? "Aucun" : "Rien de coché";
  return { count: got.length, names: got.length ? got.join(", ") : none };
}

function isGroupOpen(gi) {
  if (openGroups) return openGroups.includes(gi);
  return !MOBILE.matches;
}

function groupNote(g) {
  if (g.type === "equip") return '<p class="note">Rien coché : on te montre les recettes sans cuisson.</p>';
  if (g.type === "regime") return `<p class="note">On cache les recettes qui ne te conviennent pas. ${esc(g.note || "")}</p>`;
  return "";
}

const chipHtml = (prefix, id, name) => `
  <span class="chip" data-name="${esc(norm(name))}">
    <input type="checkbox" id="${prefix}-${esc(id)}" data-id="${esc(id)}" ${have.has(id) ? "checked" : ""}>
    <label for="${prefix}-${esc(id)}">${esc(name)}</label>
  </span>`;

function renderPantry() {
  const box = $("pantry-groups");
  box.innerHTML = GROUPS.map((g, gi) => {
    const s = groupState(g);
    return `
    <details class="group" data-g="${gi}" ${isGroupOpen(gi) ? "open" : ""}>
      <summary class="group-head">
        <span class="group-title">${esc(g.titre)}</span>
        <span class="group-count" data-count>${g.type === "regime" ? s.count : `${s.count} / ${g.items.length}`}</span>
        ${svg(ICON.chevron)}
        <span class="group-names" data-names>${esc(s.names)}</span>
      </summary>
      <fieldset>
        <legend class="sr-only">${esc(g.titre)}</legend>
        <div class="chips">${g.items.map(([id, name]) => chipHtml("c", id, name)).join("")}</div>
        ${groupNote(g)}
      </fieldset>
    </details>`;
  }).join("");

  box.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    $("example-note").hidden = true;
    updateGroupHead(inp.closest("details"));
    save(); renderDrawerChips(); renderResults();
  }));
  box.querySelectorAll("details.group").forEach(d => d.addEventListener("toggle", () => {
    if (searching) return; // la recherche ouvre les groupes sans changer tes préférences
    openGroups = [...box.querySelectorAll("details.group[open]")].map(x => Number(x.dataset.g));
    writeJSON(KEYS.groups, openGroups);
  }));
  const q = $("search").value;
  if (q) filterPantry(q);
}

function updateGroupHead(details) {
  const g = GROUPS[Number(details.dataset.g)];
  const s = groupState(g);
  details.querySelector("[data-count]").textContent = g.type === "regime" ? s.count : `${s.count} / ${g.items.length}`;
  details.querySelector("[data-names]").textContent = s.names;
}

/* Tout ce qui change « ce que j'ai » passe par ici, pour que tout l'écran reste à jour. */
function haveChanged() {
  save();
  renderPantry();
  renderDrawerChips();
  renderResults();
}

/* Recherche : on ne garde que les ingrédients qui correspondent et on ouvre leurs groupes. */
function filterPantry(raw) {
  const q = norm(raw.trim());
  searching = true;
  let found = 0;
  document.querySelectorAll("details.group").forEach(d => {
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

/* ---------- Menu latéral ---------- */

function renderDrawerChips() {
  const regime = GROUPS.find(g => g.type === "regime");
  const equip = GROUPS.find(g => g.type === "equip");
  $("drawer-regimes").innerHTML = regime ? regime.items.map(([id, n]) => chipHtml("d", id, n)).join("") : "";
  $("drawer-equip").innerHTML = equip ? equip.items.map(([id, n]) => chipHtml("d", id, n)).join("") : "";
  document.querySelectorAll("#drawer-regimes input, #drawer-equip input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    save(); renderPantry(); renderResults();
  }));
  $("drawer-fav-count").textContent = favs.size;
  $("drawer-shop-count").textContent = shop.filter(x => !x.done).length;
}

function setupDrawer() {
  const drawer = $("drawer");
  $("menu-open").addEventListener("click", () => { renderDrawerChips(); openDialog(drawer); });
  drawer.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    const go = b.dataset.go;
    closeDialog(drawer);
    if (go === "scan") openScan();
    if (go === "random") randomRecipe();
    if (go === "shop") openShop();
    if (go === "keep") openTips();
    if (go === "favs") { setView("favs"); $("results").scrollIntoView(); }
    if (go === "privacy") { $("privacy").open = true; $("privacy").scrollIntoView(); }
  }));
  $("reset-app").addEventListener("click", () => {
    if (!window.confirm("Tout remettre à zéro ? Tes ingrédients cochés, tes favoris, ta liste de courses et tes réglages seront effacés de ce téléphone.")) return;
    Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch (err) {} });
    window.location.reload();
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
  const t = { kcal: 0, prot: 0, gluc: 0, lip: 0 };
  r.need.forEach(opts => {
    const id = pick(opts);
    const n = NUTRI[id];
    if (!n) return;
    const grams = r.qte && r.qte[id] != null ? r.qte[id] : n[4];
    const f = grams / 100;
    t.kcal += n[0] * f; t.prot += n[1] * f; t.gluc += n[2] * f; t.lip += n[3] * f;
  });
  return { kcal: Math.round(t.kcal / 10) * 10, prot: Math.round(t.prot), gluc: Math.round(t.gluc), lip: Math.round(t.lip) };
}

/* ---------- Cartes recettes ---------- */

function card(r, a, state, i) {
  const c = COLORS[r.color] || COLORS.nuit;
  const fav = favs.has(r.title);
  const nut = nutrition(r);
  let pill;
  if (!a.equipOk) {
    pill = `<span class="pill eq">Il faut : ${esc(r.equip.map(lower).join(" ou "))}</span>`;
  } else if (a.missing.length === 0) {
    pill = '<span class="pill ok">Tu as tout ce qu\'il faut</span>';
  } else {
    const names = a.missing.map(opts => opts.map(lower).slice(0, 3).join(" ou "));
    pill = `<span class="pill miss">Il te manque : ${esc(names.join(", "))}</span>`;
  }
  const protPill = nut.prot >= 20 ? '<span class="pill prot">Riche en protéines</span>' : "";
  const ings = r.need.map(opts => {
    const ok = opts.some(o => have.has(o));
    return `<li class="ing ${ok ? "have" : "missing"}"><span class="mark" aria-hidden="true">${ok ? "✓" : "!"}</span><span>${esc(needLabel(opts))}${ok ? "" : " (à trouver)"}</span></li>`;
  }).join("");
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  const steps = r.steps.map((s, n) => `<li class="step"><b style="background: ${c.bar}">${n + 1}</b><span>${esc(s)}</span></li>`).join("");
  return `
  <details class="recipe" data-state="${state}" data-i="${i}">
    <summary>
      <span class="bar" style="background: ${c.bar}" aria-hidden="true"></span>
      <span class="thumb" style="background: ${c.tint}; color: ${c.txt}" aria-hidden="true">${svg(toolArt(r.tool), 40).replace('stroke-width="2.2"', 'stroke-width="1.8"')}</span>
      <span class="recipe-main">
        <h3>${fav ? `<span class="fav-mark" title="Dans tes favoris">${svg(ICON.star, 18)}<span class="sr-only">Favori : </span></span>` : ""}${esc(r.title)}</h3>
        <span class="meta"><span>${svg(ICON.clock, 15)} ${r.time} min</span><span>· ${esc(r.tool)}</span><span>· ${nut.kcal} kcal</span></span>
        <span class="pills">${pill}${protPill}</span>
      </span>
      <span class="chev">${svg(ICON.chevron)}</span>
    </summary>
    <div class="recipe-body">
      <div class="actions">
        <button type="button" class="btn btn-pri btn-color" data-action="cook" data-i="${i}" style="background: ${c.bar}">${svg(ICON.cook)} Mode cuisine</button>
        ${a.missing.length ? `<button type="button" class="btn btn-sec" data-action="shop" data-i="${i}">${svg(ICON.cart)} <span data-label>Ajouter à ma liste</span></button>` : ""}
        <button type="button" class="btn btn-sec" data-action="share" data-i="${i}">${svg(ICON.share)} <span data-label>Partager</span></button>
        <button type="button" class="btn btn-sec btn-fav" data-action="fav" data-i="${i}" aria-pressed="${fav}">${svg(ICON.star)} <span data-label>${fav ? "Dans mes favoris" : "Favori"}</span></button>
        <button type="button" class="btn btn-sec" data-action="print" data-i="${i}">${svg(ICON.print)} <span data-label>Imprimer</span></button>
      </div>
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
      <div class="nutri">
        <span class="nutri-item"><b>${nut.kcal}</b> kcal</span>
        <span class="nutri-item"><b>${nut.prot} g</b> protéines</span>
        <span class="nutri-item"><b>${nut.gluc} g</b> glucides</span>
        <span class="nutri-item"><b>${nut.lip} g</b> lipides</span>
        <p class="nutri-note">Estimation par portion, calculée sur les ingrédients indispensables. Ce sont des ordres de grandeur, pas des valeurs exactes.</p>
      </div>
      <p class="print-only print-foot">Recette trouvée avec « Qu'est-ce que je cuisine avec mon colis ? » : ${esc(appUrl())}</p>
    </div>
  </details>`;
}

const appUrl = () => new URL("./", location.href).href;

function computeRows() {
  const ex = excluded();
  const all = RECIPES.map((r, i) => ({ r: adapt(r, ex), i }));
  const ok = all.filter(x => compatible(x.r));
  return { hidden: all.length - ok.length, rows: ok.map(x => Object.assign(x, { a: analyse(x.r) })) };
}
const isReady = x => x.a.equipOk && x.a.missing.length === 0;

function renderResults() {
  const { rows, hidden: hiddenByRegime } = computeRows();
  const byTime = (x, y) => x.r.time - y.r.time;
  const readyAll = rows.filter(isReady);

  $("count").textContent = readyAll.length;
  $("count-text").textContent = readyAll.length === 1
    ? "recette possible tout de suite avec ce que tu as."
    : "recettes possibles tout de suite avec ce que tu as.";
  updateJumpBar(readyAll.length);

  const favCount = rows.filter(x => favs.has(x.r.title)).length;
  $("view-favs-count").textContent = favCount;
  $("view-all").setAttribute("aria-pressed", view === "all");
  $("view-favs").setAttribute("aria-pressed", view === "favs");
  $("regime-note").hidden = hiddenByRegime === 0;
  $("regime-note").textContent = hiddenByRegime === 1
    ? "1 recette est cachée parce qu'elle ne correspond pas à ton régime."
    : `${hiddenByRegime} recettes sont cachées parce qu'elles ne correspondent pas à ton régime.`;

  const shown = view === "favs" ? rows.filter(x => favs.has(x.r.title)) : rows;
  const ready = shown.filter(isReady).sort(byTime);
  const almost = shown.filter(x => x.a.equipOk && x.a.missing.length === 1).sort(byTime);
  const later = shown.filter(x => !(x.a.equipOk && x.a.missing.length <= 1))
    .sort((x, y) => (x.a.equipOk === y.a.equipOk ? 0 : x.a.equipOk ? -1 : 1) || x.a.missing.length - y.a.missing.length);

  let html;
  if (view === "favs" && !shown.length) {
    html = '<p class="empty">Tu n\'as pas encore de favoris. Ouvre une recette et touche « Favori » pour la retrouver ici.</p>';
  } else {
    html = ready.length
      ? ready.map(x => card(x.r, x.a, "ready", x.i)).join("")
      : '<p class="empty">Aucune recette complète pour l\'instant. Regarde juste en dessous celles où il ne manque qu\'un ingrédient.</p>';
    if (almost.length) html += '<p class="later-title">Il ne te manque qu\'un ingrédient</p>' + almost.map(x => card(x.r, x.a, "almost", x.i)).join("");
    if (later.length) html += '<p class="later-title">Pour plus tard</p>' + later.map(x => card(x.r, x.a, "later", x.i)).join("");
  }

  const list = $("list");
  const openIdx = [...list.querySelectorAll("details[open]")].map(d => d.dataset.i);
  list.innerHTML = html;
  list.querySelectorAll("details").forEach(d => { if (openIdx.includes(d.dataset.i)) d.open = true; });
}

const currentRecipe = i => adapt(RECIPES[i], excluded());

/* ---------- Une idée au hasard ---------- */

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
  if (view !== "all") setView("all");
  const d = document.querySelector(`#list details[data-i="${pickRow.i}"]`);
  if (!d) return;
  document.querySelectorAll("#list details[open]").forEach(x => { if (x !== d) x.open = false; });
  d.open = true;
  d.scrollIntoView({ block: "start" });
  d.classList.remove("flash"); void d.offsetWidth; d.classList.add("flash");
  const s = d.querySelector("summary");
  if (s) s.focus({ preventScroll: true });
}

/* ---------- Partager une recette ---------- */

function recipeText(r) {
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  return [
    `🍳 ${r.title}`,
    `${r.time} min · ${r.tool} · 2 portions`,
    "",
    "Il faut :",
    ...r.need.map(opts => `- ${needLabel(opts)}`),
    ...(extras.length ? [`En plus si tu as : ${extras.join(", ")}`] : []),
    "",
    "Étapes :",
    ...r.steps.map((s, n) => `${n + 1}. ${s}`),
    "",
    `Selon ton colis : ${r.swap}`,
    "",
    `Trouvé avec « Qu'est-ce que je cuisine avec mon colis ? » : ${appUrl()}`
  ].join("\n");
}

function shareRecipe(r, btn) {
  track("partage/" + slug(r.title), "Partage : " + r.title);
  shareText(r.title, recipeText(r), btn);
}

/* ---------- Favoris ---------- */

function toggleFav(r) {
  if (favs.has(r.title)) favs.delete(r.title);
  else { favs.add(r.title); track("favori/" + slug(r.title), "Favori : " + r.title); }
  saveFavs();
  renderResults();
}

function setView(v) {
  view = v;
  renderResults();
}

/* ---------- Liste de courses ---------- */

function updateShopBadge() {
  const n = shop.filter(x => !x.done).length;
  $("shop-badge").textContent = n;
  $("shop-badge").hidden = n === 0;
  $("drawer-shop-count").textContent = n;
}

function addMissingToShop(r, a) {
  let added = 0;
  a.missing.forEach(opts => {
    const id = opts[0];
    if (shop.some(x => x.id === id && !x.done)) return;
    const others = opts.slice(1, 3).map(lower);
    shop.push({ id, label: NAMES[id] + (others.length ? ` (ou ${others.join(", ")})` : ""), from: r.title, done: false });
    added++;
  });
  saveShop(); updateShopBadge();
  track("courses/ajout", "Ajout à la liste de courses");
  toast(added ? `${added} ingrédient${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à ta liste de courses` : "C'est déjà dans ta liste de courses");
}

function renderShop() {
  const list = $("shop-list");
  list.innerHTML = shop.map((x, k) => `
    <li class="shop-item ${x.done ? "done" : ""}">
      <label><input type="checkbox" data-k="${k}" ${x.done ? "checked" : ""}>
        <span>${esc(x.label)}${x.from ? `<small class="from">Pour : ${esc(x.from)}</small>` : ""}</span></label>
      <button type="button" class="icon-btn" data-del="${k}" aria-label="Retirer ${esc(x.label)} de la liste">${svg(ICON.trash)}</button>
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
  $("shop-open").addEventListener("click", openShop);
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
    toast(`${bought.length} achat${bought.length > 1 ? "s" : ""} rangé${bought.length > 1 ? "s" : ""} dans tes ingrédients`);
  });
  $("shop-share").addEventListener("click", e => {
    const items = shop.filter(x => !x.done).map(x => `- ${x.label}`);
    shareText("Ma liste de courses", ["Ma liste de courses :", ...items].join("\n"), e.currentTarget);
  });
  $("shop-clear").addEventListener("click", () => {
    if (!window.confirm("Vider toute la liste de courses ?")) return;
    shop = []; saveShop(); renderShop();
  });
}

/* ---------- Conservation ---------- */

function openTips() {
  const mine = t => (t.ids || []).some(id => have.has(id));
  const sorted = TIPS.slice().sort((a, b) => Number(mine(b)) - Number(mine(a)));
  $("tips").innerHTML = sorted.map(t => `
    <article class="tip">
      <h3>${esc(t.titre)}${mine(t) ? '<span class="tag">Tu en as</span>' : ""}</h3>
      <p>${esc(t.texte)}</p>
    </article>`).join("");
  openDialog($("keep"));
  track("conservation", "Conseils de conservation");
}

/* ---------- Imprimer une recette ---------- */

function printRecipe(i) {
  const d = document.querySelector(`#list details[data-i="${i}"]`);
  if (!d) return;
  document.querySelectorAll(".print-target").forEach(x => x.classList.remove("print-target"));
  track("imprime/" + slug(RECIPES[i].title), "Impression : " + RECIPES[i].title);
  d.open = true;
  d.classList.add("print-target");
  document.body.classList.add("print-one");
  const done = () => {
    d.classList.remove("print-target");
    document.body.classList.remove("print-one");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/* ---------- Scanner de code-barres ---------- */

const scan = { stream: null, loop: null, reader: null, last: "", lastAt: 0 };

function scanStatus(text) { $("scan-status").textContent = text; }

function matchProduct(p) {
  const tags = p.categories_tags || [];
  for (const [id, cats] of OFF) if (cats.some(c => tags.includes(c))) return id;
  const name = norm([p.product_name_fr, p.product_name, p.generic_name_fr].filter(Boolean).join(" "));
  for (const [id, , words] of OFF) if ((words || []).some(w => name.includes(norm(w)))) return id;
  return null;
}

function addFound(ok, title, detail) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="${ok ? "ok" : "ko"}" aria-hidden="true">${ok ? "✓" : "?"}</span><span>${esc(title)}${detail ? `<small>${esc(detail)}</small>` : ""}</span>`;
  $("scan-found").prepend(li);
}

async function lookupCode(code) {
  code = String(code).replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(code)) { scanStatus("Ce code ne ressemble pas à un code-barres (8 à 14 chiffres)."); return; }
  scanStatus("Recherche du produit…");
  let product = null;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_fr,generic_name_fr,brands,categories_tags`);
    const j = await res.json();
    if (j && j.status === 1 && j.product) product = j.product;
  } catch (err) {
    scanStatus("Pas de connexion : impossible de reconnaître le produit pour l'instant.");
    return;
  }
  const name = product ? (product.product_name_fr || product.product_name || "Produit sans nom") : "";
  const brand = product && product.brands ? product.brands.split(",")[0].trim() : "";
  const id = product ? matchProduct(product) : null;
  if (id) {
    const already = have.has(id);
    have.add(id);
    haveChanged();
    addFound(true, `${NAMES[id]} ${already ? "(déjà coché)" : "coché"}`, [name, brand].filter(Boolean).join(" · "));
    scanStatus(`${NAMES[id]} : ${already ? "déjà dans tes ingrédients" : "ajouté à tes ingrédients"}. Scanne le suivant !`);
    track("scan/reconnu", "Scan reconnu");
  } else if (product) {
    addFound(false, name, "On ne sait pas encore à quel ingrédient il correspond : coche-le à la main.");
    scanStatus("Produit trouvé, mais pas reconnu.");
    track("scan/non-reconnu", "Scan non reconnu");
  } else {
    addFound(false, `Code ${code}`, "Produit inconnu d'Open Food Facts : coche-le à la main.");
    scanStatus("Produit inconnu.");
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

async function startCamera() {
  const video = $("scan-video");
  $("scan-video-box").hidden = false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $("scan-video-box").hidden = true;
    scanStatus("La caméra n'est pas disponible ici : tape le code-barres à la main.");
    return;
  }
  scanStatus("Ouverture de la caméra…");
  const constraints = { video: { facingMode: { ideal: "environment" } }, audio: false };
  try {
    let formats = [];
    if ("BarcodeDetector" in window) formats = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
    if (formats.includes("ean_13")) {
      scan.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = scan.stream;
      await video.play();
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"].filter(f => formats.includes(f)) });
      scanStatus("Vise un code-barres…");
      const tick = async () => {
        if (!scan.stream) return;
        try { const codes = await detector.detect(video); if (codes.length) onCode(codes[0].rawValue); } catch (err) { /* image suivante */ }
        scan.loop = setTimeout(tick, 250);
      };
      tick();
      return;
    }
    if (!window.ZXing) await loadScript("lib/zxing.min.js?v=6");
    if (!$("scan").hasAttribute("open")) return; // fermé pendant le chargement
    const hints = new Map();
    hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [window.ZXing.BarcodeFormat.EAN_13, window.ZXing.BarcodeFormat.EAN_8, window.ZXing.BarcodeFormat.UPC_A, window.ZXing.BarcodeFormat.UPC_E]);
    scan.reader = new window.ZXing.BrowserMultiFormatReader(hints, 300);
    scanStatus("Vise un code-barres…");
    await scan.reader.decodeFromConstraints(constraints, video, res => { if (res) onCode(res.getText()); });
  } catch (err) {
    stopCamera();
    $("scan-video-box").hidden = true;
    scanStatus(err && err.name === "NotAllowedError"
      ? "Tu as refusé l'accès à la caméra. Autorise-le dans les réglages du navigateur, ou tape le code-barres."
      : "Impossible d'ouvrir la caméra : tape le code-barres à la main.");
  }
}

function stopCamera() {
  clearTimeout(scan.loop);
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
  if (scan.reader) { try { scan.reader.reset(); } catch (err) {} scan.reader = null; }
  const v = $("scan-video");
  if (v) v.srcObject = null;
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
  const m = text.match(/(\d+)\s*(?:à\s*\d+\s*)?(minutes?|min\b|secondes?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const secs = /^s/i.test(m[2]) ? n : n * 60;
  return secs > 0 && secs <= 3600 ? secs : null;
}
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const durLabel = s => s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;

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
  const t = cook.timer;
  if (!t) return;
  const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
  $("cook-timer").hidden = false;
  if (left > 0) {
    $("cook-timer-text").textContent = fmt(left);
    $("cook-timer-stop").textContent = "Arrêter";
  } else if (!t.done) {
    t.done = true;
    clearInterval(t.id);
    $("cook-timer").classList.add("done");
    $("cook-timer-text").textContent = "C'est l'heure !";
    $("cook-timer-stop").textContent = "OK";
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
}

function renderCook() {
  const r = cook.r, c = COLORS[r.color] || COLORS.nuit, total = r.steps.length;
  const dlg = $("cook");
  dlg.style.setProperty("--accent", c.bar);
  dlg.style.setProperty("--accent-tint", c.tint);
  $("cook-title").textContent = r.title;
  $("cook-progress").textContent = cook.step === 0 ? "Avant de commencer" : `Étape ${cook.step} sur ${total}`;
  $("cook-bar").innerHTML = Array.from({ length: total + 1 }, (_, n) => `<span class="${n <= cook.step ? "on" : ""}"></span>`).join("");
  if (cook.step === 0) {
    const extras = r.extra.filter(x => have.has(x)).map(lower);
    $("cook-step").innerHTML = `
      <p class="cook-lead">Sors tout ça :</p>
      <ul class="cook-ings">
        ${r.need.map(opts => `<li>${svg(ICON.check, 22)}<span>${esc(needLabel(opts))}</span></li>`).join("")}
        <li>${svg(ICON.check, 22)}<span>${esc(r.tool)}</span></li>
      </ul>
      ${extras.length ? `<p class="cook-extra">Si tu veux : ${esc(extras.join(", "))}.</p>` : ""}`;
  } else {
    const text = r.steps[cook.step - 1];
    const secs = stepDuration(text);
    $("cook-step").innerHTML = `<p class="cook-text">${esc(text)}</p>
      ${secs ? `<button type="button" class="btn btn-sec cook-timer-btn" data-secs="${secs}">${svg(ICON.timer)} Lancer un minuteur de ${durLabel(secs)}</button>` : ""}`;
  }
  $("cook-prev").disabled = cook.step === 0;
  $("cook-next").textContent = cook.step === 0 ? "C'est parti" : cook.step === total ? "Terminé, bon appétit !" : "Étape suivante";
}

async function openCook(r) {
  track("cuisine/" + slug(r.title), "Mode cuisine : " + r.title);
  cook.r = r; cook.step = 0;
  stopTimer();
  renderCook();
  openDialog($("cook"));
  $("cook-next").focus();
  const ok = await keepAwake();
  $("cook-wake").textContent = ok
    ? "L'écran reste allumé pendant que tu cuisines."
    : "Ton téléphone peut se mettre en veille : touche l'écran de temps en temps.";
}

function moveCook(delta) {
  const next = cook.step + delta;
  if (next > cook.r.steps.length) { closeDialog($("cook")); return; }
  if (next < 0) return;
  cook.step = next;
  renderCook();
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
  dlg.addEventListener("close", () => { releaseAwake(); stopTimer(); });
  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") moveCook(1);
    if (e.key === "ArrowLeft") moveCook(-1);
  });
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
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (err) { /* rien */ }
  if (!ids.length) return false;

  const before = new Set(have);
  if (firstVisit) have = new Set(["plaque"]); // on ne mélange pas avec le colis d'exemple
  ids.forEach(id => have.add(id));
  save();
  track("colis/" + (slug(asso) || "sans-nom"), "Lien colis : " + (asso || "sans nom"));

  const who = asso ? `Colis « <strong>${esc(asso)}</strong> »` : "Colis du jour";
  $("colis-banner-text").innerHTML = `${who} coché : ${ids.length} produit${ids.length > 1 ? "s" : ""}. Ajoute ce que tu as déjà chez toi${firstVisit ? " et vérifie ton équipement" : ""}.`;
  $("colis-banner").hidden = false;
  $("colis-undo").onclick = () => {
    have = before;
    haveChanged();
    $("colis-banner").hidden = true;
  };
  return true;
}

/* ---------- Avis et confidentialité ---------- */

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

/* ---------- Barre du bas (téléphone) ---------- */

let lastJumpCount = null;
function updateJumpBar(n) {
  $("jump-text").innerHTML = n === 0 ? "Voir les recettes"
    : `Voir ${n === 1 ? "ma" : "mes"} <span class="n">${n}</span> recette${n === 1 ? "" : "s"}`;
  if (lastJumpCount !== null && n !== lastJumpCount) {
    const btn = $("jump-btn");
    btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
  }
  lastJumpCount = n;
}

function watchResults() {
  if (!("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => {
    $("jump-bar").classList.toggle("is-hidden", e.isIntersecting || e.boundingClientRect.top < 0);
  }, { rootMargin: "0px 0px -35% 0px" }).observe($("results"));
}

/* Après un saut, on place le focus sur la cible pour les lecteurs d'écran et le clavier. */
function focusOnJump(linkSel, targetId) {
  document.querySelectorAll(linkSel).forEach(a => a.addEventListener("click", () => {
    const t = $(targetId);
    if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
    setTimeout(() => t.focus({ preventScroll: true }), 0);
  }));
}

/* ---------- Démarrage ---------- */

async function init() {
  setupTheme();
  setupStats();
  setupFeedback();
  setupDialogs();
  watchResults();
  focusOnJump("#jump-btn", "results");
  focusOnJump(".back-link", "pantry");
  setupCook();

  let data;
  try {
    const res = await fetch("recettes.json", { cache: "no-cache" });
    data = await res.json();
  } catch (err) {
    $("count-text").textContent = "Impossible de charger les recettes. Vérifie ta connexion et recharge la page.";
    return;
  }
  REGIMES = data.regimes || [];
  RECIPES = data.recettes;
  NUTRI = data.nutrition || {};
  TIPS = data.conservation || [];
  OFF = data.openFoodFacts || [];
  GROUPS = data.groupes.slice();
  GROUPS.forEach(g => g.items.forEach(([id, n]) => { NAMES[id] = n; if (!g.type) INGREDIENTS.add(id); }));
  if (REGIMES.length) {
    const equipAt = GROUPS.findIndex(g => g.type === "equip");
    GROUPS.splice(equipAt + 1, 0, { titre: "Mon régime", type: "regime", note: data.noteRegimes, items: REGIMES.map(rg => [rg.id, rg.nom]) });
  }

  const saved = readJSON(KEYS.have);
  const firstVisit = !Array.isArray(saved);
  have = new Set(firstVisit ? (data.colisExemple || []) : saved);
  const savedFavs = readJSON(KEYS.favs);
  if (Array.isArray(savedFavs)) favs = new Set(savedFavs);
  const savedShop = readJSON(KEYS.shop);
  if (Array.isArray(savedShop)) shop = savedShop.filter(x => x && typeof x.label === "string");
  const savedGroups = readJSON(KEYS.groups);
  if (Array.isArray(savedGroups)) openGroups = savedGroups;
  const fromLink = applyColisLink(firstVisit);
  $("example-note").hidden = !firstVisit || fromLink;

  setupDrawer();
  setupShop();
  setupScan();

  $("clear").addEventListener("click", () => {
    have.clear();
    haveChanged();
    $("example-note").hidden = true;
    $("colis-banner").hidden = true;
  });
  $("search").addEventListener("input", e => filterPantry(e.target.value));
  $("view-all").addEventListener("click", () => setView("all"));
  $("view-favs").addEventListener("click", () => setView("favs"));
  $("random-btn").addEventListener("click", randomRecipe);

  $("list").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const i = Number(btn.dataset.i);
    const r = currentRecipe(i);
    const act = btn.dataset.action;
    if (act === "cook") openCook(r);
    if (act === "share") shareRecipe(r, btn);
    if (act === "fav") toggleFav(r);
    if (act === "print") printRecipe(i);
    if (act === "shop") addMissingToShop(r, analyse(r));
  });

  renderPantry();
  renderDrawerChips();
  renderResults();
  updateShopBadge();
  const first = document.querySelector("#list details");
  if (first) first.open = true;
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
