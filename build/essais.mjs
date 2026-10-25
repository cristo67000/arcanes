/*
 * Recette fonctionnelle, dans un vrai Chrome piloté par le protocole DevTools.
 *
 *     node build/essais.mjs
 *
 * Elle ouvre l'application à la taille d'un téléphone et fait ce que ferait une
 * personne : chercher, ouvrir un article, suivre un renvoi, toucher une figure,
 * parcourir la carte des lieux, lire un extrait, écrire une note et un
 * article, réviser, parcourir la frise, changer les
 * réglages, sauvegarder — puis coupe le serveur et vérifie que l'application se
 * relance hors ligne. Elle échoue à la moindre erreur de page, exception ou
 * violation de la politique de sécurité.
 *
 * Elle dessine aussi toutes les figures, avec tous leurs arguments, et vérifie
 * qu'aucun texte ne sort du cadre : un défaut qui ne se voit qu'à l'œil, et
 * qu'on ne regarde jamais pour les cinq cents articles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';
import { demarrerServeur } from './serveur_local.mjs';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VERSION_SW = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf-8'))[1];
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'manifeste.json'), 'utf-8'));
const PORT_WEB = 8221;
const PORT_CHROME = 9361;
const BASE = 'http://127.0.0.1:' + PORT_WEB + '/';

let bons = 0;
const echecs = [];
function ok(condition, message) { if (condition) bons += 1; else echecs.push(message); }
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const serveur = await demarrerServeur(PORT_WEB);
const chrome = await lancerChrome({ port: PORT_CHROME });
let onglet = null;

async function ouvrir(url) {
  if (onglet) onglet.fermer();
  onglet = await ouvrirOnglet(chrome, 'about:blank');
  await onglet.envoyer('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
  await onglet.naviguer(url);
}

async function attendre(condition, ms, quoi) {
  const fin = Date.now() + (ms || 8000);
  while (Date.now() < fin) {
    try { if (await onglet.evaluer('return !!(' + condition + ')')) return true; } catch (e) { /* la page change */ }
    await pause(100);
  }
  echecs.push('délai dépassé : ' + (quoi || condition));
  return false;
}
const js = (source) => onglet.evaluer(source);

async function demarrage(url) {
  await ouvrir(url || BASE + 'index.html');
  await attendre("document.getElementById('demarrage').hidden === true", 15000, 'démarrage de l’application');
}

