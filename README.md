# Arcanes — dictionnaire encyclopédique de l'ésotérisme

Une application web progressive (PWA), hors ligne, qui rassemble plus de **cinq
cents articles** sur l'ésotérisme occidental et ses voisins : courants
(hermétisme, gnose, néoplatonisme, théosophie, occultisme…), **figures** de
l'Antiquité à nos jours, **textes** (Corpus Hermeticum, Zohar, manifestes
rose-croix…), **notions**, **alchimie**, **kabbale et nombres**, **astrologie**,
**tarot et divination** (les vingt-deux arcanes majeurs ont chacun leur
article), **magie**, **ordres et sociétés**, **symboles**.

- des renvois partout : chaque article mène aux autres, et dit qui le cite ;
- **34 figures** dessinées (arbre des séphiroth, zodiaque, sept planètes, Grand
  Œuvre, carré de Saturne, arcanes, géomancie, trigrammes, ennéagramme…), dont
  les éléments sont cliquables ;
- une **frise chronologique** de plus de deux cents dates ;
- une **révision** : quatre choix (définition → article, article → définition,
  « lequel est le plus ancien ? ») ou cartes à retourner ;
- un **carnet** : favoris, articles à revoir, notes, articles écrits soi-même ;
- la **lecture à voix haute** des articles, par une voix française de l'appareil
  (France avant Canada) ;
- deux thèmes, « vélin » et « nuit », trois tailles de texte, une police à
  empattements ou non ; la sauvegarde dans un fichier.

Rien n'est envoyé nulle part : pas de compte, pas de serveur, pas de mesure
d'audience, `connect-src 'self'`. Voir `confidentialite.html`.

## L'esprit du dictionnaire

Les articles décrivent l'ésotérisme comme le font les historiens (Antoine Faivre,
Wouter Hanegraaff, Frances Yates…) : ce que ses courants ont cru, écrit et
pratiqué, sans se prononcer sur la vérité de leurs doctrines. Quand une pratique
prétend à des effets vérifiables, l'article dit ce qu'en ont conclu les études.
Les textes sont **originaux** : aucune source tierce n'est recopiée, il n'y a
donc pas de question de licence. Les dates anciennes sont souvent approximatives
et le disent (« vers »).

## Structure

```
index.html  manifest.webmanifest  sw.js  confidentialite.html
css/        theme.css (couleurs, polices) · figure.css · app.css · page.css
js/         un module par écran ou par rôle — voir l'en-tête de chacun
js/glyphes.js   les signes (planètes, zodiaque, éléments) dessinés au trait
js/figure.js    le moteur des figures ; js/figures/*.js, les 34 figures
data/       dictionnaire.json, manifeste.json — produits par build/construire.mjs
icons/      icônes, image d'aperçu (build/generer-icones.py)
build/      les sources des articles (articles/*.txt) et les outils
```

Zéro build à l'exécution : des fichiers statiques, servis tels quels. Le seul
« build » est celui des données : `node build/construire.mjs` compile les
fichiers texte de `build/articles/` en `data/dictionnaire.json` et échoue au
moindre défaut (renvoi cassé, définition manquante, figure introuvable, italique
mal fermée). Il écrit un rapport dans `build/rapport.txt`.

## Écrire un article

Le format est décrit en tête de `build/construire.mjs` :

```
@ hermes-trismegiste
cat: figures
nom: Hermès Trismégiste
alias: Thot, Mercure Trismégiste
dates: figure légendaire
glyphe: mercure
def: Sage légendaire né de la fusion du dieu égyptien Thot…
texte: Dans l'Égypte hellénistique… les traités du [[corpus-hermetique|Corpus Hermeticum]]…
texte: Second paragraphe, avec de l'*italique*.
voir: hermetisme, corpus-hermetique
```

`[[id]]` renvoie à un article ; un nom commun s'y écrit en minuscule au milieu
d'une phrase (règle dans `construire.mjs`, liste des noms propres à garder).
`schema: arbre-sephiroth/keter` place une figure en mettant un élément en avant.

## Épreuves

```
node build/construire.mjs          # le dictionnaire, et build/rapport.txt
node build/essais_statiques.mjs    # fichiers, version, classes, données (342)
node build/essais.mjs              # Chrome réel : recherche, fiches, figures, révision, hors-ligne (85)
node build/capture_galerie.mjs <dossier>   # toutes les figures en images, vélin et nuit
```

`build/galerie.html` montre toutes les figures sur une planche (`?theme=sombre`,
`?f=nom`). Pour développer sans que le service worker serve les anciens
fichiers : `index.html?sans-sw`.

Toute retouche de l'application : incrémenter `VERSION` dans `sw.js` **et**
`application-version` dans `index.html` (une épreuve statique le vérifie).
