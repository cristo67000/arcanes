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
 *     geo: 42.8756, 1.8322          (facultatif ; obligatoire pour un lieu) latitude et
 *                                   longitude en degrés décimaux, quatre décimales
 *                                   au moins : l'article paraît sur la carte
 *     lieu: Ariège, France          (avec geo) où il se trouve, en clair
 *     extrait: Un passage cité…     (facultatif) un extrait d'une œuvre du domaine
 *                                   public, recopié tel quel ; « ¶ » sépare deux
 *                                   paragraphes, « // » deux vers, « (…) » marque
 *                                   une coupure. Toujours suivi de sa source :
 *     source: René Guénon, *Le Théosophisme*, 1921, chap. I | gallica bd6t5924664v | ws Titre
 *                                   (« wsen Title » : Wikisource en anglais, pour un original
 *                                   que rien ne traduit librement, comme les poèmes de Kipling)
 *                                   la référence (le titre en italique), puis des
 *                                   liens comme dans build/liens.txt, sans libellé
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
  { id: 'apocryphes', nom: 'Apocryphes et écrits gnostiques' },
  { id: 'notions',    nom: 'Notions et doctrines' },
  { id: 'alchimie',   nom: 'Alchimie' },
  { id: 'kabbale',    nom: 'Kabbale' },
  { id: 'astrologie', nom: 'Astrologie' },
  { id: 'divination', nom: 'Tarot et divination' },
  { id: 'magie',      nom: 'Magie et rituels' },
  { id: 'societes',   nom: 'Ordres et sociétés' },
  { id: 'maconnerie', nom: 'Franc-maçonnerie' },
  { id: 'symboles',   nom: 'Symboles' },
  { id: 'mythes',     nom: 'Mythes et allégories' },
  { id: 'litterature', nom: 'Littérature' },
  { id: 'peinture',   nom: 'Peinture et gravure' },
  { id: 'bestiaire',  nom: 'Animaux fantastiques et symboliques' },
  { id: 'egypte',     nom: 'Égyptologie' },
  { id: 'codes',      nom: 'Codes secrets' },
  { id: 'nombres',    nom: 'Symbolisme des nombres' },
  { id: 'astronomie', nom: 'Astronomie' },
  { id: 'pierres',    nom: 'Pierres et lieux d’énergie' },
  { id: 'echecs',     nom: 'Jeu d’échecs' },
  { id: 'lieux',      nom: 'Lieux' },
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
const CATEGORIES_COMMUNES = new Set(['courants', 'notions', 'alchimie', 'kabbale', 'astrologie', 'divination', 'magie', 'symboles', 'maconnerie',
  'nombres', 'astronomie', 'pierres', 'echecs', 'bestiaire', 'egypte', 'codes', 'mythes', 'apocryphes']);
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
  'les-neuf-soeurs', 'temple-de-salomon', 'jakin', 'boaz',
  // les astres, les lieux et les œuvres des rubriques nouvelles
  'grande-ourse', 'petite-ourse', 'orion', 'pleiades', 'sirius', 'voie-lactee', 'ophiuchus',
  'sedona', 'avebury', 'melencolia', 'les-bergers-d-arcadie',
  // l'Égypte, ses dieux et ses livres ; les codes et les bêtes qui portent un nom propre
  'isis', 'osiris', 'horus', 'thot', 'anubis', 'ra', 'seth', 'maat', 'hathor', 'amon', 'ptah', 'serapis', 'apophis',
  'enneade', 'ogdoade', 'livre-des-morts', 'textes-des-pyramides', 'enigma', 'codex-copiale', 'le-scarabee-d-or',
  'les-hommes-dansants', 'grand-chiffre', 'pegase', 'cerbere', 'minotaure', 'tarasque', 'leviathan', 'behemoth',
  'quinotaure', 'simurgh', 'asmodee', 'toison-d-or', 'neuf-preux', 'sacre-coeur',
  // les héros et les livres des mythes ; les évangiles et les écrits apocryphes, qui sont des titres
  'argonautes', 'medee', 'promethee', 'pandore', 'circe', 'ariane', 'narcisse', 'atalante', 'oedipe',
  'thesee-et-le-minotaure', 'dedale-et-icare', 'eros-et-psyche', 'dionysos-zagreus', 'hercule-a-la-croisee-des-chemins',
  'de-iside-et-osiride', 'de-la-sagesse-des-anciens', 'deluge',
  'evangile-de-judas', 'evangile-de-marie', 'evangile-de-thomas', 'evangile-de-philippe', 'evangile-de-verite',
  'evangile-de-nicodeme', 'evangile-de-pierre', 'apocryphon-de-jean', 'protevangile-de-jacques', 'hymne-de-la-perle',
  'barbelo', 'pistis-sophia', 'livre-d-henoch',
  // les personnages, les livres et les lieux des mythes de la Bible
  'lilith', 'jonas', 'ophir', 'salome', 'cain-et-abel', 'jerusalem-celeste', 'tubal-cain', 'elias-artista',
  'testament-de-salomon', 'juif-errant',
]);
function enMinuscule(a) {
  return CATEGORIES_COMMUNES.has(a.cat) && !NOMS_PROPRES.has(a.id) && !a.id.startsWith('arcane-')
    && !/^\p{Lu}{2}/u.test(a.nom);
}

