'use strict';
/*
 * Les sons : cris d'animaux, musiques, poèmes dits.
 *
 * Les enregistrements viennent de Wikimedia Commons, tous dans le domaine
 * public ou sous CC0 ; build/sons.txt dit d'où vient chacun, build/sonoriser.py
 * en tire un MP3 et le range dans son/. Un article en porte une liste (`so`),
 * que la fiche présente sous « À écouter ». Rien ne joue tout seul : un son
 * ne part que si on le touche, et un seul à la fois.
 *
 * Quelques bruits n'ont pas besoin de fichier : les coups frappés d'une table
 * tournante, la carte qu'on retourne, la cloche, le tonnerre… Le `Bruiteur`
 * les fabrique sur place avec l'API Web Audio, sans réseau.
 *
 * ── Hors ligne ─────────────────────────────────────────────────────────────
 *
 * Les sons ne sont pas dans la coquille du service worker (plusieurs dizaines
 * de mégaoctets) : chacun se range dans le cache `arcanes-sons` à sa première
 * écoute (le service worker l'y range et l'en ressert), et l'on peut tous les y
 * mettre depuis les Réglages. Le lecteur lit l'adresse du fichier elle-même :
 * la politique de sécurité de la page n'accepte pas d'adresse « blob: ».
 */
