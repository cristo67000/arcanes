'use strict';
/*
 * Le dictionnaire : chargement, index de recherche, article du jour, frise.
 *
 * Tout tient dans un seul fichier, data/dictionnaire.json (six cents Ko) : il
 * est chargé en entier au démarrage et gardé en mémoire, ce qui rend la
 * recherche instantanée et sans réseau. Les articles que la personne écrit
 * elle-même (`Store.tousLesArticlesPerso`) sont fondus dans le même index,
 * avec une marque `perso`.
 *
 * Forme d'un article, tel que build/construire.mjs l'écrit :
 *
 *   id, c (catégorie), n (vedette), d (définition courte), t (paragraphes),
 *   al (autres noms), da (dates à afficher), an (année pour la frise),
 *   gl (signe), oe (œuvres), at (« à ne pas confondre »), sc (figure),
 *   v (voir aussi), ci (articles qui le citent), g ([latitude, longitude]),
 *   lo (où est le lieu), ex (extraits : [paragraphes, référence, liens])
 *
 * Les textes portent deux balises : [[id]] ou [[id|libellé]] pour un renvoi,
 * *mots* pour l'italique. `rendu.js` les met en forme ; `nu()` les retire.
 *
 * Les parcours (build/parcours.txt) sont des chemins guidés : { id, n (nom),
 * d (ce qu'il raconte), e (les étapes, des identifiants, dans l'ordre) }.
 *
 * Ajoutés au chargement : `cle` (vedette normalisée), `cleTri` (sans l'article
 * de tête : « Le Bateleur » se range à B), `cles` (toutes les graphies
 * cherchables), `texte` (définition et corps normalisés, pour la recherche
 * plein texte), `defNue`, `lettre`, `perso`.
 */
