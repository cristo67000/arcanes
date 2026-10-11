'use strict';
/*
 * Sauvegarde : tout ce qui est à soi, dans un fichier, et retour.
 *
 * Rien ne quitte l'appareil de lui-même ; c'est précisément pourquoi il faut
 * un moyen de tout emporter en changeant de téléphone. Le fichier contient les
 * notes, les articles écrits soi-même, le suivi (favoris, « à revoir »,
 * réponses en révision) et les réglages — pas le dictionnaire, qui est dans
 * l'application.
 *
 * Recharger un fichier n'efface rien : chaque élément est rapproché de celui
 * qui porte le même identifiant, et c'est le plus récent qui l'emporte. Pour
 * le suivi, on garde le plus avancé : les favoris s'additionnent, les
 * compteurs prennent le plus grand.
 */
(function (racine) {

  const { element, bouton } = Outils;
  const FORMAT = 1;
  const APPLICATION = 'arcanes';

  async function exporter() {
    const [notes, perso, suivis, reglages] = await Promise.all([
      Store.toutesLesNotes(), Store.tousLesArticlesPerso(), Store.tousLesSuivis(), Store.lireReglages(),
    ]);
    const donnees = { application: APPLICATION, format: FORMAT, date: new Date().toISOString(), reglages, notes, perso, suivis };
    const fichier = new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' });
    const nom = 'arcanes-' + new Date().toISOString().slice(0, 10) + '.json';
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(fichier);
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
    return { nom, octets: fichier.size, notes: notes.length, perso: perso.length, suivis: suivis.length };
  }

  function valide(d) {
    return !!d && d.application === APPLICATION && typeof d.format === 'number' && d.format <= FORMAT && Array.isArray(d.notes);
  }

  async function fusionner(d) {
    const bilan = { ajoutes: 0, misAJour: 0, inchanges: 0 };
    async function unir(liste, lire, ecrire, cle, date) {
      for (const x of liste || []) {
        if (!x || !x[cle]) continue;
        const present = await lire(x[cle]);
        if (!present) { await ecrire(x); bilan.ajoutes += 1; } else if ((date(x) || 0) > (date(present) || 0)) { await ecrire(x); bilan.misAJour += 1; } else bilan.inchanges += 1;
      }
    }
    await unir(d.notes, Store.lireNote, Store.ecrireNote, 'id', (n) => n.modifie);
    await unir(d.perso, Store.lireArticlePerso, Store.ecrireArticlePerso, 'id', (n) => n.modifie);
    for (const s of d.suivis || []) {
      if (!s || !s.ref) continue;
      const present = await Store.lireSuivi(s.ref);
      const recent = (s.dernier || 0) > (present.dernier || 0);
      const fusion = {
        ref: s.ref,
        favori: !!(present.favori || s.favori),
        aRevoir: recent ? !!s.aRevoir : !!present.aRevoir,
        vu: Math.max(present.vu || 0, s.vu || 0),
        ok: Math.max(present.ok || 0, s.ok || 0),
        ko: Math.max(present.ko || 0, s.ko || 0),
        serie: recent ? (s.serie || 0) : (present.serie || 0),
        dernier: Math.max(present.dernier || 0, s.dernier || 0),
      };
      if (JSON.stringify(fusion) === JSON.stringify(present)) { bilan.inchanges += 1; continue; }
      await Store.ecrireSuivi(fusion);
      bilan.misAJour += 1;
    }
    await Editeur.recharger();
    document.dispatchEvent(new CustomEvent('perso-change'));
    document.dispatchEvent(new CustomEvent('notes-changees'));
    document.dispatchEvent(new CustomEvent('suivi-change'));
    return bilan;
  }

  function dessiner(zone) {
    zone.textContent = '';
    const ligne = element('div', 'ligne-boutons ligne-sauvegarde');
    const retour = element('p', 'discret retour-sauvegarde', '');
    retour.setAttribute('role', 'status');
    ligne.appendChild(bouton('bouton-discret', 'Enregistrer une sauvegarde', async () => {
      try {
        const r = await exporter();
        retour.textContent = 'Fichier « ' + r.nom + ' » (' + Outils.humain(r.octets) + ') : '
          + Outils.pluriel(r.notes, 'note', 'notes') + ', ' + Outils.pluriel(r.perso, 'article', 'articles')
          + ' à vous, ' + Outils.pluriel(r.suivis, 'suivi', 'suivis') + '.';
      } catch (e) {
        retour.textContent = 'La sauvegarde a échoué : ' + (e && e.message ? e.message : e);
      }
    }));
    const choixFichier = element('input');
    choixFichier.type = 'file';
    choixFichier.accept = 'application/json,.json';
    choixFichier.hidden = true;
    choixFichier.addEventListener('change', async () => {
      const fichier = choixFichier.files && choixFichier.files[0];
      choixFichier.value = '';
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!valide(d)) throw new Error('ce fichier n’est pas une sauvegarde d’Arcanes');
        const b = await fusionner(d);
        retour.textContent = 'Sauvegarde rechargée : ' + b.ajoutes + ' ajouté(s), ' + b.misAJour + ' mis à jour, ' + b.inchanges + ' déjà à jour.';
      } catch (e) {
        retour.textContent = 'Impossible de recharger : ' + (e && e.message ? e.message : e);
      }
    });
    ligne.appendChild(bouton('bouton-discret', 'Recharger une sauvegarde', () => choixFichier.click()));
    zone.appendChild(ligne);
    zone.appendChild(choixFichier);
    zone.appendChild(retour);
  }

  racine.Sauvegarde = { exporter, fusionner, valide, dessiner, FORMAT };

})(window);
