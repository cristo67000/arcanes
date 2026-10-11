'use strict';
/*
 * Le moteur des figures : trace en SVG les schémas décrits dans js/figures/*.js.
 *
 * Une figure est un petit objet :
 *
 *   Figures['zodiaque'] = {
 *     titre: 'Le zodiaque',                  le nom accessible du dessin
 *     hauteur: 360,                          sa hauteur, pour une largeur de 360
 *     cles: ['belier', …],                   (facultatif) ce qu'on peut mettre en
 *                                            avant : « schema: zodiaque/belier »
 *     legende: 'Texte' ou (arg) => 'Texte',  (facultatif) la légende
 *     dessiner(f, arg) { … },                le dessin, avec les outils de `f`
 *   };
 *
 * Les outils de `f` posent cercles, traits, textes, polygones et signes ; tout
 * passe par `setAttribute`, jamais par l'attribut « style » (la politique de
 * sécurité de la page l'interdit), et les couleurs viennent de classes (`f-trait`,
 * `f-actif`, `f-feu`…) que figure.css relie aux couleurs du thème : le même
 * dessin vaut pour le clair et le sombre.
 *
 * Un élément peut renvoyer vers un article : `f.lien(element, 'keter')`. La
 * fiche rend alors cet élément cliquable (et atteignable au clavier) ; c'est
 * ainsi qu'on passe d'une séphira de l'arbre à son article.
 */
