/*
 * Une page web par article, pour les moteurs de recherche et les liens
 * partagés : a/<id>.html, et le plan du site, sitemap.xml.
 *
 *     node build/construire.mjs     les écrit à la fin de la construction
 *
 * Chaque page est du HTML simple, lisible sans script (sa politique de sécurité
 * n'en permet aucun) : le nom, les dates, l'image de tête, la définition, le
 * texte, les extraits, les repères, les renvois — qui mènent aux pages des
 * autres articles —, et un lien qui ouvre l'article dans l'application, avec
 * ses images, ses sons, sa carte des liens et ses parcours. Les balises Open
 * Graph donnent à un lien partagé son titre, sa définition et son image.
 */
import fs from 'node:fs';
import path from 'node:path';

const ADRESSE = 'https://cristo67000.github.io/arcanes/';

const echapper = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Le texte d'un article en HTML : renvois [[id|libellé]] vers les autres
 * pages, *italique*, le reste échappé. Un nom commun cité sans libellé prend
 * une minuscule en cours de phrase, comme dans l'application. */
function enHtml(texte, parId) {
  return echapper(texte)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (tout, id, libelle, position, chaine) => {
      const a = parId.get(id);
      let nom = libelle || (a ? a.n : id);
      if (!libelle && a && a.mn && !/(^|[.!?…])\s*$/.test(chaine.slice(0, position))) nom = nom.charAt(0).toLocaleLowerCase('fr') + nom.slice(1);
      return a ? '<a href="' + encodeURIComponent(id) + '.html">' + nom + '</a>' : nom;
    })
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
}

/* Le texte sans balises, pour les métadonnées. */
const nu = (texte, parId) => String(texte || '')
  .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (t, id, l) => l || (parId.get(id) || {}).n || id)
  .replace(/\*/g, '');

