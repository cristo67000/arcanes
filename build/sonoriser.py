"""Les sons de l'application : build/sons.txt → son/*.mp3 et build/sons.json.

    python build/sonoriser.py             télécharge ce qui manque, coupe les extraits
    python build/sonoriser.py --verifier  échoue si un son est à refaire (sans réseau)

Chaque son vient de Wikimedia Commons, dans le domaine public ou sous CC0 : le
script refuse toute autre licence. Il prend la version MP3 que Commons tire de
chaque enregistrement (lisible par tous les navigateurs), et, si `extrait:`
le demande, n'en garde qu'un passage : la coupe se fait entre deux trames MP3,
sans réencoder. Les originaux restent dans build/.sources-sons/, hors du dépôt.

Le format de build/sons.txt est décrit en tête de ce fichier.
"""
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SOURCE = os.path.join(ICI, 'sons.txt')
SORTIE = os.path.join(ICI, 'sons.json')
DOSSIER = os.path.join(RACINE, 'son')
CACHE = os.path.join(ICI, '.sources-sons')
AGENT = {'User-Agent': 'ArcanesSons/1.0 (https://cristo67000.github.io/arcanes/; cristo67apps@gmail.com)'}
CHAMPS = {'commons', 'titre', 'credit', 'pour', 'extrait'}
erreurs = []


def erreur(lieu, message):
    erreurs.append(lieu + ' — ' + message)


def fin():
    print('\n%d ERREUR(S) :' % len(erreurs))
    for e in erreurs:
        print('  ✗ ' + e)
    sys.exit(1)


def lire():
    sons = []
    courant = None
    for n, ligne in enumerate(io.open(SOURCE, encoding='utf-8').read().splitlines(), 1):
        lieu = 'sons.txt:%d' % n
        if not ligne.strip() or ligne.startswith('#') or ligne.startswith('%'):
            continue
        if ligne.startswith('= '):
            ident = ligne[2:].strip()
            if not re.fullmatch(r'[a-z0-9-]+', ident):
                erreur(lieu, 'identifiant invalide « ' + ident + ' »')
            courant = {'id': ident, 'lieu': lieu}
            sons.append(courant)
            continue
        m = re.match(r'^([a-z]+):\s*(.*)$', ligne)
        if not m or courant is None:
            erreur(lieu, 'ligne illisible')
            continue
        if m.group(1) not in CHAMPS:
            erreur(lieu, 'champ inconnu « ' + m.group(1) + ' »')
            continue
        courant[m.group(1)] = m.group(2).strip()
    return sons


def obtenir(url, brut=False, essais=5):
    for i in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=120) as r:
                donnees = r.read()
                return donnees if brut else json.loads(donnees.decode('utf-8'))
        except Exception:
            time.sleep(2 + 4 * i)
    return None


