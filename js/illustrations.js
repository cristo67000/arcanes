'use strict';
/*
 * Les illustrations : cartes de tarot, portraits, gravures anciennes.
 *
 * Toutes viennent de Wikimedia Commons et sont dans le domaine public ;
 * build/illustrations.txt dit d'où vient chacune, build/illustrer.py les réduit
 * et les range dans img/. Un article en porte en tête de fiche (`im`), et
 * parfois une planche de vignettes (`pl`) dont chacune ouvre un autre article.
 *
 * ── Hors ligne ─────────────────────────────────────────────────────────────
 *
 * Les images ne sont pas dans la coquille du service worker : quelques
 * mégaoctets qu'il serait absurde de retélécharger à chaque nouvelle version.
 * Elles ont leur propre cache, `arcanes-images`, que ce module remplit en
 * arrière-plan après le démarrage, trois images à la fois, et dont il retire ce
 * qui ne sert plus. Chaque adresse porte l'empreinte du fichier (`?v=…`) : une
 * image retouchée change d'adresse, et l'ancienne s'en va d'elle-même. Tant
 * qu'une image n'est pas arrivée, la fiche montre sa légende à sa place.
 *
 * Certaines images s'animent (build/animations.txt, js/animations.js) : des
 * calques posés par-dessus, et dessous, « Rejouer » et « Écouter ».
 *
 * ── La visionneuse ─────────────────────────────────────────────────────────
 *
 * Une image touchée s'ouvre en grand par-dessus la fiche, avec sa légende, son
 * crédit et un lien vers sa source. Le geste « retour » du téléphone la
 * referme sans fermer la fiche (voir `App`).
 */
