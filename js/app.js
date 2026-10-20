'use strict';
/*
 * Le chef d'orchestre : les réglages, les onglets, l'historique.
 *
 * Six onglets (Dictionnaire, Frise, Carte, Révision, Carnet, Réglages), une fiche et
 * un éditeur qui s'ouvrent par-dessus. Ce module tient les réglages en
 * mémoire (les autres modules les lisent par `App.reglages`), les applique au
 * document — thème, taille du texte, police —, aiguille le geste « retour »
 * du téléphone et les raccourcis du clavier, et branche chaque écran une fois.
 */
(function (racine) {

  let reglages = Object.assign({}, Store.DEFAUTS);
  let vue = 'dictionnaire';
  const VUES = ['dictionnaire', 'frise', 'carte', 'quiz', 'carnet', 'reglages'];
  const TAILLES = [14.5, 16, 18, 20.5];

  /* Le thème « automatique » retire l'attribut : c'est alors la préférence du
   * téléphone (prefers-color-scheme) qui décide. La taille se règle sur la
   * racine ; toute la feuille de style est en rem. Ces écritures passent par
   * le DOM et le CSSOM, pas par un attribut « style » — la politique de
   * sécurité de la page les accepte. */
  function appliquerReglages() {
    const html = document.documentElement;
    if (reglages.theme === 'clair' || reglages.theme === 'sombre') html.setAttribute('data-theme', reglages.theme);
    else html.removeAttribute('data-theme');
    html.setAttribute('data-police', reglages.police === 'sans' ? 'sans' : 'serif');
    html.style.fontSize = (TAILLES[reglages.taille] || 16) + 'px';
    Voix.regler(reglages);
    document.dispatchEvent(new CustomEvent('reglages-changes'));
  }

  async function ecrireReglage(cle, valeur) {
    reglages[cle] = valeur;
    try { await Store.ecrireReglage(cle, valeur); } catch (e) { /* navigation privée : on garde en mémoire */ }
    return valeur;
  }

  function aller(nom) {
    if (!VUES.includes(nom)) return;
    vue = nom;
    for (const v of VUES) document.getElementById('vue-' + v).hidden = v !== nom;
    for (const b of document.querySelectorAll('#onglets button')) {
      if (b.getAttribute('data-vue') === nom) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    if (nom === 'frise') Frise.montrer();
    if (nom === 'carte') Carte.montrer();
    if (nom === 'quiz') Quiz.montrer();
    if (nom === 'carnet') Carnet.dessiner();
    if (nom === 'reglages') Reglages.dessiner();
    racine.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('vue-changee'));
  }

  function surRetour(e) {
    /* Un recul que nous avons nous-mêmes provoqué, l'écran étant déjà fermé :
     * rien à défaire (voir Outils.reculer). */
    if (racine.reculsAttendus > 0) { racine.reculsAttendus -= 1; return; }
    const s = e.state || {};
    // La visionneuse d'abord : « retour » referme l'image, pas la fiche dessous.
    if (Illustrations.ouverte) { Illustrations.fermerSansHistorique(); return; }
    if (Editeur.ouvert && !s.editeur) Editeur.fermerSansHistorique();
    if (Fiche.ouverte) {
      if (s.fiche) Fiche.revenirA(s.fiche);
      else Fiche.fermerSansHistorique();
    }
  }

  /* Sur un ordinateur : « / » ou Ctrl+K pour chercher, Échap pour refermer.
   * Échap ne ferme pas un éditeur où l'on a commencé d'écrire. */
  function surTouche(e) {
    if (e.defaultPrevented || e.altKey) return;
    if (e.key === 'Escape') {
      if (Illustrations.ouverte) { e.preventDefault(); Illustrations.fermer(); return; }
      if (Editeur.ouvert) { if (!Editeur.modifie) { e.preventDefault(); Editeur.fermer(); } return; }
      if (Fiche.ouverte) { e.preventDefault(); Fiche.fermer(); }
      return;
    }
    const chercher = ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      || (e.key === '/' && !e.ctrlKey && !e.metaKey && !Outils.saisieEnCours(e));
    if (!chercher || Editeur.ouvert) return;
    e.preventDefault();
    if (Fiche.ouverte) Fiche.fermer();
    if (vue !== 'dictionnaire') aller('dictionnaire');
    Liste.focaliser();
  }

  function brancher(donnees) {
    reglages = Object.assign(reglages, donnees.reglages);
    appliquerReglages();

    Fiche.brancher();
    Illustrations.brancher();
    Editeur.brancher();
    Carnet.brancher();
    Frise.brancher();
    Carte.brancher();
    Quiz.brancher();
    Reglages.brancher({ manifeste: donnees.manifeste });
    Liste.brancher();
    Installer.brancherAccueil(document.getElementById('carte-installation'));

    for (const b of document.querySelectorAll('#onglets button')) {
      b.addEventListener('click', () => {
        if (b.getAttribute('data-vue') === vue) racine.scrollTo({ top: 0, behavior: 'smooth' });
        else aller(b.getAttribute('data-vue'));
      });
    }
    racine.addEventListener('popstate', surRetour);
    document.addEventListener('keydown', surTouche);
    try { racine.history.replaceState(null, ''); } catch (e) { /* rien */ }

    // « ?article=paracelse » ouvre directement l'article : c'est le lien partagé.
    const demande = new URLSearchParams(racine.location.search).get('article');
    if (demande && Dictionnaire.parId(demande)) Fiche.ouvrir(demande);
  }

  racine.App = {
    brancher, aller, appliquerReglages, ecrireReglage,
    get reglages() { return reglages; },
    get vue() { return vue; },
  };

})(window);
