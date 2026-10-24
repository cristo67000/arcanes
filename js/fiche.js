'use strict';
/*
 * La fiche d'un article : ce qu'on voit en touchant une entrée.
 *
 * De haut en bas : la catégorie, la vedette, les dates ou le lieu, le signe ;
 * la définition ; les illustrations ; pour un lieu, son plan de situation et
 * l'itinéraire ; le corps de l'article, où chaque renvoi ouvre l'article cité,
 * avec sa figure et sa planche ; les extraits d'œuvres ; les repères ; les
 * œuvres ; la mise en garde ; l'étape suivante du parcours qu'on suit (son fil
 * est en tête de fiche) ; « voir aussi », « cité dans » et les parcours qui
 * passent par l'article ; la carte des liens (js/constellation.js) ; les liens
 * vers d'autres sites ;
 * les notes de la personne ; enfin l'article précédent et le suivant dans
 * l'ordre alphabétique, pour feuilleter.
 *
 * ── Le bouton « retour » du téléphone ──────────────────────────────────────
 *
 * Une fiche s'ouvre par-dessus la liste : le geste « retour » d'Android doit la
 * refermer, pas quitter l'application. Chaque ouverture ajoute donc une entrée
 * à l'historique (`pushState`) et `popstate` la défait. Suivre un renvoi en
 * ajoute une aussi : « retour » ramène à l'article d'où l'on venait, comme sur
 * un site. Après une fermeture par le bouton, le navigateur annonce le recul
 * par un `popstate` en retard : `Outils.reculer` le compte pour qu'il ne
 * referme pas la fiche suivante.
 */
