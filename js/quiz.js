'use strict';
/*
 * L'onglet « Révision » : retrouver un article d'après sa définition, la
 * définition d'après l'article, ou ranger dans le temps — à quatre choix ; ou,
 * en mode « cartes », se tester seul (voir cartes.js).
 *
 * Trois soins pour que les questions soient justes :
 *
 *   Pas de réponse qui se devine. Une définition contient souvent le nom
 *   qu'elle définit (« L'alchimie est… ») : le nom de l'article demandé *et*
 *   ceux des trois leurres sont remplacés par « … » dans tous les textes
 *   affichés — dans tous, sinon la seule proposition sans points de
 *   suspension serait la bonne.
 *
 *   Pas de leurre qui serait aussi une bonne réponse. Les articles reliés
 *   entre eux (« voir aussi », renvois) sont exclus des leurres : « Gnose » et
 *   « Gnosticisme » ont des définitions trop proches.
 *
 *   Des leurres du même monde. Ils sont pris d'abord dans la même catégorie :
 *   la question demande de savoir quelque chose, pas de reconnaître qu'une
 *   figure de la Renaissance côtoie trois signes du zodiaque.
 *
 * La question « Lequel est le plus ancien ? » prend quatre articles datés,
 * séparés d'au moins quarante ans, pour qu'elle porte sur l'histoire et non
 * sur une querelle de dates.
 *
 * Chaque réponse met à jour le suivi : une erreur range l'article dans « À
 * revoir » ; deux bonnes réponses de suite l'en sortent.
 */
