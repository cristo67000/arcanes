/*
 * Construit data/dictionnaire.json à partir des fichiers de build/articles/*.txt.
 *
 *     node build/construire.mjs
 *
 * ── Le format d'un article ──────────────────────────────────────────────────
 *
 * Un article s'écrit comme il se lit. Une ligne « clé: valeur » par champ ; une
 * ligne qui commence par deux espaces continue le champ précédent.
 *
 *     @ hermes-trismegiste          l'identifiant (minuscules, chiffres, tirets)
 *     cat: figures                  la catégorie (voir CATEGORIES)
 *     nom: Hermès Trismégiste       la vedette
 *     alias: Thot, Mercure…         autres noms cherchés par la recherche
 *     dates: figure légendaire      (facultatif) ce qu'on affiche sous la vedette
 *     an: -100                      (facultatif) une année, pour la frise
 *     glyphe: mercure               (facultatif) un signe de js/glyphes.js
 *     def: Une phrase.              la définition courte : liste, quiz, cartes
 *     texte: Un paragraphe…         le corps de l'article ; un « texte: » par
 *       suite du paragraphe           paragraphe, autant qu'il en faut
 *     repere: 1527 — Un fait.       (facultatif) une date de la vie ou de l'histoire,
 *                                   pour la chronologie « Repères » ; un
 *                                   « repere: » par date, dans l'ordre
 *     oeuvres: Titre (1614) ; …     (facultatif) œuvres ou éditions principales
 *     attention: …                  (facultatif) « à ne pas confondre »
 *     schema: nom                   (facultatif) une figure de js/figures/*.js
 *     voir: id, id                  articles voisins
 *
 * Dans « def », « texte », « repere » et « attention » :
 *
 *     [[id]]           renvoi vers un article, affiché sous le nom de l'article
 *     [[id|texte]]     renvoi affiché sous un autre texte (« [[kabbale|kabbalistes]] »)
 *     *titre*          italique, pour les titres d'œuvres et les mots étrangers
 *
 * Les liens vers d'autres sites (« Pour aller plus loin ») ne sont pas dans
 * les articles mais dans build/liens.txt, une ligne par article : voir l'en-tête
 * de ce fichier.
 *
 * Le script échoue à la moindre incohérence — identifiant en double, renvoi
 * vers un article qui n'existe pas, italique mal fermée, définition absente :
 * une erreur de contenu ne doit pas arriver dans le téléphone de quelqu'un.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.dirname(ICI);

/* Les catégories : l'ordre est celui des filtres. */
const CATEGORIES = [
  { id: 'courants',   nom: 'Courants et traditions' },
  { id: 'figures',    nom: 'Figures' },
  { id: 'textes',     nom: 'Textes et livres' },
  { id: 'notions',    nom: 'Notions et doctrines' },
  { id: 'alchimie',   nom: 'Alchimie' },
  { id: 'kabbale',    nom: 'Kabbale et nombres' },
  { id: 'astrologie', nom: 'Astrologie' },
  { id: 'divination', nom: 'Tarot et divination' },
  { id: 'magie',      nom: 'Magie et rituels' },
  { id: 'societes',   nom: 'Ordres et sociétés' },
  { id: 'maconnerie', nom: 'Franc-maçonnerie' },
  { id: 'symboles',   nom: 'Symboles' },
];
const ID_CATEGORIES = new Set(CATEGORIES.map((c) => c.id));

/* Les « portes d'entrée » de l'accueil : par où commencer quand on ne sait
 * rien. L'ordre est celui de l'affichage. */
const PORTES = ['esoterisme', 'hermetisme', 'alchimie', 'kabbale', 'gnose', 'rose-croix',
  'franc-maconnerie', 'theosophie', 'occultisme', 'astrologie', 'tarot', 'magie'];

