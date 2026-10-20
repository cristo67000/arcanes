/*
 * Construit data/carte.json, le fond de la carte des lieux.
 *
 *     node build/fond_de_carte.mjs
 *
 * Le fond vient de Natural Earth (domaine public) : terres, lacs, fleuves,
 * frontières et villes au 1:50 000 000 (les villes au 1:10 000 000). Les fichiers
 * sont téléchargés une fois dans build/.sources-carte/, hors du dépôt.
 *
 * Tout est projeté ici, une fois pour toutes, en Mercator « web » — celle des
 * cartes en ligne, que l'œil connaît — sur un monde de TAILLE unités de côté,
 * en coordonnées entières. js/carte.js projette les lieux par la même formule.
 * Les tracés sont simplifiés (Douglas-Peucker), finement sur l'Europe et la
 * Méditerranée où sont presque tous les lieux, plus grossièrement ailleurs,
 * puis écrits comme des chemins SVG relatifs : « M x y l dx dy … z ».
 *
 * La carte est faite pour situer un lieu, pas pour s'y guider : pour la route,
 * la fiche du lieu ouvre l'application de cartes du téléphone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.dirname(ICI);
const SOURCES = path.join(ICI, '.sources-carte');
const DEPOT = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

export const TAILLE = 131072;           // le monde, en unités (2^17)
const LAT_MAX = 78;                     // au-delà, rien à situer
const LAT_MIN = -58;
/* La zone fine : l'Europe, la Méditerranée, le Proche-Orient. */
const ZONE = { ouest: -14, est: 48, sud: 22, nord: 64 };
const TOLERANCE_FINE = 2.2;             // en unités : ≈ 0,5 km à 45° de latitude
const TOLERANCE_LARGE = 14;

/* Des villes de repère qui manquent au jeu de Natural Earth, autour des lieux
 * du Languedoc et des Pyrénées (coordonnées de Wikidata). */
const VILLES_EN_PLUS = [
  ['Carcassonne', 43.2158, 2.3514, 3],
  ['Foix', 42.9653, 1.6069, 4],
  ['Narbonne', 43.1847, 3.0036, 4],
  ['Limoux', 43.0569, 2.2186, 5],
  ['Quillan', 42.8753, 2.1819, 5],
  ['Glastonbury', 51.1475, -2.7175, 5],
  ['Chartres', 48.4467, 1.4883, 4],
  ['Chinon', 47.1669, 0.2428, 5],
  ['Sintra', 38.7974, -9.3904, 5],
  ['Paderborn', 51.7167, 8.7667, 4],
];

const ecrire = (s) => process.stdout.write(s);

async function source(nom) {
  const fichier = path.join(SOURCES, nom + '.geojson');
  if (!fs.existsSync(fichier)) {
    fs.mkdirSync(SOURCES, { recursive: true });
    ecrire('  téléchargement de ' + nom + '… ');
    const r = await fetch(DEPOT + nom + '.geojson', { headers: { 'User-Agent': 'ArcanesCarte/1.0' } });
    if (!r.ok) throw new Error(nom + ' : HTTP ' + r.status);
    fs.writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
    console.log('fait');
  }
  return JSON.parse(fs.readFileSync(fichier, 'utf-8'));
}

// ── Projection ──────────────────────────────────────────────────────────────

export function projeter(lon, lat) {
  const phi = Math.max(LAT_MIN, Math.min(LAT_MAX, lat)) * Math.PI / 180;
  return [
    (lon + 180) / 360 * TAILLE,
    (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2 * TAILLE,
  ];
}

const dansLaZone = (lon, lat) => lon >= ZONE.ouest && lon <= ZONE.est && lat >= ZONE.sud && lat <= ZONE.nord;

// ── Simplification ──────────────────────────────────────────────────────────

/* Douglas-Peucker, où chaque point porte sa propre tolérance : fine dans la
 * zone, large ailleurs. Une côte qui traverse la limite n'a pas de couture. */
function simplifier(points, tolerances) {
  const n = points.length;
  if (n <= 2) return points;
  const garder = new Uint8Array(n);
  garder[0] = garder[n - 1] = 1;
  const pile = [[0, n - 1]];
  while (pile.length) {
    const [a, b] = pile.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const long2 = dx * dx + dy * dy;
    let pire = -1;
    let ecart = 0;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      let d;
      if (long2 === 0) d = Math.hypot(px - ax, py - ay);
      else d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(long2);
      const relatif = d / tolerances[i];
      if (relatif > ecart) { ecart = relatif; pire = i; }
    }
    if (pire !== -1 && ecart > 1) {
      garder[pire] = 1;
      pile.push([a, pire], [pire, b]);
    }
  }
  return points.filter((p, i) => garder[i]);
}

