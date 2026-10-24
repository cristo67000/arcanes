'use strict';
/*
 * La carte des liens d'une fiche : l'article au centre, ses voisins autour.
 *
 * Les voisins sont les articles qu'il cite, dans son texte ou en « voir
 * aussi », et ceux qui le citent : un renvoi dans chaque sens vaut plus qu'un
 * seul, et l'on montre d'abord les plus liés, huit par huit. Un arc relie
 * aussi deux voisins proches sur l'anneau quand ils se citent entre eux : la
 * carte dessine un morceau du réseau du dictionnaire.
 *
 * Toucher un voisin le met au centre, sans quitter la fiche : on se promène de
 * proche en proche, le chemin parcouru reste sous la carte et chacune de ses
 * étapes y est touchable ; toucher le centre, ou « Lire », ouvre l'article.
 *
 * ── Le dessin ──────────────────────────────────────────────────────────────
 *
 * Un ciel : des astres qui scintillent (placés d'après l'identifiant de
 * l'article, toujours les mêmes pour lui), deux orbites, une couronne de
 * graduations qui tourne lentement. Chaque lien est une courbe teintée de la
 * couleur des deux rubriques ; des points lumineux y circulent, de l'article
 * qui cite vers l'article cité — dans les deux sens quand chacun cite l'autre.
 * À chaque déplacement, le voisin touché glisse jusqu'au centre et les
 * nouveaux voisins en sortent un à un. Sans animation demandée par
 * l'appareil (« réduire les animations »), la carte est dessinée d'un coup et
 * rien n'y bouge.
 *
 * Les noms sont coupés en lignes, puis, une fois la carte à l'écran, réduits
 * s'il le faut pour tenir dans leur bulle (`ajuster`).
 */