/* Dans le cours d'une phrase, « la [[pierre-philosophale]] » s'écrit en
 * minuscule, mais « la [[kabbale]] de [[isaac-louria]] » garde la majuscule du
 * nom propre. Les catégories de noms communs passent en minuscule, sauf les
 * noms propres de la liste ci-dessous (et les arcanes, qui sont des titres). */
const CATEGORIES_COMMUNES = new Set(['courants', 'notions', 'alchimie', 'kabbale', 'astrologie', 'divination', 'magie', 'symboles', 'maconnerie']);
const NOMS_PROPRES = new Set([
  'atlantide', 'lemurie', 'agartha', 'sophia', 'shekhina', 'ein-sof', 'adam-kadmon', 'keter', 'hokhmah', 'binah',
  'daat', 'hesed', 'gueboura', 'tiferet', 'netsah', 'hod', 'yesod', 'malkhout', 'shem-ha-meforash', 'grand-oeuvre',
  'vitriol', 'jeu-lenormand', 'yi-king', 'thelema', 'new-age', 'quatrieme-voie', 'sabeens-de-harran', 'nouvelle-pensee',
  'naturphilosophie', 'baphomet', 'graal', 'belier', 'taureau', 'gemeaux', 'cancer', 'lion', 'vierge', 'balance',
  'scorpion', 'sagittaire', 'capricorne', 'verseau', 'poissons', 'soleil', 'lune', 'mercure', 'venus', 'mars',
  'jupiter', 'saturne', 'uranus', 'neptune', 'pluton',
  // la franc-maçonnerie : rites, obédiences, titres et lieux s'écrivent avec la majuscule
  'orient', 'venerable-maitre', 'surveillants', 'grand-architecte-de-l-univers', 'sagesse-force-beaute',
  'rite-francais', 'rite-emulation', 'rite-d-york', 'arche-royale', 'rite-suedois', 'rite-schroder', 'stricte-observance',
  'rite-de-perfection', 'philalethes', 'rite-ecossais-ancien-et-accepte', 'rite-ecossais-rectifie', 'rite-de-memphis-misraim',
  'chevalier-rose-croix', 'chevalier-kadosh', 'grande-loge-de-londres', 'grande-loge-unie-d-angleterre', 'grand-orient-de-france',
  'grande-loge-de-france', 'glnf', 'droit-humain', 'grande-loge-feminine-de-france', 'prince-hall', 'convent-de-wilhelmsbad',
  'les-neuf-soeurs', 'temple-de-salomon',
]);
function enMinuscule(a) {
  return CATEGORIES_COMMUNES.has(a.cat) && !NOMS_PROPRES.has(a.id) && !a.id.startsWith('arcane-')
    && !/^\p{Lu}{2}/u.test(a.nom);
}

const CLES = new Set(['cat', 'nom', 'alias', 'dates', 'an', 'glyphe', 'def', 'texte', 'repere', 'oeuvres',
  'attention', 'schema', 'voir']);

const erreurs = [];
const avertissements = [];
function erreur(lieu, message) { erreurs.push(lieu + ' — ' + message); }
function avertir(lieu, message) { avertissements.push(lieu + ' — ' + message); }

/* Typographie française : apostrophe courbe entre deux lettres, espace fine
 * insécable avant « ; : ! ? », espace insécable à l'intérieur des guillemets.
 * Les deux espaces sont fabriquées ici plutôt qu'écrites dans le source : à
 * l'œil, rien ne les distingue d'une espace ordinaire. */
const FINE = String.fromCharCode(0x202f);
const INSECABLE = String.fromCharCode(0xa0);
const EXPOSANT_E = String.fromCharCode(0x1d49);
const EXPOSANT_R = String.fromCharCode(0x2b3);
function typographie(texte) {
  return texte
    .replace(/(\p{L})'(?=\p{L}|\[\[|\*)/gu, '$1’')
    // XVIIe siècle, Ier : l'ordinal en exposant, comme dans un livre
    .replace(/\b([IVX]+)e(?=[\s,.;:!?)–-]|$)/g, '$1' + EXPOSANT_E)
    .replace(/\b([IVX]+)er(?=[\s,.;:!?)–-]|$)/g, '$1' + EXPOSANT_E + EXPOSANT_R)
    .replace(/ ([;:!?])/g, FINE + '$1')
    .replace(/« /g, '«' + INSECABLE)
    .replace(/ »/g, INSECABLE + '»')
    .replace(/ – /g, INSECABLE + '– ');
}

