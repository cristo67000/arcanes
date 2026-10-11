'use strict';
/*
 * Figures de la kabbale et des nombres : l'arbre des séphiroth, l'alphabet
 * hébreu, les quatre mondes, la tétractys, le carré de Saturne.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  // ── L'arbre des séphiroth ─────────────────────────────────────────────────

  /* Disposition classique, vue de face : la colonne de la miséricorde à droite
   * (Hokhmah, Hesed, Netsah), celle de la rigueur à gauche. */
  const SEPHIROTH = [
    { id: 'keter', nom: 'Keter', sens: 'Couronne', x: 180, y: 36 },
    { id: 'hokhmah', nom: 'Hokhmah', sens: 'Sagesse', x: 290, y: 88 },
    { id: 'binah', nom: 'Binah', sens: 'Intelligence', x: 70, y: 88 },
    { id: 'daat', nom: 'Daat', sens: 'Connaissance', x: 180, y: 136, cachee: true },
    { id: 'hesed', nom: 'Hesed', sens: 'Grâce', x: 290, y: 184 },
    { id: 'gueboura', nom: 'Gueboura', sens: 'Rigueur', x: 70, y: 184 },
    { id: 'tiferet', nom: 'Tiferet', sens: 'Beauté', x: 180, y: 232 },
    { id: 'netsah', nom: 'Netsah', sens: 'Victoire', x: 290, y: 292 },
    { id: 'hod', nom: 'Hod', sens: 'Splendeur', x: 70, y: 292 },
    { id: 'yesod', nom: 'Yesod', sens: 'Fondement', x: 180, y: 338 },
    { id: 'malkhout', nom: 'Malkhout', sens: 'Royauté', x: 180, y: 408 },
  ];
  /* Les vingt-deux sentiers, dans l'ordre des lettres (alef → tav). */
  const SENTIERS = [
    ['keter', 'hokhmah'], ['keter', 'binah'], ['keter', 'tiferet'], ['hokhmah', 'binah'],
    ['hokhmah', 'tiferet'], ['hokhmah', 'hesed'], ['binah', 'tiferet'], ['binah', 'gueboura'],
    ['hesed', 'gueboura'], ['hesed', 'tiferet'], ['hesed', 'netsah'], ['gueboura', 'tiferet'],
    ['gueboura', 'hod'], ['tiferet', 'netsah'], ['tiferet', 'yesod'], ['tiferet', 'hod'],
    ['netsah', 'hod'], ['netsah', 'yesod'], ['netsah', 'malkhout'], ['hod', 'yesod'],
    ['hod', 'malkhout'], ['yesod', 'malkhout'],
  ];
  const parId = new Map(SEPHIROTH.map((s) => [s.id, s]));

  F['arbre-sephiroth'] = {
    titre: 'L’arbre des séphiroth',
    hauteur: 462,
    cles: SEPHIROTH.map((s) => s.id),
    legende: (arg) => (arg
      ? parId.get(arg).nom + ' (' + parId.get(arg).sens.toLowerCase() + ') sur l’arbre des séphiroth. Touchez une séphira pour lire son article.'
      : 'Les dix séphiroth en trois colonnes, reliées par les vingt-deux sentiers. Touchez une séphira pour lire son article.'),
    dessiner(f, arg) {
      const R = 27;
      // Les sentiers d'abord, sous les cercles
      f.dans('f-sentiers', () => {
        for (const [a, b] of SENTIERS) {
          const p = parId.get(a);
          const q = parId.get(b);
          f.trait(p.x, p.y, q.x, q.y, 'f-sentier' + (arg && (a === arg || b === arg) ? ' f-sentier-actif' : ''));
        }
      });
      // Les trois colonnes, légendées en bas
      f.texte(70, 450, 'Rigueur', { t: 9.5, c: 'f-texte-doux', i: true });
      f.texte(180, 450, 'Équilibre', { t: 9.5, c: 'f-texte-doux', i: true });
      f.texte(290, 450, 'Miséricorde', { t: 9.5, c: 'f-texte-doux', i: true });
      for (const s of SEPHIROTH) {
        const actif = s.id === arg;
        const groupe = f.dans('f-noeud' + (actif ? ' f-noeud-actif' : ''), () => {
          f.cercle(s.x, s.y, R, s.cachee ? 'f-sephira f-cachee' : 'f-sephira' + (actif ? ' f-actif' : ''));
          f.texte(s.x, s.y - 4, s.nom, { t: 10, b: true, c: actif ? 'f-texte-actif' : 'f-texte' });
          f.texte(s.x, s.y + 9, s.sens, { t: 7.2, c: actif ? 'f-texte-actif' : 'f-texte-doux' });
        });
        f.lien(groupe, s.id, s.nom + ', ' + s.sens);
      }
    },
  };

  // ── Les quatre mondes ─────────────────────────────────────────────────────

  F['quatre-mondes'] = {
    titre: 'Les quatre mondes de la kabbale',
    hauteur: 268,
    legende: 'Du plus proche de Dieu au plus proche de nous, chaque monde répond à une lettre du Tétragramme (lu de haut en bas : י ה ו ה).',
    dessiner(f) {
      const mondes = [
        ['Atsilout', 'monde de l’émanation — les séphiroth', 'י', 'Yod'],
        ['Beria', 'monde de la création — le Trône', 'ה', 'Hé'],
        ['Yetsira', 'monde de la formation — les anges', 'ו', 'Vav'],
        ['Assiya', 'monde de l’action — le monde sensible', 'ה', 'Hé'],
      ];
      mondes.forEach(([nom, sens, lettre, nomLettre], i) => {
        const y = 14 + i * 62;
        const marge = i * 14;
        f.rect(70 + marge, y, 276 - 2 * marge, 52, 10, 'f-boite' + (i === 0 ? ' f-boite-forte' : ''));
        f.texte(208, y + 18, nom, { t: 13, b: true, serif: true });
        f.texte(208, y + 36, sens, { t: 9, c: 'f-texte-doux', max: 230 - 2 * marge });
        f.texte(34, y + 22, lettre, { t: 24, c: 'f-hebreu' });
        f.texte(34, y + 44, nomLettre, { t: 8.5, c: 'f-texte-doux' });
      });
      f.fleche(355, 30, 355, 245, 'f-trait-doux');
    },
  };

  // ── L'alphabet hébreu ─────────────────────────────────────────────────────

  const LETTRES = [
    ['א', 'Alef', 1, 'M'], ['ב', 'Bet', 2, 'D'], ['ג', 'Guimel', 3, 'D'], ['ד', 'Dalet', 4, 'D'],
    ['ה', 'Hé', 5, 'S'], ['ו', 'Vav', 6, 'S'], ['ז', 'Zayin', 7, 'S'], ['ח', 'Het', 8, 'S'],
    ['ט', 'Tet', 9, 'S'], ['י', 'Yod', 10, 'S'], ['כ', 'Kaf', 20, 'D'], ['ל', 'Lamed', 30, 'S'],
    ['מ', 'Mem', 40, 'M'], ['נ', 'Noun', 50, 'S'], ['ס', 'Samekh', 60, 'S'], ['ע', 'Ayin', 70, 'S'],
    ['פ', 'Pé', 80, 'D'], ['צ', 'Tsadé', 90, 'S'], ['ק', 'Qof', 100, 'S'], ['ר', 'Resh', 200, 'D'],
    ['ש', 'Shin', 300, 'M'], ['ת', 'Tav', 400, 'D'],
  ];
  const CLASSES = { M: 'mère', D: 'double', S: 'simple' };

  F['alphabet-hebreu'] = {
    titre: 'Les vingt-deux lettres hébraïques',
    hauteur: 330,
    legende: 'Chaque lettre, son nom, sa valeur numérique (gématrie) et sa classe selon le Sefer Yetsirah : 3 mères, 7 doubles, 12 simples.',
    dessiner(f) {
      const colonnes = [8, 184];
      f.texte(180, 12, 'mère · double · simple', { t: 8.5, c: 'f-texte-doux', i: true });
      LETTRES.forEach(([lettre, nom, valeur, classe], i) => {
        const col = i < 11 ? 0 : 1;
        const ligne = i % 11;
        const x = colonnes[col];
        const y = 26 + ligne * 27.5;
        f.rect(x, y, 168, 24, 6, 'f-case' + (classe === 'M' ? ' f-case-forte' : (classe === 'D' ? ' f-case-moyenne' : '')));
        f.texte(x + 20, y + 12, lettre, { t: 17, c: 'f-hebreu' });
        f.texte(x + 42, y + 12, nom, { t: 10.5, a: 'start', b: true });
        f.texte(x + 112, y + 12, String(valeur), { t: 10, a: 'end', c: 'f-texte-accent' });
        f.texte(x + 160, y + 12, CLASSES[classe], { t: 8.5, a: 'end', c: 'f-texte-doux', i: true });
      });
    },
  };

  // ── La tétractys ──────────────────────────────────────────────────────────

  F.tetractys = {
    titre: 'La tétractys',
    hauteur: 240,
    legende: 'Dix points en quatre rangées : 1 + 2 + 3 + 4 = 10, la décade parfaite des pythagoriciens.',
    dessiner(f) {
      const cx = 120;
      const pas = 34;
      const sens = ['la monade, le point', 'la dyade, la ligne', 'la triade, la surface', 'la tétrade, le volume'];
      for (let rangee = 0; rangee < 4; rangee += 1) {
        const y = 32 + rangee * pas * 0.92 * 1.25;
        for (let k = 0; k <= rangee; k += 1) {
          const x = cx + (k - rangee / 2) * pas;
          f.cercle(x, y, 9, 'f-point');
        }
        f.texte(232, y, (rangee + 1) + ' — ' + sens[rangee], { t: 9.5, a: 'start', c: 'f-texte-doux' });
      }
      f.poly([[cx, 12], [cx + 2.1 * pas, 32 + 3 * pas * 1.15 + 20], [cx - 2.1 * pas, 32 + 3 * pas * 1.15 + 20]], 'f-trait-doux');
      f.texte(180, 222, '1 + 2 + 3 + 4 = 10   ·   2 : 1 octave   ·   3 : 2 quinte   ·   4 : 3 quarte', { t: 9, c: 'f-texte-accent' });
    },
  };

  // ── Le carré de Saturne ───────────────────────────────────────────────────

  F['sceau-de-saturne'] = {
    titre: 'Le carré magique de Saturne',
    hauteur: 240,
    legende: 'Le carré de Saturne de Corneille Agrippa : chaque ligne, chaque colonne et chaque diagonale font 15 ; le total, 45, est la valeur des noms de l’intelligence et de l’esprit de Saturne.',
    dessiner(f) {
      const nombres = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
      const c = 56;
      const x0 = 96;
      const y0 = 30;
      f.glyphe('saturne', 50, 40, 30, 'f-glyphe-accent');
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          f.rect(x0 + j * c, y0 + i * c, c, c, 0, 'f-case');
          f.texte(x0 + j * c + c / 2, y0 + i * c + c / 2, String(nombres[i][j]), { t: 24, serif: true });
        }
        f.texte(x0 + 3 * c + 18, y0 + i * c + c / 2, '= 15', { t: 10, a: 'start', c: 'f-texte-accent' });
        f.texte(x0 + i * c + c / 2, y0 + 3 * c + 14, '15', { t: 10, c: 'f-texte-accent' });
      }
      f.trait(x0, y0, x0 + 3 * c, y0 + 3 * c, 'f-trait-pointille');
      f.trait(x0 + 3 * c, y0, x0, y0 + 3 * c, 'f-trait-pointille');
      f.texte(180, 228, 'Total : 1 + 2 + … + 9 = 45', { t: 9.5, c: 'f-texte-doux' });
    },
  };

})(window);
