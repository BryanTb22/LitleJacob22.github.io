/* VITRINA DE SETS CACHÉ en el Inicio: debajo de la portada muestra el cofre más nuevo del catálogo
   con sus sets disponibles (foto, nombre y precio) y lleva a Sets Caché. Lee el catálogo publicado (#catalogData),
   así se actualiza solo con cada "Publicar". Se agrega al terminar de cargar para que "Publicar" no la copie al index.html.
   En temporada de Halloween la reemplaza la vitrina "Especial Diretide" de tema-halloween.js (esta se oculta con html.hw). */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function soles(n) { n = +n || 0; return "S/ " + (n % 1 ? n.toFixed(2) : n); }
  function armar() {
    var hero = document.querySelector(".home-hero"), datos = document.getElementById("catalogData");
    if (!hero || !datos || document.querySelector(".lj-vitrina")) return;
    var d; try { d = JSON.parse(datos.textContent || "{}"); } catch (e) { return; }
    var cofres = Array.isArray(d.cofres) ? d.cofres : [], sets = Array.isArray(d.sets) ? d.sets : [];
    // el cofre más nuevo es el último de la lista que todavía tenga sets disponibles
    var cof = null, lista = [];
    for (var i = cofres.length - 1; i >= 0 && !cof; i--) {
      var disp = sets.filter(function (x) { return x.cofre === cofres[i].id && !x.soldOut && x.img; });
      if (disp.length) { cof = cofres[i]; lista = disp; }
    }
    if (!cof) return;
    var total = sets.filter(function (x) { return x.cofre === cof.id; }).length;
    var tarjetas = lista.slice(0, 14).map(function (x) {
      return '<a class="lj-vit-set" href="#sets-cache"><img src="' + esc(x.img) + '" alt="" loading="lazy" decoding="async"><b>' + esc(x.name) + '</b><i>' + soles(x.price) + '</i></a>';
    }).join("");
    var v = document.createElement("section");
    v.className = "lj-vitrina"; v.setAttribute("aria-label", "Novedades en Sets Caché: " + cof.name);
    v.innerHTML = '<a class="lj-vit-cofre" href="#sets-cache"><img src="' + esc(cof.img) + '" alt="" loading="lazy" decoding="async"><span><small>Novedades en Sets Caché</small><b>' + esc(cof.name) + '</b><em>' + total + (total === 1 ? ' set' : ' sets') + ' · ver el catálogo →</em></span></a>' +
      '<div class="lj-vit-pista" aria-hidden="true"><div class="lj-vit-in">' + tarjetas + (lista.length > 4 ? tarjetas : "") + '</div></div>';
    hero.parentNode.insertBefore(v, hero.nextSibling);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", armar); else armar();
})();