// ── Lecture d'un fichier d'articles ─────────────────────────────────────────

function lireFichier(fichier, articles) {
  const nom = path.basename(fichier);
  const lignes = fs.readFileSync(fichier, 'utf-8').replace(/\r\n?/g, '\n').split('\n');
  let article = null;
  let champ = null;       // { cible, cle, indice } : le champ en cours de continuation

  lignes.forEach((ligne, i) => {
    const lieu = nom + ':' + (i + 1);
    if (ligne.trim() === '') { champ = null; return; }
    if (ligne.startsWith('#')) return;

    if (ligne.startsWith('@ ')) {
      const id = ligne.slice(2).trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) erreur(lieu, 'identifiant invalide « ' + id + ' »');
      article = { id, cat: null, nom: null, al: [], dates: '', an: null, gl: '', def: '', textes: [], reperes: [],
        oeuvres: '', attention: '', schema: '', voir: [], lieu, fichier: nom };
      articles.push(article);
      champ = null;
      return;
    }
    if (!article) { erreur(lieu, 'contenu avant le premier « @ identifiant »'); return; }

    if (ligne.startsWith('  ')) {
      if (!champ) { erreur(lieu, 'ligne indentée sans champ à continuer'); return; }
      if (champ.indice !== undefined) {
        champ.cible[champ.cle][champ.indice] = (champ.cible[champ.cle][champ.indice] + ' ' + ligne.trim()).trim();
      } else {
        champ.cible[champ.cle] = (champ.cible[champ.cle] + ' ' + ligne.trim()).trim();
      }
      return;
    }

    const m = /^([a-z]+):\s?(.*)$/.exec(ligne);
    if (!m || !CLES.has(m[1])) { erreur(lieu, 'ligne incomprise : « ' + ligne.slice(0, 60) + ' »'); return; }
    const cle = m[1];
    const valeur = m[2].trim();
    champ = null;
    switch (cle) {
      case 'cat': article.cat = valeur; break;
      case 'nom': article.nom = valeur; break;
      case 'alias': article.al = valeur.split(',').map((s) => s.trim()).filter(Boolean); break;
      case 'dates': article.dates = valeur; break;
      case 'an':
        if (!/^-?\d{1,4}$/.test(valeur)) erreur(lieu, 'année invalide « ' + valeur + ' »');
        article.an = parseInt(valeur, 10);
        break;
      case 'glyphe': article.gl = valeur; break;
      case 'def':
        if (article.def) erreur(lieu, 'deux « def: »');
        article.def = valeur; champ = { cible: article, cle: 'def' };
        break;
      case 'texte':
        article.textes.push(valeur);
        champ = { cible: article, cle: 'textes', indice: article.textes.length - 1 };
        break;
      case 'repere':
        article.reperes.push(valeur);
        champ = { cible: article, cle: 'reperes', indice: article.reperes.length - 1 };
        break;
      case 'oeuvres': article.oeuvres = valeur; champ = { cible: article, cle: 'oeuvres' }; break;
      case 'attention': article.attention = valeur; champ = { cible: article, cle: 'attention' }; break;
      case 'schema': article.schema = valeur; break;
      case 'voir': article.voir = valeur.split(',').map((s) => s.trim()).filter(Boolean); break;
      default: break;
    }
  });
}

// ── Ce que l'application sait dessiner ──────────────────────────────────────