def nettoyer(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', h or ''))).strip()


def informations(titre):
    p = {'action': 'query', 'format': 'json', 'formatversion': '2', 'titles': 'File:' + titre,
         'prop': 'imageinfo|videoinfo', 'iiprop': 'extmetadata|url|mime', 'viprop': 'derivatives', 'redirects': '1'}
    d = obtenir('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p))
    if not d:
        return None
    for pg in d.get('query', {}).get('pages', []):
        if pg.get('missing'):
            return None
        ii = (pg.get('imageinfo') or [{}])[0]
        md = ii.get('extmetadata', {})
        der = (pg.get('videoinfo') or [{}])[0].get('derivatives') or []
        mp3 = [x['src'] for x in der if 'mpeg' in (x.get('type') or '')]
        if not mp3 and ii.get('mime') == 'audio/mpeg':
            mp3 = [ii['url']]
        return {
            'licence': nettoyer(md.get('LicenseShortName', {}).get('value')),
            'code': nettoyer(md.get('License', {}).get('value')).lower(),
            'mp3': mp3[0] if mp3 else None,
            'page': ii.get('descriptionurl') or 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(pg['title'].replace(' ', '_'), safe=':/'),
        }
    return None


def libre(info):
    lic = info['licence'].lower()
    if info['code'] in ('cc0', 'pd') or info['code'].startswith('pd-'):
        return True
    return lic.startswith('public domain') or lic.startswith('pd') or lic == 'cc0' or 'domaine public' in lic


# ── Les trames MP3 ────────────────────────────────────────────────────────────

DEBITS = {  # kbit/s : (MPEG-1 couche III, MPEG-2/2.5 couche III)
    1: (32, 8), 2: (40, 16), 3: (48, 24), 4: (56, 32), 5: (64, 40), 6: (80, 48), 7: (96, 56),
    8: (112, 64), 9: (128, 80), 10: (160, 96), 11: (192, 112), 12: (224, 128), 13: (256, 144), 14: (320, 160),
}
FREQUENCES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def trames(donnees):
    """Les trames d'un MP3 : [(début, fin, durée)], sans les étiquettes ID3
    ni la trame d'en-tête Xing/Info (fausse après une coupe)."""
    i = 0
    if donnees[:3] == b'ID3':
        taille = 0
        for b in donnees[6:10]:
            taille = (taille << 7) | (b & 0x7f)
        i = 10 + taille
    sortie = []
    while i + 4 <= len(donnees):
        h = int.from_bytes(donnees[i:i + 4], 'big')
        if (h >> 21) & 0x7ff != 0x7ff:
            i += 1
            continue
        version = (h >> 19) & 3
        couche = (h >> 17) & 3
        debit = (h >> 12) & 15
        freq = (h >> 10) & 3
        remplissage = (h >> 9) & 1
        if version == 1 or couche != 1 or debit in (0, 15) or freq == 3:
            i += 1
            continue
        kbps = DEBITS[debit][0 if version == 3 else 1] * 1000
        f = FREQUENCES[version][freq]
        echantillons = 1152 if version == 3 else 576
        longueur = (144 if version == 3 else 72) * kbps // f + remplissage
        if longueur < 24 or i + longueur > len(donnees):
            break
        corps = donnees[i:i + longueur]
        if not sortie and (b'Xing' in corps[:64] or b'Info' in corps[:64]):
            i += longueur
            continue
        sortie.append((i, i + longueur, echantillons / f))
        i += longueur
    return sortie


def couper(donnees, debut, fin_):
    t = 0.0
    morceaux = []
    duree = 0.0
    for a, b, d in trames(donnees):
        if t >= debut and (fin_ is None or t < fin_):
            morceaux.append(donnees[a:b])
            duree += d
        t += d
    return b''.join(morceaux), duree


def main():
    verifier = '--verifier' in sys.argv
    sons = lire()
    vus = set()
    for s in sons:
        if s['id'] in vus:
            erreur(s['lieu'], 'identifiant « ' + s['id'] + ' » déjà pris')
        vus.add(s['id'])
        for champ in ('commons', 'titre', 'credit', 'pour'):
            if not s.get(champ):
                erreur(s['lieu'], 'pas de « ' + champ + ': » pour « ' + s['id'] + ' »')
        if s.get('extrait') and not re.fullmatch(r'\d+(\.\d+)? (\d+(\.\d+)?|fin)', s['extrait']):
            erreur(s['lieu'], 'extrait illisible « ' + s['extrait'] + ' » (« début fin » en secondes)')
    if erreurs:
        fin()
    precedent = {}
    if os.path.exists(SORTIE):
        precedent = json.load(io.open(SORTIE, encoding='utf-8')).get('sons', {})
    os.makedirs(DOSSIER, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    resultat = {}
    faits = 0
    for s in sons:
        sortie = os.path.join(DOSSIER, s['id'] + '.mp3')
        signature = s['commons'] + '|' + s.get('extrait', '')
        ancien = precedent.get(s['id'])
        if ancien and ancien.get('sig') == signature and os.path.exists(sortie):
            info = {'page': ancien['src'], 'licence': ancien['lic']}
            duree = ancien['d']
        else:
            if verifier:
                erreur(s['lieu'], 'son à (re)faire : ' + s['id'])
                continue
            info = informations(s['commons'])
            if not info:
                erreur(s['lieu'], 'fichier introuvable sur Commons : ' + s['commons'])
                continue
            if not libre(info):
                erreur(s['lieu'], 'licence refusée (' + info['licence'] + ') : ' + s['commons'])
                continue
            if not info['mp3']:
                erreur(s['lieu'], 'pas de version MP3 sur Commons : ' + s['commons'])
                continue
            original = os.path.join(CACHE, hashlib.sha1(info['mp3'].encode('utf-8')).hexdigest()[:16] + '.mp3')
            if not os.path.exists(original):
                donnees = obtenir(info['mp3'], brut=True)
                if not donnees:
                    erreur(s['lieu'], 'téléchargement impossible : ' + info['mp3'])
                    continue
                with open(original, 'wb') as f:
                    f.write(donnees)
                time.sleep(1)
            with open(original, 'rb') as f:
                donnees = f.read()
            debut, fin_ = 0.0, None
            if s.get('extrait'):
                a, b = s['extrait'].split()
                debut, fin_ = float(a), (None if b == 'fin' else float(b))
            coupe, duree = couper(donnees, debut, fin_)
            if not coupe:
                erreur(s['lieu'], 'aucune trame MP3 lisible dans ' + s['commons'])
                continue
            with open(sortie, 'wb') as f:
                f.write(coupe)
            faits += 1
            print('  ✓', s['id'], '%.1f s' % duree, round(len(coupe) / 1024), 'Ko', '(' + info['licence'] + ')')
        with open(sortie, 'rb') as f:
            empreinte = hashlib.sha1(f.read()).hexdigest()[:10]
        resultat[s['id']] = {
            'f': 'son/' + s['id'] + '.mp3', 'v': empreinte, 'd': round(duree, 1),
            'ti': s['titre'], 'cr': s['credit'], 'lic': info['licence'], 'src': info['page'],
            'pour': [x.strip() for x in s.get('pour', '').split(',') if x.strip()],
            'sig': signature,
        }
    orphelins = [f for f in os.listdir(DOSSIER) if f.endswith('.mp3') and f[:-4] not in resultat]
    for f in orphelins:
        if verifier:
            erreur('son/', 'fichier orphelin : ' + f)
        else:
            os.remove(os.path.join(DOSSIER, f))
    if erreurs:
        fin()
    if not verifier:
        with io.open(SORTIE, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'sons': resultat}, f, ensure_ascii=False, indent=1)
            f.write('\n')
    octets = sum(os.path.getsize(os.path.join(DOSSIER, s['id'] + '.mp3')) for s in sons if s['id'] in resultat)
    print('%d sons, %d Ko en tout ; %d préparés, %d orphelins retirés' % (len(resultat), octets // 1024, faits, len(orphelins)))


main()
