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
  for (const im of a.im || []) vues.add(im.f);
  for (const p of a.pl || []) for (const im of p.im) { vues.add(im.f); if (im.r) ok(ids.has(im.r), 'la vignette mène à un article : ' + im.r); }
}
ok(vues.size === images.length, 'chaque image paraît dans au moins un article (' + vues.size + ' / ' + images.length + ')');
ok(sw.includes("const IMAGES = 'arcanes-images'") && lire('js/illustrations.js').includes("const CACHE = 'arcanes-images'"), 'la page et le service worker partagent le cache des images');

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

console.log(bons + ' épreuve(s) statique(s) réussie(s)');
if (echecs.length) {
  console.log(echecs.length + ' ÉCHEC(S) :');
  for (const e of echecs) console.log('  ✗ ' + e);
  process.exit(1);
}
