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
  /* pie */
  function pie() {
    var host = document.getElementById("view-home") ? document.querySelector("#view-home footer") : null;
    var esRifas = document.documentElement.classList.contains("lj-rifas");
    if (document.getElementById("ljPie")) return;
    var d = document.createElement("div"); d.id = "ljPie"; d.className = "lj-pie";
    d.innerHTML = '<nav aria-label="Pie"><a href="index.html#inicio">Inicio</a><a href="index.html#sets-cache">Sets Caché</a><a href="rifas.html">Rifas</a><a href="https://wa.me/51952997030" target="_blank" rel="noopener noreferrer">WhatsApp</a></nav><small>© LitleJacob Store · Tienda de Dota 2 · Todos los precios en soles (S/)</small>';
    if (esRifas) { var a = document.getElementById("app"); if (a) a.appendChild(d); }
    else if (host) host.insertAdjacentElement("afterend", d);
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
