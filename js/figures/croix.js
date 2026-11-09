'use strict';
/*
 * Les croix : la planche de toutes les croix, chacune menant à son article ;
 * une croix en grand, en tête de son article (« schema: croix/malte ») ; les
 * croix des ordres de chevalerie, à leurs couleurs ; celles du blason ; et
 * l'acrostiche ΙΧΘΥΣ.
 *
 * Tout est dessiné ici, dans une boîte de −50 à +50 autour du centre : aucune
 * image à télécharger, et le trait reste net à toutes les tailles. Les croix
 * sans couleur attitrée prennent celles du thème ; celles d'un ordre ou d'un
 * drapeau gardent leurs émaux, de jour comme de nuit.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};
  const RAD = Math.PI / 180;

  // ── Les tracés ────────────────────────────────────────────────────────────

  /* Des rectangles [x, y, l, h] en un seul tracé. */
  const barres = (...rects) => rects.map(([x, y, l, h]) => 'M' + x + ' ' + y + 'h' + l + 'v' + h + 'h' + (-l) + 'Z').join('');

  /* Fait tourner et déplace un tracé écrit en commandes absolues M L Q C A Z. */
  function placer(d, { rot = 0, dx = 0, dy = 0, k = 1 } = {}) {
    const c = Math.cos(rot * RAD);
    const s = Math.sin(rot * RAD);
    const point = (x, y) => [
      Math.round((dx + k * (x * c - y * s)) * 100) / 100,
      Math.round((dy + k * (x * s + y * c)) * 100) / 100,
    ].join(' ');
    const jetons = d.match(/[MLQCAZ]|-?\d*\.?\d+/g);
    let sortie = '';
    for (let i = 0; i < jetons.length;) {
      const cmd = jetons[i];
      i += 1;
      sortie += cmd;
      if (cmd === 'Z') continue;
      if (cmd === 'A') {
        const [rx, ry, r, g, b, x, y] = jetons.slice(i, i + 7).map(Number);
        sortie += (rx * k) + ' ' + (ry * k) + ' ' + r + ' ' + g + ' ' + b + ' ' + point(x, y);
        i += 7;
        continue;
      }
      const paires = { M: 1, L: 1, Q: 2, C: 3 }[cmd];
      const pris = [];
      for (let j = 0; j < paires; j += 1) {
        pris.push(point(Number(jetons[i]), Number(jetons[i + 1])));
        i += 2;
      }
      sortie += pris.join(' ');
    }
    return sortie;
  }

  /* Un bras, dessiné vers le haut, reproduit aux quatre points cardinaux. */
  const quatre = (bras, o) => [0, 90, 180, 270].map((rot) => placer(bras, { rot, ...o })).join('');

  const LIS = 'M0 -18C-4 -12 -5 -8 -3 -3C-7 -9 -14 -8 -13 -2C-12 1 -8 1 -6 -1C-5 1 -3 2 -2 2L2 2C3 2 5 1 6 -1C8 1 12 1 13 -2C14 -8 7 -9 3 -3C5 -8 4 -12 0 -18Z';
  const BRAS_PATTE = 'M-3.5 0Q-6 -26 -24 -44L24 -44Q6 -26 3.5 0Z';
  const BRAS_MALTE = 'M0 0L-25 -46L0 -31L25 -46Z';
  const BRAS_COPTE = 'M-7 0L-7 -22L-18 -36L-6 -32L0 -48L6 -32L18 -36L7 -22L7 0Z';
  const BRAS_ANCRE = 'M-5 0L-5 -30Q-20 -30 -25 -45Q-10 -43 0 -37Q10 -43 25 -45Q20 -30 5 -30L5 0Z';
  const BRAS_MOLINE = 'M-5 0L-5 -24C-15 -24 -23 -33 -19 -45C-10 -45 -3 -39 0 -32C3 -39 10 -45 19 -45C23 -33 15 -24 5 -24L5 0Z';
  const BRAS_PATONNE = 'M-4 0Q-7 -22 -13 -32C-22 -32 -24 -44 -15 -44C-12 -50 -5 -50 -4 -44L4 -44C5 -50 12 -50 15 -44C24 -44 22 -32 13 -32Q7 -22 4 0Z';
  const BRAS_OCCITAN = 'M-3 0L-5 -15Q-23 -17 -23 -33Q-10 -33 -4.5 -27Q-3 -37 0 -42Q3 -37 4.5 -27Q10 -33 23 -33Q23 -17 5 -15L3 0Z';
  const POINTES_MALTE = [[-25, -46], [25, -46], [46, -25], [46, 25], [25, 46], [-25, 46], [-46, 25], [-46, -25]];

  /* Une croix se dessine avec `f` (déjà placé dans sa boîte) et ses classes :
   * c.p le plein, c.l le trait épais, c.v le vide (fond de la croix). */
  const lignes = (f, classe, ...segments) => segments.forEach(([x1, y1, x2, y2]) => f.trait(x1, y1, x2, y2, classe));

  const TRACES = {
    latine: (f, c) => f.chemin(barres([-6, -46, 12, 92], [-28, -26, 56, 12]), c.p),
    grecque: (f, c) => f.chemin(barres([-9, -40, 18, 80], [-40, -9, 80, 18]), c.p),
    'saint-andre': (f, c) => {
      const b = 'M-8 -56L8 -56L8 56L-8 56Z';
      f.chemin(placer(b, { rot: 45 }) + placer(b, { rot: -45 }), c.p);
    },
    tau: (f, c) => f.chemin(barres([-34, -40, 68, 14], [-7, -40, 14, 84]), c.p),
    'saint-pierre': (f, c) => f.chemin(barres([-6, -46, 12, 92], [-28, 14, 56, 12]), c.p),
    ansee: (f, c) => {
      f.ellipse(0, -28, 13, 18, c.l);
      f.chemin(barres([-6, -9, 12, 57], [-28, -8, 56, 11]), c.p);
    },
    lorraine: (f, c) => f.chemin(barres([-6, -48, 12, 96], [-18, -36, 36, 10], [-29, -12, 58, 10]), c.p),
    papale: (f, c) => f.chemin(barres([-5, -48, 10, 96], [-12, -40, 24, 8], [-20, -26, 40, 8], [-29, -12, 58, 8]), c.p),
    orthodoxe: (f, c) => f.chemin(barres([-5, -48, 10, 96], [-13, -38, 26, 8], [-28, -22, 56, 9]) + 'M-19 14L19 25L19 33L-19 22Z', c.p),
    armenienne: (f, c) => {
      const bout = 'M-5 0Q-18 -3 -15 -17Q-5 -17 0 -8Q5 -17 15 -17Q18 -3 5 0Z';
      f.chemin(barres([-5, -30, 10, 76], [-30, -20, 60, 10])
        + placer(bout, { dy: -30 }) + placer(bout, { rot: 90, dx: 30, dy: -15 }) + placer(bout, { rot: -90, dx: -30, dy: -15 })
        + placer(bout, { rot: 180, dy: 46, k: 0.7 }), c.p);
    },
    copte: (f, c) => {
      f.chemin(quatre(BRAS_COPTE), c.p);
      f.cercle(0, 0, 11, c.p);
      f.cercle(0, 0, 6, c.v);
    },
    ethiopienne: (f, c) => {
      f.cercle(0, -14, 27, c.l2);
      lignes(f, c.l2, [0, -48, 0, 48], [-34, -14, 34, -14], [-19, -33, 19, 5], [19, -33, -19, 5]);
      f.chemin(placer(LIS, { dy: -44, k: 0.45 }) + placer(LIS, { rot: 90, dx: 30, dy: -14, k: 0.45 }) + placer(LIS, { rot: -90, dx: -30, dy: -14, k: 0.45 }), c.p);
      f.chemin(barres([-12, 26, 24, 5], [-7, 40, 14, 7]), c.p);
    },
    canterbury: (f, c) => {
      // quatre bras triangulaires dont les bouts, arcs d'un même cercle, dessinent une roue
      f.chemin(quatre('M-7 -7L-26 -38A46 46 0 0 1 26 -38L7 -7Z') + barres([-8, -8, 16, 16]), c.p);
      f.chemin(quatre('M0 -13L-16 -34L16 -34Z'), c.v);
      // le nœud à trois boucles (triquetra) gravé sur chaque panneau
      const lobe = (deg) => {
        const x = (5.5 * Math.cos(deg * RAD)).toFixed(2);
        const y = (-25 + 5.5 * Math.sin(deg * RAD)).toFixed(2);
        return 'M0 -25A3.4 3.4 0 0 1 ' + x + ' ' + y + 'A3.4 3.4 0 0 1 0 -25';
      };
      f.chemin(quatre([90, 210, 330].map(lobe).join('')), c.l2);
    },
    celtique: (f, c) => {
      f.cercle(0, -16, 24, c.l);
      f.chemin(barres([-6, -48, 12, 96], [-34, -22, 68, 12]), c.p);
    },
    'saint-thomas': (f, c) => {
      const trefle = (x, y) => { f.cercle(x, y, 5, c.p); };
      f.chemin(barres([-3.5, -36, 7, 58], [-24, -19, 48, 7]), c.p);
      [[0, -41], [-5, -36], [5, -36], [-29, -15.5], [-24, -21], [-24, -10], [29, -15.5], [24, -21], [24, -10]].forEach(([x, y]) => trefle(x, y));
      f.chemin('M0 46C-9 40 -9 30 0 22C9 30 9 40 0 46ZM-3 46C-18 44 -24 34 -22 26C-12 28 -5 36 -3 46ZM3 46C18 44 24 34 22 26C12 28 5 36 3 46Z', c.p);
      f.chemin('M0 -48C-6 -49 -13 -46 -16 -40C-10 -41 -5 -41 -2 -45Z', c.p);
    },
    huguenote: (f, c) => {
      const o = { dy: -10, k: 0.78 };
      f.chemin(quatre(BRAS_MALTE, o), c.p);
      POINTES_MALTE.forEach(([x, y]) => f.cercle(x * 0.78, y * 0.78 - 10, 3, c.p));
      f.chemin([45, 135, 225, 315].map((rot) => placer(LIS, { rot, dx: 15 * Math.sin(rot * RAD), dy: -10 - 15 * Math.cos(rot * RAD), k: 0.7 })).join(''), c.p);
      f.chemin('M-15 37Q-4 32 0 38Q4 32 15 37Q9 43 3 43L2 51L0 49L-2 51L-3 43Q-9 43 -15 37Z', c.p);
    },
    serbe: (f, c) => {
      f.chemin(barres([-5, -46, 10, 92], [-46, -5, 92, 10]), c.p);
      [[-27, -27, -1], [27, -27, 1], [-27, 27, -1], [27, 27, 1]].forEach(([x, y, sens]) => {
        f.chemin('M' + (x - sens * 8) + ' ' + (y - 13) + 'A14 14 0 0 ' + (sens < 0 ? 0 : 1) + ' ' + (x - sens * 8) + ' ' + (y + 13), c.l3);
      });
    },
    pattee: (f, c) => f.chemin(quatre(BRAS_PATTE), c.p),
    malte: (f, c) => f.chemin(quatre(BRAS_MALTE), c.p),
    potencee: (f, c) => f.chemin(barres([-7, -46, 14, 92], [-46, -7, 92, 14], [-22, -46, 44, 12], [-22, 34, 44, 12], [-46, -22, 12, 44], [34, -22, 12, 44]), c.p),
    jerusalem: (f, c) => {
      const petite = (x, y) => barres([x - 2.5, y - 9, 5, 18], [x - 9, y - 2.5, 18, 5]);
      f.chemin(barres([-5.5, -47, 11, 94], [-47, -5.5, 94, 11], [-15, -47, 30, 9], [-15, 38, 30, 9], [-47, -15, 9, 30], [38, -15, 9, 30])
        + petite(-29, -29) + petite(29, -29) + petite(-29, 29) + petite(29, 29), c.p);
    },
    'saint-jacques': (f, c) => {
      f.chemin('M-4 -26L4 -26L4 22L0 50L-4 22Z' + barres([-27, -16, 54, 7]), c.p);
      f.chemin(placer(LIS, { dy: -26, k: 1 }) + placer(LIS, { rot: 90, dx: 27, dy: -12.5, k: 0.95 }) + placer(LIS, { rot: -90, dx: -27, dy: -12.5, k: 0.95 }), c.p);
      f.cercle(0, -12.5, 6, c.p);
    },
    fleurdelisee: (f, c) => {
      f.chemin(barres([-4.5, -28, 9, 56], [-28, -4.5, 56, 9]), c.p);
      f.chemin([0, 90, 180, 270].map((rot) => placer(LIS, { rot, dx: 28 * Math.sin(rot * RAD), dy: -28 * Math.cos(rot * RAD) })).join(''), c.p);
    },
    'ordre-du-christ': (f, c) => {
      f.chemin(quatre(BRAS_PATTE), c.p);
      f.chemin(barres([-3, -38, 6, 76], [-38, -3, 76, 6]), c.v);
    },
    'saint-georges': (f, c) => f.chemin(barres([-9, -50, 18, 100], [-50, -9, 100, 18]), c.p),
    scandinave: (f, c) => f.chemin(barres([-22, -34, 14, 68], [-50, -7, 100, 14]), c.p),
    bourgogne: (f, c) => {
      const b = 'M-6 -56L6 -56L6 56L-6 56Z';
      f.chemin(placer(b, { rot: 45 }) + placer(b, { rot: -45 }), c.p);
      const noeud = (d, sens) => placer('M0 -4L7 -4L7 4L0 4Z', { rot: 45 * sens, dx: d[0], dy: d[1] });
      f.chemin([[-27, -14, -1], [14, -27, -1], [14, 27, 1], [-27, 14, 1], [-14, -27, 1], [27, -14, 1], [27, 14, -1], [-14, 27, -1]]
        .map(([x, y, s]) => noeud([x, y], s)).join(''), c.p);
    },
    occitane: (f, c) => {
      f.chemin(quatre(BRAS_OCCITAN), c.p);
      f.chemin(quatre('M-1.3 -4L-1.3 -26L1.3 -26L1.3 -4Z') + barres([-4, -4, 8, 8]), c.v);
      [0, 90, 180, 270].forEach((rot) => {
        [[-23, -38], [0, -47], [23, -38]].forEach(([x, y]) => {
          const a = rot * RAD;
          f.cercle(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), 3.6, c.p);
        });
      });
    },
    lauburu: (f, c) => f.chemin(quatre('M0 0A23 23 0 0 1 0 -46A11.5 11.5 0 0 1 0 -23A11.5 11.5 0 0 0 0 0Z'), c.p),
    camarguaise: (f, c) => {
      const trident = 'M-3 0L-3 -10L-11 -10L-11 -24L-8.5 -30L-6 -24L-6 -15L-3 -15L-3 -24L0 -32L3 -24L3 -15L6 -15L6 -24L8.5 -30L11 -24L11 -10L3 -10L3 0Z';
      f.chemin(barres([-3, -22, 6, 62], [-24, -3, 48, 6]), c.p);
      f.chemin(placer(trident, { dy: -18 }) + placer(trident, { rot: 90, dx: 22 }) + placer(trident, { rot: -90, dx: -22 }), c.p);
      f.chemin('M-30 22Q-26 46 0 47Q26 46 30 22L36 28L31 8L20 24L25 23Q22 38 0 39Q-22 38 -25 23L-20 24L-31 8L-36 28Z', c.p);
      f.chemin('M0 30C-4 25 -12 25 -12 17C-12 11 -4 10 0 16C4 10 12 11 12 17C12 25 4 25 0 30Z', c.p);
    },
    chrisme: (f, c) => {
      lignes(f, c.l, [-26, -24, 26, 30], [26, -24, -26, 30], [0, -44, 0, 46]);
      f.chemin('M0 -44C20 -46 24 -18 0 -18', c.l);
      f.texte(-38, 4, 'Α', { t: 22, serif: true, c: c.t });
      f.texte(38, 4, 'Ω', { t: 22, serif: true, c: c.t });
    },
    staurogramme: (f, c) => {
      lignes(f, c.l, [0, -44, 0, 48], [-22, -8, 22, -8]);
      f.chemin('M0 -44C22 -46 24 -16 0 -18', c.l);
    },
    svastika: (f, c) => {
      f.chemin(barres([-6, -38, 12, 76], [-38, -6, 76, 12], [6, -38, 28, 12], [26, 6, 12, 28], [-34, 26, 28, 12], [-38, -34, 12, 28]), c.p);
      [[-17, -17], [17, -17], [-17, 17], [17, 17]].forEach(([x, y]) => f.cercle(x, y, 3.5, c.p));
    },
    solaire: (f, c) => {
      f.cercle(0, 0, 38, c.l);
      lignes(f, c.l, [0, -38, 0, 38], [-38, 0, 38, 0]);
    },
    agadez: (f, c) => {
      f.cercle(0, -26, 13, c.l3);
      lignes(f, c.l3, [-11, -38, -17, -47], [11, -38, 17, -47]);
      f.chemin('M0 -14L27 12L0 38L-27 12Z', c.p);
      f.chemin('M0 -2L14 12L0 26L-14 12Z', c.v);
      f.chemin('M-27 7L-40 12L-27 17ZM27 7L40 12L27 17ZM-5 34L0 48L5 34Z', c.p);
    },
    obele: (f, c) => {
      f.chemin('M0 -46C-3 -40 -3 -30 -2 -24L-20 -21C-23 -20 -23 -18 -20 -17L-2 -14L0 46L2 -14L20 -17C23 -18 23 -20 20 -21L2 -24C3 -30 3 -40 0 -46Z', c.p);
    },
    'rose-croix': (f, c) => {
      f.chemin(barres([-5.5, -46, 11, 92], [-30, -26, 60, 11]), c.p);
      f.cercle(0, -20, 15, 'f-plein-rouge');
      f.cercle(0, -20, 9.5, 'f-rose-coeur');
      f.cercle(0, -20, 4.5, 'f-plein-rouge');
    },
    // Les formes du blason
    ancree: (f, c) => f.chemin(quatre(BRAS_ANCRE), c.p),
    moline: (f, c) => f.chemin(quatre(BRAS_MOLINE), c.p),
    pommee: (f, c) => {
      f.chemin(barres([-6, -38, 12, 76], [-38, -6, 76, 12]), c.p);
      [[0, -38], [38, 0], [0, 38], [-38, 0]].forEach(([x, y]) => f.cercle(x, y, 9, c.p));
    },
    treflee: (f, c) => {
      f.chemin(barres([-5, -30, 10, 60], [-30, -5, 60, 10]), c.p);
      [0, 90, 180, 270].forEach((rot) => {
        const a = rot * RAD;
        [[0, -40], [-9, -30], [9, -30]].forEach(([x, y]) => f.cercle(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), 7.5, c.p));
      });
    },
    recroisetee: (f, c) => f.chemin(barres([-5, -46, 10, 92], [-46, -5, 92, 10],
      [-17, -36, 34, 8], [-17, 28, 34, 8], [-36, -17, 8, 34], [28, -17, 8, 34]), c.p),
    fichee: (f, c) => f.chemin('M-6 -46L6 -46L6 -26L28 -26L28 -14L6 -14L6 20L0 50L-6 20L-6 -14L-28 -14L-28 -26L-6 -26Z', c.p),
    patonnee: (f, c) => f.chemin(quatre(BRAS_PATONNE), c.p),
    fourchee: (f, c) => f.chemin('M-46 -46L-32 -46L0 -10L32 -46L46 -46L46 -34L7 8L7 46L-7 46L-7 8L-46 -34Z', c.p),
  };

  // Les classes, selon l'émail de la croix
  const STYLE = (nom) => ({ p: 'f-plein-' + nom, v: 'f-plein-blanc', t: 'f-texte' });
  const NEUTRE = {
    p: 'f-croix', l: 'f-croix-ligne', l2: 'f-croix-ligne-fine', l3: 'f-croix-ligne-moyenne', v: 'f-croix-vide', t: 'f-texte',
  };

  /* L'écu ou le drapeau qui porte une croix à ses couleurs. */
  function poserFond(f, fond) {
    if (!fond) return;
    const [forme, email] = fond.split('-');
    if (forme === 'ecu') f.chemin('M-50 -54H50V6C50 34 22 48 0 58C-22 48 -50 34 -50 6Z', 'f-fond-' + email);
    else f.rect(-50, -36, 100, 72, 2, 'f-fond-' + email);
  }

  // ── Les croix ─────────────────────────────────────────────────────────────

  /* `r` : l'article ; `d` : le tracé (la clé par défaut) ; `email`, `fond` : les
   * couleurs ; `k` : l'échelle sur un fond ; `dessous` : la phrase de légende. */
  const CROIX = {
    latine: { n: 'Latine', r: 'croix-latine', f: 'La branche basse plus longue que les trois autres : la forme du crucifix d’Occident.' },
    grecque: { n: 'Grecque', r: 'croix-grecque', f: 'Quatre branches égales, qui se croisent en leur milieu.' },
    'saint-andre': { n: 'Saint-André', r: 'croix-de-saint-andre', f: 'La croix en X, ou sautoir.' },
    tau: { n: 'Tau', r: 'croix-en-tau', f: 'La croix en T, sans tête : celle de saint Antoine et de saint François.' },
    'saint-pierre': { n: 'Saint-Pierre', r: 'croix-de-saint-pierre', f: 'La croix latine renversée, en souvenir du martyre de Pierre.' },
    ansee: { n: 'Ansée, égyptienne', r: 'croix-ansee', f: 'L’ânkh, le hiéroglyphe de la vie : un tau surmonté d’une boucle.' },
    lorraine: { n: 'Lorraine, patriarcale', r: 'croix-de-lorraine', f: 'Deux traverses, l’écriteau de Pilate au-dessus des bras : croix d’Anjou, de Lorraine, des archevêques.' },
    papale: { n: 'Papale', r: 'croix-papale', f: 'Trois traverses, de plus en plus courtes vers le haut, comme les trois couronnes de la tiare.' },
    orthodoxe: { n: 'Orthodoxe', r: 'croix-orthodoxe', f: 'L’écriteau, les bras, et l’appui des pieds en biais : la croix russe à huit pointes.' },
    armenienne: { n: 'Arménienne', r: 'croix-armenienne', f: 'La croix fleurie des khatchkars : chaque branche s’achève en deux lobes.' },
    copte: { n: 'Copte', r: 'croix-copte', f: 'Quatre branches égales à trois pointes chacune, soit douze pointes, autour d’un cercle.' },
    ethiopienne: { n: 'Éthiopienne', r: 'croix-ethiopienne', f: 'Une dentelle de métal : dessin simplifié d’une croix de procession.' },
    celtique: { n: 'Celtique', r: 'croix-celtique', f: 'La croix des pays celtiques, nimbée d’un anneau d’où ses branches dépassent.' },
    canterbury: { n: 'Canterbury', r: 'croix-de-canterbury', f: 'Quatre bras triangulaires aux bouts arrondis en roue, d’après une broche saxonne du IXe siècle : la croix des anglicans.' },
    'saint-thomas': { n: 'Saint-Thomas', r: 'croix-de-saint-thomas', f: 'La croix des chrétiens de l’Inde : extrémités lobées, lotus au pied, colombe au sommet.' },
    huguenote: { n: 'Huguenote', r: 'croix-huguenote', f: 'Une croix de Malte perlée, quatre fleurs de lys, une colombe suspendue.' },
    serbe: { n: 'Serbe', r: 'croix-serbe', f: 'Une croix grecque cantonnée de quatre signes en forme de C.' },
    templiers: { n: 'Templiers', r: 'croix-des-templiers', d: 'pattee', email: 'rouge', fond: 'ecu-blanc', f: 'La croix rouge sur le manteau blanc ; sa forme a varié, on la dessine d’ordinaire pattée.' },
    malte: { n: 'Malte, Saint-Jean', r: 'croix-de-malte', email: 'blanc', fond: 'ecu-noir', f: 'Huit pointes : la croix blanche de l’ordre de Saint-Jean de Jérusalem.' },
    teutonique: { n: 'Teutonique', r: 'croix-teutonique', d: 'pattee', email: 'noir', fond: 'ecu-blanc', f: 'La croix noire sur le manteau blanc, ancêtre de la croix de fer prussienne.' },
    jerusalem: { n: 'Jérusalem', r: 'croix-de-jerusalem', email: 'or', fond: 'ecu-blanc', f: 'Une croix potencée et quatre croisettes : d’or sur argent, contre toutes les règles du blason.' },
    'saint-lazare': { n: 'Saint-Lazare', r: 'croix-de-saint-lazare', d: 'malte', email: 'vert', fond: 'ecu-blanc', f: 'La croix verte des chevaliers de Saint-Lazare, nés d’une léproserie de Jérusalem.' },
    'saint-jacques': { n: 'Saint-Jacques', r: 'croix-de-saint-jacques', email: 'rouge', fond: 'ecu-blanc', f: 'La croix-épée de l’ordre de Santiago : fleurs de lys en haut, lame en bas.' },
    calatrava: { n: 'Calatrava', r: 'croix-de-calatrava', d: 'fleurdelisee', email: 'rouge', fond: 'ecu-blanc', f: 'La croix fleurdelisée de l’ordre de Calatrava, rouge ; verte pour celui d’Alcántara.' },
    'ordre-du-christ': { n: 'Ordre du Christ', r: 'croix-de-l-ordre-du-christ', email: 'rouge', fond: 'ecu-blanc', f: 'Une croix pattée rouge évidée de blanc : celle des voiles portugaises, héritière du Temple.' },
    'saint-esprit': { n: 'Saint-Esprit', r: 'croix-du-saint-esprit', d: 'huguenote', email: 'or', fond: 'ecu-bleu', f: 'L’insigne du cordon bleu, créé par Henri III : croix de Malte, fleurs de lys, colombe.' },
    pattee: { n: 'Pattée', r: 'croix-pattee', f: 'Des branches étroites au centre, évasées aux extrémités.' },
    potencee: { n: 'Potencée', r: 'croix-potencee', f: 'Chaque branche s’achève en T, comme une potence ou une béquille.' },
    'saint-georges': { n: 'Saint-Georges', r: 'croix-de-saint-georges', email: 'rouge', fond: 'drapeau-blanc', f: 'Une croix rouge pleine sur fond blanc : le drapeau de l’Angleterre et celui de Gênes.' },
    scandinave: { n: 'Scandinave', r: 'croix-scandinave', email: 'blanc', fond: 'drapeau-rouge', f: 'La croix des drapeaux du Nord, décalée vers la hampe ; ici le Dannebrog du Danemark.' },
    bourgogne: { n: 'Bourgogne', r: 'croix-de-bourgogne', email: 'rouge', fond: 'drapeau-blanc', f: 'Le sautoir noueux, aux moignons de branches coupées, des ducs de Bourgogne et de l’Espagne.' },
    occitane: { n: 'Occitane', r: 'croix-occitane', f: 'Cléchée, vidée, pommetée de douze perles : la croix des comtes de Toulouse.' },
    lauburu: { n: 'Lauburu', r: 'lauburu', f: 'Quatre têtes en virgule : la croix basque.' },
    camarguaise: { n: 'Camarguaise', r: 'croix-camarguaise', f: 'Des tridents de gardians, un cœur, une ancre : la foi, la charité, l’espérance.' },
    chrisme: { n: 'Chrisme', r: 'chrisme', f: 'Le X et le P de *Christos*, souvent entre l’alpha et l’oméga.' },
    staurogramme: { n: 'Staurogramme', r: 'chrisme', f: 'Le tau et le rhô superposés, abréviation du mot grec pour « croix ».' },
    svastika: { n: 'Svastika', r: 'svastika', f: 'Le svastika indien, signe de bon augure, ici avec ses quatre points.' },
    solaire: { n: 'Croix solaire', r: 'roue-solaire', f: 'Le cercle et la croix : la roue du soleil.' },
    agadez: { n: 'Agadez', r: 'croix-d-agadez', f: 'Le pendentif touareg, losange évidé surmonté d’un anneau.' },
    obele: { n: 'Obèle', r: 'obele', f: 'La croix du typographe, signe des morts et des passages douteux.' },
    'rose-croix': { n: 'Rose-Croix', r: 'la-rose', f: 'La rose posée sur la croix, emblème des Rose-Croix.' },
  };

  const SECTIONS = [
    { titre: 'Les formes premières', cles: ['latine', 'grecque', 'saint-andre', 'tau', 'saint-pierre', 'ansee'] },
    { titre: 'Les Églises', cles: ['lorraine', 'papale', 'orthodoxe', 'armenienne', 'copte', 'ethiopienne', 'celtique', 'canterbury', 'saint-thomas', 'huguenote', 'serbe'] },
    { titre: 'Les ordres de chevalerie', cles: ['templiers', 'malte', 'teutonique', 'jerusalem', 'saint-lazare', 'saint-jacques', 'calatrava', 'ordre-du-christ', 'saint-esprit'] },
    { titre: 'Blasons, pays et provinces', cles: ['pattee', 'potencee', 'saint-georges', 'scandinave', 'bourgogne', 'occitane', 'lauburu', 'camarguaise'] },
    { titre: 'Monogrammes et autres signes', cles: ['chrisme', 'staurogramme', 'rose-croix', 'solaire', 'svastika', 'agadez', 'obele'] },
  ];
  const COLONNES = 6;
  const PAS_X = 59;
  const PAS_Y = 76;
  const TETE = 24;

  /* Une croix à (x, y), à l'échelle k. */
  function poserCroix(f, cle, x, y, k, classes) {
    const c = CROIX[cle];
    const groupe = f.dans(classes || '', (g) => {
      g.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + k + ')');
      if (c.fond) {
        poserFond(f, c.fond);
        f.dans('', (g2) => {
          g2.setAttribute('transform', 'scale(' + (c.fond.startsWith('drapeau') ? 0.7 : 0.72) + ')');
          TRACES[c.d || cle](f, STYLE(c.email));
        });
        return;
      }
      TRACES[c.d || cle](f, NEUTRE);
    });
    return groupe;
  }

  const rangs = (n) => Math.ceil(n / COLONNES);

  F.croix = {
    titre: 'Les croix',
    cles: Object.keys(CROIX),
    hauteur: (arg) => (arg ? 226 : SECTIONS.reduce((h, s) => h + TETE + rangs(s.cles.length) * PAS_Y, 6)),
    legende: (arg) => (arg
      ? CROIX[arg].f
      : 'Touchez une croix pour lire son article.'),
    dessiner(f, arg) {
      if (arg) {
        const c = CROIX[arg];
        f.cercle(180, 96, 92, 'f-halo-croix');
        // un écu descend plus bas qu'il ne monte : on le remonte un peu dans le cercle
        poserCroix(f, arg, 180, c.fond && c.fond.startsWith('ecu') ? 93 : 96, c.fond ? 1.32 : 1.55, 'f-croix-grande');
        const lien = f.texte(180, 208, 'Toutes les croix', { t: 11, c: 'f-texte-accent', b: true });
        f.lien(lien, 'croix', 'Toutes les croix');
        return;
      }
      let y = 6;
      for (const s of SECTIONS) {
        f.texte(4, y + 9, s.titre, { a: 'start', t: 11, b: true, serif: true, c: 'f-texte-accent' });
        y += TETE;
        s.cles.forEach((cle, i) => {
          const col = i % COLONNES;
          const rang = Math.floor(i / COLONNES);
          const cx = 32 + col * PAS_X;
          const cy = y + rang * PAS_Y + 22;
          const c = CROIX[cle];
          const groupe = f.dans('f-case-croix', () => {
            f.rect(cx - 28, cy - 24, 56, 70, 5, 'f-cadre-croix');
            poserCroix(f, cle, cx, cy + 1, 0.4);
            f.texte(cx, cy + 34, c.n, { t: 8, c: 'f-texte', max: 54, lh: 9 });
          });
          f.lien(groupe, c.r, 'Croix : ' + c.n);
        });
        y += rangs(s.cles.length) * PAS_Y;
      }
    },
  };

  // ── Les ordres de chevalerie, à leurs couleurs ────────────────────────────

  const ORDRES = [
    ['templiers', 'Temple', 'croix rouge vers 1147', 'croix-des-templiers'],
    ['malte', 'Saint-Jean', 'croix blanche à huit pointes', 'croix-de-malte'],
    ['teutonique', 'Teutoniques', 'croix noire, 1205', 'croix-teutonique'],
    ['sepulcre', 'Saint-Sépulcre', 'croix de Jérusalem', 'croix-de-jerusalem'],
    ['saint-lazare', 'Saint-Lazare', 'croix verte', 'croix-de-saint-lazare'],
    ['saint-jacques', 'Santiago', 'la croix-épée', 'croix-de-saint-jacques'],
    ['calatrava', 'Calatrava', 'fleurdelisée, rouge', 'croix-de-calatrava'],
    ['alcantara', 'Alcántara', 'fleurdelisée, verte', 'croix-de-calatrava'],
    ['ordre-du-christ', 'Ordre du Christ', 'Portugal, 1319', 'croix-de-l-ordre-du-christ'],
    ['montesa', 'Montesa', 'Valence, 1317', 'croix-de-l-ordre-du-christ'],
  ];
  const DESSINS_ORDRES = {
    sepulcre: ['jerusalem', 'rouge', 'blanc'],
    alcantara: ['fleurdelisee', 'vert', 'blanc'],
    montesa: ['grecque', 'rouge', 'blanc'],
  };

  F['croix-des-ordres'] = {
    titre: 'Les croix des ordres de chevalerie',
    hauteur: 4 * 112 + 4,
    legende: 'Chaque ordre a son manteau et sa croix. Touchez un écu pour lire son article.',
    dessiner(f) {
      ORDRES.forEach(([cle, nom, sous, ref], i) => {
        const col = i % 3;
        const rang = Math.floor(i / 3);
        // la dernière rangée, plus courte, se centre
        const decalage = i >= 9 ? 120 : 0;
        const x = 60 + col * 120 + decalage;
        const y = 44 + rang * 112;
        const groupe = f.dans('f-case-croix', () => {
          f.rect(x - 56, y - 40, 112, 106, 6, 'f-cadre-croix');
          const specifique = DESSINS_ORDRES[cle];
          f.dans('', (g) => {
            g.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(0.56)');
            const c = CROIX[cle];
            const [trace, email, fond] = specifique || [c.d || cle, c.email, c.fond.split('-')[1]];
            poserFond(f, 'ecu-' + fond);
            f.dans('', (g2) => {
              g2.setAttribute('transform', 'scale(0.72)');
              TRACES[trace](f, STYLE(email));
            });
          });
          f.texte(x, y + 44, nom, { t: 10, b: true, serif: true });
          f.texte(x, y + 56, sous, { t: 8, c: 'f-texte-doux' });
        });
        f.lien(groupe, ref, 'Ordre : ' + nom);
      });
    },
  };

  // ── Les croix du blason ───────────────────────────────────────────────────

  const BLASON = [
    ['grecque', 'alésée', 'ne touche pas les bords'],
    ['pattee', 'pattée', 'évasée'],
    ['potencee', 'potencée', 'en T'],
    ['ancree', 'ancrée', 'en ancre'],
    ['moline', 'moline', 'en anille'],
    ['fleurdelisee', 'fleurdelisée', 'fleur de lys'],
    ['pommee', 'pommetée', 'boules'],
    ['treflee', 'tréflée', 'saint Maurice'],
    ['recroisetee', 'recroisetée', 'petites traverses'],
    ['fichee', 'fichée', 'pied en pointe'],
    ['patonnee', 'patonnée', 'évasée et lobée'],
    ['fourchee', 'fourchée', 'en Y'],
  ];

  F['croix-heraldiques'] = {
    titre: 'Les croix du blason',
    hauteur: 4 * 84 + 4,
    legende: 'Le blason nomme une croix par la façon dont ses branches s’achèvent : il en a décrit des dizaines.',
    dessiner(f) {
      BLASON.forEach(([cle, nom, sous], i) => {
        const x = 60 + (i % 3) * 120;
        const y = 32 + Math.floor(i / 3) * 84;
        f.dans('', (g) => {
          g.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(0.5)');
          TRACES[cle](f, NEUTRE);
        });
        f.texte(x, y + 34, nom, { t: 10.5, b: true, serif: true });
        f.texte(x, y + 46, sous, { t: 8, c: 'f-texte-doux' });
      });
    },
  };

  // ── L'acrostiche ΙΧΘΥΣ ────────────────────────────────────────────────────

  const LETTRES = [
    ['Ι', 'Ἰησοῦς', 'Iêsous', 'Jésus'],
    ['Χ', 'Χριστός', 'Christos', 'Christ'],
    ['Θ', 'Θεοῦ', 'Theou', 'de Dieu'],
    ['Υ', 'Υἱός', 'Huios', 'Fils'],
    ['Σ', 'Σωτήρ', 'Sôtêr', 'Sauveur'],
  ];

  F.ichthys = {
    titre: 'L’acrostiche ΙΧΘΥΣ, « poisson »',
    hauteur: 306,
    legende: 'Les initiales de cinq mots grecs, « Jésus-Christ, Fils de Dieu, Sauveur », forment le mot ΙΧΘΥΣ, « poisson ». À droite, la roue où les cinq lettres se superposent.',
    dessiner(f) {
      // Le poisson : deux arcs qui se croisent à la queue
      const poisson = f.dans('f-groupe-poisson', () => {
        f.chemin('M75.27 72C151.17 137.56 257 122.5 326 72C257 21.5 151.17 6.44 75.27 72Z', 'f-poisson-corps');
        f.chemin('M36 26C110 142 244 132 326 72C244 12 110 2 36 118', 'f-poisson');
      });
      f.lien(poisson, 'poisson', 'Le poisson');
      LETTRES.forEach(([l], i) => {
        f.texte(116 + i * 39, 72, l, { t: 34, serif: true, b: true, c: 'f-texte-accent' });
      });
      // Le tableau : l'initiale, le mot grec, sa transcription, son sens
      const y0 = 172;
      LETTRES.forEach(([l, grec, tr, fr], i) => {
        const y = y0 + i * 26;
        f.trait(10, y + 13, 246, y + 13, 'f-trait-doux');
        f.texte(22, y, l, { t: 19, serif: true, b: true, c: 'f-texte-accent' });
        f.texte(40, y, grec, { a: 'start', t: 14, serif: true });
        f.texte(108, y, tr, { a: 'start', t: 10, i: true, c: 'f-texte-doux' });
        f.texte(170, y, fr, { a: 'start', t: 12, b: true });
      });
      // La roue : Ι, Χ, Θ, Υ, Σ posés les uns sur les autres
      const cx = 304;
      const cy = 220;
      const r = 44;
      f.cercle(cx, cy, r, 'f-trait-fort');
      for (const angle of [0, 45, 90, 135]) {
        const [x1, y1] = f.polaire(cx, cy, r, angle);
        const [x2, y2] = f.polaire(cx, cy, r, angle + 180);
        f.trait(x1, y1, x2, y2, 'f-trait-fort');
      }
      f.texte(cx, cy + r + 13, 'la roue', { t: 9, i: true, c: 'f-texte-doux' });
    },
  };

})(window);