/* Une ligne ou un anneau : projeté, simplifié, arrondi, sans doublons. */
function preparer(coords, ferme, toleranceMin) {
  const tol = coords.map(([lon, lat]) => Math.max(toleranceMin || 0, dansLaZone(lon, lat) ? TOLERANCE_FINE : TOLERANCE_LARGE));
  const pts = coords.map(([lon, lat]) => projeter(lon, lat));
  let s = simplifier(pts, tol).map(([x, y]) => [Math.round(x), Math.round(y)]);
  s = s.filter((p, i) => i === 0 || p[0] !== s[i - 1][0] || p[1] !== s[i - 1][1]);
  if (ferme && s.length < 4) return null;
  if (!ferme && s.length < 2) return null;
  return s;
}

/* Les points d'un tracé en chemin SVG relatif : « M x y l dx dy dx dy… ». */
function chemin(trace, ferme) {
  let d = 'M' + trace[0][0] + ' ' + trace[0][1] + 'l';
  let premier = true;
  for (let i = 1; i < trace.length; i += 1) {
    if (ferme && i === trace.length - 1 && trace[i][0] === trace[0][0] && trace[i][1] === trace[0][1]) break;
    const dx = trace[i][0] - trace[i - 1][0];
    const dy = trace[i][1] - trace[i - 1][1];
    d += (premier || dx < 0 ? '' : ' ') + dx + (dy < 0 ? '' : ' ') + dy;
    premier = false;
  }
  return d + (ferme ? 'z' : '');
}

function anneaux(geometrie) {
  if (!geometrie) return [];
  if (geometrie.type === 'Polygon') return geometrie.coordinates;
  if (geometrie.type === 'MultiPolygon') return geometrie.coordinates.flat();
  return [];
}
function lignes(geometrie) {
  if (!geometrie) return [];
  if (geometrie.type === 'LineString') return [geometrie.coordinates];
  if (geometrie.type === 'MultiLineString') return geometrie.coordinates;
  return [];
}

function boite(coords) {
  let o = 180, e = -180, s = 90, n = -90;
  for (const [lon, lat] of coords) { o = Math.min(o, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat); }
  return { o, e, s, n };
}
const touche = (b, z) => b.e >= z.ouest && b.o <= z.est && b.n >= z.sud && b.s <= z.nord;
const surface = (coords) => { const b = boite(coords); return (b.e - b.o) * (b.n - b.s); };

// ── Assemblage ──────────────────────────────────────────────────────────────