function chargerScripts(dossierOuFichier, cle) {
  const fenetre = {};
  const contexte = vm.createContext({ window: fenetre });
  const fichiers = fs.statSync(dossierOuFichier).isDirectory()
    ? fs.readdirSync(dossierOuFichier).filter((x) => x.endsWith('.js')).sort().map((f) => path.join(dossierOuFichier, f))
    : [dossierOuFichier];
  for (const f of fichiers) {
    try {
      vm.runInContext(fs.readFileSync(f, 'utf-8'), contexte, { filename: path.basename(f) });
    } catch (e) {
      erreur(path.relative(RACINE, f), 'ne se charge pas : ' + e.message);
    }
  }
  return fenetre[cle] || {};
}

// ── Les renvois dans le texte ───────────────────────────────────────────────

/* Vérifie un texte balisé et renvoie les identifiants qu'il cite. */
function analyser(texte, lieu, ids) {
  const cites = [];
  const sansLiens = texte.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (tout, id, libelle) => {
    if (!ids.has(id)) erreur(lieu, 'renvoi vers un article inexistant « ' + id + ' »');
    if (libelle !== undefined && !libelle.trim()) erreur(lieu, 'renvoi au libellé vide « ' + id + ' »');
    // l'italique se met autour du renvoi, pas dedans : « *[[zohar|Zohar]]* »
    if (libelle !== undefined && libelle.includes('*')) erreur(lieu, 'italique dans le libellé d’un renvoi « ' + id + ' »');
    cites.push(id);
    return libelle || 'X';
  });
  if (/\[\[|\]\]/.test(sansLiens)) erreur(lieu, 'crochets de renvoi mal fermés');
  if ((sansLiens.match(/\*/g) || []).length % 2) erreur(lieu, 'italique mal fermée (nombre impair d’astérisques)');
  if (/TBD|XXX|\?\?\?|à compléter|lorem ipsum/i.test(texte)) erreur(lieu, 'marque de travail restée dans le texte');
  if (/\s{2,}/.test(texte)) avertir(lieu, 'espaces doublées');
  return cites;
}

/* Le texte nu (renvois remplacés par leur libellé, sans astérisques). */
function nu(texte, noms) {
  return texte
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (tout, id, libelle) => libelle || noms.get(id) || id)
    .replace(/\*/g, '');
}

// ── Les repères ─────────────────────────────────────────────────────────────

/* « 1527 — Nommé médecin de la ville de Bâle. » : la date, un tiret cadratin
 * entouré d'espaces, le fait. La date reste courte (« vers 1460 », « 1608 ou
 * 1609 », « 205 av. J.-C. ») et les repères vont dans l'ordre : une année qui
 * recule trahit une faute de frappe. */
function anneeDe(date) {
  if (/si[eè]cle/.test(date)) return null;
  // « 17 janvier 1382 » : l'année est le nombre le plus long, pas le premier
  const nombres = date.match(/\d{1,4}/g);
  if (!nombres) return null;
  const n = nombres.reduce((a, b) => (b.length > a.length ? b : a));
  return /av\.\s?J\.-C\./.test(date) ? -parseInt(n, 10) : parseInt(n, 10);
}

function lireReperes(a, lieu, ids, liens) {
  const sortie = [];
  let avant = null;
  for (const r of a.reperes) {
    const m = /^(.+?) — (.+)$/.exec(r);
    if (!m) { erreur(lieu, 'repère sans « date — fait » : « ' + r.slice(0, 50) + ' »'); continue; }
    const [, date, fait] = m;
    if (date.length > 28) erreur(lieu, 'date de repère trop longue « ' + date + ' »');
    if (!/\d|si[eè]cle/.test(date)) erreur(lieu, 'date de repère sans année « ' + date + ' »');
    if (!/[.!?»)]$/.test(fait)) avertir(lieu, 'repère sans point final « ' + fait.slice(-30) + ' »');
    for (const id of analyser(fait, lieu, ids)) liens.add(id);
    const an = anneeDe(date);
    if (an !== null && avant !== null && an < avant) erreur(lieu, 'repères dans le désordre : « ' + date + ' » après ' + avant);
    if (an !== null) avant = an;
    sortie.push([typographie(date), typographie(fait)]);
  }
  return sortie;
}

