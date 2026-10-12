"""
Prépare les illustrations de l'application.

    python build/illustrer.py            télécharge ce qui manque, convertit, écrit l'index
    python build/illustrer.py --verifier ne télécharge rien : vérifie que tout est là

Lit build/illustrations.txt (le format est décrit en tête de ce fichier), va
chercher chaque image sur Wikimedia Commons, vérifie qu'elle est dans le
domaine public (ou sous CC0), la recadre s'il le faut, la réduit et l'écrit en
WebP dans img/. Écrit enfin build/illustrations.json, que lit
build/construire.mjs pour rattacher chaque image à ses articles.

Les originaux sont gardés dans build/.sources-images/ (hors du dépôt) : une
seconde passe ne télécharge plus rien et ne réencode que ce qui a changé.

Le script échoue à la moindre incohérence : licence qui n'est pas libre de tout
droit, fichier introuvable, identifiant en double, champ inconnu.
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SOURCE = os.path.join(ICI, 'illustrations.txt')
SORTIE = os.path.join(ICI, 'illustrations.json')
ORIGINAUX = os.path.join(ICI, '.sources-images')
DOSSIER_IMG = os.path.join(RACINE, 'img')

AGENT = {'User-Agent': 'ArcanesIllustrations/1.0 (https://cristo67000.github.io/arcanes/; cristo67apps@gmail.com)'}
API = 'https://commons.wikimedia.org/w/api.php'
LARGEUR_DEFAUT = 400
QUALITE = 74
# Au-delà, on demande à Commons une vignette de cette largeur plutôt que
# l'original (souvent plusieurs mégaoctets) : c'est assez pour réduire ensuite.
LARGEUR_SOURCE = 1280

CHAMPS = {'commons', 'legende', 'credit', 'pour', 'largeur', 'recadrer', 'qualite'}
CHAMPS_PLANCHE = {'titre', 'images'}

sys.stdout.reconfigure(encoding='utf-8')
erreurs = []


def erreur(lieu, message):
    erreurs.append(lieu + ' — ' + message)


# ── Lecture de build/illustrations.txt ───────────────────────────────────────

def lire():
    images, planches = [], []
    defauts = {}
    courant = None
    for n, ligne in enumerate(io.open(SOURCE, encoding='utf-8').read().splitlines(), 1):
        lieu = 'illustrations.txt:' + str(n)
        if not ligne.strip() or ligne.startswith('#'):
            continue
        if ligne.startswith('% '):
            defauts = {}
            courant = ('defauts', defauts)
            continue
        if ligne.startswith('= '):
            ident = ligne[2:].strip()
            if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', ident):
                erreur(lieu, 'identifiant invalide « ' + ident + ' »')
            image = dict(defauts)
            image.update({'id': ident, 'lieu': lieu})
            images.append(image)
            courant = ('image', image)
            continue
        if ligne.startswith('+ '):
            planche = {'article': ligne[2:].strip(), 'lieu': lieu}
            planches.append(planche)
            courant = ('planche', planche)
            continue
        m = re.match(r'^([a-z]+):\s?(.*)$', ligne)
        if not m or not courant:
            erreur(lieu, 'ligne incomprise : « ' + ligne[:60] + ' »')
            continue
        cle, valeur = m.group(1), m.group(2).strip()
        genre, cible = courant
        permis = CHAMPS_PLANCHE if genre == 'planche' else CHAMPS
        if cle not in permis:
            erreur(lieu, 'champ inconnu « ' + cle + ' »')
            continue
        cible[cle] = valeur
    return images, planches


# ── Wikimedia Commons ────────────────────────────────────────────────────────

def obtenir(url, essais=5):
    for essai in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=90) as r:
                return r.read()
        except Exception as e:  # réseau capricieux, limite de débit : on réessaie
            if essai == essais - 1:
                raise
            time.sleep(3 + 5 * essai)


def nettoyer(html):
    texte = re.sub(r'<[^>]+>', ' ', str(html or ''))
    texte = texte.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', texte).strip()


def informations(titre):
    """Une requête par fichier, avec redirects=1 : par lot, l'API rend les
    titres normalisés dans un ordre qui ne permet pas de les rapprocher."""
    p = {'action': 'query', 'titles': 'File:' + titre, 'prop': 'imageinfo', 'redirects': '1',
         'iiprop': 'url|size|extmetadata|sha1', 'iiurlwidth': str(LARGEUR_SOURCE), 'format': 'json'}
    r = json.loads(obtenir(API + '?' + urllib.parse.urlencode(p)))
    page = list(r['query']['pages'].values())[0]
    if 'imageinfo' not in page:
        return None
    ii = page['imageinfo'][0]
    em = ii.get('extmetadata', {})
    return {
        'titre': page['title'][len('File:'):],
        'url': ii['url'], 'vignette': ii.get('thumburl'), 'w': ii['width'], 'h': ii['height'], 'sha1': ii.get('sha1'),
        'page': ii.get('descriptionurl'),
        'licence': nettoyer(em.get('LicenseShortName', {}).get('value')),
        'licence_code': nettoyer(em.get('License', {}).get('value')).lower(),
        'droits': nettoyer(em.get('Copyrighted', {}).get('value')),
        'auteur': nettoyer(em.get('Artist', {}).get('value'))[:200],
        'date': nettoyer(em.get('DateTimeOriginal', {}).get('value'))[:120],
    }


def libre(info):
    """Domaine public ou CC0, rien d'autre : pas de CC BY ni de BY-SA, dont les
    obligations ne suivraient pas une image recadrée dans une application."""
    lic = info['licence'].lower()
    code = info['licence_code']
    if code in ('cc0', 'pd') or code.startswith('pd-'):
        return True
    return lic.startswith('public domain') or lic.startswith('pd') or lic == 'cc0' or 'domaine public' in lic


def original(info):
    os.makedirs(ORIGINAUX, exist_ok=True)
    cle = info['sha1'] or hashlib.sha1(info['titre'].encode('utf-8')).hexdigest()
    chemin = os.path.join(ORIGINAUX, cle + '.bin')
    if os.path.exists(chemin):
        return chemin, False
    url = info['vignette'] if info['w'] > LARGEUR_SOURCE and info.get('vignette') else info['url']
    donnees = obtenir(url)
    with open(chemin, 'wb') as f:
        f.write(donnees)
    return chemin, True


# ── Conversion ───────────────────────────────────────────────────────────────

def convertir(chemin, image, sortie):
    with Image.open(chemin) as im:
        im.load()
        if im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info:
            fond = Image.new('RGB', im.size, (255, 255, 255))
            im = im.convert('RGBA')
            fond.paste(im, mask=im.split()[3])
            im = fond
        else:
            im = im.convert('RGB')
        if image.get('recadrer'):
            g, h, d, b = [float(x) for x in image['recadrer'].split()]
            W, H = im.size
            im = im.crop((round(g * W), round(h * H), round(d * W), round(b * H)))
        largeur = int(image.get('largeur') or LARGEUR_DEFAUT)
        if im.width > largeur:
            im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
        im.save(sortie, 'WEBP', quality=int(image.get('qualite') or QUALITE), method=6)
        return im.width, im.height


def main():
    verifier = '--verifier' in sys.argv
    images, planches = lire()
    precedent = {}
    if os.path.exists(SORTIE):
        precedent = json.load(io.open(SORTIE, encoding='utf-8')).get('images', {})

    vus = set()
    for image in images:
        if image['id'] in vus:
            erreur(image['lieu'], 'identifiant « ' + image['id'] + ' » déjà pris')
        vus.add(image['id'])
        for champ in ('commons', 'legende', 'credit'):
            if not image.get(champ):
                erreur(image['lieu'], 'pas de « ' + champ + ': » pour « ' + image['id'] + ' »')
        if image.get('recadrer') and not re.fullmatch(r'[\d.]+ [\d.]+ [\d.]+ [\d.]+', image['recadrer']):
            erreur(image['lieu'], 'recadrage illisible « ' + image['recadrer'] + ' »')
    for planche in planches:
        for ident in [x.strip() for x in planche.get('images', '').split(',') if x.strip()]:
            if ident not in vus:
                erreur(planche['lieu'], 'planche : image inconnue « ' + ident + ' »')
        if not planche.get('titre'):
            erreur(planche['lieu'], 'planche sans « titre: »')
    if erreurs:
        fin()

    os.makedirs(DOSSIER_IMG, exist_ok=True)
    resultat = {}
    telecharges = convertis = 0
    for i, image in enumerate(images):
        sortie = os.path.join(DOSSIER_IMG, image['id'] + '.webp')
        signature = '|'.join([image['commons'], image.get('recadrer', ''), str(image.get('largeur') or LARGEUR_DEFAUT),
                              str(image.get('qualite') or QUALITE)])
        ancien = precedent.get(image['id'])
        if ancien and ancien.get('sig') == signature and os.path.exists(sortie):
            info = {'page': ancien['src'], 'licence': ancien['lic']}
            w, h = ancien['w'], ancien['h']
        else:
            if verifier:
                erreur(image['lieu'], 'image à (re)faire : ' + image['id'])
                continue
            info = informations(image['commons'])
            if not info:
                erreur(image['lieu'], 'fichier introuvable sur Commons : ' + image['commons'])
                continue
            if not libre(info):
                erreur(image['lieu'], 'licence refusée (' + info['licence'] + ') : ' + image['commons'])
                continue
            chemin, neuf = original(info)
            telecharges += neuf
            w, h = convertir(chemin, image, sortie)
            convertis += 1
            print('  ✓', image['id'], w, '×', h, round(os.path.getsize(sortie) / 1024), 'Ko', '(' + info['licence'] + ')')
        with open(sortie, 'rb') as f:
            empreinte = hashlib.sha1(f.read()).hexdigest()[:10]
        resultat[image['id']] = {
            'f': 'img/' + image['id'] + '.webp', 'v': empreinte, 'w': w, 'h': h,
            'l': image['legende'], 'cr': image['credit'], 'lic': info['licence'], 'src': info['page'],
            'pour': [x.strip() for x in image.get('pour', '').split(',') if x.strip()],
            'sig': signature,
        }

    # Les fichiers d'img/ que plus rien ne réclame
    orphelins = [f for f in os.listdir(DOSSIER_IMG) if f.endswith('.webp') and f[:-5] not in resultat]
    for f in orphelins:
        if verifier:
            erreur('img/', 'fichier orphelin : ' + f)
        else:
            os.remove(os.path.join(DOSSIER_IMG, f))
    if erreurs:
        fin()

    plan = {}
    for planche in planches:
        plan.setdefault(planche['article'], []).append({
            'titre': planche['titre'],
            'images': [x.strip() for x in planche['images'].split(',') if x.strip()],
        })
    json.dump({'images': resultat, 'planches': plan}, io.open(SORTIE, 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=1)
    poids = sum(os.path.getsize(os.path.join(DOSSIER_IMG, f)) for f in os.listdir(DOSSIER_IMG) if f.endswith('.webp'))
    print(len(resultat), 'images,', round(poids / 1024), 'Ko en tout ;', convertis, 'converties,', telecharges,
          'téléchargées,', len(orphelins), 'orphelines retirées')


def fin():
    print('\n' + str(len(erreurs)) + ' ERREUR(S) :')
    for e in erreurs:
        print('  ✗ ' + e)
    sys.exit(1)


if __name__ == '__main__':
    main()