(function (racine) {

  const { svg } = Outils;
  const L = 360;
  const RAD = Math.PI / 180;

  // ── Largeur estimée d'un texte (on dessine avant de pouvoir mesurer) ──────

  const ETROITS = new Set("iljtfI.,:;'’|!()[]/ ".split(''));
  const LARGES = new Set('mwMWŒœÆæ@%'.split(''));
  function largeur(chaine, taille) {
    let w = 0;
    for (const c of Array.from(String(chaine))) {
      if (ETROITS.has(c)) w += 0.3;
      else if (LARGES.has(c)) w += 0.85;
      else if (c >= 'A' && c <= 'Z') w += 0.66;
      else w += 0.53;
    }
    return w * taille;
  }

  /* Coupe un texte en lignes qui tiennent dans `max` unités. */
  function envelopper(chaine, max, taille) {
    const lignes = [];
    for (const paragraphe of String(chaine).split('\n')) {
      let ligne = '';
      for (const mot of paragraphe.split(' ')) {
        const essai = ligne ? ligne + ' ' + mot : mot;
        if (ligne && largeur(essai, taille) > max) { lignes.push(ligne); ligne = mot; } else ligne = essai;
      }
      lignes.push(ligne);
    }
    return lignes;
  }

  // ── Les outils de dessin ──────────────────────────────────────────────────

  function outils(racineSvg, defs, id) {
    let g = racineSvg;
    const f = {
      L,
      get groupe() { return g; },
      /* Dessine dans un sous-groupe le temps d'une fonction. */
      dans(classe, fonction) {
        const avant = g;
        const sous = svg('g', classe ? { class: classe } : null);
        g.appendChild(sous);
        g = sous;
        try { fonction(sous); } finally { g = avant; }
        return sous;
      },
      poser(element) { g.appendChild(element); return element; },
      cercle(cx, cy, r, classe) { return f.poser(svg('circle', { cx: n(cx), cy: n(cy), r: n(r), class: classe || 'f-trait' })); },
      ellipse(cx, cy, rx, ry, classe) { return f.poser(svg('ellipse', { cx: n(cx), cy: n(cy), rx: n(rx), ry: n(ry), class: classe || 'f-trait' })); },
      rect(x, y, w, h, rx, classe) { return f.poser(svg('rect', { x: n(x), y: n(y), width: n(w), height: n(h), rx: n(rx || 0), class: classe || 'f-trait' })); },
      trait(x1, y1, x2, y2, classe) { return f.poser(svg('line', { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), class: classe || 'f-trait' })); },
      chemin(d, classe) { return f.poser(svg('path', { d, class: classe || 'f-trait' })); },
      poly(points, classe, ouvert) {
        const p = points.map(([x, y]) => n(x) + ',' + n(y)).join(' ');
        return f.poser(svg(ouvert ? 'polyline' : 'polygon', { points: p, class: classe || 'f-trait' }));
      },
      /* Une flèche de (x1, y1) à (x2, y2), pointe comprise. */
      fleche(x1, y1, x2, y2, classe) {
        const l = svg('line', { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), class: classe || 'f-trait' });
        l.setAttribute('marker-end', 'url(#' + marqueur(defs, id) + ')');
        return f.poser(l);
      },
      flecheCourbe(d, classe) {
        const p = svg('path', { d, class: classe || 'f-trait' });
        p.setAttribute('marker-end', 'url(#' + marqueur(defs, id) + ')');
        return f.poser(p);
      },
      /* Un texte, sur une ou plusieurs lignes (tableau ou « \n »), centré par
       * défaut. o : { t: taille, a: 'start' | 'middle' | 'end', c: classe,
       * b: gras, i: italique, max: largeur pour couper, lh: interligne }. */
      texte(x, y, contenu, o) {
        const opt = o || {};
        // rien sous huit unités : sur un téléphone, ce serait illisible
        const taille = Math.max(opt.t || 11, 8);
        let lignes = Array.isArray(contenu) ? contenu : String(contenu).split('\n');
        if (opt.max) lignes = [].concat(...lignes.map((l) => envelopper(l, opt.max, taille)));
        const inter = opt.lh || taille * 1.18;
        const t = svg('text', {
          x: n(x), y: n(y - ((lignes.length - 1) * inter) / 2 + taille * 0.35),
          'text-anchor': opt.a || 'middle', 'font-size': n(taille),
          class: (opt.c || 'f-texte') + (opt.b ? ' f-gras' : '') + (opt.i ? ' f-italique' : '') + (opt.serif ? ' f-serif' : ''),
        });
        lignes.forEach((l, i) => t.appendChild(svg('tspan', { x: n(x), dy: i === 0 ? 0 : n(inter) }, l)));
        if (opt.rot) t.setAttribute('transform', 'rotate(' + opt.rot + ' ' + n(x) + ' ' + n(y) + ')');
        return f.poser(t);
      },
      glyphe(nom, x, y, taille, classe) { return Glyphes.poser(g, nom, x, y, taille, classe); },
      /* Point sur un cercle : angle en degrés, 0 = en haut, sens des aiguilles. */
      polaire(cx, cy, r, angle) {
        return [cx + r * Math.sin(angle * RAD), cy - r * Math.cos(angle * RAD)];
      },
      /* Secteur d'anneau entre les rayons r1 < r2 et les angles a1 → a2 (sens horaire). */
      secteur(cx, cy, r1, r2, a1, a2, classe) {
        const [x1, y1] = f.polaire(cx, cy, r2, a1);
        const [x2, y2] = f.polaire(cx, cy, r2, a2);
        const [x3, y3] = f.polaire(cx, cy, r1, a2);
        const [x4, y4] = f.polaire(cx, cy, r1, a1);
        const grand = (a2 - a1) % 360 > 180 ? 1 : 0;
        const d = 'M' + n(x1) + ' ' + n(y1) + 'A' + n(r2) + ' ' + n(r2) + ' 0 ' + grand + ' 1 ' + n(x2) + ' ' + n(y2)
          + 'L' + n(x3) + ' ' + n(y3) + 'A' + n(r1) + ' ' + n(r1) + ' 0 ' + grand + ' 0 ' + n(x4) + ' ' + n(y4) + 'Z';
        return f.chemin(d, classe);
      },
      /* Arc de cercle seul, de a1 à a2 (sens horaire). */
      arc(cx, cy, r, a1, a2, classe) {
        const [x1, y1] = f.polaire(cx, cy, r, a1);
        const [x2, y2] = f.polaire(cx, cy, r, a2);
        const grand = (((a2 - a1) % 360) + 360) % 360 > 180 ? 1 : 0;
        return f.chemin('M' + n(x1) + ' ' + n(y1) + 'A' + n(r) + ' ' + n(r) + ' 0 ' + grand + ' 1 ' + n(x2) + ' ' + n(y2), classe);
      },
      /* Rend un élément cliquable : il ouvrira l'article `ref`. */
      lien(element, ref, nom) {
        if (!element || !ref) return element;
        element.setAttribute('data-ref', ref);
        element.setAttribute('role', 'link');
        element.setAttribute('tabindex', '0');
        if (nom) element.setAttribute('aria-label', nom);
        element.classList.add('f-lien');
        return element;
      },
      largeur, envelopper,
    };
    return f;
  }

  function n(v) { return Math.round(v * 100) / 100; }

  let compteur = 0;
  function marqueur(defs, id) {
    const nom = 'fl-' + id;
    if (!defs.querySelector('#' + nom)) {
      const m = svg('marker', {
        id: nom, viewBox: '0 0 10 10', refX: '8.5', refY: '5', markerWidth: '7', markerHeight: '7',
        orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse',
      });
      m.appendChild(svg('path', { d: 'M0,1.2 L9,5 L0,8.8 z', class: 'f-pointe' }));
      defs.appendChild(m);
    }
    return nom;
  }

  /* Le dessin d'une figure, prêt à poser dans la page. `ref` : « nom » ou
   * « nom/argument ». */
  function dessiner(ref) {
    const [nom, arg] = String(ref).split('/');
    const spec = racine.Figures && racine.Figures[nom];
    if (!spec) throw new Error('figure inconnue : ' + nom);
    compteur += 1;
    const id = 'fig' + compteur;
    const hauteur = typeof spec.hauteur === 'function' ? spec.hauteur(arg) : spec.hauteur;
    const s = svg('svg', {
      viewBox: '0 0 ' + L + ' ' + hauteur, class: 'figure-svg', role: 'img',
      'aria-label': spec.titre, preserveAspectRatio: 'xMidYMid meet',
    });
    const defs = svg('defs');
    s.appendChild(defs);
    s.appendChild(svg('title', null, spec.titre));
    spec.dessiner(outils(s, defs, id), arg || null);
    return s;
  }

  function legende(ref) {
    const [nom, arg] = String(ref).split('/');
    const spec = racine.Figures && racine.Figures[nom];
    if (!spec || !spec.legende) return '';
    return typeof spec.legende === 'function' ? spec.legende(arg || null) : spec.legende;
  }

  function titre(ref) {
    const spec = racine.Figures && racine.Figures[String(ref).split('/')[0]];
    return spec ? spec.titre : '';
  }

  racine.Figure = { dessiner, legende, titre, largeur, envelopper };

})(window);
