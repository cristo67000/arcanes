'use strict';
/*
 * Figures des symboles et des doctrines : pentagramme et hexagramme,
 * géométrie sacrée, ennéagramme, carré SATOR, émanation, hiérarchies des
 * anges, corps subtils, chakras, âges du monde, grades maçonniques.
 */
(function (racine) {
  const F = racine.Figures = racine.Figures || {};

  // ── Le pentagramme des éléments ───────────────────────────────────────────

  F['pentagramme-elements'] = {
    titre: 'Le pentagramme et les cinq éléments',
    hauteur: 300,
    legende: 'L’attribution de la Golden Dawn : l’esprit à la pointe supérieure domine les quatre éléments.',
    dessiner(f) {
      const cx = 180;
      const cy = 158;
      const r = 112;
      const p = [0, 72, 144, 216, 288].map((a) => f.polaire(cx, cy, r, a));
      f.cercle(cx, cy, r, 'f-trait-doux');
      f.poly([p[0], p[2], p[4], p[1], p[3]], 'f-etoile-trait');
      const pointes = [
        [null, 'Esprit'], ['eau', 'Eau'], ['feu', 'Feu'], ['terre-element', 'Terre'], ['air', 'Air'],
      ];
      pointes.forEach(([g, nom], i) => {
        const [x, y] = p[i];
        f.cercle(x, y, 15, 'f-fond-page-trait');
        if (g) f.glyphe(g, x, y, 18, 'f-glyphe-accent');
        else f.cercle(x, y, 6, 'f-point-accent');
        const [lx, ly] = f.polaire(cx, cy, r + 30, i * 72);
        f.texte(lx, ly, nom, { t: 10.5, b: true, serif: true });
      });
    },
  };

  // ── L'hexagramme des planètes ─────────────────────────────────────────────

  F['hexagramme-planetes'] = {
    titre: 'L’hexagramme et les sept planètes',
    hauteur: 300,
    legende: 'Une disposition classique de la magie moderne : Saturne en haut, la Lune en bas, le Soleil au centre ; le feu (triangle montant) et l’eau (triangle descendant) unis.',
    dessiner(f) {
      const cx = 180;
      const cy = 150;
      const r = 112;
      const p = [0, 60, 120, 180, 240, 300].map((a) => f.polaire(cx, cy, r, a));
      f.poly([p[0], p[2], p[4]], 'f-etoile-trait');
      f.poly([p[3], p[5], p[1]], 'f-etoile-trait-doux');
      const planetes = ['saturne', 'jupiter', 'venus', 'lune', 'mercure', 'mars'];
      planetes.forEach((g, i) => {
        const [x, y] = p[i];
        f.cercle(x, y, 15, 'f-fond-page-trait');
        f.glyphe(g, x, y, 19, 'f-glyphe-accent');
      });
      f.cercle(cx, cy, 17, 'f-fond-page-trait');
      f.glyphe('soleil', cx, cy, 22, 'f-glyphe-accent');
      f.texte(cx, 290, 'triangle de feu ▲ · triangle d’eau ▼', { t: 9, c: 'f-texte-doux' });
    },
  };

  // ── Géométrie sacrée ──────────────────────────────────────────────────────

  F['vesica-piscis'] = {
    titre: 'La vesica piscis',
    hauteur: 210,
    legende: 'Deux cercles de même rayon, chacun passant par le centre de l’autre : leur intersection forme l’amande, et ses pointes donnent un triangle équilatéral.',
    dessiner(f) {
      const r = 72;
      const c1 = [144, 104];
      const c2 = [216, 104];
      const h = Math.sqrt(r * r - 36 * 36);
      f.chemin('M180 ' + (104 - h).toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 180 ' + (104 + h).toFixed(1)
        + 'A' + r + ' ' + r + ' 0 0 1 180 ' + (104 - h).toFixed(1) + 'Z', 'f-amande');
      f.cercle(c1[0], c1[1], r, 'f-trait');
      f.cercle(c2[0], c2[1], r, 'f-trait');
      f.poly([[c1[0], c1[1]], [c2[0], c2[1]], [180, 104 - h]], 'f-trait-pointille');
      f.cercle(c1[0], c1[1], 3, 'f-point');
      f.cercle(c2[0], c2[1], 3, 'f-point');
      f.texte(180, 104 + 14, 'vesica', { t: 9, i: true, c: 'f-texte-accent' });
    },
  };

  F['fleur-de-vie'] = {
    titre: 'La fleur de vie',
    hauteur: 300,
    legende: 'Dix-neuf cercles de même rayon centrés sur un réseau hexagonal, dans un cercle de rayon triple.',
    dessiner(f) {
      const cx = 180;
      const cy = 150;
      const r = 40;
      const centres = [[0, 0]];
      for (let k = 0; k < 6; k += 1) {
        const a = k * 60;
        centres.push(f.polaire(0, 0, r, a));
        centres.push(f.polaire(0, 0, 2 * r, a));
        centres.push(f.polaire(0, 0, r * Math.sqrt(3), a + 30));
      }
      for (const [x, y] of centres) f.cercle(cx + x, cy + y, r, 'f-trait-fleur');
      f.cercle(cx, cy, 3 * r, 'f-trait');
    },
  };

  F.enneagramme = {
    titre: 'L’ennéagramme',
    hauteur: 300,
    legende: 'Neuf points sur un cercle : le triangle 3-6-9 et la figure 1-4-2-8-5-7, suite des décimales de 1/7.',
    dessiner(f) {
      const cx = 180;
      const cy = 150;
      const r = 112;
      const pt = (k) => f.polaire(cx, cy, r, (k % 9) * 40);
      f.cercle(cx, cy, r, 'f-trait');
      f.poly([pt(9), pt(3), pt(6)], 'f-etoile-trait');
      f.poly([1, 4, 2, 8, 5, 7].map(pt), 'f-etoile-trait-doux');
      for (let k = 1; k <= 9; k += 1) {
        const [x, y] = pt(k);
        f.cercle(x, y, 4.5, 'f-point-accent');
        const [lx, ly] = f.polaire(cx, cy, r + 18, (k % 9) * 40);
        f.texte(lx, ly, String(k), { t: 12, serif: true, b: true });
      }
    },
  };

  F['carre-sator'] = {
    titre: 'Le carré SATOR',
    hauteur: 236,
    legende: 'Cinq mots qui se lisent dans les quatre sens ; TENET forme une croix au centre.',
    dessiner(f) {
      const mots = ['SATOR', 'AREPO', 'TENET', 'OPERA', 'ROTAS'];
      const c = 40;
      const x0 = 80;
      const y0 = 12;
      mots.forEach((mot, i) => {
        Array.from(mot).forEach((lettre, j) => {
          const croix = i === 2 || j === 2;
          f.rect(x0 + j * c, y0 + i * c, c, c, 0, croix ? 'f-case-forte' : 'f-case');
          f.texte(x0 + j * c + c / 2, y0 + i * c + c / 2, lettre, { t: 19, serif: true, b: true, c: croix ? 'f-texte-accent' : 'f-texte' });
        });
      });
      f.texte(180, 226, 'trouvé à Pompéi, avant l’an 79', { t: 9, c: 'f-texte-doux', i: true });
    },
  };

  // ── L'émanation selon Plotin ──────────────────────────────────────────────

  F['emanation-plotin'] = {
    titre: 'L’émanation selon Plotin',
    hauteur: 304,
    legende: 'Tout procède de l’Un par degrés (procession), et l’âme peut remonter vers sa source (conversion).',
    dessiner(f) {
      const niveaux = [
        ['L’Un', 'au-delà de l’être et de la pensée', 'plotin'],
        ['L’Intellect', 'les Idées, la pensée qui se pense', null],
        ['L’Âme', 'l’âme du monde et les âmes', 'ame-du-monde'],
        ['La Nature', 'les corps, jusqu’à la matière', null],
      ];
      niveaux.forEach(([nom, sens, ref], i) => {
        const y = 16 + i * 74;
        const w = 300 - i * 46;
        const groupe = f.dans('f-niveau', () => {
          if (i === 0) {
            f.cercle(180, y + 26, 30, 'f-soleil-un');
            f.texte(180, y + 26, nom, { t: 13, b: true, serif: true });
            f.texte(180, y + 66, sens, { t: 8.6, c: 'f-texte-doux', i: true });
          } else {
            f.rect(180 - w / 2, y + 6, w, 42, 9, i === 3 ? 'f-boite-sombre' : 'f-boite');
            f.texte(180, y + 21, nom, { t: 12, b: true, serif: true });
            f.texte(180, y + 37, sens, { t: 8.6, c: 'f-texte-doux' });
          }
        });
        if (ref) f.lien(groupe, ref, nom);
      });
      f.fleche(330, 60, 330, 270, 'f-trait-doux');
      f.texte(344, 165, 'procession', { t: 9, c: 'f-texte-doux', i: true, rot: 90 });
      f.fleche(30, 270, 30, 60, 'f-trait-accent');
      f.texte(16, 165, 'conversion', { t: 9, c: 'f-texte-accent', i: true, rot: -90 });
    },
  };

  // ── Les hiérarchies célestes ──────────────────────────────────────────────

  F['hierarchies-celestes'] = {
    titre: 'Les neuf chœurs des anges',
    hauteur: 300,
    legende: 'La hiérarchie du Pseudo-Denys : trois triades de trois chœurs, de la plus proche de Dieu à la plus proche des hommes.',
    dessiner(f) {
      const triades = [
        ['Première triade', ['Séraphins', 'Chérubins', 'Trônes']],
        ['Deuxième triade', ['Dominations', 'Vertus', 'Puissances']],
        ['Troisième triade', ['Principautés', 'Archanges', 'Anges']],
      ];
      triades.forEach(([nom, choeurs], i) => {
        const y = 14 + i * 94;
        f.rect(56, y, 290, 84, 12, i === 0 ? 'f-boite-forte' : 'f-boite');
        f.texte(66, y + 13, nom, { t: 8.4, a: 'start', c: 'f-texte-doux', i: true });
        choeurs.forEach((c, k) => {
          f.cercle(100 + k * 100, y + 48, 5, 'f-point-accent');
          f.texte(100 + k * 100, y + 66, c, { t: 10.5, serif: true, b: true });
        });
      });
      f.fleche(36, 24, 36, 280, 'f-trait-accent');
      f.texte(22, 150, 'la lumière descend', { t: 9, c: 'f-texte-accent', i: true, rot: -90 });
    },
  };

  // ── Les corps subtils ─────────────────────────────────────────────────────

  F['corps-subtils'] = {
    titre: 'Les corps subtils',
    hauteur: 340,
    legende: 'À gauche, les sept principes de la théosophie de Blavatsky ; à droite, les quatre membres de l’être humain selon Rudolf Steiner. Du plus dense, en bas, au plus subtil, en haut.',
    dessiner(f) {
      const theo = [
        ['Corps physique', 'sthûla sharîra'], ['Double éthérique', 'linga sharîra'], ['Principe vital', 'prâna'],
        ['Corps des désirs', 'kâma'], ['Mental', 'manas'], ['Âme spirituelle', 'buddhi'], ['Esprit', 'âtma'],
      ];
      const steiner = ['Corps physique', 'Corps éthérique', 'Corps astral', 'Le Je'];
      f.texte(102, 12, 'Théosophie', { t: 9.5, b: true, c: 'f-texte-accent' });
      f.texte(278, 12, 'Steiner', { t: 9.5, b: true, c: 'f-texte-accent' });
      theo.forEach(([nom, sk], i) => {
        const y = 300 - i * 42;
        f.rect(10, y, 184, 36, 7, 'f-strate-' + i);
        f.texte(102, y + 13, nom, { t: 10, b: true });
        f.texte(102, y + 27, sk, { t: 8.4, i: true, c: 'f-texte-doux' });
      });
      // quatre membres sur la même hauteur que les sept principes
      steiner.forEach((nom, i) => {
        const h = 67.5;
        const y = 336 - (i + 1) * h - i * 6;
        f.rect(206, y, 144, h, 8, 'f-strate-' + (i * 2));
        f.texte(278, y + h / 2, nom, { t: 10.5, b: true });
      });
      f.fleche(200, 334, 200, 22, 'f-trait-doux');
    },
  };

  // ── Les chakras ───────────────────────────────────────────────────────────

  F.chakras = {
    titre: 'Les sept chakras',
    hauteur: 350,
    legende: 'Le système le plus répandu en Occident : six centres le long de l’axe du corps et un septième au sommet du crâne, chacun figuré par un lotus d’un nombre de pétales déterminé.',
    dessiner(f) {
      const chakras = [
        ['Sahasrara', 'sommet du crâne', '1000 pétales'], ['Ajna', 'entre les sourcils', '2 pétales'],
        ['Vishuddha', 'gorge', '16 pétales'], ['Anahata', 'cœur', '12 pétales'],
        ['Manipura', 'nombril', '10 pétales'], ['Svadhisthana', 'bas-ventre', '6 pétales'],
        ['Muladhara', 'périnée', '4 pétales'],
      ];
      f.trait(180, 20, 180, 330, 'f-axe');
      chakras.forEach(([nom, lieu, petales], i) => {
        const y = 26 + i * 50;
        f.cercle(180, y, 15, 'f-chakra');
        f.cercle(180, y, 5, 'f-point-accent');
        f.texte(156, y - 5, nom, { t: 10.5, a: 'end', b: true });
        f.texte(156, y + 9, petales, { t: 8.2, a: 'end', c: 'f-texte-doux' });
        f.texte(204, y, lieu, { t: 9.5, a: 'start', c: 'f-texte-doux', i: true });
      });
    },
  };

  // ── Les âges du monde ─────────────────────────────────────────────────────

  F['cycles-yugas'] = {
    titre: 'Les quatre âges du monde',
    hauteur: 150,
    legende: 'Les quatre yugas de l’hindouisme, dont les durées sont dans le rapport 4, 3, 2, 1 ; Hésiode décrit de même un âge d’or, d’argent, de bronze et de fer.',
    dessiner(f) {
      const ages = [
        ['Krita', 'âge d’or', 4, 'f-age-or'], ['Treta', 'd’argent', 3, 'f-age-argent'],
        ['Dvapara', 'de bronze', 2, 'f-age-bronze'], ['Kali', 'de fer', 1, 'f-age-fer'],
      ];
      const total = 340;
      let x = 10;
      ages.forEach(([nom, metal, part, classe]) => {
        const w = (total * part) / 10;
        f.rect(x, 40, w - 3, 44, 5, classe);
        f.texte(x + (w - 3) / 2, 62, nom, { t: part === 1 ? 9 : 11, b: true, serif: true, c: part === 1 ? 'f-texte-blanc' : 'f-texte-sur-age' });
        f.texte(x + (w - 3) / 2, 100, String(part), { t: 12, serif: true, c: 'f-texte-accent' });
        f.texte(x + (w - 3) / 2, 116, metal, { t: 8.6, i: true, c: 'f-texte-doux' });
        x += w;
      });
      f.fleche(20, 24, 340, 24, 'f-trait-doux');
      f.texte(180, 14, 'déclin, du premier âge au Kali-yuga', { t: 8.6, i: true, c: 'f-texte-doux' });
      f.texte(180, 140, 'durées relatives : 4 + 3 + 2 + 1 = 10', { t: 8.6, c: 'f-texte-doux' });
    },
  };

  // ── Les grades maçonniques ────────────────────────────────────────────────

  F['degres-maconniques'] = {
    titre: 'Les grades de la franc-maçonnerie',
    hauteur: 318,
    legende: 'Les trois grades symboliques, communs à tous les rites, et quelques hauts grades du Rite écossais ancien et accepté.',
    dessiner(f) {
      const hauts = [
        ['33ᵉ', 'Souverain grand inspecteur général'], ['30ᵉ', 'Chevalier Kadosh'],
        ['18ᵉ', 'Chevalier Rose-Croix'], ['4ᵉ – 14ᵉ', 'grades de perfection'],
      ];
      hauts.forEach(([num, nom], i) => {
        const y = 12 + i * 40;
        f.rect(70, y, 220, 32, 6, 'f-boite');
        f.texte(108, y + 16, num, { t: 10, b: true, c: 'f-texte-accent' });
        f.texte(212, y + 16, nom, { t: 9.2, max: 140 });
      });
      f.texte(180, 182, 'hauts grades, selon les rites', { t: 8.6, i: true, c: 'f-texte-doux' });
      const bleus = [['3', 'Maître', 'la légende d’Hiram'], ['2', 'Compagnon', 'l’étoile flamboyante'], ['1', 'Apprenti', 'le silence, la pierre brute']];
      bleus.forEach(([num, nom, motif], i) => {
        const y = 196 + i * 40;
        f.rect(40 + i * 8, y, 280 - i * 16, 34, 6, 'f-boite-forte');
        f.texte(70, y + 17, num, { t: 15, serif: true, b: true, c: 'f-texte-accent' });
        f.texte(180, y + 11, nom, { t: 11, b: true, serif: true });
        f.texte(180, y + 25, motif, { t: 8.4, i: true, c: 'f-texte-doux' });
      });
    },
  };

})(window);
