'use strict';
/*
 * Les images animées : des effets dessinés par-dessus une gravure.
 *
 * build/animations.txt décrit, pour certaines images, ce qui s'y passe : une
 * carte qui se retourne dans la main de Mlle Lenormand, une gravure qu'on
 * colorie, un guéridon qui se met à tourner, une flamme qui vacille, des
 * étoiles qui scintillent, de la fumée qui monte, un éclair. Les coordonnées
 * sont des fractions de l'image ; les calques sont des SVG de même mesure,
 * posés exactement sur elle, et l'image elle-même n'est jamais modifiée.
 *
 * Quatre calques, de bas en haut : les morceaux d'image qui bougent ; la
 * « teinte », mêlée en mode produit à la gravure et à ces morceaux (comme une
 * aquarelle sur un tirage : les traits restent noirs, le papier prend la
 * couleur) ; le calque « normal », où sont les cartes, les figures ajoutées, la
 * mer, la fumée ; la « lumière », mêlée en mode superposition (lueurs, éclairs).
 * Une partie qui bouge est une copie de l'image découpée par un polygone ; sous
 * elle, une copie floue cache l'original quand elle s'en écarte.
 *
 * L'animation part quand l'image paraît à l'écran, une fois ; « Rejouer » la
 * relance, avec son son s'il en a un. Elle se met en pause hors de l'écran.
 * Si l'appareil demande moins d'animations, on montre l'état final sans
 * mouvement ; si le réglage « Animer les images » est éteint, rien n'est posé.
 */
