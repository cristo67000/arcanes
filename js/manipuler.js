'use strict';
/*
 * « À manipuler » : cinq outils pour voir de ses yeux comment procédaient
 * les traditions.
 *
 *   tirer le tarot (une, trois ou dix cartes, avec les gravures de Conver,
 *   mélangées et distribuées sous les yeux, à l'endroit ou renversées, et la
 *   lecture que la tradition des cartomanciens ferait du tirage),
 *   lancer le Yi King (trois pièces, six fois, et la sentence de l'hexagramme,
 *   résumée), tracer une géomancie (seize lignes de points, puis le bouclier
 *   ou le thème des douze maisons, avec le sens des figures), chiffrer et
 *   déchiffrer un message (César, Atbash, Vigenère, Polybe, la scytale,
 *   l'alphabet maçonnique, le Morse, qu'on écoute), compter le nombre d'un nom
 *   (gématrie, isopsephie, numérologie). Tarot, Yi King et géomancie se
 *   gardent en note du carnet.
 *
 * Chaque outil vit dans son article, sous le texte (`Manipuler.bloc`) ; l'accueil
 * en donne la liste (`Manipuler.accueil`). Ils montrent un procédé et ne
 * prétendent rien prédire : chacun le dit, comme le reste du dictionnaire.
 * Le hasard vient de `crypto.getRandomValues` quand le navigateur l'a.
 */
