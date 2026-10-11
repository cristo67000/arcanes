'use strict';
/* Dessine toutes les figures (ou celle de « ?f= ») sur une planche. */
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('theme') === 'sombre') document.documentElement.setAttribute('data-theme', 'sombre');
  const seule = params.get('f');
  const planche = document.getElementById('planche');
  for (const nom of Object.keys(window.Figures)) {
    if (seule && nom !== seule) continue;
    const fig = document.createElement('figure');
    fig.className = 'figure';
    const titre = document.createElement('p');
    titre.className = 'galerie-nom';
    titre.textContent = nom;
    fig.appendChild(titre);
    fig.appendChild(Figure.dessiner(nom));
    planche.appendChild(fig);
  }
  const signes = document.createElement('figure');
  signes.className = 'figure galerie-signes';
  for (const g of Object.keys(window.Glyphes)) signes.appendChild(Glyphes.svg(g, 'glyphe-galerie'));
  planche.appendChild(signes);
})();
