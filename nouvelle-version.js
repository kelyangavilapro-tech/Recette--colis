#!/usr/bin/env node
/* À lancer avant chaque mise en ligne : node nouvelle-version.js
   Augmente le numéro de version partout, pour que téléphones et tablettes récupèrent la mise à jour. */
const fs = require("fs");
const path = f => __dirname + "/" + f;

const sw = fs.readFileSync(path("sw.js"), "utf8");
const current = Number((sw.match(/const VERSION = "v(\d+)";/) || [])[1]);
if (!current) { console.error("❌ Numéro de version introuvable dans sw.js"); process.exit(1); }
const next = current + 1;

for (const f of ["sw.js", "index.html", "asso.html", "app.js", "asso.js"]) {
  let s = fs.readFileSync(path(f), "utf8");
  s = s.split(`?v=${current}"`).join(`?v=${next}"`).split(`?v=${current}\``).join(`?v=${next}\``)
       .replace(`const VERSION = "v${current}";`, `const VERSION = "v${next}";`)
       .split(`>Version ${current}<`).join(`>Version ${next}<`);
  fs.writeFileSync(path(f), s);
}
console.log(`✅ Version ${current} → ${next}. Tu peux mettre en ligne.`);