(function (racine) {

  const { element, bouton, svg } = Outils;

  function hasard(n) {
    const c = racine.crypto;
    if (c && c.getRandomValues) {
      const t = new Uint32Array(1);
      c.getRandomValues(t);
      return t[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function sansMouvement() {
    if (App.reglages.animations === false) return true;
    return !!(racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* Des boutons exclusifs : [clé, libellé] ; `choisir(clé)` à chaque choix. */
  function segments(options, actif, choisir, etiquette) {
    const g = element('div', 'segments segments-outil');
    g.setAttribute('role', 'group');
    if (etiquette) g.setAttribute('aria-label', etiquette);
    for (const [cle, texte] of options) {
      const b = bouton('', texte, () => {
        for (const x of g.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        choisir(cle);
      });
      b.setAttribute('aria-pressed', cle === actif ? 'true' : 'false');
      g.appendChild(b);
    }
    return g;
  }

  /* Un renvoi vers un article, en pastille. */
  function renvoi(id, texte) {
    const a = Dictionnaire.parId(id);
    if (!a) return null;
    const b = bouton('voisin cat-' + a.c, texte || a.n, () => Fiche.ouvrir(id));
    b.setAttribute('data-ref', id);
    return b;
  }

  function renvois(ids) {
    const rang = element('div', 'voisins outil-renvois');
    for (const x of ids) {
      const b = Array.isArray(x) ? renvoi(x[0], x[1]) : renvoi(x);
      if (b) rang.appendChild(b);
    }
    return rang;
  }

  /* Garde un tirage en note du carnet, sur l'article où l'on est ; `texte` est
   * une fonction, pour prendre le tirage tel qu'il est au moment du clic. */
  function boutonGarder(ref, titre, texte) {
    return bouton('bouton-discret outil-garder', 'Garder dans le carnet', async () => {
      try {
        const maintenant = Date.now();
        await Store.ecrireNote({ id: Outils.identifiant('n'), ref, type: 'note', titre,
          texte: texte(), cree: maintenant, modifie: maintenant });
        document.dispatchEvent(new CustomEvent('notes-changees'));
        Outils.annoncer('Tirage gardé dans le carnet, sous « Notes ».');
      } catch (e) {
        Outils.annoncer('Le carnet est indisponible sur cet appareil.');
      }
    });
  }

  // ── Le tarot ──────────────────────────────────────────────────────────────

  const TIRAGES = {
    un: ['La carte tirée'],
    trois: ['Le passé', 'Le présent', 'L’avenir'],
    croix: [
      'Ce qui couvre : le présent', 'Ce qui croise : l’obstacle', 'Ce qui couronne : le but',
      'Ce qui est dessous : les fondations', 'Ce qui est derrière : le passé', 'Ce qui est devant : l’avenir proche',
      'Soi-même', 'La maison : l’entourage', 'Espoirs et craintes', 'L’issue',
    ],
  };

  /* Ce que la tradition des cartomanciens, d'Etteilla à Waite, lit dans chaque
   * arcane : un sens à l'endroit (`e`), un sens renversé (`r`). Résumés dans
   * l'esprit des articles, qui en disent plus ; rien de tout cela ne prédit. */
  const SENS_ARCANES = {
    'arcane-bateleur': { e: 'un début, une initiative, un savoir-faire : quelque chose commence, et l’on a les outils en main', r: 'l’habileté qui tourne à la ruse, un projet qui tarde à prendre forme, des moyens mal employés' },
    'arcane-papesse': { e: 'le secret, l’étude, la réserve : la réponse mûrit dans le silence', r: 'un savoir gardé trop longtemps, la passivité, un secret qui pèse' },
    'arcane-imperatrice': { e: 'l’abondance, la création, l’expression : un projet naît et rayonne', r: 'un projet qui ne mûrit pas, la vanité, une création empêchée' },
    'arcane-empereur': { e: 'la solidité, l’ordre, la protection d’un pouvoir établi', r: 'la rigidité, l’autorité qui pèse, un pouvoir contesté' },
    'arcane-pape': { e: 'le conseil, l’enseignement, une union consacrée, l’appui d’une institution', r: 'le conformisme, un conseil intéressé, la rupture avec la tradition' },
    'arcane-amoureux': { e: 'une décision à prendre, un sentiment, une alliance', r: 'l’hésitation qui s’éternise, un choix manqué, la discorde' },
    'arcane-chariot': { e: 'le succès, l’avancée, un voyage : des forces contraires enfin menées ensemble', r: 'un triomphe prématuré, la dispersion, un départ retardé' },
    'arcane-justice': { e: 'le jugement, l’équité, la conséquence des actes : chacun reçoit son dû', r: 'un jugement partial, une affaire qui s’enlise, l’excès de rigueur' },
    'arcane-hermite': { e: 'la prudence, la patience, la méditation : un retrait qui éclaire', r: 'l’isolement, la méfiance excessive, la peur d’avancer' },
    'arcane-roue-de-fortune': { e: 'un changement, une chance, un tournant du destin', r: 'un retournement défavorable, une chance qui se fait attendre' },
    'arcane-force': { e: 'la maîtrise de soi, l’énergie, la confiance : la douceur l’emporte sur la violence', r: 'la force mal employée, la colère, le découragement' },
    'arcane-pendu': { e: 'l’attente, le lâcher-prise, un sacrifice consenti qui prépare autre chose', r: 'un sacrifice inutile, le refus de l’épreuve, l’immobilité subie' },
    'arcane-sans-nom': { e: 'la fin d’un cycle, le dépouillement, une transformation profonde plus qu’une mort', r: 'une fin qui n’en finit pas, la stagnation, la peur du changement' },
    'arcane-temperance': { e: 'la patience, la conciliation, la guérison : les contraires se mêlent sans heurt', r: 'le déséquilibre, l’excès, des intérêts mal accordés' },
    'arcane-diable': { e: 'les désirs puissants, l’attachement, une énergie vitale à dompter', r: 'une emprise, une dépendance dont on peut se défaire, la faiblesse devant la tentation' },
    'arcane-maison-dieu': { e: 'l’écroulement d’un édifice trompeur, une rupture, la vérité qui éclate', r: 'une catastrophe évitée de peu, un enfermement qui se prolonge, le même ébranlement, atténué' },
    'arcane-etoile': { e: 'l’espoir, la guérison, la protection : une éclaircie après l’épreuve', r: 'l’espérance déçue, le doute, une aide qui tarde' },
    'arcane-lune': { e: 'l’incertitude, les rêves, l’intuition : rien n’est encore clair', r: 'des illusions qui se dissipent, de petites tromperies, des peurs sans objet' },
    'arcane-soleil': { e: 'la réussite, la clarté, une union heureuse : la carte la plus favorable', r: 'le même bonheur, voilé ou différé, une réussite moindre' },
    'arcane-jugement': { e: 'un renouveau, une révélation, un appel auquel répondre', r: 'un appel qu’on n’entend pas, un bilan repoussé, la crainte du verdict' },
    'arcane-monde': { e: 'la réalisation, la réussite complète, l’harmonie : le cycle s’achève', r: 'un achèvement qui se fait attendre, un succès inachevé, la difficulté à conclure' },
    'arcane-mat': { e: 'un départ, l’imprévu, la liberté : tout reste ouvert', r: 'l’imprudence, l’errance, une fuite qui coûte' },
  };

  function arcanes() {
    return Dictionnaire.livres
      .filter((a) => /^arcanes-majeurs\/\d+$/.test(a.sc || '') && a.im && a.im.length)
      .map((a) => ({ a, n: Number(a.sc.split('/')[1]), im: a.im.find((i) => /conver/.test(i.f)) || a.im[0] }))
      .sort((x, y) => x.n - y.n);
  }

  function tarot(zone, article) {
    const etat = { mode: 'trois', renversees: false, minuteurs: [] };
    const aide = element('div', 'outil-aide');
    const paquetVisuel = element('div', 'tt-paquet');
    paquetVisuel.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) paquetVisuel.appendChild(element('span', 'tt-dos tt-paquet-carte'));
    const tapis = element('div', 'tt-tapis');
    const bloc = element('div', 'tt-lecture-bloc');
    const tirer = bouton('bouton-principal', 'Mélanger et tirer', () => dessiner());

    function expliquer() {
      aide.textContent = '';
      const textes = {
        un: 'Une seule carte, tirée des vingt-deux arcanes majeurs du tarot de Nicolas Conver (1760).',
        trois: 'Trois cartes côte à côte, lues comme le passé, le présent et l’avenir : la disposition la plus simple de la cartomancie moderne.',
        croix: 'La « méthode celtique » que [[arthur-edward-waite|Waite]] publie en 1910 dans *The Pictorial Key to the Tarot* : six cartes en croix, quatre en colonne. Waite tire aussi les arcanes mineurs ; on ne garde ici que les majeurs.',
      };
      aide.appendChild(Rendu.paragraphe(textes[etat.mode]));
      if (etat.renversees) {
        aide.appendChild(Rendu.paragraphe('Une carte peut sortir la tête en bas : [[etteilla|Etteilla]], le premier, imprime pour chaque carte un sens à l’endroit et un sens renversé, et les cartomanciens l’ont suivi.'));
      }
    }

    /* La lecture d'une carte à sa place : la phrase des cartomanciens. */
    function sensDe(c) {
      const s = SENS_ARCANES[c.a.id];
      if (!s) return '';
      return c.renversee ? s.r : s.e;
    }

    function dessiner() {
      for (const m of etat.minuteurs) racine.clearTimeout(m);
      etat.minuteurs = [];
      const jeu = arcanes();
      const places = TIRAGES[etat.mode];
      // le mélange de Fisher-Yates, avec le hasard cryptographique
      const paquet = jeu.slice();
      for (let i = paquet.length - 1; i > 0; i -= 1) {
        const j = hasard(i + 1);
        [paquet[i], paquet[j]] = [paquet[j], paquet[i]];
      }
      const tirees = paquet.slice(0, places.length)
        .map((c) => Object.assign({ renversee: etat.renversees && hasard(2) === 1 }, c));
      tapis.textContent = '';
      tapis.className = 'tt-tapis tt-' + etat.mode;
      bloc.textContent = '';
      const immobile = sansMouvement();
      const lecture = element('ol', 'tt-lecture');
      const attente = immobile ? 0 : 950;   // le temps du mélange
      if (!immobile) {
        paquetVisuel.classList.remove('melange');
        void paquetVisuel.offsetWidth;
        paquetVisuel.classList.add('melange');
        Bruiteur.jouer('carte');
        etat.minuteurs.push(racine.setTimeout(() => Bruiteur.jouer('carte'), 420));
      }
      const cartes = [];
      tirees.forEach((c, i) => {
        const b = element('button', 'tt-carte tt-place-' + (i + 1) + (c.renversee ? ' tt-renversee' : ''));
        b.type = 'button';
        b.setAttribute('aria-label', (i + 1) + '. ' + places[i] + ' : ' + c.a.n + (c.renversee ? ', renversée' : ''));
        const vol = element('span', 'tt-vol');
        const interieur = element('span', 'tt-interieur');
        interieur.appendChild(element('span', 'tt-dos'));
        const face = element('span', 'tt-face');
        face.appendChild(Illustrations.image(c.im, 'tt-image'));
        interieur.appendChild(face);
        vol.appendChild(interieur);
        b.appendChild(vol);
        if (etat.mode !== 'un') b.appendChild(element('span', 'tt-numero', String(i + 1)));
        b.addEventListener('click', () => Fiche.ouvrir(c.a.id));
        tapis.appendChild(b);
        cartes.push({ c, b, vol });
        const li = element('li', immobile ? '' : 'tt-a-venir');
        li.appendChild(element('span', 'tt-place', places[i]));
        const r = renvoi(c.a.id, c.a.n);
        if (r) li.appendChild(r);
        if (c.renversee) li.appendChild(element('em', 'tt-renverse-note', 'renversée'));
        const s = sensDe(c);
        if (s) li.appendChild(element('span', 'tt-sens', s + '.'));
        lecture.appendChild(li);
      });
      // les cartes volent du paquet à leur place, puis se retournent
      if (!immobile) {
        const dRect = paquetVisuel.getBoundingClientRect();
        for (const { b, vol } of cartes) {
          const r = b.getBoundingClientRect();
          const dx = dRect.left + dRect.width / 2 - (r.left + r.width / 2);
          const dy = dRect.top + dRect.height / 2 - (r.top + r.height / 2);
          vol.style.transform = 'translate(' + dx.toFixed(0) + 'px, ' + dy.toFixed(0) + 'px) rotate(-6deg) scale(.7)';
          vol.style.opacity = '0';
        }
      }
      cartes.forEach(({ b, vol }, i) => {
        if (immobile) { b.classList.add('retournee'); return; }
        etat.minuteurs.push(racine.setTimeout(() => {
          vol.classList.add('tt-posee');
          vol.style.transform = '';
          vol.style.opacity = '';
        }, attente + i * 130));
        etat.minuteurs.push(racine.setTimeout(() => {
          b.classList.add('retournee');
          if (i < 3) Bruiteur.jouer('carte');
          const li = lecture.children[i];
          if (li) li.classList.remove('tt-a-venir');
        }, attente + cartes.length * 130 + 300 + i * 320));
      });
      bloc.appendChild(lecture);
      const note = element('p', 'discret tt-note');
      note.textContent = 'Les sens donnés ici résument ce que la tradition des cartomanciens attache à chaque arcane ; l’article de chaque carte en dit plus.';
      bloc.appendChild(note);
      const texteTirage = () => {
        const lignes = tirees.map((c, i) => (i + 1) + '. ' + places[i] + ' — ' + c.a.n
          + (c.renversee ? ', renversée' : '') + ' : ' + (sensDe(c) || ''));
        return 'Tirage du tarot (' + places.length + ' carte' + (places.length > 1 ? 's' : '')
          + ', arcanes majeurs du tarot de Conver), le ' + Outils.dateLisible(Date.now()) + '\n' + lignes.join('\n');
      };
      const copier = bouton('bouton-discret tt-copier', 'Copier la lecture', async () => {
        const ok = await Outils.copier(texteTirage());
        Outils.annoncer(ok ? 'Lecture copiée.' : 'Copie impossible.');
      });
      const actions = element('div', 'outil-boutons');
      actions.appendChild(copier);
      actions.appendChild(boutonGarder(article.id, 'Tirage du tarot', texteTirage));
      bloc.appendChild(actions);
      tirer.textContent = 'Mélanger et tirer à nouveau';
    }

    zone.appendChild(segments([['un', '1 carte'], ['trois', '3 cartes'], ['croix', '10 cartes']], etat.mode, (m) => {
      etat.mode = m;
      expliquer();
      dessiner();
    }, 'Nombre de cartes'));
    const renv = segments([[false, 'Toutes à l’endroit'], [true, 'Avec cartes renversées']], false, (v) => {
      etat.renversees = v;
      expliquer();
      dessiner();
    }, 'Cartes renversées ou non');
    renv.classList.add('tt-choix-renversees');
    zone.appendChild(renv);
    zone.appendChild(aide);
    zone.appendChild(tirer);
    zone.appendChild(paquetVisuel);
    zone.appendChild(tapis);
    zone.appendChild(bloc);
    expliquer();
  }

  // ── Le Yi King ────────────────────────────────────────────────────────────

  /* Les trigrammes, de bas en haut ; 1 = trait plein (yang), 0 = trait brisé (yin). */
  const TRIGRAMMES = [
    ['Qian', 'le Ciel', [1, 1, 1]], ['Zhen', 'le Tonnerre', [1, 0, 0]], ['Kan', 'l’Eau', [0, 1, 0]], ['Gen', 'la Montagne', [0, 0, 1]],
    ['Kun', 'la Terre', [0, 0, 0]], ['Xun', 'le Vent', [0, 1, 1]], ['Li', 'le Feu', [1, 0, 1]], ['Dui', 'le Lac', [1, 1, 0]],
  ];
  /* L'ordre du roi Wen : la ligne est le trigramme du haut, la colonne celui du
   * bas, tous deux dans l'ordre de TRIGRAMMES. */
  const ROI_WEN = [
    [1, 25, 6, 33, 12, 44, 13, 10], [34, 51, 40, 62, 16, 32, 55, 54], [5, 3, 29, 39, 8, 48, 63, 60], [26, 27, 4, 52, 23, 18, 22, 41],
    [11, 24, 7, 15, 2, 46, 36, 19], [9, 42, 59, 53, 20, 57, 37, 61], [14, 21, 64, 56, 35, 50, 30, 38], [43, 17, 47, 31, 45, 28, 49, 58],
  ];
  /* Pour chaque hexagramme : le pinyin, le nom, et sa sentence (le « jugement »
   * du Livre des mutations), résumée dans nos mots — rien n'est cité. */
  const HEXAGRAMMES = [null,
    ['Qian', 'Le Créateur', 'sublime réussite : la force créatrice agit ; persévérer dans la droiture'],
    ['Kun', 'Le Réceptif', 'réussir en se laissant porter : qui prend les devants s’égare, qui suit trouve un guide'],
    ['Zhun', 'La Difficulté initiale', 'les débuts sont difficiles : ne rien entreprendre à la légère, s’entourer d’aides'],
    ['Meng', 'La Folie juvénile', 'l’inexpérience réussit si elle interroge avec sérieux ; on ne répond pas à qui questionne sans fin'],
    ['Xu', 'L’Attente', 'attendre le bon moment avec confiance : alors on peut traverser la grande eau'],
    ['Song', 'Le Conflit', 'dans un différend, s’arrêter à mi-chemin porte chance ; aller jusqu’au bout porte malheur'],
    ['Shi', 'L’Armée', 'une entreprise collective réussit sous un chef expérimenté et droit'],
    ['Bi', 'La Solidarité', 'l’union porte chance ; que celui qui hésite vienne à temps, trop tard c’est le malheur'],
    ['Xiao Chu', 'Le Petit Apprivoiseur', 'de petites forces ne retiennent qu’un temps : des nuages denses, mais pas encore de pluie'],
    ['Lü', 'La Marche', 'marcher sur la queue du tigre : avec prudence et courtoisie, il ne mord pas'],
    ['Tai', 'La Paix', 'le petit s’en va, le grand vient : le ciel et la terre s’unissent, tout prospère'],
    ['Pi', 'La Stagnation', 'le grand s’en va, le petit vient : les échanges se rompent, temps de repli'],
    ['Tong Ren', 'La Communauté avec les hommes', 'la communauté réussit au grand jour, non dans les coteries'],
    ['Da You', 'Le Grand Avoir', 'posséder beaucoup est une réussite suprême — à porter avec mesure'],
    ['Qian', 'L’Humilité', 'l’humilité mène toute chose à bien : on abaisse ce qui est trop haut, on élève ce qui est bas'],
    ['Yu', 'L’Enthousiasme', 'l’élan gagne les autres : bon moment pour instituer et mettre en marche'],
    ['Sui', 'La Suite', 'savoir suivre obtient tout, à condition de rester droit'],
    ['Gu', 'Le Travail sur ce qui est gâté', 'ce qui est gâté peut être réparé : réfléchir avant d’agir, veiller après'],
    ['Lin', 'L’Approche', 'un temps favorable approche : en profiter sans oublier qu’il passera'],
    ['Guan', 'La Contemplation', 'observer avec gravité : l’exemple de celui qui regarde juste inspire confiance'],
    ['Shi He', 'Mordre au travers', 'trancher ce qui fait obstacle : il est bon de laisser agir la justice'],
    ['Bi', 'La Grâce', 'l’ornement réussit dans les petites choses : la forme ne remplace pas le fond'],
    ['Bo', 'L’Éclatement', 'quand tout s’effrite, ne rien entreprendre : laisser passer le mauvais moment'],
    ['Fu', 'Le Retour', 'après le déclin, la lumière revient : les entreprises retrouvent un sens'],
    ['Wu Wang', 'L’Innocence', 'agir sans arrière-pensée réussit ; qui n’est pas droit attire le malheur'],
    ['Da Chu', 'Le Grand Apprivoiseur', 'une grande énergie contenue : se mettre au service du dehors et oser l’entreprise'],
    ['Yi', 'La Nourriture', 'regarder ce que l’on nourrit, en soi et chez les autres'],
    ['Da Guo', 'La Prépondérance du grand', 'la poutre fléchit, la charge excède les forces : agir, mais en déplaçant l’appui'],
    ['Kan', 'L’Insondable', 'dans le danger répété, la sincérité et la constance font passer'],
    ['Li', 'Ce qui s’attache', 'la lumière tient à ce qu’elle éclaire : cultiver la clarté avec douceur'],
    ['Xian', 'L’Influence', 'l’attirance mutuelle réussit : une union se noue'],
    ['Heng', 'La Durée', 'la durée réussit : persévérer dans un chemin qui a fait ses preuves'],
    ['Dun', 'La Retraite', 'se retirer à temps réussit : le petit croît, le grand s’écarte sans faiblir'],
    ['Da Zhuang', 'La Puissance du grand', 'la grande force demande la droiture : sans justice, elle n’est que violence'],
    ['Jin', 'Le Progrès', 'un temps d’avancement : les mérites sont reconnus et récompensés'],
    ['Ming Yi', 'L’Obscurcissement de la lumière', 'la lumière est blessée : dans l’adversité, garder sa clarté au-dedans'],
    ['Jia Ren', 'La Famille', 'chacun à sa juste place, la maison prospère'],
    ['Kui', 'L’Opposition', 'dans l’opposition, seules les petites choses réussissent encore'],
    ['Jian', 'L’Obstacle', 'l’obstacle invite au détour : revenir vers les siens plutôt que forcer'],
    ['Xie', 'La Libération', 'la tension se dénoue : revenir est bien ; s’il reste à faire, faire vite'],
    ['Sun', 'La Diminution', 'se priver du superflu, sans honte : la simplicité sincère porte chance'],
    ['Yi', 'L’Augmentation', 'un temps de croissance : entreprendre, et traverser la grande eau'],
    ['Guai', 'La Percée', 'la vérité perce : la dire au grand jour, sans recourir à la force'],
    ['Gou', 'Venir à la rencontre', 'ce qui s’insinue paraît faible : ne pas lui donner prise'],
    ['Cui', 'Le Rassemblement', 'le rassemblement réussit autour de ce qui est grand et juste'],
    ['Sheng', 'La Poussée vers le haut', 'l’ascension se fait degré par degré, avec confiance'],
    ['Kun', 'L’Accablement', 'accablé, rester serein : les paroles ne sont pas crues, seuls comptent les actes'],
    ['Jing', 'Le Puits', 'la ville change, le puits demeure : il nourrit qui vient y puiser, s’il est entretenu'],
    ['Ge', 'La Révolution', 'le changement n’obtient créance qu’une fois accompli : qu’il soit juste et nécessaire'],
    ['Ding', 'Le Chaudron', 'l’établissement du neuf : nourrir ce qui en vaut la peine'],
    ['Zhen', 'L’Éveilleur', 'le tonnerre effraie à cent lieues, mais la coupe sacrée ne se renverse pas'],
    ['Gen', 'L’Immobilisation', 's’arrêter quand il faut s’arrêter, avancer quand il faut avancer'],
    ['Jian', 'Le Progrès graduel', 'le progrès par degrés, comme l’oie qui gagne la falaise : rien ne presse'],
    ['Gui Mei', 'L’Épousée', 'entrer dans un ordre qu’on n’a pas fixé : s’y avancer avec tact, ne rien forcer'],
    ['Feng', 'L’Abondance', 'la plénitude ne dure qu’un midi : en jouir sans tristesse'],
    ['Lü', 'Le Voyageur', 'en voyage, les petites choses réussissent : être prudent et droit en terre étrangère'],
    ['Xun', 'Le Doux', 'le doux pénètre peu à peu : de petites réussites ; il faut un but, et un guide'],
    ['Dui', 'Le Serein', 'la joie réussit quand elle reste droite : la douceur vraie n’est pas complaisance'],
    ['Huan', 'La Dispersion', 'ce qui se défait se rassemble autour de l’essentiel'],
    ['Jie', 'La Limitation', 'des bornes réussissent ; des bornes amères ne peuvent durer'],
    ['Zhong Fu', 'La Vérité intérieure', 'la sincérité intérieure gagne même les êtres les plus frustes'],
    ['Xiao Guo', 'La Prépondérance du petit', 'comme l’oiseau, ne pas monter mais descendre : les petites choses, pas les grandes'],
    ['Ji Ji', 'Après l’accomplissement', 'au but, rester attentif : l’ordre du début se défait à la fin si l’on se relâche'],
    ['Wei Ji', 'Avant l’accomplissement', 'presque au but : le petit renard mouille sa queue juste avant la rive'],
  ];

  function trigramme(traits) {
    return TRIGRAMMES.findIndex((t) => t[2].every((v, i) => v === traits[i]));
  }

  /* Le numéro d'un hexagramme, six traits de bas en haut. */
  function hexagramme(traits) {
    return ROI_WEN[trigramme(traits.slice(3))][trigramme(traits.slice(0, 3))];
  }

  /* Le dessin d'un hexagramme ; `mutants` marque les traits qui changent
   * (○ pour le vieux yang, × pour le vieux yin). */
  function dessinHexagramme(traits, mutants, classe) {
    const s = svg('svg', { viewBox: '0 0 84 78', class: 'yk-dessin ' + (classe || ''), 'aria-hidden': 'true', focusable: 'false' });
    traits.forEach((plein, k) => {
      const y = 66 - k * 12.4;
      if (plein) s.appendChild(svg('rect', { x: 6, y, width: 60, height: 7.5, rx: 1.5, class: 'yk-trait' }));
      else {
        s.appendChild(svg('rect', { x: 6, y, width: 26, height: 7.5, rx: 1.5, class: 'yk-trait' }));
        s.appendChild(svg('rect', { x: 40, y, width: 26, height: 7.5, rx: 1.5, class: 'yk-trait' }));
      }
      const m = mutants && mutants[k];
      if (m === 9) s.appendChild(svg('circle', { cx: 76, cy: y + 3.75, r: 3.6, class: 'yk-mutant' }));
      if (m === 6) s.appendChild(svg('path', { d: 'M72.5 ' + (y + 0.3) + 'l7 7m0 -7l-7 7', class: 'yk-mutant' }));
    });
    return s;
  }

  function carteHexagramme(n, traits, mutants, titre) {
    const [pinyin, nom, sentence] = HEXAGRAMMES[n];
    const bas = TRIGRAMMES[trigramme(traits.slice(0, 3))];
    const haut = TRIGRAMMES[trigramme(traits.slice(3))];
    const c = element('div', 'yk-hexagramme');
    c.appendChild(dessinHexagramme(traits, mutants));
    const t = element('div', 'yk-textes');
    t.appendChild(element('p', 'yk-titre', titre));
    t.appendChild(element('p', 'yk-nom', n + '. ' + pinyin + ' — ' + nom));
    t.appendChild(element('p', 'yk-sous', haut[0] + ', ' + haut[1] + ', au-dessus de ' + bas[0] + ', ' + bas[1]));
    if (sentence) t.appendChild(element('p', 'yk-jugement', 'La sentence : ' + sentence + '.'));
    c.appendChild(t);
    return c;
  }

  function yiKing(zone, article) {
    let tirage = [];
    const aide = element('div', 'outil-aide');
    aide.appendChild(Rendu.paragraphe('On jette trois pièces six fois, du trait du bas à celui du haut. Un côté vaut 3 (yang), l’autre 2 (yin) : 7 donne un trait plein, 8 un trait brisé ; 9 et 6, plus rares, sont de « vieux » traits qui se changent en leur contraire et donnent un second hexagramme. C’est la méthode des pièces, plus rapide que celle des tiges d’achillée.'));
    const pieces = element('div', 'yk-pieces');
    pieces.setAttribute('aria-live', 'polite');
    const montee = element('div', 'yk-montee');
    const resultat = element('div', 'yk-resultat');
    const lancer = bouton('bouton-principal', 'Lancer les trois pièces', () => jet());
    const recommencer = bouton('lien-discret', 'Recommencer', () => { tirage = []; dessiner(); });

    function jet() {
      if (tirage.length >= 6) tirage = [];
      const faces = [0, 0, 0].map(() => (hasard(2) ? 3 : 2));
      const total = faces[0] + faces[1] + faces[2];
      tirage.push(total);
      pieces.textContent = '';
      faces.forEach((v, i) => {
        const p = element('span', 'yk-piece ' + (v === 3 ? 'yang' : 'yin'), String(v));
        if (!sansMouvement()) {
          p.classList.add('lance');
          p.style.animationDelay = (i * 80) + 'ms';
        }
        pieces.appendChild(p);
      });
      const sens = { 6: 'vieux yin, qui change', 7: 'jeune yang', 8: 'jeune yin', 9: 'vieux yang, qui change' };
      pieces.appendChild(element('span', 'yk-somme', '= ' + total + ' : ' + sens[total]));
      Bruiteur.jouer('tic');
      dessiner();
    }

    function dessiner() {
      const traits = tirage.map((v) => (v === 7 || v === 9 ? 1 : 0));
      montee.textContent = '';
      if (tirage.length < 6) {
        const partiel = traits.concat([]);
        const s = svg('svg', { viewBox: '0 0 84 78', class: 'yk-dessin yk-partiel', 'aria-hidden': 'true', focusable: 'false' });
        for (let k = 0; k < 6; k += 1) {
          const y = 66 - k * 12.4;
          if (k >= partiel.length) s.appendChild(svg('rect', { x: 6, y, width: 60, height: 7.5, rx: 1.5, class: 'yk-vide' }));
          else if (partiel[k]) s.appendChild(svg('rect', { x: 6, y, width: 60, height: 7.5, rx: 1.5, class: 'yk-trait' }));
          else {
            s.appendChild(svg('rect', { x: 6, y, width: 26, height: 7.5, rx: 1.5, class: 'yk-trait' }));
            s.appendChild(svg('rect', { x: 40, y, width: 26, height: 7.5, rx: 1.5, class: 'yk-trait' }));
          }
        }
        montee.appendChild(s);
        montee.appendChild(element('p', 'discret', tirage.length ? 'Trait ' + tirage.length + ' sur 6' : 'Aucun trait encore'));
        lancer.textContent = tirage.length ? 'Lancer pour le trait ' + (tirage.length + 1) : 'Lancer les trois pièces';
        resultat.textContent = '';
        recommencer.hidden = !tirage.length;
        return;
      }
      lancer.textContent = 'Lancer un nouvel hexagramme';
      recommencer.hidden = true;
      resultat.textContent = '';
      const n = hexagramme(traits);
      resultat.appendChild(carteHexagramme(n, traits, tirage.map((v) => (v === 6 || v === 9 ? v : 0)), 'Hexagramme obtenu'));
      let apres = null;
      if (tirage.some((v) => v === 6 || v === 9)) {
        const changes = tirage.map((v) => (v === 9 ? 0 : v === 6 ? 1 : v === 7 ? 1 : 0));
        apres = hexagramme(changes);
        resultat.appendChild(carteHexagramme(apres, changes, null, 'Après le changement des vieux traits'));
      } else {
        resultat.appendChild(element('p', 'discret', 'Aucun trait ne change : l’hexagramme se lit seul.'));
      }
      resultat.appendChild(element('p', 'discret outil-source', 'Les sentences du Livre des mutations sont ici résumées dans nos mots ; les traductions les donnent en entier.'));
      resultat.appendChild(boutonGarder(article.id, 'Tirage du Yi King', () => {
        const ligne = (k) => k + '. ' + HEXAGRAMMES[k][0] + ' — ' + HEXAGRAMMES[k][1] + ' : ' + HEXAGRAMMES[k][2] + '.';
        return 'Tirage du Yi King, le ' + Outils.dateLisible(Date.now()) + '\n' + ligne(n)
          + (apres ? '\nAprès le changement des vieux traits : ' + ligne(apres) : '\nAucun trait ne change.');
      }));
      resultat.appendChild(renvois([['yi-king', 'Lire l’article « Yi King »'], 'yin-et-yang']));
    }

    zone.appendChild(aide);
    zone.appendChild(lancer);
    zone.appendChild(pieces);
    zone.appendChild(montee);
    zone.appendChild(recommencer);
    zone.appendChild(resultat);
    dessiner();
  }

  // ── La géomancie ──────────────────────────────────────────────────────────

  /* De haut en bas : tête, cou, corps, pieds ; 1 = un point, 2 = deux points.
   * Le quatrième champ résume ce que les traités de géomancie, d'al-Zanati aux
   * latins repris par Agrippa, lisaient dans la figure. */
  const GEOMANCIE = [
    ['Via', 'la Voie', [1, 1, 1, 1], 'le mouvement, le voyage, le changement : bonne aux départs, mauvaise à ce qui doit durer'],
    ['Populus', 'le Peuple', [2, 2, 2, 2], 'la foule, l’assemblée : figure neutre et changeante, qui prend la couleur de ses voisines'],
    ['Conjunctio', 'la Conjonction', [2, 1, 1, 2], 'la rencontre, l’union des contraires : bonne aux accords et aux retrouvailles'],
    ['Carcer', 'la Prison', [1, 2, 2, 1], 'l’enfermement, le retard : mauvaise, sinon pour garder et conserver'],
    ['Fortuna major', 'la Grande Fortune', [2, 2, 1, 1], 'le succès durable, acquis par soi-même : la meilleure des figures'],
    ['Fortuna minor', 'la Petite Fortune', [1, 1, 2, 2], 'un succès rapide mais passager, venu d’un appui : bonne à court terme'],
    ['Acquisitio', 'le Gain', [2, 1, 2, 1], 'l’acquisition : favorable à tout ce qu’on cherche à obtenir'],
    ['Amissio', 'la Perte', [1, 2, 1, 2], 'la perte : mauvaise au gain, bonne à qui veut se défaire de quelque chose'],
    ['Laetitia', 'la Joie', [1, 2, 2, 2], 'la joie, la santé, les heureux commencements : favorable'],
    ['Tristitia', 'la Tristesse', [2, 2, 2, 1], 'la tristesse, l’abaissement : mauvaise, sinon aux choses qui demandent d’être enfouies et stables'],
    ['Puella', 'la Fille', [1, 2, 1, 1], 'la douceur, l’agrément : bonne en amour, inconstante ailleurs'],
    ['Puer', 'le Garçon', [1, 1, 2, 1], 'l’ardeur, la témérité : bonne à la lutte et à l’amour, mauvaise au reste'],
    ['Albus', 'le Blanc', [2, 2, 1, 2], 'la paix, la sagesse : bonne aux études et aux affaires paisibles'],
    ['Rubeus', 'le Rouge', [2, 1, 2, 2], 'la passion, la violence : la plus mauvaise des figures pour presque tout'],
    ['Caput draconis', 'la Tête du Dragon', [2, 1, 1, 1], 'le seuil qui s’ouvre : bonne aux commencements'],
    ['Cauda draconis', 'la Queue du Dragon', [1, 1, 1, 2], 'la sortie, la fin : mauvaise, sinon pour achever et quitter'],
  ];

  /* Ce que chaque maison du thème demande, dans l'ordre des douze maisons que
   * la géomancie a prises à l'astrologie. */
  const MAISONS = [
    'la vie, celui qui interroge', 'les biens, le gain', 'les frères et sœurs, les courts trajets',
    'le père, la maison, les héritages', 'les enfants, les plaisirs', 'les maladies, les serviteurs',
    'le mariage, les associés, l’adversaire', 'la mort, les biens d’autrui', 'les longs voyages, la religion, le savoir',
    'les honneurs, le métier', 'les amis, les espérances', 'les ennemis cachés, la prison, les épreuves',
  ];
  const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  function nomFigure(f) {
    return GEOMANCIE.find((g) => g[2].every((v, i) => v === f[i]));
  }

  /* Deux figures s'additionnent étage par étage : un nombre impair de points
   * en donne un, un nombre pair en donne deux. */
  function ajouter(a, b) {
    return a.map((v, i) => ((v + b[i]) % 2 ? 1 : 2));
  }

  function dessinFigure(f) {
    const s = svg('svg', { viewBox: '0 0 40 52', class: 'gm-dessin', 'aria-hidden': 'true', focusable: 'false' });
    f.forEach((nb, k) => {
      const y = 8 + k * 12;
      if (nb === 1) s.appendChild(svg('circle', { cx: 20, cy: y, r: 3.6, class: 'gm-point' }));
      else {
        s.appendChild(svg('circle', { cx: 12, cy: y, r: 3.6, class: 'gm-point' }));
        s.appendChild(svg('circle', { cx: 28, cy: y, r: 3.6, class: 'gm-point' }));
      }
    });
    return s;
  }

  function caseFigure(f, role) {
    const g = nomFigure(f);
    const c = element('div', 'gm-case');
    c.appendChild(dessinFigure(f));
    c.appendChild(element('span', 'gm-role', role));
    c.appendChild(element('span', 'gm-nom', g[0]));
    c.appendChild(element('span', 'gm-sens', g[1]));
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', role + ' : ' + g[0] + ', ' + g[1]);
    return c;
  }

  function geomancie(zone, article) {
    let lignes = [];
    let vue = 'bouclier';
    const aide = element('div', 'outil-aide');
    aide.appendChild(Rendu.paragraphe('Le géomancien trace seize lignes de points sans les compter, quatre par figure. Il ne garde de chaque ligne que sa parité : un point si elle est impaire, deux si elle est paire. Les quatre premières figures, les « Mères », engendrent par des règles fixes les Filles, les Nièces, les deux Témoins et le Juge, que l’on range en « bouclier », de droite à gauche — ou dans les douze maisons prises à l’astrologie.'));
    const traces = element('div', 'gm-traces');
    const choixVue = element('div', 'gm-choix-vue');
    const bouclier = element('div', 'gm-bouclier');
    const maisons = element('div', 'gm-maisons-vue');
    const pied = element('div', 'gm-pied');
    const tracer = bouton('bouton-principal', 'Tracer une ligne de points', () => { ligne(); dessiner(); });
    const tout = bouton('bouton-discret', 'Tracer les seize lignes d’un coup', () => {
      if (lignes.length >= 16) lignes = [];
      while (lignes.length < 16) ligne();
      dessiner();
    });

    function ligne() {
      if (lignes.length >= 16) lignes = [];
      lignes.push(4 + hasard(13));
    }

    /* Le lexique des figures du tirage : chaque figure une fois, et son sens. */
    function lexique(toutes) {
      const vues = [];
      for (const f of toutes) {
        const g = nomFigure(f);
        if (!vues.includes(g)) vues.push(g);
      }
      const d = element('details', 'gm-lexique');
      const s = element('summary', null, 'Ce que les géomanciens lisaient dans ces figures');
      d.appendChild(s);
      const ul = element('ul');
      for (const g of vues) {
        const li = element('li');
        li.appendChild(element('em', null, g[0]));
        li.appendChild(document.createTextNode(', ' + g[1] + ' — ' + g[3] + '.'));
        ul.appendChild(li);
      }
      d.appendChild(ul);
      return d;
    }

    function dessiner() {
      traces.textContent = '';
      for (let m = 0; m < 4; m += 1) {
        const groupe = lignes.slice(m * 4, m * 4 + 4);
        if (!groupe.length) break;
        const bloc = element('div', 'gm-mere-traces');
        bloc.appendChild(element('p', 'gm-role', 'Mère ' + (m + 1)));
        for (const n of groupe) {
          const r = element('div', 'gm-ligne');
          const pts = element('span', 'gm-pts', '•'.repeat(n));
          pts.setAttribute('aria-label', n + ' points');
          r.appendChild(pts);
          r.appendChild(element('span', 'gm-parite', n % 2 ? '• impair' : '• • pair'));
          bloc.appendChild(r);
        }
        traces.appendChild(bloc);
      }
      tracer.textContent = lignes.length >= 16 ? 'Recommencer : une première ligne'
        : 'Tracer la ligne ' + (lignes.length + 1) + ' sur 16';
      choixVue.textContent = '';
      bouclier.textContent = '';
      maisons.textContent = '';
      pied.textContent = '';
      if (lignes.length < 16) return;
      const meres = [0, 1, 2, 3].map((m) => lignes.slice(m * 4, m * 4 + 4).map((n) => (n % 2 ? 1 : 2)));
      const filles = [0, 1, 2, 3].map((e) => meres.map((f) => f[e]));
      const nieces = [ajouter(meres[0], meres[1]), ajouter(meres[2], meres[3]), ajouter(filles[0], filles[1]), ajouter(filles[2], filles[3])];
      const droit = ajouter(nieces[0], nieces[1]);
      const gauche = ajouter(nieces[2], nieces[3]);
      const juge = ajouter(droit, gauche);
      choixVue.appendChild(segments([['bouclier', 'Le bouclier'], ['maisons', 'Les douze maisons']], vue, (v) => {
        vue = v;
        bouclier.hidden = v !== 'bouclier';
        maisons.hidden = v !== 'maisons';
      }, 'Bouclier ou maisons'));
      bouclier.hidden = vue !== 'bouclier';
      maisons.hidden = vue !== 'maisons';
      // ── le bouclier ──
      const rang = (titre, cases) => {
        bouclier.appendChild(element('p', 'gm-rang-titre', titre));
        const r = element('div', 'gm-rang');
        for (const c of cases) r.appendChild(c);
        bouclier.appendChild(r);
      };
      // de droite à gauche, comme sur le bouclier : la première figure est à droite
      rang('Les Mères', meres.map((f, i) => caseFigure(f, 'Mère ' + (i + 1))).reverse());
      rang('Les Filles, lues dans les Mères étage par étage', filles.map((f, i) => caseFigure(f, 'Fille ' + (i + 1))).reverse());
      rang('Les Nièces, sommes des figures deux à deux', nieces.map((f, i) => caseFigure(f, 'Nièce ' + (i + 1))).reverse());
      rang('Les Témoins', [caseFigure(gauche, 'Témoin gauche'), caseFigure(droit, 'Témoin droit')]);
      rang('Le Juge', [caseFigure(juge, 'Juge')]);
      const j = nomFigure(juge);
      bouclier.appendChild(element('p', 'gm-juge-sens', 'Le Juge répond : ' + j[0] + ', ' + j[1] + ' — ' + j[3] + '.'));
      bouclier.appendChild(element('p', 'discret', 'Le Juge a toujours un nombre pair de points : c’est la vérification du géomancien.'));
      // ── les douze maisons ──
      maisons.appendChild(element('p', 'discret', 'Les Mères occupent les maisons I à IV, les Filles les maisons V à VIII, les Nièces les maisons IX à XII : le géomancien lit la figure tombée dans la maison de sa question.'));
      const douze = meres.concat(filles, nieces);
      const grille = element('div', 'gm-maisons');
      douze.forEach((f, i) => {
        const g = nomFigure(f);
        const c = element('div', 'gm-maison');
        c.appendChild(element('p', 'gm-maison-titre', 'Maison ' + ROMAINS[i]));
        c.appendChild(element('p', 'gm-maison-domaine', MAISONS[i]));
        c.appendChild(dessinFigure(f));
        c.appendChild(element('span', 'gm-nom', g[0]));
        c.appendChild(element('span', 'gm-sens', g[1]));
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', 'Maison ' + ROMAINS[i] + ', ' + MAISONS[i] + ' : ' + g[0] + ', ' + g[1]);
        grille.appendChild(c);
      });
      maisons.appendChild(grille);
      // ── sous les deux vues : le lexique, garder, le renvoi ──
      pied.appendChild(lexique(douze.concat([gauche, droit, juge])));
      pied.appendChild(boutonGarder(article.id, 'Géomancie', () => {
        const nomme = (f) => { const g = nomFigure(f); return g[0] + ' (' + g[1] + ')'; };
        return 'Géomancie, le ' + Outils.dateLisible(Date.now())
          + '\nMères : ' + meres.map(nomme).join(', ') + '\nFilles : ' + filles.map(nomme).join(', ')
          + '\nNièces : ' + nieces.map(nomme).join(', ')
          + '\nTémoins : ' + nomme(gauche) + ' et ' + nomme(droit)
          + '\nJuge : ' + nomme(juge) + ' — ' + nomFigure(juge)[3] + '.';
      }));
      pied.appendChild(renvois([['geomancie', 'Lire l’article « Géomancie »']]));
    }

    zone.appendChild(aide);
    const boutons = element('div', 'outil-boutons');
    boutons.appendChild(tracer);
    boutons.appendChild(tout);
    zone.appendChild(boutons);
    zone.appendChild(traces);
    zone.appendChild(choixVue);
    zone.appendChild(bouclier);
    zone.appendChild(maisons);
    zone.appendChild(pied);
    dessiner();
  }

  // ── Les chiffres ──────────────────────────────────────────────────────────

  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function majuscules(t) {
    return String(t || '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
      .normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  }

  function decaler(t, k) {
    return majuscules(t).replace(/[A-Z]/g, (l) => A[(A.indexOf(l) + k + 260) % 26]);
  }

  function vigenere(t, cle, sens) {
    const c = majuscules(cle).replace(/[^A-Z]/g, '');
    if (!c) return majuscules(t);
    let i = 0;
    return majuscules(t).replace(/[A-Z]/g, (l) => {
      const k = A.indexOf(c[i % c.length]) * sens;
      i += 1;
      return A[(A.indexOf(l) + k + 26) % 26];
    });
  }

  const POLYBE = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';   // le J se confond avec le I

  function polybe(t, sens) {
    if (sens > 0) {
      return majuscules(t).split(/\s+/).filter(Boolean).map((mot) => mot.replace(/J/g, 'I').split('')
        .filter((l) => POLYBE.includes(l))
        .map((l) => { const i = POLYBE.indexOf(l); return String(Math.floor(i / 5) + 1) + String((i % 5) + 1); })
        .join(' ')).filter(Boolean).join(' / ');
    }
    return String(t || '').split('/').map((mot) => (mot.match(/[1-5]\s*[1-5]/g) || [])
      .map((p) => { const d = p.replace(/\s/g, ''); return POLYBE[(Number(d[0]) - 1) * 5 + Number(d[1]) - 1]; })
      .join('')).join(' ');
  }

  /* La scytale : le message écrit en lignes autour d'un bâton à `n` faces, puis
   * déroulé. On le lit colonne par colonne ; les cases vides prennent un X. */
  function scytale(t, n, sens) {
    const lettres = majuscules(t).replace(/[^A-Z0-9]/g, '');
    if (!lettres) return '';
    const largeur = Math.ceil(lettres.length / n);
    const plein = lettres.padEnd(largeur * n, 'X');
    let sortie = '';
    if (sens > 0) {
      for (let col = 0; col < largeur; col += 1) for (let ligne = 0; ligne < n; ligne += 1) sortie += plein[ligne * largeur + col];
    } else {
      const hauteur = Math.ceil(lettres.length / n);
      const pleinD = lettres.padEnd(hauteur * n, 'X');
      for (let ligne = 0; ligne < n; ligne += 1) for (let col = 0; col < hauteur; col += 1) sortie += pleinD[col * n + ligne];
    }
    return sortie.replace(/(.{5})/g, '$1 ').trim();
  }

  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '\'': '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '"': '.-..-.', '@': '.--.-.',
  };
  const DEMORSE = Object.fromEntries(Object.entries(MORSE).map(([l, c]) => [c, l]));

  function versMorse(t) {
    return majuscules(t).replace(/[’‘]/g, '\'').split(/\s+/).filter(Boolean)
      .map((mot) => mot.split('').map((l) => MORSE[l]).filter(Boolean).join(' ')).filter(Boolean).join(' / ')
      .replace(/\./g, '·').replace(/-/g, '–');
  }

  function deMorse(t) {
    return String(t || '').replace(/[·•]/g, '.').replace(/[–—−_]/g, '-').split('/')
      .map((mot) => mot.trim().split(/\s+/).filter(Boolean).map((c) => DEMORSE[c] || '?').join('')).join(' ');
  }

  /* L'alphabet maçonnique, dans sa disposition la plus répandue : A à I dans une
   * grille, J à R dans une grille pointée, S à V dans une croix, W à Z dans une
   * croix pointée. Chaque lettre est le bord de sa case. */
  function glypheMaconnique(l) {
    const s = svg('svg', { viewBox: '0 0 24 24', class: 'mc-lettre', 'aria-hidden': 'true', focusable: 'false' });
    const i = A.indexOf(l);
    if (i < 0) return null;
    const trait = (d) => s.appendChild(svg('path', { d, class: 'mc-trait' }));
    if (i < 18) {
      const k = i % 9;
      const ligne = Math.floor(k / 3);
      const col = k % 3;
      // les bords d'une case de dièse : en haut si ce n'est pas la première ligne, etc.
      if (ligne > 0) trait('M4 4H20');
      if (ligne < 2) trait('M4 20H20');
      if (col > 0) trait('M4 4V20');
      if (col < 2) trait('M20 4V20');
      if (i >= 9) s.appendChild(svg('circle', { cx: 12, cy: 12, r: 2.2, class: 'mc-point' }));
    } else {
      const k = (i - 18) % 4;
      const formes = ['M4 4L12 18L20 4', 'M4 4L18 12L4 20', 'M20 4L6 12L20 20', 'M4 20L12 6L20 20'];
      trait(formes[k]);
      if (i >= 22) {
        const points = [[12, 7], [8.5, 12], [15.5, 12], [12, 17]];
        s.appendChild(svg('circle', { cx: points[k][0], cy: points[k][1], r: 2.2, class: 'mc-point' }));
      }
    }
    return s;
  }

  /* Le Morse joué : un point d'une unité, un trait de trois, une unité entre
   * les signes, trois entre les lettres, sept entre les mots. */
  let lectureMorse = null;
  function jouerMorse(texte, fini) {
    arreterMorse();
    const c = Bruiteur.contexte();
    if (!c) { if (fini) fini(); return; }
    const u = 0.075;
    const sortie = c.createGain();
    sortie.gain.value = 0.28;
    sortie.connect(c.destination);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = 640;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(sortie);
    let t = c.currentTime + 0.1;
    const signes = String(texte).replace(/·/g, '.').replace(/–/g, '-');
    for (const s of signes) {
      if (s === '.' || s === '-') {
        const d = s === '.' ? u : 3 * u;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.006);
        g.gain.setValueAtTime(1, t + d - 0.006);
        g.gain.linearRampToValueAtTime(0, t + d);
        t += d + u;
      } else if (s === ' ') t += 2 * u;
      else if (s === '/') t += 2 * u;
    }
    o.start();
    o.stop(t + 0.05);
    const minuteur = racine.setTimeout(() => { lectureMorse = null; if (fini) fini(); }, (t - c.currentTime + 0.1) * 1000);
    lectureMorse = {
      arreter() {
        racine.clearTimeout(minuteur);
        try { o.stop(); } catch (e) { /* déjà fini */ }
        try { sortie.disconnect(); } catch (e) { /* rien */ }
        if (fini) fini();
      },
    };
  }

  function arreterMorse() {
    if (lectureMorse) { const l = lectureMorse; lectureMorse = null; l.arreter(); }
  }

  const METHODES = [
    ['cesar', 'César'], ['atbash', 'Atbash'], ['vigenere', 'Vigenère'], ['polybe', 'Polybe'],
    ['scytale', 'Scytale'], ['maconnique', 'Maçonnique'], ['morse', 'Morse'],
  ];
  const ARTICLE_METHODE = {
    cesar: 'chiffre-de-cesar', atbash: 'atbash', vigenere: 'chiffre-de-vigenere', polybe: 'carre-de-polybe',
    scytale: 'scytale', maconnique: 'alphabet-maconnique', morse: 'code-morse',
  };
  const AIDE_METHODE = {
    cesar: 'Chaque lettre avance d’un même nombre de rangs dans l’alphabet ; Suétone dit que César décalait de trois.',
    atbash: 'L’alphabet replié sur lui-même : A devient Z, B devient Y. Le procédé vient de l’hébreu biblique ; on l’applique ici aux lettres latines.',
    vigenere: 'Le décalage change à chaque lettre, selon les lettres d’un mot-clé répété : le « chiffre indéchiffrable », percé au XIXe siècle.',
    polybe: 'Chaque lettre devient deux chiffres, sa ligne et sa colonne dans un carré de cinq sur cinq où I et J partagent une case.',
    scytale: 'Le message est écrit en lignes sur une bande enroulée autour d’un bâton, puis déroulé : les lettres restent, l’ordre change.',
    maconnique: 'Chaque lettre devient le bord de sa case dans deux grilles et deux croix, avec ou sans point.',
    morse: 'Des points et des traits, brefs et longs, pour le télégraphe : on peut l’écouter.',
  };

  function chiffres(zone, a) {
    const depart = Object.keys(ARTICLE_METHODE).find((m) => ARTICLE_METHODE[m] === a.id) || 'cesar';
    const etat = { methode: depart, sens: 1, decalage: 3, cle: 'ARCANES', faces: 4 };
    const champ = element('textarea', 'outil-champ');
    champ.rows = 2;
    champ.value = 'Souviens-toi de la mort';
    champ.setAttribute('aria-label', 'Le message');
    champ.setAttribute('spellcheck', 'false');
    const aide = element('p', 'outil-aide-ligne');
    const reglages = element('div', 'outil-reglages');
    const sens = segments([[1, 'Chiffrer'], [-1, 'Déchiffrer']], 1, (v) => { etat.sens = v; calculer(); }, 'Sens');
    const sortie = element('div', 'outil-sortie');
    sortie.setAttribute('aria-live', 'polite');
    const actions = element('div', 'outil-boutons');
    const copier = bouton('bouton-discret', 'Copier', async () => {
      const ok = await Outils.copier(sortie.getAttribute('data-texte') || '');
      Outils.annoncer(ok ? 'Copié.' : 'Copie impossible.');
    });
    const ecouter = bouton('bouton-discret', '▶ Écouter', () => {
      if (lectureMorse) { arreterMorse(); return; }
      const texte = etat.sens > 0 ? sortie.getAttribute('data-texte') : versMorse(sortie.getAttribute('data-texte'));
      ecouter.textContent = '■ Arrêter';
      jouerMorse(texte, () => { ecouter.textContent = '▶ Écouter'; });
    });
    actions.appendChild(copier);
    actions.appendChild(ecouter);
    const lien = element('div', 'outil-lien');

    function champNombre(libelle, min, max, valeur, changer) {
      const l = element('label', 'outil-option');
      l.appendChild(element('span', null, libelle));
      const i = element('input');
      i.type = 'number';
      i.min = String(min);
      i.max = String(max);
      i.value = String(valeur);
      i.addEventListener('input', () => {
        const v = Math.max(min, Math.min(max, Math.round(Number(i.value) || min)));
        changer(v);
        calculer();
      });
      l.appendChild(i);
      return l;
    }

    function options() {
      reglages.textContent = '';
      if (etat.methode === 'cesar') reglages.appendChild(champNombre('Décalage', 1, 25, etat.decalage, (v) => { etat.decalage = v; }));
      if (etat.methode === 'scytale') reglages.appendChild(champNombre('Faces du bâton', 2, 8, etat.faces, (v) => { etat.faces = v; }));
      if (etat.methode === 'vigenere') {
        const l = element('label', 'outil-option');
        l.appendChild(element('span', null, 'Mot-clé'));
        const i = element('input');
        i.type = 'text';
        i.value = etat.cle;
        i.setAttribute('autocapitalize', 'characters');
        i.setAttribute('spellcheck', 'false');
        i.addEventListener('input', () => { etat.cle = i.value; calculer(); });
        l.appendChild(i);
        reglages.appendChild(l);
      }
      sens.hidden = etat.methode === 'maconnique' || etat.methode === 'atbash';
      ecouter.hidden = etat.methode !== 'morse';
      aide.textContent = AIDE_METHODE[etat.methode];
      lien.textContent = '';
      const r = renvoi(ARTICLE_METHODE[etat.methode]);
      if (r) lien.appendChild(r);
    }

    function calculer() {
      arreterMorse();
      const t = champ.value;
      const s = etat.methode === 'atbash' || etat.methode === 'maconnique' ? 1 : etat.sens;
      let resultat = '';
      sortie.textContent = '';
      sortie.className = 'outil-sortie';
      if (etat.methode === 'cesar') resultat = decaler(t, s * etat.decalage);
      if (etat.methode === 'atbash') resultat = majuscules(t).replace(/[A-Z]/g, (l) => A[25 - A.indexOf(l)]);
      if (etat.methode === 'vigenere') resultat = vigenere(t, etat.cle, s);
      if (etat.methode === 'polybe') resultat = polybe(t, s);
      if (etat.methode === 'scytale') resultat = scytale(t, etat.faces, s);
      if (etat.methode === 'morse') resultat = s > 0 ? versMorse(t) : deMorse(t);
      if (etat.methode === 'maconnique') {
        sortie.classList.add('mc-sortie');
        for (const mot of majuscules(t).split(/\s+/).filter(Boolean)) {
          const m = element('span', 'mc-mot');
          for (const l of mot) {
            const g = glypheMaconnique(l);
            if (g) m.appendChild(g);
          }
          if (m.childNodes.length) sortie.appendChild(m);
        }
        resultat = majuscules(t);
        sortie.setAttribute('aria-label', 'Le message en alphabet maçonnique');
      } else {
        sortie.textContent = resultat || '…';
        if (etat.methode === 'morse' && s > 0) sortie.classList.add('morse-sortie');
      }
      sortie.setAttribute('data-texte', resultat);
      copier.hidden = etat.methode === 'maconnique';
    }

    champ.addEventListener('input', calculer);
    zone.appendChild(segments(METHODES, etat.methode, (m) => { etat.methode = m; options(); calculer(); }, 'Le chiffre'));
    zone.appendChild(aide);
    zone.appendChild(champ);
    const ligne = element('div', 'outil-ligne');
    ligne.appendChild(sens);
    ligne.appendChild(reglages);
    zone.appendChild(ligne);
    zone.appendChild(sortie);
    zone.appendChild(actions);
    zone.appendChild(lien);
    options();
    calculer();
  }

  // ── Les nombres des noms ──────────────────────────────────────────────────

  const HEBREU = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40,
    'נ': 50, 'ן': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
  };
  const GREC = {
    'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ϛ': 6, 'ϝ': 6, 'ζ': 7, 'η': 8, 'θ': 9, 'ι': 10, 'κ': 20, 'λ': 30, 'μ': 40, 'ν': 50,
    'ξ': 60, 'ο': 70, 'π': 80, 'ϙ': 90, 'ϟ': 90, 'ρ': 100, 'σ': 200, 'ς': 200, 'τ': 300, 'υ': 400, 'φ': 500, 'χ': 600, 'ψ': 700,
    'ω': 800, 'ϡ': 900,
  };
  const CLAVIER_HEBREU = 'אבגדהוזחטיכלמנסעפצקרשת';
  const CLAVIER_GREC = 'αβγδεϛζηθικλμνξοπϙρστυφχψωϡ';
  const EXEMPLES = [
    ['ΙΗΣΟΥΣ', 'Jésus en grec', 'isopsephie'],
    ['ΑΒΡΑΞΑΣ', 'Abraxas', 'abraxas'],
    ['נרון קסר', 'Néron César', 'nombre-de-la-bete'],
    ['יהוה', 'le Tétragramme', 'tetragramme'],
    ['Arcanes', 'en numérologie', 'numerologie'],
  ];

  /* La valeur de chaque lettre d'un système, et leur somme. */
  function compter(texte, table, prepare) {
    const lettres = [];
    for (const signe of prepare(texte)) if (table[signe] !== undefined) lettres.push([signe, table[signe]]);
    return { lettres, somme: lettres.reduce((n, l) => n + l[1], 0) };
  }

  const grecPrepare = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const hebreuPrepare = (t) => String(t).normalize('NFD').replace(/[֑-ׇ]/g, '');
  const ORDINAL = Object.fromEntries(A.split('').map((l, i) => [l, i + 1]));
  const PYTHAGORE = Object.fromEntries(A.split('').map((l, i) => [l, (i % 9) + 1]));

  /* 365 → 3 + 6 + 5 = 14 → 1 + 4 = 5 : les étapes, et les valeurs traversées. */
  function reduire(n) {
    const etapes = [];
    const valeurs = [n];
    let v = n;
    while (v > 9) {
      const chiffres = String(v).split('').map(Number);
      v = chiffres.reduce((x, y) => x + y, 0);
      etapes.push(chiffres.join(' + ') + ' = ' + v);
      valeurs.push(v);
    }
    return { etapes, valeurs };
  }

  function nombres(zone, a) {
    const depart = { gematrie: 'יהוה', isopsephie: 'ΑΒΡΑΞΑΣ', numerologie: 'Arcanes', 'nombre-de-la-bete': 'נרון קסר' }[a.id] || 'ΑΒΡΑΞΑΣ';
    const aide = element('div', 'outil-aide');
    aide.appendChild(Rendu.paragraphe('En hébreu et en grec, chaque lettre est aussi un chiffre : la somme des lettres d’un mot est son nombre, c’est la [[gematrie|gématrie]] des kabbalistes et l’[[isopsephie]] des Grecs. La [[numerologie|numérologie]] moderne fait de même avec l’alphabet latin, de 1 à 9, puis additionne les chiffres jusqu’à n’en garder qu’un.'));
    const champ = element('input', 'outil-champ outil-champ-court');
    champ.type = 'text';
    champ.value = depart;
    champ.dir = 'auto';
    champ.setAttribute('aria-label', 'Un nom ou un mot, en lettres hébraïques, grecques ou latines');
    champ.setAttribute('spellcheck', 'false');
    const claviers = element('div', 'nb-claviers');
    const touches = element('div', 'nb-touches');
    let clavier = null;
    const ouvrirClavier = (lettres, b) => {
      clavier = clavier === lettres ? null : lettres;
      for (const x of claviers.querySelectorAll('button')) x.setAttribute('aria-pressed', x === b && clavier ? 'true' : 'false');
      touches.textContent = '';
      if (!clavier) return;
      for (const l of clavier) {
        touches.appendChild(bouton('nb-touche', l, () => { champ.value += l; calculer(); }));
      }
      touches.appendChild(bouton('nb-touche nb-espace', 'espace', () => { champ.value += ' '; calculer(); }));
      touches.appendChild(bouton('nb-touche nb-effacer', '⌫', () => { champ.value = Array.from(champ.value).slice(0, -1).join(''); calculer(); }));
    };
    const bh = bouton('filtre', 'Lettres hébraïques', () => ouvrirClavier(CLAVIER_HEBREU, bh));
    const bg = bouton('filtre', 'Lettres grecques', () => ouvrirClavier(CLAVIER_GREC, bg));
    bh.setAttribute('aria-pressed', 'false');
    bg.setAttribute('aria-pressed', 'false');
    claviers.appendChild(bh);
    claviers.appendChild(bg);
    claviers.appendChild(bouton('filtre', 'Effacer', () => { champ.value = ''; calculer(); champ.focus(); }));
    const sortie = element('div', 'nb-sortie');
    sortie.setAttribute('aria-live', 'polite');

    function systeme(titre, compte, reduit) {
      if (!compte.lettres.length) return;
      const s = element('div', 'nb-systeme');
      s.appendChild(element('p', 'nb-titre', titre));
      const l = element('p', 'nb-lettres');
      compte.lettres.forEach(([signe, v], i) => {
        if (i) l.appendChild(element('span', 'nb-plus', '+'));
        const c = element('span', 'nb-lettre');
        c.appendChild(element('span', 'nb-signe', signe));
        c.appendChild(element('span', 'nb-valeur', String(v)));
        l.appendChild(c);
      });
      s.appendChild(l);
      s.appendChild(element('p', 'nb-somme', '= ' + compte.somme.toLocaleString('fr-FR')));
      if (reduit) {
        const { etapes, valeurs } = reduire(compte.somme);
        if (etapes.length) {
          const maitre = valeurs.some((v) => v === 11 || v === 22);
          s.appendChild(element('p', 'nb-reduction', 'Réduit : ' + etapes.join(' ; ')
            + (maitre ? ' (les numérologues s’arrêtent à 11 et 22, leurs « nombres maîtres »)' : '')));
        }
      }
      sortie.appendChild(s);
    }

    function calculer() {
      sortie.textContent = '';
      const t = champ.value;
      const h = compter(t, HEBREU, hebreuPrepare);
      const g = compter(t, GREC, grecPrepare);
      const lat = majuscules(t);
      const o = compter(lat, ORDINAL, (x) => x);
      const p = compter(lat, PYTHAGORE, (x) => x);
      systeme('Gématrie hébraïque', h, false);
      systeme('Isopsephie grecque', g, false);
      systeme('Rang dans l’alphabet latin (A = 1 … Z = 26)', o, false);
      systeme('Numérologie (A = 1 … I = 9, J = 1 …)', p, true);
      if (!sortie.childNodes.length) sortie.appendChild(element('p', 'discret', 'Écrivez un mot en lettres hébraïques, grecques ou latines.'));
    }

    const exemples = element('div', 'nb-exemples');
    exemples.appendChild(element('span', 'discret', 'Exemples :'));
    for (const [mot, titre] of EXEMPLES) {
      const b = bouton('filtre', mot, () => { champ.value = mot; calculer(); });
      b.setAttribute('aria-label', mot + ', ' + titre);
      b.title = titre;
      exemples.appendChild(b);
    }

    champ.addEventListener('input', calculer);
    zone.appendChild(aide);
    zone.appendChild(champ);
    zone.appendChild(claviers);
    zone.appendChild(touches);
    zone.appendChild(exemples);
    zone.appendChild(sortie);
    zone.appendChild(renvois(EXEMPLES.map((e) => e[2]).filter((id) => id !== a.id)));
    calculer();
  }

  // ── Les outils et leurs articles ──────────────────────────────────────────

  const OUTILS = [
    {
      id: 'tarot', nom: 'Tirer le tarot', article: 'tarot', articles: ['tarot', 'arcanes-majeurs', 'tarot-de-marseille', 'cartomancie'],
      avis: 'Le tirage montre comment se dispose un jeu. Le hasard du mélange ne dit rien de l’avenir : aucune étude n’a montré que la cartomancie prédise quoi que ce soit.',
      monter: tarot,
    },
    {
      id: 'yi-king', nom: 'Lancer le Yi King', article: 'yi-king', articles: ['yi-king'],
      avis: 'Le Yi King est un classique de la pensée chinoise. Le jet des pièces reproduit la méthode de consultation, pas une prédiction.',
      monter: yiKing,
    },
    {
      id: 'geomancie', nom: 'Tracer une géomancie', article: 'geomancie', articles: ['geomancie'],
      avis: 'Le bouclier montre les règles du calcul des géomanciens ; il ne prédit rien.',
      monter: geomancie,
    },
    {
      id: 'chiffres', nom: 'Chiffrer un message', article: 'cryptographie',
      articles: ['cryptographie', 'chiffre-de-cesar', 'atbash', 'chiffre-de-vigenere', 'carre-de-polybe', 'scytale', 'alphabet-maconnique', 'code-morse'],
      avis: 'Ces chiffres anciens se cassent en quelques minutes : ne leur confiez rien qui doive vraiment rester secret.',
      monter: chiffres,
    },
    {
      id: 'nombres', nom: 'Le nombre d’un nom', article: 'gematrie', articles: ['gematrie', 'isopsephie', 'numerologie', 'nombre-de-la-bete'],
      avis: 'Toute langue fournit des égalités de nombres entre des mots qui n’ont rien à voir : elles ne prouvent aucun lien entre eux, et aucune étude n’a relié ces nombres au caractère d’une personne.',
      monter: nombres,
    },
  ];

  function outilDe(id) {
    return OUTILS.find((o) => o.articles.includes(id)) || null;
  }

  /* Le bloc « À manipuler » d'un article, ou null. */
  function bloc(a) {
    const outil = a && !a.perso ? outilDe(a.id) : null;
    if (!outil) return null;
    const section = element('section', 'manipuler outil-' + outil.id);
    section.id = 'manipuler';
    section.appendChild(element('h3', 'rubrique', 'À manipuler'));
    section.appendChild(element('p', 'manipuler-titre', outil.nom));
    const zone = element('div', 'manipuler-zone');
    section.appendChild(zone);
    try {
      outil.monter(zone, a);
    } catch (e) {
      zone.textContent = '';
      zone.appendChild(element('p', 'discret', 'Cet outil n’a pas pu s’ouvrir.'));
    }
    section.appendChild(element('p', 'manipuler-avis', outil.avis));
    return section;
  }

  /* La rangée de l'accueil : chaque outil ouvre son article, à l'outil. */
  function accueil(conteneur) {
    conteneur.textContent = '';
    const presents = OUTILS.filter((o) => Dictionnaire.parId(o.article));
    if (!presents.length) return;
    conteneur.appendChild(element('h3', 'rubrique', 'À manipuler'));
    const rang = element('div', 'portes outils-accueil');
    for (const o of presents) {
      const a = Dictionnaire.parId(o.article);
      const b = bouton('porte outil-porte cat-' + a.c, '', () => Fiche.ouvrir(o.article, { defiler: 'outil' }));
      b.setAttribute('data-outil', o.id);
      b.appendChild(element('span', 'point-cat'));
      b.appendChild(element('span', 'porte-nom', o.nom));
      rang.appendChild(b);
    }
    conteneur.appendChild(rang);
  }

  racine.Manipuler = {
    bloc, accueil, arreter: arreterMorse,
    outils: OUTILS.map((o) => ({ id: o.id, nom: o.nom, article: o.article, articles: o.articles.slice() })),
    // pour les épreuves
    _: { hexagramme, ajouter, nomFigure, decaler, vigenere, polybe, scytale, versMorse, deMorse, reduire, compter, HEBREU, GREC, grecPrepare, hebreuPrepare, SENS_ARCANES, HEXAGRAMMES, GEOMANCIE, MAISONS },
  };

})(window);
