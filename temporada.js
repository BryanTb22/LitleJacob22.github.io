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
  window.HW_CONFIG = { tienda: "LitleJacob Store", portadas: ".home-hero, .hero", sombrero: ".lj-h2-in > .logo-slot.left, img.hero-logo", franjaDespues: ".home-hero, #inicio.hero", brasas: false };
  function prender() {
    document.documentElement.classList.add("hw");
    var f = document.createElement("link"); f.rel = "stylesheet"; f.href = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Creepster&display=swap"; document.head.appendChild(f);
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "tema-halloween.css?v=1"; document.head.appendChild(l);
    var s = document.createElement("script"); s.src = "tema-halloween.js?v=1"; document.body.appendChild(s);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prender); else prender();
})();