async function main() {
  const terre = await source('ne_50m_land');
  const lacs = await source('ne_50m_lakes');
  const fleuves = await source('ne_50m_rivers_lake_centerlines');
  const frontieres = await source('ne_50m_admin_0_boundary_lines_land');
  const villes = await source('ne_10m_populated_places');

  const couches = {};
  let points = 0;

  // Les terres : on laisse les îlots minuscules hors de la zone
  const t = [];
  for (const f of terre.features) {
    for (const anneau of anneaux(f.geometry)) {
      const b = boite(anneau);
      if (b.n < LAT_MIN) continue;
      if (!touche(b, ZONE) && surface(anneau) < 0.25) continue;
      const tr = preparer(anneau, true);
      if (tr) { t.push(chemin(tr, true)); points += tr.length; }
    }
  }
  couches.terre = t.join('');

  // Les lacs : tous ceux de la zone, les grands ailleurs
  const l = [];
  for (const f of lacs.features) {
    for (const anneau of anneaux(f.geometry)) {
      const b = boite(anneau);
      if (!touche(b, ZONE) && f.properties.scalerank > 1) continue;
      const tr = preparer(anneau, true);
      if (tr) { l.push(chemin(tr, true)); points += tr.length; }
    }
  }
  couches.lacs = l.join('');

  // Les fleuves : ceux qui passent dans la zone élargie (le Nil jusqu'à sa source)
  const large = { ouest: ZONE.ouest - 6, est: ZONE.est + 12, sud: 0, nord: ZONE.nord + 4 };
  const fl = [];
  for (const f of fleuves.features) {
    if (f.properties.featurecla && /lake/i.test(f.properties.featurecla)) continue;
    for (const ligne of lignes(f.geometry)) {
      if (!touche(boite(ligne), large)) continue;
      if (f.properties.scalerank > 6) continue;
      const tr = preparer(ligne, false, 3);
      if (tr) { fl.push(chemin(tr, false)); points += tr.length; }
    }
  }
  couches.fleuves = fl.join('');

  // Les frontières terrestres
  const fr = [];
  for (const f of frontieres.features) {
    for (const ligne of lignes(f.geometry)) {
      const b = boite(ligne);
      if (b.n < LAT_MIN) continue;
      const tr = preparer(ligne, false, touche(b, ZONE) ? 3 : 0);
      if (tr) { fr.push(chemin(tr, false)); points += tr.length; }
    }
  }
  couches.frontieres = fr.join('');

  /* Les villes de repère : [nom, x, y, rang]. Le rang décide à quel zoom le
   * nom paraît : 1 les capitales et métropoles du monde, 5 les petites villes
   * de la zone. */
  const v = [];
  const vus = new Set();
  for (const f of villes.features) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    if (lat > LAT_MAX || lat < LAT_MIN) continue;
    const capitale = /Admin-0 capital/.test(p.FEATURECLA || '') && !/alt|Admin-0 capital alt/.test(p.FEATURECLA || '');
    let rang = 0;
    if (dansLaZone(lon, lat)) {
      if (p.SCALERANK <= 1 || (capitale && p.SCALERANK <= 4)) rang = 1;
      else if (p.SCALERANK <= 3 || capitale) rang = 2;
      else if (p.SCALERANK <= 4) rang = 3;
      else if (p.SCALERANK <= 6) rang = 4;
      else if (p.SCALERANK <= 7 && p.POP_MAX >= 100000) rang = 5;
    } else if (p.SCALERANK <= 1 || (capitale && p.POP_MAX >= 1500000)) {
      rang = 1;
    } else if (capitale || p.SCALERANK <= 2) {
      rang = 3;
    }
    if (!rang) continue;
    const nom = p.NAME_FR || p.NAME;
    const cle = nom + '|' + Math.round(lon) + '|' + Math.round(lat);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const [x, y] = projeter(lon, lat);
    v.push([nom, Math.round(x), Math.round(y), rang]);
  }
  for (const [nom, lat, lon, rang] of VILLES_EN_PLUS) {
    if (v.some((x) => x[0] === nom)) continue;
    const [x, y] = projeter(lon, lat);
    v.push([nom, Math.round(x), Math.round(y), rang]);
  }
  v.sort((a, b) => a[3] - b[3] || a[0].localeCompare(b[0], 'fr'));

  const [, haut] = projeter(0, LAT_MAX);
  const [, bas] = projeter(0, LAT_MIN);
  const sortie = {
    format: 1,
    source: 'Natural Earth (domaine public), naturalearthdata.com',
    projection: 'mercator',
    taille: TAILLE,
    latMax: LAT_MAX,
    latMin: LAT_MIN,
    cadre: [0, Math.round(haut), TAILLE, Math.round(bas - haut)],
    couches,
    villes: v,
  };
  const json = JSON.stringify(sortie);
  fs.writeFileSync(path.join(RACINE, 'data', 'carte.json'), json, 'utf-8');
  console.log('data/carte.json : ' + Math.round(json.length / 1024) + ' Ko, ' + points + ' points, ' + v.length + ' villes ('
    + Object.entries(couches).map(([k, d]) => k + ' ' + Math.round(d.length / 1024) + ' Ko').join(', ') + ')');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
