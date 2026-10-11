'use strict';
/*
 * L'onglet « Carnet » : tout ce qui est à soi, rangé en quatre rubriques.
 *
 *   Favoris       les articles marqués d'une étoile
 *   À revoir      les articles ratés en révision ou marqués à la main
 *   Notes         les notes écrites sur les articles
 *   Mes articles  les articles qu'on a écrits soi-même
 *
 * Chaque ligne ouvre l'article ; pour une note, la fiche s'ouvre au niveau
 * de « Mes notes ».
 */
(function (racine) {

  const { element, bouton } = Outils;
  const etat = { rubrique: 'favoris', filtre: '' };
  let el = {};

  const VIDES = {
    favoris: 'Aucun favori pour l’instant. Touchez ☆ Favori dans un article pour l’ajouter ici.',
    'a-revoir': 'Rien à revoir. Les articles ratés en révision, ou marqués ⚐, apparaîtront ici.',
    notes: 'Aucune note. Ouvrez un article et écrivez dans « Mes notes ».',
    articles: 'Vous n’avez pas encore écrit d’article. Un auteur, un symbole, une notion qui manque ? Ajoutez-le.',
  };

  function ligneArticle(a) {
    const b = element('button', 'article-ligne cat-' + a.c);
    b.type = 'button';
    b.setAttribute('data-ref', a.id);
    const tete = element('span', 'article-ligne-tete');
    tete.appendChild(a.gl && Glyphes[a.gl] ? Glyphes.svg(a.gl, 'glyphe-ligne') : element('span', 'point-cat'));
    tete.appendChild(element('span', 'article-mot', a.n));
    if (a.perso) tete.appendChild(element('span', 'pastille', 'à moi'));
    b.appendChild(tete);
    if (a.defNue) b.appendChild(element('span', 'apercu', a.defNue));
    b.addEventListener('click', () => Fiche.ouvrir(a.id));
    return b;
  }

  function ligneNote(note) {
    const a = Dictionnaire.parId(note.ref);
    const b = element('button', 'article-ligne note-ligne' + (a ? ' cat-' + a.c : ''));
    b.type = 'button';
    const tete = element('span', 'article-ligne-tete');
    tete.appendChild(element('span', 'point-cat'));
    tete.appendChild(element('span', 'article-mot', a ? a.n : 'Article disparu'));
    if (note.titre) tete.appendChild(element('span', 'note-titre-court', note.titre));
    b.appendChild(tete);
    b.appendChild(element('span', 'apercu', (note.texte || '').replace(/\s+/g, ' ').slice(0, 160)));
    b.appendChild(element('span', 'discret note-date', Outils.dateLisible(note.modifie)));
    b.addEventListener('click', () => { if (a) Fiche.ouvrir(a.id, { defiler: 'notes' }); });
    return b;
  }

  async function compter() {
    try {
      const [suivis, notes] = await Promise.all([Store.tousLesSuivis(), Store.toutesLesNotes()]);
      const nombres = {
        favoris: suivis.filter((s) => s.favori && Dictionnaire.parId(s.ref)).length,
        'a-revoir': suivis.filter((s) => s.aRevoir && Dictionnaire.parId(s.ref)).length,
        notes: notes.length,
        articles: Dictionnaire.articles.filter((x) => x.perso).length,
      };
      for (const b of el.onglets.querySelectorAll('button')) {
        const n = nombres[b.getAttribute('data-rubrique')] || 0;
        const c = b.querySelector('.nombre-rubrique');
        c.textContent = n ? String(n) : '';
        c.hidden = !n;
      }
    } catch (e) { /* sans magasin, pas de compte */ }
  }

  async function dessiner() {
    const rub = etat.rubrique;
    el.contenu.textContent = '';
    for (const b of el.onglets.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', b.getAttribute('data-rubrique') === rub ? 'true' : 'false');
    }
    compter();
    const filtre = Outils.normaliser(etat.filtre);
    const bonne = (texte) => !filtre || Outils.normaliser(texte).includes(filtre);
    let lignes = [];
    try {
      if (rub === 'favoris' || rub === 'a-revoir') {
        const suivis = await Store.tousLesSuivis();
        lignes = suivis.filter((s) => (rub === 'favoris' ? s.favori : s.aRevoir))
          .map((s) => Dictionnaire.parId(s.ref)).filter(Boolean)
          .filter((x) => bonne(x.n + ' ' + (x.al || []).join(' ')))
          .sort((x, y) => x.cleTri.localeCompare(y.cleTri, 'fr'))
          .map(ligneArticle);
      } else if (rub === 'notes') {
        const notes = (await Store.toutesLesNotes()).sort((x, y) => y.modifie - x.modifie);
        for (const n of notes) {
          const a = Dictionnaire.parId(n.ref);
          if (bonne((a ? a.n : '') + ' ' + (n.titre || '') + ' ' + (n.texte || ''))) lignes.push(ligneNote(n));
        }
      } else {
        el.contenu.appendChild(bouton('bouton-principal', '＋ Écrire un article', () => Editeur.ouvrir({ type: 'article' })));
        lignes = Dictionnaire.articles.filter((x) => x.perso && bonne(x.n)).map(ligneArticle);
      }
    } catch (e) {
      lignes = [];
    }
    if (!lignes.length) {
      el.contenu.appendChild(element('p', 'vide discret', filtre ? 'Rien ne correspond à ce filtre.' : VIDES[rub]));
      return;
    }
    const groupe = element('div', 'groupe');
    for (const l of lignes) groupe.appendChild(l);
    el.contenu.appendChild(groupe);
  }

  function brancher() {
    el = {
      onglets: document.getElementById('carnet-onglets'),
      filtre: document.getElementById('carnet-filtre'),
      contenu: document.getElementById('carnet-contenu'),
    };
    for (const b of el.onglets.querySelectorAll('button')) {
      b.addEventListener('click', () => { etat.rubrique = b.getAttribute('data-rubrique'); dessiner(); });
    }
    el.filtre.addEventListener('input', () => { etat.filtre = el.filtre.value; dessiner(); });
    for (const evt of ['suivi-change', 'notes-changees', 'perso-change']) {
      document.addEventListener(evt, () => { if (App.vue === 'carnet') dessiner(); });
    }
  }

  racine.Carnet = { brancher, dessiner };

})(window);
