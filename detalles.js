/* Detalles generales LitleJacob */
(function () {
  "use strict";
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function cab() {
    var t = document.querySelector("html.lj-rifas .topbar") || document.querySelector(".site-nav");
    if (!t) return;
    t.classList.toggle("ljc", (window.scrollY || 0) > 40);
  }
  window.addEventListener("scroll", cab, { passive: true });
  /* aparición al hacer scroll */
  var io = null;
  if (!rm && "IntersectionObserver" in window) io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: .08 });
  function revelar() {
    if (!io) return;
    document.querySelectorAll(".home-hero ~ section, #view-home section, .lj-trust, .sec-title, .rcard, .raffle-card, .sets-hero ~ section").forEach(function (el) {
      if (el.classList.contains("lj-rev") || el.closest(".modal,[role=dialog]")) return;
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight) return; /* ya visible: no se oculta */
      el.classList.add("lj-rev"); io.observe(el);
    });
  }
  /* pie: el mismo de Rayas Store (logo + WhatsApp, enlaces de secciones y aviso de Valve), en todas las vistas de la tienda */
  function pie() {
    if (document.getElementById("ljPie")) return;
    if (document.documentElement.classList.contains("lj-rifas")) return;   // Rifas pinta su propio pie (rifas.js), con el mismo diseño
    var vistas = document.querySelectorAll(".view"); if (!vistas.length) return;
    var ult = vistas[vistas.length - 1];
    var d = document.createElement("footer"); d.id = "ljPie"; d.className = "lj-pie2";
    d.innerHTML = '<div class="lj-pie2-top"><a class="lj-pie2-logo" href="index.html#inicio"><img src="favicon.png" alt="" width="36" height="36" loading="lazy"><span>Litlejacob <i>Store</i></span></a>' +
      '<span class="lj-pie2-wa">WhatsApp: LitleJacob <b>+51 952 997 030</b> · Rayas <b>+51 900 049 694</b></span></div>' +
      '<nav class="lj-pie2-nav" aria-label="Enlaces rápidos"><a href="index.html#inicio">Inicio</a><a href="index.html#sets-cache">Sets Caché</a><a href="index.html#compro">Compro</a>' +
      '<a href="index.html#items" data-itx-nav="" data-itx-label="Comprar items" hidden>Comprar items</a><a href="index.html#vender" data-itx-nav="" data-itx-label="Vender items" hidden>Vender items</a>' +
      '<a href="rifas.html" class="nav-link-rifas">Rifas</a></nav>' +
      '<small>No afiliado a Valve. Dota 2 es una marca de Valve Corporation.</small>';
    ult.insertAdjacentElement("afterend", d);
    try { window.dispatchEvent(new Event("lj-cfg")); } catch (e) { /* nada */ }   // items.js muestra u oculta Comprar/Vender según la configuración
  }
  /* aviso corto reutilizable */
  var tt;
  window.ljAviso = function (msg, ok) {
    var el = document.getElementById("ljToast");
    if (!el) { el = document.createElement("div"); el.id = "ljToast"; el.className = "lj-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    el.textContent = msg; el.className = "lj-toast on" + (ok ? " ok" : "");
    clearTimeout(tt); tt = setTimeout(function () { el.classList.remove("on"); }, 2800);
  };
  function run() { cab(); pie(); revelar(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  setTimeout(run, 800); setTimeout(run, 2500);
})();
