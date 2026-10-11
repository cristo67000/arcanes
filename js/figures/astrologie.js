'use strict';
/*
 * Figures de l'astrologie : le zodiaque, les planètes, les maisons, les
 * aspects, les dignités, l'heptagramme des jours, les sphères célestes.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  const SIGNES = [
    { id: 'belier', nom: 'Bélier', el: 'feu' }, { id: 'taureau', nom: 'Taureau', el: 'terre' },
    { id: 'gemeaux', nom: 'Gémeaux', el: 'air' }, { id: 'cancer', nom: 'Cancer', el: 'eau' },
    { id: 'lion', nom: 'Lion', el: 'feu' }, { id: 'vierge', nom: 'Vierge', el: 'terre' },
    { id: 'balance', nom: 'Balance', el: 'air' }, { id: 'scorpion', nom: 'Scorpion', el: 'eau' },
    { id: 'sagittaire', nom: 'Sagittaire', el: 'feu' }, { id: 'capricorne', nom: 'Capricorne', el: 'terre' },
    { id: 'verseau', nom: 'Verseau', el: 'air' }, { id: 'poissons', nom: 'Poissons', el: 'eau' },
  ];
  const NOM_SIGNE = new Map(SIGNES.map((s) => [s.id, s.nom]));

  const PLANETES = [
    { id: 'saturne', nom: 'Saturne', metal: 'plomb', jour: 'samedi', dom: ['capricorne', 'verseau'] },
    { id: 'jupiter', nom: 'Jupiter', metal: 'étain', jour: 'jeudi', dom: ['sagittaire', 'poissons'] },
    { id: 'mars', nom: 'Mars', metal: 'fer', jour: 'mardi', dom: ['belier', 'scorpion'] },
    { id: 'soleil', nom: 'Soleil', metal: 'or', jour: 'dimanche', dom: ['lion'] },
    { id: 'venus', nom: 'Vénus', metal: 'cuivre', jour: 'vendredi', dom: ['taureau', 'balance'] },
    { id: 'mercure', nom: 'Mercure', metal: 'vif-argent', jour: 'mercredi', dom: ['gemeaux', 'vierge'] },
    { id: 'lune', nom: 'Lune', metal: 'argent', jour: 'lundi', dom: ['cancer'] },
  ];
  const parPlanete = new Map(PLANETES.map((p) => [p.id, p]));

  // ── Le zodiaque ───────────────────────────────────────────────────────────

  /* Comme sur un thème astral : le Bélier commence à gauche, à l'horizon est,
   * et les signes se suivent dans le sens inverse des aiguilles d'une montre. */
  F.zodiaque = {
    titre: 'La roue du zodiaque',
    hauteur: 364,
    cles: SIGNES.map((s) => s.id),
    legende: (arg) => (arg
      ? 'Le ' + NOM_SIGNE.get(arg) + ' dans la roue du zodiaque ; la couleur dit l’élément. Touchez un signe pour lire son article.'
      : 'Les douze signes, colorés selon leur élément ; les signes d’un même élément forment un triangle. Touchez un signe pour lire son article.'),
    dessiner(f, arg) {
      const cx = 180;
      const cy = 182;
      SIGNES.forEach((s, i) => {
        const a2 = 270 - 30 * i;
        const a1 = a2 - 30;
        const actif = s.id === arg;
        const groupe = f.dans('f-secteur-zodiaque', () => {
          f.secteur(cx, cy, 104, 172, a1, a2, actif ? 'f-actif' : 'f-el-' + s.el);
          const [gx, gy] = f.polaire(cx, cy, 146, a1 + 15);
          f.glyphe(s.id, gx, gy, 26, actif ? 'f-glyphe-actif' : 'f-glyphe');
          const [tx, ty] = f.polaire(cx, cy, 116, a1 + 15);
          f.texte(tx, ty, s.nom, { t: 7.6, c: actif ? 'f-texte-actif' : 'f-texte-doux', b: actif });
        });
        f.lien(groupe, s.id, s.nom);
      });
      f.cercle(cx, cy, 104, 'f-trait-doux');
      f.cercle(cx, cy, 172, 'f-trait');
      // Légende des éléments, au centre
      const elements = [['feu', 'Feu'], ['terre', 'Terre'], ['air', 'Air'], ['eau', 'Eau']];
      elements.forEach(([el, nom], i) => {
        const y = cy - 33 + i * 22;
        f.rect(cx - 34, y - 7, 14, 14, 3, 'f-el-' + el);
        f.texte(cx - 12, y, nom, { t: 10, a: 'start' });
      });
    },
  };

  // ── Les sept planètes ─────────────────────────────────────────────────────

  F['planetes-septenaire'] = {
    titre: 'Les sept planètes et leurs correspondances',
    hauteur: 296,
    cles: PLANETES.map((p) => p.id),
    legende: (arg) => (arg
      ? parPlanete.get(arg).nom + ' parmi les sept planètes, dans l’ordre chaldéen : son métal, son jour, ses signes. Touchez une ligne pour lire l’article.'
      : 'Les sept planètes dans l’ordre chaldéen, de la plus lente à la plus rapide, avec leur métal, leur jour et les signes où elles ont leur domicile.'),
    dessiner(f, arg) {
      const x = [26, 58, 160, 236, 300];
      const y0 = 30;
      const h = 37;
      f.texte(x[1], 14, 'Planète', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[2], 14, 'Métal', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[3], 14, 'Jour', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[4] + 14, 14, 'Domicile', { t: 8.5, c: 'f-texte-doux' });
      PLANETES.forEach((p, i) => {
        const y = y0 + i * h;
        const actif = p.id === arg;
        const groupe = f.dans('f-ligne-table', () => {
          const c = actif ? 'f-texte-actif' : null;
          f.rect(4, y, 352, h - 4, 7, actif ? 'f-actif' : (i % 2 ? 'f-case-claire' : 'f-case'));
          f.glyphe(p.id, x[0], y + (h - 4) / 2, 22, actif ? 'f-glyphe-actif' : 'f-glyphe-accent');
          f.texte(x[1], y + (h - 4) / 2, p.nom, { t: 11.5, a: 'start', b: true, serif: true, c: c || 'f-texte' });
          f.texte(x[2], y + (h - 4) / 2, p.metal, { t: 10, a: 'start', c: c || 'f-texte' });
          f.texte(x[3], y + (h - 4) / 2, p.jour, { t: 10, a: 'start', c: c || 'f-texte-doux' });
          p.dom.forEach((s, k) => f.glyphe(s, x[4] + (p.dom.length === 1 ? 14 : k * 28), y + (h - 4) / 2, 17, actif ? 'f-glyphe-actif' : 'f-glyphe'));
        });
        f.lien(groupe, p.id, p.nom);
      });
    },
  };

  // ── Les sphères célestes ──────────────────────────────────────────────────

  F['cosmos-geocentrique'] = {
    titre: 'Les sphères célestes autour de la Terre',
    hauteur: 362,
    legende: 'Le cosmos de Ptolémée et du Moyen Âge : la Terre au centre, puis la Lune, Mercure, Vénus, le Soleil, Mars, Jupiter, Saturne, les étoiles fixes et le premier mobile.',
    dessiner(f) {
      const cx = 180;
      const cy = 180;
      const orbes = [
        ['lune', 'Lune'], ['mercure', 'Mercure'], ['venus', 'Vénus'], ['soleil', 'Soleil'], ['mars', 'Mars'],
        ['jupiter', 'Jupiter'], ['saturne', 'Saturne'], [null, 'Étoiles fixes'], [null, 'Premier mobile'],
      ];
      orbes.forEach(([g, nom], i) => {
        const r = 30 + i * 17;
        f.cercle(cx, cy, r, i === 8 ? 'f-trait-pointille' : (i === 7 ? 'f-trait-fort' : 'f-trait-doux'));
        if (g) {
          const angle = -50 + i * 16;
          const [x, y] = f.polaire(cx, cy, r, angle);
          f.cercle(x, y, 7.5, 'f-fond-page');
          f.glyphe(g, x, y, 13, 'f-glyphe-accent');
        }
        f.texte(cx + 4, cy + r - 6.5, nom, { t: 7.6, a: 'start', c: i >= 7 ? 'f-texte-accent' : 'f-texte-doux' });
      });
      // Les étoiles fixes : quelques points sur leur sphère
      for (let k = 0; k < 18; k += 1) {
        const [x, y] = f.polaire(cx, cy, 30 + 7 * 17, 100 + k * 13.5);
        f.cercle(x, y, 1.3, 'f-etoile');
      }
      f.glyphe('terre', cx, cy, 20, 'f-glyphe');
      f.texte(cx, 12, 'Empyrée', { t: 9, c: 'f-texte-accent', i: true });
    },
  };

  // ── Les maisons ───────────────────────────────────────────────────────────

  F['maisons-astrologiques'] = {
    titre: 'Les douze maisons du thème',
    hauteur: 352,
    legende: 'Les maisons partent de l’ascendant (à gauche) et se suivent dans le sens inverse des aiguilles d’une montre ; le milieu du ciel est en haut.',
    dessiner(f) {
      const cx = 180;
      const cy = 176;
      const domaines = ['Soi', 'Biens', 'Échanges', 'Foyer', 'Créations', 'Travail', 'Union', 'Crises', 'Voyages', 'Carrière', 'Amis', 'Épreuves'];
      f.cercle(cx, cy, 150, 'f-trait');
      f.cercle(cx, cy, 58, 'f-trait-doux');
      for (let i = 0; i < 12; i += 1) {
        const a2 = 270 - 30 * i;
        const a1 = a2 - 30;
        const [x1, y1] = f.polaire(cx, cy, 58, a2);
        const [x2, y2] = f.polaire(cx, cy, 150, a2);
        f.trait(x1, y1, x2, y2, i % 3 === 0 ? 'f-trait-fort' : 'f-trait-doux');
        const [nx, ny] = f.polaire(cx, cy, 128, a1 + 15);
        f.texte(nx, ny, String(i + 1), { t: 15, serif: true, c: 'f-texte-accent' });
        const [dx, dy] = f.polaire(cx, cy, 92, a1 + 15);
        f.texte(dx, dy, domaines[i], { t: 8.4, c: 'f-texte-doux' });
      }
      f.texte(4, cy - 10, 'ASC', { t: 9.5, b: true, a: 'start' });
      f.texte(356, cy - 10, 'DS', { t: 9.5, b: true, a: 'end' });
      f.texte(cx + 6, 16, 'MC', { t: 9.5, b: true, a: 'start' });
      f.texte(cx + 6, 340, 'FC', { t: 9.5, b: true, a: 'start' });
      f.texte(cx, cy, 'thème', { t: 10, i: true, c: 'f-texte-doux' });
    },
  };

  // ── Les aspects ───────────────────────────────────────────────────────────

  F.aspects = {
    titre: 'Les aspects majeurs',
    hauteur: 260,
    legende: 'À partir d’une planète, les angles qui forment les aspects majeurs de Ptolémée : sextile, carré, trigone, opposition.',
    dessiner(f) {
      const cx = 122;
      const cy = 130;
      const r = 96;
      f.cercle(cx, cy, r, 'f-trait');
      const depart = 270;
      const [x0, y0] = f.polaire(cx, cy, r, depart);
      const aspects = [[60, '60°', 'f-aspect-doux'], [90, '90°', 'f-aspect-tendu'], [120, '120°', 'f-aspect-doux'], [180, '180°', 'f-aspect-tendu']];
      for (const [angle, deg, classe] of aspects) {
        const [x, y] = f.polaire(cx, cy, r, depart + angle);
        f.trait(x0, y0, x, y, classe);
        f.cercle(x, y, 4.5, 'f-point');
        const [lx, ly] = f.polaire(cx, cy, r + 15, depart + angle);
        f.texte(lx, ly, deg, { t: 8.6, c: 'f-texte-doux' });
      }
      f.cercle(x0, y0, 7, 'f-point-accent');
      f.texte(x0 + 2, y0 + 20, 'planète', { t: 8.6, a: 'start', c: 'f-texte-accent' });
      const lignes = [
        ['Conjonction', '0°', 'fusion'], ['Sextile', '60°', 'harmonie'], ['Carré', '90°', 'tension'],
        ['Trigone', '120°', 'harmonie'], ['Opposition', '180°', 'tension'],
      ];
      lignes.forEach(([nom, deg, sens], i) => {
        const y = 52 + i * 38;
        f.texte(262, y, nom, { t: 10.5, a: 'start', b: true });
        f.texte(262, y + 14, deg + ' · ' + sens, { t: 8.8, a: 'start', c: sens === 'tension' ? 'f-texte-tendu' : 'f-texte-doux' });
      });
    },
  };

  // ── Les dignités ──────────────────────────────────────────────────────────

  F.dignites = {
    titre: 'Les dignités des planètes',
    hauteur: 272,
    legende: 'Domicile et exaltation, où la planète est forte ; exil et chute, aux signes opposés, où elle est affaiblie.',
    dessiner(f) {
      const table = [
        ['soleil', ['lion'], ['belier'], ['verseau'], ['balance']],
        ['lune', ['cancer'], ['taureau'], ['capricorne'], ['scorpion']],
        ['mercure', ['gemeaux', 'vierge'], ['vierge'], ['sagittaire', 'poissons'], ['poissons']],
        ['venus', ['taureau', 'balance'], ['poissons'], ['scorpion', 'belier'], ['vierge']],
        ['mars', ['belier', 'scorpion'], ['capricorne'], ['balance', 'taureau'], ['cancer']],
        ['jupiter', ['sagittaire', 'poissons'], ['cancer'], ['gemeaux', 'vierge'], ['capricorne']],
        ['saturne', ['capricorne', 'verseau'], ['balance'], ['cancer', 'lion'], ['belier']],
      ];
      const colonnes = [['Domicile', 118], ['Exaltation', 188], ['Exil', 252], ['Chute', 318]];
      for (const [titre, x] of colonnes) f.texte(x, 14, titre, { t: 8.6, c: 'f-texte-doux' });
      table.forEach(([p, ...cases], i) => {
        const y = 28 + i * 34;
        f.rect(4, y, 352, 30, 6, i % 2 ? 'f-case-claire' : 'f-case');
        f.glyphe(p, 22, y + 15, 18, 'f-glyphe-accent');
        f.texte(38, y + 15, parPlanete.get(p).nom, { t: 9.8, a: 'start', b: true });
        cases.forEach((signes, k) => {
          const x = colonnes[k][1];
          signes.forEach((s, j) => f.glyphe(s, x + (signes.length === 1 ? 0 : (j === 0 ? -11 : 11)), y + 15, 16, k < 2 ? 'f-glyphe' : 'f-glyphe-doux'));
        });
      });
    },
  };

  // ── L'heptagramme des jours ───────────────────────────────────────────────

  F['heptagramme-planetes'] = {
    titre: 'L’heptagramme des planètes et des jours',
    hauteur: 330,
    legende: 'Autour du cercle, les planètes dans l’ordre chaldéen ; en suivant l’étoile, on retrouve l’ordre des jours de la semaine : dimanche, lundi, mardi…',
    dessiner(f) {
      const cx = 180;
      const cy = 160;
      const r = 118;
      const points = PLANETES.map((p, i) => f.polaire(cx, cy, r, i * (360 / 7)));
      f.cercle(cx, cy, r, 'f-trait-doux');
      // L'étoile {7/3} : on saute de trois en trois
      const ordre = [];
      let k = 3;
      for (let i = 0; i < 7; i += 1) { ordre.push(points[k]); k = (k + 3) % 7; }
      f.poly(ordre, 'f-etoile-trait');
      PLANETES.forEach((p, i) => {
        const [x, y] = points[i];
        f.cercle(x, y, 15, 'f-fond-page-trait');
        f.glyphe(p.id, x, y, 19, 'f-glyphe-accent');
        const [lx, ly] = f.polaire(cx, cy, r + 30, i * (360 / 7));
        f.texte(lx, ly, p.jour, { t: 9.2, c: 'f-texte-doux', i: true });
      });
      f.texte(cx, 318, 'Soleil → Lune → Mars → Mercure → Jupiter → Vénus → Saturne', { t: 8.6, c: 'f-texte-accent' });
    },
  };

  racine.FiguresDonnees = Object.assign(racine.FiguresDonnees || {}, { SIGNES, PLANETES });

})(window);
