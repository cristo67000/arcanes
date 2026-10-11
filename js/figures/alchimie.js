'use strict';
/*
 * Figures de l'alchimie : le Grand Œuvre, les trois principes, les quatre
 * éléments, le cycle des opérations, la monade de Dee, l'ouroboros.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  // ── Le Grand Œuvre ────────────────────────────────────────────────────────

  const PHASES = [
    { id: 'nigredo', nom: 'Nigredo', fr: 'œuvre au noir', image: 'corbeau, mort', c: 'f-noir' },
    { id: 'albedo', nom: 'Albedo', fr: 'œuvre au blanc', image: 'cygne, Lune', c: 'f-blanc' },
    { id: 'citrinitas', nom: 'Citrinitas', fr: 'œuvre au jaune', image: 'aurore', c: 'f-jaune' },
    { id: 'rubedo', nom: 'Rubedo', fr: 'œuvre au rouge', image: 'phénix, Soleil', c: 'f-rouge' },
  ];

  F['grand-oeuvre'] = {
    titre: 'Les couleurs du Grand Œuvre',
    hauteur: 176,
    cles: PHASES.map((p) => p.id),
    legende: (arg) => (arg
      ? 'La ' + PHASES.find((p) => p.id === arg).nom.toLowerCase() + ' parmi les phases du Grand Œuvre. Touchez une phase pour lire son article.'
      : 'Du noir au rouge en passant par le blanc : les phases de l’œuvre selon leur couleur. Entre le noir et le blanc paraît la « queue de paon ».'),
    dessiner(f, arg) {
      const xs = [48, 136, 224, 312];
      const y = 70;
      // La queue de paon, entre le noir et le blanc
      f.arc(92, y + 6, 30, -70, 70, 'f-paon');
      f.texte(92, 22, 'queue de paon', { t: 8, c: 'f-texte-doux', i: true });
      for (let i = 0; i < 3; i += 1) f.fleche(xs[i] + 30, y, xs[i + 1] - 31, y, 'f-trait-doux');
      PHASES.forEach((p, i) => {
        const actif = p.id === arg;
        const groupe = f.dans('f-phase', () => {
          if (actif) f.cercle(xs[i], y, 33, 'f-halo');
          f.cercle(xs[i], y, 26, p.c);
          f.texte(xs[i], y + 46, p.nom, { t: 11, b: true, serif: true, c: actif ? 'f-texte-accent' : 'f-texte' });
          f.texte(xs[i], y + 61, p.fr, { t: 8.4, c: 'f-texte-doux' });
          f.texte(xs[i], y + 74, p.image, { t: 7.8, c: 'f-texte-doux', i: true });
        });
        f.lien(groupe, p.id, p.nom);
      });
    },
  };

  // ── Les trois principes ───────────────────────────────────────────────────

  F['tria-prima'] = {
    titre: 'Les trois principes de Paracelse',
    hauteur: 262,
    legende: 'Soufre, mercure et sel : l’âme, l’esprit et le corps de toute chose. Ce qui brûle, ce qui s’envole en fumée, ce qui reste en cendres.',
    dessiner(f) {
      const sommets = [
        { id: 'soufre', g: 'soufre', nom: 'Soufre', sens: 'âme · ce qui brûle', x: 180, y: 44 },
        { id: 'mercure-principe', g: 'mercure', nom: 'Mercure', sens: 'esprit · ce qui s’envole', x: 62, y: 202 },
        { id: 'sel', g: 'sel', nom: 'Sel', sens: 'corps · ce qui demeure', x: 298, y: 202 },
      ];
      f.poly(sommets.map((s) => [s.x, s.y]), 'f-trait-doux');
      f.texte(180, 150, 'toute chose', { t: 10, i: true, c: 'f-texte-doux' });
      for (const s of sommets) {
        const groupe = f.dans('f-sommet', () => {
          f.cercle(s.x, s.y, 25, 'f-fond-page-trait');
          f.glyphe(s.g, s.x, s.y, 28, 'f-glyphe-accent');
          const bas = s.y > 100;
          f.texte(s.x, bas ? s.y + 38 : s.y - 34, s.nom, { t: 11.5, b: true, serif: true });
          f.texte(s.x, bas ? s.y + 52 : s.y + 38, s.sens, { t: 8.6, c: 'f-texte-doux' });
        });
        f.lien(groupe, s.id, s.nom);
      }
    },
  };

  // ── Les quatre éléments ───────────────────────────────────────────────────

  F['quatre-elements'] = {
    titre: 'Les quatre éléments et leurs qualités',
    hauteur: 318,
    legende: 'Chaque élément unit deux qualités voisines ; deux éléments qui partagent une qualité peuvent se changer l’un en l’autre. Sous chaque élément, son humeur et son tempérament.',
    dessiner(f) {
      const cx = 180;
      const cy = 152;
      const r = 104;
      const q = [['Chaud', 0], ['Sec', 90], ['Froid', 180], ['Humide', 270]];
      const coins = q.map(([nom, a]) => f.polaire(cx, cy, r, a));
      f.poly(coins, 'f-trait');
      q.forEach(([nom, a], i) => {
        const [x, y] = f.polaire(cx, cy, r + 20, a);
        f.texte(x, y, nom, { t: 10.5, i: true, c: 'f-texte-accent' });
        f.cercle(coins[i][0], coins[i][1], 4, 'f-point-accent');
      });
      const el = [
        ['feu', 'Feu', 'bile jaune · colérique', 45, 'f-el-feu'],
        ['terre-element', 'Terre', 'bile noire · mélancolique', 135, 'f-el-terre'],
        ['eau', 'Eau', 'flegme · flegmatique', 225, 'f-el-eau'],
        ['air', 'Air', 'sang · sanguin', 315, 'f-el-air'],
      ];
      for (const [g, nom, humeur, a, classe] of el) {
        const [x, y] = f.polaire(cx, cy, r * 0.71, a);
        f.cercle(x, y, 22, classe);
        f.glyphe(g, x, y, 22, 'f-glyphe');
        const [lx, ly] = f.polaire(cx, cy, r * 0.71 + 46, a);
        f.texte(lx, ly - 5, nom, { t: 11, b: true, serif: true });
        f.texte(lx, ly + 8, humeur, { t: 7.6, c: 'f-texte-doux', max: 110 });
      }
      f.texte(cx, cy, 'quintessence', { t: 8.5, i: true, c: 'f-texte-doux' });
    },
  };

  // ── Le cycle des opérations ───────────────────────────────────────────────

  F['operations-alchimiques'] = {
    titre: 'Le cycle des opérations alchimiques',
    hauteur: 334,
    legende: 'Une suite classique d’opérations, de la calcination à la projection ; dissoudre puis coaguler, et recommencer pour purifier toujours davantage.',
    dessiner(f) {
      const cx = 180;
      const cy = 168;
      const r = 106;
      const ops = [
        ['Calcination', 'calcination'], ['Dissolution', 'solve-et-coagula'], ['Putréfaction', 'putrefaction'],
        ['Distillation', 'distillation'], ['Sublimation', 'sublimation'], ['Conjonction', null],
        ['Fermentation', null], ['Fixation', null], ['Multiplication', null], ['Projection', 'projection'],
      ];
      const pas = 360 / ops.length;
      ops.forEach(([nom, ref], i) => {
        const [x, y] = f.polaire(cx, cy, r, i * pas);
        const a1 = i * pas + 10;
        const a2 = (i + 1) * pas - 10;
        if (i < ops.length - 1) {
          const [x1, y1] = f.polaire(cx, cy, r, a1);
          const [x2, y2] = f.polaire(cx, cy, r, a2);
          f.flecheCourbe('M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1), 'f-trait-doux');
        }
        const groupe = f.dans('f-operation', () => {
          f.cercle(x, y, 5, ref ? 'f-point-accent' : 'f-point');
          const [lx, ly] = f.polaire(cx, cy, r + (i % 5 === 0 ? 18 : 24), i * pas);
          const ancre = Math.abs(lx - cx) < 20 ? 'middle' : (lx > cx ? 'start' : 'end');
          f.texte(lx + (ancre === 'start' ? -6 : (ancre === 'end' ? 6 : 0)), ly, nom, { t: 9.4, a: ancre, b: !!ref });
        });
        if (ref) f.lien(groupe, ref, nom);
      });
      f.texte(cx, cy - 10, 'Solve', { t: 18, serif: true, i: true, c: 'f-texte-accent' });
      f.texte(cx, cy + 14, 'et coagula', { t: 13, serif: true, i: true, c: 'f-texte-accent' });
    },
  };

  // ── La monade hiéroglyphique ──────────────────────────────────────────────

  F['monade-hieroglyphique'] = {
    titre: 'La monade hiéroglyphique de John Dee',
    hauteur: 282,
    legende: 'Le signe de John Dee (1564) : la Lune, le Soleil et son point, la croix des éléments et, en bas, le signe du Bélier, le feu.',
    dessiner(f) {
      const cx = 150;
      // La Lune : un croissant, cornes en l'air
      f.chemin('M120 62A30 30 0 0 0 180 62A50 50 0 0 1 120 62Z', 'f-trait-epais');
      // Le Soleil
      f.cercle(cx, 112, 32, 'f-trait-epais');
      f.cercle(cx, 112, 5, 'f-point-accent');
      // La croix des éléments
      f.trait(cx, 144, cx, 228, 'f-trait-epais');
      f.trait(cx - 34, 182, cx + 34, 182, 'f-trait-epais');
      // Le Bélier : deux demi-cercles sous la croix
      f.chemin('M150 228A17 17 0 0 0 116 228', 'f-trait-epais');
      f.chemin('M150 228A17 17 0 0 1 184 228', 'f-trait-epais');
      const legendes = [[70, 'la Lune'], [112, 'le Soleil'], [182, 'la croix des éléments'], [222, 'le Bélier, le feu']];
      for (const [y, t] of legendes) {
        f.trait(206, y, 236, y, 'f-trait-pointille');
        f.texte(242, y, t, { t: 9.5, a: 'start', c: 'f-texte-doux' });
      }
    },
  };

  // ── L'ouroboros ───────────────────────────────────────────────────────────

  F.ouroboros = {
    titre: 'L’ouroboros',
    hauteur: 268,
    legende: 'Le serpent qui se mord la queue, d’après la Chrysopée de Cléopâtre : « Un est le Tout ».',
    dessiner(f) {
      const cx = 180;
      const cy = 134;
      const r = 92;
      // Le corps : un anneau ouvert, la queue s'amincit vers la gueule
      f.arc(cx, cy, r, 38, 338, 'f-serpent');
      f.arc(cx, cy, r, 338, 374, 'f-serpent-queue');
      // La tête, à 30° : un ovale pointé vers la queue
      const [hx, hy] = f.polaire(cx, cy, r, 22);
      f.ellipse(hx, hy, 17, 13, 'f-serpent-tete');
      const [ox, oy] = f.polaire(cx, cy, r - 4, 26);
      f.cercle(ox, oy, 2.4, 'f-oeil');
      // Les écailles
      for (let a = 60; a < 330; a += 18) {
        const [x1, y1] = f.polaire(cx, cy, r - 6, a);
        const [x2, y2] = f.polaire(cx, cy, r + 6, a + 6);
        f.trait(x1, y1, x2, y2, 'f-ecaille');
      }
      f.texte(cx, cy - 8, 'Ἓν τὸ πᾶν', { t: 16, serif: true, c: 'f-texte-accent' });
      f.texte(cx, cy + 16, '« Un est le Tout »', { t: 10.5, i: true, c: 'f-texte-doux' });
    },
  };

})(window);
