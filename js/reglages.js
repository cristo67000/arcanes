'use strict';
/*
 * L'onglet « Réglages » : affichage, lecture à voix haute, clavier,
 * sauvegarde, installation, mise à jour, à propos.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let zone = null;
  let infos = { manifeste: null };

  function segments(valeurs, actuelle, action, libelle) {
    const g = element('div', 'segments');
    g.setAttribute('role', 'group');
    for (const v of valeurs) {
      const b = bouton('', libelle(v), () => action(v));
      b.setAttribute('aria-pressed', String(v) === String(actuelle) ? 'true' : 'false');
      g.appendChild(b);
    }
    return g;
  }

  /* Les illustrations : combien sont rangées pour la lecture hors ligne. La
   * ligne se met à jour seule pendant le téléchargement, sans redessiner
   * l'écran (un menu ouvert se refermerait). */
  let ligneImages = null;
  function etatImages(e) {
    if (!ligneImages || !ligneImages.texte.isConnected) return;
    const total = e.total || (infos.manifeste && infos.manifeste.images) || 0;
    ligneImages.texte.textContent = !('caches' in racine)
      ? 'Ce navigateur ne garde pas les images pour la lecture hors ligne.'
      : e.prets >= total && total
        ? 'Toutes les illustrations sont disponibles hors ligne.'
        : e.enCours
          ? 'Téléchargement : ' + e.prets + ' sur ' + total + '…'
          : 'Disponibles hors ligne : ' + e.prets + ' sur ' + total + '.';
    ligneImages.bouton.hidden = e.enCours || !total || e.prets >= total || !('caches' in racine);
  }

  function blocImages() {
    const b = bloc('Illustrations');
    const m = infos.manifeste;
    if (m && m.images) {
      b.appendChild(element('p', 'discret', Outils.pluriel(m.images, 'image', 'images') + ' du domaine public — cartes des tarots de Nicolas Conver (1760) et de Pamela Colman Smith (1909), portraits, gravures —, '
        + Outils.humain(m.octetsImages) + '. Elles se téléchargent d’elles-mêmes après la première ouverture ; touchez une image pour l’agrandir et voir sa source.'));
    }
    const ligne = element('div', 'ligne-maj');
    const t = element('span', 'discret', '');
    const bt = bouton('bouton-discret', 'Télécharger maintenant', () => Illustrations.entretenir(true));
    ligne.appendChild(bt);
    ligne.appendChild(t);
    b.appendChild(ligne);
    ligneImages = { texte: t, bouton: bt };
    etatImages(Illustrations.etat);
    Illustrations.entretenir().catch(() => {});
    return b;
  }

  function bloc(titre) {
    const b = element('section', 'bloc');
    b.appendChild(element('h3', null, titre));
    return b;
  }

  async function changer(cle, valeur) {
    await App.ecrireReglage(cle, valeur);
    App.appliquerReglages();
    dessiner();
  }

  function blocVoix(r) {
    const b = bloc('Lecture à voix haute');
    b.appendChild(element('p', 'discret', 'Le bouton « Écouter » d’un article le fait lire par une voix française de votre appareil, sans réseau.'));
    b.appendChild(segments([true, false], r.voix !== false, (v) => changer('voix', v), (v) => (v ? 'Activée' : 'Désactivée')));
    if (r.voix === false) return b;
    const voix = Voix.disponible ? Voix.lister() : [];
    if (!voix.length) {
      b.appendChild(element('p', 'discret', Voix.disponible
        ? 'Aucune voix française n’est installée sur cet appareil. Sur Android : Paramètres › Accessibilité › Synthèse vocale ; sur iPhone : Réglages › Accessibilité › Contenu énoncé › Voix.'
        : 'Ce navigateur ne propose pas de synthèse vocale.'));
      return b;
    }
    b.appendChild(element('h4', null, 'Voix'));
    const auto = Voix.automatique;
    const options = [['', 'Automatique' + (auto ? ' : ' + auto.libelle : '')]].concat(voix.map((v) => [v.uri, v.libelle + (v.locale ? '' : ' (en ligne)')]));
    const sel = element('select', 'saisie-texte');
    sel.setAttribute('aria-label', 'Voix');
    const actuelle = r.voixFr ? r.voixFr.uri : '';
    for (const [v, l] of options) {
      const o = element('option', null, l);
      o.value = v;
      if (v === actuelle) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const v = voix.find((x) => x.uri === sel.value);
      changer('voixFr', v ? { uri: v.uri, nom: v.nom } : null);
    });
    b.appendChild(sel);
    const essai = bouton('bouton-discret espace-haut', '▸ Essayer la voix', () => {
      Voix.lire('Ce qui est en bas est comme ce qui est en haut, et ce qui est en haut est comme ce qui est en bas.', 'essai', null);
    });
    b.appendChild(essai);
    return b;
  }

  async function dessiner() {
    if (!zone) return;
    const r = App.reglages;
    zone.textContent = '';
    zone.appendChild(element('h2', null, 'Réglages'));

    const affichage = bloc('Affichage');
    affichage.appendChild(element('h4', null, 'Taille du texte'));
    affichage.appendChild(segments([0, 1, 2, 3], r.taille, (v) => changer('taille', v), (v) => ['Petit', 'Normal', 'Grand', 'Très grand'][v]));
    affichage.appendChild(element('h4', null, 'Thème'));
    affichage.appendChild(segments(['auto', 'clair', 'sombre'], r.theme, (v) => changer('theme', v), (v) => ({ auto: 'Automatique', clair: 'Vélin', sombre: 'Nuit' })[v]));
    affichage.appendChild(element('h4', null, 'Police des articles'));
    affichage.appendChild(segments(['serif', 'sans'], r.police, (v) => changer('police', v), (v) => (v === 'serif' ? 'À empattements' : 'Sans empattements')));
    zone.appendChild(affichage);

    zone.appendChild(blocVoix(r));
    zone.appendChild(blocImages());

    const clavier = bloc('Clavier');
    clavier.classList.add('seulement-clavier');
    const mac = /Mac|iPhone|iPad/.test(racine.navigator.platform || racine.navigator.userAgent);
    const raccourcis = element('dl', 'raccourcis');
    for (const [touches, texte] of [
      [['/', mac ? '⌘ K' : 'Ctrl K'], 'Chercher'],
      [['↑', '↓'], 'Parcourir les résultats'],
      [['Entrée'], 'Ouvrir l’article'],
      [['Échap'], 'Fermer l’article, effacer la recherche'],
      [['1 – 4', 'Entrée'], 'Répondre, question suivante'],
      [['Espace', '←', '→'], 'Retourner une carte, juger'],
    ]) {
      const dt = element('dt');
      for (const k of touches) dt.appendChild(element('kbd', 'raccourci-touche', k));
      raccourcis.appendChild(dt);
      raccourcis.appendChild(element('dd', null, texte));
    }
    clavier.appendChild(raccourcis);
    zone.appendChild(clavier);

    const sauv = bloc('Sauvegarde');
    sauv.appendChild(element('p', 'discret', 'Vos notes, vos articles, vos favoris et vos révisions ne quittent jamais cet appareil. Pour les emporter sur un autre, enregistrez-les dans un fichier, puis rechargez-le là-bas.'));
    const zoneSauv = element('div');
    sauv.appendChild(zoneSauv);
    Sauvegarde.dessiner(zoneSauv);
    sauv.appendChild(bouton('lien-discret', 'Effacer l’historique de consultation', async () => {
      await Store.effacerHistorique().catch(() => {});
      Outils.annoncer('Historique effacé.');
      document.dispatchEvent(new CustomEvent('fiche-fermee'));
    }));
    zone.appendChild(sauv);

    const inst = bloc('Installer l’application');
    const zoneInst = element('div');
    inst.appendChild(zoneInst);
    zone.appendChild(inst);
    Installer.dessinerInstallation(inst, zoneInst);

    const part = bloc('Partager');
    const zonePart = element('div');
    part.appendChild(zonePart);
    zone.appendChild(part);
    Installer.dessinerPartage(zonePart);

    const ap = bloc('À propos');
    const m = infos.manifeste;
    ap.appendChild(element('p', null, 'Arcanes ' + (MiseAJour.version || '') + ' — dictionnaire encyclopédique de l’ésotérisme.'));
    if (m) {
      ap.appendChild(element('p', 'discret', Outils.pluriel(m.articles, 'article', 'articles') + ', ' + m.mots.toLocaleString('fr-FR')
        + ' mots, ' + Outils.pluriel(m.figures, 'figure', 'figures')
        + (m.lieux ? ', ' + Outils.pluriel(m.lieux, 'lieu', 'lieux') + ' sur la carte' : '')
        + (m.extraits ? ', ' + Outils.pluriel(m.extraits, 'extrait', 'extraits') + ' d’œuvres anciennes' : '')
        + ' ; édition du ' + Outils.dateLisible(m.construit) + '.'));
    }
    const ligne = element('div', 'ligne-maj');
    const etatMaj = element('span', 'discret', '');
    ligne.appendChild(bouton('bouton-discret', 'Vérifier les mises à jour', async () => {
      etatMaj.textContent = '…';
      const resultat = await MiseAJour.verifier(true);
      etatMaj.textContent = ({
        prete: 'Une nouvelle version est prête.', 'en-cours': 'Une nouvelle version arrive…',
        'a-jour': 'L’application est à jour.', echec: 'Vérification impossible (pas de réseau ?).',
        'sans-service-worker': 'Mise à jour automatique indisponible dans ce navigateur.', 'trop-tot': 'L’application est à jour.',
      })[resultat] || 'L’application est à jour.';
    }));
    ligne.appendChild(etatMaj);
    ap.appendChild(ligne);
    ap.appendChild(element('h4', null, 'L’esprit de ce dictionnaire'));
    ap.appendChild(element('p', 'discret', 'Arcanes décrit l’ésotérisme comme le font les historiens : ce que ses courants ont cru, écrit et pratiqué, d’où ils viennent et ce qu’ils sont devenus. Il ne se prononce pas sur la vérité de leurs doctrines ; quand une pratique prétend à des effets vérifiables — divination, astrologie, guérison —, il dit ce qu’en ont conclu les études. Les articles sont originaux ; les extraits cités sous certains d’entre eux viennent d’œuvres du domaine public, avec leur source. Les dates anciennes sont souvent approximatives.'));
    ap.appendChild(element('p', 'discret', 'Une erreur, un oubli ? Écrivez à cristo67apps@gmail.com.'));
    const lien = element('a', null, 'Confidentialité : rien n’est envoyé nulle part');
    lien.href = 'confidentialite.html';
    const p = element('p');
    p.appendChild(lien);
    ap.appendChild(p);
    zone.appendChild(ap);
  }

  function brancher(donnees) {
    zone = document.getElementById('reglages-contenu');
    infos = Object.assign(infos, donnees || {});
    Installer.surChangement(() => { if (App.vue === 'reglages') dessiner(); });
    document.addEventListener('voix-changees', () => { if (App.vue === 'reglages') dessiner(); });
    document.addEventListener('illustrations-etat', (e) => etatImages(e.detail));
  }

  racine.Reglages = { brancher, dessiner };

})(window);
