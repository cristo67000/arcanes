/*
 * Épreuves statiques : ce qui se vérifie sans navigateur.
 *
 *     node build/essais_statiques.mjs
 *
 * La liste du service worker et les fichiers réels, les scripts de la page,
 * la version écrite à deux endroits, les classes CSS des figures, les icônes,
 * l'absence de l'adresse personnelle, la cohérence du dictionnaire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf-8');

let bons = 0;
const echecs = [];
function ok(condition, message) { if (condition) bons += 1; else echecs.push(message); }

// ── Le service worker et la page ────────────────────────────────────────────
const sw = lire('sw.js');
const version = /const VERSION = '([^']+)'/.exec(sw)[1];
const liste = JSON.parse('[' + /const FICHIERS = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']');
const index = lire('index.html');
ok(index.includes('name="application-version" content="' + version + '"'), 'index.html porte la version du service worker (' + version + ')');
for (const f of liste) {
  if (f === './') continue;
  ok(fs.existsSync(path.join(RACINE, f)), 'le fichier de la coquille existe : ' + f);
}
const scripts = Array.from(index.matchAll(/<script src="([^"]+)"/g)).map((m) => m[1]);
const feuilles = Array.from(index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map((m) => m[1]);
for (const s of scripts.concat(feuilles)) ok(liste.includes(s), 'la page charge ' + s + ', qui est dans la coquille');
const jsFichiers = fs.readdirSync(path.join(RACINE, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)
  .concat(fs.readdirSync(path.join(RACINE, 'js', 'figures')).map((f) => 'js/figures/' + f));
for (const f of jsFichiers) ok(scripts.includes(f), 'le script ' + f + ' est chargé par la page');
ok(new Set(liste).size === liste.length, 'aucun fichier en double dans la coquille');

// ── Le manifeste et les icônes ──────────────────────────────────────────────
const manifeste = JSON.parse(lire('manifest.webmanifest'));
for (const icone of manifeste.icons) ok(fs.existsSync(path.join(RACINE, icone.src)), 'l’icône ' + icone.src + ' existe');
ok(manifeste.icons.some((i) => i.purpose === 'maskable'), 'une icône « masquable » est déclarée');
ok(fs.existsSync(path.join(RACINE, 'icons', 'apercu-1200x630.png')), 'l’image d’aperçu existe');
ok(/og:image" content="https:\/\//.test(index), 'l’image d’aperçu a une adresse absolue');

// ── Les classes des figures existent dans la feuille de style ───────────────
const css = lire('css/figure.css') + lire('css/app.css');
const figures = fs.readdirSync(path.join(RACINE, 'js', 'figures')).map((f) => lire('js/figures/' + f)).join('\n') + lire('js/figure.js');
const classes = new Set(Array.from(figures.matchAll(/'(f-[a-z0-9-]+)/g)).map((m) => m[1]));
for (const c of classes) {
  if (c === 'f-el-' || c === 'f-strate-') continue;   // préfixes complétés à l'exécution
  ok(css.includes('.' + c), 'la classe de figure .' + c + ' est définie');
}
for (const el of ['feu', 'terre', 'air', 'eau']) ok(css.includes('.f-el-' + el), 'la classe .f-el-' + el + ' est définie');
for (let i = 0; i <= 6; i += 1) ok(css.includes('.f-strate-' + i), 'la classe .f-strate-' + i + ' est définie');

// ── Aucune donnée personnelle, aucun style en ligne ─────────────────────────
const interdite = ['cristo67000', 'gmail.com'].join('@');
const tous = [];
(function parcourir(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'captures') continue;
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (/\.(js|mjs|html|css|json|md|txt|webmanifest|py)$/.test(e.name)) tous.push(p);
  }
})(RACINE);
for (const f of tous) {
  const t = fs.readFileSync(f, 'utf-8');
  ok(!t.includes(interdite), 'pas d’adresse personnelle dans ' + path.relative(RACINE, f));
  ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t), 'aucun caractère de contrôle dans ' + path.relative(RACINE, f));
}
for (const f of tous.filter((x) => x.endsWith('.html'))) {
  ok(!/\sstyle="/.test(fs.readFileSync(f, 'utf-8')), 'aucun attribut style dans ' + path.relative(RACINE, f));
}
for (const f of tous.filter((x) => /[\\/]js[\\/]/.test(x))) {
  ok(!/setAttribute\('style'|innerHTML|insertAdjacentHTML|eval\(|new Function/.test(fs.readFileSync(f, 'utf-8')), 'pas de HTML injecté ni d’eval dans ' + path.relative(RACINE, f));
}

// ── Le dictionnaire ─────────────────────────────────────────────────────────
const dico = JSON.parse(lire('data/dictionnaire.json'));
const meta = JSON.parse(lire('data/manifeste.json'));
ok(dico.articles.length === meta.articles, 'le manifeste compte les articles du dictionnaire');
ok(dico.articles.length >= 500, 'le dictionnaire compte au moins 500 articles (' + dico.articles.length + ')');
const ids = new Set(dico.articles.map((a) => a.id));
const orphelins = [];
for (const a of dico.articles) {
  for (const t of [a.d].concat(a.t, a.at || [])) {
    for (const m of t.matchAll(/\[\[([^\]|]+)/g)) if (!ids.has(m[1])) orphelins.push(a.id + ' → ' + m[1]);
  }
  for (const v of a.v || []) if (!ids.has(v)) orphelins.push(a.id + ' → ' + v);
}
ok(orphelins.length === 0, 'tous les renvois mènent à un article (' + orphelins.slice(0, 5).join(', ') + ')');
ok(dico.articles.every((a) => a.d.length >= 40), 'chaque article a une vraie définition');
ok(dico.articles.every((a) => !/ [;:!?]/.test(a.d + a.t.join(''))), 'la ponctuation haute a son espace fine insécable');
ok(dico.articles.every((a) => !/\w'\w/.test(a.d + a.t.join(''))), 'les apostrophes sont typographiques');
ok(dico.portes.every((p) => ids.has(p)), 'les portes d’entrée mènent à des articles');

// ── Les parcours guidés ─────────────────────────────────────────────────────
ok(Array.isArray(dico.parcours) && dico.parcours.length === meta.parcours && dico.parcours.length >= 10,
  'le manifeste compte les parcours du dictionnaire (' + (dico.parcours || []).length + ')');
ok(new Set(dico.parcours.map((p) => p.id)).size === dico.parcours.length, 'chaque parcours a son identifiant');
for (const p of dico.parcours) {
  ok(p.n && p.d && p.d.length >= 40, 'le parcours « ' + p.id + ' » a un nom et une phrase');
  ok(p.e.length >= 4 && p.e.every((e) => ids.has(e)), 'les étapes du parcours « ' + p.id + ' » sont des articles');
  ok(new Set(p.e).size === p.e.length, 'le parcours « ' + p.id + ' » ne repasse pas par la même étape');
}
ok(liste.includes('js/constellation.js') && scripts.includes('js/constellation.js'), 'la carte des liens est dans la page et dans la coquille');

// ── Les catégories ont leur couleur ─────────────────────────────────────────
const theme = lire('css/theme.css');
const app = lire('css/app.css');
for (const c of dico.cats) {
  ok((theme.match(new RegExp('--c-' + c.id + ':', 'g')) || []).length === 3, 'la catégorie « ' + c.nom + ' » a sa couleur, de jour et de nuit');
  ok(app.includes('.cat-' + c.id + ' {'), 'la catégorie « ' + c.nom + ' » a sa classe');
}
ok(dico.articles.every((a) => dico.cats.some((c) => c.id === a.c)), 'chaque article est dans une catégorie connue');

// ── Les illustrations ───────────────────────────────────────────────────────
const illus = JSON.parse(lire('build/illustrations.json'));
const images = Object.values(illus.images);
const fichiersImg = fs.readdirSync(path.join(RACINE, 'img')).filter((f) => !f.startsWith('.'));
ok(images.length >= 50, 'des illustrations sont déclarées (' + images.length + ')');
for (const im of images) {
  ok(fs.existsSync(path.join(RACINE, im.f)), 'l’image existe : ' + im.f);
  ok(/^(public domain|pd|cc0)/i.test(im.lic) || /domaine public/i.test(im.lic), 'licence libre de tout droit pour ' + im.f + ' (' + im.lic + ')');
  ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(im.src), 'la source de ' + im.f + ' est une page de Wikimedia Commons');
  ok(im.l && im.cr, 'l’image ' + im.f + ' a une légende et un crédit');
}
ok(fichiersImg.every((f) => images.some((im) => im.f === 'img/' + f)), 'aucun fichier orphelin dans img/');
ok(fichiersImg.every((f) => f.endsWith('.webp')), 'les images sont en WebP');
const poidsImages = fichiersImg.reduce((n, f) => n + fs.statSync(path.join(RACINE, 'img', f)).size, 0);
ok(poidsImages === meta.octetsImages && fichiersImg.length === meta.images, 'le manifeste compte les images et leur poids');
ok(!liste.some((f) => f.startsWith('img/')), 'les images ne sont pas dans la coquille (elles ont leur cache)');
const vues = new Set();
for (const a of dico.articles) {
  for (const im of a.im || []) {
    vues.add(im.f);
    // une figure découpée ne paraît que posée par l'animation d'une autre image
    for (const e of (im.an && im.an.e) || []) if (e.image) { vues.add(e.image.f); ok(fs.existsSync(path.join(RACINE, e.image.f)), 'la figure animée existe : ' + e.image.f); }
  }
  for (const p of a.pl || []) for (const im of p.im) { vues.add(im.f); if (im.r) ok(ids.has(im.r), 'la vignette mène à un article : ' + im.r); }
}
ok(vues.size === images.length, 'chaque image paraît dans au moins un article (' + vues.size + ' / ' + images.length + ')');
ok(sw.includes("const IMAGES = 'arcanes-images'") && lire('js/illustrations.js').includes("const CACHE = 'arcanes-images'"), 'la page et le service worker partagent le cache des images');

// ── Les sons ────────────────────────────────────────────────────────────────
const sonsDecl = JSON.parse(lire('build/sons.json')).sons;
const fichiersSon = fs.readdirSync(path.join(RACINE, 'son')).filter((f) => !f.startsWith('.'));
ok(Object.keys(sonsDecl).length >= 20, 'des sons sont déclarés (' + Object.keys(sonsDecl).length + ')');
for (const s of Object.values(sonsDecl)) {
  ok(fs.existsSync(path.join(RACINE, s.f)), 'le son existe : ' + s.f);
  ok(/^(public domain|pd|cc0)/i.test(s.lic), 'licence libre de tout droit pour ' + s.f + ' (' + s.lic + ')');
  ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(s.src), 'la source de ' + s.f + ' est une page de Wikimedia Commons');
  ok(s.ti && s.cr && s.d > 0, 'le son ' + s.f + ' a un titre, un crédit et une durée');
}
ok(fichiersSon.every((f) => f.endsWith('.mp3') && Object.values(sonsDecl).some((s) => s.f === 'son/' + f)), 'aucun fichier orphelin dans son/, et tout y est en MP3');
const poidsSons = fichiersSon.reduce((n, f) => n + fs.statSync(path.join(RACINE, 'son', f)).size, 0);
ok(poidsSons === meta.octetsSons && fichiersSon.length === meta.sons, 'le manifeste compte les sons et leur poids');
ok(!liste.some((f) => f.startsWith('son/')), 'les sons ne sont pas dans la coquille (ils ont leur cache)');
ok(sw.includes("const SONS = 'arcanes-sons'") && lire('js/sons.js').includes("const CACHE = 'arcanes-sons'"), 'la page et le service worker partagent le cache des sons');
const entendus = new Set();
for (const a of dico.articles) for (const s of a.so || []) entendus.add(s.f);
ok(entendus.size === Object.keys(sonsDecl).length, 'chaque son s’écoute dans au moins un article (' + entendus.size + ')');
ok(!/autoplay/i.test(lire('js/sons.js') + lire('js/animations.js') + index), 'aucun son ne joue tout seul');

// ── Les images animées ──────────────────────────────────────────────────────
const recettes = Array.from(lire('js/sons.js').matchAll(/^ {4}(\w+)\(c, t, s\) \{/gm)).map((m) => m[1]);
const effets = Array.from(/const EFFETS = \{([\s\S]*?)\n  \};/.exec(lire('js/animations.js'))[1].matchAll(/^ {4}(\w+)\(e, c\) \{/gm)).map((m) => m[1]);
let animees = 0;
for (const a of dico.articles) {
  for (const im of a.im || []) {
    if (!im.an) continue;
    animees += 1;
    ok(im.an.e.length && im.an.e.every((e) => effets.includes(e.t)), 'les effets de ' + im.f + ' sont connus de js/animations.js');
    if (im.an.so) ok(im.an.so.s ? recettes.includes(im.an.so.s) : fs.existsSync(path.join(RACINE, im.an.so.f)), 'le son de l’animation de ' + im.f + ' existe');
  }
}
ok(animees >= meta.animations && meta.animations >= 20, 'des images s’animent (' + meta.animations + ')');
ok(effets.length >= 8 && recettes.length >= 10, 'les effets et les bruits de synthèse sont déclarés (' + effets.length + ', ' + recettes.length + ')');

// ── Les repères et les liens « Pour aller plus loin » ───────────────────────
const avecReperes = dico.articles.filter((a) => a.re);
ok(avecReperes.length >= 150, 'des biographies ont leurs repères (' + avecReperes.length + ')');
ok(avecReperes.every((a) => a.re.length >= 2 && a.re.every((r) => r.length === 2 && r[0] && r[1])), 'chaque repère a une date et un fait');
ok(dico.articles.filter((a) => a.c === 'figures').every((a) => a.re), 'chaque figure a ses repères');
const adresses = new Set();
let liensBons = true;
for (const a of dico.articles) {
  for (const l of a.li || []) {
    if (!(l.length === 3 && l[0] && l[1] && /^https:\/\/[^\s"<>]+$/.test(l[2]))) liensBons = false;
    adresses.add(l[2]);
  }
}
ok(liensBons, 'chaque lien extérieur a sa source, son libellé et une adresse https');
ok(dico.articles.filter((a) => a.li).length >= 500, 'la plupart des articles mènent ailleurs (' + adresses.size + ' adresses)');
ok(!liste.some((f) => f.includes('liens')), 'les sources des liens ne sont pas dans la coquille');
ok(lire('confidentialite.html').includes('Pour aller plus loin'), 'la page de confidentialité parle des liens extérieurs');

// ── La carte des lieux ──────────────────────────────────────────────────────
ok(liste.includes('data/carte.json') && liste.includes('js/carte.js'), 'le fond de carte et son module sont dans la coquille');
const carte = JSON.parse(lire('data/carte.json'));
ok(carte.projection === 'mercator' && carte.taille > 0 && carte.cadre.length === 4, 'le fond de carte dit sa projection et son cadre');
for (const couche of ['terre', 'lacs', 'fleuves', 'frontieres']) {
  ok(typeof carte.couches[couche] === 'string' && /^M\d/.test(carte.couches[couche]) && !/[^Mlz0-9 -]/.test(carte.couches[couche]), 'la couche « ' + couche + ' » est un chemin SVG relatif');
}
ok(carte.villes.length >= 300 && carte.villes.every((v) => v.length === 4 && v[0] && v[3] >= 1 && v[3] <= 5), 'les villes de repère ont un nom, une position et un rang (' + carte.villes.length + ')');
const lieux = dico.articles.filter((a) => a.g);
ok(lieux.length >= 40, 'des lieux sont sur la carte (' + lieux.length + ')');
ok(lieux.length === meta.lieux, 'le manifeste compte les lieux');
ok(lieux.every((a) => a.g.length === 2 && Math.abs(a.g[0]) <= carte.latMax && Math.abs(a.g[1]) <= 180 && a.lo), 'chaque lieu a des coordonnées sur la carte et sa localisation');
ok(dico.articles.filter((a) => a.c === 'lieux').every((a) => a.g), 'chaque article de la catégorie « Lieux » est sur la carte');
const doublons = lieux.filter((a, i) => lieux.some((b, j) => j < i && b.g[0] === a.g[0] && b.g[1] === a.g[1]));
ok(doublons.length === 0, 'deux lieux ne partagent pas les mêmes coordonnées (' + doublons.map((a) => a.id).join(', ') + ')');
ok(index.includes('data-vue="carte"') && index.includes('id="vue-carte"'), 'l’onglet « Carte » est dans la page');
ok(/connect-src 'self'/.test(index) && !/tile|openstreetmap\.org\/[^"]*\.png/.test(index), 'la carte ne charge aucune tuile : la politique de sécurité reste fermée');
ok(lire('confidentialite.html').includes('Me situer'), 'la page de confidentialité parle de la position');

// ── Les extraits ────────────────────────────────────────────────────────────
const extraits = dico.articles.flatMap((a) => (a.ex || []).map((x) => [a.id, x]));
ok(extraits.length >= 20 && extraits.length === meta.extraits, 'des extraits d’œuvres sont cités (' + extraits.length + ')');
ok(extraits.every(([, [p, ref, li]]) => p.length && p.every((t) => t.length > 20 && !/\/\/|¶|\[\[/.test(t)) && /\*[^*]+\*/.test(ref) && li.length), 'chaque extrait a son texte, sa référence avec le titre et ses liens');
// data.bnf.fr : la notice de la BnF, quand aucune numérisation libre n'existe (Fulcanelli)
ok(extraits.every(([, [, , li]]) => li.every((l) => l.length === 3 && /^https:\/\/(gallica\.bnf\.fr|(fr|en)\.wikisource\.org|archive\.org|data\.bnf\.fr)\//.test(l[2]))), 'les extraits mènent au livre : Gallica, Wikisource, l’Internet Archive ou la notice de la BnF');
ok(extraits.filter(([, [, , li]]) => li.some((l) => l[2].includes('gallica.bnf.fr'))).length >= 15, 'la plupart des extraits mènent à Gallica');

console.log(bons + ' épreuve(s) statique(s) réussie(s)');
if (echecs.length) {
  console.log(echecs.length + ' ÉCHEC(S) :');
  for (const e of echecs) console.log('  ✗ ' + e);
  process.exit(1);
}
