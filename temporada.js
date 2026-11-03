/* TEMPORADA HALLOWEEN de LitleJacob Store ("Noche de Diretide").
   Se prende sola del 1 de octubre al 10 de noviembre y luego vuelve el diseño normal
   (sus archivos no se tocan: Halloween solo agrega tema-halloween.css y tema-halloween.js).
   Forzar en este navegador:  ?temporada=halloween  ·  ?temporada=normal  ·  ?temporada=auto (volver a la fecha)
   Todo se agrega al terminar de cargar la página para que "Publicar" (Sets Caché) no lo copie al index.html. */
(function () {
  "use strict";
  var HW_DESDE = 1001, HW_HASTA = 1110, hoy = new Date(), md = (hoy.getMonth() + 1) * 100 + hoy.getDate();
  var hw = md >= HW_DESDE && md <= HW_HASTA;
  try {
    var tq = (location.search.match(/[?&]temporada=([a-z]+)/) || [])[1];
    if (tq === "halloween" || tq === "normal") localStorage.setItem("lj_temporada", tq); else if (tq === "auto") localStorage.removeItem("lj_temporada");
    var tf = localStorage.getItem("lj_temporada"); if (tf) hw = tf === "halloween";
  } catch (e) { /* sin almacenamiento: manda la fecha */ }
  if (!hw) return;
  window.HW_CONFIG = {
    tienda: "LitleJacob Store",
    portadas: ".home-hero, .hero, .sets-hero",                       // escenas de noche (luna de sangre, cementerio, niebla)
    sombrero: "", calabazas: false, iconoCinta: false,               // sin dibujos genéricos: la temática la ponen los héroes
    figuras: { ".home-hero": ["treant", "necro", "nightstalker"], ".hero": ["treant", "nightstalker", "necro"], ".sets-hero": ["wk", "pudge"], ".hw-banda": ["treant", "wk"] },
    colgante: "img/hw-brood.webp",                                   // Broodmother baja por el hilo
    franjaDespues: "#inicio.hero",                                   // en Rifas: franja con nombres de héroes
    vitrina: "#catalogData", vitrinaDespues: ".home-hero",             // en Inicio: vitrina "Especial Diretide" con el Tesoro del Terror del catálogo
    marcos: ".dota-card, .itx-card, .cofre-tile, .sell-card, .info-card, .howto-step, #setsPromo .promo-card, .lj-card3, .section-card, .buy-option, .pf-card, .lj-trust-i, .card.frame, .step, .itx-pg-foto",
    terror: ".sets-hero-title, [id^=view-] header.text-center h1, .home-block-title, .m-sec-title h2, .sell-title, .section-name",
    bandas: "#ljPerfilPagina .pf-top",
    profundo: true, nieblaFija: true, brasas: false, fatuo: [350, 80, 62], hoja: [0, 18]
  };
  function prender() {
    document.documentElement.classList.add("hw");
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "tema-halloween.css?v=2"; document.head.appendChild(l);
    var s = document.createElement("script"); s.src = "tema-halloween.js?v=2"; document.body.appendChild(s);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prender); else prender();
})();