(function (racine) {

  const { normaliser } = Outils;

  let articles = [];
  let parId = new Map();
  let categories = [];
  let portes = [];
  let parcours = [];
  let livres = [];          // les articles du dictionnaire, sans ceux de la personne
  const noms = new Map();   // id → vedette, pour les renvois sans libellé

  const CATEGORIE_PERSO = { id: 'perso', nom: 'Mes articles' };

  // ── Textes ────────────────────────────────────────────────────────────────

  const RENVOI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const DEBUT_DE_PHRASE = /(^|[.!?…])\s*$/;
  const minuscules = new Set();   // les vedettes qui s'écrivent en minuscule dans une phrase

  /* Le texte sans balises : renvois remplacés par leur libellé (en minuscule
   * pour un nom commun en cours de phrase, comme dans rendu.js), sans astérisques. */
  function nu(texte) {
    return String(texte || '')
      .replace(RENVOI, (tout, id, libelle, position, chaine) => {
        if (libelle) return libelle;
        const nom = noms.get(id) || id;
        if (!minuscules.has(id) || DEBUT_DE_PHRASE.test(chaine.slice(0, position))) return nom;
        return nom.charAt(0).toLocaleLowerCase('fr') + nom.slice(1);
      })
      .replace(/\*/g, '');
  }

  /* « Le Bateleur » → « bateleur », « L’Hermite » → « hermite » : la clé de
   * tri et de la réglette des lettres. */
  function sansArticle(cle) {
    return cle.replace(/^(le |la |les |l')/, '').replace(/^[^a-z0-9]+/, '') || cle;
  }

  function preparer(a) {
    const graphies = [a.n].concat(a.al || []).filter(Boolean);
    const cles = [];
    for (const g of graphies) {
      const n = normaliser(g);
      if (!n) continue;
      cles.push(n);
      const nue = sansArticle(n);
      if (nue !== n) cles.push(nue);
      // « Rose-Croix » se trouve aussi par « rose croix » et « rosecroix »
      if (n.includes('-')) { cles.push(n.replace(/-/g, ' ')); cles.push(n.replace(/-/g, '')); }
    }
    a.cle = normaliser(a.n);
    a.cleTri = sansArticle(a.cle);
    a.cles = cles;
    a.defNue = nu(a.d);
    a.texte = normaliser(a.defNue + ' ' + (a.t || []).map(nu).join(' ') + ' ' + (a.re || []).map((r) => nu(r[1])).join(' ')
      + ' ' + (a.lo || '') + ' ' + (a.ex || []).map((x) => nu(x[0].join(' '))).join(' '));
    const premiere = a.cleTri.charAt(0).toUpperCase();
    a.lettre = /[A-Z]/.test(premiere) ? premiere : '#';
    return a;
  }

  async function charger(manifeste) {
    const reponse = await fetch('data/dictionnaire.json' + (manifeste ? '?m=' + encodeURIComponent(manifeste.construit) : ''));
    if (!reponse.ok) throw new Error('dictionnaire : ' + reponse.status);
    const donnees = await reponse.json();
    categories = donnees.cats;
    portes = donnees.portes || [];
    parcours = donnees.parcours || [];
    for (const a of donnees.articles) {
      noms.set(a.id, a.n);
      if (a.mn) minuscules.add(a.id);
    }
    livres = donnees.articles.map(preparer);
    reconstruire([]);
    return { articles: livres.length };
  }

  /* Fond les articles de la personne dans l'index. */
  function reconstruire(perso) {
    const siens = perso.map((p) => {
      noms.set('perso:' + p.id, p.nom);
      return preparer({
        id: 'perso:' + p.id, c: p.cat || 'perso', n: p.nom, d: p.def || '',
        t: p.texte ? p.texte.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) : [],
        al: p.alias || [], perso: true, cree: p.cree,
      });
    });
    articles = livres.concat(siens);
    articles.sort(comparer);
    parId = new Map(articles.map((a) => [a.id, a]));
    cites.clear();
  }

  function comparer(a, b) {
    return a.cleTri.localeCompare(b.cleTri, 'fr') || a.cle.localeCompare(b.cle, 'fr');
  }

  function categorie(id) {
    return categories.find((c) => c.id === id) || CATEGORIE_PERSO;
  }

  // ── Recherche ─────────────────────────────────────────────────────────────

  /* Note un article pour une requête, 0 s'il ne correspond pas. Du plus fort
   * au plus faible : la vedette elle-même, un autre nom, puis le texte. */
  function noter(a, q, jetons) {
    if (a.cle === q || a.cleTri === q) return { note: 100, via: '' };
    let meilleur = 0;
    let via = '';
    if (a.cle.startsWith(q) || a.cleTri.startsWith(q)) meilleur = 82;
    for (const g of a.cles) {
      if (g === q) { if (meilleur < 92) { meilleur = 92; via = g; } } else if (g.startsWith(q)) { if (meilleur < 72) { meilleur = 72; via = g; } } else if (g.includes(q)) { if (meilleur < 58) { meilleur = 58; via = g; } }
    }
    if (a.cle.includes(q) && meilleur < 64) meilleur = 64;
    if (meilleur) return { note: meilleur, via: via === a.cle || via === a.cleTri ? '' : via };

    if (jetons.length > 1) {
      const tout = a.cles.join(' ') + ' ' + a.texte;
      if (jetons.every((j) => tout.includes(j))) {
        const dansNoms = jetons.every((j) => a.cles.some((c) => c.includes(j)));
        return { note: dansNoms ? 50 : 22, via: dansNoms ? '' : 'texte' };
      }
      return { note: 0, via: '' };
    }
    if (q.length >= 3 && a.texte.includes(q)) return { note: 20, via: 'texte' };
    return { note: 0, via: '' };
  }

  /* Cherche, éventuellement dans une seule catégorie. Renvoie
   * [{ article, note, via }] du plus pertinent au moins pertinent. */
  function chercher(requete, options) {
    const opt = options || {};
    const q = normaliser(requete);
    let base = articles;
    if (opt.cat) base = base.filter((a) => a.c === opt.cat);
    if (!q) return base.map((article) => ({ article, note: 0, via: '' }));
    const jetons = q.split(' ').filter(Boolean);
    const trouves = [];
    for (const article of base) {
      const r = noter(article, q, jetons);
      if (r.note > 0) trouves.push({ article, note: r.note, via: r.via });
    }
    trouves.sort((x, y) => (y.note - x.note)
      // à note égale dans le texte, les articles qui en parlent le plus d'abord
      || (x.via === 'texte' && y.via === 'texte' ? occurrences(y.article, q) - occurrences(x.article, q) : 0)
      || comparer(x.article, y.article));
    return trouves;
  }

  function occurrences(article, q) {
    let n = 0;
    let i = article.texte.indexOf(q);
    while (i !== -1 && n < 20) { n += 1; i = article.texte.indexOf(q, i + q.length); }
    return n;
  }

  /* Rien trouvé : les articles dont un nom est à une ou deux fautes de la
   * requête (« paracelce », « kabale », « rosicrusien »). */
  function suggerer(requete, options) {
    const opt = options || {};
    const q = normaliser(requete);
    if (q.length < 3) return [];
    const plafond = q.length <= 4 ? 1 : (q.length <= 8 ? 2 : 3);
    const proches = [];
    for (const a of articles) {
      if (opt.cat && a.c !== opt.cat) continue;
      let ecart = plafond + 1;
      for (const g of a.cles) {
        ecart = Math.min(ecart, Outils.distance(q, g, plafond));
        if (q.length >= 4 && g.length > q.length) ecart = Math.min(ecart, Outils.distance(q, g.slice(0, q.length), 1) + 0.5);
      }
      if (ecart <= plafond) proches.push({ a, ecart });
    }
    proches.sort((x, y) => (x.ecart - y.ecart) || comparer(x.a, y.a));
    return proches.slice(0, opt.max || 4).map((p) => p.a);
  }

  /* La graphie d'origine d'une clé normalisée : montre par quel nom un
   * résultat a été trouvé (« Zarathoustra » pour Zoroastre). */
  function graphie(a, cle) {
    const toutes = [a.n].concat(a.al || []);
    return toutes.find((g) => {
      const n = normaliser(g);
      return n === cle || sansArticle(n) === cle;
    }) || null;
  }

  function auHasard(options) {
    const opt = options || {};
    const base = articles.filter((a) => !opt.cat || a.c === opt.cat);
    const neufs = opt.dejaVus ? base.filter((a) => !opt.dejaVus.has(a.id) && a.id !== opt.sauf) : [];
    const choix = neufs.length ? neufs : base.filter((a) => a.id !== opt.sauf);
    return choix.length ? choix[Math.floor(Math.random() * choix.length)] : null;
  }

  // ── Quiz : masquer le nom dans la définition ──────────────────────────────

  function echapper(motif) {
    return motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* Remplace, dans un texte, les noms des articles donnés par « … » : une
   * définition qui contient le mot qu'on cherche le livrerait. */
  function masquer(texte, liste) {
    let sortie = texte;
    const aMasquer = new Set();
    for (const a of liste) {
      for (const g of [a.n].concat(a.al || [])) {
        const propre = String(g || '').replace(/^(le |la |les |l[’'])/i, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        if (propre.length >= 3) aMasquer.add(propre);
        // les noms composés : « Hermès Trismégiste » masque aussi « Hermès »
        for (const mot of propre.split(/\s+/)) if (mot.length >= 6 && /^\p{Lu}/u.test(mot)) aMasquer.add(mot);
      }
    }
    for (const nom of Array.from(aMasquer).sort((x, y) => y.length - x.length)) {
      const motif = new RegExp('(^|[^\\p{L}\\p{N}])' + echapper(nom) + '(?:s|es|x)?(?=$|[^\\p{L}\\p{N}])', 'giu');
      sortie = sortie.replace(motif, '$1…');
    }
    return sortie;
  }

  // ── L'article du jour ─────────────────────────────────────────────────────

  /* Un article par jour, le même pour tout le monde ce jour-là, pris parmi
   * ceux qui ont de quoi faire un bel aperçu : une figure ou un signe, ou au
   * moins deux paragraphes. */
  function articleDuJour() {
    const riches = livres.filter((a) => a.sc || a.gl || (a.t && a.t.length >= 2));
    const base = riches.length ? riches : livres;
    if (!base.length) return null;
    const graine = (Outils.jourCourant() * 2654435761) >>> 0;
    return base[graine % base.length];
  }

  // ── Les parcours et les liens ─────────────────────────────────────────────

  function unParcours(id) {
    return parcours.find((p) => p.id === id) || null;
  }

  /* Les parcours où paraît un article : [{ p, i }], i étant sa place dans p.e. */
  function parcoursDe(id) {
    const sortie = [];
    for (const p of parcours) {
      const i = p.e.indexOf(id);
      if (i !== -1) sortie.push({ p, i });
    }
    return sortie;
  }

  /* Les articles qu'un article cite dans sa définition, son texte, ses repères
   * et sa mise en garde (les renvois [[id]]), gardés une fois calculés. */
  const cites = new Map();
  function citesPar(a) {
    if (cites.has(a.id)) return cites.get(a.id);
    const ids = new Set();
    for (const t of [a.d, a.at].concat(a.t || [], (a.re || []).map((r) => r[1]))) {
      for (const m of String(t || '').matchAll(RENVOI)) if (m[1] !== a.id && parId.has(m[1])) ids.add(m[1]);
    }
    cites.set(a.id, ids);
    return ids;
  }

  // ── La frise ──────────────────────────────────────────────────────────────

  const EPOQUES = [
    { id: 'antiquite', nom: 'Antiquité', fin: 500 },
    { id: 'moyen-age', nom: 'Moyen Âge', fin: 1450 },
    { id: 'renaissance', nom: 'Renaissance', fin: 1600 },
    { id: 'xviie', nom: 'XVIIe siècle', fin: 1700 },
    { id: 'xviiie', nom: 'XVIIIe siècle', fin: 1800 },
    { id: 'xixe', nom: 'XIXe siècle', fin: 1900 },
    { id: 'xxe', nom: 'XXe siècle', fin: 10000 },
  ];

  function epoque(an) {
    return EPOQUES.find((e) => an < e.fin) || EPOQUES[EPOQUES.length - 1];
  }

  function frise(options) {
    const opt = options || {};
    return livres
      .filter((a) => typeof a.an === 'number' && (!opt.cat || a.c === opt.cat))
      .sort((x, y) => (x.an - y.an) || comparer(x, y));
  }

  /* « 1433 », « vers 530 av. J.-C. » : l'année de la frise, lisible. */
  function annee(an) {
    if (typeof an !== 'number') return '';
    return an < 0 ? Math.abs(an) + ' av. J.-C.' : String(an);
  }

  racine.Dictionnaire = {
    charger, reconstruire, categorie, chercher, suggerer, graphie, auHasard, masquer, nu,
    articleDuJour, frise, epoque, annee, EPOQUES, CATEGORIE_PERSO,
    unParcours, parcoursDe, citesPar,
    get parcours() { return parcours; },
    get articles() { return articles; },
    get livres() { return livres; },
    get categories() { return categories; },
    get portes() { return portes.map((id) => parId.get(id)).filter(Boolean); },
    parId: (id) => parId.get(id) || null,
    nom: (id) => noms.get(id) || null,
  };

})(window);
