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

  /* Les voisins d'un article, du plus lié au moins lié : [{ a, poids }]. */
  function voisins(a) {
    const poids = new Map();
    const ajouter = (id, n) => {
      if (id === a.id || !Dictionnaire.parId(id)) return;
      poids.set(id, (poids.get(id) || 0) + n);
    };
    for (const id of Dictionnaire.citesPar(a)) ajouter(id, 2);
    for (const id of a.v || []) ajouter(id, 1);
    for (const id of a.ci || []) ajouter(id, 1.5);
    return Array.from(poids, ([id, p]) => ({ a: Dictionnaire.parId(id), poids: p }))
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
    section.appendChild(element('p', 'discret cl-aide', 'Touchez un article pour le mettre au centre et voir ses propres liens ; touchez le centre pour le lire.'));
    const cadre = element('div', 'cl-cadre');
    section.appendChild(cadre);
    const actions = element('div', 'cl-actions');
    section.appendChild(actions);
    const chemin = element('nav', 'cl-chemin');
    chemin.setAttribute('aria-label', 'Chemin parcouru dans la carte');
    section.appendChild(chemin);

    function centrer(id) {
      const i = etat.chemin.indexOf(id);
      if (i !== -1) etat.chemin.length = i + 1; else etat.chemin.push(id);
      etat.page = 0;
      dessiner(true);
    }

    function lire(id) {
      if (id !== etat.fiche) ouvrir(id);
    }

    function dessiner(anime) {
      const centre = Dictionnaire.parId(etat.chemin[etat.chemin.length - 1]);
      const tous = voisins(centre);
      const pages = Math.max(1, Math.ceil(tous.length / PAR_PAGE));
      etat.page %= pages;
      const montres = tous.slice(etat.page * PAR_PAGE, (etat.page + 1) * PAR_PAGE);
      compte.textContent = Outils.pluriel(tous.length, 'article lié', 'articles liés');

      const carte = svg('svg', { class: 'cl-carte' + (anime ? ' cl-entree' : ''), viewBox: '0 0 ' + TAILLE + ' ' + TAILLE, role: 'group',
        'aria-label': 'Carte des liens de ' + centre.n });
      const traits = svg('g', { class: 'cl-traits' });
      const noeuds = svg('g', { class: 'cl-noeuds' });
      carte.appendChild(traits);
      carte.appendChild(noeuds);

      const places = montres.map((v, k) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(montres.length, 1);
        return { v, angle, x: MILIEU + ANNEAU * Math.cos(angle), y: MILIEU + ANNEAU * Math.sin(angle) };
      });

      // du centre vers chaque voisin, d'un bord de bulle à l'autre ; plus épais s'il est plus lié
      for (const p of places) {
        const c = Math.cos(p.angle);
        const s = Math.sin(p.angle);
        traits.appendChild(svg('line', {
          class: 'cl-trait cat-' + p.v.a.c,
          x1: (MILIEU + R_CENTRE * c).toFixed(1), y1: (MILIEU + R_CENTRE * s).toFixed(1),
          x2: (p.x - R_VOISIN * c).toFixed(1), y2: (p.y - R_VOISIN * s).toFixed(1),
          'stroke-width': Math.min(4.5, 1 + p.v.poids * 0.55).toFixed(1),
        }));
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
            class: 'cl-trait cl-trait-voisin',
            d: 'M' + (MILIEU + r * Math.cos(a1)).toFixed(1) + ' ' + (MILIEU + r * Math.sin(a1)).toFixed(1)
              + ' A' + r + ' ' + r + ' 0 0 1 ' + (MILIEU + r * Math.cos(a2)).toFixed(1) + ' ' + (MILIEU + r * Math.sin(a2)).toFixed(1),
          }));
        }
      }

      for (const p of places) {
        const g = svg('g', { class: 'cl-noeud cat-' + p.v.a.c, transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')',
          tabindex: '0', role: 'button', 'aria-label': 'Mettre au centre : ' + p.v.a.n, 'data-centre': p.v.a.id });
        g.appendChild(svg('circle', { class: 'cl-bulle', r: R_VOISIN }));
        g.appendChild(nomSvg(p.v.a, 'cl-nom', 11, 3));
        g.addEventListener('click', () => centrer(p.v.a.id));
        noeuds.appendChild(g);
      }
      const g = svg('g', { class: 'cl-noeud cl-noeud-centre cat-' + centre.c, transform: 'translate(' + MILIEU + ' ' + MILIEU + ')',
        tabindex: '0', role: 'button', 'aria-label': centre.id === etat.fiche ? centre.n + ' (l’article de cette fiche)' : 'Lire l’article : ' + centre.n,
        'data-centre': centre.id });
      g.appendChild(svg('circle', { class: 'cl-bulle', r: R_CENTRE }));
      g.appendChild(nomSvg(centre, 'cl-nom cl-nom-centre', 13, 4));
      g.addEventListener('click', () => lire(centre.id));
      noeuds.appendChild(g);
      carte.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const n = e.target.closest && e.target.closest('.cl-noeud');
        if (!n) return;
        e.preventDefault();
        n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      cadre.textContent = '';
      cadre.appendChild(carte);
      ajuster(carte);

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
      const r = parseFloat(n.querySelector('circle').getAttribute('r'));
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
