'use strict';
/*
 * Installer l'application, et la partager.
 *
 * Une application web installable l'est déjà techniquement — le navigateur
 * propose « Ajouter à l'écran d'accueil » quelque part dans son menu. Encore
 * faut-il le savoir. D'où un bouton explicite, dans deux cas :
 *
 *   Android, Chrome, Edge   `beforeinstallprompt` est émis ; on le retient et
 *                           on le déclenche au clic.
 *   iOS, Safari             rien ne se déclenche par programme ; on explique
 *                           le geste : Partager, puis « Sur l'écran d'accueil ».
 *
 * Déjà installée, l'application n'affiche rien de tout cela.
 */
(function (racine) {

  const { element, bouton } = Outils;
  const ADRESSE = 'https://cristo67000.github.io/arcanes/';

  let invite = null;
  let ecouteur = null;

  function estInstallee() {
    return racine.matchMedia('(display-mode: standalone)').matches
      || racine.matchMedia('(display-mode: fullscreen)').matches
      || racine.navigator.standalone === true;
  }

  function estApple() {
    const ua = racine.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && racine.navigator.maxTouchPoints > 1);
  }

  function prevenir() { if (ecouteur) ecouteur(); }

  racine.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invite = e;
    prevenir();
  });
  racine.addEventListener('appinstalled', () => { invite = null; prevenir(); });

  function dessinerInstallation(bloc, zone) {
    zone.textContent = '';
    if (estInstallee()) { bloc.hidden = true; return; }
    if (invite) {
      bloc.hidden = false;
      zone.appendChild(element('p', 'discret', 'Installée, l’application s’ouvre comme les autres depuis l’écran d’accueil et fonctionne sans réseau.'));
      const b = bouton('bouton-principal', 'Installer Arcanes', async () => {
        b.disabled = true;
        try {
          invite.prompt();
          const choix = await invite.userChoice;
          if (choix && choix.outcome === 'accepted') invite = null;
        } catch (e) {
          invite = null;
        }
        prevenir();
      });
      zone.appendChild(b);
      return;
    }
    if (estApple()) {
      bloc.hidden = false;
      const marche = element('ol', 'marche-a-suivre');
      for (const etape of ['Touchez le bouton Partager de Safari (le carré et sa flèche).', 'Choisissez « Sur l’écran d’accueil ».', 'Confirmez avec « Ajouter ».']) {
        marche.appendChild(element('li', null, etape));
      }
      zone.appendChild(marche);
      return;
    }
    bloc.hidden = true;
  }

  function dessinerPartage(zone) {
    zone.textContent = '';
    const retour = element('p', 'discret retour-partage', '');
    retour.hidden = true;
    zone.appendChild(bouton('bouton-discret', 'Partager l’application', async () => {
      const contenu = { title: 'Arcanes', text: 'Arcanes, un dictionnaire encyclopédique de l’ésotérisme, hors ligne et sans publicité.', url: ADRESSE };
      if (racine.navigator.share) {
        try { await racine.navigator.share(contenu); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const ok = await Outils.copier(ADRESSE);
      retour.textContent = ok ? 'Adresse copiée.' : ADRESSE;
      retour.hidden = false;
    }));
    zone.appendChild(element('p', 'adresse-partage', ADRESSE));
    zone.appendChild(retour);
  }

  racine.Installer = {
    dessinerInstallation, dessinerPartage, estInstallee, estApple, ADRESSE,
    surChangement: (f) => { ecouteur = f; },
  };

})(window);