(function (racine) {

  const { element, bouton, svg } = Outils;

  const etat = {
    pile: [],          // les articles ouverts, le dernier est à l'écran
    surlignes: [],     // la requête à surligner, par niveau de la pile
    contextes: [],     // le parcours suivi, par niveau de la pile (ou null)
    ouverte: false,
    notes: [],
    avant: null,       // ce qui avait le focus avant l'ouverture
    jeton: 0,          // écarte un dessin devenu périmé (il attend le magasin)
  };
  let conteneur = null;
  let corps = null;
  let guetteur = null;

  function animer(noeud, classe) {
    noeud.classList.remove(classe);
    void noeud.offsetWidth;
    noeud.classList.add(classe);
  }

  // ── Ouverture et fermeture ────────────────────────────────────────────────

  /* options : { surligne: requête, defiler: 'notes' | false, parcours: id }.
   * Le parcours suivi se poursuit d'un article à l'autre tant qu'il passe par
   * l'article ouvert ; « retour » retrouve celui du niveau précédent. */
  function ouvrir(ref, options) {
    const opt = options || {};
    if (!Dictionnaire.parId(ref)) return;
    const deja = etat.ouverte;
    const avant = etat.contextes[etat.contextes.length - 1] || null;
    if (deja && etat.pile[etat.pile.length - 1] === ref) {
      if (opt.parcours !== undefined && opt.parcours !== avant) {
        etat.contextes[etat.contextes.length - 1] = opt.parcours;
        dessiner();
      }
      return;
    }
    let contexte = opt.parcours !== undefined ? opt.parcours : avant;
    const p = contexte ? Dictionnaire.unParcours(contexte) : null;
    if (!p || !p.e.includes(ref)) contexte = null;
    etat.pile.push(ref);
    etat.surlignes.push(opt.surligne || null);
    etat.contextes.push(contexte);
    try { racine.history.pushState({ fiche: etat.pile.length }, ''); } catch (e) { /* historique indisponible */ }
    if (!deja) {
      const actif = document.activeElement;
      etat.avant = actif && (actif.tagName === 'BUTTON' || actif.tagName === 'A') ? { noeud: actif, ref: actif.getAttribute('data-ref') } : null;
      etat.ouverte = true;
      conteneur.hidden = false;
      document.body.classList.add('fiche-ouverte');
      animer(conteneur, 'entree');
    } else {
      animer(corps, 'change');
    }
    Voix.taire();
    dessiner(opt.defiler);
    Store.consulter(ref).catch(() => {});
    Store.modifierSuivi(ref, (s) => { s.vu = (s.vu || 0) + 1; s.dernier = Date.now(); })
      .then(() => document.dispatchEvent(new CustomEvent('suivi-change'))).catch(() => {});
  }

  /* Ramène la pile à `n` entrées (l'historique vient de reculer). */
  function revenirA(n) {
    if (!etat.ouverte) return;
    if (n <= 0) { fermerSansHistorique(); return; }
    etat.pile.length = Math.min(etat.pile.length, n);
    etat.surlignes.length = etat.pile.length;
    etat.contextes.length = etat.pile.length;
    Voix.taire();
    animer(corps, 'change');
    dessiner();
  }

  function fermerSansHistorique() {
    etat.pile = [];
    etat.surlignes = [];
    etat.contextes = [];
    etat.ouverte = false;
    if (conteneur) conteneur.hidden = true;
    if (guetteur) { guetteur.disconnect(); guetteur = null; }
    Voix.taire();
    document.body.classList.remove('fiche-ouverte');
    document.dispatchEvent(new CustomEvent('fiche-fermee'));
    rendreLeFocus();
  }

  function rendreLeFocus() {
    const avant = etat.avant;
    etat.avant = null;
    if (!avant) return;
    let cible = avant.noeud.isConnected ? avant.noeud : null;
    if (!cible && avant.ref) {
      cible = Array.from(document.querySelectorAll('.article-ligne')).find((b) => b.getAttribute('data-ref') === avant.ref) || null;
    }
    if (cible && !cible.closest('[hidden]')) cible.focus({ preventScroll: true });
  }

  function fermer(supplement) {
    if (!etat.ouverte) return;
    const n = etat.pile.length + (typeof supplement === 'number' ? supplement : 0);
    fermerSansHistorique();
    Outils.reculer(n);
  }

  function retour() {
    if (etat.pile.length > 1) racine.history.back();
    else fermer();
  }

  // ── Partager, écouter ─────────────────────────────────────────────────────

  async function partager(a) {
    const adresse = Installer.ADRESSE + '?article=' + encodeURIComponent(a.id);
    const contenu = { title: a.n + ' — Arcanes', text: a.defNue, url: adresse };
    if (racine.navigator.share) {
      try { await racine.navigator.share(contenu); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const ok = await Outils.copier(adresse);
    Outils.annoncer(ok ? 'Lien copié.' : adresse);
  }

  function icone(chemins) {
    const s = svg('svg', { class: 'icone', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    for (const d of chemins) s.appendChild(svg('path', { d }));
    return s;
  }

  function boutonRond(classe, titre, chemins, action) {
    const b = bouton('bouton-rond ' + classe, '', action);
    b.setAttribute('aria-label', titre);
    b.setAttribute('title', titre);
    b.appendChild(icone(chemins));
    return b;
  }

  /* Le texte à lire : la vedette, la définition, l'article, la mise en garde. */
  function texteALire(a) {
    const morceaux = [a.n + '.', a.defNue].concat((a.t || []).map(Dictionnaire.nu));
    if (a.at) morceaux.push('À ne pas confondre : ' + Dictionnaire.nu(a.at));
    return morceaux.join(' ');
  }

  function boutonEcouter(a) {
    const b = boutonRond('bouton-ecouter', 'Écouter l’article', ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9.2a4 4 0 0 1 0 5.6', 'M18.2 6.6a7.6 7.6 0 0 1 0 10.8'], () => {
      if (Voix.enLecture(a.id)) { Voix.taire(); return; }
      const ok = Voix.lire(texteALire(a), a.id, () => {
        b.classList.remove('parle');
        b.setAttribute('aria-label', 'Écouter l’article');
      });
      if (ok) {
        b.classList.add('parle');
        b.setAttribute('aria-label', 'Arrêter la lecture');
      }
    });
    return b;
  }

  /* Le nom de l'article vient se loger dans la barre du haut quand le titre
   * sort de l'écran : on sait toujours ce qu'on lit. */
  function guetterTitre(titre, barre) {
    if (guetteur) guetteur.disconnect();
    if (!racine.IntersectionObserver) return;
    guetteur = new IntersectionObserver(([entree]) => {
      barre.classList.toggle('titre-parti', !entree.isIntersecting && entree.boundingClientRect.top < 80);
    }, { root: conteneur, rootMargin: '-56px 0px 0px 0px' });
    guetteur.observe(titre);
  }

  // ── Dessin ────────────────────────────────────────────────────────────────

  function pastilleCategorie(a) {
    const cat = Dictionnaire.categorie(a.c);
    const p = element('span', 'pastille-cat cat-' + cat.id);
    p.appendChild(element('span', 'point-cat'));
    p.appendChild(document.createTextNode(cat.nom));
    return p;
  }

  function puces(titre, ids) {
    const liste = ids.map((id) => Dictionnaire.parId(id)).filter(Boolean);
    if (!liste.length) return null;
    const bloc = element('section', 'voisins-bloc');
    bloc.appendChild(element('h3', 'rubrique', titre));
    const rang = element('div', 'voisins');
    for (const v of liste) {
      const b = bouton('voisin cat-' + v.c, '', () => ouvrir(v.id));
      if (v.gl && Glyphes[v.gl]) b.appendChild(Glyphes.svg(v.gl, 'glyphe-puce'));
      b.appendChild(document.createTextNode(v.n));
      b.setAttribute('data-ref', v.id);
      rang.appendChild(b);
    }
    bloc.appendChild(rang);
    return bloc;
  }

  function blocFigure(a) {
    if (!a.sc) return null;
    const fig = element('figure', 'figure');
    try {
      fig.appendChild(Figure.dessiner(a.sc));
      const leg = Figure.legende(a.sc);
      if (leg) fig.appendChild(element('figcaption', null, leg));
    } catch (e) {
      fig.appendChild(element('p', 'discret', String(e && e.message ? e.message : e)));
    }
    return fig;
  }

  /* La chronologie d'une vie ou d'une histoire : la date, puis le fait. */
  function blocReperes(a, surligne) {
    if (!a.re || !a.re.length) return null;
    const bloc = element('section', 'reperes');
    bloc.appendChild(element('h3', 'rubrique', 'Repères'));
    const liste = element('ol', 'reperes-liste');
    for (const [date, fait] of a.re) {
      const li = element('li');
      li.appendChild(element('span', 'repere-date', date));
      li.appendChild(Rendu.paragraphe(fait, 'repere-fait', surligne));
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
    return bloc;
  }

  /* Les extraits : des passages d'œuvres du domaine public, recopiés tels
   * quels, avec leur source et le lien vers le livre numérisé. */
  function blocExtraits(a, surligne) {
    if (!a.ex || !a.ex.length) return null;
    const bloc = element('section', 'extraits');
    bloc.appendChild(element('h3', 'rubrique', a.ex.length > 1 ? 'Extraits' : 'Extrait'));
    for (const [paragraphes, reference, liens] of a.ex) {
      const fig = element('figure', 'extrait');
      const citation = element('blockquote', 'extrait-texte');
      for (const p of paragraphes) citation.appendChild(Rendu.paragraphe(p, null, surligne));
      fig.appendChild(citation);
      const legende = element('figcaption', 'extrait-source');
      legende.appendChild(Rendu.fragment(reference));
      const rang = element('span', 'extrait-liens');
      for (const [source, libelle, adresse] of liens) {
        const lien = element('a', 'extrait-lien', source + ' ↗');
        lien.href = adresse;
        lien.target = '_blank';
        lien.rel = 'noopener noreferrer';
        lien.title = libelle;
        lien.setAttribute('aria-label', source + ' : ' + libelle + ' (site extérieur, nouvel onglet)');
        rang.appendChild(lien);
      }
      legende.appendChild(rang);
      fig.appendChild(legende);
      bloc.appendChild(fig);
    }
    return bloc;
  }

  /* « Pour aller plus loin » : des pages d'autres sites, ouvertes dans le
   * navigateur. Rien n'est contacté tant qu'on ne touche pas un lien. */
  function blocLiens(a) {
    if (!a.li || !a.li.length) return null;
    const bloc = element('section', 'ailleurs');
    bloc.appendChild(element('h3', 'rubrique', 'Pour aller plus loin'));
    const ul = element('ul', 'ailleurs-liste');
    for (const [source, libelle, adresse] of a.li) {
      const li = element('li');
      const lien = element('a', 'ailleurs-lien');
      lien.href = adresse;
      lien.target = '_blank';
      lien.rel = 'noopener noreferrer';
      lien.appendChild(element('span', 'ailleurs-source', source));
      lien.appendChild(element('span', 'ailleurs-titre', libelle));
      lien.setAttribute('aria-label', source + ' : ' + libelle + ' (site extérieur, nouvel onglet)');
      li.appendChild(lien);
      ul.appendChild(li);
    }
    bloc.appendChild(ul);
    bloc.appendChild(element('p', 'discret ailleurs-note', 'Sites extérieurs : il faut une connexion pour les ouvrir.'));
    return bloc;
  }

  function dessinerNotes(a) {
    const bloc = element('section', 'mes-notes');
    bloc.id = 'mes-notes';
    bloc.appendChild(element('h3', 'rubrique', 'Mes notes'));
    if (!etat.notes.length) bloc.appendChild(element('p', 'discret', 'Une idée, une source, un lien avec un autre article ? Écrivez-le ici : la note reste sur cet appareil.'));
    for (const note of etat.notes) bloc.appendChild(carteNote(note));
    bloc.appendChild(bouton('bouton-discret', '＋ Ajouter une note', () => Editeur.ouvrir({ type: 'note', ref: a.id })));
    return bloc;
  }

  function carteNote(note) {
    const carte = element('article', 'note-carte');
    if (note.titre) carte.appendChild(element('strong', 'note-titre', note.titre));
    carte.appendChild(element('p', 'note-texte', note.texte));
    const pied = element('div', 'note-pied');
    pied.appendChild(element('span', 'discret', 'Modifiée le ' + Outils.dateLisible(note.modifie)));
    pied.appendChild(bouton('lien-discret', 'Modifier', () => Editeur.ouvrir({ type: 'note', note })));
    carte.appendChild(pied);
    return carte;
  }

  /* L'article précédent et le suivant, dans l'ordre alphabétique. */
  function feuilleter(a) {
    const tous = Dictionnaire.articles;
    const i = tous.indexOf(a);
    if (i === -1) return null;
    const nav = element('nav', 'feuilleter');
    nav.setAttribute('aria-label', 'Articles voisins dans l’ordre alphabétique');
    const prec = tous[i - 1];
    const suiv = tous[i + 1];
    nav.appendChild(prec ? bouton('feuille prec', '← ' + prec.n, () => ouvrir(prec.id)) : element('span'));
    nav.appendChild(suiv ? bouton('feuille suiv', suiv.n + ' →', () => ouvrir(suiv.id)) : element('span'));
    return nav;
  }

  // ── Les parcours ──────────────────────────────────────────────────────────

  /* Le parcours suivi à ce niveau de la pile, s'il passe par l'article. */
  function parcoursCourant(a) {
    const id = etat.contextes[etat.contextes.length - 1];
    const p = id ? Dictionnaire.unParcours(id) : null;
    return p && p.e.includes(a.id) ? p : null;
  }

  function suivreParcours(p, id) {
    ouvrir(id, { parcours: p.id });
  }

  /* En tête de fiche : le parcours, l'étape, un point par étape pour y sauter,
   * l'étape précédente et la suivante. */
  function filParcours(p, a) {
    const i = p.e.indexOf(a.id);
    const nav = element('nav', 'parcours-fil');
    nav.setAttribute('aria-label', 'Parcours : ' + p.n);
    const tete = element('div', 'parcours-tete');
    tete.appendChild(element('span', 'parcours-etiquette', 'Parcours'));
    tete.appendChild(element('span', 'parcours-nom', p.n));
    tete.appendChild(element('span', 'parcours-position', (i + 1) + ' / ' + p.e.length));
    const quitter = bouton('lien-discret parcours-quitter', 'Quitter', () => {
      etat.contextes[etat.contextes.length - 1] = null;
      dessiner(false);
    });
    quitter.setAttribute('aria-label', 'Quitter le parcours');
    tete.appendChild(quitter);
    nav.appendChild(tete);
    const points = element('div', 'parcours-points');
    p.e.forEach((id, k) => {
      const x = Dictionnaire.parId(id);
      const b = bouton('parcours-point cat-' + x.c + (k < i ? ' passe' : '') + (k === i ? ' actif' : ''), '', () => suivreParcours(p, id));
      b.setAttribute('aria-label', 'Étape ' + (k + 1) + ' : ' + x.n);
      b.title = x.n;
      if (k === i) b.setAttribute('aria-current', 'step');
      points.appendChild(b);
    });
    nav.appendChild(points);
    const pas = element('div', 'parcours-pas');
    const prec = i > 0 ? Dictionnaire.parId(p.e[i - 1]) : null;
    const suiv = i < p.e.length - 1 ? Dictionnaire.parId(p.e[i + 1]) : null;
    pas.appendChild(prec ? bouton('feuille prec', '← ' + prec.n, () => suivreParcours(p, prec.id)) : element('span'));
    pas.appendChild(suiv ? bouton('feuille suiv', suiv.n + ' →', () => suivreParcours(p, suiv.id)) : element('span', 'discret parcours-fin', 'Dernière étape'));
    nav.appendChild(pas);
    return nav;
  }

  /* Après la lecture : l'étape suivante, ou la fin du parcours. */
  function suiteParcours(p, a) {
    const i = p.e.indexOf(a.id);
    const bloc = element('section', 'parcours-suite');
    if (i < p.e.length - 1) {
      const suiv = Dictionnaire.parId(p.e[i + 1]);
      bloc.appendChild(element('p', 'parcours-suite-titre', p.n + ' · étape ' + (i + 2) + ' sur ' + p.e.length));
      bloc.appendChild(bouton('bouton-principal parcours-suivant', suiv.n + ' →', () => suivreParcours(p, suiv.id)));
    } else {
      bloc.appendChild(element('p', 'parcours-suite-titre', 'Fin du parcours « ' + p.n + ' »'));
      bloc.appendChild(bouton('bouton-discret parcours-recommencer', 'Revenir à la première étape', () => suivreParcours(p, p.e[0])));
    }
    return bloc;
  }

  /* Les parcours qui passent par l'article ; en toucher un le fait suivre. */
  function autresParcours(a, courant) {
    const liste = Dictionnaire.parcoursDe(a.id).filter((x) => !courant || x.p.id !== courant.id);
    if (!liste.length || a.perso) return null;
    const bloc = element('section', 'voisins-bloc parcours-liste');
    bloc.appendChild(element('h3', 'rubrique', courant ? 'Aussi dans les parcours' : 'Dans les parcours'));
    const rang = element('div', 'voisins');
    for (const { p, i } of liste) {
      const b = bouton('voisin parcours-voisin', '', () => {
        etat.contextes[etat.contextes.length - 1] = p.id;
        dessiner();
      });
      b.appendChild(document.createTextNode(p.n));
      b.appendChild(element('span', 'parcours-voisin-etape', 'étape ' + (i + 1) + ' / ' + p.e.length));
      b.setAttribute('data-parcours', p.id);
      rang.appendChild(b);
    }
    bloc.appendChild(rang);
    return bloc;
  }

  /* `anime` : le bouton qu'on vient de toucher ('favori', 'revoir'). */
  async function dessiner(defiler, anime) {
    etat.jeton += 1;
    const jeton = etat.jeton;
    const ref = etat.pile[etat.pile.length - 1];
    const surligne = etat.surlignes[etat.surlignes.length - 1] || null;
    const a = Dictionnaire.parId(ref);
    const [suivi, notes] = await Promise.all([
      Store.lireSuivi(ref).catch(() => null),
      Store.notesDe(ref).catch(() => []),
    ]);
    if (jeton !== etat.jeton) return;
    corps.textContent = '';
    if (!a) { corps.appendChild(element('p', 'vide', 'Cet article n’existe plus.')); return; }
    etat.notes = notes.sort((x, y) => x.cree - y.cree);

    // La barre du haut : retour, le nom (quand le titre a défilé), écouter, partager, fermer
    const barre = element('div', 'fiche-tete');
    const precedente = etat.pile.length > 1 ? Dictionnaire.parId(etat.pile[etat.pile.length - 2]) : null;
    const b = bouton('fiche-retour', precedente ? '← ' + precedente.n : '← Retour', retour);
    barre.appendChild(b);
    const nomBarre = element('span', 'espace fiche-tete-nom', a.n);
    nomBarre.setAttribute('aria-hidden', 'true');
    barre.appendChild(nomBarre);
    if (Voix.possible()) barre.appendChild(boutonEcouter(a));
    if (!a.perso) barre.appendChild(boutonRond('fiche-partager', 'Partager', ['M12 3.5v11', 'M7.5 8 12 3.5 16.5 8', 'M5.5 12.5v5.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5.5'], () => partager(a)));
    const x = bouton('fiche-fermer', '✕', () => fermer());
    x.setAttribute('aria-label', 'Fermer');
    barre.appendChild(x);
    corps.appendChild(barre);

    // L'en-tête de l'article
    const tete = element('header', 'fiche-titre cat-' + a.c);
    const infos = element('div', 'fiche-infos');
    infos.appendChild(pastilleCategorie(a));
    if (a.perso) infos.appendChild(element('span', 'pastille', 'à moi'));
    tete.appendChild(infos);
    const ligne = element('div', 'titre-ligne');
    const bloc = element('div', 'titre-bloc');
    const titre = element('h2', 'article-nom', a.n);
    bloc.appendChild(titre);
    const dates = a.da || (typeof a.an === 'number' && a.c !== 'figures' ? Dictionnaire.annee(a.an) : '');
    if (dates) bloc.appendChild(element('p', 'article-dates', dates));
    if (a.lo) bloc.appendChild(element('p', 'article-lieu', a.lo));
    ligne.appendChild(bloc);
    if (a.gl && Glyphes[a.gl]) ligne.appendChild(Glyphes.svg(a.gl, 'glyphe-titre'));
    tete.appendChild(ligne);
    corps.appendChild(tete);

    const def = element('div', 'definition');
    def.appendChild(Rendu.paragraphe(a.d, 'definition-texte', surligne));
    corps.appendChild(def);

    // Favori, à revoir
    const actions = element('div', 'actions-fiche');
    const fav = bouton('bouton-etat' + (suivi && suivi.favori ? ' actif' : ''),
      suivi && suivi.favori ? '★ Favori' : '☆ Favori', async () => {
        await Store.modifierSuivi(ref, (s) => { s.favori = !s.favori; });
        document.dispatchEvent(new CustomEvent('suivi-change'));
        dessiner(false, 'favori');
      });
    fav.setAttribute('aria-pressed', suivi && suivi.favori ? 'true' : 'false');
    const rev = bouton('bouton-etat' + (suivi && suivi.aRevoir ? ' actif revoir' : ''),
      suivi && suivi.aRevoir ? '⚑ À revoir' : '⚐ À revoir', async () => {
        await Store.modifierSuivi(ref, (s) => { s.aRevoir = !s.aRevoir; if (!s.aRevoir) s.serie = 0; });
        document.dispatchEvent(new CustomEvent('suivi-change'));
        dessiner(false, 'revoir');
      });
    rev.setAttribute('aria-pressed', suivi && suivi.aRevoir ? 'true' : 'false');
    if (anime === 'favori') fav.classList.add('pop');
    if (anime === 'revoir') rev.classList.add('pop');
    actions.appendChild(fav);
    actions.appendChild(rev);
    corps.appendChild(actions);

    // Le parcours qu'on suit : où l'on en est, et d'où l'on vient
    const parcours = parcoursCourant(a);
    if (parcours) corps.appendChild(filParcours(parcours, a));

    // Les illustrations d'en tête : la carte, le portrait, la gravure
    const images = Illustrations.bloc(a);
    if (images) corps.appendChild(images);

    // Un lieu : où il est, et comment s'y rendre
    const situer = Carte.blocFiche(a);
    if (situer) corps.appendChild(situer);

    // Le corps de l'article ; la figure après le premier paragraphe, la planche
    // de vignettes après le suivant (ou à la place de la figure s'il n'y en a pas)
    const texte = element('div', 'article-texte');
    const insertions = [];
    const figure = blocFigure(a);
    if (figure) insertions.push(figure);
    for (const p of a.pl || []) insertions.push(Illustrations.planche(p));
    const paragraphes = a.t || [];
    paragraphes.forEach((p) => {
      texte.appendChild(Rendu.paragraphe(p, null, surligne));
      if (insertions.length) texte.appendChild(insertions.shift());
    });
    for (const reste of insertions) texte.appendChild(reste);
    corps.appendChild(texte);

    const extraits = blocExtraits(a, surligne);
    if (extraits) corps.appendChild(extraits);

    const reperes = blocReperes(a, surligne);
    if (reperes) corps.appendChild(reperes);

    if (a.oe && a.oe.length) {
      const oe = element('section', 'oeuvres');
      oe.appendChild(element('h3', 'rubrique', 'Œuvres principales'));
      const ul = element('ul');
      for (const o of a.oe) {
        const li = element('li');
        // « Titre (1614) » : le titre en italique, la date à part
        const m = /^(.*?)(\s*\(.*\))?$/.exec(o);
        li.appendChild(element('i', null, m[1]));
        if (m[2]) li.appendChild(document.createTextNode(m[2]));
        ul.appendChild(li);
      }
      oe.appendChild(ul);
      corps.appendChild(oe);
    }

    if (a.at) {
      const att = element('aside', 'attention');
      att.appendChild(element('div', 'attention-titre', 'À ne pas confondre'));
      att.appendChild(Rendu.paragraphe(a.at));
      corps.appendChild(att);
    }

    if (a.perso) corps.appendChild(bouton('bouton-discret large', '✎ Modifier mon article', () => Editeur.ouvrir({ type: 'article', id: a.id.slice(6) })));

    if (parcours) corps.appendChild(suiteParcours(parcours, a));

    const voir = puces('Voir aussi', a.v || []);
    if (voir) corps.appendChild(voir);
    const cites = (a.ci || []).filter((id) => !(a.v || []).includes(id));
    const ci = puces('Cité dans', cites);
    if (ci) corps.appendChild(ci);
    const dans = autresParcours(a, parcours);
    if (dans) corps.appendChild(dans);

    // La carte des liens : se promener d'article en article sans quitter la fiche
    const carte = Constellation.bloc(a, (id) => ouvrir(id));
    if (carte) corps.appendChild(carte);
    const ailleurs = blocLiens(a);
    if (ailleurs) corps.appendChild(ailleurs);

    corps.appendChild(dessinerNotes(a));
    const nav = feuilleter(a);
    if (nav) corps.appendChild(nav);

    conteneur.setAttribute('aria-label', a.n);
    guetterTitre(titre, barre);
    if (defiler === 'notes') {
      const n = document.getElementById('mes-notes');
      conteneur.scrollTop = n ? n.offsetTop - 60 : 0;
    } else if (defiler !== false) {
      conteneur.scrollTop = 0;
      // Trouvé dans le texte : on amène le premier passage sous les yeux
      const mark = surligne ? corps.querySelector('.article-texte mark') : null;
      if (mark && mark.getBoundingClientRect().top > racine.innerHeight * 0.7) {
        conteneur.scrollTop = Math.max(0, mark.getBoundingClientRect().top - racine.innerHeight * 0.35);
      }
    }
  }

  // ── Les renvois et les figures ────────────────────────────────────────────

  /* Un clic sur un renvoi ou sur un élément de figure ouvre l'article cité.
   * Ctrl ou ⌘ + clic laisse le navigateur ouvrir un nouvel onglet. */
  function surClic(e) {
    const cible = e.target.closest('[data-ref]');
    if (!cible || !corps.contains(cible) || cible.tagName === 'BUTTON') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    ouvrir(cible.getAttribute('data-ref'));
  }

  function surTouche(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cible = e.target.closest && e.target.closest('.f-lien[data-ref]');
    if (!cible) return;
    e.preventDefault();
    ouvrir(cible.getAttribute('data-ref'));
  }

  function brancher() {
    conteneur = document.getElementById('fiche');
    corps = document.getElementById('fiche-contenu');
    conteneur.addEventListener('animationend', () => conteneur.classList.remove('entree'));
    corps.addEventListener('animationend', () => corps.classList.remove('change'));
    corps.addEventListener('click', surClic);
    corps.addEventListener('keydown', surTouche);
    document.addEventListener('notes-changees', () => { if (etat.ouverte) dessiner(false); });
    document.addEventListener('perso-change', () => { if (etat.ouverte) dessiner(false); });
    document.addEventListener('reglages-changes', () => { if (etat.ouverte) dessiner(false); });
    document.addEventListener('position-change', () => {
      const a = etat.ouverte ? Dictionnaire.parId(etat.pile[etat.pile.length - 1]) : null;
      if (a && a.g) dessiner(false);
    });
    document.addEventListener('voix-changees', () => { if (etat.ouverte && !Voix.enLecture(etat.pile[etat.pile.length - 1])) dessiner(false); });
  }

  racine.Fiche = {
    brancher, ouvrir, fermer, retour, revenirA, fermerSansHistorique,
    get ouverte() { return etat.ouverte; },
    get ref() { return etat.pile[etat.pile.length - 1] || null; },
    get profondeur() { return etat.pile.length; },
    get parcours() { return etat.contextes[etat.contextes.length - 1] || null; },
  };

})(window);
