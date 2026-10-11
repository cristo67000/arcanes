/*
 * Épreuve du site PUBLIÉ, une fois Pages à jour :
 *
 *     node build/essais_en_ligne.mjs [https://cristo67000.github.io/arcanes/]
 *
 *   1. chaque fichier que le service worker range est servi tel qu'il est dans le
 *      dépôt (empreinte SHA-256 comparée au contenu de HEAD, pas à la copie de
 *      travail, dont les fins de ligne peuvent différer) — ce n'est pas le code
 *      HTTP qui prouve la mise en ligne, c'est le contenu ;
 *   2. dans un Chrome neuf, l'application démarre sur le site réel, sans erreur,
 *      et son service worker prend la main ;
 *   3. le même profil est relancé avec le domaine COUPÉ (résolution de nom
 *      refusée) : l'application doit démarrer, montrer un article complet et
 *      retrouver la note écrite en ligne. C'est la seule façon d'éprouver le
 *      hors-ligne du site publié ; les émulations de réseau du protocole ne
 *      coupent pas ce que répond un service worker.
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = (process.argv[2] || 'https://cristo67000.github.io/arcanes/').replace(/\/?$/, '/');
const DOMAINE = new URL(SITE).hostname;
const ARTICLES = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'manifeste.json'), 'utf-8')).articles;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let bons = 0;
const echecs = [];
function ok(condition, message) { if (condition) bons += 1; else echecs.push(message); }

// ── 1. Le contenu servi est celui du dépôt ──────────────────────────────────
const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf-8');
const fichiers = [...sw.slice(sw.indexOf('const FICHIERS'), sw.indexOf('];', sw.indexOf('const FICHIERS'))).matchAll(/'([^']+)'/g)]
  .map((m) => m[1]).filter((f) => f !== './').concat(['sw.js', 'icons/apercu-1200x630.png']);
const differents = [];
for (const f of fichiers) {
  const reponse = await fetch(SITE + f + '?verif=' + Date.now(), { cache: 'no-store' });
  if (!reponse.ok) { differents.push(f + ' : ' + reponse.status); continue; }
  const distant = crypto.createHash('sha256').update(Buffer.from(await reponse.arrayBuffer())).digest('hex');
  const depot = execFileSync('git', ['show', 'HEAD:' + f], { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 });
  const local = crypto.createHash('sha256').update(depot).digest('hex');
  if (distant !== local) differents.push(f);
}
ok(differents.length === 0, fichiers.length + ' fichiers comparés au dépôt, différents : ' + differents.join(', '));

// ── 2. Un Chrome neuf sur le site réel ──────────────────────────────────────
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'arcanes-en-ligne-'));
async function session(options, faire) {
  const chrome = await lancerChrome({ port: 9363, profil, options });
  try {
    const onglet = await ouvrirOnglet(chrome, 'about:blank');
    await onglet.envoyer('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
    await faire(onglet);
    return onglet.erreurs;
  } finally {
    await fermerChrome(chrome);
  }
}
const attendre = async (onglet, cond, ms) => {
  const fin = Date.now() + (ms || 15000);
  while (Date.now() < fin) {
    try { if (await onglet.evaluer('return !!(' + cond + ')')) return true; } catch (e) { /* la page change */ }
    await pause(150);
  }
  return false;
};

try {
  const erreurs1 = await session([], async (o) => {
    await o.naviguer(SITE);
    ok(await attendre(o, "document.getElementById('demarrage').hidden === true"), 'en ligne : l’application démarre');
    ok(await o.evaluer('return Dictionnaire.articles.length') === ARTICLES, 'en ligne : ' + ARTICLES + ' articles');
    const sonde = await o.evaluer("try { const c = await caches.open('sonde'); await c.put('/sonde', new Response('x')); await caches.delete('sonde'); return 'ok'; } catch (e) { return String(e); }");
    ok(sonde === 'ok', 'en ligne : l’API Cache fonctionne dans ce Chrome (' + sonde + ')');
    ok(await attendre(o, "navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))", 30000), 'en ligne : le service worker est actif');
    await o.envoyer('Page.reload');
    ok(await attendre(o, "document.getElementById('demarrage').hidden === true && navigator.serviceWorker.controller", 20000), 'en ligne : après rechargement, le service worker contrôle la page');
    const contenu = await o.evaluer("const n = (await caches.keys()).find((k) => k.startsWith('arcanes-coquille-')); return n ? (await (await caches.open(n)).keys()).length : 0");
    ok(contenu >= 38, 'en ligne : la coquille est rangée (' + contenu + ' fichiers)');
    await o.evaluer("await Store.ecrireNote({ id: 'n-essai-en-ligne', ref: 'alchimie', type: 'note', titre: '', texte: 'écrite en ligne', cree: 1, modifie: 1 }); return 1");
  });
  ok(erreurs1.length === 0, 'en ligne : erreurs de page : ' + erreurs1.slice(0, 3).join(' | '));

  // ── 3. Le domaine coupé, même profil ──────────────────────────────────────
  const erreurs2 = await session(['--host-resolver-rules=MAP ' + DOMAINE + ' ~NOTFOUND'], async (o) => {
    await o.naviguer(SITE + '?article=alchimie');
    ok(await attendre(o, "document.getElementById('demarrage').hidden === true"), 'hors ligne : l’application démarre sans le domaine');
    ok(await o.evaluer('return !!navigator.serviceWorker.controller'), 'hors ligne : c’est bien le service worker qui répond');
    ok(await o.evaluer('return Dictionnaire.articles.length') === ARTICLES, 'hors ligne : ' + ARTICLES + ' articles');
    ok(await attendre(o, "Fiche.ref === 'alchimie' && document.querySelector('#fiche .figure svg') && document.querySelector('#fiche a.renvoi') && document.querySelector('#fiche .note-carte')"),
      'hors ligne : article complet (figure, renvois, note écrite en ligne)');
    const reponse = await o.evaluer("try { const r = await fetch('" + SITE + "inconnu-' + Date.now() + '.txt', { cache: 'no-store' }); return r.status; } catch (e) { return 'refusé'; }");
    ok(reponse === 'refusé', 'hors ligne : le domaine est bien injoignable (' + reponse + ')');
  });
  ok(erreurs2.filter((e) => !/ERR_NAME_NOT_RESOLVED|Failed to load resource|Failed to fetch/.test(e)).length === 0, 'hors ligne : erreurs de page : ' + erreurs2.slice(0, 3).join(' | '));
} catch (erreur) {
  echecs.push('EXCEPTION : ' + (erreur && erreur.stack ? erreur.stack : erreur));
} finally {
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* tenu par Chrome */ }
}

console.log(bons + ' contrôles réussis sur ' + SITE + ', ' + echecs.length + ' échec(s).');
for (const e of echecs) console.log('  ✗ ' + e);
process.exit(echecs.length ? 1 : 0);
