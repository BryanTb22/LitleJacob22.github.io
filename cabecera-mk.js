/* Cabecera estilo mercado (como Avan Market) para LitleJacob Store, igual que Rayas Store:
   secciones · canasta (carrito) · saldo con botón "+" (recargar) · menú del usuario.
   La usan la tienda (cuenta.js), Rifas (rifas.js) y el perfil (perfil.js).
   Cada página dibuja la parte derecha con ljMk.der({...}) y le dice qué hacer con ljMk.acciones({...}). */
(function () {
  "use strict";
  var SVG = {
    cesta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 11 4-7"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M9 15v2M15 15v2"/></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    fl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    wsp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>'
  };
  var abierto = "", acc = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
  function carroN() { try { var c = JSON.parse(localStorage.getItem("lj_carro_items_v1") || "{}"), n = 0; Object.keys(c).forEach(function (k) { n += Number(c[k]) || 0; }); return n; } catch (e) { return 0; } }
  function avatar(p) {
    if (/^https:\/\/[a-z0-9.-]+\.(steamstatic\.com|akamaihd\.net|steamusercontent\.com)\//i.test(String(p.steamAvatar || ""))) return '<img class="mk-uav" src="' + esc(p.steamAvatar) + '" alt="" referrerpolicy="no-referrer">';
    var n = String(p.nombre || p.email || "?").trim(), h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
    return '<span class="mk-uav ini" style="--h:' + h + '" aria-hidden="true">' + esc((n.charAt(0) || "?").toUpperCase()) + '</span>';
  }
  /* o = { admin, sesion, perfil:{nombre,email,creditos,steamAvatar,promoUsada}, cesta (true si se ve la canasta), n (opcional),
          rec:{ wsp, qr, card } (formas de recargar), misRifas, adminHtml (botones del admin) } */
  function der(o) {
    o = o || {};
    var n = typeof o.n === "number" ? o.n : carroN(), p = o.perfil;
    var cesta = o.cesta && !o.admin ? '<button type="button" class="mk-cesta" data-mk="cesta" aria-label="Carrito' + (n ? ", " + n + (n === 1 ? " item" : " items") : ", vacío") + '" title="Carrito">' + SVG.cesta + (n ? '<span class="mk-n">' + (n > 99 ? "99+" : n) + '</span>' : '') + '</button>' : '';
    if (o.admin) return o.adminHtml || '';
    if (!o.sesion) return cesta + '<button class="mk-btn ghost" type="button" data-mk="entrar">Entrar</button><button class="mk-btn" type="button" data-mk="registro">Crear cuenta</button>';
    if (!p) return cesta + '<button class="mk-btn ghost" type="button" data-mk="cuenta">Mi cuenta</button>';
    var r = o.rec || { wsp: true }, primera = false;   // sin promo de recarga
    var pop = '<div class="mk-pop" role="menu" aria-label="Recargar saldo">' +
      '<div class="mk-pop-h"><b>Recargar saldo</b><span>Tienes <b>S/ ' + fmt(p.creditos) + '</b></span></div>' +
      (primera ? '<p class="mk-pop-promo">🎁 Primera recarga: S/ 50 → <b>S/ 55</b> · S/ 100 → <b>S/ 110</b></p>' : '') +
      (r.wsp !== false ? '<button type="button" role="menuitem" class="mk-op" data-mk="wsp"><span class="mk-op-i wsp">' + SVG.wsp + '</span><span><b>Por WhatsApp</b><small>Te atiende una persona · sin comisión</small></span></button>' : '') +
      (r.qr ? '<button type="button" role="menuitem" class="mk-op" data-mk="qr"><span class="mk-op-i qr">' + SVG.qr + '</span><span><b>Yape con QR</b><small>Escanea, paga y manda tu captura · sin comisión</small></span></button>' : '') +
      (r.card ? '<button type="button" role="menuitem" class="mk-op" data-mk="card"><span class="mk-op-i card">' + SVG.card + '</span><span><b>Tarjeta, efectivo o billeteras</b><small>Pago en línea con Culqi · tu saldo sube solo</small></span></button>' : '') +
      '</div>';
    return cesta +
      '<span class="mk-saldo' + (abierto === "mas" ? " open" : "") + '"><button type="button" class="mk-monto" data-mk="trans" title="Ver mis movimientos"><small>Saldo</small><b>S/ ' + fmt(p.creditos) + '</b></button>' +
      '<button type="button" class="mk-mas" data-mk="mas" aria-haspopup="menu" aria-expanded="' + (abierto === "mas") + '" aria-label="Recargar saldo" title="Recargar saldo">' + SVG.mas + '</button>' + pop + '</span>' +
      '<span class="mk-user' + (abierto === "user" ? " open" : "") + '"><button class="mk-av" type="button" data-mk="user" aria-haspopup="menu" aria-expanded="' + (abierto === "user") + '" aria-label="Mi cuenta: ' + esc(p.nombre || "") + '">' + avatar(p) + '<span class="mk-fl">' + SVG.fl + '</span></button>' +
      '<div class="mk-umenu" role="menu"><div class="mk-umenu-h"><b>' + esc(p.nombre || "Mi cuenta") + '</b><small>' + esc(p.email || "") + '</small><span>Saldo: <b>S/ ' + fmt(p.creditos) + '</b></span></div>' +
      '<button type="button" role="menuitem" data-mk="perfil"><i>👤</i>Perfil</button>' +
      '<button type="button" role="menuitem" data-mk="trans"><i>🧾</i>Transacciones</button>' +
      (o.misRifas !== false ? '<button type="button" role="menuitem" data-mk="misRifas"><i>🎟️</i>Mis rifas</button>' : '') +
      '<button type="button" role="menuitem" class="out" data-mk="salir"><i>⎋</i>Cerrar sesión</button></div></span>';
  }
  function cerrar() {
    abierto = "";
    document.querySelectorAll(".mk-saldo.open, .mk-user.open").forEach(function (d) { d.classList.remove("open"); var b = d.querySelector("[aria-expanded]"); if (b) b.setAttribute("aria-expanded", "false"); });
  }
  function alternar(cual, el) {
    var caja = el.closest(cual === "mas" ? ".mk-saldo" : ".mk-user"), ya = abierto === cual;
    cerrar(); if (ya || !caja) return;
    abierto = cual; caja.classList.add("open"); el.setAttribute("aria-expanded", "true");
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-mk]");
    if (!b) { if (abierto && !(ev.target.closest && ev.target.closest(".mk-saldo, .mk-user"))) cerrar(); return; }
    var a = b.getAttribute("data-mk");
    if (a === "mas" || a === "user") { ev.preventDefault(); ev.stopPropagation(); alternar(a, b); return; }
    ev.preventDefault(); cerrar();
    if (typeof acc[a] === "function") acc[a](b);
  }, true);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && abierto) cerrar(); });
  // Barra de secciones en celular: deja a la vista la sección actual.
  function centrarActiva() {
    var on = document.querySelector(".mk-head .nav-links .active, .mk-head .nav-links .on"), nav = on && on.parentNode;
    if (nav && nav.scrollWidth > nav.clientWidth + 2) nav.scrollLeft = Math.max(0, on.offsetLeft - nav.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
  }
  window.addEventListener("lj-ruta", function () { setTimeout(centrarActiva, 0); }); window.addEventListener("load", centrarActiva);
  window.ljMk = { der: der, acciones: function (o) { acc = Object.assign(acc, o || {}); }, cerrar: cerrar, carroN: carroN, centrar: centrarActiva, svg: SVG };
})();
