'use strict';
/*
 * Petits outils partagés par tous les modules.
 *
 * Tout ce qui s'affiche passe par `element()` et `textContent` : rien de ce que
 * contient le dictionnaire, ni de ce que l’on tape soi-même, n’est jamais
 * interprété comme du HTML.
 */
(function (racine) {

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function bouton(classe, texte, action) {
    const b = element('button', classe, texte);
    b.type = 'button';
    if (action) b.addEventListener('click', action);
    return b;
  }

  /* Élément SVG : les attributs passent par setAttribute, jamais par « style »
   * (la politique de sécurité interdit les styles en ligne). */
  const NS_SVG = 'http://www.w3.org/2000/svg';
  function svg(balise, attributs, texte) {
    const noeud = document.createElementNS(NS_SVG, balise);
    if (attributs) {
      for (const cle of Object.keys(attributs)) {
        if (attributs[cle] !== undefined && attributs[cle] !== null) noeud.setAttribute(cle, attributs[cle]);
      }
    }
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  /* Comparer sans se soucier des accents, des majuscules ni de l'apostrophe
   * typographique : « Empreinte » = « empreinte », « d’un » = « d'un ». */
  function normaliser(texte) {
    return String(texte || '')
      .toLowerCase()
      .normalize('NFKD').replace(/\p{M}/gu, '')
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Les passages d'un texte qui répondent à une requête, pour les surligner :
   * [[début, fin], …], positions dans le texte tel qu'il s'affiche. On compare
   * comme `normaliser` (sans accents ni majuscules), mais signe à signe, pour
   * savoir où tombe le passage trouvé dans le texte d'origine. La requête
   * entière d'abord ; à défaut, chacun de ses mots. */
  function plages(texte, requete) {
    const q = normaliser(requete);
    if (!q || !texte) return [];
    let nu = '';
    const debuts = [];
    const fins = [];
    let pos = 0;
    for (const signe of String(texte)) {
      const n = signe.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘`]/g, "'").replace(/\s/g, ' ');
      for (let i = 0; i < n.length; i += 1) { debuts.push(pos); fins.push(pos + signe.length); }
      nu += n;
      pos += signe.length;
    }
    const trouver = (motif) => {
      const i = nu.indexOf(motif);
      return i === -1 ? null : [debuts[i], fins[i + motif.length - 1]];
    };
    const entiere = trouver(q);
    if (entiere) return [entiere];
    const morceaux = q.split(' ').filter((m) => m.length >= 2).map(trouver).filter(Boolean);
    morceaux.sort((a, b) => a[0] - b[0]);
    const fusion = [];
    for (const p of morceaux) {
      const dernier = fusion[fusion.length - 1];
      if (dernier && p[0] <= dernier[1]) dernier[1] = Math.max(dernier[1], p[1]);
      else fusion.push(p.slice());
    }
    return fusion;
  }

  /* Le texte, avec en <mark> les passages qui répondent à la requête. */
  function surligner(texte, requete) {
    const fragment = document.createDocumentFragment();
    let pos = 0;
    for (const [debut, fin] of plages(texte, requete)) {
      if (debut > pos) fragment.appendChild(document.createTextNode(texte.slice(pos, debut)));
      fragment.appendChild(element('mark', 'trouve', texte.slice(debut, fin)));
      pos = fin;
    }
    if (pos < texte.length) fragment.appendChild(document.createTextNode(texte.slice(pos)));
    return fragment;
  }

  /* Distance d'édition entre deux mots : insertions, suppressions,
   * substitutions, et l'inversion de deux lettres voisines, la faute de frappe
   * la plus courante (« alchimei »). Passé `plafond`, on s'arrête : il suffit de
   * savoir que c'est loin. */
  function distance(a, b, plafond) {
    if (Math.abs(a.length - b.length) > plafond) return plafond + 1;
    let avantAvant = null;
    let avant = Array.from({ length: b.length + 1 }, (x, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      const ligne = [i];
      let mini = i;
      for (let j = 1; j <= b.length; j += 1) {
        let v = Math.min(avant[j] + 1, ligne[j - 1] + 1, avant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, avantAvant[j - 2] + 1);
        ligne.push(v);
        if (v < mini) mini = v;
      }
      if (mini > plafond) return plafond + 1;
      avantAvant = avant;
      avant = ligne;
    }
    return avant[b.length];
  }

  /* Une taille lisible : « 30,1 Ko » ou « 30.1 KB » selon la langue. */
  function humain(octets, langue) {
    const unites = langue === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['o', 'Ko', 'Mo', 'Go'];
    let valeur = octets;
    let rang = 0;
    while (valeur >= 1024 && rang < unites.length - 1) { valeur /= 1024; rang += 1; }
    const nombre = rang === 0 ? String(Math.round(valeur)) : valeur.toFixed(1);
    return (langue === 'en' ? nombre : nombre.replace('.', ',')) + ' ' + unites[rang];
  }

  function dateLisible(quand, langue) {
    try {
      return new Date(quand).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return new Date(quand).toISOString().slice(0, 10);
    }
  }

  /* Mélange de Fisher-Yates, sur une copie. */
  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  /* Un identifiant court, stable une fois créé : « n-k3j9x2a1 ». */
  function identifiant(prefixe) {
    return (prefixe || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* La date du jour, en clair : sert à choisir « l’article du jour ». */
  function jourCourant() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* Un annonceur discret, en bas de l'écran, pour ce qui vient de se faire
   * et peut se défaire : « Note supprimée — Annuler ». */
  let minuterieAnnonce = null;
  function annoncer(texte, action, libelleAction) {
    const zone = document.getElementById('annonce');
    if (!zone) return;
    zone.textContent = '';
    zone.appendChild(element('span', null, texte));
    if (action) {
      zone.appendChild(bouton('lien-annonce', libelleAction || 'Annuler', () => {
        zone.hidden = true;
        action();
      }));
    }
    zone.hidden = false;
    requestAnimationFrame(() => zone.classList.add('visible'));
    if (minuterieAnnonce) clearTimeout(minuterieAnnonce);
    minuterieAnnonce = setTimeout(() => {
      zone.classList.remove('visible');
      setTimeout(() => { zone.hidden = true; }, 250);
    }, action ? 6000 : 3000);
  }

  /* Copier dans le presse-papiers ; repli sur un champ caché pour les
   * navigateurs qui refusent l'API moderne. */
  async function copier(texte) {
    try {
      await racine.navigator.clipboard.writeText(texte);
      return true;
    } catch (erreur) {
      const zone = element('textarea');
      zone.value = texte;
      zone.setAttribute('readonly', '');
      zone.className = 'presse-papiers';
      document.body.appendChild(zone);
      zone.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      zone.remove();
      return ok;
    }
  }

  /* Vrai si une touche arrive dans un champ où l'on écrit : les raccourcis
   * clavier (« / », 1 à 4 au quiz…) ne doivent pas y voler de lettres. */
  function saisieEnCours(e) {
    const cible = e && e.target;
    if (!cible || !cible.tagName) return false;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable;
  }

  /* Recule dans l'historique de `n` entrées, *après* avoir déjà refermé
   * l'écran qui les avait ajoutées. Le navigateur annoncera ce recul par un
   * événement `popstate` un peu plus tard ; si la personne a ouvert autre
   * chose entre-temps, cet événement en retard fermerait le nouvel écran.
   * On compte donc les reculs que l'on s'est infligés, et `App` ignore
   * autant de `popstate`. */
  racine.reculsAttendus = 0;
  function reculer(n) {
    if (!n) return;
    racine.reculsAttendus += 1;
    try { racine.history.go(-n); } catch (erreur) { racine.reculsAttendus -= 1; }
  }

  /* « 1 article », « 519 articles » (et « 0 article », à la française). */
  function pluriel(n, un, plusieurs) {
    return n.toLocaleString('fr-FR') + ' ' + (n > 1 ? plusieurs : un);
  }

  racine.Outils = {
    element, bouton, svg, normaliser, plages, surligner, distance, humain, dateLisible, melanger,
    identifiant, jourCourant, annoncer, copier, reculer, saisieEnCours, pluriel,
  };

})(window);
