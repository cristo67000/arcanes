'use strict';
/*
 * La mise en forme des textes du dictionnaire.
 *
 * Deux balises seulement : [[id]] ou [[id|libellé]] devient un lien vers
 * l'article, *mots* devient de l'italique. Tout le reste est du texte, posé
 * par `textContent` : rien n'est jamais interprété comme du HTML, pas même ce
 * qu'une personne écrit dans ses propres articles.
 *
 * Un lien est un vrai lien (`?article=…`), que la fiche intercepte pour
 * ouvrir l'article sans quitter la page ; il reste lisible par un lecteur
 * d'écran et ouvrable dans un autre onglet sur un ordinateur.
 */
(function (racine) {

  const { element } = Outils;
  const MOTIF = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*([^*]+)\*/g;
  const DEBUT_DE_PHRASE = /(^|[.!?…])\s*$/;

  /* Le texte balisé, en nœuds DOM. `surligne` : une requête à surligner. */
  function fragment(texte, surligne) {
    const sortie = document.createDocumentFragment();
    const source = String(texte || '');
    let pos = 0;
    let m;
    MOTIF.lastIndex = 0;
    const poserTexte = (parent, t) => {
      if (!t) return;
      if (surligne) parent.appendChild(Outils.surligner(t, surligne));
      else parent.appendChild(document.createTextNode(t));
    };
    while ((m = MOTIF.exec(source)) !== null) {
      poserTexte(sortie, source.slice(pos, m.index));
      if (m[1]) {
        const id = m[1];
        let libelle = m[2] || Dictionnaire.nom(id) || id;
        // un nom commun prend la minuscule, sauf en tête de phrase
        const cible = Dictionnaire.parId(id);
        if (!m[2] && cible && cible.mn && !DEBUT_DE_PHRASE.test(source.slice(0, m.index))) {
          libelle = libelle.charAt(0).toLocaleLowerCase('fr') + libelle.slice(1);
        }
        if (Dictionnaire.parId(id)) sortie.appendChild(lien(id, libelle));
        else poserTexte(sortie, libelle);
      } else {
        const i = element('i');
        poserTexte(i, m[3]);
        sortie.appendChild(i);
      }
      pos = m.index + m[0].length;
    }
    poserTexte(sortie, source.slice(pos));
    return sortie;
  }

  function lien(id, libelle) {
    const a = element('a', 'renvoi', libelle);
    a.href = '?article=' + encodeURIComponent(id);
    a.setAttribute('data-ref', id);
    const cible = Dictionnaire.parId(id);
    if (cible) a.classList.add('cat-' + cible.c);
    return a;
  }

  function paragraphe(texte, classe, surligne) {
    const p = element('p', classe || null);
    p.appendChild(fragment(texte, surligne));
    return p;
  }

  racine.Rendu = { fragment, paragraphe, lien };

})(window);
