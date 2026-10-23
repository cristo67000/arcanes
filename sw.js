'use strict';
/*
 * Service worker.
 *
 * Tout ce qu'il faut à l'application — pages, feuilles de style, scripts,
 * figures, icônes, le dictionnaire lui-même et le fond de la carte — est rangé d'un
 * seul bloc, dans un cache propre à la version : « cache d'abord », et hors
 * ligne dès le premier lancement. Les illustrations (une dizaine de Mo) ont
 * leur cache à part, qui survit aux versions : voir plus bas.
 *
 * Une version suivante se prépare dans un autre cache et ne prend la main
 * qu'au feu vert de `js/miseajour.js`, quand la personne a accepté le bandeau :
 * une page ne reçoit jamais qu'un jeu complet d'une seule version. Le cache
 * de l'ancienne version n'est supprimé qu'à l'activation de la nouvelle.
 *
 * ⚠ La liste ci-dessous doit rester celle des fichiers que la page charge :
 * `build/essais.mjs` compare les deux et échoue à la moindre différence.
 */

const VERSION = 'v1.5.0';
const COQUILLE = 'arcanes-coquille-' + VERSION;

const FICHIERS = [
  './',
  'index.html',
  'confidentialite.html',
  'manifest.webmanifest',
  'css/theme.css',
  'css/figure.css',
  'css/app.css',
  'css/page.css',
  'js/outils.js',
  'js/store.js',
  'js/dictionnaire.js',
  'js/rendu.js',
  'js/glyphes.js',
  'js/figure.js',
  'js/figures/kabbale.js',
  'js/figures/maconnerie.js',
  'js/figures/astrologie.js',
  'js/figures/alchimie.js',
  'js/figures/tarot.js',
  'js/figures/symboles.js',
  'js/illustrations.js',
  'js/voix.js',
  'js/editeur.js',
  'js/carte.js',
  'js/fiche.js',
  'js/liste.js',
  'js/frise.js',
  'js/carnet.js',
  'js/cartes.js',
  'js/quiz.js',
  'js/sauvegarde.js',
  'js/installer.js',
  'js/miseajour.js',
  'js/reglages.js',
  'js/app.js',
  'js/demarrage.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'data/manifeste.json',
  'data/dictionnaire.json',
  'data/carte.json',
];

/* La marque des requêtes d'installation : `cache: 'reload'` court-circuite le
 * cache du navigateur, pas celui du relais de GitHub Pages, qui garde un
 * fichier dix minutes. Une adresse que personne n'a demandée est fraîche. */
const MARQUE = '?coquille=' + encodeURIComponent(VERSION);

async function installerLaCoquille(cache) {
  const manques = [];
  await Promise.all(FICHIERS.map(async (url) => {
    try {
      const reponse = await fetch(new Request(url + MARQUE, { cache: 'reload' }));
      if (!reponse.ok) { manques.push(url + ' : ' + reponse.status); return; }
      await cache.put(url, reponse);
    } catch (erreur) {
      manques.push(url + ' : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
  }));
  if (manques.length) throw new Error('coquille incomplète — ' + manques.join(', '));
  const page = await cache.match('index.html');
  const html = page ? await page.text() : '';
  if (html.indexOf('name="application-version" content="' + VERSION + '"') === -1) {
    throw new Error('index.html n’est pas de la version ' + VERSION);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    try {
      await installerLaCoquille(cache);
    } catch (erreur) {
      await caches.delete(COQUILLE);
      throw erreur;
    }
    /* Pas de `skipWaiting()` ici : la nouvelle version attend le feu vert du
     * bandeau, pour ne pas changer l'application sous les doigts. */
  })());
});

self.addEventListener('message', (e) => {
  const message = e.data || {};
  if (message.type === 'passer-devant') self.skipWaiting();
  if (message.type === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('arcanes-coquille-') && nom !== COQUILLE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

/* Les illustrations ont leur propre cache, qui survit aux versions : la page le
 * remplit en arrière-plan (js/illustrations.js) et en retire ce qui ne sert
 * plus. L'adresse porte l'empreinte du fichier (`?v=…`) et se compare telle
 * quelle. Une image demandée avant d'y être rangée y entre au passage. */
const IMAGES = 'arcanes-images';

async function servirImage(requete) {
  const cache = await caches.open(IMAGES);
  const enCache = await cache.match(requete, { ignoreVary: true });
  if (enCache) return enCache;
  const reponse = await fetch(requete);
  if (reponse.ok) await cache.put(requete, reponse.clone());
  return reponse;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/img/')) { e.respondWith(servirImage(e.request)); return; }

  /* Le cache de cette version, et lui seul. Ce qui n'y est pas — l'image
   * d'aperçu, une adresse inconnue — va au réseau sans rien laisser dans le
   * cache. Une navigation hors ligne vers une adresse inconnue retombe sur la
   * page d'accueil ; un réseau qui répond mal (portail captif, erreur 5xx)
   * aussi. */
  e.respondWith((async () => {
    const coquille = await caches.open(COQUILLE);
    const enCache = await coquille.match(e.request, { ignoreSearch: true, ignoreVary: true });
    if (enCache) return enCache;
    try {
      const reponse = await fetch(e.request);
      if (!reponse.ok && e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      return reponse;
    } catch (erreur) {
      if (e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      throw erreur;
    }
  })());
});