(function (racine) {

  const { element, bouton } = Outils;
  const CACHE = 'arcanes-sons';

  const lecture = { audio: null, son: null, bouton: null, synthese: null, fondu: null, avance: null };

  function adresse(s) { return s.f + '?v=' + s.v; }

  function duree(s) {
    const d = Math.round(s.d || 0);
    return d >= 60 ? Math.floor(d / 60) + ' min ' + String(d % 60).padStart(2, '0') : d + ' s';
  }

  function marquer(b, etat) {
    if (!b) return;
    b.classList.remove('joue', 'charge', 'absent');
    if (etat) b.classList.add(etat);
    b.setAttribute('aria-pressed', etat === 'joue' || etat === 'charge' ? 'true' : 'false');
  }

  /* Arrête ce qui joue, fichier ou bruit de synthèse. */
  function arreter() {
    if (lecture.fondu) { racine.clearInterval(lecture.fondu); lecture.fondu = null; }
    if (lecture.audio) {
      lecture.audio.pause();
      lecture.audio.removeAttribute('src');
      lecture.audio = null;
    }
    if (lecture.synthese) { lecture.synthese.arreter(); lecture.synthese = null; }
    marquer(lecture.bouton, null);
    if (lecture.avance) lecture.avance.style.width = '0';
    lecture.son = null;
    lecture.bouton = null;
    lecture.avance = null;
  }

  /* Joue un son (ou l'arrête s'il joue déjà). `ref` : un son du dictionnaire,
   * ou { s: 'coups' } pour un bruit de synthèse. `b` : le bouton qui le montre. */
  async function jouer(ref, b, avance) {
    if (!ref) return;
    if (lecture.son === ref) { arreter(); return; }
    arreter();
    if (racine.Voix && Voix.taire) Voix.taire();
    lecture.son = ref;
    lecture.bouton = b || null;
    lecture.avance = avance || null;
    if (ref.s) {
      marquer(b, 'joue');
      lecture.synthese = Bruiteur.jouer(ref.s, () => { if (lecture.son === ref) arreter(); });
      return;
    }
    marquer(b, 'charge');
    const audio = new Audio();
    audio.preload = 'auto';
    lecture.audio = audio;
    audio.addEventListener('ended', () => { if (lecture.audio === audio) arreter(); });
    audio.addEventListener('playing', () => { if (lecture.audio === audio) marquer(b, 'joue'); });
    // hors ligne, un son jamais écouté n'est pas dans le cache
    audio.addEventListener('error', () => {
      if (lecture.audio !== audio) return;
      const bt = lecture.bouton;
      arreter();
      marquer(bt, 'absent');
    });
    audio.src = adresse(ref);
    audio.addEventListener('timeupdate', () => {
      // la durée annoncée par le fichier, ou celle que la construction a mesurée
      const total = Number.isFinite(audio.duration) && audio.duration ? audio.duration : ref.d;
      if (lecture.avance && total) lecture.avance.style.width = Math.min(100, 100 * audio.currentTime / total).toFixed(1) + '%';
    });
    // un fondu d'entrée, là où le navigateur laisse régler le volume
    audio.volume = 0;
    let v = 0;
    lecture.fondu = racine.setInterval(() => {
      v = Math.min(1, v + 0.08);
      try { audio.volume = v; } catch (e) { /* volume imposé (iOS) */ }
      if (v >= 1) { racine.clearInterval(lecture.fondu); lecture.fondu = null; }
    }, 40);
    try {
      await audio.play();
    } catch (e) {
      if (lecture.audio === audio && e.name !== 'AbortError') arreter();
    }
  }

  // ── Dans la fiche ─────────────────────────────────────────────────────────

  let ficheEnCours = null;

  /* « À écouter » : un bouton par son, avec son titre, son crédit, sa durée. */
  function bloc(a) {
    if (ficheEnCours !== a.id) { arreter(); ficheEnCours = a.id; }
    if (!a.so || !a.so.length) return null;
    const section = element('section', 'sons');
    section.appendChild(element('h3', 'rubrique', 'À écouter'));
    for (const s of a.so) {
      const ligne = element('div', 'son');
      const b = bouton('son-bouton', '', null);
      b.setAttribute('aria-label', 'Écouter : ' + Dictionnaire.nu(s.ti));
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(element('span', 'son-icone'));
      const texte = element('div', 'son-texte');
      texte.appendChild(element('span', 'son-titre')).appendChild(Rendu.fragment(s.ti));
      const credit = element('span', 'son-credit');
      credit.appendChild(Rendu.fragment(s.cr + ' · ' + s.li + ' · ' + duree(s) + ' · '));
      const lien = element('a', 'son-source', 'source');
      lien.href = s.src;
      lien.target = '_blank';
      lien.rel = 'noopener noreferrer';
      credit.appendChild(lien);
      texte.appendChild(credit);
      const barre = element('span', 'son-barre');
      const avance = element('span', 'son-avance');
      barre.appendChild(avance);
      texte.appendChild(barre);
      b.addEventListener('click', () => jouer(s, b, avance));
      ligne.appendChild(b);
      ligne.appendChild(texte);
      section.appendChild(ligne);
    }
    return section;
  }

  // ── Le cache des sons ─────────────────────────────────────────────────────

  const etat = { total: 0, prets: 0, enCours: false };

  function signaler() {
    document.dispatchEvent(new CustomEvent('sons-etat', { detail: Object.assign({}, etat) }));
  }

  function toutesLesAdresses() {
    const s = new Set();
    for (const a of Dictionnaire.articles) for (const x of a.so || []) s.add(adresse(x));
    return Array.from(s);
  }

  /* Compte ce qui est rangé, retire ce qui ne sert plus ; `tout` : range aussi
   * ce qui manque (le bouton des Réglages). */
  async function entretenir(tout) {
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
    if (!tout || !manquantes.length || racine.navigator.onLine === false) { signaler(); return Object.assign({}, etat); }
    etat.enCours = true;
    signaler();
    for (const u of manquantes) {
      try {
        const r = await fetch(u);
        if (r.ok) { etat.prets += 1; signaler(); }
      } catch (e) { break; }
    }
    etat.enCours = false;
    signaler();
    return Object.assign({}, etat);
  }

  racine.Sons = {
    jouer, arreter, bloc, entretenir, adresse, duree, CACHE,
    get etat() { return Object.assign({}, etat); },
    get enCours() { return lecture.son; },
  };

  // ── Le bruiteur ───────────────────────────────────────────────────────────

  /* Des bruits fabriqués par l'API Web Audio. Chaque recette reçoit le
   * contexte, l'instant de départ et la sortie, et rend sa durée. */
  let contexte = null;

  function ctx() {
    if (!contexte) {
      const C = racine.AudioContext || racine.webkitAudioContext;
      if (!C) return null;
      contexte = new C();
    }
    if (contexte.state === 'suspended') contexte.resume();
    return contexte;
  }

  const tampons = {};
  function bruit(c, sorte) {
    if (tampons[sorte]) return tampons[sorte];
    const n = c.sampleRate * 3;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let dernier = 0;
    for (let i = 0; i < n; i += 1) {
      const blanc = Math.random() * 2 - 1;
      if (sorte === 'brun') { dernier = (dernier + 0.02 * blanc) / 1.02; d[i] = dernier * 3.5; } else d[i] = blanc;
    }
    tampons[sorte] = b;
    return b;
  }

  function source(c, sorte, t, longueur, sortie, filtre, freq, q) {
    const s = c.createBufferSource();
    s.buffer = bruit(c, sorte || 'blanc');
    s.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    let dernier = s;
    if (filtre) {
      const f = c.createBiquadFilter();
      f.type = filtre;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      s.connect(f);
      dernier = f;
      s.filtre = f;
    }
    dernier.connect(g);
    g.connect(sortie);
    s.start(t);
    s.stop(t + longueur);
    s.gainNode = g;
    return s;
  }

  function note(c, t, freq, longueur, sortie, volume, forme, attaque) {
    const o = c.createOscillator();
    o.type = forme || 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + (attaque || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + longueur);
    o.connect(g);
    g.connect(sortie);
    o.start(t);
    o.stop(t + longueur + 0.05);
    return o;
  }

  function coup(c, t, sortie, force) {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * force, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(sortie);
    o.start(t);
    o.stop(t + 0.3);
    const b = source(c, 'blanc', t, 0.08, sortie, 'lowpass', 1400);
    b.gainNode.gain.setValueAtTime(0.5 * force, t);
    b.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  }

  const RECETTES = {
    // trois coups frappés, deux fois : l'esprit répond
    coups(c, t, s) {
      for (const [k, f] of [[0, 1], [0.42, 0.9], [0.84, 1], [2.1, 0.8], [2.5, 0.95], [2.9, 1]]) coup(c, t + k, s, f);
      return 3.4;
    },
    // une carte qu'on fait claquer, puis qu'on retourne
    carte(c, t, s) {
      for (const [k, v] of [[0, 0.6], [0.07, 0.35]]) {
        const b = source(c, 'blanc', t + k, 0.05, s, 'highpass', 2500);
        b.gainNode.gain.setValueAtTime(v, t + k);
        b.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.035);
      }
      const f = source(c, 'blanc', t + 0.16, 0.22, s, 'bandpass', 900, 1.5);
      f.filtre.frequency.setValueAtTime(700, t + 0.16);
      f.filtre.frequency.exponentialRampToValueAtTime(3800, t + 0.34);
      f.gainNode.gain.setValueAtTime(0.0001, t + 0.16);
      f.gainNode.gain.exponentialRampToValueAtTime(0.35, t + 0.22);
      f.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.37);
      for (const [k, fr] of [[0.5, 1318.5], [0.6, 1567.98], [0.72, 2093]]) note(c, t + k, fr, 1.2, s, 0.12, 'triangle');
      return 2;
    },
    tonnerre(c, t, s) {
      const e = source(c, 'blanc', t, 0.4, s, 'highpass', 900);
      e.gainNode.gain.setValueAtTime(0.0001, t);
      e.gainNode.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      e.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      const r = source(c, 'brun', t, 6, s, 'lowpass', 260);
      const g = r.gainNode.gain;
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(1.6, t + 0.15);
      let k = 0.15;
      while (k < 5) {
        k += 0.25 + Math.random() * 0.5;
        g.linearRampToValueAtTime(0.4 + Math.random() * 1.2, t + k);
      }
      g.exponentialRampToValueAtTime(0.0001, t + 5.9);
      return 6;
    },
    vent(c, t, s) {
      const v = source(c, 'blanc', t, 7, s, 'bandpass', 500, 0.8);
      v.gainNode.gain.setValueAtTime(0.0001, t);
      v.gainNode.gain.exponentialRampToValueAtTime(0.5, t + 1.5);
      v.gainNode.gain.linearRampToValueAtTime(0.25, t + 4);
      v.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 7);
      for (let k = 0; k < 7; k += 0.9) v.filtre.frequency.linearRampToValueAtTime(320 + Math.random() * 900, t + k);
      return 7;
    },
    feu(c, t, s) {
      const fond = source(c, 'brun', t, 6, s, 'lowpass', 500);
      fond.gainNode.gain.setValueAtTime(0.0001, t);
      fond.gainNode.gain.exponentialRampToValueAtTime(0.5, t + 0.8);
      fond.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 6);
      for (let i = 0; i < 70; i += 1) {
        const k = 0.2 + Math.random() * 5.5;
        const b = source(c, 'blanc', t + k, 0.03, s, 'bandpass', 1500 + Math.random() * 3000, 2);
        b.gainNode.gain.setValueAtTime(0.15 + Math.random() * 0.5, t + k);
        b.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.02);
      }
      return 6;
    },
    cloche(c, t, s) {
      for (const [r, v, l] of [[0.5, 0.25, 6], [1, 0.35, 5], [1.19, 0.2, 4], [1.5, 0.15, 3.5], [2, 0.12, 3], [2.74, 0.08, 2], [3, 0.06, 1.6]]) note(c, t, 392 * r, l, s, v);
      for (const [r, v, l] of [[0.5, 0.2, 5], [1, 0.28, 4]]) note(c, t + 2.2, 330 * r, l, s, v);
      return 7;
    },
    gong(c, t, s) {
      for (const [r, v] of [[1, 0.4], [1.006, 0.3], [1.47, 0.22], [2.09, 0.16], [2.56, 0.12], [3.18, 0.08], [4.2, 0.05]]) note(c, t, 98 * r, 7, s, v, 'sine', 0.04);
      const b = source(c, 'brun', t, 1.5, s, 'lowpass', 900);
      b.gainNode.gain.setValueAtTime(0.4, t);
      b.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      return 7;
    },
    tic(c, t, s) {
      for (let i = 0; i < 10; i += 1) {
        const k = t + i * 0.62;
        note(c, k, i % 2 ? 1250 : 1750, 0.06, s, 0.25, 'square');
        const b = source(c, 'blanc', k, 0.03, s, 'highpass', 3000);
        b.gainNode.gain.setValueAtTime(0.2, k);
        b.gainNode.gain.exponentialRampToValueAtTime(0.0001, k + 0.02);
      }
      return 6.4;
    },
    coeur(c, t, s) {
      for (let i = 0; i < 7; i += 1) {
        const k = t + i * 0.86;
        note(c, k, 62, 0.16, s, 0.9, 'sine', 0.01);
        note(c, k + 0.24, 52, 0.18, s, 0.6, 'sine', 0.01);
      }
      return 6.2;
    },
    // un arpège qui monte et scintille : une apparition, une étoile
    enchantement(c, t, s) {
      const gamme = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
      gamme.forEach((f, i) => {
        note(c, t + i * 0.11, f, 1.8, s, 0.11, 'sine');
        note(c, t + i * 0.11, f * 2.005, 1.1, s, 0.03, 'triangle');
      });
      for (const f of [523.25, 659.25, 783.99, 1046.5]) note(c, t + 1.5, f, 2.6, s, 0.07, 'sine', 0.3);
      return 4.2;
    },
    // un souffle qui monte : la table se soulève
    souffle(c, t, s) {
      const v = source(c, 'blanc', t, 4.5, s, 'lowpass', 200, 2);
      v.filtre.frequency.setValueAtTime(180, t);
      v.filtre.frequency.exponentialRampToValueAtTime(1600, t + 2.2);
      v.filtre.frequency.exponentialRampToValueAtTime(220, t + 4.4);
      v.gainNode.gain.setValueAtTime(0.0001, t);
      v.gainNode.gain.exponentialRampToValueAtTime(0.45, t + 1.8);
      v.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
      note(c, t, 55, 4.4, s, 0.25, 'sine', 1.2);
      note(c, t, 82.4, 4.2, s, 0.12, 'sine', 1.4);
      return 4.6;
    },
    eau(c, t, s) {
      for (let i = 0; i < 26; i += 1) {
        const k = t + Math.random() * 4.5;
        const o = c.createOscillator();
        const f = 300 + Math.random() * 700;
        o.frequency.setValueAtTime(f, k);
        o.frequency.exponentialRampToValueAtTime(f * 2.2, k + 0.08);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, k);
        g.gain.exponentialRampToValueAtTime(0.18, k + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, k + 0.1);
        o.connect(g);
        g.connect(s);
        o.start(k);
        o.stop(k + 0.12);
      }
      const fond = source(c, 'brun', t, 5, s, 'lowpass', 700);
      fond.gainNode.gain.setValueAtTime(0.0001, t);
      fond.gainNode.gain.exponentialRampToValueAtTime(0.3, t + 0.6);
      fond.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      return 5;
    },
  };

  const Bruiteur = {
    /* Joue une recette ; rend { arreter } ; `fini` est appelé à la fin. */
    jouer(nom, fini) {
      const c = ctx();
      const recette = RECETTES[nom];
      if (!c || !recette) { if (fini) racine.setTimeout(fini, 0); return { arreter() {} }; }
      const sortie = c.createGain();
      sortie.gain.value = 0.55;
      const compresseur = c.createDynamicsCompressor();
      sortie.connect(compresseur);
      compresseur.connect(c.destination);
      const t = c.currentTime + 0.03;
      const longueur = recette(c, t, sortie);
      const minuteur = racine.setTimeout(() => { if (fini) fini(); }, (longueur + 0.2) * 1000);
      return {
        arreter() {
          racine.clearTimeout(minuteur);
          sortie.gain.setTargetAtTime(0, c.currentTime, 0.04);
          racine.setTimeout(() => { try { sortie.disconnect(); compresseur.disconnect(); } catch (e) { /* déjà débranché */ } }, 300);
        },
      };
    },
    recettes: Object.keys(RECETTES),
  };
  racine.Bruiteur = Bruiteur;

})(window);
