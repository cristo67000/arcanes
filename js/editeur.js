'use strict';
/*
 * L'éditeur : le panneau où l'on écrit une note, ou un article à soi.
 *
 *   note     un titre facultatif et un texte libre, rattachés à un article
 *   article  un article absent du dictionnaire : sa vedette, sa catégorie, une
 *            définition courte, un texte (paragraphes séparés par une ligne
 *            vide), d'autres noms pour la recherche
 *
 * Ce qu'on écrit est affiché comme du texte, jamais interprété. Comme la
 * fiche, le panneau prend une entrée de l'historique : le geste « retour »
 * d'Android le ferme sans rien enregistrer.
 */
(function (racine) {

  const { element, bouton } = Outils;

  const etat = { ouvert: false, demande: null, confirmation: false, modifie: false };
  let conteneur = null;
  let corps = null;

  function champ(titre, aide, saisie, id) {
    const c = element('div', 'champ');
    const etiquette = element('label', 'champ-titre', titre);
    if (id) etiquette.setAttribute('for', id);
    c.appendChild(etiquette);
    c.appendChild(saisie);
    if (aide) c.appendChild(element('span', 'champ-aide', aide));
    return c;
  }

  function saisieTexte(id, valeur, options) {
    const opt = options || {};
    const s = element(opt.lignes ? 'textarea' : 'input', 'saisie-texte');
    s.id = id;
    if (opt.lignes) s.rows = opt.lignes; else s.type = 'text';
    s.value = valeur || '';
    s.autocomplete = 'off';
    s.spellcheck = true;
    if (opt.maxlength) s.maxLength = opt.maxlength;
    return s;
  }

  function choix(id, options, valeur) {
    const s = element('select', 'saisie-texte');
    s.id = id;
    for (const [v, libelle] of options) {
      const o = element('option', null, libelle);
      o.value = v;
      if (v === valeur) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }

  /* demande : { type: 'note', ref } pour créer, { type: 'note', note } pour
   * modifier ; { type: 'article' }, { type: 'article', id } ou { type: 'article', nom }. */
  async function ouvrir(demande) {
    etat.demande = demande;
    etat.confirmation = false;
    etat.modifie = false;
    if (!etat.ouvert) {
      etat.ouvert = true;
      conteneur.hidden = false;
      document.body.classList.add('panneau-ouvert');
      try { racine.history.pushState({ editeur: true, fiche: Fiche.profondeur }, ''); } catch (e) { /* rien */ }
    }
    await dessiner();
    conteneur.scrollTop = 0;
    const premier = corps.querySelector('textarea, input');
    if (premier) setTimeout(() => premier.focus({ preventScroll: true }), 60);
  }

  function fermerSansHistorique() {
    etat.ouvert = false;
    etat.demande = null;
    conteneur.hidden = true;
    document.body.classList.remove('panneau-ouvert');
  }

  function fermer() {
    if (!etat.ouvert) return;
    fermerSansHistorique();
    Outils.reculer(1);
  }

  async function dessiner() {
    const d = etat.demande;
    corps.textContent = '';
    if (!d) return;
    const modif = d.type === 'article' ? !!d.id : !!d.note;
    const tete = element('div', 'fiche-tete');
    tete.appendChild(element('h2', 'editeur-titre', d.type === 'article'
      ? (modif ? 'Modifier mon article' : 'Écrire un article')
      : (modif ? 'Modifier la note' : 'Nouvelle note')));
    tete.appendChild(element('span', 'espace'));
    const x = bouton('fiche-fermer', '✕', fermer);
    x.setAttribute('aria-label', 'Annuler');
    tete.appendChild(x);
    corps.appendChild(tete);

    const erreur = element('p', 'erreur', '');
    erreur.setAttribute('role', 'alert');
    erreur.hidden = true;
    const montrerErreur = (message) => { erreur.textContent = message; erreur.hidden = !message; };
    const form = element('div', 'formulaire');
    let lire;
    let enregistrer;
    let supprimer = null;

    if (d.type === 'article') {
      const existant = d.id ? await Store.lireArticlePerso(d.id) : null;
      const sNom = saisieTexte('e-nom', existant ? existant.nom : (d.nom || ''), { maxlength: 80 });
      form.appendChild(champ('Vedette', 'Le nom de l’article, tel qu’il apparaîtra dans la liste.', sNom, 'e-nom'));
      const options = Dictionnaire.categories.map((c) => [c.id, c.nom]);
      options.push(['perso', 'Mes articles (sans catégorie)']);
      const sCat = choix('e-cat', options, existant ? existant.cat : 'perso');
      form.appendChild(champ('Catégorie', '', sCat, 'e-cat'));
      const sDef = saisieTexte('e-def', existant ? existant.def : '', { lignes: 3, maxlength: 400 });
      form.appendChild(champ('Définition', 'Une phrase qui dit l’essentiel ; elle servira aussi en révision.', sDef, 'e-def'));
      const sTexte = saisieTexte('e-texte', existant ? existant.texte : '', { lignes: 9 });
      form.appendChild(champ('Article', 'Facultatif. Séparez les paragraphes par une ligne vide.', sTexte, 'e-texte'));
      const sAl = saisieTexte('e-al', existant ? (existant.alias || []).join(', ') : '');
      form.appendChild(champ('Autres noms', 'Facultatif, séparés par des virgules : la recherche les trouvera aussi.', sAl, 'e-al'));

      lire = () => {
        const nom = sNom.value.trim();
        const def = sDef.value.trim();
        if (!nom) { montrerErreur('Donnez une vedette à l’article.'); sNom.focus(); return null; }
        if (!def) { montrerErreur('Écrivez au moins une définition.'); sDef.focus(); return null; }
        const norme = Outils.normaliser(nom);
        const doublon = Dictionnaire.livres.find((x) => x.cle === norme);
        if (doublon) { montrerErreur('« ' + doublon.n + ' » existe déjà dans le dictionnaire : ajoutez-y plutôt une note.'); return null; }
        const maintenant = Date.now();
        return {
          id: existant ? existant.id : Outils.identifiant('p'),
          nom, cat: sCat.value, def, texte: sTexte.value.trim(),
          alias: sAl.value.split(',').map((s) => s.trim()).filter(Boolean),
          cree: existant ? existant.cree : maintenant, modifie: maintenant,
        };
      };
      enregistrer = async (objet) => {
        await Store.ecrireArticlePerso(objet);
        await recharger();
        document.dispatchEvent(new CustomEvent('perso-change'));
      };
      if (existant) {
        supprimer = async () => {
          const ref = 'perso:' + existant.id;
          const notes = await Store.notesDe(ref);
          await Store.supprimerArticlePerso(existant.id);
          for (const n of notes) await Store.supprimerNote(n.id);
          await Store.modifierSuivi(ref, (s) => { s.favori = false; s.aRevoir = false; s.vu = 0; s.ok = 0; s.ko = 0; });
          await recharger();
          document.dispatchEvent(new CustomEvent('perso-change'));
          document.dispatchEvent(new CustomEvent('notes-changees'));
          document.dispatchEvent(new CustomEvent('suivi-change'));
          // l'article n'existe plus : on referme aussi sa fiche, et l'entrée
          // d'historique du panneau avec elle
          fermerSansHistorique();
          if (Fiche.ouverte) Fiche.fermer(1); else Outils.reculer(1);
        };
      }
    } else {
      const note = d.note || null;
      const a = Dictionnaire.parId(note ? note.ref : d.ref);
      if (a) form.appendChild(element('p', 'editeur-pour', a.n));
      const sTitre = saisieTexte('e-titre', note ? note.titre : '', { maxlength: 80 });
      form.appendChild(champ('Titre', 'Facultatif.', sTitre, 'e-titre'));
      const sTexte = saisieTexte('e-texte', note ? note.texte : '', { lignes: 8 });
      form.appendChild(champ('Note', 'Une source, une citation, une idée, un lien avec un autre article…', sTexte, 'e-texte'));
      lire = () => {
        const texte = sTexte.value.trim();
        if (!texte) { montrerErreur('La note est vide.'); sTexte.focus(); return null; }
        const maintenant = Date.now();
        return {
          id: note ? note.id : Outils.identifiant('n'), ref: note ? note.ref : d.ref, type: 'note',
          titre: sTitre.value.trim(), texte, cree: note ? note.cree : maintenant, modifie: maintenant,
        };
      };
      enregistrer = async (objet) => {
        await Store.ecrireNote(objet);
        document.dispatchEvent(new CustomEvent('notes-changees'));
      };
      if (note) {
        supprimer = async () => {
          const copie = Object.assign({}, note);
          await Store.supprimerNote(note.id);
          document.dispatchEvent(new CustomEvent('notes-changees'));
          fermer();
          Outils.annoncer('Note supprimée.', async () => {
            await Store.ecrireNote(copie);
            document.dispatchEvent(new CustomEvent('notes-changees'));
          }, 'Annuler');
        };
      }
    }

    form.appendChild(erreur);
    const pied = element('div', 'pied-formulaire');
    const ligne = element('div', 'ligne-boutons');
    ligne.appendChild(bouton('bouton-principal', 'Enregistrer', async () => {
      montrerErreur('');
      const objet = lire();
      if (!objet) return;
      try {
        await enregistrer(objet);
        fermer();
        Outils.annoncer('Enregistré.');
      } catch (e) {
        montrerErreur('L’enregistrement a échoué : ' + (e && e.message ? e.message : e));
      }
    }));
    ligne.appendChild(bouton('bouton-discret', 'Annuler', fermer));
    pied.appendChild(ligne);
    if (supprimer) {
      const b = bouton('lien-discret supprimer', 'Supprimer', async () => {
        if (!etat.confirmation) {
          etat.confirmation = true;
          b.textContent = 'Toucher encore pour supprimer';
          setTimeout(() => { etat.confirmation = false; b.textContent = 'Supprimer'; }, 4000);
          return;
        }
        try { await supprimer(); } catch (e) { montrerErreur('La suppression a échoué : ' + (e && e.message ? e.message : e)); }
      });
      pied.appendChild(b);
    }
    form.appendChild(pied);
    corps.appendChild(form);
  }

  async function recharger() {
    const perso = await Store.tousLesArticlesPerso().catch(() => []);
    Dictionnaire.reconstruire(perso);
  }

  function brancher() {
    conteneur = document.getElementById('editeur');
    corps = document.getElementById('editeur-contenu');
    corps.addEventListener('input', () => { etat.modifie = true; });
  }

  racine.Editeur = {
    brancher, ouvrir, fermer, fermerSansHistorique, recharger,
    get ouvert() { return etat.ouvert; },
    get modifie() { return etat.modifie; },
  };

})(window);
