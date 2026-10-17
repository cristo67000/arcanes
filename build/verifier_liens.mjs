/*
 * Vérifie en ligne les liens « Pour aller plus loin » du dictionnaire construit.
 *
 *     node build/verifier_liens.mjs            toutes les adresses
 *     node build/verifier_liens.mjs wp         seulement une sorte (wp, en, ws, bnf, ia…)
 *
 * Chaque adresse doit répondre 200 après redirections. Pour Wikipédia et
 * Wikisource, on interroge plutôt l'API du wiki : la page existe, n'est pas
 * une page d'homonymie, et le titre demandé est bien le titre final (une
 * redirection silencieuse vers un autre sujet passerait sinon inaperçue).
 * Rien n'est modifié : le script rend un rapport et un code de sortie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AGENT = 'ArcanesLiens/1.0 (https://cristo67000.github.io/arcanes/; ' + ['cristo67apps', 'gmail.com'].join('@') + ')';
const filtre = process.argv[2] || null;

const dico = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'dictionnaire.json'), 'utf-8'));
const parAdresse = new Map();
for (const a of dico.articles) {
  for (const [, , adresse] of a.li || []) {
    if (!parAdresse.has(adresse)) parAdresse.set(adresse, []);
    parAdresse.get(adresse).push(a.id);
  }
}

function sorteDe(u) {
  const h = new URL(u).hostname;
  if (h === 'fr.wikipedia.org') return 'wp';
  if (h === 'en.wikipedia.org') return 'en';
  if (h === 'fr.wikisource.org') return 'ws';
  if (h === 'data.bnf.fr') return 'bnf';
  if (h === 'archive.org') return 'ia';
  if (h === 'gallica.bnf.fr') return 'gallica';
  return 'url';
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function chercher(url, essais = 4) {
  for (let i = 0; ; i += 1) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': AGENT }, redirect: 'follow' });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      if (i >= essais - 1) throw e;
      await attendre(2000 * (i + 1));
    }
  }
}

/* Les wikis : un appel d'API pour cinquante titres. */
async function verifierWiki(hote, adresses) {
  const echecs = [];
  const titreDe = (u) => decodeURIComponent(new URL(u).pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
  for (let i = 0; i < adresses.length; i += 50) {
    const lot = adresses.slice(i, i + 50);
    const titres = lot.map(titreDe);
    const p = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1',
      prop: 'pageprops', ppprop: 'disambiguation', titles: titres.join('|') });
    const d = await (await chercher('https://' + hote + '/w/api.php?' + p)).json();
    const q = d.query || {};
    const renomme = new Map();
    for (const n of (q.normalized || []).concat(q.redirects || [])) renomme.set(n.from, n.to);
    const pages = new Map((q.pages || []).map((pg) => [pg.title, pg]));
    lot.forEach((u, k) => {
      let t = titres[k];
      const demande = t;
      while (renomme.has(t)) t = renomme.get(t);
      const pg = pages.get(t);
      if (!pg || pg.missing || pg.invalid) echecs.push([u, 'page absente']);
      // sur Wikisource, une « homonymie » est la liste des éditions d'un texte : bienvenue
      else if (pg.pageprops && 'disambiguation' in pg.pageprops && hote !== 'fr.wikisource.org') echecs.push([u, 'page d’homonymie']);
      else if (t !== demande) echecs.push([u, 'redirige vers « ' + t + ' »']);
    });
    await attendre(300);
  }
  return echecs;
}

async function verifierAutres(adresses) {
  const echecs = [];
  let suivant = 0;
  async function ouvrier() {
    while (suivant < adresses.length) {
      const u = adresses[suivant++];
      try {
        const r = await chercher(u);
        if (r.status !== 200) echecs.push([u, 'HTTP ' + r.status]);
        else if (sorteDe(u) === 'ia') {
          // une notice inexistante répond 200 avec une page « Item not available »
          const corps = await r.text();
          if (/Item not available|This item is not available/i.test(corps)) echecs.push([u, 'document indisponible']);
        } else await r.arrayBuffer();
      } catch (e) {
        echecs.push([u, String(e.message || e)]);
      }
      await attendre(400);
    }
  }
  await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
  return echecs;
}

const groupes = new Map();
for (const u of parAdresse.keys()) {
  const s = sorteDe(u);
  if (filtre && s !== filtre) continue;
  if (!groupes.has(s)) groupes.set(s, []);
  groupes.get(s).push(u);
}

const echecs = [];
for (const [s, adresses] of groupes) {
  process.stdout.write(s.padEnd(8) + String(adresses.length).padStart(4) + ' adresse(s)… ');
  const e = s === 'wp' ? await verifierWiki('fr.wikipedia.org', adresses)
    : s === 'en' ? await verifierWiki('en.wikipedia.org', adresses)
      : s === 'ws' ? await verifierWiki('fr.wikisource.org', adresses)
        : await verifierAutres(adresses);
  console.log(e.length ? e.length + ' échec(s)' : 'toutes bonnes');
  echecs.push(...e);
}

if (echecs.length) {
  console.log('\n' + echecs.length + ' LIEN(S) EN DÉFAUT :');
  for (const [u, raison] of echecs) console.log('  ✗ ' + raison.padEnd(28) + ' ' + u + '  (' + parAdresse.get(u).join(', ') + ')');
  process.exit(1);
}
console.log('\n' + Array.from(groupes.values()).reduce((n, l) => n + l.length, 0) + ' adresses vérifiées, toutes bonnes.');
