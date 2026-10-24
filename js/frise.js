'use strict';
/*
 * L'onglet « Frise » : les articles datés, de l'Antiquité à nos jours.
 *
 * Chaque article qui porte une année (« an: » dans les sources) y prend
 * place : la naissance d'une figure, la composition d'un texte, la fondation
 * d'une société, l'apparition d'un courant. La frise se lit de haut en bas,
 * par époques ; des boutons y mènent directement, et des filtres ne gardent
 * qu'une catégorie — les figures seules, par exemple, pour voir qui fut
 * contemporain de qui.
 *
 * Les dates antiques et médiévales sont souvent incertaines : l'article dit
 * « vers », la frise ne fait que ranger.
 *
 * Deux façons de la lire : le bandeau (js/bandeau.js), où les siècles vont en
 * largeur et les vies en barres, et la liste, de haut en bas.
 */
(function (racine) {

  const { element, bouton } = Outils;

  const etat = { cat: null, dessinee: false, vue: 'bandeau' };
  let el = {};

  function dessinerFiltres(presentes) {
    el.filtres.textContent = '';
    const tous = bouton('filtre' + (etat.cat ? '' : ' actif'), 'Tout', () => choisir(null));
    tous.setAttribute('aria-pressed', etat.cat ? 'false' : 'true');
    el.filtres.appendChild(tous);
    for (const cat of Dictionnaire.categories) {
      if (!presentes.has(cat.id)) continue;
      const b = bouton('filtre cat-' + cat.id + (etat.cat === cat.id ? ' actif' : ''), '', () => choisir(etat.cat === cat.id ? null : cat.id));
      b.appendChild(element('span', 'point-cat'));
      b.appendChild(document.createTextNode(cat.nom));
      b.setAttribute('aria-pressed', etat.cat === cat.id ? 'true' : 'false');
      el.filtres.appendChild(b);
    }
  }

  function choisir(cat) {
    etat.cat = cat;
    dessiner();
  }

  /* L'étiquette d'année : « 1433 », « 570 av. J.-C. », et « vers » quand
   * l'article lui-même le dit. */
  function etiquette(a) {
    const approx = /\bvers\b|siècle|figure légendaire|incertaine/i.test(a.da || '');
    const e = element('span', 'frise-annee');
    e.appendChild(element('span', 'frise-an', (approx ? 'v. ' : '') + Math.abs(a.an)));
    if (a.an < 0) e.appendChild(element('span', 'frise-ere', 'av. J.-C.'));
    return e;
  }

  function dessiner() {
    const tous = Dictionnaire.frise();
    dessinerFiltres(new Set(tous.map((a) => a.c)));
    const liste = etat.cat ? tous.filter((a) => a.c === etat.cat) : tous;
    for (const b of el.vues.children) b.setAttribute('aria-pressed', b.getAttribute('data-vue') === etat.vue ? 'true' : 'false');
    el.contenu.hidden = etat.vue !== 'liste';
    el.bandeau.hidden = etat.vue !== 'bandeau';
    el.compte.textContent = Outils.pluriel(liste.length, 'date', 'dates');
    etat.dessinee = true;
    if (etat.vue === 'bandeau') {
      el.contenu.textContent = '';
      el.epoques.textContent = '';
      let debut = -2700;
      for (const e of Dictionnaire.EPOQUES) {
        const an = debut;
        el.epoques.appendChild(bouton('epoque', e.nom, () => Bandeau.allerA(an)));
        debut = e.fin;
      }
      Bandeau.montrer(el.bandeau, etat.cat);
      return;
    }
    Bandeau.fermer();
    el.contenu.textContent = '';
    el.epoques.textContent = '';
    let epoque = null;
    let bloc = null;
    for (const a of liste) {
      const e = Dictionnaire.epoque(a.an);
      if (!epoque || e.id !== epoque.id) {
        epoque = e;
        const titre = element('h3', 'epoque-titre', e.nom);
        titre.id = 'epoque-' + e.id;
        el.contenu.appendChild(titre);
        bloc = element('ol', 'frise');
        el.contenu.appendChild(bloc);
        const saut = bouton('epoque', e.nom, () => {
          const cible = document.getElementById('epoque-' + e.id);
          if (cible) racine.scrollTo(0, Math.max(0, cible.getBoundingClientRect().top + racine.scrollY - 8));
        });
        el.epoques.appendChild(saut);
      }
      const li = element('li', 'frise-point cat-' + a.c);
      const b = element('button', 'frise-ligne');
      b.type = 'button';
      b.setAttribute('data-ref', a.id);
      b.appendChild(etiquette(a));
      const corps = element('span', 'frise-corps');
      const nom = element('span', 'frise-nom');
      if (a.gl && Glyphes[a.gl]) nom.appendChild(Glyphes.svg(a.gl, 'glyphe-frise'));
      nom.appendChild(document.createTextNode(a.n));
      corps.appendChild(nom);
      corps.appendChild(element('span', 'frise-sous', (a.da ? a.da + ' · ' : '') + Dictionnaire.categorie(a.c).nom));
      b.appendChild(corps);
      b.addEventListener('click', () => Fiche.ouvrir(a.id));
      li.appendChild(b);
      bloc.appendChild(li);
    }
  }

  function changerVue(vue) {
    if (vue === etat.vue) return;
    etat.vue = vue;
    dessiner();
  }

  function montrer() {
    if (!etat.dessinee) dessiner();
  }

  function brancher() {
    el = {
      filtres: document.getElementById('frise-filtres'),
      epoques: document.getElementById('frise-epoques'),
      contenu: document.getElementById('frise-contenu'),
    };
    el.compte = element('p', 'discret compte-frise');
    el.epoques.parentNode.insertBefore(el.compte, el.epoques);
    el.vues = element('div', 'segments segments-frise');
    el.vues.setAttribute('role', 'group');
    el.vues.setAttribute('aria-label', 'Présentation de la frise');
    for (const [v, nom] of [['bandeau', 'Bandeau'], ['liste', 'Liste']]) {
      const b = bouton('', nom, () => changerVue(v));
      b.setAttribute('data-vue', v);
      el.vues.appendChild(b);
    }
    el.filtres.parentNode.insertBefore(el.vues, el.filtres);
    el.bandeau = element('div', 'frise-bandeau');
    el.contenu.parentNode.insertBefore(el.bandeau, el.contenu);
    document.addEventListener('perso-change', () => { etat.dessinee = false; });
  }

  racine.Frise = { brancher, montrer, dessiner, changerVue, get vue() { return etat.vue; } };

})(window);
