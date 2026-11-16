"use strict";
/* Qu'est-ce que je cuisine avec mon colis ?
   Les ingrédients et les recettes sont dans recettes.json : on les modifie là, pas ici. */

const STORAGE_KEY = "colis-have";
const GROUPS_KEY = "colis-groupes-ouverts";
const MOBILE = window.matchMedia("(max-width: 880px)");

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
let openGroups = null; // null = état par défaut (ouverts sur ordinateur, repliés sur téléphone)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Mémoire sur l'appareil ---------- */

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (err) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* stockage indisponible */ }
}
const save = () => writeJSON(STORAGE_KEY, [...have]);

/* ---------- Icônes ---------- */

const svg = (d, size = 20) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  chevron: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  cook: '<path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z"/><path d="M2 11h20M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3"/>',
  check: '<path d="M5 12l5 5L19 7"/>'
};

/* ---------- Garde-manger ---------- */

function groupState(g) {
  const got = g.items.filter(([id]) => have.has(id)).map(([, n]) => n);
  return { count: got.length, names: got.length ? got.join(", ") : "Rien de coché" };
}

function isGroupOpen(gi) {
  if (openGroups) return openGroups.includes(gi);
  return !MOBILE.matches;
}

function renderPantry() {
  const box = $("pantry-groups");
  box.innerHTML = GROUPS.map((g, gi) => {
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
        <div class="chips">
          ${g.items.map(([id, name]) => `
            <span class="chip">
              <input type="checkbox" id="c-${esc(id)}" data-id="${esc(id)}" ${have.has(id) ? "checked" : ""}>
              <label for="c-${esc(id)}">${esc(name)}</label>
            </span>`).join("")}
        </div>
        ${g.type === "equip" ? '<p class="note">Rien coché : on te montre les recettes sans cuisson.</p>' : ""}
      </fieldset>
    </details>`;
  }).join("");

  box.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    if (inp.checked) have.add(inp.dataset.id); else have.delete(inp.dataset.id);
    $("example-note").hidden = true;
    updateGroupHead(inp.closest("details"));
    save(); renderResults();
  }));
  box.querySelectorAll("details.group").forEach(d => d.addEventListener("toggle", () => {
    openGroups = [...box.querySelectorAll("details.group[open]")].map(x => Number(x.dataset.g));
    writeJSON(GROUPS_KEY, openGroups);
  }));
}

function updateGroupHead(details) {
  const s = groupState(GROUPS[Number(details.dataset.g)]);
  details.querySelector("[data-count]").textContent = `${s.count} / ${GROUPS[Number(details.dataset.g)].items.length}`;
  details.querySelector("[data-names]").textContent = s.names;
}

/* ---------- Correspondance ---------- */

/* missing = groupes de "need" dont aucun id n'est coché ; equipOk = sans cuisson ou un équipement coché. */
function analyse(r) {
  const missing = r.need.filter(opts => !opts.some(o => have.has(o)));
  const equipOk = r.equip.length === 0 || r.equip.some(e => have.has(e));
  return { missing, equipOk };
}

const lower = id => NAMES[id].toLowerCase();
/* Libellé d'un ingrédient indispensable : celui qu'on a, sinon les alternatives. */
const needLabel = opts => {
  const got = opts.filter(o => have.has(o));
  return got.length ? NAMES[got[0]] : opts.map(o => NAMES[o]).slice(0, 3).join(" ou ");
};

/* ---------- Cartes recettes ---------- */

function card(r, a, state, i) {
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
    const ok = opts.some(o => have.has(o));
    return `<li class="ing ${ok ? "have" : "missing"}"><span class="mark" aria-hidden="true">${ok ? "✓" : "!"}</span><span>${esc(needLabel(opts))}${ok ? "" : " (à trouver)"}</span></li>`;
  }).join("");
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  const steps = r.steps.map((s, n) => `<li class="step"><b style="background: ${c.bar}">${n + 1}</b><span>${esc(s)}</span></li>`).join("");
  return `
  <details class="recipe" data-state="${state}">
    <summary>
      <span class="bar" style="background: ${c.bar}" aria-hidden="true"></span>
      <span class="recipe-main">
        <h3>${esc(r.title)}</h3>
        <span class="meta"><span>${svg(ICON.clock, 15)} ${r.time} min</span><span>· ${esc(r.tool)}</span><span>· 2 portions</span></span>
        ${pill}
      </span>
      <span class="chev">${svg(ICON.chevron)}</span>
    </summary>
    <div class="recipe-body">
      <div class="actions">
        <button type="button" class="btn btn-pri" data-action="cook" data-i="${i}" style="background: ${c.bar}">${svg(ICON.cook)} Mode cuisine</button>
        <button type="button" class="btn btn-sec" data-action="share" data-i="${i}">${svg(ICON.share)} <span data-label>Partager</span></button>
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
    </div>
  </details>`;
}

function renderResults() {
  const rows = RECIPES.map((r, i) => ({ r, i, a: analyse(r) }));
  const byTime = (x, y) => x.r.time - y.r.time;
  const ready = rows.filter(x => x.a.equipOk && x.a.missing.length === 0).sort(byTime);
  const almost = rows.filter(x => x.a.equipOk && x.a.missing.length === 1).sort(byTime);
  const later = rows.filter(x => !(x.a.equipOk && x.a.missing.length <= 1))
    .sort((x, y) => (x.a.equipOk === y.a.equipOk ? 0 : x.a.equipOk ? -1 : 1) || x.a.missing.length - y.a.missing.length);

  $("count").textContent = ready.length;
  $("count-text").textContent = ready.length === 1
    ? "recette possible tout de suite avec ce que tu as."
    : "recettes possibles tout de suite avec ce que tu as.";

  let html = ready.length
    ? ready.map(x => card(x.r, x.a, "ready", x.i)).join("")
    : '<p class="empty">Aucune recette complète pour l\'instant. Regarde juste en dessous celles où il ne manque qu\'un ingrédient.</p>';
  if (almost.length) html += '<p class="later-title">Il ne te manque qu\'un ingrédient</p>' + almost.map(x => card(x.r, x.a, "almost", x.i)).join("");
  if (later.length) html += '<p class="later-title">Pour plus tard</p>' + later.map(x => card(x.r, x.a, "later", x.i)).join("");

  updateJumpBar(ready.length);

  const list = $("list");
  const openTitles = [...list.querySelectorAll("details[open] h3")].map(h => h.textContent);
  list.innerHTML = html;
  list.querySelectorAll("details").forEach(d => { if (openTitles.includes(d.querySelector("h3").textContent)) d.open = true; });
}

/* ---------- Partager ---------- */

function recipeText(r) {
  const extras = r.extra.filter(x => have.has(x)).map(lower);
  const lines = [
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
    `Trouvé avec « Qu'est-ce que je cuisine avec mon colis ? » : ${location.origin}${location.pathname}`
  ];
  return lines.join("\n");
}

function flash(btn, text) {
  const label = btn.querySelector("[data-label]");
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

async function shareRecipe(r, btn) {
  const text = recipeText(r);
  if (navigator.share) {
    try { await navigator.share({ title: r.title, text }); return; }
    catch (err) { if (err.name === "AbortError") return; }
  }
  flash(btn, (await copyText(text)) ? "Recette copiée !" : "Copie impossible");
}

/* ---------- Mode cuisine ---------- */

const cook = { r: null, step: 0, wake: null };

async function keepAwake() {
  if (!("wakeLock" in navigator)) return false;
  try { cook.wake = await navigator.wakeLock.request("screen"); return true; }
  catch (err) { return false; }
}
function releaseAwake() {
  if (cook.wake) { cook.wake.release().catch(() => {}); cook.wake = null; }
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
    $("cook-step").innerHTML = `<p class="cook-text">${esc(r.steps[cook.step - 1])}</p>`;
  }
  $("cook-prev").disabled = cook.step === 0;
  $("cook-next").textContent = cook.step === 0 ? "C'est parti" : cook.step === total ? "Terminé, bon appétit !" : "Étape suivante";
}

async function openCook(r) {
  cook.r = r; cook.step = 0;
  renderCook();
  const dlg = $("cook");
  if (typeof dlg.showModal === "function") dlg.showModal();
  else { dlg.setAttribute("open", ""); dlg.classList.add("cook-fallback"); document.body.style.overflow = "hidden"; }
  $("cook-next").focus();
  const ok = await keepAwake();
  $("cook-wake").textContent = ok
    ? "L'écran reste allumé pendant que tu cuisines."
    : "Ton téléphone peut se mettre en veille : touche l'écran de temps en temps.";
}

function moveCook(delta) {
  const next = cook.step + delta;
  if (next > cook.r.steps.length) { closeCook(); return; }
  if (next < 0) return;
  cook.step = next;
  renderCook();
}

function closeCook() {
  const dlg = $("cook");
  if (typeof dlg.close === "function" && !dlg.classList.contains("cook-fallback")) { dlg.close(); return; }
  dlg.removeAttribute("open"); dlg.classList.remove("cook-fallback"); document.body.style.overflow = "";
  releaseAwake();
}

function setupCook() {
  const dlg = $("cook");
  $("cook-next").addEventListener("click", () => moveCook(1));
  $("cook-prev").addEventListener("click", () => moveCook(-1));
  $("cook-close").addEventListener("click", closeCook);
  dlg.addEventListener("close", releaseAwake);
  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") moveCook(1);
    if (e.key === "ArrowLeft") moveCook(-1);
    if (e.key === "Escape" && dlg.classList.contains("cook-fallback")) closeCook();
  });
  /* Le verrou d'écran saute quand on change d'appli : on le reprend au retour. */
  document.addEventListener("visibilitychange", () => {
    if (dlg.open && document.visibilityState === "visible") keepAwake();
  });
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
  GROUPS = data.groupes;
  RECIPES = data.recettes;
  GROUPS.forEach(g => g.items.forEach(([id, n]) => { NAMES[id] = n; }));

  const saved = readJSON(STORAGE_KEY);
  have = new Set(Array.isArray(saved) ? saved : (data.colisExemple || []));
  $("example-note").hidden = Array.isArray(saved);
  const savedGroups = readJSON(GROUPS_KEY);
  if (Array.isArray(savedGroups)) openGroups = savedGroups;

  $("clear").addEventListener("click", () => {
    have.clear(); save(); renderPantry(); renderResults();
    $("example-note").hidden = true;
  });

  $("list").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const r = RECIPES[Number(btn.dataset.i)];
    if (btn.dataset.action === "cook") openCook(r);
    if (btn.dataset.action === "share") shareRecipe(r, btn);
  });

  renderPantry();
  renderResults();
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