try {
  // ── Démarrage ─────────────────────────────────────────────────────────────
  await demarrage();
  const n = await js('return Dictionnaire.articles.length');
  ok(n === MANIFESTE.articles, 'le dictionnaire est chargé (' + n + ' articles, manifeste : ' + MANIFESTE.articles + ')');
  ok(await js("return document.querySelectorAll('#liste .article-ligne').length") === n, 'toute la liste est dessinée');
  ok(await js("return document.querySelector('#compte').textContent") === n.toLocaleString('fr-FR') + ' articles', 'le compteur dit « ' + n.toLocaleString('fr-FR') + ' articles »');
  ok(await js("return document.getElementById('du-jour').hidden === false"), 'l’article du jour est affiché');
  ok(await js("return document.querySelectorAll('#portes .porte').length") === 12, 'les douze portes d’entrée sont affichées');
  ok(await js("return document.querySelectorAll('.lettre').length") >= 20, 'des lettres séparent la liste');
  ok(await js("return Array.from(document.querySelectorAll('.lettre')).map((l) => l.textContent).join('') === Array.from(document.querySelectorAll('.lettre')).map((l) => l.textContent).sort().join('')"), 'les lettres sont dans l’ordre');
  // « Le Bateleur » se range à B
  ok(await js("return Dictionnaire.parId('arcane-bateleur').lettre") === 'B', '« Le Bateleur » se range à la lettre B');

  // ── La recherche ──────────────────────────────────────────────────────────
  async function chercher(q) {
    await js("const q = document.getElementById('q'); q.value = " + JSON.stringify(q) + "; q.dispatchEvent(new Event('input')); return 1");
    await pause(250);
    return js("return Array.from(document.querySelectorAll('#liste .article-ligne')).map((b) => b.getAttribute('data-ref'))");
  }
  const attendus = {
    paracelse: 'paracelse', alchimie: 'alchimie', zarathoustra: 'zoroastre', 'hermes': 'hermes-trismegiste',
    kabbalah: 'kabbale', cabale: 'kabbale', 'rose croix': 'rose-croix', 'tables tournantes': 'tables-tournantes',
    bateleur: 'arcane-bateleur', 'le mat': 'arcane-mat', 'pierre philosophale': 'pierre-philosophale', vitriol: 'vitriol',
    'yi king': 'yi-king', 'i ching': 'yi-king', thelema: 'thelema', 'golden dawn': 'golden-dawn', 'eliphas levi': 'eliphas-levi',
    'sefirot': 'sephiroth', 'keter': 'keter', 'ouroboros': 'ouroboros', 'saturne': 'saturne', 'belier': 'belier',
    'nostradamus': 'nostradamus', 'blavatsky': 'helena-blavatsky', 'guenon': 'rene-guenon', 'fulcanelli': 'fulcanelli',
  };
  for (const [q, id] of Object.entries(attendus)) {
    const r = await chercher(q);
    ok(r[0] === id, 'chercher « ' + q + ' » donne ' + id + ' en premier (obtenu : ' + r.slice(0, 3).join(', ') + ')');
  }
  let r = await chercher('Montségur');
  ok(r.includes('catharisme'), 'la recherche plein texte trouve « Montségur » dans Catharisme');
  ok(await js("return !!document.querySelector('#liste .via')"), 'un résultat trouvé dans le texte le dit');
  r = await chercher('alchimei');
  ok(r.length === 0 && await js("return Array.from(document.querySelectorAll('#suggestions-liste .voisin')).some((b) => /Alchimie/.test(b.textContent))"), 'une faute de frappe propose « Alchimie »');
  ok(await js("return /Écrire l’article/.test(document.getElementById('b-ajouter-depuis-recherche').textContent)"), 'rien trouvé : on propose d’écrire l’article');
  await chercher('');

  // ── Une fiche, ses renvois, sa figure ─────────────────────────────────────
  await js("document.querySelector('#liste .article-ligne[data-ref=\"alchimie\"]').click(); return 1");
  await attendre("Fiche.ouverte && Fiche.ref === 'alchimie' && document.querySelector('#fiche .article-nom')", 4000, 'ouverture de la fiche Alchimie');
  ok(await js("return document.querySelector('#fiche .article-nom').textContent") === 'Alchimie', 'la fiche montre la vedette');
  ok(await js("return document.querySelectorAll('#fiche .article-texte a.renvoi').length") >= 8, 'l’article contient des renvois');
  ok(await js("return Array.from(document.querySelectorAll('#fiche a.renvoi')).some((a) => a.textContent === 'pierre philosophale')"), 'un nom commun en cours de phrase s’écrit en minuscule');
  ok(await js("return Array.from(document.querySelectorAll('#fiche a.renvoi')).some((a) => a.textContent === 'Paracelse')"), 'un nom propre garde sa majuscule');
  ok(await js("return /XVII\\u1d49 siècle/.test(document.querySelector('#fiche .article-texte').textContent)"), 'les siècles s’écrivent avec l’exposant (XVIIᵉ)');
  ok(await js("return !!document.querySelector('#fiche .figure svg')"), 'la figure du Grand Œuvre est dessinée');
  await js("Array.from(document.querySelectorAll('#fiche a.renvoi')).find((a) => a.getAttribute('data-ref') === 'paracelse').click(); return 1");
  await attendre("Fiche.ref === 'paracelse'", 3000, 'suivre le renvoi vers Paracelse');
  ok(await js("return /Alchimie/.test(document.querySelector('#fiche .fiche-retour').textContent)"), 'le bouton retour nomme l’article précédent');
  await js('history.back(); return 1');
  await attendre("Fiche.ref === 'alchimie'", 3000, 'retour à Alchimie par l’historique');
  ok(await js("return document.querySelectorAll('#fiche .voisins-bloc').length") >= 2, '« Voir aussi » et « Cité dans » sont affichés');
  ok(await js("return !!document.querySelector('#fiche .feuilleter')"), 'on peut feuilleter vers l’article voisin');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture de la fiche');
  await pause(500);

  // La figure de l'arbre : toucher Keter ouvre Keter
  await js("Fiche.ouvrir('arbre-des-sephiroth'); return 1");
  await attendre("Fiche.ref === 'arbre-des-sephiroth' && document.querySelector('#fiche .f-lien[data-ref=\"keter\"]')", 3000, 'arbre des séphiroth');
  await js("document.querySelector('#fiche .f-lien[data-ref=\"keter\"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1");
  await attendre("Fiche.ref === 'keter'", 3000, 'toucher Keter dans la figure ouvre son article');
  ok(await attendre("document.querySelector('#fiche .f-noeud-actif')", 3000, 'la séphira de l’article est mise en avant'), 'la séphira de l’article est mise en avant');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  // ── Les parcours guidés ───────────────────────────────────────────────────
  ok(await js("return document.querySelectorAll('#parcours-accueil .parcours-carte').length") === MANIFESTE.parcours,
    'l’accueil présente les ' + MANIFESTE.parcours + ' parcours');
  ok(await js('return document.documentElement.scrollWidth <= innerWidth'), 'le bandeau des parcours ne fait pas déborder la page');
  await js("document.querySelector('#parcours-accueil .parcours-carte[data-parcours=\"temple\"]').click(); return 1");
  await attendre("Fiche.ouverte && Fiche.parcours === 'temple' && document.querySelector('#fiche .parcours-fil')", 4000, 'la carte d’un parcours ouvre une étape');
  const etapes = await js("return Dictionnaire.unParcours('temple').e");
  const i0 = etapes.indexOf(await js('return Fiche.ref'));
  ok(i0 >= 0 && i0 < etapes.length - 1, 'l’étape ouverte appartient au parcours');
  await js("document.querySelector('#fiche .parcours-pas .suiv').click(); return 1");
  await attendre("Fiche.ref === " + JSON.stringify(etapes[i0 + 1]), 3000, 'l’étape suivante du parcours');
  ok(await js("return document.querySelector('#fiche .parcours-position').textContent") === (i0 + 2) + ' / ' + etapes.length, 'le fil dit à quelle étape on est');
  ok(await js("return document.querySelectorAll('#fiche .parcours-point').length") === etapes.length, 'un point par étape');
  await js("document.querySelectorAll('#fiche .parcours-point')[3].click(); return 1");
  await attendre("Fiche.ref === " + JSON.stringify(etapes[3]) + " && Fiche.parcours === 'temple'", 3000, 'un point mène à son étape');
  ok(await js("return !!document.querySelector('#fiche .parcours-suite .parcours-suivant')"), 'après la lecture, l’étape suivante est proposée');
  // un renvoi vers un article hors du parcours le quitte ; « retour » le retrouve
  const dehors = await js("const e = Dictionnaire.unParcours('temple').e; const a = Array.from(document.querySelectorAll('#fiche .article-texte a.renvoi')).find((x) => !e.includes(x.getAttribute('data-ref'))); if (!a) return null; a.click(); return a.getAttribute('data-ref')");
  ok(!!dehors, 'l’étape contient un renvoi hors du parcours');
  if (dehors) {
    await attendre('Fiche.ref === ' + JSON.stringify(dehors), 3000, 'suivre le renvoi hors du parcours');
    ok(await js("return Fiche.parcours === null && !document.querySelector('#fiche .parcours-fil')"), 'hors du parcours, le fil disparaît');
    await js('history.back(); return 1');
    await attendre("Fiche.ref === " + JSON.stringify(etapes[3]) + " && Fiche.parcours === 'temple' && !!document.querySelector('#fiche .parcours-fil')", 3000, '« retour » retrouve le parcours');
  }
  await js("document.querySelector('#fiche .parcours-quitter').click(); return 1");
  await attendre("Fiche.parcours === null && !document.querySelector('#fiche .parcours-fil')", 3000, 'quitter le parcours');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  // ── La carte des liens ────────────────────────────────────────────────────
  await js("Fiche.ouvrir('salomon'); return 1");
  await attendre("Fiche.ref === 'salomon' && document.querySelectorAll('#fiche .cl-noeud').length >= 9", 4000, 'la carte des liens de Salomon');
  await pause(300);
  const debordeCarte = await js(`
    return Array.from(document.querySelectorAll('#fiche .cl-noeud')).filter((n) => {
      const b = n.querySelector('text').getBBox();
      const r = parseFloat(n.querySelector(".cl-bulle").getAttribute("r"));
      return !b.width || b.width > r * 1.7 || b.height > r * 1.6;
    }).map((n) => n.getAttribute('aria-label'))`);
  ok(debordeCarte.length === 0, 'chaque nom tient dans sa bulle' + (debordeCarte.length ? ' : ' + debordeCarte.join(', ') : ''));
  const voisin = await js("const n = document.querySelector('#fiche .cl-noeud:not(.cl-noeud-centre)'); n.dispatchEvent(new MouseEvent('click', { bubbles: true })); return n.getAttribute('data-centre')");
  await attendre("document.querySelector('#fiche .cl-noeud-centre').getAttribute('data-centre') === " + JSON.stringify(voisin), 3000, 'toucher un voisin le met au centre');
  ok(await js("return Fiche.ref") === 'salomon', 'se promener dans la carte ne quitte pas la fiche');
  ok(await js("return document.querySelectorAll('#fiche .cl-etape').length") === 2, 'le chemin parcouru s’affiche');
  await js("document.querySelector('#fiche .cl-lire').click(); return 1");
  await attendre('Fiche.ref === ' + JSON.stringify(voisin), 3000, '« Lire » ouvre l’article du centre');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  // ── Toutes les figures, tous leurs arguments : rien ne sort du cadre ─────
  const debordements = await js(`
    const sortie = [];
    const boite = document.createElement('div');
    boite.className = 'figure';
    boite.style.position = 'absolute'; boite.style.left = '-2000px'; boite.style.width = '400px';
    document.body.appendChild(boite);
    const refs = [];
    for (const [nom, spec] of Object.entries(window.Figures)) {
      refs.push(nom);
      for (const c of spec.cles || []) refs.push(nom + '/' + c);
    }
    for (const ref of refs) {
      boite.textContent = '';
      let s;
      try { s = Figure.dessiner(ref); } catch (e) { sortie.push(ref + ' : ' + e.message); continue; }
      boite.appendChild(s);
      const [, , L, H] = s.getAttribute('viewBox').split(' ').map(Number);
      const cadre = s.getBoundingClientRect();
      const echelle = L / cadre.width;
      for (const t of s.querySelectorAll('text, .glyphe-pose, circle, rect')) {
        if (t.closest('marker')) continue;
        // la boîte à l'écran, ramenée aux unités du dessin : les rotations comptent
        const r = t.getBoundingClientRect();
        const b = { x: (r.left - cadre.left) * echelle, y: (r.top - cadre.top) * echelle, width: r.width * echelle, height: r.height * echelle };
        if (b.x < -2 || b.y < -2 || b.x + b.width > L + 2 || b.y + b.height > H + 2) {
          sortie.push(ref + ' : « ' + (t.textContent || t.tagName).slice(0, 30) + ' » sort du cadre (' + [b.x, b.y, b.x + b.width, b.y + b.height].map(Math.round).join(', ') + ' pour ' + L + '×' + H + ')');
        }
      }
    }
    boite.remove();
    return { n: refs.length, sortie };
  `);
  ok(debordements.n >= 34, 'toutes les figures sont dessinées (' + debordements.n + ' variantes)');
  ok(debordements.sortie.length === 0, 'aucun élément de figure ne sort du cadre :\n      ' + debordements.sortie.slice(0, 12).join('\n      '));

  // Tous les signes
  ok(await js("return Object.keys(Glyphes).every((g) => Glyphes.svg(g) instanceof SVGElement)"), 'tous les signes se dessinent');

  // ── Aucun texte ne laisse voir ses balises ([[…]], *…*) ──────────────────
  const balises = await js(`
    const sortie = [];
    for (const a of Dictionnaire.articles) {
      for (const t of [a.d].concat(a.t || [], a.at ? [a.at] : [])) {
        if (/\\[\\[|\\]\\]|\\*/.test(Rendu.paragraphe(t).textContent)) { sortie.push(a.id); break; }
      }
    }
    return sortie;
  `);
  ok(balises.length === 0, 'aucune balise ne reste visible dans les textes (' + balises.slice(0, 6).join(', ') + ')');
  ok(await js("return Rendu.paragraphe('La *[[zohar|Zohar]]* et le [[zohar]].').querySelectorAll('i a.renvoi').length === 1"), 'un renvoi en italique est un lien, dans l’italique');

  // ── Les illustrations : les cartes, la visionneuse, la planche ────────────
  await js("Fiche.ouvrir('arcane-bateleur'); return 1");
  await attendre("Fiche.ref === 'arcane-bateleur' && document.querySelectorAll('#fiche .illustration img').length === 2 && Array.from(document.querySelectorAll('#fiche .illustration img')).every((i) => i.complete && i.naturalWidth > 0)", 8000, 'les deux cartes du Bateleur s’affichent');
  ok(await js("return Array.from(document.querySelectorAll('#fiche .illustration-credit')).every((c) => /domaine public|CC0/.test(c.textContent))"), 'chaque image dit sa licence');
  await js("document.querySelector('#fiche .illustration-bouton').click(); return 1");
  await attendre("Illustrations.ouverte && document.querySelector('#visionneuse img') && document.querySelector('#visionneuse img').naturalWidth > 0", 4000, 'la visionneuse montre la carte en grand');
  ok(await js("return !!document.querySelector('#visionneuse .visionneuse-source[href^=\"https://commons.wikimedia.org/\"]')"), 'la visionneuse donne la source de l’image');
  await js('history.back(); return 1');
  await attendre('!Illustrations.ouverte', 3000, '« retour » referme la visionneuse');
  ok(await js("return Fiche.ouverte && Fiche.ref === 'arcane-bateleur'"), '« retour » referme la visionneuse sans fermer la fiche');
  await js("Fiche.ouvrir('arcanes-majeurs'); return 1");
  await attendre("Fiche.ref === 'arcanes-majeurs' && document.querySelectorAll('#fiche .vignette').length === 22", 4000, 'la planche des vingt-deux arcanes');
  await js("document.querySelectorAll('#fiche .vignette')[3].click(); return 1");
  await attendre("Fiche.ref === 'arcane-empereur'", 3000, 'une vignette ouvre son arcane');
  ok(await js("return Fiche.ref") === 'arcane-empereur', 'la quatrième vignette ouvre l’Empereur');
  await js("Fiche.ouvrir('temple-maconnique'); return 1");
  await attendre("Fiche.ref === 'temple-maconnique' && document.querySelector('#fiche .f-lien[data-ref=\"venerable-maitre\"]')", 3000, 'le plan de loge');
  await js("document.querySelector('#fiche .f-lien[data-ref=\"venerable-maitre\"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1");
  await attendre("Fiche.ref === 'venerable-maitre'", 3000, 'toucher le Vénérable dans le plan ouvre son article');
  ok(await js("return Array.from(document.querySelectorAll('#filtres .filtre')).some((b) => /Franc-maçonnerie/.test(b.textContent))"), 'la franc-maçonnerie a son filtre');

  // ── Les images animées et les sons ────────────────────────────────────────
  await js("Fiche.ouvrir('mademoiselle-lenormand'); return 1");
  await attendre("Fiche.ref === 'mademoiselle-lenormand' && document.querySelectorAll('#fiche .an-calque').length === 4", 4000, 'les calques de la gravure de Mlle Lenormand');
  await js("document.querySelector('#fiche .illustration').scrollIntoView({ block: 'center' }); return 1");
  await attendre("document.querySelector('#fiche .an-porteur').classList.contains('an-joue')", 4000, 'l’animation part quand l’image paraît');
  const calquesPoses = await js(`
    const img = document.querySelector('#fiche .an-porteur img');
    const i = img.getBoundingClientRect();
    return Array.from(document.querySelectorAll('#fiche .an-calque')).every((s) => {
      const r = s.getBoundingClientRect();
      return Math.abs(r.left - i.left) < 1 && Math.abs(r.top - i.top) < 1 && Math.abs(r.width - i.width) < 1 && Math.abs(r.height - i.height) < 1;
    })`);
  ok(calquesPoses, 'les calques couvrent exactement l’image');
  ok(await js("return !!document.querySelector('#fiche .an-carte path[fill=\"#c8102e\"]')"), 'l’as de cœur rouge est dessiné dans sa main');
  ok(await js("return /L’as de cœur/.test(document.querySelector('#fiche .an-rejouer').textContent) && !!document.querySelector('#fiche .an-ecouter')"), 'l’image a ses boutons « Rejouer » et « Écouter »');
  await js("document.querySelector('#fiche .an-ecouter').click(); return 1");
  await attendre("document.querySelector('#fiche .an-ecouter').classList.contains('joue')", 3000, 'le bruit de la carte se joue');
  await attendre("!document.querySelector('#fiche .an-ecouter').classList.contains('joue')", 5000, 'le bruit s’arrête de lui-même');
  await js("Fiche.ouvrir('spiritisme'); return 1");
  await attendre("Fiche.ref === 'spiritisme' && document.querySelectorAll('#fiche .an-bouge').length === 2 && document.querySelectorAll('#fiche .an-tache').length >= 8", 4000, 'la gravure des tables tournantes se colorie et ses guéridons bougent');
  await js("document.querySelector('#fiche .illustration').scrollIntoView({ block: 'center' }); document.querySelector('#fiche .an-rejouer').click(); Sons.arreter(); return 1");
  await pause(2600);
  ok(await js("return Array.from(document.querySelectorAll('#fiche .an-bouge')).some((g) => getComputedStyle(g).transform !== 'none' && getComputedStyle(g).transform !== 'matrix(1, 0, 0, 1, 0, 0)')"), 'un guéridon tourne');
  await js("Fiche.ouvrir('quinotaure'); return 1");
  await attendre("Fiche.ref === 'quinotaure' && document.querySelectorAll('#fiche .an-lutin').length === 2 && document.querySelectorAll('#fiche .an-vagues').length === 2", 4000, 'Mérovée : la reine et le monstre marin, et la mer');
  await attendre("Array.from(document.querySelectorAll('#fiche .an-lutin-image')).every((i) => i.getBBox().width > 0)", 4000, 'les deux figures découpées sont posées');
  ok(await js("return /Ambroise Paré/.test(document.querySelector('#fiche .illustration-animation').textContent)"), 'la légende dit d’où viennent les figures ajoutées');
  await js("Fiche.ouvrir('notre-dame-de-paris'); return 1");
  await attendre("Fiche.ref === 'notre-dame-de-paris' && document.querySelector('#fiche .sons .son-bouton')", 3000, 'Notre-Dame a ses cloches à écouter');
  ok(await js("return /domaine public|CC0/.test(document.querySelector('#fiche .son-credit').textContent) && /^https:\\/\\/commons\\.wikimedia\\.org\\//.test(document.querySelector('#fiche .son-source').href)"), 'le son dit sa licence et sa source');
  await js("document.querySelector('#fiche .son-bouton').click(); return 1");
  await attendre("document.querySelector('#fiche .son-bouton').classList.contains('joue')", 6000, 'les cloches se jouent');
  await attendre("parseFloat(document.querySelector('#fiche .son-avance').style.width) > 0", 6000, 'la barre d’avancement progresse');
  await js("document.querySelector('#fiche .son-bouton').click(); return 1");
  ok(await js("return !document.querySelector('#fiche .son-bouton').classList.contains('joue') && !Sons.enCours"), 'toucher de nouveau arrête le son');
  ok(await js("return caches.open('arcanes-sons').then((c) => c.keys()).then((k) => k.some((r) => /son\\/notre-dame-/.test(r.url)))"), 'le son écouté est rangé pour l’écoute hors ligne');

  // ── Les repères et les liens « Pour aller plus loin » ─────────────────────
  await js("Fiche.ouvrir('paracelse'); return 1");
  await attendre("Fiche.ref === 'paracelse' && document.querySelector('#fiche .reperes-liste')", 3000, 'les repères de Paracelse');
  ok(await js("return document.querySelectorAll('#fiche .reperes-liste li').length === Dictionnaire.parId('paracelse').re.length"), 'chaque repère de Paracelse est affiché');
  ok(await js("return Array.from(document.querySelectorAll('#fiche .reperes-liste li')).every((li) => li.querySelector('.repere-date').textContent && !/\\[\\[|\\]\\]|\\*/.test(li.textContent))"), 'les repères ont leur date et aucune balise visible');
  ok(await js("return document.querySelectorAll('#fiche .ailleurs-lien').length === Dictionnaire.parId('paracelse').li.length"), 'chaque lien extérieur de Paracelse est affiché');
  ok(await js("return Array.from(document.querySelectorAll('#fiche .ailleurs-lien')).every((a) => a.target === '_blank' && a.rel === 'noopener noreferrer' && a.href.startsWith('https://'))"), 'les liens extérieurs s’ouvrent à part, sans transmettre la page d’origine');
  r = await chercher('paragranum');
  ok(r.includes('paracelse'), 'la recherche lit aussi les repères');
  await chercher('');
  await js("Fiche.ouvrir('martinez-de-pasqually'); return 1");
  await attendre("Fiche.ref === 'martinez-de-pasqually' && document.querySelector('#fiche .reperes-liste')", 3000, 'les repères de Martinez de Pasqually');
  ok(await js("return document.querySelectorAll('#fiche .reperes-liste a.renvoi').length === 2"), 'les renvois des repères sont des liens');
  await js("document.querySelector('#fiche .reperes-liste a.renvoi').click(); return 1");
  await attendre("Fiche.ref !== 'martinez-de-pasqually'", 3000, 'un renvoi des repères ouvre son article');
  await js("Fiche.ouvrir('alchimie'); return 1");
  await attendre("Fiche.ref === 'alchimie' && document.querySelector('#fiche .article-nom') && document.querySelector('#fiche .article-nom').textContent.includes(Dictionnaire.parId('alchimie').n)", 3000, 'fiche Alchimie');
  ok(await js("return !document.querySelector('#fiche .reperes') === !Dictionnaire.parId('alchimie').re"), 'un article sans repères n’a pas de section vide');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  // ── La carte des lieux ────────────────────────────────────────────────────
  await js("App.aller('carte'); return 1");
  await attendre("document.querySelector('#carte-cadre .carte-fond') && document.querySelectorAll('#carte-liste .lieu-ligne').length", 8000, 'la carte des lieux se dessine');
  const nLieux = await js('return Carte.lieux().length');
  ok(nLieux === MANIFESTE.lieux, 'la carte connaît tous les lieux (' + nLieux + ', manifeste : ' + MANIFESTE.lieux + ')');
  ok(await js("return document.querySelectorAll('#carte-cadre .c-lieu').length") === nLieux, 'chaque lieu a son point sur la carte');
  ok(await js("return document.querySelectorAll('#carte-liste .lieu-ligne').length") === nLieux, 'chaque lieu est dans la liste');
  ok(await js("return document.querySelectorAll('#carte-cadre .c-nom-lieu:not(.cache)').length") >= 5, 'des noms de lieux sont affichés sur la carte');
  ok(await js("return document.querySelectorAll('#carte-cadre .c-nom-ville:not(.cache)').length") >= 5, 'des villes servent de repères');
  await js("document.querySelector('#carte-liste .lieu-ligne[data-ref=\"montsegur\"]').click(); return 1");
  await attendre("!document.getElementById('carte-choix').hidden && /Montségur/.test(document.querySelector('#carte-choix .choix-nom').textContent)", 3000, 'le lieu choisi s’affiche sous la carte');
  await pause(600);
  ok(await js("return !!document.querySelector('#carte-cadre .c-lieu.choisi')"), 'le point du lieu choisi est mis en avant');
  const itineraires = await js("return Array.from(document.querySelectorAll('#carte-choix .itineraire a')).map((a) => a.href)");
  ok(itineraires.some((h) => h.startsWith('https://www.google.com/maps/dir/?api=1&destination=42.87560')) && itineraires.some((h) => h.startsWith('https://www.openstreetmap.org/directions')),
    'l’itinéraire mène au lieu par Google Maps et OpenStreetMap');
  ok(itineraires.every((h) => !/origin|saddr|43\.6/.test(h)), 'les liens d’itinéraire ne portent que la destination');
  const vueAvant = await js("return document.querySelector('#carte-cadre .carte-fond').getAttribute('viewBox')");
  await js("document.querySelector('.carte-zoom .plus').click(); return 1");
  await pause(300);
  ok(await js("return document.querySelector('#carte-cadre .carte-fond').getAttribute('viewBox')") !== vueAvant, 'le bouton « + » grossit la carte');
  // La position, simulée : le navigateur de l'épreuve n'en a pas
  await js("Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (succes) => setTimeout(() => succes({ coords: { latitude: 43.6045, longitude: 1.444, accuracy: 800 } }), 50) } }); document.querySelector('.bouton-situer').click(); return 1");
  await attendre("Carte.position && document.querySelector('#carte-cadre .c-ici')", 4000, 'la position s’affiche sur la carte');
  const proches = await js("return Array.from(document.querySelectorAll('#carte-liste .lieu-ligne')).slice(0, 3).map((b) => b.getAttribute('data-ref'))");
  // Carcassonne (86 km) devance de peu Montségur (87 km)
  ok(proches[0] === 'carcassonne' && proches.includes('montsegur'), 'depuis Toulouse, les lieux les plus proches sont Carcassonne puis Montségur (' + proches.join(', ') + ')');
  ok(await js("return /\\d+ km/.test(document.querySelector('#carte-liste .lieu-distance').textContent)"), 'la liste donne les distances');
  await js("Array.from(document.querySelectorAll('#carte-position button')).find((b) => /oublier/i.test(b.textContent)).click(); return 1");
  await attendre("Carte.position === null && !document.querySelector('#carte-cadre .c-ici')", 2000, 'la position s’oublie d’un geste');
  // La fiche d'un lieu : le plan de situation, les coordonnées, le retour à la carte
  await js("Fiche.ouvrir('rennes-le-chateau'); return 1");
  await attendre("Fiche.ref === 'rennes-le-chateau' && document.querySelector('#fiche .situer .carte-fond')", 4000, 'le plan de situation dans la fiche d’un lieu');
  ok(await js("return /42° 55′/.test(document.querySelector('#fiche .coordonnees-texte').textContent)"), 'la fiche donne les coordonnées en degrés');
  ok(await js("return document.querySelector('#fiche .article-lieu').textContent === 'Aude, Occitanie, France'"), 'la fiche dit où se trouve le lieu');
  await js("document.querySelector('#fiche .plan-situation').click(); return 1");
  await attendre("!Fiche.ouverte && App.vue === 'carte' && Carte.principale.choisi === 'rennes-le-chateau'", 4000, 'toucher le plan ouvre la carte sur le lieu');
  await pause(500);

  // ── Les extraits d'œuvres ─────────────────────────────────────────────────
  await js("Fiche.ouvrir('poimandres'); return 1");
  await attendre("Fiche.ref === 'poimandres' && document.querySelector('#fiche .extrait')", 3000, 'l’extrait du Poimandrès');
  ok(await js("return /Je réfléchissais un jour sur les êtres/.test(document.querySelector('#fiche .extrait-texte').textContent)"), 'l’extrait cite le texte');
  ok(await js("return Array.from(document.querySelectorAll('#fiche .extrait-lien')).some((a) => a.href.startsWith('https://gallica.bnf.fr/ark:/12148/') && a.target === '_blank' && a.rel === 'noopener noreferrer')"),
    'l’extrait mène au livre numérisé de Gallica, à part');
  ok(await js("return !!document.querySelector('#fiche .extrait-source i')"), 'la source de l’extrait donne le titre en italique');
  await js("Fiche.ouvrir('correspondances'); return 1");
  await attendre("Fiche.ref === 'correspondances' && document.querySelector('#fiche .extrait')", 3000, 'le sonnet de Baudelaire');
  ok(await js("return document.querySelector('#fiche .extrait-texte p').textContent.split('\\n').length === 4"), 'les vers du sonnet vont à la ligne');
  r = await chercher('seuil de Proserpine');
  ok(r.includes('mysteres-antiques'), 'la recherche lit aussi les extraits');
  await chercher('');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  // Six onglets sur un téléphone de 360 points
  await onglet.envoyer('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
  await pause(400);
  ok(await js("return Array.from(document.querySelectorAll('#onglets button span')).every((s) => s.scrollWidth <= s.clientWidth + 1)"), 'les six onglets tiennent sur un téléphone de 360 points');
  ok(await js('return document.documentElement.scrollWidth <= 360'), 'l’onglet « Carte » ne déborde pas en largeur à 360 points');
  await onglet.envoyer('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
  await pause(300);

  // ── Notes et article à soi ────────────────────────────────────────────────
  await js("Fiche.ouvrir('tarot'); return 1");
  await attendre("Fiche.ref === 'tarot'", 3000, 'fiche Tarot');
  await js("Array.from(document.querySelectorAll('#fiche .mes-notes button')).find((b) => /Ajouter une note/.test(b.textContent)).click(); return 1");
  await attendre("Editeur.ouvert && document.getElementById('e-texte')", 3000, 'ouverture de l’éditeur de note');
  await js("const t = document.getElementById('e-texte'); t.value = 'Lu chez Court de Gébelin : <b>pas</b> du HTML.'; t.dispatchEvent(new Event('input', { bubbles: true })); Array.from(document.querySelectorAll('#editeur .bouton-principal')).find((b) => /Enregistrer/.test(b.textContent)).click(); return 1");
  await attendre("!Editeur.ouvert && document.querySelector('#fiche .note-carte')", 3000, 'la note apparaît dans la fiche');
  ok(await js("return document.querySelector('#fiche .note-texte').textContent.includes('<b>pas</b>')"), 'une note s’affiche comme du texte, sans être interprétée');
  ok(await js("return !document.querySelector('#fiche .note-texte b')"), 'aucune balise de la note n’entre dans la page');
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

  await js("Editeur.ouvrir({ type: 'article', nom: 'Égrégore lunaire' }); return 1");
  await attendre("Editeur.ouvert && document.getElementById('e-def')", 3000, 'éditeur d’article');
  await js("const d = document.getElementById('e-def'); d.value = 'Notion que j’ajoute pour essayer l’éditeur d’articles personnels.'; document.getElementById('e-texte').value = 'Premier paragraphe.\\n\\nSecond paragraphe.'; Array.from(document.querySelectorAll('#editeur .bouton-principal')).find((b) => /Enregistrer/.test(b.textContent)).click(); return 1");
  await attendre("!Editeur.ouvert && Dictionnaire.articles.some((a) => a.perso && a.n === 'Égrégore lunaire')", 3000, 'l’article à soi est enregistré');
  r = await chercher('egregore lunaire');
  ok(r[0] && r[0].startsWith('perso:'), 'l’article à soi se retrouve par la recherche');
  const perso = await js("return Dictionnaire.articles.find((a) => a.perso).t.length");
  ok(perso === 2, 'les paragraphes de l’article à soi sont séparés par la ligne vide');
  await chercher('');
  // Un doublon d'un article du dictionnaire est refusé
  await js("Editeur.ouvrir({ type: 'article', nom: 'Alchimie' }); return 1");
  await attendre("Editeur.ouvert && document.getElementById('e-def')", 3000, 'éditeur (doublon)');
  await js("document.getElementById('e-def').value = 'Une définition de doublon, qui ne doit pas être acceptée.'; Array.from(document.querySelectorAll('#editeur .bouton-principal')).find((b) => /Enregistrer/.test(b.textContent)).click(); return 1");
  await pause(300);
  ok(await js("return Editeur.ouvert && /existe déjà/.test(document.querySelector('#editeur .erreur').textContent)"), 'un article qui existe déjà est refusé, avec une explication');
  await js('Editeur.fermer(); return 1');
  await pause(500);

  // ── Le carnet ─────────────────────────────────────────────────────────────
  await js("Store.modifierSuivi('gnose', (s) => { s.favori = true; }).then(() => document.dispatchEvent(new CustomEvent('suivi-change'))); App.aller('carnet'); return 1");
  await pause(400);
  ok(await js("return Array.from(document.querySelectorAll('#carnet-contenu .article-ligne')).some((b) => b.getAttribute('data-ref') === 'gnose')"), 'un favori apparaît dans le carnet');
  await js("document.querySelector('#carnet-onglets [data-rubrique=\"notes\"]').click(); return 1");
  await pause(300);
  ok(await js("return document.querySelectorAll('#carnet-contenu .note-ligne').length") === 1, 'la note apparaît dans le carnet');
  await js("document.querySelector('#carnet-onglets [data-rubrique=\"articles\"]').click(); return 1");
  await pause(300);
  ok(await js("return document.querySelectorAll('#carnet-contenu .article-ligne').length") === 1, 'l’article à soi apparaît dans le carnet');

  // ── La frise : le bandeau ─────────────────────────────────────────────────
  await js("App.aller('frise'); return 1");
  await pause(500);
  ok(await js("return Frise.vue === 'bandeau' && !document.querySelector('.frise-bandeau').hidden && document.getElementById('frise-contenu').hidden"), 'la frise s’ouvre en bandeau');
  ok(await js("return document.querySelectorAll('.bd-item').length") === MANIFESTE_DATES(), 'le bandeau montre tous les articles datés');
  const vies = await js("return document.querySelectorAll('.bd-item.bd-vie').length");
  ok(vies >= 300, 'les vies et les durées y sont des barres (' + vies + ')');
  ok(await js("const B = Bandeau._; return B.periode({ c: 'figures', da: '530 – 495 av. J.-C.' }).join() === '-530,-495,false' && B.periode({ c: 'figures', da: 'vers 4 av. J.-C. – vers 65' }).join() === '-4,65,false' && B.periode({ c: 'figures', da: 'XIIIᵉ siècle – après 1322' }).join() === '1250,1322,false' && B.periode({ c: 'societes', da: 'depuis 1913' })[0] === 1913 && B.periode({ c: 'figures', da: 'figure légendaire' }) === null"), 'les dates des vies se lisent, avant et après notre ère');
  ok(await js("const s = document.querySelector('.bd-svg').getBoundingClientRect(); const c = document.querySelector('.bd-cadre'); return s.width > c.clientWidth * 2 && document.documentElement.scrollWidth <= innerWidth"), 'le bandeau glisse dans son cadre sans élargir la page');
  await js("document.querySelector('.bd-item[data-ref=\"paracelse\"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1");
  await pause(300);
  ok(await js("const p = document.querySelector('.bd-choix'); return !p.hidden && p.querySelector('.bd-choix-nom').textContent === 'Paracelse'"), 'toucher une vie ouvre son panneau');
  ok(await js("return Array.from(document.querySelectorAll('.bd-proches .voisin')).some((b) => /Agrippa/.test(b.textContent)) && document.querySelector('.bd-item[data-ref=\"cornelius-agrippa\"]').classList.contains('bd-proche')"), 'Agrippa vivait en même temps que Paracelse, et s’éclaire');
  ok(await js("return !document.querySelector('.bd-item[data-ref=\"carl-gustav-jung\"]').classList.contains('bd-proche')"), 'Jung, qui n’a pas croisé Paracelse, reste dans l’ombre');
  ok(await js("return document.querySelectorAll('.bd-repere').length") === await js("return Dictionnaire.parId('paracelse').re.length"), 'les repères de Paracelse se posent sur sa vie');
  await js("const c = document.querySelector('.bd-champ'); c.value = 'Jung'; c.dispatchEvent(new Event('change')); return 1");
  await pause(400);
  ok(await js("return document.querySelector('.bd-choix-nom').textContent === 'Carl Gustav Jung'"), '« Qui vivait en même temps que… ? » trouve une figure par son nom');
  const avant = await js("return document.querySelector('.bd-svg').getBoundingClientRect().width");
  await js("document.querySelector('.bd-zoom .bd-bouton-zoom:last-child').click(); return 1");
  await pause(300);
  ok(await js("return document.querySelector('.bd-svg').getBoundingClientRect().width") > avant * 1.2, 'le bouton « + » agrandit le bandeau');
  ok(await js("return document.querySelector('.bd-item.bd-choisi[data-ref=\"carl-gustav-jung\"]') !== null && !document.querySelector('.bd-choix').hidden"), 'la vie choisie le reste après le zoom');
  ok(await js("return document.querySelectorAll('#frise-epoques .epoque').length") === 7, 'les sept époques ont leur bouton dans le bandeau');

  // ── La frise : la liste ───────────────────────────────────────────────────
  await js("Array.from(document.querySelectorAll('.segments-frise button')).find((b) => b.textContent === 'Liste').click(); return 1");
  await pause(400);
  ok(await js("return document.querySelector('.bd-choix').hidden && document.querySelector('.frise-bandeau').hidden"), 'passer à la liste referme le bandeau');
  const dates = await js("return document.querySelectorAll('#frise-contenu .frise-ligne').length");
  ok(dates === MANIFESTE_DATES(), 'la frise montre tous les articles datés (' + dates + ')');
  ok(await js("return document.querySelectorAll('#frise-epoques .epoque').length") === 7, 'les sept époques ont leur bouton');
  ok(await js("const ans = Array.from(document.querySelectorAll('#frise-contenu .frise-ligne')).map((b) => Dictionnaire.parId(b.getAttribute('data-ref')).an); return ans.every((a, i) => i === 0 || ans[i - 1] <= a)"), 'la frise est dans l’ordre chronologique');
  await js("Array.from(document.querySelectorAll('#frise-filtres .filtre')).find((b) => /Figures/.test(b.textContent)).click(); return 1");
  await pause(300);
  ok(await js("return Array.from(document.querySelectorAll('#frise-contenu .frise-ligne')).every((b) => Dictionnaire.parId(b.getAttribute('data-ref')).c === 'figures')"), 'le filtre « Figures » ne garde que les figures');

  // ── Les outils à manipuler ────────────────────────────────────────────────
  await js("App.aller('dictionnaire'); return 1");
  await pause(300);
  ok(await js("return document.querySelectorAll('#outils-accueil .outil-porte').length") === 5, 'l’accueil propose les cinq outils');
  await js("document.querySelector('#outils-accueil [data-outil=\"tarot\"]').click(); return 1");
  await attendre("Fiche.ref === 'tarot' && document.getElementById('manipuler')", 4000, 'l’outil du tarot s’ouvre dans son article');
  await js("document.querySelector('#manipuler .bouton-principal').click(); return 1");
  await attendre("document.querySelectorAll('#manipuler .tt-carte.retournee').length === 3", 4000, 'trois cartes se retournent');
  ok(await js("const c = Array.from(document.querySelectorAll('#manipuler .tt-carte')); const ids = Array.from(document.querySelectorAll('#manipuler .tt-lecture .voisin')).map((b) => b.getAttribute('data-ref')); return c.length === 3 && new Set(ids).size === 3 && ids.every((id) => /^arcane-/.test(id)) && c.every((x) => /conver-/.test(x.querySelector('img').getAttribute('src')))"), 'le tirage donne trois arcanes distincts, avec leur gravure de Conver');
  await js("Array.from(document.querySelectorAll('#manipuler .segments-outil button')).find((b) => b.textContent === '10 cartes').click(); return 1");
  await attendre("document.querySelectorAll('#manipuler .tt-croix .tt-carte').length === 10", 4000, 'la croix de dix cartes se dispose');
  await js("Fiche.ouvrir('yi-king', { defiler: 'outil' }); return 1");
  await attendre("Fiche.ref === 'yi-king' && document.getElementById('manipuler')", 4000, 'l’outil du Yi King s’ouvre');
  await js("for (let i = 0; i < 6; i += 1) document.querySelector('#manipuler .bouton-principal').click(); return 1");
  ok(await js("return /^\\d+\\. /.test(document.querySelector('#manipuler .yk-nom').textContent)"), 'six jets de pièces donnent un hexagramme numéroté');
  await js("Fiche.ouvrir('geomancie', { defiler: 'outil' }); return 1");
  await attendre("Fiche.ref === 'geomancie' && document.getElementById('manipuler')", 4000, 'l’outil de géomancie s’ouvre');
  await js("document.querySelector('#manipuler .outil-boutons .bouton-discret').click(); return 1");
  ok(await js("const c = Array.from(document.querySelectorAll('#manipuler .gm-case')); const juge = c[c.length - 1].querySelectorAll('.gm-point').length; return c.length === 15 && juge % 2 === 0"), 'le bouclier géomantique a ses quinze figures et un Juge pair');
  await js("Fiche.ouvrir('chiffre-de-cesar', { defiler: 'outil' }); return 1");
  await attendre("Fiche.ref === 'chiffre-de-cesar' && document.getElementById('manipuler')", 4000, 'l’outil des chiffres s’ouvre');
  ok(await js("return document.querySelector('#manipuler .outil-sortie').textContent") === 'VRXYLHQV-WRL GH OD PRUW', 'César décale de trois : « Souviens-toi de la mort » devient VRXYLHQV-WRL GH OD PRUW');
  await js("Array.from(document.querySelectorAll('#manipuler .segments-outil button')).find((b) => b.textContent === 'Morse').click(); return 1");
  ok(await js("return document.querySelector('#manipuler .outil-sortie').textContent.startsWith('··· ––– ··– ···–')"), 'le Morse s’écrit en points et en traits');
  await js("Array.from(document.querySelectorAll('#manipuler .segments-outil button')).find((b) => b.textContent === 'Maçonnique').click(); return 1");
  ok(await js("return document.querySelectorAll('#manipuler .mc-lettre').length") === 19, 'l’alphabet maçonnique dessine chaque lettre');
  await js("Fiche.ouvrir('gematrie', { defiler: 'outil' }); return 1");
  await attendre("Fiche.ref === 'gematrie' && document.getElementById('manipuler')", 4000, 'l’outil des nombres s’ouvre');
  ok(await js("return document.querySelector('#manipuler .nb-somme').textContent") === '= 26', 'le Tétragramme vaut 26');
  await js("Array.from(document.querySelectorAll('#manipuler .nb-exemples .filtre')).find((b) => b.textContent === 'ΙΗΣΟΥΣ').click(); return 1");
  ok(await js("return document.querySelector('#manipuler .nb-somme').textContent") === '= 888', 'ΙΗΣΟΥΣ vaut 888 en isopsephie');
  await js("Fiche.fermer(); return 1");
  await pause(300);

  // ── Le plus court chemin, la progression, les anniversaires ──────────────
  const trajet = await js("return Constellation.cheminEntre('pythagore', 'rennes-le-chateau')");
  ok(Array.isArray(trajet) && trajet[0] === 'pythagore' && trajet[trajet.length - 1] === 'rennes-le-chateau' && trajet.length <= 8, 'un plus court chemin mène de Pythagore à Rennes-le-Château (' + (trajet || []).length + ' étapes)');
  ok(await js("const c = Constellation.cheminEntre('pythagore', 'rennes-le-chateau'); return c.every((id, i) => i === 0 || Constellation.voisins(Dictionnaire.parId(c[i - 1])).some((v) => v.a.id === id) || Constellation.voisins(Dictionnaire.parId(id)).some((v) => v.a.id === c[i - 1]))"), 'chaque pas du chemin suit un vrai lien');
  await js("Fiche.ouvrir('pythagore'); return 1");
  await attendre("Fiche.ref === 'pythagore' && document.querySelector('.cl-trajet-champ')", 4000, 'le champ du plus court chemin paraît sous la carte des liens');
  await js("const c = document.querySelector('.cl-trajet-champ'); c.value = 'Rennes-le-Château'; c.dispatchEvent(new Event('input')); return 1");
  await pause(200);
  await js("document.querySelector('.cl-trajet-propositions .voisin').click(); return 1");
  ok(await js("const e = Array.from(document.querySelectorAll('.cl-trajet-etapes .cl-etape')).map((b) => b.getAttribute('data-ref')); return e[0] === 'pythagore' && e[e.length - 1] === 'rennes-le-chateau'"), 'le chemin s’affiche, de l’article à celui qu’on cherche');
  await js("Fiche.fermer(); App.aller('carnet'); return 1");
  await pause(300);
  await js("document.querySelector('#carnet-onglets [data-rubrique=\"progression\"]').click(); return 1");
  await pause(400);
  ok(await js("return document.querySelectorAll('#carnet-contenu .pg-ligne').length") >= Dictionnaire_CATS() + 20, 'la progression montre chaque rubrique et chaque parcours');
  ok(await js("return Number(document.querySelector('#carnet-contenu .pg-chiffre').textContent.replace(/\\s/g, '')) > 0"), 'la progression compte les articles déjà ouverts');
  await js("App.aller('dictionnaire'); return 1");
  await pause(300);
  ok(await js("const a = Array.from(document.querySelectorAll('#anniversaires .anniv')); const an = new Date().getFullYear(); return a.length > 0 && a.every((b) => { const m = /(\\d+)(?: av\\. J\\.-C\\.)?, il y a (\\d+) ans/.exec(b.textContent); return m && Number(m[2]) % 50 === 0; })"), 'l’accueil donne les anniversaires de l’année, par multiples de cinquante ans');

  // ── Un parcours sur la carte ──────────────────────────────────────────────
  await js("App.aller('carte'); return 1");
  await attendre("document.querySelector('#carte-parcours select')", 6000, 'le choix d’un parcours paraît sous la carte');
  await js("const s = document.querySelector('#carte-parcours select'); s.value = 'paris-esoterique'; s.dispatchEvent(new Event('change')); return 1");
  await pause(700);
  ok(await js("return !!document.querySelector('.carte-dessus .c-trace-ligne') && document.querySelectorAll('.carte-dessus .c-trace-rang').length === Carte.parcoursDeLieux().find((x) => x.p.id === 'paris-esoterique').lieux.length"), 'le parcours « Paris ésotérique » se trace sur la carte, ses lieux numérotés');
  ok(await js("return document.querySelectorAll('.carte-parcours-etapes li').length") >= 5, 'ses étapes sont listées sous la carte');
  await js("const s = document.querySelector('#carte-parcours select'); s.value = ''; s.dispatchEvent(new Event('change')); return 1");

  // ── La révision ───────────────────────────────────────────────────────────
  await js("App.aller('quiz'); return 1");
  await pause(400);
  for (const sens of ['image', 'son', 'extrait']) {
    const qs = await js("const q = await Quiz.construire({ source: 'tous', sens: '" + sens + "', n: 10, mode: 'qcm' }); return q.map((x) => ({ s: x.sens, c: x.cible.id, ids: x.propositions.map((p) => p.article.id), media: !!(x.image || x.son || x.sens === 'extrait') }))");
    ok(qs.length === 10 && qs.every((q) => q.s === sens && q.media && new Set(q.ids).size === 4 && q.ids.includes(q.c)), 'dix questions « ' + sens + ' » se construisent, chacune avec son support et quatre propositions');
  }
  const ordres = await js("const q = await Quiz.construire({ source: 'tous', sens: 'ordre', n: 5, mode: 'qcm' }); return q.map((x) => x.bonne.map((id) => Dictionnaire.parId(id).an))");
  ok(ordres.length === 5 && ordres.every((ans) => ans.length === 4 && ans.every((a, i) => i === 0 || ans[i - 1] < a)), 'les questions « remettre en ordre » ont quatre dates croissantes');
  ok(await js("const q = await Quiz.construire({ source: 'tous', sens: 'son', n: 10, mode: 'qcm' }); return q.every((x) => x.propositions.every((p) => p.article.id === x.cible.id || !(p.article.so || []).some((s) => s.id === x.son.id)))"), 'aucun leurre ne partage le son de la question');
  for (const sens of ['def-nom', 'nom-def', 'chrono']) {
    const qs = await js("const q = await Quiz.construire({ source: 'tous', sens: '" + sens + "', n: 20, mode: 'qcm' }); return q.map((x) => ({ s: x.sens, ids: x.propositions.map((p) => p.article.id), c: x.cible.id, e: x.enonce, t: x.propositions.map((p) => p.texte), an: x.propositions.map((p) => p.article.an) }))");
    ok(qs.length === 20, 'vingt questions « ' + sens + ' » se construisent');
    ok(qs.every((q) => new Set(q.ids).size === 4 && q.ids.includes(q.c)), 'quatre propositions distinctes dont la bonne (' + sens + ')');
    if (sens === 'chrono') {
      ok(qs.every((q) => q.s === 'chrono' ? q.an.every((a) => a >= q.an[q.ids.indexOf(q.c)]) : true), 'la bonne réponse chronologique est bien la plus ancienne');
    } else {
      // le nom cherché n'apparaît pas dans l'énoncé
      const fuites = await js("return " + JSON.stringify(qs) + ".filter((q) => q.s === 'def-nom').filter((q) => { const a = Dictionnaire.parId(q.c); const nom = a.n.replace(/^(Le |La |Les |L’)/, ''); return nom.length > 3 && q.e.toLowerCase().includes(nom.toLowerCase()); }).map((q) => q.c)");
      ok(fuites.length === 0, 'aucun énoncé ne contient le nom cherché (' + fuites.join(', ') + ')');
    }
  }
  // Une séance complète au clic
  await js("await App.ecrireReglage('quizMode', 'qcm'); await App.ecrireReglage('quizNombre', 5); Quiz.montrer(); return 1");
  await pause(400);
  await js("Array.from(document.querySelectorAll('#quiz-contenu .bouton-principal')).find((b) => b.textContent === 'Commencer').click(); return 1");
  for (let i = 0; i < 5; i += 1) {
    await attendre("document.querySelector('#quiz-contenu .choix:not([disabled])')", 3000, 'question ' + (i + 1));
    await js("document.querySelector('#quiz-contenu .choix').click(); return 1");
    await attendre("!document.querySelector('#quiz-contenu .verdict').hidden", 3000, 'verdict ' + (i + 1));
    await js("document.querySelector('#quiz-contenu .verdict .bouton-principal').click(); return 1");
  }
  await attendre("document.querySelector('#quiz-contenu .bilan')", 3000, 'bilan de la séance');
  ok(await js("return /sur 5/.test(document.querySelector('.bilan-score').textContent)"), 'le bilan donne le score sur 5');
  // Les cartes
  await js("Array.from(document.querySelectorAll('#quiz-contenu button')).find((b) => /Retour aux réglages/.test(b.textContent)).click(); return 1");
  await pause(300);
  await js("await App.ecrireReglage('quizMode', 'cartes'); Quiz.montrer(); return 1");
  await pause(500);
  await js("Array.from(document.querySelectorAll('#quiz-contenu .bouton-principal')).find((b) => b.textContent === 'Commencer').click(); return 1");
  await attendre("document.querySelector('.carte-flash')", 3000, 'une carte à retourner');
  await js("document.querySelector('.carte-flash').click(); return 1");
  ok(await js("return document.querySelector('.carte-flash').classList.contains('retournee') && !document.querySelector('.jugement').hidden"), 'la carte se retourne et l’on peut juger');
  await js("await App.ecrireReglage('quizMode', 'qcm'); return 1");

  // ── Les réglages ──────────────────────────────────────────────────────────
  await js("App.aller('reglages'); return 1");
  await pause(300);
  await js("Array.from(document.querySelectorAll('#reglages-contenu .segments button')).find((b) => b.textContent === 'Nuit').click(); return 1");
  await pause(200);
  ok(await js("return document.documentElement.getAttribute('data-theme')") === 'sombre', 'le thème nuit s’applique');
  await js("Array.from(document.querySelectorAll('#reglages-contenu .segments button')).find((b) => b.textContent === 'Sans empattements').click(); return 1");
  await pause(200);
  ok(await js("return document.documentElement.getAttribute('data-police')") === 'sans', 'la police des articles se change');
  await js("Array.from(document.querySelectorAll('#reglages-contenu .segments button')).find((b) => b.textContent === 'Grand').click(); return 1");
  await pause(200);
  ok(await js("return document.documentElement.style.fontSize") === '18px', 'la taille du texte se change');

  // ── La sauvegarde : un aller-retour ───────────────────────────────────────
  const aller = await js(`
    const donnees = { application: 'arcanes', format: 1, date: new Date().toISOString(),
      reglages: await Store.lireReglages(), notes: await Store.toutesLesNotes(),
      perso: await Store.tousLesArticlesPerso(), suivis: await Store.tousLesSuivis() };
    for (const n of donnees.notes) await Store.supprimerNote(n.id);
    const b = await Sauvegarde.fusionner(donnees);
    return { valide: Sauvegarde.valide(donnees), ajoutes: b.ajoutes, notes: (await Store.toutesLesNotes()).length };
  `);
  ok(aller.valide && aller.ajoutes >= 1 && aller.notes === 1, 'une sauvegarde rechargée rend la note effacée');
  ok(await js("return Sauvegarde.valide({ application: 'code-en-clair', format: 1, notes: [] })") === false, 'une sauvegarde d’une autre application est refusée');

  // ── L'adresse partagée ouvre l'article ────────────────────────────────────
  await demarrage(BASE + 'index.html?article=kabbale');
  await attendre("Fiche.ouverte && Fiche.ref === 'kabbale'", 4000, '« ?article=kabbale » ouvre l’article');
  ok(await js("return Fiche.ref") === 'kabbale', 'l’adresse « ?article=kabbale » ouvre l’article');

  // ── Le service worker, la coquille et le hors-ligne ───────────────────────
  await demarrage();
  const sonde = await js("try { const c = await caches.open('sonde'); await c.put('/sonde', new Response('bonjour')); await caches.delete('sonde'); return true; } catch (e) { return String(e); }");
  if (sonde !== true) {
    echecs.push('API Cache inutilisable dans ce Chrome (' + sonde + ') : hors-ligne non éprouvé');
  } else {
    await attendre('navigator.serviceWorker.controller', 15000, 'le service worker prend la main');
    const fichiers = await js("const c = await caches.open('arcanes-coquille-" + VERSION_SW + "'); return (await c.keys()).map((r) => new URL(r.url).pathname)");
    const swSource = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf-8');
    const liste = JSON.parse('[' + /const FICHIERS = \[([\s\S]*?)\];/.exec(swSource)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']');
    ok(fichiers.length === liste.length, 'la coquille contient tous les fichiers (' + fichiers.length + ' / ' + liste.length + ')');
    // Tout ce que la page a chargé est dans la coquille
    const charges = await js("return performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname).filter((p) => !p.startsWith('/sw.js') && !p.startsWith('/img/'))");
    const dans = new Set(liste.map((f) => '/' + f.replace(/^\.\//, '')));
    const absents = Array.from(new Set(charges)).filter((p) => !dans.has(p) && !dans.has(p.replace(/^\//, '')) && p !== '/');
    ok(absents.length === 0, 'tout ce que la page charge est dans la coquille (absents : ' + absents.join(', ') + ')');
    // Les illustrations se rangent dans leur propre cache
    const rangees = await js("const e = await Illustrations.entretenir(true); const c = await caches.open('arcanes-images'); return { prets: e.prets, total: e.total, dans: (await c.keys()).length }");
    ok(rangees.total === MANIFESTE.images && rangees.prets === rangees.total && rangees.dans === rangees.total,
      'toutes les illustrations sont rangées pour le hors-ligne (' + rangees.dans + ' / ' + MANIFESTE.images + ')');
    // Hors ligne : le serveur s'arrête, l'application se rouvre
    await serveur.arreter();
    await demarrage();
    ok(await js('return Dictionnaire.articles.length') >= MANIFESTE.articles, 'hors ligne, l’application se rouvre avec tout le dictionnaire');
    await js("Fiche.ouvrir('alchimie'); return 1");
    await attendre("Fiche.ref === 'alchimie' && document.querySelector('#fiche .figure svg')", 4000, 'hors ligne, une fiche et sa figure s’ouvrent');
    ok(await js('return !!navigator.serviceWorker.controller'), 'hors ligne, c’est bien le service worker qui sert la page');
    await js("Fiche.ouvrir('arcane-mat'); return 1");
    await attendre("Fiche.ref === 'arcane-mat' && document.querySelectorAll('#fiche .illustration img').length === 2 && Array.from(document.querySelectorAll('#fiche .illustration img')).every((i) => i.complete && i.naturalWidth > 0)", 6000, 'hors ligne, les cartes du Mat s’affichent');
  }
} catch (e) {
  echecs.push('exception : ' + (e && e.stack ? e.stack : e));
} finally {
  if (onglet) {
    const erreurs = onglet.erreurs.filter((x) => !/net::ERR_CONNECTION_REFUSED|Failed to load resource|favicon/.test(x));
    ok(erreurs.length === 0, 'aucune erreur dans la page :\n      ' + erreurs.slice(0, 8).join('\n      '));
    onglet.fermer();
  }
  await fermerChrome(chrome);
  try { await serveur.arreter(); } catch (e) { /* déjà arrêté */ }
}

function Dictionnaire_CATS() {
  const d = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'dictionnaire.json'), 'utf-8'));
  return new Set(d.articles.map((a) => a.c)).size;
}

function MANIFESTE_DATES() {
  const d = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'dictionnaire.json'), 'utf-8'));
  return d.articles.filter((a) => typeof a.an === 'number').length;
}

console.log(bons + ' épreuve(s) réussie(s)');
if (echecs.length) {
  console.log(echecs.length + ' ÉCHEC(S) :');
  for (const e of echecs) console.log('  ✗ ' + e);
  process.exit(1);
}
