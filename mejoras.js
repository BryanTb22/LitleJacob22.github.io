/* Inicio de LitleJacob: franja de confianza + "Últimos ganadores" (datos de rifas en rayas/estado) */
(function () {
  "use strict";
  var FB = { projectId: "litlejacob-store" };
  var BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ICO = {
    steam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
    pago: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></svg>',
    azar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/></svg>'
  };
  function franja() {
    var hero = document.querySelector("#view-home .home-hero");
    if (!hero || document.getElementById("ljTrust")) return;
    var d = document.createElement("section"); d.id = "ljTrust"; d.className = "lj-trust";
    d.innerHTML = [["steam", "Entrega por Steam", "Directo a tu inventario, con atención inmediata."], ["pago", "Pago con Yape / tarjeta", "También por transferencia y WhatsApp."], ["azar", "Ganador al azar", "Rifas transparentes con ruleta."]].map(function (x) {
      return '<div class="lj-trust-i"><span class="lj-trust-ico">' + ICO[x[0]] + '</span><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></div>';
    }).join("");
    var dentro = hero.querySelector(".lj-h2-in");   // portada nueva: la franja va dentro, bajo los botones (como en Rayas)
    if (dentro) dentro.appendChild(d); else hero.insertAdjacentElement("afterend", d);
  }
  var IMG = {};
  function foto(src, alt) {
    src = String(src || "");
    if (/^fs:img-[\w\-]+$/.test(src)) return '<img data-fs="' + esc(src.slice(3)) + '" alt="' + esc(alt) + '">';
    if (/^(https:\/\/|data:image\/(webp|jpeg|png);base64,|img\/)/.test(src)) return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">';
    return "";
  }
  function hidratar(root) {
    root.querySelectorAll("img[data-fs]").forEach(function (im) {
      var id = im.getAttribute("data-fs");
      if (IMG[id]) { im.src = IMG[id]; return; }
      fetch(BASE + "rayas/" + id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var u = d && d.fields && d.fields.data && d.fields.data.stringValue;
        if (u && /^data:image\/(webp|jpeg|png);base64,/.test(u)) { IMG[id] = u; im.src = u; }
      }).catch(function () { /* sin foto */ });
    });
  }
  function fecha(v) { try { var d = new Date(v); return isNaN(d) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }); } catch (e) { return ""; } }
  function ganadores(st) {
    if (document.getElementById("ljWinners")) return;
    if (st.secciones && st.secciones.rifas === false) return;
    var g = (st.premios || []).filter(function (p) { return p && p.estado === "cerrada" && String(p.ganador || "").trim(); });
    g.sort(function (a, b) { return String(b.resultado || b.cierre || "").localeCompare(String(a.resultado || a.cierre || "")); });
    g = g.slice(0, 3);
    var ref = document.querySelector("#view-home .home-block");
    if (!g.length || !ref) return;
    var s = document.createElement("section"); s.id = "ljWinners"; s.className = "home-block lj-winners";
    s.innerHTML = '<h2 class="home-block-title gold-gradient-text">Últimos ganadores</h2>' +
      '<div class="lj-win-grid">' + g.map(function (p) {
        return '<article class="lj-win"><div class="lj-win-pic">' + (foto(p.img, p.nombre) || '<span class="lj-win-q">?</span>') + '<span class="lj-win-tag">GANÓ</span></div>' +
          '<div class="lj-win-b"><b>' + esc(p.ganador) + '</b><span>' + esc(p.nombre) + '</span>' + (p.cierre || p.resultado ? '<small>' + esc(fecha(p.resultado || p.cierre)) + '</small>' : '') + '</div></article>';
      }).join("") + '</div><div class="lj-win-more"><a class="lj-btn lj-btn-lg" href="rifas.html#ganadores">Ver todos los ganadores →</a></div>';
    ref.parentNode.insertBefore(s, ref);
    hidratar(s);
  }
  function iniciar() {
    franja();
    fetch(BASE + "rayas/estado", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return JSON.parse(d.fields.json.stringValue); }).then(ganadores).catch(function () { /* sin ganadores */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
