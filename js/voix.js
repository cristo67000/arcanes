'use strict';
/*
 * La lecture à voix haute, par la synthèse vocale du système.
 *
 * Aucun fichier son n'est embarqué : `speechSynthesis` emploie les voix
 * installées sur l'appareil et fonctionne donc hors ligne.
 *
 * Le français de France passe devant. Le système donne ses voix dans son
 * ordre à lui, et la première venue est souvent canadienne : « fr-CA » avant
 * « fr-FR » sur Android, Amélie avant Thomas sur iPhone. Les voix sont donc
 * rangées : France, français sans région, Belgique, Suisse et voisins, les
 * autres, le Canada en dernier ; à région égale, une voix de l'appareil avant
 * une voix en ligne, puis la meilleure (« premium », « améliorée »), les voix
 * Eloquence d'Apple, robotiques, en queue. (Même règle que dans les autres
 * applications de langue du dossier.)
 *
 * Un article se lit phrase par phrase : certains navigateurs coupent un
 * énoncé trop long au bout d'une quinzaine de secondes, et la lecture par
 * morceaux permet d'arrêter net.
 */
(function (racine) {

  const disponible = typeof speechSynthesis !== 'undefined'
    && typeof SpeechSynthesisUtterance !== 'undefined';

  const REGIONS = {
    FR: { rang: 0, nom: 'France', motif: /france/i },
    '': { rang: 1, nom: '', motif: null },
    BE: { rang: 2, nom: 'Belgique', motif: /belgi/i },
    CH: { rang: 2, nom: 'Suisse', motif: /suisse|switzerland|schweiz/i },
    LU: { rang: 2, nom: 'Luxembourg', motif: /luxemb/i },
    MC: { rang: 2, nom: 'Monaco', motif: /monaco/i },
    CA: { rang: 9, nom: 'Canada', motif: /canad|qu[ée]bec/i },
  };
  const AUTRE_REGION = 5;
  const ELOQUENCE = /^(eddy|flo|grandma|grandpa|grand-m[èe]re|grand-p[èe]re|reed|rocko|sandy|shelley)\b/i;

  let voix = [];
  let actif = true;
  let choisie = null;
  let file = [];             // les phrases qui restent à dire
  let enCours = null;        // gardé en mémoire : Chrome ramasse sinon l'énoncé
  let lecture = null;        // { id, surFin } : ce qui est en train d'être lu

  function balise(v) { return String(v.lang || '').replace(/_/g, '-'); }
  function francaise(v) { return balise(v).toLowerCase().split('-')[0] === 'fr'; }
  function regionDe(v) {
    if (REGIONS.CA.motif.test(v.name || '')) return 'CA';
    const sous = balise(v).split('-').slice(1).find((s) => /^([a-z]{2}|\d{3})$/i.test(s));
    return sous ? sous.toUpperCase() : '';
  }
  function rangDe(v) { const r = REGIONS[regionDe(v)]; return r ? r.rang : AUTRE_REGION; }
  function qualite(v) {
    const signes = (v.voiceURI || '') + ' ' + (v.name || '');
    if (/eloquence/i.test(signes) || ELOQUENCE.test(v.name || '')) return 0;
    if (/premium/i.test(signes)) return 3;
    if (/enhanced|am[ée]lior|natural|neural/i.test(signes)) return 2;
    return 1;
  }
  function classer(liste) {
    const cles = new Map(liste.map((v, i) => [v, [rangDe(v), v.localService ? 0 : 1, -qualite(v), v.default ? 0 : 1, i]]));
    return liste.slice().sort((a, b) => {
      const x = cles.get(a);
      const y = cles.get(b);
      for (let k = 0; k < x.length; k += 1) if (x[k] !== y[k]) return x[k] - y[k];
      return 0;
    });
  }
  function nomDeRegion(code) {
    if (REGIONS[code]) return REGIONS[code].nom;
    try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  }
  function libelle(v) {
    const code = regionDe(v);
    const region = nomDeRegion(code);
    const dite = REGIONS[code] && REGIONS[code].motif && REGIONS[code].motif.test(v.name || '');
    return region && !dite ? v.name + ' — ' + region : v.name;
  }

  function recenser() {
    if (!disponible) return;
    try { voix = classer((speechSynthesis.getVoices() || []).filter(francaise)); } catch (e) { voix = []; }
  }

  if (disponible) {
    recenser();
    speechSynthesis.addEventListener('voiceschanged', () => {
      recenser();
      document.dispatchEvent(new CustomEvent('voix-changees'));
    });
  }

  function utilisable(v) {
    return v.localService || typeof navigator === 'undefined' || navigator.onLine !== false;
  }
  function automatique() {
    if (!voix.length) recenser();
    return voix.find(utilisable) || voix[0] || null;
  }
  function retenue() {
    if (!voix.length) recenser();
    if (choisie) {
      const v = voix.find((x) => x.voiceURI === choisie.uri) || voix.find((x) => x.name === choisie.nom);
      if (v && utilisable(v)) return v;
    }
    return automatique();
  }
  function possible() { return disponible && actif && !!retenue(); }

  /* Découpe un texte en phrases d'au plus deux cents signes environ. */
  function phrases(texte) {
    const morceaux = String(texte).replace(/\s+/g, ' ').match(/[^.!?;:]+[.!?;:]*\s*/g) || [];
    const sortie = [];
    for (const m of morceaux) {
      const s = m.trim();
      if (!s) continue;
      if (sortie.length && (sortie[sortie.length - 1].length + s.length < 200)) sortie[sortie.length - 1] += ' ' + s;
      else sortie.push(s);
    }
    return sortie;
  }

  function suivante() {
    if (!file.length) { finir(); return; }
    const v = retenue();
    const enonce = new SpeechSynthesisUtterance(file.shift());
    enonce.voice = v;
    enonce.lang = balise(v) || 'fr-FR';
    enonce.rate = 0.97;
    enonce.onend = () => { if (enCours === enonce) suivante(); };
    enonce.onerror = () => { if (enCours === enonce) finir(); };
    enCours = enonce;
    speechSynthesis.speak(enonce);
  }

  function finir() {
    const fin = lecture && lecture.surFin;
    file = [];
    enCours = null;
    lecture = null;
    if (fin) fin();
  }

  /* Lit un texte. `id` identifie ce qu'on lit, pour savoir si un bouton est
   * « en train de lire » ; `surFin` est appelé à la fin ou à l'arrêt. */
  function lire(texte, id, surFin) {
    if (!possible() || !texte) return false;
    taire();
    file = phrases(texte);
    lecture = { id, surFin };
    try { speechSynthesis.cancel(); } catch (e) { /* rien */ }
    suivante();
    return true;
  }

  function taire() {
    const fin = lecture && lecture.surFin;
    file = [];
    enCours = null;
    lecture = null;
    if (disponible) try { speechSynthesis.cancel(); } catch (e) { /* rien */ }
    if (fin) fin();
  }

  function regler(reglages) {
    actif = reglages.voix !== false;
    choisie = reglages.voixFr || null;
    document.dispatchEvent(new CustomEvent('voix-changees'));
  }

  function decrire(v) {
    return v ? { uri: v.voiceURI, nom: v.name, libelle: libelle(v), lang: balise(v), locale: !!v.localService } : null;
  }

  racine.Voix = {
    disponible, lire, taire, regler, possible, phrases,
    lister() { recenser(); return voix.map(decrire); },
    enLecture: (id) => !!(lecture && lecture.id === id),
    get retenue() { return decrire(retenue()); },
    get automatique() { return decrire(automatique()); },
    get choisie() { return choisie; },
    get actif() { return actif; },
  };

})(window);
