# -*- coding: utf-8 -*-
"""Génère les icônes et l'image d'aperçu d'Arcanes.

Dessin : un serpent d'or qui se mord la queue — l'ouroboros, le plus ancien
emblème de l'alchimie — autour d'une étoile à quatre branches, sur le bleu
nuit de l'application. Rien d'autre : à 48 pixels sur un écran de téléphone,
tout détail supplémentaire devient une tache.

Dessiné au quadruple de la taille finale puis réduit : Pillow ne lisse pas les
bords, le suréchantillonnage s'en charge.

    python build/generer-icones.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(os.path.dirname(ICI), "icons")

NUIT = (29, 22, 48)
NUIT_CLAIRE = (44, 34, 72)
OR = (225, 189, 98)
LAVANDE = (196, 166, 255)
VELIN = (246, 241, 230)
E = 4

POLICES_SERIF = [r"C:\Windows\Fonts\palab.ttf", r"C:\Windows\Fonts\georgiab.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]
POLICES_ITALIQUES = [r"C:\Windows\Fonts\palai.ttf", r"C:\Windows\Fonts\georgiai.ttf",
                     "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"]


def police(chemins, taille):
    for chemin in chemins:
        if os.path.exists(chemin):
            return ImageFont.truetype(chemin, taille)
    return ImageFont.load_default()


def point(cx, cy, r, angle):
    """Angle en degrés, 0 = en haut, sens des aiguilles d'une montre."""
    a = math.radians(angle)
    return (cx + r * math.sin(a), cy - r * math.cos(a))


def ouroboros(dessin, cx, cy, r, epaisseur):
    # Le corps : un anneau ouvert entre la queue et la tête
    boite = [cx - r, cy - r, cx + r, cy + r]
    # PIL compte les angles depuis 3 h, dans le sens des aiguilles
    dessin.arc(boite, start=-90 + 47, end=-90 + 340, fill=OR, width=int(epaisseur))
    # La queue, qui s'amincit jusque dans la gueule
    for k in range(24):
        a = 340 + k * 2.1
        ep = epaisseur * (1 - k / 32)
        x, y = point(cx, cy, r - epaisseur / 2, a)
        dessin.ellipse([x - ep / 2, y - ep / 2, x + ep / 2, y + ep / 2], fill=OR)
    # La tête, un peu plus large que le corps, qui avale le bout de la queue
    hx, hy = point(cx, cy, r - epaisseur / 2, 38)
    rt = epaisseur * 0.95
    dessin.ellipse([hx - rt, hy - rt, hx + rt, hy + rt], fill=OR)
    ox, oy = point(cx, cy, r - epaisseur * 0.8, 42)
    ro = epaisseur * 0.16
    dessin.ellipse([ox - ro, oy - ro, ox + ro, oy + ro], fill=NUIT)


def etoile(dessin, cx, cy, grand, petit, couleur):
    pts = []
    for k in range(8):
        r = grand if k % 2 == 0 else petit
        pts.append(point(cx, cy, r, k * 45))
    dessin.polygon(pts, fill=couleur)


def icone(cote, masquable=False):
    grand = cote * E
    image = Image.new("RGB", (grand, grand), NUIT)
    dessin = ImageDraw.Draw(image)
    # Un léger halo au centre, pour la profondeur
    for k in range(10, 0, -1):
        r = grand * 0.06 * k
        c = tuple(int(NUIT[i] + (NUIT_CLAIRE[i] - NUIT[i]) * (1 - k / 10)) for i in range(3))
        dessin.ellipse([grand / 2 - r, grand / 2 - r, grand / 2 + r, grand / 2 + r], fill=c)
    # Une icône « masquable » peut être rognée en cercle : tout tient dans 80 %
    echelle = 0.30 if masquable else 0.36
    r = grand * echelle
    ouroboros(dessin, grand / 2, grand / 2, r, grand * 0.055)
    etoile(dessin, grand / 2, grand / 2, r * 0.52, r * 0.13, LAVANDE)
    etoile(dessin, grand / 2, grand / 2, r * 0.26, r * 0.07, VELIN)
    return image.resize((cote, cote), Image.LANCZOS)


def apercu():
    l, h = 1200, 630
    image = Image.new("RGB", (l * 2, h * 2), NUIT)
    dessin = ImageDraw.Draw(image)
    cx, cy, r = 2 * 300, 2 * 315, 2 * 190
    for k in range(10, 0, -1):
        rr = r * 0.16 * k
        c = tuple(int(NUIT[i] + (NUIT_CLAIRE[i] - NUIT[i]) * (1 - k / 10)) for i in range(3))
        dessin.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    ouroboros(dessin, cx, cy, r, 2 * 30)
    etoile(dessin, cx, cy, r * 0.52, r * 0.13, LAVANDE)
    etoile(dessin, cx, cy, r * 0.26, r * 0.07, VELIN)
    titre = police(POLICES_SERIF, 2 * 120)
    sous = police(POLICES_ITALIQUES, 2 * 44)
    dessin.text((2 * 560, 2 * 205), "Arcanes", font=titre, fill=VELIN)
    dessin.text((2 * 565, 2 * 360), "dictionnaire encyclopédique", font=sous, fill=OR)
    dessin.text((2 * 565, 2 * 420), "de l’ésotérisme", font=sous, fill=OR)
    petite = police(POLICES_ITALIQUES, 2 * 28)
    dessin.text((2 * 565, 2 * 505), "hermétisme · alchimie · kabbale · tarot · astrologie", font=petite, fill=LAVANDE)
    return image.resize((l, h), Image.LANCZOS)


def main():
    os.makedirs(SORTIE, exist_ok=True)
    icone(192).save(os.path.join(SORTIE, "icon-192.png"))
    icone(512).save(os.path.join(SORTIE, "icon-512.png"))
    icone(512, masquable=True).save(os.path.join(SORTIE, "icon-maskable-512.png"))
    apercu().save(os.path.join(SORTIE, "apercu-1200x630.png"))
    print("icônes écrites dans", SORTIE)


if __name__ == "__main__":
    main()