(function (racine) {

  const { element, bouton, svg } = Outils;

  const TAILLE = 400;                 // la carte est un carré de 400 unités
  const MILIEU = TAILLE / 2;
  const ANNEAU = 136;                 // le rayon de l'anneau des voisins
  const R_CENTRE = 50;
  const R_VOISIN = 38;
  const PAR_PAGE = 8;
  const ASTRES = 54;

  let compteur = 0;                   // pour des identifiants uniques dans la page

  const calme = () => racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Les voisins d'un article, du plus lié au moins lié : [{ a, poids, sort, entre }].
   * `sort` : l'article cite ce voisin ; `entre` : ce voisin cite l'article. */
  function voisins(a) {
    const liens = new Map();
    const ajouter = (id, n, sens) => {
      if (id === a.id || !Dictionnaire.parId(id)) return;
      const l = liens.get(id) || { poids: 0, sort: false, entre: false };
      l.poids += n;
      l[sens] = true;
      liens.set(id, l);
    };
    for (const id of Dictionnaire.citesPar(a)) ajouter(id, 2, 'sort');
    for (const id of a.v || []) ajouter(id, 1, 'sort');
    for (const id of a.ci || []) ajouter(id, 1.5, 'entre');
    return Array.from(liens, ([id, l]) => Object.assign({ a: Dictionnaire.parId(id) }, l))
      .sort((x, y) => (y.poids - x.poids) || x.a.cleTri.localeCompare(y.a.cleTri, 'fr'));
  }

  function lies(x, y) {
    return Dictionnaire.citesPar(x).has(y.id) || Dictionnaire.citesPar(y).has(x.id)
      || (x.v || []).includes(y.id) || (y.v || []).includes(x.id);
  }

  /* Un nom en lignes d'au plus `largeur` signes ; au-delà de `max` lignes,
   * la dernière se termine par « … ». */
  function couper(nom, largeur, max) {
    const lignes = [];
    let courante = '';
    for (const mot of nom.split(/\s+/)) {
      if (!courante) courante = mot;
      else if ((courante + ' ' + mot).length <= largeur) courante += ' ' + mot;
      else { lignes.push(courante); courante = mot; }
    }
    if (courante) lignes.push(courante);
    if (lignes.length <= max) return lignes;
    const garde = lignes.slice(0, max);
    garde[max - 1] = garde[max - 1].slice(0, Math.max(1, largeur - 1)).replace(/[\s,;:’'-]+$/, '') + '…';
    return garde;
  }

  function nomSvg(a, classe, largeur, max) {
    const t = svg('text', { class: classe, 'text-anchor': 'middle' });
    const lignes = couper(a.n, largeur, max);
    lignes.forEach((l, i) => {
      t.appendChild(svg('tspan', { x: 0, dy: (i === 0 ? -(lignes.length - 1) * 0.56 + 0.35 : 1.12) + 'em' }, l));
    });
    return t;
  }

  /* Un générateur pseudo-aléatoire tiré d'un texte : le ciel d'un article est
   * toujours le même. */
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

  /* Le fond : astres, orbites, couronne. */
  function ciel(id) {
    const g = svg('g', { class: 'cl-ciel', 'aria-hidden': 'true' });
    const alea = hasard(id);
    for (let k = 0; k < ASTRES; k += 1) {
      const x = 6 + alea() * (TAILLE - 12);
      const y = 6 + alea() * (TAILLE - 12);
      const r = 0.5 + alea() * alea() * 1.7;
      const astre = svg('circle', { class: 'cl-astre', cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(2) });
      astre.style.animationDelay = (-alea() * 6).toFixed(2) + 's';
      astre.style.animationDuration = (2.6 + alea() * 4).toFixed(2) + 's';
      g.appendChild(astre);
    }
    g.appendChild(svg('circle', { class: 'cl-orbite', cx: MILIEU, cy: MILIEU, r: ANNEAU }));
    g.appendChild(svg('circle', { class: 'cl-orbite cl-orbite-loin', cx: MILIEU, cy: MILIEU, r: ANNEAU + 30 }));
    const couronne = svg('g', { class: 'cl-couronne' });
    for (let k = 0; k < 72; k += 1) {
      const a = (2 * Math.PI * k) / 72;
      const long = k % 6 === 0 ? 7 : 3;
      const r1 = 188;
      couronne.appendChild(svg('line', {
        class: 'cl-graduation' + (k % 6 === 0 ? ' forte' : ''),
        x1: (MILIEU + r1 * Math.cos(a)).toFixed(1), y1: (MILIEU + r1 * Math.sin(a)).toFixed(1),
        x2: (MILIEU + (r1 - long) * Math.cos(a)).toFixed(1), y2: (MILIEU + (r1 - long) * Math.sin(a)).toFixed(1),
      }));
    }
    g.appendChild(couronne);
    return g;
  }

  /* La longueur d'une courbe de Bézier quadratique, par échantillons. */
  function longueur(p0, p1, p2) {
    let l = 0;
    let avant = p0;
    for (let k = 1; k <= 16; k += 1) {
      const t = k / 16;
      const u = 1 - t;
      const p = [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
      l += Math.hypot(p[0] - avant[0], p[1] - avant[1]);
      avant = p;
    }
    return l;
  }

  /* Le bloc de la fiche. `ouvrir` est la fonction de la fiche qui ouvre un
   * article ; la carte commence centrée sur l'article de la fiche. */
  function bloc(a, ouvrir) {
    if (!a || a.perso || !voisins(a).length) return null;
    const etat = { fiche: a.id, chemin: [a.id], page: 0 };
    const section = element('section', 'constellation');
    const tete = element('div', 'rubrique-ligne');
    tete.appendChild(element('h3', 'rubrique', 'Carte des liens'));
    const compte = element('span', 'discret cl-compte');
    tete.appendChild(compte);
    section.appendChild(tete);
    section.appendChild(element('p', 'discret cl-aide', 'Touchez un article pour le mettre au centre et voir ses propres liens ; touchez le centre pour le lire. Les points lumineux vont de l’article qui cite vers l’article cité.'));
    const cadre = element('div', 'cl-cadre');
    section.appendChild(cadre);
    const legende = element('div', 'cl-legende');
    section.appendChild(legende);
    const actions = element('div', 'cl-actions');
    section.appendChild(actions);
    const chemin = element('nav', 'cl-chemin');
    chemin.setAttribute('aria-label', 'Chemin parcouru dans la carte');
    section.appendChild(chemin);

    function centrer(id, depuis) {
      const i = etat.chemin.indexOf(id);
      if (i !== -1) etat.chemin.length = i + 1; else etat.chemin.push(id);
      etat.page = 0;
      dessiner(true, depuis);
    }

    function lire(id) {
      if (id !== etat.fiche) ouvrir(id);
    }

    /* `depuis` : la place qu'occupait, sur l'ancienne carte, le voisin qui
     * passe au centre ; il en part pour glisser jusqu'au milieu. */
    function dessiner(anime, depuis) {
      const bouger = anime && !calme();
      const centre = Dictionnaire.parId(etat.chemin[etat.chemin.length - 1]);
      const tous = voisins(centre);
      const pages = Math.max(1, Math.ceil(tous.length / PAR_PAGE));
      etat.page %= pages;
      const montres = tous.slice(etat.page * PAR_PAGE, (etat.page + 1) * PAR_PAGE);
      compte.textContent = Outils.pluriel(tous.length, 'article lié', 'articles liés');
      const n = ++compteur;

      const carte = svg('svg', { class: 'cl-carte' + (bouger ? ' cl-anime' : ''), viewBox: '0 0 ' + TAILLE + ' ' + TAILLE, role: 'group',
        'aria-label': 'Carte des liens de ' + centre.n });
      const defs = svg('defs');
      carte.appendChild(defs);
      carte.appendChild(ciel(centre.id));
      const traits = svg('g', { class: 'cl-traits' });
      const flux = svg('g', { class: 'cl-flux', 'aria-hidden': 'true' });
      const noeuds = svg('g', { class: 'cl-noeuds' });
      carte.appendChild(traits);
      carte.appendChild(flux);
      carte.appendChild(noeuds);

      const places = montres.map((v, k) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(montres.length, 1);
        return { v, k, angle, x: MILIEU + ANNEAU * Math.cos(angle), y: MILIEU + ANNEAU * Math.sin(angle) };
      });

      // du centre vers chaque voisin, d'un bord de bulle à l'autre, en courbe ;
      // plus épais s'il est plus lié, teinté des deux rubriques
      const liensDe = new Map();
      for (const p of places) {
        const c = Math.cos(p.angle);
        const s = Math.sin(p.angle);
        const p0 = [MILIEU + R_CENTRE * c, MILIEU + R_CENTRE * s];
        const p2 = [p.x - R_VOISIN * c, p.y - R_VOISIN * s];
        const courbe = (p.k % 2 ? 1 : -1) * 14;
        const p1 = [(p0[0] + p2[0]) / 2 - s * courbe, (p0[1] + p2[1]) / 2 + c * courbe];
        const d = 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' Q' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1)
          + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
        const idDegrade = 'cl-dg-' + n + '-' + p.k;
        const degrade = svg('linearGradient', { id: idDegrade, gradientUnits: 'userSpaceOnUse',
          x1: p0[0].toFixed(1), y1: p0[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1) });
        degrade.appendChild(svg('stop', { offset: '0', class: 'cl-arret cat-' + centre.c }));
        degrade.appendChild(svg('stop', { offset: '1', class: 'cl-arret cat-' + p.v.a.c }));
        defs.appendChild(degrade);
        const idChemin = 'cl-ch-' + n + '-' + p.k;
        const trait = svg('path', { id: idChemin, class: 'cl-trait', d, stroke: 'url(#' + idDegrade + ')',
          'stroke-width': Math.min(4.5, 1 + p.v.poids * 0.55).toFixed(1) });
        const l = longueur(p0, p1, p2);
        trait.style.setProperty('--l', l.toFixed(1));
        trait.style.animationDelay = (0.12 + p.k * 0.05).toFixed(2) + 's';
        traits.appendChild(trait);
        liensDe.set(p.v.a.id, trait);
        if (!calme()) {
          // les points lumineux : de qui cite vers qui est cité
          const sens = [];
          if (p.v.sort) sens.push(false);
          if (p.v.entre) sens.push(true);
          sens.forEach((inverse, j) => {
            const point = svg('circle', { class: 'cl-point cat-' + (inverse ? p.v.a.c : centre.c), r: 2.3 });
            const mvt = svg('animateMotion', { dur: (2.8 + (p.k % 3) * 0.4).toFixed(1) + 's', repeatCount: 'indefinite',
              begin: (0.6 + p.k * 0.23 + j * 1.3).toFixed(2) + 's', keyPoints: inverse ? '1;0' : '0;1', keyTimes: '0;1', calcMode: 'linear', fill: 'freeze' });
            const mp = svg('mpath');
            mp.setAttribute('href', '#' + idChemin);
            mvt.appendChild(mp);
            point.appendChild(mvt);
            flux.appendChild(point);
          });
        }
      }
      // un arc entre deux voisins proches sur l'anneau qui se citent entre eux
      for (let i = 0; i < places.length; i += 1) {
        for (const d of [1, 2]) {
          const j = (i + d) % places.length;
          if (places.length < 3 || j === i || (d === 2 && places.length < 5)) continue;
          if (d === 1 && places.length === 2 && i === 1) continue;
          const p = places[i];
          const q = places[j];
          if (!lies(p.v.a, q.v.a)) continue;
          const decalage = (R_VOISIN + 3) / ANNEAU;
          const a1 = p.angle + decalage;
          let a2 = q.angle - decalage;
          if (a2 < a1) a2 += 2 * Math.PI;
          const r = ANNEAU + (d === 2 ? 30 : 0);
          traits.appendChild(svg('path', {
            class: 'cl-trait-voisin',
            d: 'M' + (MILIEU + r * Math.cos(a1)).toFixed(1) + ' ' + (MILIEU + r * Math.sin(a1)).toFixed(1)
              + ' A' + r + ' ' + r + ' 0 0 1 ' + (MILIEU + r * Math.cos(a2)).toFixed(1) + ' ' + (MILIEU + r * Math.sin(a2)).toFixed(1),
          }));
        }
      }

      /* Un nœud : un groupe placé (attribut), et dedans un corps qui s'anime
       * (feuille de style) sans toucher à la place. */
      function noeud(x, y, classe, r, attrs) {
        const g = svg('g', Object.assign({ class: 'cl-noeud ' + classe, transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')',
          tabindex: '0', role: 'button' }, attrs));
        const corps = svg('g', { class: 'cl-corps' });
        corps.appendChild(svg('circle', { class: 'cl-halo', r: r + 7 }));
        corps.appendChild(svg('circle', { class: 'cl-bulle', r }));
        corps.appendChild(svg('circle', { class: 'cl-lisere', r: r - 4 }));
        g.appendChild(corps);
        return { g, corps };
      }

      for (const p of places) {
        const { g, corps } = noeud(p.x, p.y, 'cat-' + p.v.a.c, R_VOISIN,
          { 'aria-label': 'Mettre au centre : ' + p.v.a.n, 'data-centre': p.v.a.id });
        corps.appendChild(nomSvg(p.v.a, 'cl-nom', 11, 3));
        corps.style.setProperty('--dx', (MILIEU - p.x).toFixed(1) + 'px');
        corps.style.setProperty('--dy', (MILIEU - p.y).toFixed(1) + 'px');
        corps.style.animationDelay = (0.08 + p.k * 0.06).toFixed(2) + 's';
        const trait = liensDe.get(p.v.a.id);
        const allumer = (oui) => { if (trait) trait.classList.toggle('allume', oui); };
        g.addEventListener('pointerenter', () => allumer(true));
        g.addEventListener('pointerleave', () => allumer(false));
        g.addEventListener('focus', () => allumer(true));
        g.addEventListener('blur', () => allumer(false));
        g.addEventListener('click', () => centrer(p.v.a.id, { x: p.x, y: p.y }));
        noeuds.appendChild(g);
      }
      const { g, corps } = noeud(MILIEU, MILIEU, 'cl-noeud-centre cat-' + centre.c, R_CENTRE, {
        'aria-label': centre.id === etat.fiche ? centre.n + ' (l’article de cette fiche)' : 'Lire l’article : ' + centre.n,
        'data-centre': centre.id });
      corps.insertBefore(svg('circle', { class: 'cl-pulsation', r: R_CENTRE + 2 }), corps.firstChild);
      corps.appendChild(nomSvg(centre, 'cl-nom cl-nom-centre', 13, 4));
      if (depuis) {
        corps.style.setProperty('--dx', (depuis.x - MILIEU).toFixed(1) + 'px');
        corps.style.setProperty('--dy', (depuis.y - MILIEU).toFixed(1) + 'px');
        corps.classList.add('cl-arrive');
      }
      g.addEventListener('click', () => lire(centre.id));
      noeuds.appendChild(g);
      carte.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const nd = e.target.closest && e.target.closest('.cl-noeud');
        if (!nd) return;
        e.preventDefault();
        nd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      cadre.textContent = '';
      cadre.appendChild(carte);
      ajuster(carte);

      // les rubriques présentes sur la carte
      legende.textContent = '';
      const vues = [];
      for (const x of [centre].concat(montres.map((v) => v.a))) if (!vues.includes(x.c)) vues.push(x.c);
      for (const c of vues) {
        const puce = element('span', 'cl-rubrique cat-' + c);
        puce.appendChild(element('span', 'cl-pastille'));
        puce.appendChild(document.createTextNode(Dictionnaire.categorie(c).nom));
        legende.appendChild(puce);
      }

      actions.textContent = '';
      if (centre.id !== etat.fiche) {
        actions.appendChild(bouton('bouton-principal cl-lire', 'Lire « ' + centre.n + ' »', () => lire(centre.id)));
      }
      if (pages > 1) {
        const suite = bouton('bouton-discret cl-suite', 'Autres liens (' + (etat.page + 1) + ' / ' + pages + ')', () => {
          etat.page = (etat.page + 1) % pages;
          dessiner(true);
        });
        actions.appendChild(suite);
      }
      actions.hidden = !actions.childNodes.length;

      chemin.textContent = '';
      chemin.hidden = etat.chemin.length < 2;
      if (etat.chemin.length > 1) {
        chemin.appendChild(element('span', 'cl-chemin-titre', 'Chemin :'));
        etat.chemin.forEach((id, i) => {
          const x = Dictionnaire.parId(id);
          if (i) chemin.appendChild(element('span', 'cl-chemin-sep', '›'));
          const b = bouton('cl-etape cat-' + x.c + (i === etat.chemin.length - 1 ? ' actif' : ''), x.n, () => centrer(id));
          if (i === etat.chemin.length - 1) b.setAttribute('aria-current', 'true');
          chemin.appendChild(b);
        });
      }
    }

    dessiner(false);
    return section;
  }

  /* Réduit la police d'un nom qui déborde de sa bulle. La mesure demande que
   * la carte soit à l'écran : sinon, on réessaie à la prochaine image. */
  function ajuster(carte, essai) {
    const noeuds = carte.querySelectorAll('.cl-noeud');
    if (!noeuds.length) return;
    if (!carte.isConnected) {
      // la fiche n'a pas encore posé le bloc dans la page
      if (!essai) racine.requestAnimationFrame(() => ajuster(carte, true));
      return;
    }
    let mesure = false;
    for (const n of noeuds) {
      const texte = n.querySelector('text');
      const r = parseFloat(n.querySelector('.cl-bulle').getAttribute('r'));
      const boite = texte.getBBox();
      if (!boite.width) continue;
      mesure = true;
      const place = r * 1.64;
      const facteur = Math.min(place / boite.width, (r * 1.5) / boite.height, 1);
      if (facteur < 1) {
        // par le CSSOM : la feuille de style l'emporterait sur un attribut
        const taille = parseFloat(racine.getComputedStyle(texte).fontSize) || 11;
        texte.style.fontSize = (taille * facteur * 0.97).toFixed(2) + 'px';
      }
    }
    if (!mesure && !essai) racine.requestAnimationFrame(() => ajuster(carte, true));
  }

  racine.Constellation = { bloc, voisins, couper, ajuster };

})(window);