(function (racine) {

  const NS = 'http://www.w3.org/2000/svg';
  let compteur = 0;

  const calme = () => racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const actives = () => !(racine.App && App.reglages && App.reglages.animations === false);

  function noeud(nom, attrs, parent) {
    const e = document.createElementNS(NS, nom);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function hasard(graine) {
    let h = 2166136261;
    for (let i = 0; i < graine.length; i += 1) { h ^= graine.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const COEUR = 'M0 0.92 C-0.55 0.48 -1 0.12 -1 -0.34 C-1 -0.76 -0.66 -1 -0.33 -1 C-0.13 -1 0 -0.86 0 -0.7 C0 -0.86 0.13 -1 0.33 -1 C0.66 -1 1 -0.76 1 -0.34 C1 0.12 0.55 0.48 0 0.92Z';
  const CARREAU = 'M0 -1 L0.72 0 L0 1 L-0.72 0Z';
  const PIQUE = 'M0 -1 C0.5 -0.45 1 -0.15 1 0.25 C1 0.62 0.62 0.8 0.3 0.6 C0.36 0.82 0.46 0.96 0.62 1 L-0.62 1 C-0.46 0.96 -0.36 0.82 -0.3 0.6 C-0.62 0.8 -1 0.62 -1 0.25 C-1 -0.15 -0.5 -0.45 0 -1Z';
  const TREFLE = 'M0 -1 A0.36 0.36 0 1 1 0.02 -0.28 A0.36 0.36 0 1 1 0.3 0.42 C0.36 0.72 0.46 0.94 0.62 1 L-0.62 1 C-0.46 0.94 -0.36 0.72 -0.3 0.42 A0.36 0.36 0 1 1 -0.02 -0.28 A0.36 0.36 0 1 1 0 -1Z';
  const ENSEIGNES = { 'as-coeur': [COEUR, '#c8102e'], 'as-carreau': [CARREAU, '#c8102e'], 'as-pique': [PIQUE, '#1b1b1f'], 'as-trefle': [TREFLE, '#1b1b1f'] };

  // ── Les effets ────────────────────────────────────────────────────────────

  /* Chaque effet reçoit sa description et le contexte : W, H (la mesure de
   * l'image), les calques, un identifiant unique, l'adresse de l'image. */
  const EFFETS = {

    /* Une carte à jouer posée par trois coins : l'origine, le coin vers le
     * haut de la carte, le coin vers sa droite. Elle se retourne et rougeoie. */
    carte(e, c) {
      const [o, a, b] = e.coins.map(c.P);
      const u = [a[0] - o[0], a[1] - o[1]];
      const v = [b[0] - o[0], b[1] - o[1]];
      const g = noeud('g', { transform: 'matrix(' + [v[0] / 100, v[1] / 100, -u[0] / 140, -u[1] / 140, o[0] + u[0], o[1] + u[1]].map((x) => x.toFixed(4)).join(' ') + ')' }, c.normal);
      const flou = c.filtre('flou-carte', 9);
      noeud('rect', { class: 'an-revele an-carte-halo', x: -16, y: -16, width: 132, height: 172, rx: 24, filter: 'url(#' + flou + ')' }, g);
      const face = noeud('g', { class: 'an-revele an-carte' }, g);
      c.retard(face, e.delai, 0.5);
      noeud('rect', { x: 0, y: 0, width: 100, height: 140, rx: 9, class: 'an-carte-fond' }, face);
      noeud('rect', { x: 4, y: 4, width: 92, height: 132, rx: 6, class: 'an-carte-filet' }, face);
      const [d, couleur] = ENSEIGNES[e.figure] || ENSEIGNES['as-coeur'];
      noeud('path', { d, fill: couleur, transform: 'translate(50 72) scale(25)' }, face);
      for (const coin of ['', 'rotate(180 50 70)']) {
        const k = noeud('g', coin ? { transform: coin } : {}, face);
        const t = noeud('text', { x: 13, y: 25, fill: couleur, class: 'an-carte-lettre', 'text-anchor': 'middle' }, k);
        t.textContent = 'A';
        noeud('path', { d, fill: couleur, transform: 'translate(13 36) scale(6)' }, k);
      }
    },

    /* Une tache de couleur, floue, mêlée à la gravure : ellipse, rectangle,
     * polygone, ou toute l'image. */
    teinte(e, c) {
      const flou = c.filtre('flou-teinte-' + Math.round((e.flou === undefined ? 0.02 : e.flou) * 1000), (e.flou === undefined ? 0.02 : e.flou) * c.W);
      const attrs = { fill: e.couleur, opacity: (e.force === undefined ? 0.55 : e.force).toFixed(2), class: 'an-revele an-tache', filter: 'url(#' + flou + ')' };
      let forme;
      if (e.ellipse) {
        const [x, y, rx, ry] = e.ellipse;
        forme = noeud('ellipse', Object.assign({ cx: x * c.W, cy: y * c.H, rx: rx * c.W, ry: ry * c.H }, attrs), c.teinte);
      } else if (e.rect) {
        const [x, y, w, h] = e.rect;
        forme = noeud('rect', Object.assign({ x: x * c.W, y: y * c.H, width: w * c.W, height: h * c.H }, attrs), c.teinte);
      } else if (e.polygone) {
        forme = noeud('polygon', Object.assign({ points: e.polygone.map(c.P).map((p) => p.join(',')).join(' ') }, attrs), c.teinte);
      } else {
        delete attrs.filter;
        forme = noeud('rect', Object.assign({ x: 0, y: 0, width: c.W, height: c.H }, attrs), c.teinte);
      }
      c.retard(forme, e.delai, 0.15 + c.rang * 0.12);
    },

    /* Un morceau de l'image, découpé par un polygone, qui tourne autour d'un
     * pivot, se soulève, tremble, se balance ou flotte. */
    bouge(e, c) {
      const pts = e.polygone.map(c.P);
      const id = c.uid + '-d' + c.rang;
      const clip = noeud('clipPath', { id }, c.defs);
      noeud('polygon', { points: pts.map((p) => p.join(',')).join(' ') }, clip);
      // une version un peu plus large du polygone, pour la copie floue de dessous
      const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length;
      const cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
      const clipLarge = noeud('clipPath', { id: id + 'l' }, c.defs);
      noeud('polygon', { points: pts.map((p) => [cx + (p[0] - cx) * 1.08, cy + (p[1] - cy) * 1.08].join(',')).join(' ') }, clipLarge);
      // ce qui monte découvre ce qui était dessous : on y met, flou, ce qui se
      // trouve juste sous le morceau ; ce qui tourne garde sa propre image floue
      const monte = e.mode === 'leve' || e.mode === 'flotte';
      const decale = monte ? 1.4 * (e.ampleur === undefined ? 0.04 : e.ampleur) * c.H : 0;
      const flou = c.filtre('flou-dessous', (monte ? 0.005 : 0.012) * c.W);
      const dessous = noeud('g', { 'clip-path': 'url(#' + id + 'l)', class: 'an-dessous' }, c.mobile);
      noeud('image', { href: c.src, width: c.W, height: c.H, y: (-decale).toFixed(1), filter: 'url(#' + flou + ')' }, dessous);
      const g = noeud('g', { class: 'an-bouge an-mode-' + e.mode }, c.mobile);
      const [px, py] = c.P(e.pivot);
      g.style.transformOrigin = px.toFixed(1) + 'px ' + py.toFixed(1) + 'px';
      const ampleurs = { tourne: 3, balance: 9, leve: 0.06, tremble: 0.006, flotte: 0.02 };
      const ampleur = e.ampleur === undefined ? ampleurs[e.mode] : e.ampleur;
      // en degrés pour une rotation, en fraction de la hauteur sinon
      g.style.setProperty('--a', String(['tourne', 'balance'].includes(e.mode) ? ampleur : 1.2));
      g.style.setProperty('--h', (['leve', 'tremble', 'flotte'].includes(e.mode) ? ampleur * c.H : 0).toFixed(1) + 'px');
      g.style.animationDuration = (e.duree || { tourne: 0.7, balance: 2.4, leve: 2.6, tremble: 0.35, flotte: 4 }[e.mode]) + 's';
      g.style.animationIterationCount = String(e.fois || { tourne: 8, balance: 4, leve: 3, tremble: 14, flotte: 3 }[e.mode]);
      c.retard(g, e.delai, 0.6);
      noeud('image', { href: c.src, width: c.W, height: c.H, 'clip-path': 'url(#' + id + ')' }, g);
    },

    /* Une lumière : une bougie qui vacille, un halo qui respire, un éclat. */
    lueur(e, c) {
      const [x, y] = c.P(e.point);
      const couleur = e.couleur || '#ffd27a';
      const id = c.uid + '-l' + c.rang;
      const grad = noeud('radialGradient', { id }, c.defsLumiere);
      noeud('stop', { offset: '0', 'stop-color': couleur, 'stop-opacity': '1' }, grad);
      noeud('stop', { offset: '0.45', 'stop-color': couleur, 'stop-opacity': '0.4' }, grad);
      noeud('stop', { offset: '1', 'stop-color': couleur, 'stop-opacity': '0' }, grad);
      const r = e.rayon * c.W;
      const cercle = noeud('circle', { cx: x, cy: y, r, fill: 'url(#' + id + ')', class: 'an-revele an-lueur an-' + (e.mode || 'vacille') }, c.lumiere);
      cercle.style.setProperty('--f', String(e.force === undefined ? 0.85 : e.force));
      if (e.duree) cercle.style.animationDuration = e.duree + 's';
      c.retard(cercle, e.delai, 0.3 + c.rang * 0.17);
    },

    /* Des étoiles qui scintillent au hasard dans une zone (sur le calque normal :
     * une gravure claire les montre aussi bien qu'un ciel sombre). */
    etincelles(e, c) {
      const [x, y, w, h] = e.zone;
      const alea = hasard(c.uid + c.rang);
      const n = e.nombre || 14;
      const taille = (e.taille || 0.014) * c.W;
      for (let i = 0; i < n; i += 1) {
        const px = (x + alea() * w) * c.W;
        const py = (y + alea() * h) * c.H;
        const s = taille * (0.6 + alea() * 0.8);
        const etoile = noeud('path', {
          d: 'M0 -1 L0.22 -0.22 L1 0 L0.22 0.22 L0 1 L-0.22 0.22 L-1 0 L-0.22 -0.22Z',
          transform: 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ') scale(' + s.toFixed(2) + ')',
          fill: e.couleur || '#fff6d5', class: 'an-etincelle',
        }, c.normal);
        etoile.style.animationDelay = ((e.delai || 0.4) + alea() * 3).toFixed(2) + 's';
        etoile.style.animationDuration = (1.4 + alea() * 2.2).toFixed(2) + 's';
      }
    },

    /* De la fumée qui monte et se défait. */
    fumee(e, c) {
      const [x, y] = c.P(e.point);
      const alea = hasard(c.uid + 'f' + c.rang);
      const n = e.nombre || 6;
      const largeur = (e.largeur || 0.06) * c.W;
      const flou = c.filtre('flou-fumee', largeur * 0.35);
      for (let i = 0; i < n; i += 1) {
        const bouffee = noeud('circle', { cx: x, cy: y, r: largeur * (0.35 + alea() * 0.3), fill: e.couleur || '#ece7dc', filter: 'url(#' + flou + ')', class: 'an-fumee' }, c.normal);
        bouffee.style.setProperty('--h', (-(e.hauteur || 0.25) * c.H).toFixed(1) + 'px');
        bouffee.style.setProperty('--x', ((alea() - 0.5) * largeur * 1.6).toFixed(1) + 'px');
        const d = e.duree || 5;
        bouffee.style.animationDuration = d + 's';
        bouffee.style.animationDelay = ((e.delai || 0.3) + (i * d) / n).toFixed(2) + 's';
      }
    },

    /* Un éclair : l'image s'illumine, et un trait de feu si on le dessine. */
    eclair(e, c) {
      const eclat = noeud('rect', { x: 0, y: 0, width: c.W, height: c.H, fill: '#fffbe8', class: 'an-eclair' }, c.lumiere);
      c.retard(eclat, e.delai, 0.8);
      eclat.style.animationIterationCount = String(e.fois || 2);
      if (e.trace) {
        const flou = c.filtre('flou-eclair', 0.008 * c.W);
        const trait = noeud('polyline', { points: e.trace.map(c.P).map((p) => p.join(',')).join(' '), stroke: e.couleur || '#fff6c8',
          'stroke-width': (0.007 * c.W).toFixed(1), fill: 'none', 'stroke-linejoin': 'round', filter: 'url(#' + flou + ')', class: 'an-eclair' }, c.lumiere);
        c.retard(trait, e.delai, 0.8);
        trait.style.animationIterationCount = String(e.fois || 2);
      }
    },

    /* Une gloire : des rayons qui tournent lentement autour d'un point. */
    rayons(e, c) {
      const [x, y] = c.P(e.point);
      const r = e.rayon ? e.rayon * c.W : 0.4 * c.W;
      const id = c.uid + '-r' + c.rang;
      const grad = noeud('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx: x, cy: y, r }, c.defsLumiere);
      noeud('stop', { offset: '0', 'stop-color': e.couleur || '#ffe9a8', 'stop-opacity': '0.9' }, grad);
      noeud('stop', { offset: '1', 'stop-color': e.couleur || '#ffe9a8', 'stop-opacity': '0' }, grad);
      const g = noeud('g', { class: 'an-revele an-rayons' }, c.lumiere);
      g.style.transformOrigin = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      c.retard(g, e.delai, 0.4);
      const n = e.nombre || 16;
      for (let i = 0; i < n; i += 1) {
        const a1 = (2 * Math.PI * i) / n;
        const a2 = a1 + Math.PI / n / 1.6;
        noeud('path', { d: 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' L' + (x + r * Math.cos(a1)).toFixed(1) + ' ' + (y + r * Math.sin(a1)).toFixed(1)
          + ' L' + (x + r * Math.cos(a2)).toFixed(1) + ' ' + (y + r * Math.sin(a2)).toFixed(1) + 'Z', fill: 'url(#' + id + ')' }, g);
      }
    },

    /* Une figure découpée d'une autre gravure (« detourer: » dans
     * build/illustrations.txt) qui entre en scène : à la nage, en surgissant
     * des eaux, ou en apparaissant ; elle passe du gris à la couleur, puis vit
     * doucement. `ovale` : le médaillon hors duquel elle ne déborde pas. */
    lutin(e, c) {
      const im = e.image;
      const w = e.largeur * c.W;
      const h = (w * im.h) / im.w;
      const [x, y] = c.P(e.point);
      const mode = e.mode || 'apparait';
      const duree = e.duree || 3;
      const delai = e.delai === undefined ? 1 : e.delai;
      const entree = noeud('g', { class: 'an-revele an-lutin an-entre-' + mode }, c.ovale(e.ovale));
      const [dx, dy] = e.depuis ? [e.depuis[0] * c.W, e.depuis[1] * c.H] : [0, 0.08 * c.H];
      entree.style.setProperty('--dx', dx.toFixed(1) + 'px');
      entree.style.setProperty('--dy', dy.toFixed(1) + 'px');
      entree.style.animationDuration = duree + 's';
      entree.style.animationDelay = delai.toFixed(2) + 's';
      const vie = noeud('g', { class: 'an-lutin-vie an-vie-' + mode }, entree);
      vie.style.transformOrigin = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      vie.style.animationDelay = (delai + duree).toFixed(2) + 's';
      const image = noeud('image', { href: im.f + '?v=' + im.v, x: (x - w / 2).toFixed(1), y: (y - h / 2).toFixed(1),
        width: w.toFixed(1), height: h.toFixed(1), class: 'an-lutin-image' + (e.couleurs === 0 ? '' : ' an-colore') }, vie);
      image.style.animationDelay = (delai + duree * 0.6).toFixed(2) + 's';
    },

    /* La mer : une bande de vagues qui monte, puis défile sans fin ; deux
     * bandes, l'une derrière les figures, l'autre devant, les y plongent. */
    vagues(e, c) {
      const y0 = e.ligne * c.H;
      const amp = (e.hauteur || 0.012) * c.H;
      const L = (e.longueur || 0.1) * c.W;
      const g = noeud('g', { class: 'an-revele an-vagues' }, c.ovale(e.ovale));
      g.style.setProperty('--dy', (0.12 * c.H).toFixed(1) + 'px');
      c.retard(g, e.delai, 0.8);
      const defile = noeud('g', { class: 'an-vagues-defile' }, g);
      defile.style.setProperty('--L', L.toFixed(1) + 'px');
      defile.style.animationDuration = (e.vitesse || 5) + 's';
      let crete = 'M' + (-L).toFixed(1) + ' ' + y0.toFixed(1);
      for (let x = -L, haut = true; x < c.W + L; x += L / 2, haut = !haut) {
        crete += ' Q' + (x + L / 4).toFixed(1) + ' ' + (y0 + (haut ? -amp : amp) * 2).toFixed(1) + ' ' + (x + L / 2).toFixed(1) + ' ' + y0.toFixed(1);
      }
      const fin = Math.ceil((c.W + 2 * L) / (L / 2)) * (L / 2) - L;
      // l'eau s'assombrit vers le fond
      const couleur = e.couleur || '#2f6f8f';
      const id = c.uid + '-v' + c.rang;
      const grad = noeud('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: (y0 - amp * 2).toFixed(1), x2: 0, y2: (y0 + 0.14 * c.H).toFixed(1) }, c.defs);
      noeud('stop', { offset: '0', 'stop-color': couleur, 'stop-opacity': '0.78' }, grad);
      noeud('stop', { offset: '1', 'stop-color': '#10283a', 'stop-opacity': '0.95' }, grad);
      const eau = noeud('path', { d: crete + ' L' + fin.toFixed(1) + ' ' + (c.H + 4) + ' L' + (-L).toFixed(1) + ' ' + (c.H + 4) + 'Z',
        fill: 'url(#' + id + ')' }, defile);
      eau.setAttribute('opacity', (e.force === undefined ? 0.9 : e.force).toFixed(2));
      // des tailles parallèles sous la crête, de plus en plus pâles : le trait d'une gravure
      for (let k = 1; k <= 5; k += 1) {
        const taille = noeud('path', { d: crete, fill: 'none', stroke: '#0c1f2c', 'stroke-width': (0.0016 * c.W).toFixed(2), opacity: (0.55 - k * 0.08).toFixed(2) }, defile);
        taille.setAttribute('transform', 'translate(' + ((k % 2) * L / 4).toFixed(1) + ' ' + (k * amp * 1.5).toFixed(1) + ')');
      }
      noeud('path', { d: crete, fill: 'none', stroke: e.ecume || '#e6f6ff', 'stroke-width': (0.0032 * c.W).toFixed(2), 'stroke-linecap': 'round', opacity: '0.9' }, defile);
    },

    /* La pluie : des traits obliques qui tombent sans fin dans une zone. */
    pluie(e, c) {
      const [x, y, w, h] = e.zone || [0, 0, 1, 1];
      const alea = hasard(c.uid + 'p' + c.rang);
      const g = noeud('g', { class: 'an-revele an-pluie' }, c.normal);
      c.retard(g, e.delai, 0.5);
      const n = e.nombre || 60;
      const long = 0.05 * c.H;
      const pente = e.pente === undefined ? 0.25 : e.pente;
      for (let i = 0; i < n; i += 1) {
        const px = (x + alea() * w) * c.W;
        const py = (y + alea() * h) * c.H;
        const goutte = noeud('line', { x1: px.toFixed(1), y1: py.toFixed(1), x2: (px - pente * long).toFixed(1), y2: (py + long).toFixed(1),
          stroke: e.couleur || '#dfe8f0', 'stroke-width': (0.0022 * c.W).toFixed(2), 'stroke-linecap': 'round', class: 'an-goutte' }, g);
        goutte.style.setProperty('--x', (-pente * h * c.H * 0.5).toFixed(1) + 'px');
        goutte.style.setProperty('--y', (h * c.H * 0.5).toFixed(1) + 'px');
        goutte.style.animationDuration = (0.7 + alea() * 0.5).toFixed(2) + 's';
        goutte.style.animationDelay = (-alea() * 1.2).toFixed(2) + 's';
      }
    },

    /* Une inscription qui s'allume : le mot qui anime le Golem, une formule. */
    inscription(e, c) {
      const [x, y] = c.P(e.point);
      const flou = c.filtre('flou-inscription', 0.006 * c.W);
      const g = noeud('g', { class: 'an-revele an-inscription' }, c.normal);
      c.retard(g, e.delai, 1);
      g.style.transformOrigin = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      const attrs = { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: e.couleur || '#ffd36b',
        'font-size': ((e.taille || 0.05) * c.W).toFixed(1), class: 'an-inscription-texte' };
      noeud('text', Object.assign({ filter: 'url(#' + flou + ')' }, attrs), g).textContent = e.texte;
      noeud('text', attrs, g).textContent = e.texte;
    },
  };

  // ── Habiller une image ────────────────────────────────────────────────────

  /* Pose les calques de `im.an` sur `img`, dans `porteur` (son parent, qui
   * devient le repère des calques). Rend { jouer, arreter }. */
  function habiller(porteur, img, im) {
    if (!im || !im.an || !actives()) return null;
    const W = im.w;
    const H = im.h;
    const uid = 'an' + (++compteur);
    porteur.classList.add('an-porteur');
    const calque = (classe) => {
      const s = noeud('svg', { class: 'an-calque ' + classe, viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
      porteur.appendChild(s);
      return s;
    };
    // de bas en haut : les morceaux d'image qui bougent, la couleur (qui les
    // teinte aussi), les figures ajoutées, la lumière
    const mobile = calque('an-mobile');
    const teinte = calque('an-teinte');
    const normal = calque('an-normal');
    const lumiere = calque('an-lumiere');
    const defs = noeud('defs', {}, normal);
    const defsLumiere = noeud('defs', {}, lumiere);
    const filtres = new Map();
    const c = {
      W, H, uid, mobile, teinte, normal, lumiere, defs, defsLumiere, rang: 0, src: img.getAttribute('src'),
      P: (p) => [p[0] * W, p[1] * H],
      filtre(nom, ecart) {
        const cle = nom + ':' + ecart.toFixed(1);
        if (filtres.has(cle)) return filtres.get(cle);
        const id = uid + '-' + nom + filtres.size;
        const f = noeud('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
        noeud('feGaussianBlur', { stdDeviation: ecart.toFixed(2) }, f);
        // un filtre défini dans un calque sert aussi aux deux autres : la
        // référence « url(#…) » vaut pour tout le document
        filtres.set(cle, id);
        return id;
      },
      retard(el, delai, defaut) { el.style.animationDelay = (delai === undefined ? defaut : delai).toFixed(2) + 's'; },
      /* Un groupe du calque normal découpé par une ellipse (cx cy rx ry), ou
       * le calque lui-même. */
      ovale(o) {
        if (!o) return normal;
        const cle = 'ovale:' + o.join(' ');
        if (filtres.has(cle)) return filtres.get(cle);
        const id = uid + '-o' + filtres.size;
        const clip = noeud('clipPath', { id }, defs);
        noeud('ellipse', { cx: o[0] * W, cy: o[1] * H, rx: o[2] * W, ry: o[3] * H }, clip);
        const g = noeud('g', { 'clip-path': 'url(#' + id + ')' }, normal);
        filtres.set(cle, g);
        return g;
      },
    };
    im.an.e.forEach((e, i) => {
      c.rang = i;
      if (EFFETS[e.t]) EFFETS[e.t](e, c);
    });

    const calques = [mobile, teinte, normal, lumiere];
    function placer() {
      if (!img.offsetWidth) return;
      for (const s of calques) {
        s.style.left = img.offsetLeft + 'px';
        s.style.top = img.offsetTop + 'px';
        s.style.width = img.offsetWidth + 'px';
        s.style.height = img.offsetHeight + 'px';
      }
    }
    placer();
    img.addEventListener('load', placer);
    if (racine.ResizeObserver) new ResizeObserver(placer).observe(img);

    function jouer() {
      if (calme()) { porteur.classList.remove('an-attente'); porteur.classList.add('an-joue'); return; }
      porteur.classList.remove('an-joue', 'an-attente');
      void porteur.offsetWidth;   // relance les animations
      porteur.classList.add('an-joue');
    }
    function arreter() { porteur.classList.remove('an-joue'); porteur.classList.add('an-attente'); }
    porteur.classList.add(calme() ? 'an-joue' : 'an-attente');

    // hors de l'écran, tout se fige ; la première apparition lance l'animation
    let jouee = false;
    if (racine.IntersectionObserver) {
      new IntersectionObserver((entrees) => {
        for (const en of entrees) {
          porteur.classList.toggle('an-pause', !en.isIntersecting);
          if (en.isIntersecting && en.intersectionRatio >= 0.45 && !jouee) {
            jouee = true;
            jouer();
          }
        }
      }, { threshold: [0, 0.45] }).observe(porteur);
    } else {
      jouer();
    }
    return { jouer, arreter, get jouee() { return jouee; } };
  }

  /* Les boutons sous une image animée : rejouer, écouter. */
  function commandes(im, anime, claire) {
    const d = document.createElement('div');
    d.className = 'an-commandes' + (claire ? ' claire' : '');
    const rejouer = Outils.bouton('an-bouton an-rejouer', '↻ ' + (im.an.ti ? Dictionnaire.nu(im.an.ti) : 'Animer'), () => {
      anime.jouer();
      if (im.an.so && !Sons.enCours) Sons.jouer(im.an.so, ecouter);
    });
    rejouer.setAttribute('aria-label', 'Rejouer l’animation' + (im.an.ti ? ' : ' + Dictionnaire.nu(im.an.ti) : ''));
    d.appendChild(rejouer);
    let ecouter = null;
    if (im.an.so) {
      ecouter = Outils.bouton('an-bouton an-ecouter', im.an.so.s ? '♪ Le bruit' : '♪ Écouter', () => {
        if (Sons.enCours !== im.an.so) anime.jouer();
        Sons.jouer(im.an.so, ecouter);
      });
      ecouter.setAttribute('aria-pressed', 'false');
      ecouter.setAttribute('aria-label', im.an.so.s ? 'Écouter le bruit de l’animation' : 'Écouter : ' + Dictionnaire.nu(im.an.so.ti));
      d.appendChild(ecouter);
    }
    return d;
  }

  racine.Animations = { habiller, commandes, actives, effets: Object.keys(EFFETS) };

})(window);
