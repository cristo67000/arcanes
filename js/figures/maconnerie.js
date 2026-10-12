'use strict';
/*
 * Figures de la franc-maçonnerie : le plan d'une loge, et les rites avec le
 * nombre de leurs grades.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  // ── Le plan d'une loge ────────────────────────────────────────────────────

  /* Vue de dessus, l'Orient en haut : en regardant vers l'Orient, le
   * Septentrion (nord) est à gauche, le Midi à droite. La disposition est
   * celle du Rite français ; la légende dit ce qui change ailleurs. */
  F['plan-de-loge'] = {
    titre: 'Le plan d’une loge',
    hauteur: 432,
    cles: ['orient', 'venerable', 'officiers', 'surveillants', 'colonnes', 'pierres', 'pave', 'tableau', 'houppe'],
    legende: 'Plan schématique d’une loge au Rite français, l’Orient en haut et l’entrée à l’Occident. Au Rite écossais ancien et accepté, les colonnes J et B sont inversées ; dans les rites issus des « Anciens » anglais, le Second Surveillant siège au Midi. Touchez un élément pour lire son article.',
    dessiner(f, arg) {
      const X0 = 34;
      const X1 = 326;
      const Y0 = 24;
      const Y1 = 404;
      const PORTE = [160, 200];
      const est = (cle) => cle === arg;
      const boite = (cle) => (est(cle) ? 'f-actif' : 'f-boite-forte');
      const ecrit = (cle) => (est(cle) ? 'f-texte-actif' : 'f-texte');

      // Les points cardinaux
      f.texte(180, 11, 'ORIENT', { t: 9, b: true, c: 'f-texte-accent' });
      f.texte(180, 421, 'OCCIDENT', { t: 9, b: true, c: 'f-texte-accent' });
      f.texte(14, 214, 'SEPTENTRION', { t: 9, b: true, c: 'f-texte-accent', rot: -90 });
      f.texte(346, 214, 'MIDI', { t: 9, b: true, c: 'f-texte-accent', rot: 90 });

      // Les murs, ouverts sur la porte
      f.rect(X0, Y0, X1 - X0, Y1 - Y0, 0, 'f-fond-page');
      f.chemin('M' + PORTE[0] + ' ' + Y1 + 'H' + X0 + 'V' + Y0 + 'H' + X1 + 'V' + Y1 + 'H' + PORTE[1], 'f-mur');

      // L'Orient : l'estrade et ses trois marches
      const orient = f.dans('f-zone', () => {
        f.rect(X0 + 2, Y0 + 2, X1 - X0 - 4, 82, 2, est('orient') ? 'f-case-forte' : 'f-case-moyenne');
        for (let i = 0; i < 3; i += 1) f.rect(150 - i * 8, Y0 + 84 + i * 5, 60 + i * 16, 5, 1, 'f-marche');
      });
      f.lien(orient, 'orient', 'L’Orient');

      // Le delta lumineux
      const delta = f.dans('f-zone', () => {
        f.poly([[180, Y0 + 7], [192, Y0 + 27], [168, Y0 + 27]], 'f-delta');
        f.cercle(180, Y0 + 20, 2.2, 'f-point-accent');
      });
      f.lien(delta, 'oeil-de-la-providence', 'Le delta lumineux');

      // Le Vénérable, puis les officiers de l'Orient
      const ven = f.dans('f-zone', () => {
        f.rect(140, Y0 + 34, 80, 24, 5, boite('venerable'));
        f.texte(180, Y0 + 46, 'Vénérable', { t: 10, b: true, c: ecrit('venerable') });
      });
      f.lien(ven, 'venerable-maitre', 'Le Vénérable Maître');
      const offs = f.dans('f-zone', () => {
        f.rect(98, Y0 + 63, 164, 16, 4, est('officiers') ? 'f-actif' : 'f-case-claire');
        f.texte(180, Y0 + 71, 'orateur, secrétaire, invités', { t: 8.6, i: true, c: ecrit('officiers') });
      });
      f.lien(offs, 'officiers-de-loge', 'Les officiers de l’Orient');

      // La houppe dentelée, corde à nœuds qui fait le tour du temple
      const houppe = f.dans('f-zone', () => {
        const m = 7;
        f.chemin('M' + (PORTE[0] - 6) + ' ' + (Y1 - m) + 'H' + (X0 + m) + 'V' + (Y0 + m) + 'H' + (X1 - m) + 'V' + (Y1 - m) + 'H' + (PORTE[1] + 6),
          est('houppe') ? 'f-houppe f-houppe-active' : 'f-houppe');
        const noeuds = [[X0 + m, Y0 + 120], [X0 + m, Y0 + 220], [X0 + m, Y0 + 320], [X1 - m, Y0 + 120], [X1 - m, Y0 + 220], [X1 - m, Y0 + 320],
          [X0 + 80, Y0 + m], [X1 - 80, Y0 + m]];
        for (const [x, y] of noeuds) f.cercle(x, y, 2.6, 'f-noeud-houppe');
        f.cercle(PORTE[0] - 6, Y1 - m, 3.4, 'f-noeud-houppe');
        f.cercle(PORTE[1] + 6, Y1 - m, 3.4, 'f-noeud-houppe');
      });
      f.lien(houppe, 'chaine-d-union', 'La houppe dentelée');

      // La pierre brute et la pierre cubique, au pied de l'estrade
      const brute = f.dans('f-zone', () => {
        f.poly([[97, Y0 + 107], [104, Y0 + 99], [111, Y0 + 101], [118, Y0 + 96], [127, Y0 + 104], [124, Y0 + 113], [127, Y0 + 119], [113, Y0 + 122], [105, Y0 + 118], [99, Y0 + 119]], 'f-pierre');
        f.texte(112, Y0 + 132, 'pierre brute', { t: 8.4, c: 'f-texte-doux' });
        if (est('pierres')) f.cercle(112, Y0 + 110, 19, 'f-halo');
      });
      f.lien(brute, 'pierre-brute', 'La pierre brute');
      const cubique = f.dans('f-zone', () => {
        f.poly([[238, Y0 + 104], [248, Y0 + 99], [258, Y0 + 104], [248, Y0 + 109]], 'f-pierre-claire');
        f.poly([[238, Y0 + 104], [248, Y0 + 109], [248, Y0 + 121], [238, Y0 + 116]], 'f-pierre');
        f.poly([[248, Y0 + 109], [258, Y0 + 104], [258, Y0 + 116], [248, Y0 + 121]], 'f-pierre-sombre');
        f.texte(248, Y0 + 132, 'pierre cubique', { t: 8.4, c: 'f-texte-doux' });
        if (est('pierres')) f.cercle(248, Y0 + 110, 19, 'f-halo');
      });
      f.lien(cubique, 'pierre-cubique', 'La pierre cubique');

      // Les colonnes des frères : apprentis au nord, compagnons au midi
      const nord = f.dans('f-zone', () => {
        f.rect(X0 + 15, Y0 + 146, 30, 170, 4, 'f-case');
        f.texte(X0 + 30, Y0 + 231, 'apprentis', { t: 9, i: true, c: 'f-texte-doux', rot: -90 });
      });
      f.lien(nord, 'apprenti', 'La colonne du Septentrion, celle des apprentis');
      const sud = f.dans('f-zone', () => {
        f.rect(X1 - 45, Y0 + 146, 30, 170, 4, 'f-case');
        f.texte(X1 - 30, Y0 + 231, 'compagnons', { t: 9, i: true, c: 'f-texte-doux', rot: 90 });
      });
      f.lien(sud, 'compagnon', 'La colonne du Midi, celle des compagnons');

      // Le pavé mosaïque, et le tableau de loge posé dessus
      const pave = f.dans('f-zone', () => {
        const c = 20;
        const x0 = 130;
        const y0 = Y0 + 148;
        for (let i = 0; i < 5; i += 1) {
          for (let j = 0; j < 8; j += 1) f.rect(x0 + i * c, y0 + j * c, c, c, 0, (i + j) % 2 ? 'f-damier-noir' : 'f-damier-blanc');
        }
        f.rect(x0, y0, 5 * c, 8 * c, 0, 'f-trait-doux');
        if (est('pave')) f.rect(x0 - 5, y0 - 5, 5 * c + 10, 8 * c + 10, 4, 'f-halo');
      });
      f.lien(pave, 'pave-mosaique', 'Le pavé mosaïque');
      const tableau = f.dans('f-zone', () => {
        f.rect(152, Y0 + 210, 56, 36, 3, est('tableau') ? 'f-actif' : 'f-fond-page-trait');
        f.texte(180, Y0 + 228, ['tableau', 'de loge'], { t: 8.6, c: ecrit('tableau'), lh: 10 });
      });
      f.lien(tableau, 'tableau-de-loge', 'Le tableau de loge');

      // L'Occident : les Surveillants, le couvreur, les deux colonnes
      const surv = f.dans('f-zone', () => {
        f.rect(X0 + 16, Y1 - 64, 82, 30, 5, boite('surveillants'));
        f.texte(X0 + 57, Y1 - 49, ['Premier', 'Surveillant'], { t: 9, b: true, c: ecrit('surveillants'), lh: 10.5 });
        f.rect(X1 - 98, Y1 - 64, 82, 30, 5, boite('surveillants'));
        f.texte(X1 - 57, Y1 - 49, ['Second', 'Surveillant'], { t: 9, b: true, c: ecrit('surveillants'), lh: 10.5 });
      });
      f.lien(surv, 'surveillants', 'Les deux Surveillants');
      const couvreur = f.dans('f-zone', () => {
        f.rect(150, Y1 - 44, 60, 16, 4, est('officiers') ? 'f-actif' : 'f-case-claire');
        f.texte(180, Y1 - 36, 'couvreur', { t: 8.6, i: true, c: ecrit('officiers') });
      });
      f.lien(couvreur, 'officiers-de-loge', 'Le couvreur, gardien de la porte');
      const colonnes = f.dans('f-zone', () => {
        [['J', PORTE[0] - 18], ['B', PORTE[1] + 18]].forEach(([lettre, x]) => {
          f.cercle(x, Y1 - 12, 10, est('colonnes') ? 'f-actif' : 'f-colonne');
          f.texte(x, Y1 - 12, lettre, { t: 11, b: true, serif: true, c: est('colonnes') ? 'f-texte-actif' : 'f-texte' });
        });
      });
      f.lien(colonnes, 'colonnes-jakin-et-boaz', 'Les colonnes Jakin et Boaz');
      f.texte(180, Y1 - 11, 'porte', { t: 8.4, i: true, c: 'f-texte-doux' });
    },
  };

  // ── Les rites et leurs grades ─────────────────────────────────────────────

  /* [clé, nom, lieu et date, grades symboliques, hauts grades, remarque, article] */
  const RITES = [
    ['emulation', 'Rite Émulation', 'Londres, 1823', 3, 0, '+ Arche royale', 'rite-emulation'],
    ['schroder', 'Rite Schröder', 'Hambourg, 1801', 3, 0, '', 'rite-schroder'],
    ['francais', 'Rite français', 'Paris, 1786', 3, 4, 'ordres', 'rite-francais'],
    ['rectifie', 'Régime écossais rectifié', 'Lyon, 1778', 4, 2, '+ classe secrète', 'rite-ecossais-rectifie'],
    ['suedois', 'Rite suédois', 'Stockholm, 1800', 3, 7, '', 'rite-suedois'],
    ['ecossais', 'Rite écossais ancien et accepté', 'Charleston, 1801', 3, 30, '', 'rite-ecossais-ancien-et-accepte'],
    ['memphis', 'Memphis-Misraïm', 'Paris, 1881', 3, 96, 'jusqu’à', 'rite-de-memphis-misraim'],
  ];

  F['rites-maconniques'] = {
    titre: 'Les principaux rites maçonniques',
    hauteur: 352,
    cles: RITES.map((r) => r[0]),
    legende: (arg) => {
      const r = RITES.find((x) => x[0] === arg);
      return (r ? r[1] + ' parmi les principaux rites. ' : '')
        + 'Pour chaque rite, les grades symboliques (carrés) puis les hauts grades (barre, à échelle resserrée). Touchez un rite pour lire son article.';
    },
    dessiner(f, arg) {
      const H = 44;
      const Y = 26;
      f.texte(150, 12, 'grades bleus', { t: 8.4, a: 'start', c: 'f-texte-doux' });
      f.texte(216, 12, 'hauts grades', { t: 8.4, a: 'start', c: 'f-texte-doux' });
      RITES.forEach(([cle, nom, lieu, bleus, hauts, note, ref], i) => {
        const y = Y + i * H;
        const actif = cle === arg;
        const groupe = f.dans('f-ligne-table', () => {
          f.rect(2, y, 356, H - 5, 6, actif ? 'f-case-forte' : (i % 2 ? 'f-case-claire' : 'f-case'));
          const lignes = f.envelopper(nom, 134, 10);
          const haut = y + (H - 5) / 2 - (lignes.length * 11.5 + 10) / 2 + 7;
          f.texte(10, haut + ((lignes.length - 1) * 11.5) / 2, lignes, { t: 10, a: 'start', b: true, lh: 11.5, c: actif ? 'f-texte-accent' : 'f-texte' });
          f.texte(10, haut + lignes.length * 11.5 + 1, lieu, { t: 8.4, a: 'start', c: 'f-texte-doux' });
          const yc = y + (H - 5) / 2;
          for (let k = 0; k < bleus; k += 1) f.rect(150 + k * 15, yc - 6, 12, 12, 2, 'f-grade-bleu');
          let x = 216;
          if (hauts) {
            const l = Math.round(12 * Math.log2(1 + hauts));
            f.rect(x, yc - 6, l, 12, 3, actif ? 'f-actif' : 'f-grade-haut');
            x += l + 5;
            f.texte(x, yc, (note === 'jusqu’à' ? 'jusqu’à ' : '') + hauts + (note === 'ordres' ? ' ordres' : ''), { t: 9, a: 'start', b: true });
            x += f.largeur((note === 'jusqu’à' ? 'jusqu’à ' : '') + hauts + (note === 'ordres' ? ' ordres' : ''), 9) + 5;
            if (note && note !== 'jusqu’à' && note !== 'ordres') f.texte(x, yc, note, { t: 8.4, a: 'start', i: true, c: 'f-texte-doux' });
          } else if (note) {
            f.texte(x, yc, note, { t: 8.4, a: 'start', i: true, c: 'f-texte-doux' });
          }
        });
        f.lien(groupe, ref, nom);
      });
      f.texte(180, Y + RITES.length * H + 8, 'Le nombre des hauts grades varie selon les obédiences.', { t: 8.4, i: true, c: 'f-texte-doux' });
    },
  };

})(window);
