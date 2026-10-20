'use strict';
/*
 * La carte des lieux : l'onglet « Carte », et le plan de situation d'une fiche.
 *
 * Le fond (data/carte.json, Natural Earth) est dessiné ici, en SVG, sans aucun
 * serveur de tuiles : la carte marche hors ligne et ne contacte personne. Il
 * n'est chargé qu'à la première carte affichée. Il est projeté d'avance, en
 * Mercator ; `projeter()` place les lieux par la même formule.
 *
 * Deux couches superposées : le fond, dont on change la `viewBox` pour
 * déplacer et grossir, et par-dessus les marqueurs et les noms, posés en
 * pixels pour garder leur taille à tous les zooms. Les noms qui se
 * chevaucheraient sont tus : le lieu choisi d'abord, puis les autres lieux,
 * puis les villes, des plus grandes aux plus petites.
 *
 * ── La position ────────────────────────────────────────────────────────────
 *
 * « Me situer » demande la position au navigateur, qui demande la permission.
 * Elle n'est demandée que sur ce geste, n'est gardée qu'en mémoire, le temps
 * de la visite, et ne sort jamais de l'appareil : elle sert à poser un point
 * sur la carte, à ranger les lieux du plus proche au plus lointain et à dire
 * « à 240 km au sud-ouest ». Les liens d'itinéraire ne la transmettent pas :
 * ils ne portent que la destination, et l'application de cartes du téléphone
 * sait d'où l'on part.
 */