const CLES = new Set(['cat', 'nom', 'alias', 'dates', 'an', 'glyphe', 'def', 'texte', 'repere', 'oeuvres',
  'attention', 'schema', 'geo', 'lieu', 'extrait', 'source', 'voir']);

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
        oeuvres: '', attention: '', schema: '', geo: null, lo: '', extraits: [], voir: [], lieu, fichier: nom };
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
      case 'geo': {
        const g = /^(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})$/.exec(valeur);
        if (!g) { erreur(lieu, 'coordonnées illisibles « ' + valeur + ' » (« 42.8756, 1.8322 »)'); break; }
        const [lat, lon] = [parseFloat(g[1]), parseFloat(g[2])];
        if (Math.abs(lat) > 78 || Math.abs(lon) > 180) erreur(lieu, 'coordonnées hors de la carte « ' + valeur + ' »');
        article.geo = [lat, lon];
        break;
      }
      case 'lieu': article.lo = valeur; break;
      case 'extrait':
        article.extraits.push({ texte: valeur, source: '', lieu });
        champ = { cible: article.extraits[article.extraits.length - 1], cle: 'texte' };
        break;
      case 'source': {
        const dernier = article.extraits[article.extraits.length - 1];
        if (!dernier || dernier.source) { erreur(lieu, '« source: » sans « extrait: » juste avant'); break; }
        dernier.source = valeur;
        champ = { cible: dernier, cle: 'source' };
        break;
      }
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
  if (/\bTBD\b|\bXXX\b|\?\?\?|à compléter|lorem ipsum/i.test(texte)) erreur(lieu, 'marque de travail restée dans le texte');
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

// ── Les extraits ────────────────────────────────────────────────────────────

/* Un extrait est un passage recopié d'une œuvre du domaine public : pas de
 * renvoi dedans (ce n'est pas notre texte), une source qui dit d'où il vient,
 * le titre de l'œuvre en italique, et au moins un lien vers le document.
 * Dans le JSON : [paragraphes, référence, liens]. */