// ── Les liens vers d'autres sites ───────────────────────────────────────────

/* build/liens.txt : « id: lien | lien | … ». Chaque lien est une sorte, une
 * valeur et, pour certaines sortes, « = libellé ». Le résultat, dans le JSON :
 * [source, libellé, adresse], dans l'ordre du fichier. */
const SORTES = {
  wp: (v) => ['Wikipédia', v, 'https://fr.wikipedia.org/wiki/' + titreUrl(v)],
  en: (v) => ['Wikipedia (en anglais)', v, 'https://en.wikipedia.org/wiki/' + titreUrl(v)],
  ws: (v, l) => ['Wikisource', l || (/^Auteur:/.test(v) ? 'les textes de l’auteur' : v + ', texte intégral'),
    'https://fr.wikisource.org/wiki/' + titreUrl(v)],
  bnf: (v) => ['BnF', 'notice, œuvres et éditions', 'https://data.bnf.fr/ark:/12148/cb' + v],
  gallica: (v, l) => ['Gallica (BnF)', l, 'https://gallica.bnf.fr/ark:/12148/' + v],
  ia: (v, l) => ['Internet Archive', l, 'https://archive.org/details/' + v],
  url: (v, l) => [new URL(v).hostname.replace(/^www\./, ''), l, v],
};
const AVEC_LIBELLE = new Set(['gallica', 'ia', 'url']);
const VALEURS = {
  bnf: /^\d{8}[0-9bcdfghjkmnpqrstvwxz]$/,
  gallica: /^bpt6k[0-9a-z]+(\/f\d+(\.item)?)?$|^btv1b[0-9a-z]+(\/f\d+(\.item)?)?$/,
  ia: /^[A-Za-z0-9._-]+$/,
  url: /^https:\/\/[^\s]+$/,
};

/* Titre de page wiki → chemin d'adresse : espaces en soulignés, le reste
 * encodé sauf ce que les wikis laissent lisible. */