function page(a, parId, categories) {
  const cat = (categories.find((c) => c.id === a.c) || {}).nom || '';
  const def = nu(a.d, parId);
  const im = a.im && a.im[0];
  const apercu = im ? ADRESSE + im.f : ADRESSE + 'icons/apercu-1200x630.png';
  const app = '../index.html?article=' + encodeURIComponent(a.id);
  const lignes = [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'none\'; style-src \'self\'; img-src \'self\' data:; connect-src \'none\'; base-uri \'self\'; form-action \'none\'; object-src \'none\'">',
    '  <meta name="referrer" content="no-referrer">',
    '  <title>' + echapper(a.n) + ' — Arcanes</title>',
    '  <meta name="description" content="' + echapper(def) + '">',
    '  <link rel="canonical" href="' + ADRESSE + 'a/' + encodeURIComponent(a.id) + '.html">',
    '  <meta property="og:type" content="article">',
    '  <meta property="og:site_name" content="Arcanes">',
    '  <meta property="og:title" content="' + echapper(a.n) + ' — Arcanes">',
    '  <meta property="og:description" content="' + echapper(def) + '">',
    '  <meta property="og:url" content="' + ADRESSE + 'a/' + encodeURIComponent(a.id) + '.html">',
    '  <meta property="og:image" content="' + apercu + '">',
    '  <meta property="og:locale" content="fr_FR">',
    '  <meta name="twitter:card" content="' + (im ? 'summary' : 'summary_large_image') + '">',
    '  <link rel="stylesheet" href="../css/page.css">',
    '  <link rel="icon" href="../icons/icon-192.png" type="image/png">',
    '</head>',
    '<body class="page-article">',
    '',
    '<p class="retour"><a href="../">← Arcanes</a> · <a href="' + app + '">Ouvrir dans l’application</a></p>',
    '<p class="rubrique-page">' + echapper(cat) + '</p>',
    '<h1>' + echapper(a.n) + '</h1>',
  ];
  const dates = a.da || (typeof a.an === 'number' && a.c !== 'figures' ? (a.an < 0 ? Math.abs(a.an) + ' av. J.-C.' : String(a.an)) : '');
  if (dates) lignes.push('<p class="dates">' + echapper(dates) + '</p>');
  if (a.lo) lignes.push('<p class="dates">' + echapper(a.lo) + '</p>');
  if (im) {
    lignes.push('<figure>');
    lignes.push('  <img src="../' + im.f + '?v=' + im.v + '" width="' + im.w + '" height="' + im.h + '" alt="' + echapper(nu(im.l, parId)) + '" loading="lazy">');
    lignes.push('  <figcaption>' + enHtml(im.l, parId) + '<br><span class="credit">' + enHtml(im.cr + ' · ' + im.li, parId) + '</span></figcaption>');
    lignes.push('</figure>');
  }
  lignes.push('<p class="definition">' + enHtml(a.d, parId) + '</p>');
  for (const t of a.t || []) lignes.push('<p>' + enHtml(t, parId) + '</p>');
  if (a.at) lignes.push('<p class="attention"><strong>À ne pas confondre.</strong> ' + enHtml(a.at, parId) + '</p>');
  if (a.ex && a.ex.length) {
    lignes.push('<h2>' + (a.ex.length > 1 ? 'Extraits' : 'Extrait') + '</h2>');
    for (const [paras, ref, liens] of a.ex) {
      lignes.push('<blockquote>' + paras.map((p) => '<p>' + echapper(p).replace(/\n/g, '<br>') + '</p>').join('') + '</blockquote>');
      lignes.push('<p class="source">— ' + enHtml(ref, parId) + (liens || []).map((l) => ' · <a href="' + echapper(l[2]) + '" rel="noopener">' + echapper(l[0]) + '</a>').join('') + '</p>');
    }
  }
  if (a.re && a.re.length) {
    lignes.push('<h2>Repères</h2>');
    lignes.push('<ul class="reperes">' + a.re.map((r) => '<li><strong>' + echapper(r[0]) + '</strong> — ' + enHtml(r[1], parId) + '</li>').join('') + '</ul>');
  }
  if (a.oe && a.oe.length) {
    lignes.push('<h2>Œuvres principales</h2>');
    lignes.push('<ul>' + a.oe.map((o) => '<li>' + echapper(o) + '</li>').join('') + '</ul>');
  }
  const voisins = (a.v || []).concat((a.ci || []).filter((id) => !(a.v || []).includes(id))).filter((id) => parId.has(id));
  if (voisins.length) {
    lignes.push('<h2>Voir aussi</h2>');
    lignes.push('<p class="voisins">' + voisins.map((id) => '<a href="' + encodeURIComponent(id) + '.html">' + echapper(parId.get(id).n) + '</a>').join(' · ') + '</p>');
  }
  if (a.li && a.li.length) {
    lignes.push('<h2>Pour aller plus loin</h2>');
    lignes.push('<ul>' + a.li.map((l) => '<li><a href="' + echapper(l[2]) + '" rel="noopener">' + echapper(l[0]) + ' : ' + echapper(l[1]) + '</a></li>').join('') + '</ul>');
  }
  lignes.push('<p class="pied"><a href="' + app + '">Lire « ' + echapper(a.n) + ' » dans Arcanes</a>, avec ses images, ses sons, sa carte des liens et ses parcours, hors ligne et sans publicité.</p>');
  lignes.push('</body>', '</html>', '');
  return lignes.join('\n');
}

/* Écrit les pages (et retire celles des articles disparus) ; rend leur nombre. */
export function ecrirePages(racine, dico) {
  const dossier = path.join(racine, 'a');
  fs.mkdirSync(dossier, { recursive: true });
  const parId = new Map(dico.articles.map((a) => [a.id, a]));
  const attendues = new Set();
  for (const a of dico.articles) {
    const nom = a.id + '.html';
    attendues.add(nom);
    const contenu = page(a, parId, dico.cats);
    const chemin = path.join(dossier, nom);
    if (!fs.existsSync(chemin) || fs.readFileSync(chemin, 'utf-8') !== contenu) fs.writeFileSync(chemin, contenu, 'utf-8');
  }
  for (const f of fs.readdirSync(dossier)) if (f.endsWith('.html') && !attendues.has(f)) fs.unlinkSync(path.join(dossier, f));
  const plan = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', '  <url><loc>' + ADRESSE + '</loc></url>']
    .concat(dico.articles.map((a) => '  <url><loc>' + ADRESSE + 'a/' + encodeURIComponent(a.id) + '.html</loc></url>'), ['</urlset>', '']);
  fs.writeFileSync(path.join(racine, 'sitemap.xml'), plan.join('\n'), 'utf-8');
  return attendues.size;
}
