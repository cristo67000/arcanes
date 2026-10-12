# Arcanes — dictionnaire encyclopédique de l'ésotérisme

Une application web progressive (PWA), hors ligne, qui rassemble plus de **six
cents articles** sur l'ésotérisme occidental et ses voisins : courants
(hermétisme, gnose, néoplatonisme, théosophie, occultisme…), **figures** de
l'Antiquité à nos jours, **textes** (Corpus Hermeticum, Zohar, manifestes
rose-croix…), **notions**, **alchimie**, **kabbale et nombres**, **astrologie**,
**tarot et divination** (les vingt-deux arcanes majeurs ont chacun leur
article), **magie**, **ordres et sociétés**, **franc-maçonnerie** (la loge, ses
officiers et ses usages, les grades, les rites, les obédiences, les figures et
les textes), **symboles**.

- plus de **deux cents illustrations** du domaine public : les cartes des
  tarots de Nicolas Conver (1760) et de Pamela Colman Smith (1909), des
  portraits, des gravures alchimiques et maçonniques, des pages de titre ;
  touchées, elles s'agrandissent et donnent leur source ;

- des renvois partout : chaque article mène aux autres, et dit qui le cite ;
- **36 figures** dessinées (arbre des séphiroth, zodiaque, sept planètes, Grand
  Œuvre, carré de Saturne, arcanes, géomancie, trigrammes, ennéagramme, plan
  d'une loge, rites maçonniques…), dont les éléments sont cliquables ;
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

Les illustrations viennent de Wikimedia Commons et sont toutes dans le domaine
public ou sous CC0 : `build/illustrer.py` refuse toute autre licence. Leur
provenance, leur légende et leur crédit sont dans `build/illustrations.txt`.

## Structure

```
index.html  manifest.webmanifest  sw.js  confidentialite.html
css/        theme.css (couleurs, polices) · figure.css · app.css · page.css
js/         un module par écran ou par rôle — voir l'en-tête de chacun
js/glyphes.js   les signes (planètes, zodiaque, éléments) dessinés au trait
js/figure.js    le moteur des figures ; js/figures/*.js, les 36 figures
js/illustrations.js  les images, la visionneuse, leur cache hors ligne
data/       dictionnaire.json, manifeste.json — produits par build/construire.mjs
img/        les illustrations en WebP — produites par build/illustrer.py
icons/      icônes, image d'aperçu (build/generer-icones.py)
build/      les sources des articles (articles/*.txt) et les outils
```

Zéro build à l'exécution : des fichiers statiques, servis tels quels. Le seul
« build » est celui des données : `node build/construire.mjs` compile les
fichiers texte de `build/articles/` en `data/dictionnaire.json` et échoue au
moindre défaut (renvoi cassé, définition manquante, figure introuvable, italique
mal fermée). Il écrit un rapport dans `build/rapport.txt`.

Les images ont leur propre étape : `python build/illustrer.py` lit
`build/illustrations.txt`, télécharge chaque fichier depuis Commons (les
originaux restent dans `build/.sources-images/`, hors du dépôt), vérifie la
licence, recadre, réduit, convertit en WebP et écrit `build/illustrations.json`,
que `construire.mjs` rattache aux articles. Le service worker ne les met pas
dans la coquille de chaque version : la page les range en arrière-plan dans un
cache à part, `arcanes-images`, qu'aucune mise à jour ne vide.

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
node build/essais_statiques.mjs    # fichiers, version, classes, données, images (1 400)
node build/essais.mjs              # Chrome réel : recherche, fiches, figures, images, révision, hors-ligne (93)
node build/capture_galerie.mjs <dossier>   # toutes les figures en images, vélin et nuit
node build/essais_en_ligne.mjs     # le site publié : fichiers identiques au dépôt, hors-ligne réel (14)
```

En ligne : https://cristo67000.github.io/arcanes/ (GitHub Pages, branche `main`).

`build/galerie.html` montre toutes les figures sur une planche (`?theme=sombre`,
`?f=nom`). Pour développer sans que le service worker serve les anciens
fichiers : `index.html?sans-sw`.

Toute retouche de l'application : incrémenter `VERSION` dans `sw.js` **et**
`application-version` dans `index.html` (une épreuve statique le vérifie).
