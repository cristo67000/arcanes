'use strict';
/*
 * Les cartes à retourner : l'autre façon de réviser.
 *
 * Pas de choix proposés : on lit le recto (l'article, ou sa définition au nom
 * masqué), on cherche la réponse dans sa tête, on retourne la carte, et l'on
 * dit soi-même si on savait. C'est plus exigeant qu'un choix parmi quatre — il
 * faut retrouver, pas reconnaître — et c'est ce qui fait retenir.
 *
 * On touche la carte pour la retourner, puis « Je savais » ou « À revoir » —
 * ou l'on fait glisser la carte, à droite si on savait, à gauche sinon. Au
 * clavier : Espace retourne, → et ← jugent.
 */
(function (racine) {

  const { element, bouton } = Outils;
  const SEUIL = 90;
  const ENVOL = 260;

  function mouvementReduit() {
    return racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function dessiner(zone, q, repondre) {
    let retournee = false;
    let jugee = false;
    const a = q.cible;

    const scene = element('div', 'carte-scene');
    const carte = element('button', 'carte-flash cat-' + a.c);
    carte.type = 'button';
    const interieur = element('span', 'carte-interieur');
    const recto = element('span', 'face recto');
    recto.appendChild(element('span', 'face-consigne', q.sens === 'def-nom' ? 'Quel article ?' : 'Que savez-vous de…'));
    recto.appendChild(element('span', q.sens === 'def-nom' ? 'face-definition' : 'face-nom', q.recto));
    recto.appendChild(element('span', 'face-aide', 'Touchez pour retourner'));
    const verso = element('span', 'face verso');
    verso.setAttribute('aria-hidden', 'true');
    const tete = element('span', 'face-tete');
    if (a.gl && Glyphes[a.gl]) tete.appendChild(Glyphes.svg(a.gl, 'glyphe-carte'));
    tete.appendChild(element('span', 'face-nom', a.n));
    verso.appendChild(tete);
    if (a.da) verso.appendChild(element('span', 'face-dates', a.da));
    verso.appendChild(element('span', 'face-definition', a.defNue));
    interieur.appendChild(recto);
    interieur.appendChild(verso);
    carte.appendChild(interieur);
    scene.appendChild(carte);
    zone.appendChild(scene);

    const jugement = element('div', 'jugement');
    jugement.hidden = true;
    const non = bouton('bouton-discret juge-non', '← À revoir', () => juger(false));
    const oui = bouton('bouton-principal juge-oui', 'Je savais →', () => juger(true));
    jugement.appendChild(non);
    jugement.appendChild(oui);
    zone.appendChild(jugement);
    const pied = element('div', 'carte-pied');
    pied.hidden = true;
    pied.appendChild(element('p', 'discret', 'Ou faites glisser la carte.'));
    pied.appendChild(bouton('lien-discret', 'Lire l’article', () => Fiche.ouvrir(a.id)));
    zone.appendChild(pied);

    function retourner() {
      if (jugee) return;
      retournee = !retournee;
      carte.classList.toggle('retournee', retournee);
      recto.setAttribute('aria-hidden', retournee ? 'true' : 'false');
      verso.setAttribute('aria-hidden', retournee ? 'false' : 'true');
      jugement.hidden = false;
      pied.hidden = false;
    }

    function juger(savait) {
      if (jugee) return;
      jugee = true;
      non.disabled = true;
      oui.disabled = true;
      const cote = savait ? 1 : -1;
      scene.classList.toggle('vers-oui', savait);
      scene.classList.toggle('vers-non', !savait);
      carte.classList.remove('tenue');
      carte.classList.add('envol');
      carte.style.transform = 'translateX(' + (cote * 120) + '%) rotate(' + (cote * 14) + 'deg)';
      setTimeout(() => repondre(savait), mouvementReduit() ? 0 : ENVOL);
    }

    let depart = null;
    let ecart = 0;
    let aGlisse = false;
    carte.addEventListener('pointerdown', (e) => {
      if (!retournee || jugee || e.button > 0) return;
      depart = e.clientX;
      ecart = 0;
      aGlisse = false;
    });
    carte.addEventListener('pointermove', (e) => {
      if (depart === null) return;
      ecart = e.clientX - depart;
      if (!aGlisse && Math.abs(ecart) > 8) {
        aGlisse = true;
        carte.classList.add('tenue');
        try { carte.setPointerCapture(e.pointerId); } catch (x) { /* rien */ }
      }
      if (!aGlisse) return;
      carte.style.transform = 'translateX(' + ecart + 'px) rotate(' + (ecart / 22).toFixed(1) + 'deg)';
      scene.classList.toggle('vers-oui', ecart > SEUIL / 2);
      scene.classList.toggle('vers-non', ecart < -SEUIL / 2);
    });
    function lacher() {
      if (depart === null) return;
      depart = null;
      if (aGlisse && Math.abs(ecart) >= SEUIL) { juger(ecart > 0); return; }
      carte.classList.remove('tenue');
      carte.style.transform = '';
      scene.classList.remove('vers-oui', 'vers-non');
    }
    carte.addEventListener('pointerup', lacher);
    carte.addEventListener('pointercancel', lacher);
    carte.addEventListener('click', () => {
      if (aGlisse) { aGlisse = false; return; }
      retourner();
    });
    carte.focus({ preventScroll: true });

    return (e) => {
      if (jugee) return false;
      if ((e.key === ' ' || e.key === 'Enter') && e.target.tagName !== 'BUTTON') { retourner(); return true; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (jugement.hidden) retourner(); else juger(e.key === 'ArrowRight');
        return true;
      }
      return false;
    };
  }

  racine.Cartes = { dessiner };

})(window);