function lireExtraits(a) {
  const sortie = [];
  for (const ex of a.extraits) {
    const lieu = ex.lieu + ' (' + a.id + ')';
    if (/\[\[|\]\]/.test(ex.texte)) erreur(lieu, 'un renvoi dans un extrait');
    if ((ex.texte.match(/\*/g) || []).length % 2) erreur(lieu, 'italique mal fermée dans un extrait');
    const long = ex.texte.replace(/\*/g, '').length;
    if (long < 120) erreur(lieu, 'extrait trop court (' + long + ')');
    if (long > 1500) avertir(lieu, 'extrait long (' + long + ')');
    if (/^[«"“]/.test(ex.texte.trim())) erreur(lieu, 'l’extrait s’écrit sans guillemets autour : la mise en page les pose');
    if (!ex.source) { erreur(lieu, 'extrait sans « source: »'); continue; }
    const [reference, ...morceaux] = ex.source.split(' | ');
    if (!/\*[^*]+\*/.test(reference)) erreur(lieu, 'la source d’un extrait donne le titre en italique : « ' + reference + ' »');
    if ((reference.match(/\*/g) || []).length % 2) erreur(lieu, 'italique mal fermée dans la source');
    const liens = morceaux.map((m) => lireLien(m, lieu, LIBELLES_SOURCE)).filter(Boolean);
    if (!liens.length) erreur(lieu, 'la source d’un extrait mène au document (gallica, ws, ia…)');
    // « // » sépare deux vers : la fiche les pose sur deux lignes
    const paragraphes = ex.texte.split(/\s*¶\s*/).map((p) => typographie(p).replace(/\s*\/\/\s*/g, '\n'));
    sortie.push([paragraphes, typographie(reference.trim()), liens]);
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
  // Wikisource en anglais : le texte original, quand l'œuvre n'a pas de traduction libre
  wsen: (v, l) => ['Wikisource (en anglais)', l || v + ', texte original', 'https://en.wikisource.org/wiki/' + titreUrl(v)],
  bnf: (v) => ['BnF', 'notice, œuvres et éditions', 'https://data.bnf.fr/ark:/12148/cb' + v],
  gallica: (v, l) => ['Gallica (BnF)', l, 'https://gallica.bnf.fr/ark:/12148/' + v],
  ia: (v, l) => ['Internet Archive', l, 'https://archive.org/details/' + v],
  url: (v, l) => [new URL(v).hostname.replace(/^www\./, ''), l, v],
};
const AVEC_LIBELLE = new Set(['gallica', 'ia', 'url']);
const VALEURS = {
  bnf: /^\d{8}[0-9bcdfghjkmnpqrstvwxz]$/,
  gallica: /^(bpt6k|btv1b|bd6t)[0-9a-z]+(\/f\d+(\.item)?)?$/,
  ia: /^[A-Za-z0-9._-]+$/,
  url: /^https:\/\/[^\s]+$/,
};

/* Titre de page wiki → chemin d'adresse : espaces en soulignés, le reste
 * encodé sauf ce que les wikis laissent lisible. */
function titreUrl(titre) {
  return encodeURIComponent(titre.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')
    .replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
}

/* Un lien « sorte valeur [= libellé] » → [source, libellé, adresse], ou null
 * (l'erreur est notée). `defauts` donne un libellé aux sortes qui en exigent un. */
function lireLien(morceau, lieu, defauts) {
  const mm = /^([a-z]+) (.+)$/.exec(morceau.trim());
  if (!mm || !SORTES[mm[1]]) { erreur(lieu, 'lien incompris « ' + morceau + ' »'); return null; }
  const [, sorte, brut] = mm;
  let valeur = brut.trim();
  let libelle = '';
  const k = valeur.indexOf(' = ');
  if (k >= 0 && (AVEC_LIBELLE.has(sorte) || sorte === 'ws' || sorte === 'wsen')) {
    libelle = valeur.slice(k + 3).trim();
    valeur = valeur.slice(0, k).trim();
  } else if (AVEC_LIBELLE.has(sorte) && !(defauts && defauts[sorte])) {
    erreur(lieu, 'lien « ' + sorte + ' » sans « = libellé »'); return null;
  }
  if (!libelle && defauts && defauts[sorte]) libelle = defauts[sorte];
  if (VALEURS[sorte] && !VALEURS[sorte].test(valeur)) { erreur(lieu, 'valeur « ' + sorte + ' » invalide « ' + valeur + ' »'); return null; }
  return SORTES[sorte](valeur, typographie(libelle));
}

/* Les liens de la source d'un extrait mènent au document lui-même : d'où
 * leur libellé par défaut. */
const LIBELLES_SOURCE = { gallica: 'le livre numérisé', ia: 'le livre numérisé', ws: 'le texte transcrit', wsen: 'le texte original transcrit' };

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
      const l = lireLien(morceau, lieu);
      if (l) liste.push(l);
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
function lireIllustrations(ids, animations) {
  const fichier = path.join(ICI, 'illustrations.json');
  const resultat = { parArticle: new Map(), planches: new Map(), nombre: 0, octets: 0 };
  if (!fs.existsSync(fichier)) return resultat;
  const { images, planches } = JSON.parse(fs.readFileSync(fichier, 'utf-8'));
  const licence = (lic) => (/cc0/i.test(lic) ? 'CC0' : 'domaine public');
  const vue = (id, im) => Object.assign({ f: im.f, v: im.v, w: im.w, h: im.h }, animations && animations.has(id) ? { an: animations.get(id) } : {});
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

// ── Les sons ────────────────────────────────────────────────────────────────

/* build/sons.json, écrit par build/sonoriser.py : chaque son, son fichier dans
 * son/, son titre, son crédit, les articles où il s'écoute. Dans le JSON d'un
 * article : `so`, une liste de { id, f, v, d (durée en secondes), ti, cr, li, src }. */
function lireSons(ids) {
  const fichier = path.join(ICI, 'sons.json');
  const resultat = { parArticle: new Map(), parId: new Map(), nombre: 0, octets: 0 };
  if (!fs.existsSync(fichier)) return resultat;
  const { sons } = JSON.parse(fs.readFileSync(fichier, 'utf-8'));
  const licence = (lic) => (/cc0/i.test(lic) ? 'CC0' : 'domaine public');
  for (const [id, s] of Object.entries(sons)) {
    const chemin = path.join(RACINE, s.f);
    if (!fs.existsSync(chemin)) { erreur('sons', 'fichier absent : ' + s.f + ' (relancer build/sonoriser.py)'); continue; }
    resultat.nombre += 1;
    resultat.octets += fs.statSync(chemin).size;
    const vue = { id, f: s.f, v: s.v, d: s.d, ti: typographie(s.ti), cr: typographie(s.cr), li: licence(s.lic), src: s.src };
    resultat.parId.set(id, vue);
    for (const ref of s.pour) {
      if (!ids.has(ref)) { erreur('sons', 'son « ' + id + ' » : article inexistant « ' + ref + ' »'); continue; }
      if (!resultat.parArticle.has(ref)) resultat.parArticle.set(ref, []);
      resultat.parArticle.get(ref).push(vue);
    }
  }
  return resultat;
}

// ── Les animations des images ───────────────────────────────────────────────

/* build/animations.txt (le format est en tête du fichier) : pour une image,
 * des effets dessinés par js/animations.js par-dessus la gravure, et le son
 * qui les accompagne. Les coordonnées sont des fractions de la largeur et de
 * la hauteur de l'image. Dans le JSON, l'image porte `an` : { ti, so, e }. */
const EFFETS = {
  carte: { coins: 'points', figure: 'mot', delai: 'nombre', duree: 'nombre' },
  teinte: { ellipse: 'nombres', rect: 'nombres', polygone: 'points', couleur: 'couleur', flou: 'nombre', force: 'nombre', delai: 'nombre' },
  bouge: { polygone: 'points', pivot: 'point', mode: 'mot', ampleur: 'nombre', duree: 'nombre', fois: 'nombre', delai: 'nombre' },
  lueur: { point: 'point', rayon: 'nombre', couleur: 'couleur', mode: 'mot', force: 'nombre', delai: 'nombre', duree: 'nombre' },
  etincelles: { zone: 'nombres', nombre: 'nombre', couleur: 'couleur', taille: 'nombre', delai: 'nombre' },
  fumee: { point: 'point', couleur: 'couleur', hauteur: 'nombre', largeur: 'nombre', nombre: 'nombre', delai: 'nombre', duree: 'nombre' },
  eclair: { trace: 'points', couleur: 'couleur', delai: 'nombre', fois: 'nombre' },
  rayons: { point: 'point', rayon: 'nombre', nombre: 'nombre', couleur: 'couleur', delai: 'nombre' },
  lutin: { image: 'image', point: 'point', largeur: 'nombre', mode: 'mot', depuis: 'decalage', ovale: 'nombres', delai: 'nombre', duree: 'nombre', couleurs: 'nombre' },
  pluie: { zone: 'nombres', nombre: 'nombre', couleur: 'couleur', pente: 'nombre', delai: 'nombre' },
  inscription: { texte: 'texte', point: 'point', taille: 'nombre', couleur: 'couleur', delai: 'nombre' },
  vagues: { ligne: 'nombre', hauteur: 'nombre', longueur: 'nombre', couleur: 'couleur', ecume: 'couleur', ovale: 'nombres', force: 'nombre', delai: 'nombre', vitesse: 'nombre' },
};
const OBLIGATOIRES = { carte: ['coins', 'figure'], teinte: ['couleur'], bouge: ['polygone', 'pivot', 'mode'], lueur: ['point', 'rayon'],
  etincelles: ['zone'], fumee: ['point'], eclair: [], rayons: ['point'], lutin: ['image', 'point', 'largeur'], vagues: ['ligne'], pluie: [], inscription: ['texte', 'point'] };
const MOTS = { figure: ['as-coeur', 'as-carreau', 'as-pique', 'as-trefle'],
  mode: ['tourne', 'leve', 'tremble', 'balance', 'flotte', 'vacille', 'pulse', 'eclat', 'nage', 'surgit', 'apparait'] };
const SONS_SYNTHESE = ['carte', 'coups', 'tonnerre', 'vent', 'feu', 'cloche', 'gong', 'tic', 'coeur', 'enchantement', 'souffle', 'eau'];

function lireAnimations(sons) {
  const fichier = path.join(ICI, 'animations.txt');
  const resultat = new Map();
  if (!fs.existsSync(fichier)) return resultat;
  const images = fs.existsSync(path.join(ICI, 'illustrations.json'))
    ? JSON.parse(fs.readFileSync(path.join(ICI, 'illustrations.json'), 'utf-8')).images : {};
  const dansImage = (v) => v >= -0.1 && v <= 1.1;
  function valeur(sorte, brut, lieu, cle) {
    if (sorte === 'nombre') {
      const n = Number(brut);
      if (!Number.isFinite(n)) erreur(lieu, '« ' + cle + ' » : nombre attendu');
      return n;
    }
    if (sorte === 'nombres') {
      const l = brut.split(/\s+/).map(Number);
      if (l.length !== 4 || !l.every(Number.isFinite) || !l.every(dansImage)) erreur(lieu, '« ' + cle + ' » : quatre fractions attendues');
      return l;
    }
    if (sorte === 'point' || sorte === 'points') {
      const l = brut.split(',').map((p) => p.trim().split(/\s+/).map(Number));
      if (!l.every((p) => p.length === 2 && p.every(Number.isFinite) && p.every(dansImage))) erreur(lieu, '« ' + cle + ' » : points « x y, x y… » attendus');
      if (sorte === 'point' && l.length !== 1) erreur(lieu, '« ' + cle + ' » : un seul point');
      return sorte === 'point' ? l[0] : l;
    }
    if (sorte === 'couleur') {
      if (!/^#[0-9a-f]{6}$/i.test(brut)) erreur(lieu, '« ' + cle + ' » : couleur #rrggbb attendue');
      return brut.toLowerCase();
    }
    if (sorte === 'decalage') {
      // un déplacement, pas une place : il peut partir de hors de l'image
      const p = brut.split(/\s+/).map(Number);
      if (p.length !== 2 || !p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)) erreur(lieu, '« ' + cle + ' » : deux fractions entre -1 et 1 attendues');
      return p;
    }
    if (sorte === 'image') {
      // une figure découpée de build/illustrations.txt, posée par l'animation
      const im = images[brut];
      if (!im) { erreur(lieu, 'image inconnue pour le lutin : ' + brut); return null; }
      return { id: brut, f: im.f, v: im.v, w: im.w, h: im.h, l: typographie(im.l), cr: typographie(im.cr) };
    }
    if (MOTS[cle] && !MOTS[cle].includes(brut)) erreur(lieu, '« ' + cle + ' » inconnu : ' + brut);
    return brut;
  }
  let courant = null;
  fs.readFileSync(fichier, 'utf-8').split(/\r?\n/).forEach((ligne, i) => {
    const lieu = 'animations.txt:' + (i + 1);
    if (!ligne.trim() || ligne.startsWith('#')) return;
    if (ligne.startsWith('= ')) {
      const id = ligne.slice(2).trim();
      if (!images[id]) erreur(lieu, 'image inconnue « ' + id + ' »');
      if (resultat.has(id)) erreur(lieu, 'image déjà animée « ' + id + ' »');
      courant = { e: [] };
      resultat.set(id, courant);
      return;
    }
    const m = /^([a-z]+):\s*(.*)$/.exec(ligne);
    if (!m || !courant) { erreur(lieu, 'ligne illisible'); return; }
    if (m[1] === 'titre') { courant.ti = typographie(m[2].trim()); return; }
    if (m[1] === 'credit') { courant.cr = typographie(m[2].trim()); return; }
    if (m[1] === 'son') {
      const s = m[2].trim();
      if (s.startsWith('synth:')) {
        if (!SONS_SYNTHESE.includes(s.slice(6))) erreur(lieu, 'son de synthèse inconnu « ' + s + ' »');
        courant.so = { s: s.slice(6) };
      } else if (sons.parId.has(s)) {
        courant.so = sons.parId.get(s);
      } else erreur(lieu, 'son inconnu « ' + s + ' »');
      return;
    }
    if (m[1] !== 'effet') { erreur(lieu, 'champ inconnu « ' + m[1] + ' »'); return; }
    const morceaux = m[2].split(';').map((x) => x.trim()).filter(Boolean);
    const t = morceaux.shift();
    if (!EFFETS[t]) { erreur(lieu, 'effet inconnu « ' + t + ' »'); return; }
    const e = { t };
    for (const p of morceaux) {
      const k = /^([a-z]+)=(.+)$/.exec(p);
      if (!k || !EFFETS[t][k[1]]) { erreur(lieu, 'paramètre inconnu pour « ' + t + ' » : ' + p); continue; }
      e[k[1]] = valeur(EFFETS[t][k[1]], k[2].trim(), lieu, k[1]);
    }
    for (const o of OBLIGATOIRES[t]) if (e[o] === undefined) erreur(lieu, '« ' + t + ' » demande « ' + o + ' »');
    if (t === 'carte' && e.coins && e.coins.length !== 3) erreur(lieu, 'une carte se pose par trois coins');
    if (t === 'bouge' && e.polygone && e.polygone.length < 3) erreur(lieu, 'un polygone a au moins trois points');
    courant.e.push(e);
  });
  for (const [id, a] of resultat) if (!a.e.length) erreur('animations.txt', 'image « ' + id + ' » sans effet');
  return resultat;
}

// ── Les parcours ────────────────────────────────────────────────────────────

/* build/parcours.txt : des chemins guidés d'article en article (le format est
 * en tête du fichier). Dans le JSON : { id, n (nom), d (ce qu'il raconte),
 * e (les étapes, dans l'ordre) }. Une étape inconnue ou en double : erreur. */
function lireParcours(ids) {
  const fichier = path.join(ICI, 'parcours.txt');
  const sortie = [];
  if (!fs.existsSync(fichier)) return sortie;
  const lignes = fs.readFileSync(fichier, 'utf-8').replace(/\r\n?/g, '\n').split('\n');
  let p = null;
  let champ = null;
  lignes.forEach((ligne, i) => {
    const lieu = 'parcours.txt:' + (i + 1);
    if (!ligne.trim()) { champ = null; return; }
    if (ligne.startsWith('#')) return;
    if (ligne.startsWith('= ')) {
      const id = ligne.slice(2).trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) erreur(lieu, 'identifiant de parcours invalide « ' + id + ' »');
      if (sortie.some((x) => x.id === id)) erreur(lieu, 'parcours en double « ' + id + ' »');
      p = { id, nom: '', def: '', etapes: '', lieu };
      sortie.push(p);
      champ = null;
      return;
    }
    if (!p) { erreur(lieu, 'contenu avant le premier « = parcours »'); return; }
    if (ligne.startsWith('  ') && champ) { p[champ] += ' ' + ligne.trim(); return; }
    const m = /^(nom|def|etapes):\s?(.*)$/.exec(ligne);
    if (!m) { erreur(lieu, 'ligne incomprise « ' + ligne.slice(0, 60) + ' »'); return; }
    champ = m[1];
    p[champ] = m[2].trim();
  });
  return sortie.map((x) => {
    const etapes = x.etapes.split(',').map((s) => s.trim()).filter(Boolean);
    if (!x.nom) erreur(x.lieu, 'parcours sans « nom: »');
    if (!x.def) erreur(x.lieu, 'parcours sans « def: »');
    if (etapes.length < 4) erreur(x.lieu, 'un parcours compte au moins quatre étapes');
    for (const e of etapes) if (!ids.has(e)) erreur(x.lieu, 'étape inexistante « ' + e + ' »');
    if (new Set(etapes).size !== etapes.length) erreur(x.lieu, 'étape en double dans « ' + x.id + ' »');
    return { id: x.id, n: typographie(x.nom), d: typographie(x.def), e: etapes };
  });
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
    a.extraitsLus = lireExtraits(a);
    if (a.cat === 'lieux' && !a.geo) erreur(lieu, 'un lieu sans « geo: »');
    if (a.geo && !a.lo) erreur(lieu, '« geo: » sans « lieu: »');
    if (a.lo && !a.geo) erreur(lieu, '« lieu: » sans « geo: »');

    const def = nu(a.def, noms);
    if (def.length < 40) erreur(lieu, 'définition trop courte (' + def.length + ')');
    if (def.length > 260) avertir(lieu, 'définition longue (' + def.length + ')');
    if (!/[.!?»)]$/.test(def)) avertir(lieu, 'la définition ne finit pas par un point');
    const corps = a.textes.map((t) => nu(t, noms)).join(' ');
    if (corps.length < 200) avertir(lieu, 'article court (' + corps.length + ' signes)');
  }
  const sons = lireSons(ids);
  const animations = lireAnimations(sons);
  const illustrations = lireIllustrations(ids, animations);
  const liensExterieurs = lireLiens(ids);
  const parcours = lireParcours(ids);
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
    parcours,
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
      if (a.geo) o.g = a.geo;
      if (a.lo) o.lo = typographie(a.lo);
      if (a.extraitsLus.length) o.ex = a.extraitsLus;
      if (a.voir.length) o.v = a.voir;
      if (illustrations.parArticle.has(a.id)) o.im = illustrations.parArticle.get(a.id);
      if (illustrations.planches.has(a.id)) o.pl = illustrations.planches.get(a.id);
      if (sons.parArticle.has(a.id)) o.so = sons.parArticle.get(a.id);
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
    lieux: articles.filter((a) => a.geo).length,
    extraits: articles.reduce((n, a) => n + a.extraitsLus.length, 0),
    parcours: parcours.length,
    sons: sons.nombre, octetsSons: sons.octets, animations: animations.size,
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
    articles.filter((a) => a.geo).length + ' sur la carte, '
      + articles.reduce((n, a) => n + a.extraitsLus.length, 0) + ' extraits dans ' + articles.filter((a) => a.extraitsLus.length).length + ' articles',
    illustrations.nombre + ' illustrations (' + Math.round(illustrations.octets / 1024) + ' Ko) dans '
      + illustrations.parArticle.size + ' articles, ' + illustrations.planches.size + ' planche(s)',
    parcours.length + ' parcours (' + parcours.reduce((n, p) => n + p.e.length, 0) + ' étapes)',
    sons.nombre + ' sons (' + Math.round(sons.octets / 1024) + ' Ko) dans ' + sons.parArticle.size + ' articles, '
      + animations.size + ' images animées',
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