(function (racine) {

  const { element, bouton, melanger, svg } = Outils;

  const etat = {
    config: { source: 'tous' },
    questions: [], i: 0, ok: 0, ratees: [], resultats: [],
    serie: 0, meilleureSerie: 0, repondu: false, ecran: 'accueil', jeton: 0,
    touches: null, derniere: null,
  };
  let zone = null;
  let tete = null;

  const SENS = { mixte: 'Mélangé', 'def-nom': 'Définition → article', 'nom-def': 'Article → définition', chrono: 'Chronologie' };
  const CONSIGNES = {
    'def-nom': 'Quel article répond à cette définition ?',
    'nom-def': 'Quelle est la bonne définition ?',
    chrono: 'Lequel est le plus ancien ?',
  };

  // ── Construction des questions ────────────────────────────────────────────

  function courte(a) {
    let texte = a.defNue || '';
    if (texte.length > 190) texte = texte.slice(0, 190).replace(/\s+\S*$/, '') + '…';
    return texte;
  }

  async function articlesDeLaSource(source) {
    const tous = Dictionnaire.articles.filter((a) => a.defNue);
    if (source === 'tous') return tous;
    if (source.startsWith('cat:')) return tous.filter((x) => x.c === source.slice(4));
    const suivis = await Store.tousLesSuivis().catch(() => []);
    const refs = new Set(suivis.filter((s) => (source === 'favoris' ? s.favori : s.aRevoir)).map((s) => s.ref));
    return tous.filter((x) => refs.has(x.id));
  }

  function voisinsDe(cible) {
    const ids = new Set((cible.v || []).concat(cible.ci || []));
    for (const x of Dictionnaire.articles) if ((x.v || []).includes(cible.id)) ids.add(x.id);
    ids.add(cible.id);
    return ids;
  }

  function questionChrono(cible) {
    if (typeof cible.an !== 'number') return null;
    const dates = Dictionnaire.frise();
    const pris = [cible];
    for (const x of melanger(dates)) {
      if (pris.length === 4) break;
      if (pris.every((p) => Math.abs(p.an - x.an) >= 40)) pris.push(x);
    }
    if (pris.length < 4) return null;
    const plusAncien = pris.reduce((m, x) => (x.an < m.an ? x : m));
    return {
      type: 'qcm', sens: 'chrono', cible: plusAncien,
      enonce: CONSIGNES.chrono,
      propositions: melanger(pris).map((x) => ({ article: x, texte: x.n })),
    };
  }

  async function construire(cfg) {
    const source = await articlesDeLaSource(cfg.source);
    const suivis = new Map((await Store.tousLesSuivis().catch(() => [])).map((s) => [s.ref, s]));
    // les moins bien sus d'abord, à égalité au hasard
    const ordre = melanger(source).sort((a, b) => ((suivis.get(a.id) || {}).serie || 0) - ((suivis.get(b.id) || {}).serie || 0));
    const questions = [];
    for (const cible of ordre) {
      if (questions.length >= cfg.n) break;
      let sens = cfg.sens;
      if (sens === 'mixte') {
        const tirage = Math.random();
        sens = tirage < 0.42 ? 'def-nom' : (tirage < 0.84 ? 'nom-def' : 'chrono');
      }
      if (cfg.mode === 'cartes') {
        if (sens === 'chrono') sens = 'def-nom';
        questions.push({
          type: 'carte', cible, sens,
          recto: sens === 'def-nom' ? Dictionnaire.masquer(courte(cible), [cible]) : cible.n,
        });
        continue;
      }
      if (sens === 'chrono') {
        const q = questionChrono(cible);
        if (q && !questions.some((x) => x.cible.id === q.cible.id)) { questions.push(q); continue; }
        sens = 'def-nom';
      }
      const interdits = voisinsDe(cible);
      const candidats = Dictionnaire.articles.filter((x) => !interdits.has(x.id) && x.defNue && !x.perso);
      if (candidats.length < 3) continue;
      const memes = melanger(candidats.filter((x) => x.c === cible.c));
      const autres = melanger(candidats.filter((x) => x.c !== cible.c));
      const leurres = memes.concat(autres).slice(0, 3);
      const concernes = [cible].concat(leurres);
      questions.push({
        type: 'qcm', cible, sens,
        propositions: melanger(concernes).map((x) => ({
          article: x,
          texte: sens === 'def-nom' ? x.n : Dictionnaire.masquer(courte(x), concernes),
        })),
        enonce: sens === 'def-nom' ? Dictionnaire.masquer(courte(cible), concernes) : cible.n,
      });
    }
    return questions;
  }

  function reglagesDeSeance(source) {
    const r = App.reglages;
    return { source: source || etat.config.source, sens: r.quizSens, n: r.quizNombre, mode: r.quizMode };
  }

  // ── Écran d'accueil ───────────────────────────────────────────────────────

  function segments(nom, valeurs, actuelle, action, libelle) {
    const g = element('div', 'segments segments-' + nom);
    g.setAttribute('role', 'group');
    for (const v of valeurs) {
      const b = bouton('', libelle(v), () => action(v));
      b.setAttribute('aria-pressed', String(v) === String(actuelle) ? 'true' : 'false');
      g.appendChild(b);
    }
    return g;
  }

  function jauge(part, classe) {
    const j = element('div', 'jauge' + (classe ? ' ' + classe : ''));
    const barre = element('div');
    j.appendChild(barre);
    requestAnimationFrame(() => { barre.style.width = Math.round(Math.max(0, Math.min(1, part)) * 100) + '%'; });
    return j;
  }

  async function dessinerAccueil() {
    etat.ecran = 'accueil';
    etat.jeton += 1;
    const jeton = etat.jeton;
    const r = App.reglages;
    const suivis = await Store.tousLesSuivis().catch(() => []);
    if (jeton !== etat.jeton) return;
    zone.textContent = '';
    const fav = suivis.filter((s) => s.favori).length;
    const rev = suivis.filter((s) => s.aRevoir).length;
    const justes = suivis.reduce((n, s) => n + (s.ok || 0), 0);

    zone.appendChild(element('h2', null, 'Révision'));
    zone.appendChild(element('p', 'discret', 'Éprouvez ce que vous avez lu : des questions à quatre choix, ou des cartes à retourner. Les articles ratés passent dans « À revoir ».'));
    const compteurs = element('div', 'compteurs');
    for (const [chiffre, libelle, classe] of [[fav, 'favoris', ''], [rev, 'à revoir', 'moyen'], [justes, 'bonnes réponses', 'bien']]) {
      const c = element('div', 'compteur ' + classe);
      c.appendChild(element('span', 'chiffre', String(chiffre)));
      c.appendChild(element('span', 'etiquette-compteur', libelle));
      compteurs.appendChild(c);
    }
    zone.appendChild(compteurs);

    const livres = new Set(Dictionnaire.livres.map((x) => x.id));
    const vus = suivis.filter((s) => s.vu && livres.has(s.ref)).length;
    const decouverte = element('div', 'decouverte');
    decouverte.appendChild(element('p', 'discret', 'Vous avez ouvert ' + vus + ' article' + (vus > 1 ? 's' : '') + ' sur ' + livres.size + '.'));
    decouverte.appendChild(jauge(vus / (livres.size || 1), 'jauge-decouverte'));
    zone.appendChild(decouverte);

    const message = element('p', 'erreur', '');
    message.hidden = true;
    const lancer = async (source) => {
      const cfg = reglagesDeSeance(source);
      const questions = await construire(cfg);
      if (!questions.length) { message.textContent = 'Pas assez d’articles pour une séance. Ajoutez des favoris, ou choisissez « Tout le dictionnaire ».'; message.hidden = false; return; }
      etat.derniere = cfg;
      commencer(questions);
    };

    if (rev) {
      const carte = bouton('carte-revoir', '', () => lancer('a-revoir'));
      carte.appendChild(element('span', 'carte-revoir-titre', 'Revoir ' + Outils.pluriel(rev, 'article raté', 'articles ratés')));
      carte.appendChild(element('span', 'carte-revoir-aide', 'Une séance sur ce que vous avez manqué.'));
      zone.appendChild(carte);
    }

    const bloc = element('section', 'bloc');
    bloc.appendChild(element('h3', null, 'Façon de réviser'));
    bloc.appendChild(segments('mode', ['qcm', 'cartes'], r.quizMode,
      async (v) => { await App.ecrireReglage('quizMode', v); dessinerAccueil(); }, (v) => (v === 'qcm' ? 'Quatre choix' : 'Cartes à retourner')));
    bloc.appendChild(element('p', 'discret', r.quizMode === 'cartes'
      ? 'Lisez le recto, cherchez la réponse, retournez la carte et dites si vous saviez.'
      : 'Choisissez la bonne réponse parmi quatre propositions.'));

    bloc.appendChild(element('h4', null, 'Sur quels articles'));
    const options = [['tous', 'Tout le dictionnaire'], ['favoris', 'Mes favoris (' + fav + ')'], ['a-revoir', 'À revoir (' + rev + ')']];
    for (const c of Dictionnaire.categories) options.push(['cat:' + c.id, c.nom]);
    const sel = element('select', 'saisie-texte');
    sel.setAttribute('aria-label', 'Sur quels articles');
    for (const [v, l] of options) {
      const o = element('option', null, l);
      o.value = v;
      if (v === etat.config.source) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => { etat.config.source = sel.value; });
    bloc.appendChild(sel);

    bloc.appendChild(element('h4', null, 'Questions'));
    const sens = r.quizMode === 'cartes' ? ['mixte', 'def-nom', 'nom-def'] : ['mixte', 'def-nom', 'nom-def', 'chrono'];
    bloc.appendChild(segments('sens', sens, sens.includes(r.quizSens) ? r.quizSens : 'mixte',
      async (v) => { await App.ecrireReglage('quizSens', v); dessinerAccueil(); }, (v) => SENS[v]));
    bloc.appendChild(element('h4', null, 'Nombre de questions'));
    bloc.appendChild(segments('nombre', [5, 10, 20], r.quizNombre,
      async (v) => { await App.ecrireReglage('quizNombre', v); dessinerAccueil(); }, (v) => String(v)));
    zone.appendChild(bloc);

    zone.appendChild(bouton('bouton-principal', 'Commencer', () => lancer()));
    zone.appendChild(message);
  }

  // ── Une séance ────────────────────────────────────────────────────────────

  function commencer(questions) {
    Object.assign(etat, {
      ecran: 'seance', questions, i: 0, ok: 0, ratees: [], resultats: [], serie: 0, meilleureSerie: 0,
    });
    etat.jeton += 1;
    dessinerQuestion();
  }

  function suivante() {
    if (etat.i >= etat.questions.length - 1) finSeance(true);
    else { etat.i += 1; dessinerQuestion(); }
  }

  function dessinerEntete() {
    const q = etat.questions[etat.i];
    const bloc = element('div', 'seance-tete');
    const pastilles = element('div', 'pastilles');
    pastilles.setAttribute('aria-hidden', 'true');
    etat.questions.forEach((x, i) => {
      const r = etat.resultats[i];
      pastilles.appendChild(element('span', 'pastille-q' + (r === true ? ' juste' : (r === false ? ' faux' : (i === etat.i ? ' courante' : '')))));
    });
    bloc.appendChild(pastilles);
    const infos = element('div', 'seance-infos');
    infos.appendChild(element('span', 'discret', (q.type === 'carte' ? 'Carte ' : 'Question ') + (etat.i + 1) + ' sur ' + etat.questions.length));
    const serie = element('span', 'serie', etat.serie + ' d’affilée');
    serie.hidden = etat.serie < 2;
    infos.appendChild(serie);
    infos.appendChild(element('span', 'espace'));
    infos.appendChild(bouton('lien-discret', 'Arrêter', () => finSeance(false)));
    bloc.appendChild(infos);
    zone.appendChild(bloc);
    tete = { pastilles, serie };
  }

  async function noter(q, juste) {
    etat.resultats[etat.i] = juste;
    if (juste) {
      etat.ok += 1;
      etat.serie += 1;
      etat.meilleureSerie = Math.max(etat.meilleureSerie, etat.serie);
    } else {
      etat.ratees.push(q.cible.id);
      etat.serie = 0;
    }
    if (tete) {
      const p = tete.pastilles.children[etat.i];
      if (p) p.className = 'pastille-q ' + (juste ? 'juste' : 'faux');
      tete.serie.textContent = etat.serie + ' d’affilée';
      tete.serie.hidden = etat.serie < 2;
      if (etat.serie >= 2) { tete.serie.classList.remove('pop'); void tete.serie.offsetWidth; tete.serie.classList.add('pop'); }
    }
    try {
      await Store.modifierSuivi(q.cible.id, (s) => {
        if (juste) { s.ok = (s.ok || 0) + 1; s.serie = (s.serie || 0) + 1; if (s.aRevoir && s.serie >= 2) s.aRevoir = false; } else { s.ko = (s.ko || 0) + 1; s.serie = 0; s.aRevoir = true; }
      });
    } catch (e) { /* le suivi est un plus : la séance continue sans */ }
  }

  function dessinerQuestion() {
    const q = etat.questions[etat.i];
    etat.repondu = false;
    etat.touches = null;
    zone.textContent = '';
    dessinerEntete();

    if (q.type === 'carte') {
      etat.touches = Cartes.dessiner(zone, q, async (savait) => {
        etat.repondu = true;
        await noter(q, savait);
        suivante();
      });
      racine.scrollTo(0, 0);
      return;
    }

    zone.appendChild(element('p', 'consigne', CONSIGNES[q.sens]));
    if (q.sens !== 'chrono') {
      const enonce = element('div', 'enonce');
      enonce.appendChild(element('p', q.sens === 'nom-def' ? 'enonce-nom' : 'enonce-definition', q.enonce));
      zone.appendChild(enonce);
    }

    const liste = element('div', 'choix-liste');
    const verdict = element('div', 'verdict');
    verdict.setAttribute('role', 'status');
    verdict.hidden = true;
    q.propositions.forEach((p, i) => {
      const b = element('button', 'choix' + (q.sens !== 'nom-def' ? ' choix-nom' : ''));
      b.type = 'button';
      const touche = element('span', 'touche', String(i + 1));
      touche.setAttribute('aria-hidden', 'true');
      b.appendChild(touche);
      b.appendChild(element('span', 'choix-texte', p.texte));
      b.addEventListener('click', () => repondre(q, p, liste, verdict));
      liste.appendChild(b);
    });
    zone.appendChild(liste);
    zone.appendChild(verdict);
    etat.touches = (e) => {
      if (etat.repondu) {
        if ((e.key === 'Enter' || e.key === 'ArrowRight') && e.target.tagName !== 'BUTTON' && !verdict.hidden) { suivante(); return true; }
        return false;
      }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i === -1 || !liste.children[i]) return false;
      liste.children[i].click();
      return true;
    };
    racine.scrollTo(0, 0);
  }

  async function repondre(q, choisie, liste, verdict) {
    if (etat.repondu) return;
    etat.repondu = true;
    const juste = choisie.article.id === q.cible.id;
    const boutons = Array.from(liste.children);
    q.propositions.forEach((p, i) => {
      boutons[i].disabled = true;
      if (p.article.id === q.cible.id) boutons[i].classList.add('bonne');
      else if (p === choisie) boutons[i].classList.add('mauvaise');
      // la chronologie : on montre l'année de chacun
      if (q.sens === 'chrono') boutons[i].querySelector('.choix-texte').appendChild(element('span', 'choix-annee', ' · ' + (p.article.da || Dictionnaire.annee(p.article.an))));
    });
    await noter(q, juste);

    verdict.hidden = false;
    verdict.className = 'verdict ' + (juste ? 'juste' : 'faux');
    verdict.appendChild(element('p', 'verdict-texte', juste ? 'Juste !' : 'Ce n’est pas cela.'));
    const carte = element('div', 'verdict-fiche');
    if (!juste) carte.appendChild(element('p', 'discret', 'La bonne réponse :'));
    carte.appendChild(element('p', 'verdict-nom', q.cible.n));
    carte.appendChild(element('p', 'verdict-def', q.cible.defNue));
    verdict.appendChild(carte);
    const ligne = element('div', 'ligne-boutons');
    const dernier = etat.i === etat.questions.length - 1;
    const suite = bouton('bouton-principal', dernier ? 'Voir le bilan' : 'Question suivante', suivante);
    ligne.appendChild(suite);
    ligne.appendChild(bouton('bouton-discret', 'Lire l’article', () => Fiche.ouvrir(q.cible.id)));
    verdict.appendChild(ligne);
    verdict.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    suite.focus({ preventScroll: true });
  }

  function finSeance(complete) {
    etat.ecran = 'bilan';
    etat.jeton += 1;
    etat.touches = null;
    tete = null;
    document.dispatchEvent(new CustomEvent('suivi-change'));
    zone.textContent = '';
    const repondues = complete ? etat.questions.length : etat.resultats.filter((r) => r !== undefined).length;
    if (!repondues) { dessinerAccueil(); return; }
    const bloc = element('div', 'bilan');
    bloc.appendChild(element('h2', null, 'Bilan'));
    const part = etat.ok / repondues;
    const cle = part === 1 ? 'parfait' : (part >= 0.7 ? 'bien' : (part >= 0.4 ? 'moyen' : 'faible'));
    bloc.appendChild(anneau(part, cle));
    bloc.appendChild(element('p', 'bilan-score', etat.ok + ' sur ' + repondues));
    const mots = {
      parfait: 'Sans faute. Les arcanes n’ont plus de secret pour vous.',
      bien: 'Très bien. Encore un effort sur les articles manqués.',
      moyen: 'C’est un début : relisez les articles manqués, ils reviendront.',
      faible: 'Les débuts sont toujours obscurs. Relisez, puis recommencez.',
    };
    bloc.appendChild(element('p', 'discret', mots[cle]));
    if (etat.meilleureSerie >= 3) bloc.appendChild(element('p', 'serie-bilan', 'Meilleure série : ' + etat.meilleureSerie + ' d’affilée'));
    zone.appendChild(bloc);

    const uniques = Array.from(new Set(etat.ratees));
    if (uniques.length) {
      zone.appendChild(element('h3', 'rubrique', 'À relire'));
      const rang = element('div', 'voisins');
      for (const id of uniques) {
        const a = Dictionnaire.parId(id);
        if (a) rang.appendChild(bouton('voisin cat-' + a.c, a.n, () => Fiche.ouvrir(id)));
      }
      zone.appendChild(rang);
    }
    zone.appendChild(bouton('bouton-principal espace-haut', 'Rejouer', async () => {
      const questions = await construire(etat.derniere || reglagesDeSeance());
      if (questions.length) commencer(questions); else dessinerAccueil();
    }));
    zone.appendChild(bouton('bouton-discret large', 'Retour aux réglages de séance', dessinerAccueil));
    racine.scrollTo(0, 0);
  }

  function anneau(part, cle) {
    const boite = element('div', 'anneau');
    const dessin = svg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false' });
    dessin.appendChild(svg('circle', { class: 'anneau-fond', cx: 60, cy: 60, r: 52 }));
    const arc = svg('circle', {
      class: 'anneau-arc ' + cle, cx: 60, cy: 60, r: 52, pathLength: 100,
      'stroke-dasharray': '100 100', 'stroke-dashoffset': '100', transform: 'rotate(-90 60 60)',
    });
    dessin.appendChild(arc);
    boite.appendChild(dessin);
    boite.appendChild(element('span', 'anneau-texte', Math.round(part * 100) + ' %'));
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = String(100 - Math.round(part * 100)); }));
    return boite;
  }

  function surTouche(e) {
    if (App.vue !== 'quiz' || etat.ecran !== 'seance' || Fiche.ouverte || Editeur.ouvert) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || Outils.saisieEnCours(e)) return;
    if (etat.touches && etat.touches(e)) e.preventDefault();
  }

  function brancher() {
    zone = document.getElementById('quiz-contenu');
    document.addEventListener('keydown', surTouche);
    document.addEventListener('suivi-change', () => { if (etat.ecran === 'accueil' && App.vue === 'quiz') dessinerAccueil(); });
  }

  function montrer() {
    if (etat.ecran === 'accueil') dessinerAccueil();
  }

  racine.Quiz = { brancher, montrer, construire, courte };

})(window);