(function (racine) {

  const { element, bouton } = Outils;
  const CACHE = 'arcanes-images';

  function adresse(im) { return im.f + '?v=' + im.v; }
  const texte = (balise) => Dictionnaire.nu(balise);

  // ── Dans la fiche ─────────────────────────────────────────────────────────

  /* L'image elle-même. Ses dimensions réelles réservent sa place avant
   * qu'elle n'arrive : le texte ne saute pas quand elle s'affiche. */
  function image(im, classe) {
    const img = element('img', classe || null);
    img.width = im.w;
    img.height = im.h;
    img.alt = texte(im.l);
    img.decoding = 'async';
    img.addEventListener('error', () => {
      const cadre = img.closest('.illustration, .vignette, #visionneuse');
      if (cadre) cadre.classList.add('absente');
      else img.hidden = true;
    }, { once: true });
    img.src = adresse(im);
    return img;
  }

  function legende(im, classe) {
    const leg = element(classe === 'figcaption' ? 'figcaption' : 'div', classe === 'figcaption' ? null : classe);
    leg.appendChild(element('span', 'illustration-legende')).appendChild(Rendu.fragment(im.l));
    leg.appendChild(element('span', 'illustration-credit')).appendChild(Rendu.fragment(im.cr + ' · ' + im.li));
    // ce qu'une animation ajoute à la gravure, et d'où elle le tient
    if (im.an && im.an.cr && racine.Animations && Animations.actives()) {
      leg.appendChild(element('span', 'illustration-credit illustration-animation')).appendChild(Rendu.fragment('Animation : ' + im.an.cr));
    }
    return leg;
  }

  function figure(im) {
    const fig = element('figure', 'illustration');
    const b = bouton('illustration-bouton', '', () => agrandir(im));
    b.setAttribute('aria-label', 'Agrandir l’image : ' + texte(im.l));
    const img = image(im);
    b.appendChild(img);
    fig.appendChild(b);
    // une image animée : ses calques par-dessus, ses boutons dessous
    const anime = im.an && racine.Animations ? Animations.habiller(b, img, im) : null;
    if (anime) fig.appendChild(Animations.commandes(im, anime));
    fig.appendChild(legende(im, 'figcaption'));
    return fig;
  }

  /* Les images d'en tête : une seule au large, deux côte à côte (la carte de
   * Marseille et celle du Rider-Waite-Smith). */
  function bloc(a) {
    if (!a || !a.im || !a.im.length) return null;
    const d = element('div', 'illustrations n' + Math.min(a.im.length, 3));
    for (const im of a.im) d.appendChild(figure(im));
    return d;
  }

  /* Une planche : des vignettes, dont chacune ouvre son article ou, faute
   * d'article, s'agrandit. */
  function planche(p) {
    const fig = element('figure', 'planche');
    const grille = element('div', 'planche-grille');
    for (const im of p.im) {
      const cible = im.r ? Dictionnaire.parId(im.r) : null;
      // faute d'article, le début de la légende : « Planche 4 », pas tout son texte
      const nom = cible ? cible.n : texte(im.l).split(/\s:\s/)[0];
      const b = bouton('vignette', '', () => (cible ? Fiche.ouvrir(cible.id) : agrandir(im)));
      b.setAttribute('aria-label', cible ? nom : 'Agrandir l’image : ' + nom);
      b.appendChild(image(im));
      b.appendChild(element('span', 'vignette-nom', nom));
      grille.appendChild(b);
    }
    fig.appendChild(grille);
    const leg = element('figcaption');
    leg.appendChild(Rendu.fragment(p.ti));
    fig.appendChild(leg);
    return fig;
  }

  // ── La visionneuse ────────────────────────────────────────────────────────

  const vision = { ouverte: false, avant: null };

  function agrandir(im) {
    const v = document.getElementById('visionneuse');
    if (!v) return;
    v.textContent = '';
    v.classList.remove('absente');
    const fermerB = bouton('visionneuse-fermer', '✕', () => fermer());
    fermerB.setAttribute('aria-label', 'Fermer l’image');
    v.appendChild(fermerB);
    const cadre = element('div', 'visionneuse-cadre');
    const grande = image(im, 'visionneuse-image');
    // l'image et ses calques d'animation dans une boîte à sa mesure
    const boite = element('div', 'visionneuse-boite');
    boite.appendChild(grande);
    cadre.appendChild(boite);
    v.appendChild(cadre);
    const anime = im.an && racine.Animations ? Animations.habiller(boite, grande, im) : null;
    const pied = legende(im, 'visionneuse-legende');
    if (anime) pied.insertBefore(Animations.commandes(im, anime, true), pied.firstChild);
    if (im.src) {
      const lien = element('a', 'visionneuse-source', 'Voir la source sur Wikimedia Commons');
      lien.href = im.src;
      lien.target = '_blank';
      lien.rel = 'noopener noreferrer';
      pied.appendChild(lien);
    }
    v.appendChild(pied);
    v.setAttribute('aria-label', texte(im.l));
    if (!vision.ouverte) {
      vision.avant = document.activeElement;
      try { racine.history.pushState({ visionneuse: true, fiche: Fiche.profondeur }, ''); } catch (e) { /* historique indisponible */ }
    }
    vision.ouverte = true;
    v.hidden = false;
    document.body.classList.add('visionneuse-ouverte');
    fermerB.focus({ preventScroll: true });
  }

  function fermerSansHistorique() {
    const v = document.getElementById('visionneuse');
    vision.ouverte = false;
    if (v) { v.hidden = true; v.textContent = ''; }
    document.body.classList.remove('visionneuse-ouverte');
    const avant = vision.avant;
    vision.avant = null;
    if (avant && avant.isConnected) avant.focus({ preventScroll: true });
  }

  function fermer() {
    if (!vision.ouverte) return;
    fermerSansHistorique();
    Outils.reculer(1);
  }

  function brancher() {
    const v = document.getElementById('visionneuse');
    // Toucher le fond, ou l'image elle-même, referme : c'est le geste attendu.
    v.addEventListener('click', (e) => {
      if (e.target === v || e.target.classList.contains('visionneuse-cadre') || e.target.classList.contains('visionneuse-boite') || e.target.classList.contains('visionneuse-image')) fermer();
    });
    racine.addEventListener('online', () => entretenir());
  }

  // ── Le cache des images ───────────────────────────────────────────────────

  const etat = { total: 0, prets: 0, enCours: false, horsLigne: false };

  function signaler() {
    document.dispatchEvent(new CustomEvent('illustrations-etat', { detail: Object.assign({}, etat) }));
  }

  function toutesLesAdresses() {
    const s = new Set();
    for (const a of Dictionnaire.articles) {
      for (const im of a.im || []) {
        s.add(adresse(im));
        // les figures découpées qu'une animation pose sur l'image
        for (const e of (im.an && im.an.e) || []) if (e.image) s.add(adresse(e.image));
      }
      for (const p of a.pl || []) for (const im of p.im) s.add(adresse(im));
    }
    return Array.from(s);
  }

  /* Range dans le cache les images qui n'y sont pas encore et retire celles
   * qui ne servent plus. `force` : même en mode « économie de données ». */
  async function entretenir(force) {
    if (!('caches' in racine) || etat.enCours) return Object.assign({}, etat);
    const adresses = toutesLesAdresses();
    const absolue = (u) => new URL(u, document.baseURI).href;
    etat.total = adresses.length;
    let cache;
    try { cache = await caches.open(CACHE); } catch (e) { return Object.assign({}, etat); }
    const voulues = new Set(adresses.map(absolue));
    for (const r of await cache.keys()) if (!voulues.has(r.url)) await cache.delete(r);
    const deja = new Set((await cache.keys()).map((r) => r.url));
    const manquantes = adresses.filter((u) => !deja.has(absolue(u)));
    etat.prets = adresses.length - manquantes.length;
    const econome = racine.navigator.connection && racine.navigator.connection.saveData;
    etat.horsLigne = racine.navigator.onLine === false;
    if (!manquantes.length || etat.horsLigne || (econome && !force)) { signaler(); return Object.assign({}, etat); }
    etat.enCours = true;
    signaler();
    let i = 0;
    const ouvrier = async () => {
      while (i < manquantes.length) {
        const u = manquantes[i];
        i += 1;
        try {
          const reponse = await fetch(u);
          if (reponse.ok) {
            await cache.put(u, reponse);
            etat.prets += 1;
            signaler();
          }
        } catch (e) {
          etat.horsLigne = racine.navigator.onLine === false;
        }
      }
    };
    await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
    etat.enCours = false;
    signaler();
    return Object.assign({}, etat);
  }

  racine.Illustrations = {
    brancher, bloc, planche, agrandir, fermer, fermerSansHistorique, entretenir, adresse, image,
    get ouverte() { return vision.ouverte; },
    get etat() { return Object.assign({}, etat); },
    CACHE,
  };

})(window);
