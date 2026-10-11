/*
 * Un petit serveur de fichiers pour les épreuves : il sert le dossier du projet
 * et peut être arrêté à la demande — c'est ce qui permet d'éprouver le hors
 * ligne pour de vrai (un service worker qui ne répond que parce que le réseau
 * marche ne prouve rien).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

export function demarrerServeur(port) {
  const requetes = [];
  const serveur = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requetes.push(url.pathname);
    let chemin = decodeURIComponent(url.pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = path.join(RACINE, chemin);
    if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      res.writeHead(404); res.end('introuvable'); return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(fichier).pipe(res);
  });
  return new Promise((resoudre, rejeter) => {
    serveur.once('error', rejeter);
    serveur.listen(port, '127.0.0.1', () => resoudre({
      port, requetes,
      arreter: () => new Promise((r) => { serveur.closeAllConnections(); serveur.close(() => r()); }),
    }));
  });
}
