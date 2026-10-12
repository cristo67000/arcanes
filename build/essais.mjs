/*
 * Recette fonctionnelle, dans un vrai Chrome piloté par le protocole DevTools.
 *
 *     node build/essais.mjs
 *
 * Elle ouvre l'application à la taille d'un téléphone et fait ce que ferait une
 * personne : chercher, ouvrir un article, suivre un renvoi, toucher une figure,
 * écrire une note et un article, réviser, parcourir la frise, changer les
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
  ok(await js("return document.querySelector('#compte').textContent") === n + ' articles', 'le compteur dit « ' + n + ' articles »');
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
  ok(await js("return !!document.querySelector('#fiche .f-noeud-actif')"), 'la séphira de l’article est mise en avant');
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
  await js('Fiche.fermer(); return 1');
  await attendre('!Fiche.ouverte', 3000, 'fermeture');
  await pause(500);

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

  // ── La frise ──────────────────────────────────────────────────────────────
  await js("App.aller('frise'); return 1");
  await pause(400);
  const dates = await js("return document.querySelectorAll('#frise-contenu .frise-ligne').length");
  ok(dates === MANIFESTE_DATES(), 'la frise montre tous les articles datés (' + dates + ')');
  ok(await js("return document.querySelectorAll('#frise-epoques .epoque').length") === 7, 'les sept époques ont leur bouton');
  ok(await js("const ans = Array.from(document.querySelectorAll('#frise-contenu .frise-ligne')).map((b) => Dictionnaire.parId(b.getAttribute('data-ref')).an); return ans.every((a, i) => i === 0 || ans[i - 1] <= a)"), 'la frise est dans l’ordre chronologique');
  await js("Array.from(document.querySelectorAll('#frise-filtres .filtre')).find((b) => /Figures/.test(b.textContent)).click(); return 1");
  await pause(300);
  ok(await js("return Array.from(document.querySelectorAll('#frise-contenu .frise-ligne')).every((b) => Dictionnaire.parId(b.getAttribute('data-ref')).c === 'figures')"), 'le filtre « Figures » ne garde que les figures');

  // ── La révision ───────────────────────────────────────────────────────────
  await js("App.aller('quiz'); return 1");
  await pause(400);
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