function titreUrl(titre) {
  return encodeURIComponent(titre.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')
    .replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
}

function lireLiens(ids) {
  const fichier = path.join(ICI, 'liens.txt');
  const resultat = new Map();
  if (!fs.existsSync(fichier)) return resultat;
  const lignes = fs.readFileSync(fichier, 'utf-8').replace(/\r\n?/g, '\n').split('\n');
  lignes.forEach((ligne, i) => {
    const lieu = 'liens.txt:' + (i + 1);
    if (!ligne.trim() || ligne.startsWith('#')) return;
    const m = /^([a-z0-9-]+):\s*(.*)$/.exec(ligne);
    if (!m) { erreur(lieu, 'ligne incomprise « ' + ligne.slice(0, 60) + ' »'); return; }
    const [, id, reste] = m;
    if (!ids.has(id)) { erreur(lieu, 'article inexistant « ' + id + ' »'); return; }
    if (resultat.has(id)) { erreur(lieu, 'deuxième ligne pour « ' + id + ' »'); return; }
    if (reste.trim() === '-') { resultat.set(id, []); return; }
    const liste = [];
    for (const morceau of reste.split(' | ')) {
      const mm = /^([a-z]+) (.+)$/.exec(morceau.trim());
      if (!mm || !SORTES[mm[1]]) { erreur(lieu, 'lien incompris « ' + morceau + ' »'); continue; }
      const [, sorte, brut] = mm;
      let valeur = brut.trim();
      let libelle = '';
      const k = valeur.indexOf(' = ');
      if (k >= 0 && (AVEC_LIBELLE.has(sorte) || sorte === 'ws')) {
        libelle = valeur.slice(k + 3).trim();
        valeur = valeur.slice(0, k).trim();
      } else if (AVEC_LIBELLE.has(sorte)) {
        erreur(lieu, 'lien « ' + sorte + ' » sans « = libellé »'); continue;
      }
      if (VALEURS[sorte] && !VALEURS[sorte].test(valeur)) { erreur(lieu, 'valeur « ' + sorte + ' » invalide « ' + valeur + ' »'); continue; }
      const [source, l, adresse] = SORTES[sorte](valeur, typographie(libelle));
      liste.push([source, l, adresse]);
    }
    const adresses = liste.map((x) => x[2]);
    if (new Set(adresses).size !== adresses.length) erreur(lieu, 'lien en double');
    resultat.set(id, liste);
  });
  return resultat;
}

// ── Les illustrations ───────────────────────────────────────────────────────

/* build/illustrations.json, écrit par build/illustrer.py : chaque image, son
 * fichier dans img/, sa légende, son crédit, les articles où elle paraît ; et
 * les planches, galeries de vignettes rattachées à un article. Une image dont
 * le fichier manque, un article inconnu : erreur, comme pour un renvoi. */
function lireIllustrations(ids) {
  const fichier = path.join(ICI, 'illustrations.json');
  const resultat = { parArticle: new Map(), planches: new Map(), nombre: 0, octets: 0 };
  if (!fs.existsSync(fichier)) return resultat;
  const { images, planches } = JSON.parse(fs.readFileSync(fichier, 'utf-8'));
  const licence = (lic) => (/cc0/i.test(lic) ? 'CC0' : 'domaine public');
  const vue = (id, im) => ({ f: im.f, v: im.v, w: im.w, h: im.h });
  for (const [id, im] of Object.entries(images)) {
    const chemin = path.join(RACINE, im.f);
    if (!fs.existsSync(chemin)) { erreur('illustrations', 'fichier absent : ' + im.f + ' (relancer build/illustrer.py)'); continue; }
    resultat.nombre += 1;
    resultat.octets += fs.statSync(chemin).size;
    for (const ref of im.pour) {
      if (!ids.has(ref)) { erreur('illustrations', 'image « ' + id + ' » : article inexistant « ' + ref + ' »'); continue; }
      if (!resultat.parArticle.has(ref)) resultat.parArticle.set(ref, []);
      resultat.parArticle.get(ref).push(Object.assign(vue(id, im), {
        l: typographie(im.l), cr: typographie(im.cr), li: licence(im.lic), src: im.src,
      }));
    }
  }
  for (const [ref, liste] of Object.entries(planches)) {
    if (!ids.has(ref)) { erreur('illustrations', 'planche : article inexistant « ' + ref + ' »'); continue; }
    resultat.planches.set(ref, liste.map((p) => ({
      ti: typographie(p.titre),
      im: p.images.map((id) => {
        const im = images[id];
        // la vignette ouvre le premier article de l'image, s'il n'est pas celui-ci
        const cible = im.pour.find((r) => r !== ref);
        return Object.assign(vue(id, im), { l: typographie(im.l), cr: typographie(im.cr), li: licence(im.lic), src: im.src },
          cible ? { r: cible } : {});
      }),
    })));
  }
  return resultat;
}

// ── Assemblage ──────────────────────────────────────────────────────────────

function main() {
  const dossier = path.join(ICI, 'articles');
  const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.txt')).sort();
  const articles = [];
  for (const f of fichiers) lireFichier(path.join(dossier, f), articles);

  const figures = chargerScripts(path.join(RACINE, 'js', 'figures'), 'Figures');
  const glyphes = chargerScripts(path.join(RACINE, 'js', 'glyphes.js'), 'Glyphes');
  const ids = new Map();
  const noms = new Map();
  const figuresUtilisees = new Set();
  const cites = new Map();          // id → articles qui le citent

  for (const a of articles) {
    if (ids.has(a.id)) erreur(a.lieu, 'identifiant « ' + a.id + ' » déjà pris à ' + ids.get(a.id));
    ids.set(a.id, a.lieu);
    noms.set(a.id, a.nom);
  }

  const vedettes = new Map();
  for (const a of articles) {
    const lieu = a.lieu + ' (' + a.id + ')';
    if (!a.nom) erreur(lieu, 'pas de « nom: »');
    if (!ID_CATEGORIES.has(a.cat)) erreur(lieu, 'catégorie inconnue « ' + a.cat + ' »');
    if (!a.def) erreur(lieu, 'pas de « def: »');
    if (!a.textes.length) erreur(lieu, 'pas de « texte: »');
    if (a.gl && !glyphes[a.gl]) erreur(lieu, 'glyphe inconnu « ' + a.gl + ' »');
    if (a.schema) {
      // « arbre-sephiroth/keter » : la figure, puis ce qu'elle doit mettre en avant
      const [nomFigure, argument] = a.schema.split('/');
      figuresUtilisees.add(nomFigure);
      if (!figures[nomFigure]) erreur(lieu, 'figure introuvable « ' + nomFigure + ' »');
      else if (argument && !(figures[nomFigure].cles || []).includes(argument)) {
        erreur(lieu, 'la figure « ' + nomFigure + ' » ne connaît pas « ' + argument + ' »');
      }
    }
    const cle = (a.nom || '').toLowerCase();
    if (vedettes.has(cle)) avertir(lieu, 'même vedette que ' + vedettes.get(cle));
    vedettes.set(cle, a.id);

    const liens = new Set();
    for (const champ of [a.def, a.attention].concat(a.textes)) {
      for (const id of analyser(champ, lieu, ids)) liens.add(id);
    }
    a.reperesLus = lireReperes(a, lieu, ids, liens);
    if (liens.has(a.id)) erreur(lieu, 'l’article se cite lui-même');
    for (const v of a.voir) {
      if (!ids.has(v)) erreur(lieu, 'voir : article inexistant « ' + v + ' »');
      if (v === a.id) erreur(lieu, 'voir : renvoie à lui-même');
    }
    for (const id of liens) {
      if (!cites.has(id)) cites.set(id, new Set());
      cites.get(id).add(a.id);
    }
    a.liens = liens;

    const def = nu(a.def, noms);
    if (def.length < 40) erreur(lieu, 'définition trop courte (' + def.length + ')');
    if (def.length > 260) avertir(lieu, 'définition longue (' + def.length + ')');
    if (!/[.!?»)]$/.test(def)) avertir(lieu, 'la définition ne finit pas par un point');
    const corps = a.textes.map((t) => nu(t, noms)).join(' ');
    if (corps.length < 200) avertir(lieu, 'article court (' + corps.length + ' signes)');
  }
  const illustrations = lireIllustrations(ids);
  const liensExterieurs = lireLiens(ids);
  for (const p of PORTES) if (!ids.has(p)) erreur('PORTES', 'article inexistant « ' + p + ' »');
  for (const id of NOMS_PROPRES) if (!ids.has(id)) erreur('NOMS_PROPRES', 'article inexistant « ' + id + ' »');
  for (const nomFigure of Object.keys(figures)) {
    if (!figuresUtilisees.has(nomFigure)) avertir('js/figures', 'figure jamais utilisée : ' + nomFigure);
  }

  if (erreurs.length) {
    console.error('\n' + erreurs.length + ' ERREUR(S) :');
    for (const e of erreurs) console.error('  ✗ ' + e);
    process.exit(1);
  }

  // Tri : par vedette, sans tenir compte des accents ni de la casse.
  const cleTri = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/^[^a-z0-9]+/, '');
  articles.sort((a, b) => cleTri(a.nom).localeCompare(cleTri(b.nom), 'fr'));

  const sortie = {
    format: 1,
    cats: CATEGORIES,
    portes: PORTES,
    articles: articles.map((a) => {
      const o = { id: a.id, c: a.cat, n: a.nom, d: typographie(a.def), t: a.textes.map(typographie) };
      if (a.al.length) o.al = a.al;
      if (a.dates) o.da = typographie(a.dates);
      if (a.an !== null) o.an = a.an;
      if (a.gl) o.gl = a.gl;
      if (a.reperesLus.length) o.re = a.reperesLus;
      if (a.oeuvres) o.oe = a.oeuvres.split(/\s;\s/).map((s) => typographie(s.trim())).filter(Boolean);
      if (a.attention) o.at = typographie(a.attention);
      if (a.schema) o.sc = a.schema;
      if (a.voir.length) o.v = a.voir;
      if (illustrations.parArticle.has(a.id)) o.im = illustrations.parArticle.get(a.id);
      if (illustrations.planches.has(a.id)) o.pl = illustrations.planches.get(a.id);
      if (liensExterieurs.has(a.id) && liensExterieurs.get(a.id).length) o.li = liensExterieurs.get(a.id);
      if (enMinuscule(a)) o.mn = 1;
      const par = cites.get(a.id);
      if (par && par.size) o.ci = Array.from(par).sort((x, y) => cleTri(noms.get(x)).localeCompare(cleTri(noms.get(y)), 'fr'));
      return o;
    }),
  };

  const json = JSON.stringify(sortie);
  fs.writeFileSync(path.join(RACINE, 'data', 'dictionnaire.json'), json, 'utf-8');
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const mots = articles.reduce((n, a) => n + a.textes.map((t) => nu(t, noms)).join(' ').split(/\s+/).length, 0);
  const manifeste = {
    format: 1, construit: aujourdhui, articles: articles.length,
    figures: Object.keys(figures).length, mots, octets: Buffer.byteLength(json),
    images: illustrations.nombre, octetsImages: illustrations.octets,
  };
  fs.writeFileSync(path.join(RACINE, 'data', 'manifeste.json'), JSON.stringify(manifeste) + '\n', 'utf-8');

  // Rapport
  const parCat = {};
  for (const a of articles) parCat[a.cat] = (parCat[a.cat] || 0) + 1;
  const sansRenvoiEntrant = articles.filter((a) => !cites.has(a.id) && !articles.some((b) => b.voir.includes(a.id)));
  const lignes = [
    'Dictionnaire construit le ' + aujourdhui,
    articles.length + ' articles, ' + mots + ' mots, '
      + articles.filter((a) => a.an !== null).length + ' datés pour la frise, '
      + articles.filter((a) => a.schema).length + ' avec figure (' + figuresUtilisees.size + ' / ' + Object.keys(figures).length + ' figures), '
      + articles.filter((a) => a.gl).length + ' avec glyphe',
    articles.filter((a) => a.reperesLus.length).length + ' avec des repères (' + articles.reduce((n, a) => n + a.reperesLus.length, 0) + '), '
      + articles.filter((a) => (liensExterieurs.get(a.id) || []).length).length + ' avec des liens extérieurs ('
      + Array.from(liensExterieurs.values()).reduce((n, l) => n + l.length, 0) + ')',
    illustrations.nombre + ' illustrations (' + Math.round(illustrations.octets / 1024) + ' Ko) dans '
      + illustrations.parArticle.size + ' articles, ' + illustrations.planches.size + ' planche(s)',
    Buffer.byteLength(json) + ' octets de JSON',
    '',
    ...CATEGORIES.map((c) => '  ' + c.id.padEnd(11) + String(parCat[c.id] || 0).padStart(4)),
    '',
    sansRenvoiEntrant.length + ' article(s) que rien ne cite : ' + sansRenvoiEntrant.map((a) => a.id).join(', '),
  ];
  if (avertissements.length) {
    lignes.push('', avertissements.length + ' avertissement(s) :');
    for (const a of avertissements) lignes.push('  ! ' + a);
  }
  fs.writeFileSync(path.join(ICI, 'rapport.txt'), lignes.join('\n') + '\n', 'utf-8');
  console.log(lignes.join('\n'));
}

main();
