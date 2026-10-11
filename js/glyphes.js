'use strict';
/*
 * Les signes : planètes, signes du zodiaque, éléments, principes alchimiques.
 *
 * Pourquoi les dessiner plutôt que d'écrire ☉ ☽ ♈ ? Parce que ces caractères
 * ne s'affichent pas partout de la même façon : un téléphone en montre
 * certains en émoji colorés (♈ devient un carré violet), un autre n'a pas la
 * police qui les contient et affiche un rectangle vide. Dessinés au trait,
 * dans une boîte de 24 × 24, ils sont nets à toutes les tailles, prennent la
 * couleur du thème et ne dépendent d'aucune police.
 *
 * Chaque signe : `d`, le tracé (trait sans remplissage), et `pts`, des points
 * pleins [x, y, rayon] — le point central du Soleil, par exemple.
 *
 * Ce fichier est aussi lu par build/construire.mjs, qui vérifie que chaque
 * « glyphe: » des articles existe ici : pas de `document` au chargement.
 */
(function (racine) {

  const CERCLE = (cx, cy, r) => 'M' + (cx + r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 1-' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 1 ' + (2 * r) + ' 0Z';

  const G = {
    // ── Planètes ────────────────────────────────────────────────────────────
    soleil: { nom: 'Soleil', d: CERCLE(12, 12, 8), pts: [[12, 12, 1.7]] },
    lune: { nom: 'Lune', d: 'M7 3.5A9 9 0 1 1 7 20.5A8.5 8.5 0 0 0 7 3.5Z' },
    mercure: { nom: 'Mercure', d: 'M8 2.5A4 4 0 0 0 16 2.5' + CERCLE(12, 11.2, 4) + 'M12 15.2V22M8.8 18.6H15.2' },
    venus: { nom: 'Vénus', d: CERCLE(12, 8.5, 5.2) + 'M12 13.7V22M8.4 18H15.6' },
    terre: { nom: 'Terre', d: CERCLE(12, 12, 8) + 'M12 4V20M4 12H20' },
    mars: { nom: 'Mars', d: CERCLE(9.5, 14.5, 5.5) + 'M13.4 10.6L20 4M14.6 4H20V9.4' },
    jupiter: { nom: 'Jupiter', d: 'M5 7.5C5 4 10.2 3 11 6.6C11.8 10.2 7.2 13.8 5 16.2H19.5M15.5 4V21.5' },
    saturne: { nom: 'Saturne', d: 'M8 2.5V14.5M5 6H11M8 10.8C9.5 8.2 15 8.2 15 12.2C15 15.2 12.5 16.2 12.5 19C12.5 20.8 13.8 21.5 15.6 20.7' },
    uranus: { nom: 'Uranus', d: 'M6.5 4V15M17.5 4V15M6.5 9.5H17.5M12 4.5V17' + CERCLE(12, 19.4, 2.2) },
    neptune: { nom: 'Neptune', d: 'M5.5 4.5C5.5 12 18.5 12 18.5 4.5M12 3V21.5M8.5 17.5H15.5M4.3 6.4L5.5 4.5L6.7 6.4M17.3 6.4L18.5 4.5L19.7 6.4M10.8 4.9L12 3L13.2 4.9' },
    pluton: { nom: 'Pluton', d: CERCLE(12, 5.2, 2.4) + 'M6.3 6.2A5.7 5.7 0 0 0 17.7 6.2M12 11.9V21.8M8.6 17.2H15.4' },

    // ── Signes du zodiaque ──────────────────────────────────────────────────
    belier: { nom: 'Bélier', d: 'M12 21V10M12 10C12 4.5 4 3 4.5 8.5M12 10C12 4.5 20 3 19.5 8.5' },
    taureau: { nom: 'Taureau', d: CERCLE(12, 15, 5.5) + 'M4 4C5.5 10.5 18.5 10.5 20 4' },
    gemeaux: { nom: 'Gémeaux', d: 'M5 4.5C9 6 15 6 19 4.5M5 19.5C9 18 15 18 19 19.5M9 5.6V18.4M15 5.6V18.4' },
    cancer: { nom: 'Cancer', d: CERCLE(7, 9.5, 2.5) + 'M7 7C10.5 4.2 16.5 4.2 20 7.5' + CERCLE(17, 14.5, 2.5) + 'M17 17C13.5 19.8 7.5 19.8 4 16.5' },
    lion: { nom: 'Lion', d: CERCLE(7.5, 15.5, 3) + 'M10.1 14C8 9 9.6 3.8 14 3.8C18.5 3.8 19.2 8.5 17 12.5C15 16 15.2 19.5 19.5 20' },
    vierge: { nom: 'Vierge', d: 'M3.5 6.5V18M3.5 9.5C3.5 5 8.5 5 8.5 9.5V18M8.5 9.5C8.5 5 13.5 5 13.5 9.5V17M13.5 13C14.5 8.5 20 8.5 19.5 12.5C19 16 15.5 18 12.5 21' },
    balance: { nom: 'Balance', d: 'M3 19.5H21M3 15H8.2C6.3 12.8 6.8 7.5 12 7.5C17.2 7.5 17.7 12.8 15.8 15H21' },
    scorpion: { nom: 'Scorpion', d: 'M3 6.5V17.5M3 9.5C3 5 8 5 8 9.5V17.5M8 9.5C8 5 13 5 13 9.5V17C13 19 14.5 20 16.5 19L20 16.8M17 15.2L20.2 16.6L19.4 20' },
    sagittaire: { nom: 'Sagittaire', d: 'M4.5 19.5L19.5 4.5M12 4.5H19.5V12M7.5 11L13 16.5' },
    capricorne: { nom: 'Capricorne', d: 'M3.5 5.5L7.5 17L11 5.5V15.5C11 19.5 14 21 16.5 19.5C19.5 17.8 19.5 13 16.5 12.2C13.5 11.5 11 14 11 15.5' },
    verseau: { nom: 'Verseau', d: 'M3 10L6.5 6.8L10 10L13.5 6.8L17 10L20.5 6.8M3 17.2L6.5 14L10 17.2L13.5 14L17 17.2L20.5 14' },
    poissons: { nom: 'Poissons', d: 'M6.5 3.5C11 8 11 16 6.5 20.5M17.5 3.5C13 8 13 16 17.5 20.5M5 12H19' },

    // ── Éléments et principes ───────────────────────────────────────────────
    feu: { nom: 'Feu', d: 'M12 4L20.5 19H3.5Z' },
    air: { nom: 'Air', d: 'M12 4L20.5 19H3.5ZM6.7 13.5H17.3' },
    eau: { nom: 'Eau', d: 'M12 20L20.5 5H3.5Z' },
    'terre-element': { nom: 'Terre', d: 'M12 20L20.5 5H3.5ZM6.7 10.5H17.3' },
    soufre: { nom: 'Soufre', d: 'M12 3L18 13H6ZM12 13V21.5M8.5 17.5H15.5' },
    sel: { nom: 'Sel', d: CERCLE(12, 12, 8) + 'M4 12H20' },
    antimoine: { nom: 'Antimoine', d: CERCLE(12, 15, 6) + 'M12 9V2.5M8.8 5.6H15.2' },

    // ── Figures ─────────────────────────────────────────────────────────────
    pentagramme: { nom: 'Pentagramme', d: 'M12 3.5L17.29 19.78L3.44 9.72H20.56L6.71 19.78Z' },
    hexagramme: { nom: 'Hexagramme', d: 'M12 3L19.79 16.5H4.21ZM12 21L19.79 7.5H4.21Z' },
    ankh: { nom: 'Croix ansée', d: 'M12 11C8.5 9 8.3 3 12 3C15.7 3 15.5 9 12 11ZM12 11V21.5M6.5 12.2H17.5' },
  };

  /* Les signes du zodiaque dans l'ordre, et les planètes dans l'ordre
   * chaldéen : les figures s'en servent. */
  const SIGNES = ['belier', 'taureau', 'gemeaux', 'cancer', 'lion', 'vierge', 'balance', 'scorpion',
    'sagittaire', 'capricorne', 'verseau', 'poissons'];
  const PLANETES = ['saturne', 'jupiter', 'mars', 'soleil', 'venus', 'mercure', 'lune'];

  /* Un signe en SVG, autonome (pour la liste et la fiche). */
  function svg(nom, classe) {
    const g = G[nom];
    if (!g || !racine.Outils) return null;
    const s = Outils.svg('svg', { viewBox: '0 0 24 24', class: 'glyphe' + (classe ? ' ' + classe : ''), 'aria-hidden': 'true', focusable: 'false' });
    remplir(s, g);
    return s;
  }

  /* Un signe posé dans un dessin plus grand : centré sur (x, y), de côté
   * `taille`. L'épaisseur du trait reste celle du dessin, quelle que soit la
   * taille, grâce à `vector-effect` (voir figure.css). */
  function poser(parent, nom, x, y, taille, classe) {
    const g = G[nom];
    if (!g) return null;
    const e = taille / 24;
    const groupe = Outils.svg('g', {
      class: 'glyphe-pose' + (classe ? ' ' + classe : ''),
      transform: 'translate(' + (x - taille / 2).toFixed(2) + ' ' + (y - taille / 2).toFixed(2) + ') scale(' + e.toFixed(4) + ')',
    });
    remplir(groupe, g);
    parent.appendChild(groupe);
    return groupe;
  }

  function remplir(parent, g) {
    parent.appendChild(Outils.svg('path', { d: g.d, class: 'glyphe-trait' }));
    for (const [x, y, r] of g.pts || []) parent.appendChild(Outils.svg('circle', { cx: x, cy: y, r, class: 'glyphe-point' }));
  }

  racine.Glyphes = G;
  Object.defineProperty(G, 'svg', { value: svg, enumerable: false });
  Object.defineProperty(G, 'poser', { value: poser, enumerable: false });
  Object.defineProperty(G, 'SIGNES', { value: SIGNES, enumerable: false });
  Object.defineProperty(G, 'PLANETES', { value: PLANETES, enumerable: false });

})(window);
