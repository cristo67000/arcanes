/*
 * Photographie la planche des figures (build/galerie.html), en vélin et en nuit,
 * par tranches, pour la relire à l'œil.
 *
 *     node build/capture_galerie.mjs <dossier-de-sortie>
 */
import fs from 'node:fs';
import path from 'node:path';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';
import { demarrerServeur } from './serveur_local.mjs';

const SORTIE = process.argv[2] || 'captures-galerie';
const PORT_WEB = 8222;
const PORT_CHROME = 9362;
const LARGEUR = 1140;
const TRANCHE = 1500;

fs.mkdirSync(SORTIE, { recursive: true });
const serveur = await demarrerServeur(PORT_WEB);
const chrome = await lancerChrome({ port: PORT_CHROME });
try {
  for (const theme of ['clair', 'sombre']) {
    const onglet = await ouvrirOnglet(chrome, 'about:blank');
    await onglet.envoyer('Emulation.setDeviceMetricsOverride', { width: LARGEUR, height: 900, deviceScaleFactor: 1, mobile: false });
    await onglet.naviguer('http://127.0.0.1:' + PORT_WEB + '/build/galerie.html' + (theme === 'sombre' ? '?theme=sombre' : ''));
    await new Promise((r) => setTimeout(r, 600));
    const hauteur = await onglet.evaluer('return document.documentElement.scrollHeight');
    let n = 0;
    for (let y = 0; y < hauteur; y += TRANCHE) {
      n += 1;
      const h = Math.min(TRANCHE, hauteur - y);
      const img = await onglet.envoyer('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: LARGEUR, height: h, scale: 1 },
      });
      fs.writeFileSync(path.join(SORTIE, theme + '-' + n + '.png'), Buffer.from(img.data, 'base64'));
    }
    console.log(theme + ' : ' + n + ' tranche(s), ' + hauteur + ' px');
    if (onglet.erreurs.length) console.log('  erreurs : ' + onglet.erreurs.join(' | '));
    onglet.fermer();
  }
} finally {
  await fermerChrome(chrome);
  await serveur.arreter();
}
