'use strict';
/*
 * Figures du tarot et de la divination : les arcanes majeurs, les arcanes
 * mineurs, les seize figures de la géomancie, les huit trigrammes du Yi King.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  /* Les arcanes majeurs, numérotés comme sur le tarot de Marseille. */
  const ARCANES = [
    ['I', 'Le Bateleur', 'arcane-bateleur'], ['II', 'La Papesse', 'arcane-papesse'],
    ['III', 'L’Impératrice', 'arcane-imperatrice'], ['IIII', 'L’Empereur', 'arcane-empereur'],
    ['V', 'Le Pape', 'arcane-pape'], ['VI', 'L’Amoureux', 'arcane-amoureux'],
    ['VII', 'Le Chariot', 'arcane-chariot'], ['VIII', 'La Justice', 'arcane-justice'],
    ['VIIII', 'L’Hermite', 'arcane-hermite'], ['X', 'La Roue de Fortune', 'arcane-roue-de-fortune'],
    ['XI', 'La Force', 'arcane-force'], ['XII', 'Le Pendu', 'arcane-pendu'],
    ['XIII', 'sans nom', 'arcane-sans-nom'], ['XIIII', 'Tempérance', 'arcane-temperance'],
    ['XV', 'Le Diable', 'arcane-diable'], ['XVI', 'La Maison Dieu', 'arcane-maison-dieu'],
    ['XVII', 'L’Étoile', 'arcane-etoile'], ['XVIII', 'La Lune', 'arcane-lune'],
    ['XVIIII', 'Le Soleil', 'arcane-soleil'], ['XX', 'Le Jugement', 'arcane-jugement'],
    ['XXI', 'Le Monde', 'arcane-monde'], ['', 'Le Mat', 'arcane-mat'],
  ];
  // la clé d'un arcane : son numéro (0 pour le Mat)
  const cle = (i) => (i === 21 ? '0' : String(i + 1));

  F['arcanes-majeurs'] = {
    titre: 'Les vingt-deux arcanes majeurs',
    hauteur: 332,
    cles: ARCANES.map((a, i) => cle(i)),
    legende: (arg) => {
      if (!arg) return 'Les vingt-deux arcanes majeurs dans l’ordre du tarot de Marseille, le Mat sans numéro à la fin. Touchez une carte pour lire son article.';
      const i = arg === '0' ? 21 : Number(arg) - 1;
      return ARCANES[i][1].replace(/^sans nom$/, 'L’arcane sans nom') + ' parmi les arcanes majeurs. Touchez une carte pour lire son article.';
    },
    dessiner(f, arg) {
      const colonnes = 6;
      const marge = 6;
      const ecart = 5;
      const w = (360 - 2 * marge - (colonnes - 1) * ecart) / colonnes;
      const h = 76;
      ARCANES.forEach(([num, nom, ref], i) => {
        const x = marge + (i % colonnes) * (w + ecart);
        const y = 6 + Math.floor(i / colonnes) * (h + 6);
        const actif = cle(i) === arg;
        const groupe = f.dans('f-carte', () => {
          f.rect(x, y, w, h, 5, actif ? 'f-actif' : 'f-carte-cadre');
          f.rect(x + 3, y + 3, w - 6, h - 6, 3, 'f-carte-interieur');
          f.texte(x + w / 2, y + 15, num || '—', { t: 9.5, serif: true, b: true, c: actif ? 'f-texte-actif' : 'f-texte-accent' });
          f.texte(x + w / 2, y + 45, nom, { t: 8.4, max: w - 8, c: actif ? 'f-texte-actif' : 'f-texte', lh: 9.6 });
        });
        f.lien(groupe, ref, nom === 'sans nom' ? 'L’arcane sans nom, XIII' : nom + (num ? ', ' + num : ''));
      });
    },
  };

  F['arcanes-mineurs'] = {
    titre: 'Les quatre enseignes des arcanes mineurs',
    hauteur: 248,
    legende: 'Les quatre enseignes du tarot, leurs éléments selon les occultistes, les couleurs du jeu français qui en descendent et les lettres du Tétragramme.',
    dessiner(f) {
      const lignes = [
        ['Bâtons', 'feu', 'Feu', 'trèfle', 'Yod'],
        ['Coupes', 'eau', 'Eau', 'cœur', 'Hé'],
        ['Épées', 'air', 'Air', 'pique', 'Vav'],
        ['Deniers', 'terre-element', 'Terre', 'carreau', 'Hé'],
      ];
      const x = [16, 128, 214, 300];
      f.texte(x[0], 14, 'Enseigne', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[1], 14, 'Élément', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[2], 14, 'Jeu français', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      f.texte(x[3], 14, 'Tétragramme', { t: 8.5, a: 'start', c: 'f-texte-doux' });
      lignes.forEach(([enseigne, g, el, francais, lettre], i) => {
        const y = 28 + i * 40;
        f.rect(4, y, 352, 34, 7, i % 2 ? 'f-case-claire' : 'f-case');
        f.texte(x[0], y + 17, enseigne, { t: 12, a: 'start', b: true, serif: true });
        f.glyphe(g, x[1] + 9, y + 17, 18, 'f-glyphe-accent');
        f.texte(x[1] + 24, y + 17, el, { t: 10, a: 'start' });
        f.texte(x[2], y + 17, francais, { t: 10, a: 'start' });
        f.texte(x[3], y + 17, lettre, { t: 10, a: 'start', c: 'f-texte-accent' });
      });
      f.texte(180, 210, 'Dans chaque enseigne : as, 2 à 10,', { t: 9.5, c: 'f-texte-doux' });
      f.texte(180, 226, 'valet, cavalier, reine et roi — 14 cartes, 56 en tout.', { t: 9.5, c: 'f-texte-doux' });
    },
  };

  // ── La géomancie ──────────────────────────────────────────────────────────

  /* De haut en bas : tête, cou, corps, pieds ; 1 = un point, 2 = deux points. */
  const GEOMANCIE = [
    ['Via', [1, 1, 1, 1]], ['Populus', [2, 2, 2, 2]], ['Conjunctio', [2, 1, 1, 2]], ['Carcer', [1, 2, 2, 1]],
    ['Fortuna major', [2, 2, 1, 1]], ['Fortuna minor', [1, 1, 2, 2]], ['Acquisitio', [2, 1, 2, 1]], ['Amissio', [1, 2, 1, 2]],
    ['Laetitia', [1, 2, 2, 2]], ['Tristitia', [2, 2, 2, 1]], ['Puella', [1, 2, 1, 1]], ['Puer', [1, 1, 2, 1]],
    ['Albus', [2, 2, 1, 2]], ['Rubeus', [2, 1, 2, 2]], ['Caput draconis', [2, 1, 1, 1]], ['Cauda draconis', [1, 1, 1, 2]],
  ];

  F['geomancie-figures'] = {
    titre: 'Les seize figures de la géomancie',
    hauteur: 352,
    legende: 'Chaque figure a quatre étages d’un ou deux points : seize combinaisons, chacune avec son nom latin et son sens.',
    dessiner(f) {
      const cw = 90;
      const ch = 86;
      GEOMANCIE.forEach(([nom, lignes], i) => {
        const x0 = (i % 4) * cw + cw / 2;
        const y0 = Math.floor(i / 4) * ch + 8;
        lignes.forEach((nb, k) => {
          const y = y0 + 8 + k * 13;
          if (nb === 1) f.cercle(x0, y, 3.6, 'f-point');
          else { f.cercle(x0 - 9, y, 3.6, 'f-point'); f.cercle(x0 + 9, y, 3.6, 'f-point'); }
        });
        f.texte(x0, y0 + 68, nom, { t: 8.6, i: true, max: cw - 6, lh: 9.5 });
      });
    },
  };

  // ── Les trigrammes du Yi King ─────────────────────────────────────────────

  /* De bas en haut : 1 = trait plein (yang), 0 = trait brisé (yin). */
  const TRIGRAMMES = [
    ['Qian', 'le Ciel', [1, 1, 1]], ['Dui', 'le Lac', [1, 1, 0]], ['Li', 'le Feu', [1, 0, 1]], ['Zhen', 'le Tonnerre', [1, 0, 0]],
    ['Xun', 'le Vent', [0, 1, 1]], ['Kan', 'l’Eau', [0, 1, 0]], ['Gen', 'la Montagne', [0, 0, 1]], ['Kun', 'la Terre', [0, 0, 0]],
  ];

  F.trigrammes = {
    titre: 'Les huit trigrammes du Yi King',
    hauteur: 238,
    legende: 'Trois traits, pleins (yang) ou brisés (yin), lus de bas en haut : huit trigrammes, qui se combinent deux à deux en soixante-quatre hexagrammes.',
    dessiner(f) {
      const cw = 90;
      TRIGRAMMES.forEach(([nom, sens, traits], i) => {
        const cx = (i % 4) * cw + cw / 2;
        const y0 = Math.floor(i / 4) * 116 + 14;
        traits.forEach((plein, k) => {
          const y = y0 + 44 - k * 15;
          if (plein) f.rect(cx - 26, y, 52, 8, 1.5, 'f-trait-plein');
          else { f.rect(cx - 26, y, 22, 8, 1.5, 'f-trait-plein'); f.rect(cx + 4, y, 22, 8, 1.5, 'f-trait-plein'); }
        });
        f.texte(cx, y0 + 72, nom, { t: 10.5, b: true });
        f.texte(cx, y0 + 86, sens, { t: 8.8, c: 'f-texte-doux', i: true });
      });
    },
  };

})(window);
