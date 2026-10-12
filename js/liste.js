'use strict';
/*
 * L'onglet « Dictionnaire » : la recherche, les catégories, la liste A → Z.
 *
 * Sans requête, on voit l'article du jour, les portes d'entrée (par où
 * commencer quand on ne sait rien), les articles récemment consultés, puis le
 * dictionnaire entier dans l'ordre alphabétique, regroupé par lettre, avec une
 * réglette de lettres sur le bord. « Le Bateleur » se range à B, comme dans
 * un dictionnaire imprimé.
 *
 * Avec une requête, la liste devient des résultats classés : la vedette
 * d'abord, puis les autres noms (« Zarathoustra » mène à Zoroastre, et le nom
 * est montré à côté), puis les articles qui contiennent les mots tapés — ceux
 * qui en parlent le plus en premier. Rien du tout ? On propose les articles
 * à une faute de frappe près.
 *
 * Au clavier : « / » ou Ctrl+K pour chercher (voir app.js), ↓ et ↑ pour
 * parcourir, Entrée ouvre l'article quand la requête le désigne, Échap efface.
 */
(function (racine) {

  const { element, bouton } = Outils;

  const etat = { cat: null, q: '', suivis: new Map(), jeton: 0, lettres: [] };
  let el = {};
  let minuterie = null;

  async function chargerSuivis() {
    try {
      etat.suivis = new Map((await Store.tousLesSuivis()).map((l) => [l.ref, l]));
    } catch (e) {
      etat.suivis = new Map();
    }
  }

  // ── Une ligne ─────────────────────────────────────────────────────────────

  function signe(a) {
    if (a.gl && Glyphes[a.gl]) return Glyphes.svg(a.gl, 'glyphe-ligne');
    return element('span', 'point-cat');
  }

  function ligne(a, via, requete) {
    const b = element('button', 'article-ligne cat-' + a.c);
    b.type = 'button';
    b.setAttribute('data-ref', a.id);
    const tete = element('span', 'article-ligne-tete');
    tete.appendChild(signe(a));
    const mot = element('span', 'article-mot');
    if (requete && via !== 'texte') mot.appendChild(Outils.surligner(a.n, requete));
    else mot.textContent = a.n;
    tete.appendChild(mot);
    if (requete && via && via !== 'texte') {
      const nom = Dictionnaire.graphie(a, via);
      if (nom && nom !== a.n) {
        const alias = element('span', 'via-alias');
        alias.appendChild(Outils.surligner(nom, requete));
        tete.appendChild(alias);
      }
    }
    if (a.da && a.c === 'figures') tete.appendChild(element('span', 'ligne-dates', a.da));
    const suivi = etat.suivis.get(a.id);
    if (a.perso) tete.appendChild(element('span', 'pastille', 'à moi'));
    if (suivi && suivi.favori) {
      const f = element('span', 'marque-favori', '★');
      f.setAttribute('title', 'favori');
      tete.appendChild(f);
    }
    if (suivi && suivi.aRevoir) {
      const f = element('span', 'marque-revoir', '⚑');
      f.setAttribute('title', 'à revoir');
      tete.appendChild(f);
    }
    if (via === 'texte') tete.appendChild(element('span', 'via', 'dans le texte'));
    b.appendChild(tete);
    if (a.defNue) {
      const s = element('span', 'apercu');
      if (requete && via === 'texte') s.appendChild(Outils.surligner(extrait(a, requete), requete));
      else s.textContent = a.defNue;
      b.appendChild(s);
    }
    b.addEventListener('click', () => Fiche.ouvrir(a.id, { surligne: via === 'texte' ? requete : null }));
    return b;
  }

  /* Trouvé dans le texte : on montre le passage, pas la définition, si les
   * mots n'y sont pas. */
  function extrait(a, requete) {
    if (Outils.plages(a.defNue, requete).length) return a.defNue;
    const texte = (a.t || []).map(Dictionnaire.nu).join(' ');
    const p = Outils.plages(texte, requete);
    if (!p.length) return a.defNue;
    const debut = Math.max(0, texte.lastIndexOf(' ', Math.max(0, p[0][0] - 60)));
    const fin = Math.min(texte.length, p[0][1] + 110);
    return (debut > 0 ? '… ' : '') + texte.slice(debut, fin).trim() + (fin < texte.length ? ' …' : '');
  }

  // ── Filtres ───────────────────────────────────────────────────────────────

  function dessinerFiltres() {
    el.filtres.textContent = '';
    const tous = bouton('filtre' + (etat.cat ? '' : ' actif'), 'Tout', () => choisirCat(null));
    tous.setAttribute('aria-pressed', etat.cat ? 'false' : 'true');
    el.filtres.appendChild(tous);
    const cats = Dictionnaire.categories.slice();
    if (Dictionnaire.articles.some((a) => a.perso)) cats.push(Dictionnaire.CATEGORIE_PERSO);
    for (const cat of cats) {
      const b = bouton('filtre cat-' + cat.id + (etat.cat === cat.id ? ' actif' : ''), '', () => choisirCat(etat.cat === cat.id ? null : cat.id));
      b.appendChild(element('span', 'point-cat'));
      b.appendChild(document.createTextNode(cat.nom));
      b.setAttribute('aria-pressed', etat.cat === cat.id ? 'true' : 'false');
      el.filtres.appendChild(b);
    }
  }

  function choisirCat(id) {
    etat.cat = id;
    dessinerFiltres();
    dessinerAccueil();
    dessiner();
    if (id) {
      const actif = el.filtres.querySelector('.filtre.actif');
      if (actif && actif.scrollIntoView) actif.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  // ── Accueil ───────────────────────────────────────────────────────────────

  async function dessinerAccueil() {
    etat.jeton += 1;
    const jeton = etat.jeton;
    el.duJour.textContent = '';
    const jour = Dictionnaire.articleDuJour();
    if (jour && !etat.cat) {
      const carte = element('button', 'carte-du-jour cat-' + jour.c);
      carte.type = 'button';
      const haut = element('div', 'du-jour-haut');
      const textes = element('div', 'du-jour-textes');
      textes.appendChild(element('p', 'du-jour-titre', 'Article du jour · ' + Dictionnaire.categorie(jour.c).nom));
      textes.appendChild(element('p', 'du-jour-mot', jour.n));
      if (jour.da) textes.appendChild(element('p', 'du-jour-dates', jour.da));
      haut.appendChild(textes);
      // l'image de l'article s'il en a une (une carte, un portrait, la première
      // vignette de sa planche), sinon son signe
      const image = (jour.im && jour.im[0]) || (jour.pl && jour.pl[0] && jour.pl[0].im[0]);
      if (image) haut.appendChild(Illustrations.image(image, 'image-du-jour'));
      else if (jour.gl && Glyphes[jour.gl]) haut.appendChild(Glyphes.svg(jour.gl, 'glyphe-du-jour'));
      carte.appendChild(haut);
      carte.appendChild(element('p', 'du-jour-def', jour.defNue));
      carte.addEventListener('click', () => Fiche.ouvrir(jour.id));
      el.duJour.appendChild(carte);
      el.duJour.hidden = false;
    } else {
      el.duJour.hidden = true;
    }

    el.portes.textContent = '';
    if (!etat.cat) {
      el.portes.appendChild(element('h3', 'rubrique', 'Par où commencer'));
      const rang = element('div', 'portes');
      for (const a of Dictionnaire.portes) {
        const b = bouton('porte cat-' + a.c, '', () => Fiche.ouvrir(a.id));
        if (a.gl && Glyphes[a.gl]) b.appendChild(Glyphes.svg(a.gl, 'glyphe-porte'));
        else b.appendChild(element('span', 'point-cat'));
        b.appendChild(element('span', 'porte-nom', a.n));
        b.setAttribute('data-ref', a.id);
        rang.appendChild(b);
      }
      el.portes.appendChild(rang);
    }

    let recents = [];
    try { recents = await Store.historique(); } catch (e) { recents = []; }
    if (jeton !== etat.jeton) return;
    el.recents.textContent = '';
    const liste = recents.map((r) => Dictionnaire.parId(r.ref)).filter(Boolean).filter((x) => !etat.cat || x.c === etat.cat).slice(0, 12);
    if (liste.length) {
      const tete = element('div', 'rubrique-ligne');
      tete.appendChild(element('h3', 'rubrique', 'Consultés récemment'));
      tete.appendChild(bouton('lien-discret', 'Effacer', async () => {
        await Store.effacerHistorique().catch(() => {});
        dessinerAccueil();
      }));
      el.recents.appendChild(tete);
      const rang = element('div', 'voisins');
      for (const x of liste) rang.appendChild(bouton('voisin cat-' + x.c, x.n, () => Fiche.ouvrir(x.id)));
      el.recents.appendChild(rang);
    }
  }

  // ── La réglette des lettres ───────────────────────────────────────────────

  function dessinerIndex(lettres) {
    etat.lettres = lettres;
    el.index.textContent = '';
    el.index.hidden = lettres.length < 4;
    el.vue.classList.toggle('avec-index', !el.index.hidden);
    el.index.style.setProperty('--n', String(lettres.length));
    for (const l of lettres) {
      const b = bouton('', l, () => sauterA(l));
      b.setAttribute('data-lettre', l);
      el.index.appendChild(b);
    }
  }

  function sauterA(lettre) {
    const entete = document.getElementById('lettre-' + (lettre === '#' ? 'autres' : lettre));
    const groupe = entete && entete.nextElementSibling;
    if (!groupe) return;
    const haut = groupe.getBoundingClientRect().top + racine.scrollY - entete.offsetHeight - el.recherche.offsetHeight;
    racine.scrollTo(0, Math.max(0, Math.round(haut)));
  }

  let glisse = false;
  let derniere = null;

  function lettreSous(y) {
    const r = el.index.getBoundingClientRect();
    const n = etat.lettres.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * n)));
    return etat.lettres[i];
  }

  function surIndex(e) {
    if (e.type === 'pointerdown') {
      glisse = true;
      derniere = null;
      try { el.index.setPointerCapture(e.pointerId); } catch (x) { /* rien */ }
      el.index.classList.add('actif');
    }
    if (!glisse) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      glisse = false;
      el.index.classList.remove('actif');
      el.bulle.hidden = true;
      return;
    }
    e.preventDefault();
    const l = lettreSous(e.clientY);
    el.bulle.textContent = l;
    el.bulle.style.top = e.clientY + 'px';
    el.bulle.hidden = false;
    if (l !== derniere) { derniere = l; sauterA(l); }
  }

  // ── La liste ──────────────────────────────────────────────────────────────

  function dessiner() {
    const q = etat.q.trim();
    el.liste.textContent = '';
    el.rien.hidden = true;
    el.accueil.hidden = !!q;
    el.hasard.hidden = !!q;

    if (!q) {
      const tous = Dictionnaire.articles.filter((x) => !etat.cat || x.c === etat.cat);
      el.compte.textContent = Outils.pluriel(tous.length, 'article', 'articles');
      const lettres = [];
      let groupe = null;
      for (const a of tous) {
        if (a.lettre !== lettres[lettres.length - 1]) {
          lettres.push(a.lettre);
          const entete = element('h3', 'lettre', a.lettre === '#' ? '#' : a.lettre);
          entete.id = 'lettre-' + (a.lettre === '#' ? 'autres' : a.lettre);
          el.liste.appendChild(entete);
          groupe = element('div', 'groupe');
          el.liste.appendChild(groupe);
        }
        groupe.appendChild(ligne(a));
      }
      dessinerIndex(lettres);
      suivreDefilement();
      if (!tous.length) el.liste.appendChild(element('p', 'vide discret', 'Rien ici pour l’instant.'));
      return;
    }

    dessinerIndex([]);
    const trouves = Dictionnaire.chercher(q, { cat: etat.cat });
    el.compte.textContent = Outils.pluriel(trouves.length, 'article', 'articles');
    if (!trouves.length) {
      el.rien.hidden = false;
      el.rienAjouter.textContent = 'Écrire l’article « ' + (q.length > 30 ? q.slice(0, 30) + '…' : q) + ' »';
      dessinerSuggestions(q);
      return;
    }
    const groupe = element('div', 'groupe');
    for (const { article, via } of trouves.slice(0, 150)) groupe.appendChild(ligne(article, via, q));
    el.liste.appendChild(groupe);
  }

  function dessinerSuggestions(q) {
    el.suggestionsListe.textContent = '';
    const ailleurs = etat.cat ? Dictionnaire.chercher(q).length : 0;
    if (ailleurs) {
      el.suggestionsListe.appendChild(bouton('bouton-discret partout', 'Chercher dans tout le dictionnaire (' + ailleurs + ')', () => choisirCat(null)));
    }
    for (const x of Dictionnaire.suggerer(q, { cat: etat.cat })) {
      el.suggestionsListe.appendChild(bouton('voisin cat-' + x.c, x.n, () => Fiche.ouvrir(x.id)));
    }
    el.suggestions.hidden = !el.suggestionsListe.childNodes.length;
  }

  function surSaisie() {
    etat.q = el.q.value;
    el.vider.hidden = !etat.q;
    el.raccourci.hidden = !!etat.q;
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(dessiner, 90);
  }

  function vider() {
    el.q.value = '';
    surSaisie();
  }

  function surToucheRecherche(e) {
    if (e.key === 'Enter') {
      const q = el.q.value.trim();
      const trouves = q ? Dictionnaire.chercher(q, { cat: etat.cat }) : [];
      el.q.blur();
      if (trouves.length === 1 || (trouves.length && trouves[0].note === 100)) Fiche.ouvrir(trouves[0].article.id);
    } else if (e.key === 'ArrowDown') {
      const premiere = el.liste.querySelector('.article-ligne');
      if (premiere) { e.preventDefault(); premiere.focus(); }
    } else if (e.key === 'Escape') {
      if (el.q.value) { e.preventDefault(); vider(); } else el.q.blur();
    }
  }

  function surToucheListe(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const lignes = Array.from(el.liste.querySelectorAll('.article-ligne'));
    const i = lignes.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && i === 0) { el.q.focus(); return; }
    const voisine = lignes[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (voisine) voisine.focus();
  }

  function focaliser() {
    el.q.focus();
    el.q.select();
  }

  /* Ouvre la recherche sur une requête donnée (depuis un autre écran). */
  function chercherDepuis(q) {
    el.q.value = q;
    surSaisie();
  }

  function auHasard() {
    const vus = new Set(Array.from(etat.suivis.values()).filter((s) => s.vu).map((s) => s.ref));
    const a = Dictionnaire.auHasard({ cat: etat.cat, dejaVus: vus });
    if (a) Fiche.ouvrir(a.id);
  }

  function mesurerRecherche() {
    const h = el.recherche.offsetHeight;
    if (h) el.vue.style.setProperty('--haut-recherche', h + 'px');
  }

  function suivreDefilement() {
    if (el.vue.hidden) return;
    el.recherche.classList.toggle('colle', racine.scrollY > el.vue.offsetTop + 4);
    el.index.classList.toggle('visible', el.liste.getBoundingClientRect().top < racine.innerHeight * 0.45);
  }

  async function rafraichir() {
    await chargerSuivis();
    dessiner();
  }

  async function brancher() {
    el = {
      vue: document.getElementById('vue-dictionnaire'),
      recherche: document.getElementById('bloc-recherche'),
      q: document.getElementById('q'),
      vider: document.getElementById('q-vider'),
      raccourci: document.getElementById('q-raccourci'),
      filtres: document.getElementById('filtres'),
      accueil: document.getElementById('accueil'),
      duJour: document.getElementById('du-jour'),
      portes: document.getElementById('portes'),
      recents: document.getElementById('recents'),
      compte: document.getElementById('compte'),
      hasard: document.getElementById('b-hasard'),
      liste: document.getElementById('liste'),
      index: document.getElementById('index-lettres'),
      bulle: document.getElementById('index-bulle'),
      rien: document.getElementById('rien'),
      suggestions: document.getElementById('suggestions'),
      suggestionsListe: document.getElementById('suggestions-liste'),
      rienAjouter: document.getElementById('b-ajouter-depuis-recherche'),
    };
    el.q.addEventListener('input', surSaisie);
    el.q.addEventListener('keydown', surToucheRecherche);
    el.liste.addEventListener('keydown', surToucheListe);
    el.vider.addEventListener('click', () => { vider(); el.q.focus(); });
    el.hasard.addEventListener('click', auHasard);
    el.rienAjouter.addEventListener('click', () => Editeur.ouvrir({ type: 'article', nom: etat.q.trim() }));
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) el.index.addEventListener(type, surIndex);

    if (racine.ResizeObserver) new ResizeObserver(mesurerRecherche).observe(el.recherche);
    racine.addEventListener('scroll', suivreDefilement, { passive: true });

    document.addEventListener('reglages-changes', () => { dessinerAccueil(); dessiner(); mesurerRecherche(); });
    document.addEventListener('suivi-change', rafraichir);
    document.addEventListener('perso-change', () => { dessinerFiltres(); dessiner(); dessinerAccueil(); });
    document.addEventListener('fiche-fermee', () => { dessinerAccueil(); });
    document.addEventListener('vue-changee', suivreDefilement);

    await chargerSuivis();
    dessinerFiltres();
    await dessinerAccueil();
    dessiner();
    mesurerRecherche();
  }

  racine.Liste = { brancher, rafraichir, choisirCat, dessiner, focaliser, sauterA, chercherDepuis };

})(window);