(function (racine) {

  const { element, bouton, svg } = Outils;

  let fond = null;
  let chargement = null;
  const etat = {
    position: null,         // { lat, lon, precision, quand } — en mémoire seulement
    recherche: false,       // une demande de position est en cours
    choix: null,            // le lieu choisi sur la grande carte
    tri: 'pays',
    dessinee: false,
  };
  let principale = null;
  let el = {};

  // ── Le fond ───────────────────────────────────────────────────────────────

  function charger() {
    if (fond) return Promise.resolve(fond);
    if (!chargement) {
      chargement = fetch('data/carte.json')
        .then((r) => { if (!r.ok) throw new Error('carte : ' + r.status); return r.json(); })
        .then((d) => { fond = d; return d; })
        .catch((e) => { chargement = null; throw e; });
    }
    return chargement;
  }

  // ── Géographie ────────────────────────────────────────────────────────────

  const RAYON_TERRE = 6371.0088;
  const TOUR_TERRE = 40075.017;
  const rad = (d) => d * Math.PI / 180;

  /* [latitude, longitude] → [x, y] dans les unités du fond. */
  function projeter(lat, lon) {
    const t = fond.taille;
    const phi = rad(Math.max(fond.latMin, Math.min(fond.latMax, lat)));
    return [(lon + 180) / 360 * t, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2 * t];
  }
  function deprojeter(x, y) {
    const t = fond.taille;
    const lon = x / t * 360 - 180;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / t))) * 180 / Math.PI;
    return [lat, lon];
  }
  const unitesParKm = (lat) => fond.taille / (TOUR_TERRE * Math.cos(rad(lat)));

  /* Distance à vol d'oiseau, en kilomètres (haversine). */
  function distance(a, b) {
    const dLat = rad(b[0] - a[0]);
    const dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * RAYON_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* Le cap initial de a vers b, en clair : « au sud-ouest ». */
  const DIRECTIONS = ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'];
  function direction(a, b) {
    const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
    const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
    const cap = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return DIRECTIONS[Math.round(cap / 45) % 8];
  }

  function kmLisible(km) {
    if (km < 1) return Math.max(50, Math.round(km * 20) * 50).toLocaleString('fr-FR') + ' m';
    if (km < 10) return (Math.round(km * 10) / 10).toLocaleString('fr-FR') + ' km';
    return Math.round(km).toLocaleString('fr-FR') + ' km';
  }

  /* « 42° 52′ 32″ N, 1° 49′ 56″ E » */
  function degres(lat, lon) {
    const un = (v, pos, neg) => {
      const a = Math.abs(v);
      let d = Math.floor(a);
      let m = Math.floor((a - d) * 60);
      let s = Math.round(((a - d) * 60 - m) * 60);
      if (s === 60) { s = 0; m += 1; }
      if (m === 60) { m = 0; d += 1; }
      return d + '° ' + String(m).padStart(2, '0') + '′ ' + String(s).padStart(2, '0') + '″ ' + (v < 0 ? neg : pos);
    };
    return un(lat, 'N', 'S') + ', ' + un(lon, 'E', 'O');
  }

  /* « à 245 km au sud-ouest » de la position, ou '' sans position. */
  function eloignement(a) {
    if (!etat.position || !a.g) return '';
    const ici = [etat.position.lat, etat.position.lon];
    const km = distance(ici, a.g);
    if (km < 0.2) return 'vous y êtes';
    return 'à ' + kmLisible(km) + (km >= 1 ? ' ' + direction(ici, a.g) : '');
  }

  // ── Les lieux ─────────────────────────────────────────────────────────────

  function lieux() {
    return Dictionnaire.articles.filter((a) => a.g && !a.perso);
  }

  /* Le pays : la fin de « lieu: » (« Aude, Occitanie, France » → « France »). */
  function pays(a) {
    const morceaux = String(a.lo || '').split(',');
    return morceaux[morceaux.length - 1].trim() || 'Ailleurs';
  }

  // ── Les itinéraires ───────────────────────────────────────────────────────

  function plateforme() {
    const ua = racine.navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && racine.navigator.maxTouchPoints > 1)) return 'apple';
    return 'autre';
  }

  /* Les liens qui mènent au lieu dans une application de cartes. Ils ne
   * portent que la destination. Le premier est le plus commode sur
   * l'appareil : Plans sur un iPhone, Google Maps ailleurs. */
  function itineraires(a) {
    const [lat, lon] = a.g;
    const coord = lat.toFixed(5) + ',' + lon.toFixed(5);
    const google = { nom: 'Google Maps', adresse: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(coord) };
    const osm = { nom: 'OpenStreetMap', adresse: 'https://www.openstreetmap.org/directions?route=' + encodeURIComponent(';' + coord) + '#map=12/' + lat.toFixed(5) + '/' + lon.toFixed(5) };
    const p = plateforme();
    if (p === 'apple') {
      return [{ nom: 'Plans', adresse: 'https://maps.apple.com/?daddr=' + encodeURIComponent(coord) + '&q=' + encodeURIComponent(a.n) }, google, osm];
    }
    const liste = [google, osm];
    // « geo: » ouvre le choix des applications de cartes installées (Waze, OsmAnd, Organic Maps…)
    if (p === 'android') liste.push({ nom: 'Autre application', adresse: 'geo:' + coord + '?q=' + coord + '(' + encodeURIComponent(a.n) + ')', local: true });
    return liste;
  }

  function lienExterieur(classe, texte, adresse, etiquette, local) {
    const l = element('a', classe, texte);
    l.href = adresse;
    if (!local) {
      l.target = '_blank';
      l.rel = 'noopener noreferrer';
    }
    l.setAttribute('aria-label', etiquette);
    return l;
  }

  function blocItineraire(a, classe) {
    const rang = element('div', 'itineraire ' + (classe || ''));
    itineraires(a).forEach((it, i) => {
      rang.appendChild(lienExterieur(i === 0 ? 'bouton-principal itineraire-lien' : 'bouton-discret itineraire-lien',
        (i === 0 ? 'Itinéraire · ' : '') + it.nom + (it.local ? '' : ' ↗'),
        it.adresse, 'Itinéraire vers ' + a.n + ' avec ' + it.nom + (it.local ? '' : ' (site extérieur)'), it.local));
    });
    return rang;
  }

  // ── Une carte ─────────────────────────────────────────────────────────────

  /* Mesure de la largeur d'un nom, pour éviter les chevauchements. */
  const mesureur = document.createElement('canvas').getContext('2d');
  const largeurs = new Map();
  function largeur(texte, police) {
    const cle = police + '|' + texte;
    if (!largeurs.has(cle)) {
      mesureur.font = police;
      largeurs.set(cle, mesureur.measureText(texte).width);
    }
    return largeurs.get(cle);
  }

  const reduit = () => racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* options : { interactive, auChoix(id), auVide() } */
  function creer(options) {
    const o = Object.assign({ interactive: true, auChoix: null, auVide: null }, options);
    const boite = element('div', 'carte-boite' + (o.interactive ? ' interactive' : ''));
    const base = svg('svg', { class: 'carte-fond', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    const [cx, cy, cl, ch] = fond.cadre;
    base.appendChild(svg('rect', { class: 'c-mer', x: -fond.taille, y: cy - fond.taille, width: fond.taille * 3, height: ch + fond.taille * 2 }));
    base.appendChild(svg('path', { class: 'c-terre', d: fond.couches.terre }));
    base.appendChild(svg('path', { class: 'c-lac', d: fond.couches.lacs }));
    base.appendChild(svg('path', { class: 'c-fleuve', d: fond.couches.fleuves }));
    base.appendChild(svg('path', { class: 'c-frontiere', d: fond.couches.frontieres }));
    const dessus = svg('svg', { class: 'carte-dessus', 'aria-hidden': 'true', focusable: 'false' });
    const gVilles = svg('g', { class: 'c-villes' });
    const gPosition = svg('g', { class: 'c-position' });
    const gLieux = svg('g', { class: 'c-lieux' });
    const gNoms = svg('g', { class: 'c-noms' });
    // les points des lieux passent au-dessus des noms : un nom forcé (celui du
    // lieu choisi) ne cache jamais un lieu voisin
    dessus.appendChild(gVilles);
    dessus.appendChild(gNoms);
    dessus.appendChild(gPosition);
    dessus.appendChild(gLieux);
    boite.appendChild(base);
    boite.appendChild(dessus);

    const vue = { x: cx, y: cy, w: cl };
    let L = 1;
    let H = 1;
    let choisi = null;
    let animation = null;
    let attente = 0;

    // Les marqueurs des lieux, faits une fois
    const marqueurs = lieux().map((a) => {
      const [x, y] = projeter(a.g[0], a.g[1]);
      const g = svg('g', { class: 'c-lieu cat-' + a.c });
      g.appendChild(svg('circle', { class: 'c-halo', r: 11 }));
      g.appendChild(svg('circle', { class: 'c-point', r: 5.5 }));
      gLieux.appendChild(g);
      return { a, x, y, g, px: 0, py: 0, dedans: false };
    });
    const nomsLieux = new Map();
    const nomsVilles = new Map();
    const pointsVilles = new Map();

    function mesurer() {
      const r = boite.getBoundingClientRect();
      L = Math.max(1, r.width);
      H = Math.max(1, r.height);
    }

    /* La vue reste dans le monde, entre le continent entier et une vallée. */
    function borner() {
      const latC = deprojeter(vue.x + vue.w / 2, vue.y + vue.w * H / L / 2)[0];
      const wMin = 18 * unitesParKm(Math.min(70, Math.abs(latC)));
      const wMax = Math.min(fond.taille, ch * L / H);
      vue.w = Math.max(wMin, Math.min(wMax, vue.w));
      const h = vue.w * H / L;
      vue.x = Math.max(0, Math.min(fond.taille - vue.w, vue.x));
      vue.y = Math.max(cy, Math.min(cy + ch - h, vue.y));
    }

    const versPixels = (x, y) => [(x - vue.x) / vue.w * L, (y - vue.y) / vue.w * L];

    function appliquer() {
      borner();
      const h = vue.w * H / L;
      base.setAttribute('viewBox', vue.x + ' ' + vue.y + ' ' + vue.w + ' ' + h);
      dessus.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
      poser();
    }

    function planifier() {
      if (attente) return;
      attente = racine.requestAnimationFrame(() => { attente = 0; appliquer(); });
    }

    /* Les marqueurs et les noms, en pixels ; les noms sans chevauchement. */
    function poser() {
      const taillePolice = parseFloat(racine.getComputedStyle(document.documentElement).fontSize) || 16;
      const pLieu = Math.round(taillePolice * 0.78);
      const pVille = Math.round(taillePolice * 0.69);
      const policeLieu = '600 ' + pLieu + 'px ' + 'system-ui, sans-serif';
      const policeVille = pVille + 'px system-ui, sans-serif';
      const pris = [];
      // deux noms gardent entre eux une marge de quelques pixels ; un nom peut
      // en revanche frôler un point (les boîtes des points portent `point`)
      const M = 4;
      const libre = (b) => b.x1 >= 0 && b.y1 >= 0 && b.x2 <= L && b.y2 <= H
        && !pris.some((p) => {
          const m = p.point ? 0 : M;
          return b.x1 - m < p.x2 && b.x2 + m > p.x1 && b.y1 - (m && 1) < p.y2 && b.y2 + (m && 1) > p.y1;
        });

      for (const m of marqueurs) {
        [m.px, m.py] = versPixels(m.x, m.y);
        m.dedans = m.px > -20 && m.py > -20 && m.px < L + 20 && m.py < H + 20;
        m.g.setAttribute('transform', 'translate(' + m.px.toFixed(1) + ' ' + m.py.toFixed(1) + ')');
        m.g.classList.toggle('choisi', m.a.id === choisi);
        if (m.dedans) pris.push({ x1: m.px - 6, y1: m.py - 6, x2: m.px + 6, y2: m.py + 6, point: true });
      }

      // La position
      gPosition.textContent = '';
      if (etat.position) {
        const [x, y] = projeter(etat.position.lat, etat.position.lon);
        const [px, py] = versPixels(x, y);
        const rayon = (etat.position.precision || 0) / 1000 * unitesParKm(etat.position.lat) / vue.w * L;
        if (rayon > 8) gPosition.appendChild(svg('circle', { class: 'c-precision', cx: px, cy: py, r: Math.min(rayon, 4 * Math.max(L, H)) }));
        gPosition.appendChild(svg('circle', { class: 'c-ici', cx: px, cy: py, r: 6.5 }));
      }

      // Les noms des lieux : le choisi d'abord, puis du centre vers les bords
      const visibles = new Set();
      const ordre = marqueurs.filter((m) => m.dedans).sort((a, b) => {
        if (a.a.id === choisi) return -1;
        if (b.a.id === choisi) return 1;
        return Math.hypot(a.px - L / 2, a.py - H / 2) - Math.hypot(b.px - L / 2, b.py - H / 2);
      });
      for (const m of ordre) {
        const l = largeur(m.a.n, policeLieu);
        const essais = [
          { x1: m.px + 8, y1: m.py - pLieu * 0.62, x2: m.px + 10 + l, y2: m.py + pLieu * 0.5, ancre: 'start', tx: m.px + 9 },
          { x1: m.px - 10 - l, y1: m.py - pLieu * 0.62, x2: m.px - 8, y2: m.py + pLieu * 0.5, ancre: 'end', tx: m.px - 9 },
        ];
        const b = essais.find((e) => libre(e)) || (m.a.id === choisi ? essais[0] : null);
        if (!b) continue;
        pris.push(b);
        visibles.add(m.a.id);
        let t = nomsLieux.get(m.a.id);
        if (!t) {
          t = svg('text', { class: 'c-nom-lieu' }, m.a.n);
          nomsLieux.set(m.a.id, t);
          gNoms.appendChild(t);
        }
        t.setAttribute('x', b.tx.toFixed(1));
        t.setAttribute('y', (m.py + pLieu * 0.34).toFixed(1));
        t.setAttribute('text-anchor', b.ancre);
        t.classList.toggle('choisi', m.a.id === choisi);
      }
      for (const [id, t] of nomsLieux) t.classList.toggle('cache', !visibles.has(id));

      // Les villes, selon le zoom : plus on s'approche, plus il y en a
      const latC = deprojeter(vue.x + vue.w / 2, vue.y + vue.w * H / L / 2)[0];
      const kmLarge = vue.w / unitesParKm(Math.min(70, Math.abs(latC)));
      const rangMax = kmLarge > 7000 ? 1 : kmLarge > 3200 ? 2 : kmLarge > 1500 ? 3 : kmLarge > 700 ? 4 : 5;
      const villesVues = new Set();
      for (const [nom, x, y, rang] of fond.villes) {
        if (rang > rangMax) continue;
        const [px, py] = versPixels(x, y);
        if (px < 0 || py < 0 || px > L || py > H) continue;
        const l = largeur(nom, policeVille);
        const b = { x1: px - 3, y1: py - pVille * 0.7, x2: px + 6 + l, y2: py + pVille * 0.45 };
        if (!libre(b)) continue;
        pris.push(b);
        const cle = nom + x;
        villesVues.add(cle);
        let t = nomsVilles.get(cle);
        let p = pointsVilles.get(cle);
        if (!t) {
          t = svg('text', { class: 'c-nom-ville' }, nom);
          p = svg('circle', { class: 'c-ville', r: 2 });
          nomsVilles.set(cle, t);
          pointsVilles.set(cle, p);
          gVilles.appendChild(p);
          gVilles.appendChild(t);
        }
        t.setAttribute('x', (px + 5).toFixed(1));
        t.setAttribute('y', (py + pVille * 0.34).toFixed(1));
        p.setAttribute('cx', px.toFixed(1));
        p.setAttribute('cy', py.toFixed(1));
      }
      for (const [cle, t] of nomsVilles) {
        const cache = !villesVues.has(cle);
        t.classList.toggle('cache', cache);
        pointsVilles.get(cle).classList.toggle('cache', cache);
      }
    }

    // ── Cadrer ────────────────────────────────────────────────────────────

    /* Centre la vue sur [lat, lon], large de `km` kilomètres. */
    function centrer(lat, lon, km, anime) {
      const [x, y] = projeter(lat, lon);
      const w = km * unitesParKm(Math.min(70, Math.abs(lat)));
      aller({ x: x - w / 2, y: y - w * H / L / 2, w }, anime);
    }

    /* Tient tous les points [lat, lon] dans la vue ; `serre` : sans marge. */
    function englober(points, anime, serre) {
      if (!points.length) return;
      const xy = points.map(([lat, lon]) => projeter(lat, lon));
      const xs = xy.map((p) => p[0]);
      const ys = xy.map((p) => p[1]);
      const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      // une marge en pixels : les noms et les boutons ne doivent pas mordre sur les points
      const margeX = serre ? 0 : Math.min(70, L / 4);
      const margeY = serre ? 0 : Math.min(64, H / 4);
      const w = Math.max((x2 - x1) * L / (L - 2 * margeX), (y2 - y1) * L / (H - 2 * margeY), 60 * unitesParKm(45));
      aller({ x: (x1 + x2) / 2 - w / 2, y: (y1 + y2) / 2 - w * H / L / 2, w }, anime);
    }

    function aller(cible, anime) {
      if (animation) racine.cancelAnimationFrame(animation);
      animation = null;
      if (!anime || reduit() || !boite.isConnected) {
        Object.assign(vue, cible);
        appliquer();
        return;
      }
      const depart = Object.assign({}, vue);
      const debut = racine.performance.now();
      const duree = 420;
      // le zoom s'interpole en logarithme : grossir et réduire vont au même pas
      const pas = (t) => {
        const k = Math.min(1, (t - debut) / duree);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const w = Math.exp(Math.log(depart.w) + (Math.log(cible.w) - Math.log(depart.w)) * e);
        const cxD = depart.x + depart.w / 2;
        const cyD = depart.y + depart.w * H / L / 2;
        const cxC = cible.x + cible.w / 2;
        const cyC = cible.y + cible.w * H / L / 2;
        const cxx = cxD + (cxC - cxD) * e;
        const cyy = cyD + (cyC - cyD) * e;
        vue.w = w;
        vue.x = cxx - w / 2;
        vue.y = cyy - w * H / L / 2;
        appliquer();
        animation = k < 1 ? racine.requestAnimationFrame(pas) : null;
      };
      animation = racine.requestAnimationFrame(pas);
    }

    /* Grossit (facteur < 1) ou réduit autour d'un point de l'écran. */
    function zoomer(facteur, px, py) {
      const fx = px === undefined ? 0.5 : px / L;
      const fy = py === undefined ? 0.5 : py / H;
      const h = vue.w * H / L;
      const X = vue.x + fx * vue.w;
      const Y = vue.y + fy * h;
      vue.w *= facteur;
      vue.x = X - fx * vue.w;
      vue.y = Y - fy * vue.w * H / L;
      planifier();
    }

    function choisir(id, centrerSur) {
      choisi = id;
      const m = marqueurs.find((x) => x.a.id === id);
      if (m && centrerSur) {
        const kmLarge = vue.w / unitesParKm(Math.min(70, Math.abs(m.a.g[0])));
        centrer(m.a.g[0], m.a.g[1], Math.min(kmLarge, 900), true);
      } else {
        planifier();
      }
    }

    // ── Les gestes ────────────────────────────────────────────────────────

    /* Le lieu le plus proche d'un point touché, à 24 pixels au plus. */
    function lieuSous(px, py) {
      let meilleur = null;
      let d0 = 24;
      for (const m of marqueurs) {
        if (!m.dedans) continue;
        const d = Math.hypot(m.px - px, m.py - py);
        if (d < d0) { d0 = d; meilleur = m; }
      }
      return meilleur;
    }

    if (o.interactive) {
      boite.tabIndex = 0;
      boite.setAttribute('role', 'application');
      boite.setAttribute('aria-roledescription', 'carte');
      boite.setAttribute('aria-label', 'Carte des lieux. Glisser pour déplacer, pincer ou plus et moins pour grossir. La liste des lieux suit la carte.');
      const doigts = new Map();
      let geste = null;
      let dernierTap = 0;
      const local = (e) => {
        const r = boite.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      const debuterGeste = () => {
        const pts = Array.from(doigts.values());
        geste = { vue: Object.assign({}, vue), pts: pts.map((p) => p.slice()), bouge: geste ? geste.bouge : 0 };
      };
      boite.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        if (animation) { racine.cancelAnimationFrame(animation); animation = null; }
        boite.setPointerCapture(e.pointerId);
        doigts.set(e.pointerId, local(e));
        if (doigts.size === 1) geste = null;
        debuterGeste();
      });
      boite.addEventListener('pointermove', (e) => {
        if (!doigts.has(e.pointerId) || !geste) return;
        doigts.set(e.pointerId, local(e));
        const pts = Array.from(doigts.values());
        const g = geste;
        const h0 = g.vue.w * H / L;
        if (pts.length === 1 && g.pts.length === 1) {
          const dx = pts[0][0] - g.pts[0][0];
          const dy = pts[0][1] - g.pts[0][1];
          g.bouge = Math.max(g.bouge, Math.hypot(dx, dy));
          vue.w = g.vue.w;
          vue.x = g.vue.x - dx / L * g.vue.w;
          vue.y = g.vue.y - dy / H * h0;
        } else if (pts.length >= 2 && g.pts.length >= 2) {
          const d0 = Math.hypot(g.pts[0][0] - g.pts[1][0], g.pts[0][1] - g.pts[1][1]) || 1;
          const d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
          const m0 = [(g.pts[0][0] + g.pts[1][0]) / 2, (g.pts[0][1] + g.pts[1][1]) / 2];
          const m1 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
          g.bouge = 99;
          const X = g.vue.x + m0[0] / L * g.vue.w;
          const Y = g.vue.y + m0[1] / H * h0;
          vue.w = g.vue.w * d0 / d1;
          vue.x = X - m1[0] / L * vue.w;
          vue.y = Y - m1[1] / H * vue.w * H / L;
        }
        planifier();
      });
      const finir = (e) => {
        if (!doigts.has(e.pointerId)) return;
        const pt = doigts.get(e.pointerId);
        doigts.delete(e.pointerId);
        const tap = geste && geste.bouge < 6 && doigts.size === 0 && e.type === 'pointerup';
        if (doigts.size) debuterGeste();
        else if (tap) {
          const m = lieuSous(pt[0], pt[1]);
          const maintenant = Date.now();
          if (m) {
            choisi = m.a.id;
            planifier();
            if (o.auChoix) o.auChoix(m.a.id);
          } else if (maintenant - dernierTap < 320) {
            zoomer(0.5, pt[0], pt[1]);
          } else if (o.auVide) {
            o.auVide();
          }
          dernierTap = m ? 0 : maintenant;
        }
        if (!doigts.size) geste = null;
      };
      boite.addEventListener('pointerup', finir);
      boite.addEventListener('pointercancel', finir);
      boite.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [px, py] = local(e);
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomer(Math.exp(Math.max(-1, Math.min(1, delta * 0.0018))), px, py);
      }, { passive: false });
      boite.addEventListener('keydown', (e) => {
        const h = vue.w * H / L;
        const pas = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key];
        if (pas) { vue.x += pas[0] * vue.w; vue.y += pas[1] * h; planifier(); e.preventDefault(); return; }
        if (e.key === '+' || e.key === '=') { zoomer(0.6); e.preventDefault(); }
        if (e.key === '-' || e.key === '_') { zoomer(1 / 0.6); e.preventDefault(); }
      });
    }

    if (racine.ResizeObserver) {
      new ResizeObserver(() => { mesurer(); appliquer(); }).observe(boite);
    }

    return {
      noeud: boite,
      demarrer() { mesurer(); appliquer(); },
      centrer, englober, zoomer, choisir,
      rafraichir: planifier,
      get choisi() { return choisi; },
    };
  }

  // ── La grande carte, l'onglet « Carte » ──────────────────────────────────

  /* L'Europe et la Méditerranée, où sont presque tous les lieux. */
  const DEPART = [[59, -9], [29, 31], [31, 35.2]];

  function boutonCarte(classe, texte, titre, action) {
    const b = bouton('bouton-carte ' + classe, texte, action);
    b.setAttribute('aria-label', titre);
    b.setAttribute('title', titre);
    return b;
  }

  async function dessinerOnglet() {
    el.cadre.textContent = '';
    el.cadre.appendChild(element('p', 'discret carte-attente', 'Chargement de la carte…'));
    try {
      await charger();
    } catch (e) {
      el.cadre.textContent = '';
      el.cadre.appendChild(element('p', 'discret', 'La carte n’a pas pu être chargée.'));
      return;
    }
    el.cadre.textContent = '';
    principale = creer({
      interactive: true,
      auChoix: (id) => montrerChoix(id, false),
      auVide: () => montrerChoix(null),
    });
    el.cadre.appendChild(principale.noeud);

    const zoom = element('div', 'carte-zoom');
    zoom.appendChild(boutonCarte('plus', '+', 'Grossir', () => principale.zoomer(0.5)));
    zoom.appendChild(boutonCarte('moins', '−', 'Réduire', () => principale.zoomer(2)));
    zoom.appendChild(boutonCarte('tout', '', 'Voir tous les lieux', () => principale.englober(lieux().map((a) => a.g), true)));
    zoom.lastChild.appendChild(iconeTout());
    el.cadre.appendChild(zoom);

    el.situer = bouton('bouton-carte bouton-situer', '', demanderPosition);
    el.situer.appendChild(iconeCible());
    el.situer.appendChild(element('span', 'situer-texte', 'Me situer'));
    el.cadre.appendChild(el.situer);
    el.cadre.appendChild(element('p', 'carte-credit', 'Fond : Natural Earth'));

    principale.demarrer();
    principale.englober(DEPART, false, true);
    etat.dessinee = true;
    if (etat.choix) montrerChoix(etat.choix, true);
    dessinerPosition();
    dessinerListe();
  }

  function iconeTout() {
    const s = svg('svg', { class: 'icone', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svg('path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }));
    return s;
  }
  function iconeCible() {
    const s = svg('svg', { class: 'icone', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svg('circle', { cx: 12, cy: 12, r: 6.5 }));
    s.appendChild(svg('circle', { cx: 12, cy: 12, r: 2, class: 'plein' }));
    s.appendChild(svg('path', { d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3' }));
    return s;
  }
  function iconeEpingle() {
    const s = svg('svg', { class: 'icone epingle', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svg('path', { d: 'M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z' }));
    s.appendChild(svg('circle', { cx: 12, cy: 9.8, r: 2.3 }));
    return s;
  }

  /* La carte du lieu choisi, sous la carte. */
  function montrerChoix(id, centrerSur) {
    etat.choix = id;
    if (!el.choix) return;
    el.choix.textContent = '';
    const a = id ? Dictionnaire.parId(id) : null;
    if (!a) {
      el.choix.hidden = true;
      if (principale) principale.choisir(null);
      return;
    }
    if (principale) principale.choisir(id, centrerSur);
    const carte = element('article', 'choix-lieu cat-' + a.c);
    const tete = element('div', 'choix-tete');
    const p = element('span', 'pastille-cat cat-' + a.c);
    p.appendChild(element('span', 'point-cat'));
    p.appendChild(document.createTextNode(Dictionnaire.categorie(a.c).nom));
    tete.appendChild(p);
    const x = bouton('choix-fermer', '✕', () => montrerChoix(null));
    x.setAttribute('aria-label', 'Fermer');
    tete.appendChild(x);
    carte.appendChild(tete);
    const corps = element('div', 'choix-corps');
    const textes = element('div', 'choix-textes');
    textes.appendChild(element('h3', 'choix-nom', a.n));
    const sous = [a.lo, eloignement(a)].filter(Boolean).join(' · ');
    if (sous) textes.appendChild(element('p', 'discret choix-lieu-texte', sous));
    corps.appendChild(textes);
    if (a.im && a.im[0]) corps.appendChild(Illustrations.image(a.im[0], 'image-choix'));
    carte.appendChild(corps);
    carte.appendChild(element('p', 'choix-def', a.defNue));
    const actions = element('div', 'choix-actions');
    const lire = bouton('bouton-principal', 'Lire l’article', () => Fiche.ouvrir(a.id));
    lire.setAttribute('data-ref', a.id);
    actions.appendChild(lire);
    carte.appendChild(actions);
    carte.appendChild(blocItineraire(a, 'choix-itineraire'));
    el.choix.appendChild(carte);
    el.choix.hidden = false;
  }

  // ── La position ───────────────────────────────────────────────────────────

  function demanderPosition() {
    if (etat.recherche) return;
    if (!racine.navigator.geolocation) {
      Outils.annoncer('Ce navigateur ne sait pas donner la position.');
      return;
    }
    etat.recherche = true;
    dessinerPosition();
    racine.navigator.geolocation.getCurrentPosition((p) => {
      etat.recherche = false;
      etat.position = { lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy, quand: Date.now() };
      etat.tri = 'distance';
      document.dispatchEvent(new CustomEvent('position-change'));
      const proche = plusProches(1)[0];
      if (principale) {
        const ici = [etat.position.lat, etat.position.lon];
        // la position et le lieu le plus proche, s'il n'est pas au bout du monde
        if (proche && distance(ici, proche.g) < 1500) principale.englober([ici, proche.g], true);
        else principale.centrer(ici[0], ici[1], 600, true);
      }
      dessinerPosition();
      dessinerListe();
      if (etat.choix) montrerChoix(etat.choix, false);
      if (proche) Outils.annoncer('Le lieu le plus proche : ' + proche.n + ', ' + eloignement(proche) + '.');
    }, (erreur) => {
      etat.recherche = false;
      dessinerPosition();
      const raisons = {
        1: 'La position n’a pas été autorisée : la carte marche très bien sans.',
        2: 'La position est introuvable pour le moment.',
        3: 'La position tarde trop à venir ; réessayez dehors ou plus tard.',
      };
      Outils.annoncer(raisons[erreur && erreur.code] || 'La position est indisponible.');
    }, { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 20000 });
  }

  function oublierPosition() {
    etat.position = null;
    if (etat.tri === 'distance') etat.tri = 'pays';
    document.dispatchEvent(new CustomEvent('position-change'));
    if (principale) principale.rafraichir();
    dessinerPosition();
    dessinerListe();
    if (etat.choix) montrerChoix(etat.choix, false);
  }

  function plusProches(n) {
    if (!etat.position) return [];
    const ici = [etat.position.lat, etat.position.lon];
    return lieux().map((a) => [distance(ici, a.g), a]).sort((x, y) => x[0] - y[0]).slice(0, n).map((x) => x[1]);
  }

  function dessinerPosition() {
    if (el.situer) {
      el.situer.classList.toggle('actif', !!etat.position);
      el.situer.classList.toggle('cherche', etat.recherche);
      el.situer.querySelector('.situer-texte').textContent = etat.recherche ? 'Recherche…' : etat.position ? 'Recentrer' : 'Me situer';
      el.situer.setAttribute('aria-label', etat.position ? 'Recentrer la carte sur ma position' : 'Me situer sur la carte');
    }
    if (principale) principale.rafraichir();
    el.etat.textContent = '';
    if (etat.position) {
      const p = element('p', 'discret position-etat');
      p.appendChild(document.createTextNode('Votre position est posée sur la carte (à ' + kmLisible((etat.position.precision || 0) / 1000) + ' près). Elle reste sur cet appareil, le temps de la visite. '));
      p.appendChild(bouton('lien-discret', 'L’oublier', oublierPosition));
      el.etat.appendChild(p);
    } else {
      el.etat.appendChild(element('p', 'discret position-etat', 'La position est facultative : « Me situer » la demande au navigateur pour ranger les lieux du plus proche au plus lointain. Elle n’est ni enregistrée ni envoyée.'));
    }
  }

  // ── La liste des lieux ────────────────────────────────────────────────────

  function ligneLieu(a, km) {
    const b = element('button', 'lieu-ligne cat-' + a.c);
    b.type = 'button';
    b.setAttribute('data-ref', a.id);
    b.appendChild(element('span', 'point-cat'));
    const textes = element('span', 'lieu-textes');
    textes.appendChild(element('span', 'lieu-nom', a.n));
    textes.appendChild(element('span', 'lieu-sous', a.lo));
    b.appendChild(textes);
    if (km !== undefined) b.appendChild(element('span', 'lieu-distance', kmLisible(km)));
    b.addEventListener('click', () => {
      montrerChoix(a.id, true);
      el.cadre.scrollIntoView({ behavior: reduit() ? 'auto' : 'smooth', block: 'start' });
    });
    return b;
  }

  function dessinerListe() {
    const tous = lieux();
    el.tri.textContent = '';
    for (const [cle, nom] of [['pays', 'Par pays'], ['distance', 'Du plus proche']]) {
      const b = bouton('', nom, () => {
        if (cle === 'distance' && !etat.position) { demanderPosition(); return; }
        etat.tri = cle;
        dessinerListe();
      });
      b.setAttribute('aria-pressed', etat.tri === cle ? 'true' : 'false');
      el.tri.appendChild(b);
    }
    el.liste.textContent = '';
    el.compte.textContent = Outils.pluriel(tous.length, 'lieu', 'lieux') + ' sur la carte';
    if (etat.tri === 'distance' && etat.position) {
      const ici = [etat.position.lat, etat.position.lon];
      const ol = element('ol', 'lieux-liste');
      for (const [km, a] of tous.map((x) => [distance(ici, x.g), x]).sort((x, y) => x[0] - y[0])) {
        const li = element('li');
        li.appendChild(ligneLieu(a, km));
        ol.appendChild(li);
      }
      el.liste.appendChild(ol);
      return;
    }
    const groupes = new Map();
    for (const a of tous) {
      const p = pays(a);
      if (!groupes.has(p)) groupes.set(p, []);
      groupes.get(p).push(a);
    }
    // la France d'abord (c'est là que sont la plupart), puis l'ordre alphabétique
    const noms = Array.from(groupes.keys()).sort((x, y) => (x === 'France' ? -1 : y === 'France' ? 1 : x.localeCompare(y, 'fr')));
    for (const p of noms) {
      el.liste.appendChild(element('h3', 'rubrique lieux-pays', p));
      const ul = element('ul', 'lieux-liste');
      for (const a of groupes.get(p).sort((x, y) => x.cleTri.localeCompare(y.cleTri, 'fr'))) {
        const li = element('li');
        li.appendChild(ligneLieu(a));
        ul.appendChild(li);
      }
      el.liste.appendChild(ul);
    }
  }

  function montrer() {
    if (!etat.dessinee) dessinerOnglet();
    else if (principale) principale.demarrer();
  }

  /* Depuis une fiche : « Voir sur la carte ». */
  function montrerLieu(id) {
    etat.choix = id;
    if (Fiche.ouverte) Fiche.fermer();
    App.aller('carte');
    if (etat.dessinee) montrerChoix(id, true);
  }

  // ── Le plan de situation, dans une fiche ─────────────────────────────────

  function blocFiche(a) {
    if (!a.g) return null;
    const bloc = element('section', 'situer');
    bloc.appendChild(element('h3', 'rubrique', 'Sur la carte'));
    const plan = bouton('plan-situation', '', () => montrerLieu(a.id));
    plan.setAttribute('aria-label', 'Voir ' + a.n + ' sur la carte');
    plan.appendChild(element('span', 'discret', 'Chargement de la carte…'));
    bloc.appendChild(plan);
    charger().then(() => {
      if (!plan.isConnected) return;
      plan.textContent = '';
      const mini = creer({ interactive: false });
      plan.appendChild(mini.noeud);
      mini.demarrer();
      mini.choisir(a.id);
      mini.centrer(a.g[0], a.g[1], 320, false);
      plan.appendChild(element('span', 'plan-legende', 'Toucher pour ouvrir la carte'));
    }).catch(() => { plan.textContent = ''; plan.appendChild(element('span', 'discret', 'La carte n’a pas pu être chargée.')); });

    const coord = element('p', 'coordonnees');
    coord.appendChild(iconeEpingle());
    coord.appendChild(element('span', 'coordonnees-texte', degres(a.g[0], a.g[1])));
    coord.appendChild(bouton('lien-discret', 'Copier', async () => {
      const ok = await Outils.copier(a.g[0].toFixed(5) + ', ' + a.g[1].toFixed(5));
      Outils.annoncer(ok ? 'Coordonnées copiées.' : a.g[0].toFixed(5) + ', ' + a.g[1].toFixed(5));
    }));
    bloc.appendChild(coord);
    const loin = eloignement(a);
    if (loin) bloc.appendChild(element('p', 'discret distance-fiche', 'Depuis votre position : ' + loin + ', à vol d’oiseau.'));
    bloc.appendChild(blocItineraire(a, 'fiche-itineraire'));
    bloc.appendChild(element('p', 'discret ailleurs-note', 'L’itinéraire s’ouvre dans une application de cartes, qui ne reçoit que la destination.'));
    return bloc;
  }

  function brancher() {
    el = {
      cadre: document.getElementById('carte-cadre'),
      choix: document.getElementById('carte-choix'),
      etat: document.getElementById('carte-position'),
      tri: document.getElementById('carte-tri'),
      liste: document.getElementById('carte-liste'),
      compte: document.getElementById('carte-compte'),
    };
  }

  racine.Carte = {
    brancher, montrer, montrerLieu, blocFiche, charger, demanderPosition, oublierPosition,
    distance, degres, itineraires, eloignement, lieux,
    get position() { return etat.position; },
    get principale() { return principale; },
  };

})(window);
