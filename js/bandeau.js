'use strict';
/*
 * Le bandeau de la frise : les siècles en largeur, les vies en barres.
 *
 * En haut, les figures : chacune a sa barre, de la naissance à la mort, tirée
 * de ses dates (« 1493 – 1541 », « vers 130 – vers 202 », « 530 – 495 av.
 * J.-C. ») ; sa couleur est celle de la rubrique où elle a le plus de liens.
 * Au-dessous, un couloir par rubrique : les textes, les sociétés, les courants,
 * les mythes… à leur date, en barre quand ils ont duré.
 *
 * On fait glisser le bandeau du doigt (ou de la souris), on le zoome, et l'on
 * touche une vie : elle s'éclaire avec celles qui l'ont croisée, ses repères
 * s'y posent, et un panneau dit « qui vivait en même temps ». L'échelle se
 * resserre pour les siècles anciens, où les dates sont rares ; elle le dit.
 */
(function (racine) {

  const { element, bouton, svg } = Outils;

  const AUJOURDHUI = new Date().getFullYear();
  const FIN = AUJOURDHUI + 8;
  /* [début, fin, pixels par an au zoom 1] */
  const TRONCONS = [[-2700, -800, 0.04], [-800, 1000, 0.12], [1000, 1400, 0.35], [1400, 1700, 1], [1700, 1800, 1.4], [1800, FIN, 2.2]];
  const ZOOMS = [0.6, 1, 1.5, 2.2, 3.2, 4.6, 6.5];
  const MARGE = 18;          // à gauche du premier an
  const AXE = 40;            // la hauteur de la règle des années
  const RANG = 17;           // la hauteur d'une ligne de vies
  const TETE = 22;           // le titre d'un couloir
  const PETIT = 9;           // un couloir de moins de dates rejoint « Autres rubriques »
  const OUVERT = 70;         // la longueur, en pixels, d'une durée « depuis… », qui se perd en fondu

  /* L'abscisse d'une année au zoom 1, et l'année d'une abscisse. */
  function abscisse(an) {
    let x = 0;
    for (const [a, b, p] of TRONCONS) {
      if (an <= a) break;
      x += (Math.min(an, b) - a) * p;
      if (an <= b) break;
    }
    return x;
  }

  function anneeA(x) {
    let reste = x;
    for (const [a, b, p] of TRONCONS) {
      const l = (b - a) * p;
      if (reste <= l) return a + reste / p;
      reste -= l;
    }
    return FIN;
  }

  // ── Les dates ─────────────────────────────────────────────────────────────

  const ROMAINS = { I: 1, V: 5, X: 10, L: 50 };
  function romain(s) {
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
      const v = ROMAINS[s[i]];
      const suivant = ROMAINS[s[i + 1]] || 0;
      n += v < suivant ? -v : v;
    }
    return n;
  }

  const AVANT = /av\.?\s*J\.?-C/;

  /* L'année d'un côté de « début – fin » : le premier nombre, ou le milieu du
   * siècle écrit en chiffres romains ; négative avant notre ère. */
  function anDe(texte) {
    const s = String(texte || '');
    let n = null;
    const m = /(\d{1,4})/.exec(s);
    if (m) n = Number(m[1]);
    else {
      const r = /\b([IVXL]+)(?:ᵉʳ|ᵉ|er|e)\b/.exec(s) || /\b([IVXL]+)(?:ᵉʳ|ᵉ)/.exec(s);
      if (r) n = (romain(r[1]) - 1) * 100 + 50;
    }
    if (n === null) return null;
    return AVANT.test(s) ? -n : n;
  }

  /* [début, fin, ouvert] d'après les dates affichées, ou null. */
  function periode(a) {
    const da = String(a.da || '').replace(/\([^)]*\)/g, ' ');
    if (a.c !== 'figures' && /depuis/.test(da)) {
      const n = anDe(da.split('depuis')[1]);
      if (n !== null && n <= AUJOURDHUI) return [n, AUJOURDHUI, true];
    }
    const cotes = da.split(/\s+[–—-]\s+/);
    if (cotes.length !== 2) return null;
    let d = anDe(cotes[0]);
    const f = anDe(cotes[1]);
    if (d === null || f === null) return null;
    if (AVANT.test(cotes[1]) && !AVANT.test(cotes[0]) && d > 0) d = -d;
    if (f < d) return null;
    if (a.c === 'figures' && f - d > 125) return null;
    return [d, f, false];
  }

  /* L'année d'un repère : « 1493 », « vers 1516 », « 1317-1322 », « IXᵉ siècle ». */
  function anRepere(r) {
    return anDe(String(r[0] || '').split(/[–-]/)[0] + (AVANT.test(r[0]) ? ' av. J.-C.' : ''));
  }

  /* La rubrique où une figure a le plus de liens : sa couleur sur le bandeau. */
  function teinte(a) {
    const compte = new Map();
    const voisins = new Set((a.v || []).concat(a.ci || []));
    for (const t of a.t || []) for (const m of t.matchAll(/\[\[([^\]|]+)/g)) voisins.add(m[1]);
    for (const id of voisins) {
      const x = Dictionnaire.parId(id);
      if (!x || x.c === 'figures' || x.c === 'lieux' || x.perso) continue;
      compte.set(x.c, (compte.get(x.c) || 0) + 1);
    }
    let meilleur = 'figures';
    let n = 0;
    for (const [c, k] of compte) if (k > n) { meilleur = c; n = k; }
    return meilleur;
  }

  // ── La mise en place ──────────────────────────────────────────────────────

  let mesureur = null;
  function largeurTexte(t) {
    if (!mesureur) {
      try {
        mesureur = document.createElement('canvas').getContext('2d');
        mesureur.font = '600 11px ' + getComputedStyle(document.documentElement).getPropertyValue('--serif');
      } catch (e) { mesureur = false; }
    }
    return mesureur ? mesureur.measureText(t).width : t.length * 6.2;
  }

  /* Range les éléments en lignes : chacun prend la première ligne libre. Une
   * vie occupe sa barre, une date seule un peu de place (son nom, pour une
   * figure) ; un nom ne s'écrit que s'il tient avant l'élément suivant de sa
   * ligne, et se lit sinon en touchant. */
  function ranger(items, z, nommer) {
    const fins = [];
    const lignes = [];
    for (const it of items) {
      it.x0 = MARGE + abscisse(it.d) * z;
      it.x1 = it.f === null ? it.x0 : it.ouvert ? it.x0 + OUVERT : Math.max(it.x0 + 3, MARGE + abscisse(it.f) * z);
      const place = it.f === null ? (nommer ? it.l : 14) : 0;
      const fin = Math.max(it.x1, it.x0 + place) + 8;
      let r = fins.findIndex((e) => e <= it.x0);
      if (r < 0) { r = fins.length; fins.push(0); lignes.push([]); }
      fins[r] = fin;
      lignes[r].push(it);
      it.rang = r;
    }
    for (const ligne of lignes) {
      ligne.forEach((it, i) => {
        const suivant = ligne[i + 1];
        it.nomme = !suivant || it.x0 + it.l <= suivant.x0 - 4;
      });
    }
    return fins.length;
  }

  function preparer(liste) {
    return liste.map((a) => {
      const p = periode(a);
      return {
        a, d: p ? p[0] : a.an, f: p ? p[1] : null, ouvert: p ? p[2] : false,
        teinte: a.c === 'figures' ? teinte(a) : a.c,
        l: largeurTexte(a.n) + 4,
      };
    }).sort((x, y) => x.d - y.d || (y.f || y.d) - (x.f || x.d));
  }

  /* « 1493 – 1541 », « 530 – 495 av. J.-C. », « depuis 1913 ». */
  function duree(it) {
    if (it.f === null) return Dictionnaire.annee(it.d);
    if (it.ouvert) return 'depuis ' + Dictionnaire.annee(it.d);
    if (it.d < 0 && it.f < 0) return Math.abs(it.d) + ' – ' + Math.abs(it.f) + ' av. J.-C.';
    return Dictionnaire.annee(it.d) + ' – ' + Dictionnaire.annee(it.f);
  }

  // ── Le dessin ─────────────────────────────────────────────────────────────

  const etat = { zoom: 2, cat: null, choisi: null, items: [], couloirs: [], monte: false };
  let el = {};

  function graduations(z) {
    const traits = [];
    const pas = [5, 10, 25, 50, 100, 200, 250, 500, 1000];
    for (const [a, b, p] of TRONCONS) {
      const k = pas.find((s) => s * p * z >= 62) || 1000;
      const premier = Math.ceil(a / k) * k;
      for (let an = premier; an < b; an += k) traits.push(an);
    }
    return traits;
  }

  function etiquetteAn(an) {
    if (an === 0) return '';
    return an < 0 ? Math.abs(an) + ' av.' : String(an);
  }

  function dessiner() {
    const z = etat.zoom;
    const dates = Dictionnaire.frise();
    const figures = preparer(dates.filter((a) => a.c === 'figures' && (!etat.cat || etat.cat === 'figures')));
    const couloirs = [];
    if (figures.length) couloirs.push({ cat: 'figures', nom: 'Figures', items: figures });
    const autres = [];
    for (const c of Dictionnaire.categories) {
      if (c.id === 'figures' || (etat.cat && etat.cat !== c.id)) continue;
      const liste = dates.filter((a) => a.c === c.id);
      if (!liste.length) continue;
      if (liste.length < PETIT && !etat.cat) autres.push(...liste);
      else couloirs.push({ cat: c.id, nom: c.nom, items: preparer(liste) });
    }
    if (autres.length) couloirs.push({ cat: 'autres', nom: 'Autres rubriques', items: preparer(autres) });
    let y = AXE;
    for (const c of couloirs) {
      c.y = y;
      c.rangs = ranger(c.items, z, c.cat === 'figures');
      c.h = TETE + c.rangs * RANG + 8;
      for (const it of c.items) it.y = y + TETE + it.rang * RANG;
      y += c.h;
    }
    etat.couloirs = couloirs;
    etat.items = couloirs.flatMap((c) => c.items);
    const largeur = Math.ceil(MARGE * 2 + abscisse(FIN) * z);
    const hauteur = y + 6;

    const toile = el.toile;
    toile.textContent = '';
    toile.style.width = largeur + 'px';
    toile.style.height = hauteur + 'px';
    const s = svg('svg', { width: largeur, height: hauteur, viewBox: '0 0 ' + largeur + ' ' + hauteur, class: 'bd-svg' });
    // le fondu des durées qui continuent (« depuis 1913 »)
    const defs = svg('defs');
    const degrade = svg('linearGradient', { id: 'bd-degrade', x1: 0, y1: 0, x2: 1, y2: 0 });
    degrade.appendChild(svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }));
    degrade.appendChild(svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }));
    defs.appendChild(degrade);
    const masque = svg('mask', { id: 'bd-fondu', maskContentUnits: 'objectBoundingBox' });
    masque.appendChild(svg('rect', { x: 0, y: 0, width: 1, height: 1, fill: 'url(#bd-degrade)' }));
    defs.appendChild(masque);
    s.appendChild(defs);

    // les époques, en bandes alternées, et leurs noms dans la règle
    let debut = TRONCONS[0][0];
    Dictionnaire.EPOQUES.forEach((e, i) => {
      const fin = Math.min(e.fin, FIN);
      const x0 = MARGE + abscisse(debut) * z;
      const x1 = MARGE + abscisse(fin) * z;
      s.appendChild(svg('rect', { x: x0, y: 0, width: Math.max(0, x1 - x0), height: hauteur, class: 'bd-epoque ' + (i % 2 ? 'bd-epoque-b' : 'bd-epoque-a') }));
      s.appendChild(svg('text', { x: x0 + 6, y: 13, class: 'bd-epoque-nom' }, e.nom));
      debut = fin;
    });
    // les années
    for (const an of graduations(z)) {
      const x = MARGE + abscisse(an) * z;
      s.appendChild(svg('line', { x1: x, y1: AXE - 14, x2: x, y2: hauteur, class: 'bd-graduation' }));
      const t = etiquetteAn(an);
      if (t) s.appendChild(svg('text', { x: x + 3, y: AXE - 5, class: 'bd-an' }, t));
    }
    // les ruptures d'échelle
    for (const [a] of TRONCONS.slice(1)) {
      const x = MARGE + abscisse(a) * z;
      s.appendChild(svg('path', { d: 'M' + (x - 3) + ' ' + (AXE - 2) + 'l3 -5l3 5', class: 'bd-rupture' }));
    }
    s.appendChild(svg('line', { x1: 0, y1: AXE, x2: largeur, y2: AXE, class: 'bd-regle' }));

    // la bande de la vie choisie, sous tout le reste
    const bande = svg('rect', { x: 0, y: AXE, width: 0, height: hauteur - AXE, class: 'bd-bande' });
    bande.style.display = 'none';
    s.appendChild(bande);
    el.bande = bande;

    const calqueEtiquettes = element('div', 'bd-etiquettes');
    const ans = graduations(z);
    for (const c of couloirs) {
      s.appendChild(svg('line', { x1: 0, y1: c.y + c.h, x2: largeur, y2: c.y + c.h, class: 'bd-couloir-fin' }));
      // les années, rappelées en tête de chaque couloir
      if (c !== couloirs[0]) {
        for (const an of ans) {
          const t = etiquetteAn(an);
          if (t) s.appendChild(svg('text', { x: MARGE + abscisse(an) * z + 3, y: c.y + 14, class: 'bd-an bd-an-rappel' }, t));
        }
      }
      const ligne = element('div', 'bd-couloir-tete cat-' + c.cat);
      ligne.style.top = (c.y + 2) + 'px';
      ligne.style.width = largeur + 'px';
      const nom = element('span', 'bd-couloir-nom');
      nom.appendChild(element('span', 'point-cat'));
      nom.appendChild(document.createTextNode(c.nom + ' · ' + c.items.length));
      ligne.appendChild(nom);
      calqueEtiquettes.appendChild(ligne);
      const g = svg('g', { class: 'bd-couloir' });
      for (const it of c.items) g.appendChild(dessinItem(it));
      s.appendChild(g);
    }
    el.reperes = svg('g', { class: 'bd-reperes' });
    s.appendChild(el.reperes);
    toile.appendChild(s);
    toile.appendChild(calqueEtiquettes);
    el.svg = s;
    el.zoom.textContent = '× ' + String(z).replace('.', ',');
    if (etat.choisi && etat.items.some((it) => it.a.id === etat.choisi)) eclairer(etat.choisi, false);
    else fermerChoix();
  }

  function dessinItem(it) {
    const g = svg('g', { class: 'bd-item cat-' + it.teinte + (it.f !== null ? ' bd-vie' : ' bd-date'), 'data-ref': it.a.id, tabindex: '0', role: 'button' });
    g.setAttribute('aria-label', it.a.n + ', ' + duree(it));
    g.appendChild(svg('title', null, it.a.n + ' — ' + duree(it)));
    // une cible plus large que le trait, pour le doigt
    g.appendChild(svg('rect', { x: it.x0 - 4, y: it.y, width: Math.max(it.x1 - it.x0, it.nomme ? it.l : 10) + 8, height: RANG - 2, class: 'bd-cible' }));
    if (it.nomme) g.appendChild(svg('text', { x: it.x0, y: it.y + 10, class: 'bd-nom' }, it.a.n));
    if (it.f !== null) {
      const w = Math.max(3, it.x1 - it.x0);
      const barre = svg('rect', { x: it.x0, y: it.y + 12, width: w, height: 4.5, rx: 2.25, class: 'bd-barre' });
      if (it.ouvert) barre.setAttribute('mask', 'url(#bd-fondu)');
      g.appendChild(barre);
    } else {
      const cx = it.x0;
      const cy = it.y + 14;
      g.appendChild(svg('path', { d: 'M' + cx + ' ' + (cy - 4) + 'l4 4l-4 4l-4 -4z', class: 'bd-losange' }));
    }
    return g;
  }

  // ── Le choix d'une vie ────────────────────────────────────────────────────

  function contemporains(it) {
    if (it.f === null) return [];
    const liste = [];
    for (const x of etat.items) {
      if (x === it || x.f === null || x.ouvert || x.a.c !== 'figures') continue;
      const commun = Math.min(it.f, x.f) - Math.max(it.d, x.d);
      if (commun > 0) liste.push([x, commun]);
    }
    return liste.sort((p, q) => q[1] - p[1] || p[0].d - q[0].d);
  }

  function eclairer(id, defiler) {
    const it = etat.items.find((x) => x.a.id === id);
    if (!it) return;
    etat.choisi = id;
    const proches = contemporains(it);
    const ids = new Set(proches.map((p) => p[0].a.id));
    el.svg.classList.add('bd-choix-actif');
    for (const n of el.svg.querySelectorAll('.bd-nom-choisi')) n.remove();
    if (!it.nomme) el.reperes.parentNode.appendChild(svg('text', { x: it.x0, y: it.y + 10, class: 'bd-nom bd-nom-choisi' }, it.a.n));
    for (const g of el.svg.querySelectorAll('.bd-item')) {
      const ref = g.getAttribute('data-ref');
      g.classList.toggle('bd-choisi', ref === id);
      const x = etat.items.find((y) => y.a.id === ref);
      // pendant la vie choisie : les autres vies qui la croisent, et ce qui s'est fait
      const dedans = x && it.f !== null && x.d <= it.f && (x.f === null ? x.d >= it.d : x.f >= it.d);
      g.classList.toggle('bd-proche', ids.has(ref) || (dedans && x.a.c !== 'figures'));
    }
    if (it.f !== null) {
      el.bande.setAttribute('x', it.x0);
      el.bande.setAttribute('width', Math.max(2, it.x1 - it.x0));
      el.bande.style.display = '';
    } else el.bande.style.display = 'none';
    // les repères de la figure, posés sur sa barre
    el.reperes.textContent = '';
    for (const r of it.a.re || []) {
      const an = anRepere(r);
      if (an === null) continue;
      const x = MARGE + abscisse(an) * etat.zoom;
      const c = svg('circle', { cx: x, cy: it.y + 14.25, r: 3.2, class: 'bd-repere' });
      c.appendChild(svg('title', null, r[0] + ' — ' + Dictionnaire.nu(r[1])));
      el.reperes.appendChild(c);
    }
    panneau(it, proches);
    if (defiler) amener(it);
  }

  function amener(it) {
    const cadre = el.cadre;
    cadre.scrollTo({ left: Math.max(0, it.x0 - cadre.clientWidth * 0.3), behavior: 'smooth' });
    const haut = cadre.getBoundingClientRect().top + racine.scrollY + it.y - racine.innerHeight * 0.3;
    racine.scrollTo({ top: Math.max(0, haut), behavior: 'smooth' });
  }

  function panneau(it, proches) {
    const p = el.choix;
    p.textContent = '';
    p.className = 'bd-choix cat-' + it.a.c + (p.classList.contains('bd-replie') ? ' bd-replie' : '');
    const tete = element('div', 'bd-choix-tete');
    const titres = element('div', 'bd-choix-titres');
    titres.appendChild(element('p', 'bd-choix-cat', Dictionnaire.categorie(it.a.c).nom + ' · ' + (it.a.da || duree(it))));
    titres.appendChild(element('p', 'bd-choix-nom', it.a.n));
    tete.appendChild(titres);
    const replier = bouton('choix-fermer bd-replier', p.classList.contains('bd-replie') ? '▴' : '▾', () => {
      const r = p.classList.toggle('bd-replie');
      replier.textContent = r ? '▴' : '▾';
      replier.setAttribute('aria-label', r ? 'Déplier' : 'Replier');
      replier.setAttribute('aria-expanded', r ? 'false' : 'true');
    });
    replier.setAttribute('aria-label', 'Replier');
    replier.setAttribute('aria-expanded', 'true');
    tete.appendChild(replier);
    const x = bouton('choix-fermer', '✕', () => fermerChoix());
    x.setAttribute('aria-label', 'Fermer');
    tete.appendChild(x);
    p.appendChild(tete);
    const corps = element('div', 'bd-choix-corps');
    p.appendChild(corps);
    const lignes = element('div', 'bd-choix-ligne');
    lignes.appendChild(element('p', 'bd-choix-def', it.a.defNue));
    lignes.appendChild(bouton('bouton-discret bd-lire', 'Lire l’article', () => Fiche.ouvrir(it.a.id)));
    corps.appendChild(lignes);
    if (it.f !== null && it.a.c === 'figures') {
      const titre = proches.length
        ? Outils.pluriel(proches.length, 'figure vivait', 'figures vivaient') + ' en même temps'
        : 'Aucune autre figure du dictionnaire ne vivait en même temps';
      corps.appendChild(element('p', 'bd-choix-sous', titre));
      if (proches.length) {
        const rang = element('div', 'voisins bd-proches');
        for (const [x2] of proches.slice(0, 40)) {
          const b = bouton('voisin cat-' + x2.teinte, '', () => eclairer(x2.a.id, true));
          b.appendChild(element('span', null, x2.a.n));
          b.appendChild(element('span', 'bd-proche-dates', ' ' + duree(x2)));
          rang.appendChild(b);
        }
        corps.appendChild(rang);
      }
      const re = (it.a.re || []).filter((r) => anRepere(r) !== null);
      if (re.length) {
        corps.appendChild(element('p', 'bd-choix-sous', 'Ses repères, posés sur sa vie'));
        const ol = element('ol', 'bd-choix-reperes');
        for (const r of re) {
          const li = element('li');
          li.appendChild(element('span', 'bd-repere-an', r[0]));
          li.appendChild(Rendu.fragment(' ' + r[1]));
          ol.appendChild(li);
        }
        corps.appendChild(ol);
      }
    } else if (it.f !== null) {
      corps.appendChild(element('p', 'bd-choix-sous', 'La bande montre sa durée sur tout le bandeau.'));
    }
    p.hidden = false;
  }

  function fermerChoix() {
    etat.choisi = null;
    if (el.svg) {
      el.svg.classList.remove('bd-choix-actif');
      for (const g of el.svg.querySelectorAll('.bd-choisi, .bd-proche')) g.classList.remove('bd-choisi', 'bd-proche');
    }
    if (el.bande) el.bande.style.display = 'none';
    if (el.reperes) el.reperes.textContent = '';
    if (el.svg) for (const n of el.svg.querySelectorAll('.bd-nom-choisi')) n.remove();
    if (el.choix) el.choix.hidden = true;
  }

  // ── Zoom, glisser, chercher ───────────────────────────────────────────────

  function zoomer(sens) {
    const i = ZOOMS.indexOf(etat.zoom);
    const j = Math.max(0, Math.min(ZOOMS.length - 1, i + sens));
    if (j === i) return;
    const cadre = el.cadre;
    const centre = anneeA((cadre.scrollLeft + cadre.clientWidth / 2 - MARGE) / etat.zoom);
    etat.zoom = ZOOMS[j];
    dessiner();
    cadre.scrollLeft = MARGE + abscisse(centre) * etat.zoom - cadre.clientWidth / 2;
    el.moins.disabled = j === 0;
    el.plus.disabled = j === ZOOMS.length - 1;
  }

  function allerA(an) {
    el.cadre.scrollTo({ left: Math.max(0, MARGE + abscisse(an) * etat.zoom - 24), behavior: 'smooth' });
  }

  function glisser(cadre) {
    let depart = null;
    cadre.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.bd-item')) return;
      depart = { x: e.clientX, gauche: cadre.scrollLeft };
      cadre.classList.add('bd-glisse');
    });
    racine.addEventListener('pointermove', (e) => {
      if (!depart) return;
      cadre.scrollLeft = depart.gauche - (e.clientX - depart.x);
    });
    racine.addEventListener('pointerup', () => { depart = null; cadre.classList.remove('bd-glisse'); });
  }

  function choisirParNom(texte) {
    const q = Outils.normaliser(texte);
    if (!q) return;
    const it = etat.items.find((x) => x.a.c === 'figures' && Outils.normaliser(x.a.n) === q)
      || etat.items.find((x) => x.a.c === 'figures' && x.a.cles.includes(q))
      || etat.items.find((x) => x.a.c === 'figures' && Outils.normaliser(x.a.n).includes(q));
    if (it) eclairer(it.a.id, true);
    else Outils.annoncer('Aucune figure datée de ce nom.');
  }

  /* Monte le bandeau dans `conteneur` (une fois), puis le redessine. */
  function montrer(conteneur, cat) {
    etat.cat = cat || null;
    if (!etat.monte) {
      conteneur.textContent = '';
      const outils = element('div', 'bd-outils');
      const chercher = element('div', 'bd-chercher');
      const champ = element('input', 'bd-champ');
      champ.type = 'search';
      champ.placeholder = 'Qui vivait en même temps que… ?';
      champ.setAttribute('aria-label', 'Qui vivait en même temps que… ? Le nom d’une figure');
      champ.setAttribute('list', 'bd-noms');
      champ.setAttribute('autocomplete', 'off');
      const noms = element('datalist');
      noms.id = 'bd-noms';
      for (const a of Dictionnaire.frise().filter((x) => x.c === 'figures')) {
        const o = element('option');
        o.value = a.n;
        noms.appendChild(o);
      }
      champ.addEventListener('change', () => choisirParNom(champ.value));
      champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); choisirParNom(champ.value); } });
      chercher.appendChild(champ);
      chercher.appendChild(noms);
      outils.appendChild(chercher);
      const zoom = element('div', 'bd-zoom');
      el.moins = bouton('bouton-rond bd-bouton-zoom', '−', () => zoomer(-1));
      el.moins.setAttribute('aria-label', 'Resserrer');
      el.plus = bouton('bouton-rond bd-bouton-zoom', '+', () => zoomer(1));
      el.plus.setAttribute('aria-label', 'Agrandir');
      el.zoom = element('span', 'bd-zoom-valeur');
      zoom.appendChild(el.moins);
      zoom.appendChild(el.zoom);
      zoom.appendChild(el.plus);
      outils.appendChild(zoom);
      conteneur.appendChild(outils);
      conteneur.appendChild(element('p', 'discret bd-aide', 'Faites glisser le bandeau ; touchez une vie pour voir qui l’a croisée. L’échelle se resserre avant 1400, là où les dates sont rares (˄ marque chaque changement d’échelle).'));
      el.cadre = element('div', 'bd-cadre');
      el.toile = element('div', 'bd-toile');
      el.cadre.appendChild(el.toile);
      conteneur.appendChild(el.cadre);
      el.choix = element('div', 'bd-choix');
      el.choix.hidden = true;
      el.choix.setAttribute('aria-live', 'polite');
      conteneur.appendChild(el.choix);
      el.toile.addEventListener('click', (e) => {
        const g = e.target.closest('.bd-item');
        if (g) eclairer(g.getAttribute('data-ref'), false);
      });
      el.toile.addEventListener('keydown', (e) => {
        const g = e.target.closest && e.target.closest('.bd-item');
        if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); eclairer(g.getAttribute('data-ref'), false); }
      });
      glisser(el.cadre);
      etat.monte = true;
      if (racine.innerWidth < 700) etat.zoom = 1.5;
      dessiner();
      allerA(1450);
      return;
    }
    dessiner();
  }

  racine.Bandeau = {
    montrer, allerA, fermer: fermerChoix,
    get monte() { return etat.monte; },
    // pour les épreuves
    _: { periode, anDe, anRepere, abscisse, anneeA, ranger, preparer, contemporains, eclairer, etat },
  };

})(window);
