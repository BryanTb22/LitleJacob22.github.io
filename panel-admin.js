/* =====================================================================
   PANEL ADMIN de la tienda de LitleJacob: el mismo panel lateral de Rayas Store.
   - Inicio / Sets Caché / Compro  → "Panel admin · General": Configuraciones principales · Usuarios y saldo · Textos y contactos
   - Comprar / Vender items        → "Panel admin · Compra y venta de items": Configuración · Items · Pedidos · Compras · Usuarios y saldo
   La barra de abajo (Nuevo set, Pedidos, Stock, Cofres…) queda solo para Sets Caché.
   Datos compartidos con Rayas y Rifas: rayas_users, orders, rayas_part y rayas/estado.
   ===================================================================== */
(function () {
  "use strict";
  var FB = { apiKey: "AIzaSyDbyLi7IK3ikwUp7A0VzRRqPucqRXPpL3E", projectId: "litlejacob-store" };
  var BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/";
  var SES_KEY = "lj_rifas_ses";
  var ADMIN_UID = "eLEZkdXiG5b0PpxHQCCei8D0Qxy1";
  var URL_PROBAR = "https://us-central1-" + FB.projectId + ".cloudfunctions.net/probarCorreos";
  var PED_ESTADOS = [["cooldown", "🔒 En cooldown"], ["pagado", "💰 Por entregar"], ["entregado", "✅ Entregado"], ["cancelado", "✖ Cancelado"]];
  // Pedidos con items en cooldown de Steam: se entregan recién en entregaDesde (los libera la función liberarCooldown cada hora).
  function fechaEntrega(iso) { var t = iso ? new Date(iso).getTime() : 0; return isFinite(t) && t ? new Date(t).toLocaleString("es-PE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""; }
  function fechaCorta(iso) { var t = iso ? new Date(iso) : null; if (!t || !isFinite(t.getTime())) return ""; var p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(t.getDate()) + "/" + p(t.getMonth() + 1); }
  function cdRestante(iso) {
    var ms = (iso ? new Date(iso).getTime() : 0) - Date.now(); if (!(ms > 0)) return "";
    var min = Math.ceil(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
    return d >= 1 ? d + " d " + (h % 24) + " h" : h >= 1 ? h + " h " + (min % 60) + " min" : min + " min";
  }
  var TABS = { bot: "🤖 Bot de Steam", config: "⚙ Configuración", usuarios: "👥 Usuarios y saldo", pagina: "📝 Textos y contactos", items: "🧩 Items", pedidos: "🛒 Pedidos", compras: "📥 Compras", pub: "🖼 Publicaciones", reclamos: "📕 Reclamos", ventas: "📊 Ventas" };

  var st = {
    abierto: false, tab: "", raiz: null,
    usuarios: null, uFiltro: "", uAbierto: null, fichaU: null, editU: null, delU: null, uMsg: "", subU: "lista", nc: null, ncMsg: "", ncOk: false, pedU: {}, partes: null,
    pedidos: null, pedFiltro: "pagado", pedAbierto: null, pedMsg: "",
    estado: null, estMsg: "", cfgGuarda: "", correoMsg: "", txMsg: "", txGuarda: false
  };

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtSol(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2).replace(/\.00$/, ""); }
  function fmtPrecio(n) { return "S/ " + fmtSol(n); }
  function soloDigitos(v) { return String(v || "").replace(/\D+/g, ""); }
  function waNum(n) { n = soloDigitos(n); return n.length === 9 ? "51" + n : n; }
  function tradeValido(u) { return /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/.test(String(u || "").trim()); }
  function imgSteamOk(u) { return /^https:\/\/[a-z0-9.-]+\.(steamstatic\.com|akamaihd\.net|steamusercontent\.com|steamcommunity\.com)\/[^\s"'<>]{1,300}$/i.test(String(u || "")); }
  function urlSteamOk(u) { return /^https:\/\/steamcommunity\.com\/[^\s"'<>]{1,200}$/.test(String(u || "")); }
  function fechaHora(t) { try { var d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " ·"); } catch (e) { return ""; } }
  function leerSesion() { try { return JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch (e) { return null; } }
  function guardarSesion(s) { try { if (s) localStorage.setItem(SES_KEY, JSON.stringify(s)); else localStorage.removeItem(SES_KEY); } catch (e) { /* nada */ } }
  function esAdmin() { var s = leerSesion(); return !!s && s.uid === ADMIN_UID; }
  function token() {
    var s = leerSesion();
    if (!s) return Promise.reject(new Error("NO_SESSION"));
    if (s.exp > Date.now()) return Promise.resolve(s.id);
    return fetch("https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(FB.apiKey), {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.ref)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.id_token) { guardarSesion(null); throw new Error("NO_SESSION"); }
      s.id = j.id_token; s.ref = j.refresh_token || s.ref; s.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000; guardarSesion(s); return s.id;
    });
  }
  function fs(ruta, opts) {
    return token().then(function (tk) { opts = opts || {}; opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tk }; return fetch(BASE + ruta, opts); });
  }
  function consulta(col, campo, valor, limite) {
    return token().then(function (tk) {
      return fetch(BASE.replace("/documents/", "/documents:runQuery"), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: campo }, op: "EQUAL", value: { stringValue: valor } } }, limit: limite || 300 } }) });
    }).then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? "Firebase no te deja leer estos datos." : "Error " + r.status); return r.json(); })
      .then(function (j) { return (j || []).filter(function (x) { return x.document; }).map(function (x) { return x.document; }); });
  }
  function seccion() { var v = document.body.getAttribute("data-vista") || "inicio"; return (v === "items" || v === "vender") ? "items" : "inicio"; }
  // ---------- Resumen de ventas (pedidos de items de esta tienda) ----------
  function ventasHtml(pedidos, per) {
    var ahora = new Date(), hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);
    var dias = per === "hoy" ? 1 : per === "7" ? 7 : per === "30" ? 30 : 0;
    var desde = dias ? new Date(hoy0.getTime() - (dias - 1) * 864e5) : null;
    var vivos = pedidos.filter(function (p) { return p.estado !== "cancelado" && p.fecha; });
    var enPer = vivos.filter(function (p) { return !desde || p.fecha >= desde; });
    var total = enPer.reduce(function (a, p) { return a + (Number(p.total) || 0); }, 0);
    var nItems = enPer.reduce(function (a, p) { return a + p.items.reduce(function (b, i) { return b + (Number(i.qty) || 1); }, 0); }, 0);
    var porEntregar = vivos.filter(function (p) { return p.estado === "pagado" || p.estado === "cooldown"; }).length;
    var r2 = function (n) { return Math.round(n * 100) / 100; };
    var sol = function (n) { n = r2(n); return "S/ " + (n % 1 ? n.toFixed(2) : n); };
    // Comparación con el periodo anterior del mismo largo
    var comp = "";
    if (dias) {
      var desdeAnt = new Date(desde.getTime() - dias * 864e5);
      var ant = vivos.filter(function (p) { return p.fecha >= desdeAnt && p.fecha < desde; }).reduce(function (a, p) { return a + (Number(p.total) || 0); }, 0);
      if (ant > 0) { var pct = Math.round((total - ant) / ant * 100); comp = '<em class="ven-var ' + (pct >= 0 ? 'sube' : 'baja') + '">' + (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% vs. periodo anterior</em>'; }
      else if (total > 0) comp = '<em class="ven-var sube">▲ nuevo (antes S/ 0)</em>';
    }
    var chips = [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"], ["todo", "Todo"]].map(function (c) {
      return '<button type="button" role="tab" data-pa="venPer" data-p="' + c[0] + '" aria-selected="' + (per === c[0]) + '">' + c[1] + '</button>';
    }).join("");
    var stats = '<div class="adm-stats ven-stats">' +
      '<div class="adm-stat acc"><small>Ventas</small><b>' + sol(total) + '</b>' + comp + '</div>' +
      '<div class="adm-stat"><small>Pedidos</small><b>' + enPer.length + '</b></div>' +
      '<div class="adm-stat"><small>Ticket promedio</small><b>' + (enPer.length ? sol(total / enPer.length) : "—") + '</b></div>' +
      '<div class="adm-stat"><small>Items vendidos</small><b>' + nItems + '</b></div>' +
      '<div class="adm-stat"><small>Por entregar</small><b>' + porEntregar + '</b></div></div>';
    // Gráfico por día
    var nDias = dias === 1 ? 14 : (dias || 30), barras = [], max = 0;
    for (var k = nDias - 1; k >= 0; k--) {
      var d0 = new Date(hoy0.getTime() - k * 864e5), d1 = new Date(d0.getTime() + 864e5);
      var v = vivos.filter(function (p) { return p.fecha >= d0 && p.fecha < d1; }).reduce(function (a, p) { return a + (Number(p.total) || 0); }, 0);
      barras.push({ d: d0, v: r2(v) }); if (v > max) max = v;
    }
    var etq = function (d) { return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }); };
    var graf = '<div class="ven-chart" role="img" aria-label="Ventas por día">' + barras.map(function (b, i) {
      var h = max ? Math.max(2, Math.round(b.v / max * 100)) : 2;
      return '<div class="ven-col" title="' + esc(etq(b.d) + ': ' + sol(b.v)) + '"><span class="ven-val">' + (b.v && (nDias <= 14 || b.v === r2(max)) ? esc(sol(b.v)) : '') + '</span><span class="ven-bar' + (b.v ? '' : ' cero') + '" style="height:' + h + '%"></span><span class="ven-dia">' + (i === 0 || i === barras.length - 1 || i === Math.floor(barras.length / 2) || nDias <= 7 ? esc(etq(b.d)) : '') + '</span></div>';
    }).join("") + '</div>';
    // Más vendidos
    var mapI = {};
    enPer.forEach(function (p) { p.items.forEach(function (i) { var key = i.id || i.nombre; var o = mapI[key] || (mapI[key] = { id: i.id, nombre: i.nombre, qty: 0, ing: 0 }); o.qty += Number(i.qty) || 1; o.ing += (Number(i.precio) || 0) * (Number(i.qty) || 1); }); });
    var topI = Object.keys(mapI).map(function (k) { return mapI[k]; }).sort(function (a, b) { return b.ing - a.ing || b.qty - a.qty; }).slice(0, 5);
    var listaI = topI.length ? topI.map(function (o, n) { return '<div class="ven-row"><span class="ven-n">' + (n + 1) + '</span>' + pedItemHtml({ id: o.id, nombre: o.nombre, qty: o.qty }, true) + '<b>' + sol(o.ing) + '</b></div>'; }).join("") : '<p class="pa-hint">Sin ventas en este periodo.</p>';
    // Mejores clientes
    var mapC = {};
    enPer.forEach(function (p) { var key = p.uid || (p.cliente || "").toLowerCase(); var o = mapC[key] || (mapC[key] = { uid: p.uid, nombre: p.cliente || "Sin nombre", n: 0, tot: 0 }); o.n++; o.tot += Number(p.total) || 0; });
    var topC = Object.keys(mapC).map(function (k) { return mapC[k]; }).sort(function (a, b) { return b.tot - a.tot; }).slice(0, 5);
    var listaC = topC.length ? topC.map(function (o, n) { return '<div class="ven-row"><span class="ven-n">' + (n + 1) + '</span><span class="ven-cli"><b>' + esc(o.nombre) + '</b><small>' + o.n + (o.n === 1 ? ' compra' : ' compras') + '</small></span><b>' + sol(o.tot) + '</b>' + (o.uid ? '<button class="pa-ico" type="button" data-pa="informe" data-uid="' + esc(o.uid) + '" title="Informe de compras">🧾</button>' : '') + '</div>'; }).join("") : '<p class="pa-hint">Sin ventas en este periodo.</p>';
    return '<div class="pa-sub" role="tablist">' + chips + '</div>' + stats +
      '<div class="pa-grp"><h3>Ventas por día</h3>' + graf + '<p class="pa-hint">Solo pedidos de items de esta tienda (sin cancelados). Pasa el mouse o toca una barra para ver el monto.</p></div>' +
      '<div class="ven-dos"><div class="pa-grp"><h3>🏆 Más vendidos</h3>' + listaI + '</div><div class="pa-grp"><h3>⭐ Mejores clientes</h3>' + listaC + '</div></div>';
  }
  function tabVentas() {
    if (window.ljItems && window.ljItems.porPedido) window.ljItems.porPedido("", "");
    if (!st.pedidos) { cargarPedidos(); return '<p class="pa-hint">Cargando ventas…</p>'; }
    return ventasHtml(st.pedidos, st.venPer || "30");
  }
  // ---------- Libro de Reclamaciones: lista para el admin ----------
  function recLeer(doc) {
    var f = doc.fields || {}, g = function (k) { var v = f[k]; if (!v) return ""; return v.stringValue !== undefined ? v.stringValue : v.timestampValue !== undefined ? v.timestampValue : v.booleanValue !== undefined ? v.booleanValue : v.integerValue !== undefined ? v.integerValue : v.doubleValue !== undefined ? v.doubleValue : ""; };
    var o = { id: doc.name.split("/").pop() };
    ["numero", "tienda", "tipo", "tipoDoc", "numDoc", "nombre", "domicilio", "telefono", "email", "apoderado", "bienTipo", "bien", "monto", "pedidoRef", "detalle", "pedido", "estado", "creado", "vence", "respondido"].forEach(function (k) { o[k] = g(k); });
    o.menor = g("menor") === true; o.numero = o.numero || o.id; o.estado = o.estado || "pendiente";
    return o;
  }
  function cargarReclamos() {
    st.recCargando = true; st.recMsg = "";
    token().then(function (tk) {
      return fetch(BASE.replace("/documents/", "/documents:runQuery"), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "reclamos" }], orderBy: [{ field: { fieldPath: "creado" }, direction: "DESCENDING" }], limit: 300 } }) });
    }).then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? "Firebase todavía no te deja leer los reclamos: falta publicar la regla nueva (ver documento reclamos-panel)." : "Error " + r.status); return r.json(); })
      .then(function (j) { st.reclamos = (j || []).filter(function (x) { return x.document; }).map(function (x) { return recLeer(x.document); }); st.recCargando = false; pintar(); })
      .catch(function (e) { st.reclamos = []; st.recCargando = false; st.recMsg = e.message; pintar(); });
  }
  // Días hábiles (lunes a viernes) que faltan hasta la fecha límite; negativo si ya venció.
  function recDiasHabiles(venceIso) {
    if (!venceIso) return null;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var v = new Date(venceIso); v.setHours(0, 0, 0, 0);
    var paso = v >= hoy ? 1 : -1, n = 0, d = new Date(hoy);
    while ((paso > 0 && d < v) || (paso < 0 && d > v)) { d.setDate(d.getDate() + paso); var w = d.getDay(); if (w !== 0 && w !== 6) n += paso; }
    return n;
  }
  function recPlazoHtml(r) {
    if (r.estado === "respondido") return '<small class="ped-est rec-est e-entregado">✔ Respondido</small>';
    if (r.estado === "archivado") return '<small class="ped-est rec-est">🗂 Archivado</small>';
    var d = recDiasHabiles(r.vence);
    if (d === null) return '<small class="ped-est rec-est e-pagado">Pendiente</small>';
    if (d < 0) return '<small class="ped-est rec-est e-vencido">⚠ Vencido hace ' + (-d) + (d === -1 ? ' día hábil' : ' días hábiles') + '</small>';
    if (d === 0) return '<small class="ped-est rec-est e-vencido">⚠ Vence hoy</small>';
    return '<small class="ped-est rec-est ' + (d <= 3 ? 'e-vencido' : 'e-pagado') + '">⏳ Quedan ' + d + (d === 1 ? ' día hábil' : ' días hábiles') + '</small>';
  }
  function recGmail(r) {
    var marca = r.tienda === "rayas" ? "Rayas Store" : "LitleJacob Store";
    var cuerpo = "Hola " + r.nombre + ":\n\nTe escribimos por tu " + r.tipo + " N° " + r.numero + " del Libro de Reclamaciones de " + marca + ", registrado el " + (r.creado ? new Date(r.creado).toLocaleDateString("es-PE") : "") + ".\n\nTu pedido: " + r.pedido + "\n\nNuestra respuesta:\n\n\n\nAtentamente,\n" + marca + "\nTIRAPO BUSTILLOS BRYAN DARWIN · RUC 10712504761";
    return "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(r.email) + "&su=" + encodeURIComponent("Respuesta a tu " + r.tipo + " N° " + r.numero + " · " + marca) + "&body=" + encodeURIComponent(cuerpo);
  }
  function recCambiarEstado(id, est) {
    var r = (st.reclamos || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var antes = r.estado, ahora = new Date().toISOString();
    r.estado = est; r.guardando = true; pintar();
    var campos = { estado: { stringValue: est } }, mask = "updateMask.fieldPaths=estado";
    if (est === "respondido") { campos.respondido = { timestampValue: ahora }; mask += "&updateMask.fieldPaths=respondido"; }
    fs("reclamos/" + encodeURIComponent(id) + "?" + mask + "&currentDocument.exists=true", { method: "PATCH", body: JSON.stringify({ fields: campos }) })
      .then(function (res) { if (!res.ok) throw new Error(res.status === 403 ? "Firebase no te deja cambiarlo: falta publicar la regla nueva." : "Error " + res.status); r.guardando = false; if (est === "respondido") r.respondido = ahora; pintar(); })
      .catch(function (e) { r.estado = antes; r.guardando = false; st.recMsg = "No se guardó: " + e.message; pintar(); });
  }
  function tabReclamos() {
    if (!st.reclamos) { if (!st.recCargando) cargarReclamos(); return '<p class="pa-hint">Cargando reclamos…</p>'; }
    var esta = "litlejacob", soloEsta = !st.recTodas;
    var base = st.reclamos.filter(function (r) { return !soloEsta || r.tienda === esta || !r.tienda; });
    var fl = st.recFiltro || "pendiente";
    var cuenta = function (e) { return base.filter(function (r) { return e === "todos" ? r.estado !== "archivado" : r.estado === e; }).length; };
    var urg = base.filter(function (r) { var d = recDiasHabiles(r.vence); return r.estado === "pendiente" && d !== null && d <= 3; }).length;
    var lista = base.filter(function (r) { return fl === "todos" ? r.estado !== "archivado" : r.estado === fl; });
    var chips = [["pendiente", "⏳ Pendientes"], ["respondido", "✔ Respondidos"], ["archivado", "🗂 Archivados"], ["todos", "Todos"]].map(function (c) {
      return '<button type="button" role="tab" data-pa="recFiltro" data-f="' + c[0] + '" aria-selected="' + (fl === c[0]) + '">' + c[1] + ' (' + cuenta(c[0]) + ')</button>';
    }).join("");
    var stats = '<div class="adm-stats"><div class="adm-stat' + (cuenta("pendiente") ? ' acc' : '') + '"><small>Pendientes</small><b>' + cuenta("pendiente") + '</b></div><div class="adm-stat' + (urg ? ' acc' : '') + '"><small>Por vencer (≤ 3 días)</small><b>' + urg + '</b></div><div class="adm-stat"><small>Respondidos</small><b>' + cuenta("respondido") + '</b></div></div>';
    var filas = lista.map(function (r) {
      var ab = st.recAbierto === r.id, id = esc(r.id);
      var cab = '<button type="button" class="pa-urow-h" data-pa="recAbrir" data-id="' + id + '" aria-expanded="' + ab + '"><b>' + esc(r.numero) + ' · ' + esc(r.tipo === "queja" ? "Queja" : "Reclamo") + ' · ' + esc(r.nombre) + '</b>' + recPlazoHtml(r) + '<i>' + (ab ? "▴" : "▾") + '</i></button>';
      if (!ab) return '<div class="pa-urow">' + cab + '</div>';
      var fila = function (k, v) { return v ? '<div class="pa-frow"><span>' + k + '</span><div>' + v + '</div></div>' : ''; };
      var det = '<div class="pa-ficha rec-ficha">' +
        fila("Tienda", esc(r.tienda === "rayas" ? "Rayas Store" : "LitleJacob Store")) +
        fila("Registrado", esc(r.creado ? fechaHora(r.creado) : "—")) +
        fila("Responder antes del", esc(r.vence ? new Date(r.vence).toLocaleDateString("es-PE") : "—") + ' (15 días hábiles)') +
        (r.respondido ? fila("Respondido el", esc(fechaHora(r.respondido))) : '') +
        fila("Documento", esc(r.tipoDoc + " " + r.numDoc)) +
        fila("Correo", '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>') +
        fila("Teléfono", soloDigitos(r.telefono) ? '<a href="https://wa.me/' + esc(waNum(r.telefono)) + '" target="_blank" rel="noopener">' + esc(r.telefono) + ' ↗</a>' : esc(r.telefono)) +
        fila("Domicilio", esc(r.domicilio)) +
        (r.menor ? fila("Menor de edad", "Sí · apoderado: " + esc(r.apoderado)) : '') +
        fila(r.bienTipo === "servicio" ? "Servicio" : "Producto", esc(r.bien)) +
        fila("Monto reclamado", r.monto ? "S/ " + esc(r.monto) : "") +
        fila("Pedido / referencia", esc(r.pedidoRef)) +
        fila("Qué pasó", '<p class="rec-txt">' + esc(r.detalle) + '</p>') +
        fila("Qué pide", '<p class="rec-txt">' + esc(r.pedido) + '</p>') +
        '<div class="pa-acc">' +
        '<a class="pa-btn rojo sm" href="' + esc(recGmail(r)) + '" target="_blank" rel="noopener">✉ Responder por correo</a>' +
        (r.estado !== "respondido" ? '<button class="pa-btn ghost sm" type="button" data-pa="recEstado" data-e="respondido" data-id="' + id + '"' + (r.guardando ? ' disabled' : '') + '>✔ Marcar respondido</button>' : '<button class="pa-btn ghost sm" type="button" data-pa="recEstado" data-e="pendiente" data-id="' + id + '"' + (r.guardando ? ' disabled' : '') + '>↺ Volver a pendiente</button>') +
        (r.estado !== "archivado" ? '<button class="pa-btn ghost sm" type="button" data-pa="recEstado" data-e="archivado" data-id="' + id + '" title="Para reclamos de prueba: lo saca de la lista sin borrarlo"' + (r.guardando ? ' disabled' : '') + '>🗂 Archivar (prueba)</button>' : '') +
        '</div></div>';
      return '<div class="pa-urow open">' + cab + det + '</div>';
    }).join("");
    return '<div class="pa-sub" role="tablist">' + chips + '</div>' + stats +
      '<div class="pa-grp"><h3>Libro de Reclamaciones</h3>' +
      '<p class="pa-hint">Por ley tienes <b>15 días hábiles</b> para responder cada reclamo o queja al correo del cliente. Responde, y luego marca "Respondido". Los de prueba, archívalos (no se borran).</p>' +
      '<label class="rec-todas"><input type="checkbox" data-pa="recTodas"' + (st.recTodas ? ' checked' : '') + '> Ver también los de Rayas Store</label>' +
      (st.recMsg ? '<p class="pa-hint err">' + esc(st.recMsg) + '</p>' : '') +
      '<div class="pa-ulist">' + (filas || '<p class="pa-hint">' + (fl === "pendiente" ? "🎉 No hay reclamos pendientes." : "No hay reclamos aquí.") + '</p>') + '</div>' +
      '<div class="pa-acc"><button class="pa-btn ghost sm" type="button" data-pa="recRecargar">↻ Actualizar</button></div></div>';
  }
  function tabsDe(sc) { return sc === "items" ? ["config", "ventas", "items", "pedidos", "bot", "compras", "usuarios", "pub", "reclamos"] : ["config", "ventas", "usuarios", "pagina", "pub", "reclamos"]; }

  /* ---------- estado compartido (rayas/estado) ---------- */
  function leerEstado() {
    return fetch(BASE + "rayas/estado", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { return JSON.parse(d.fields.json.stringValue); });
  }
  function cargarEstado() {
    if (st.estado || st.cargandoEst) return; st.cargandoEst = true;
    leerEstado().then(function (j) { st.estado = j; st.estMsg = ""; }).catch(function () { st.estMsg = "No se pudo leer la configuración."; })
      .then(function () { st.cargandoEst = false; pintar(); });
  }
  // Lee lo último, aplica el cambio y guarda (así no se pisa lo que otro panel cambió).
  function guardarEstado(cambio) {
    return Promise.all([token(), leerEstado()]).then(function (r) {
      var j = r[1]; cambio(j);
      return fetch(BASE + "rayas/estado?updateMask.fieldPaths=json&updateMask.fieldPaths=actualizado", {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + r[0] },
        body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(j) }, actualizado: { timestampValue: new Date().toISOString() } } })
      }).then(function (x) { if (!x.ok) throw new Error("HTTP " + x.status); st.estado = j; try { window.dispatchEvent(new Event("lj-cfg")); } catch (e) { /* nada */ } return j; });
    });
  }

  /* ---------- Configuración ---------- */
  function swCfg(k, on, titulo, desc, si, no) {
    return '<button type="button" class="pa-cfg' + (on ? ' on' : '') + '" data-pa="cfg" data-k="' + k + '" role="switch" aria-checked="' + on + '"' + (st.cfgGuarda ? ' disabled' : '') + '>' +
      '<span class="pa-cfg-tx"><b>' + titulo + '</b><small>' + desc + '</small><em>' + (on ? si : no) + '</em></span><span class="pa-sw" aria-hidden="true"></span></button>';
  }
  function tabConfig(sc) {
    if (!st.estado) { cargarEstado(); return '<p class="pa-hint">' + esc(st.estMsg || "Cargando…") + '</p>'; }
    var j = st.estado, sec = j.secciones || {}, rif = sec.rifas !== false, it = !!sec.items, cq = !!(j.pagos && j.pagos.culqi);
    var h = '<div class="pa-grp"><h3>' + (sc === "items" ? "Configuración de compra y venta" : "Configuraciones principales") + '</h3>' +
      '<p class="pa-hint">Activa o desactiva las secciones de la página. Lo desactivado solo lo ves tú (administrador). Se guarda al instante y son las mismas opciones en Rayas Store y LitleJacob Store.</p>' +
      (sc === "items" ? "" : swCfg("rifas", rif, "🎟️ Rifas", "Sección de rifas, cómo participar, ganadores y reglas.", "VISIBLE para los clientes", "OCULTA: solo tú la ves")) +
      swCfg("items", it, "🛒 Compra y venta de items", "Comprar items, Vender items y Carrito.", "VISIBLE para los clientes", "OCULTA: solo tú la ves") +
      (sc === "items" ? "" : swCfg("culqi", cq, "💳 Culqi (tarjeta / Yape)", "Botón de pago en línea para recargar saldo.", "ACTIVO: pueden recargar con tarjeta o Yape", "APAGADO: solo piden saldo por WhatsApp")) +
      (st.cfgMsg ? '<p class="pa-hint">' + esc(st.cfgMsg) + '</p>' : '') +
      (sc === "items" ? '<p class="pa-hint">Las demás opciones (Culqi, Yape, contactos) están en el panel de <b>Inicio</b>.</p>' : '') + '</div>';
    if (sc === "items") return h;
    h += '<div class="pa-grp"><h3>✉️ Correos de pago</h3><p class="pa-hint">Envía a tu correo de administrador 4 correos de ejemplo (pago confirmado y pago pendiente, con el diseño de Rayas y de LitleJacob) para ver cómo les llegan a los clientes. No cobra ni suma nada.</p>' +
      '<div><button type="button" class="pa-btn ghost" data-pa="probarCorreos"' + (st.correoMsg === "Enviando…" ? ' disabled' : '') + '>Enviar correos de prueba</button></div>' +
      (st.correoMsg ? '<p class="pa-hint">' + esc(st.correoMsg) + '</p>' : '') + '</div>';
    h += '<div class="pa-grp"><h3>🛠️ Herramientas de LitleJacob</h3><p class="pa-hint">Pedidos de Sets Caché, publicación del catálogo y respaldo. La barra de abajo con Nuevo set, Stock y Cofres aparece en <b>Sets Caché</b>.</p>' +
      '<div class="pa-acc"><button type="button" class="pa-btn ghost" data-pa="proxy" data-id="adminOrdersBtn">📦 Pedidos de Sets Caché</button><a class="pa-btn ghost" href="#sets-cache" data-pa="cerrar">🎁 Ir a Sets Caché</a>' +
      '<button type="button" class="pa-btn ghost" data-pa="proxy" data-id="adminGhCfgBtn">⚙️ Conexión con GitHub</button><button type="button" class="pa-btn ghost" data-pa="proxy" data-id="adminDbBtn">🗄️ Base de datos</button>' +
      '<button type="button" class="pa-btn ghost" data-pa="proxy" data-id="adminExportBtn">💾 Descargar index.html</button><button type="button" class="pa-btn ghost peligro" data-pa="proxy" data-id="adminDiscardBtn">↺ Descartar cambios</button></div></div>';
    return h;
  }
  function guardarCfg(k) {
    if (st.cfgGuarda) return;
    st.cfgGuarda = k; st.cfgMsg = "Guardando…"; pintar();
    guardarEstado(function (j) {
      if (k === "culqi") j.pagos = Object.assign({}, j.pagos || {}, { culqi: !(j.pagos && j.pagos.culqi) });
      else { var sc = Object.assign({}, j.secciones || {}); sc[k] = k === "rifas" ? sc.rifas === false : !sc.items; j.secciones = sc; }
    }).then(function () { st.cfgMsg = "✔ Guardado. Ya lo ven todos (también en Rayas Store)."; })
      .catch(function (e) { st.cfgMsg = (e && e.message === "NO_SESSION") ? "Tu sesión venció. Vuelve a entrar." : "No se pudo guardar (" + ((e && e.message) || "error") + ")."; })
      .then(function () { st.cfgGuarda = ""; pintar(); });
  }
  function probarCorreos() {
    st.correoMsg = "Enviando…"; pintar();
    token().then(function (tk) { return fetch(URL_PROBAR, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: "{}" }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        st.correoMsg = x.ok && x.j.ok ? "✔ Enviados " + x.j.enviados + " correos a " + x.j.a + ". Revisa tu bandeja y la carpeta de spam." + (x.j.fallaron ? " Fallaron " + x.j.fallaron + ": " + x.j.error : "") : ((x.j && x.j.error) || "No se pudo enviar.");
      }).catch(function (e) { st.correoMsg = (e && e.message === "NO_SESSION") ? "Tu sesión venció. Vuelve a entrar." : "No se pudo conectar. Intenta de nuevo."; })
      .then(pintar);
  }

  /* ---------- Textos y contactos (Yape, WhatsApp, mensajes) ---------- */
  function tabPagina() {
    if (!st.estado) { cargarEstado(); return '<p class="pa-hint">' + esc(st.estMsg || "Cargando…") + '</p>'; }
    var j = st.estado, y = j.yape || {}, T = j.textos || {};
    return '<div class="pa-grp"><h3>💜 Yape para recargas por WhatsApp</h3><p class="pa-hint">Los clientes que elijan <b>Yape / WhatsApp</b> ven estos datos al recargar (sin comisión) y te mandan la captura por WhatsApp.</p>' +
      '<p class="pa-hint">' + (y.qr ? "✔ Tienes un QR de Yape subido." : "Aún no subes tu QR.") + ' El QR y las fotos de los contactos se cambian en <a href="rifas.html#admin">Rifas → Panel admin → Textos y contactos</a>.</p>' +
      '<div class="pa-field"><label for="pa-ynum">Número de Yape (opcional)</label><input id="pa-ynum" inputmode="tel" maxlength="12" value="' + esc(y.numero || "") + '"></div>' +
      '<div class="pa-field"><label for="pa-ynom">A nombre de (opcional)</label><input id="pa-ynom" maxlength="40" value="' + esc(y.nombre || "") + '"></div></div>' +
      (j.contactos || []).map(function (c, k) {
        return '<div class="pa-grp"><h3>Contacto ' + (k + 1) + ' · ' + esc(c.nombre || "sin nombre") + '</h3>' +
          '<div class="pa-field"><label for="pa-cn' + k + '">Nombre</label><input id="pa-cn' + k + '" maxlength="30" value="' + esc(c.nombre) + '"></div>' +
          '<div class="pa-field"><label for="pa-cw' + k + '">Número con código de país</label><input id="pa-cw' + k + '" inputmode="numeric" placeholder="51987654321" value="' + esc(c.numero) + '"></div>' +
          '<label class="pa-chk"><input type="checkbox" id="pa-ca' + k + '"' + (c.activo ? ' checked' : '') + '> Activo (recibe mensajes de clientes)</label></div>';
      }).join("") +
      '<p class="pa-hint">Si los dos están activos, el cliente elige con quién hablar. Si solo hay uno activo, el botón abre directo su WhatsApp. Perú: 51 + 9 dígitos.</p>' +
      '<div class="pa-grp"><h3>Mensajes de WhatsApp</h3>' +
      '<div class="pa-field"><label for="pa-m1">Cuando pide saldo con cuenta</label><textarea id="pa-m1" rows="5" maxlength="600">' + esc(T.msgCredPerfil || "") + '</textarea></div>' +
      '<p class="pa-hint">Usa {nombre} y {correo} para poner los datos del usuario.</p>' +
      '<div class="pa-field"><label for="pa-m2">Cuando pide saldo sin cuenta</label><textarea id="pa-m2" rows="4" maxlength="600">' + esc(T.msgCredVisita || "") + '</textarea></div></div>' +
      '<div class="pa-acc"><button type="button" class="pa-btn rojo" data-pa="guardarTextos"' + (st.txGuarda ? ' disabled' : '') + '>Guardar cambios</button>' +
      (st.txMsg ? '<span class="pa-hint">' + esc(st.txMsg) + '</span>' : '') + '</div>';
  }
  function guardarTextos() {
    var v = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    var y = { numero: soloDigitos(v("pa-ynum")).slice(0, 12), nombre: String(v("pa-ynom") || "").trim().slice(0, 40) };
    var cs = (st.estado.contactos || []).map(function (c, k) {
      var ca = document.getElementById("pa-ca" + k);
      return { nombre: String(v("pa-cn" + k) || "").trim().slice(0, 30), numero: soloDigitos(v("pa-cw" + k)), activo: !!(ca && ca.checked) };
    });
    var m1 = v("pa-m1"), m2 = v("pa-m2");
    st.txGuarda = true; st.txMsg = "Guardando…"; pintar();
    guardarEstado(function (j) {
      j.yape = Object.assign({}, j.yape || {}, y);
      j.contactos = (j.contactos || []).map(function (c, k) { return cs[k] ? Object.assign({}, c, cs[k]) : c; });
      j.textos = Object.assign({}, j.textos || {}, m1 !== null ? { msgCredPerfil: m1 } : {}, m2 !== null ? { msgCredVisita: m2 } : {});
    }).then(function () { st.txMsg = "✔ Guardado. Ya lo ven todos (también en Rayas Store)."; })
      .catch(function (e) { st.txMsg = "No se pudo guardar (" + ((e && e.message) || "error") + ")."; })
      .then(function () { st.txGuarda = false; pintar(); });
  }

  /* ---------- Usuarios y saldo ---------- */
  function leerPerfilDoc(d) {
    var f = (d && d.fields) || {}, sv = function (k) { return f[k] && f[k].stringValue || ""; };
    return { uid: d && d.name ? d.name.split("/").pop() : "", nombre: sv("nombre"), steam: sv("steam"), steamId: sv("steamId"), whatsapp: sv("whatsapp"), email: sv("email"), tradelink: sv("tradelink"),
      creditos: f.creditos ? Number(f.creditos.integerValue || f.creditos.doubleValue || 0) : 0, creado: f.creado && f.creado.timestampValue || "",
      steamAvatar: sv("steamAvatar"), steamPais: sv("steamPais"), steamPerfilUrl: sv("steamPerfilUrl"),
      steamPublico: f.steamPublico && typeof f.steamPublico.booleanValue === "boolean" ? f.steamPublico.booleanValue : null };
  }
  function avatarUsuario(u, grande) {
    var cls = "pa-av" + (grande ? " grande" : "");
    if (imgSteamOk(u.steamAvatar)) return '<img class="' + cls + '" src="' + esc(u.steamAvatar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    var n = String(u.nombre || u.email || "?").trim(), h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
    return '<span class="' + cls + ' ini" style="--h:' + h + '" aria-hidden="true">' + esc((n.charAt(0) || "?").toUpperCase()) + '</span>';
  }
  function usuarioPorUid(uid) { return (st.usuarios || []).filter(function (x) { return x.uid === uid; })[0]; }
  function cargarUsuarios() {
    if (st.cargandoU) return; st.cargandoU = true; st.uMsg = "";
    fs("rayas_users?pageSize=300").then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 ? "Falta agregar la regla de cuentas en Firebase." : "Error " + r.status);
      return r.json();
    }).then(function (j) { st.usuarios = (j.documents || []).map(leerPerfilDoc).sort(function (a, b) { return ((Number(b.creditos) || 0) - (Number(a.creditos) || 0)) || a.nombre.localeCompare(b.nombre); }); })
      .catch(function (e) { st.usuarios = []; st.uMsg = e.message; }).then(function () { st.cargandoU = false; pintar(); });
  }
  function guardarCreditos(uid, valor) {
    var u = usuarioPorUid(uid); if (!u) return;
    var antes = u.creditos;
    u.creditos = Math.max(0, Math.round(Number(valor) * 100) / 100); u.guardando = true; pintar();
    fs("rayas_users/" + encodeURIComponent(uid) + "?updateMask.fieldPaths=creditos&currentDocument.exists=true", {
      method: "PATCH", body: JSON.stringify({ fields: { creditos: (u.creditos % 1 === 0 ? { integerValue: String(u.creditos) } : { doubleValue: u.creditos }) } })
    }).then(function (r) { if (!r.ok) throw new Error("Error " + r.status); u.guardando = false; u.ok = Date.now(); pintar(); setTimeout(pintar, 4100); })
      .catch(function (e) { u.creditos = antes; u.guardando = false; st.uMsg = "No se guardó: " + e.message; pintar(); });
  }
  function guardarUsuario(uid) {
    var u = usuarioPorUid(uid); if (!u) return;
    var g = function (id) { return (document.getElementById(id) || {}).value || ""; };
    var nom = g("pa-eu-nombre").trim(), wa = g("pa-eu-wa").trim(), tl = g("pa-eu-trade").trim();
    if (!nom) { st.uMsg = "El nombre no puede quedar vacío."; pintar(); return; }
    if (tl && !tradeValido(tl)) { st.uMsg = "Ese trade link no parece válido."; pintar(); return; }
    st.uMsg = "Guardando…"; pintar();
    fs("rayas_users/" + encodeURIComponent(uid) + "?updateMask.fieldPaths=nombre&updateMask.fieldPaths=whatsapp&updateMask.fieldPaths=tradelink&currentDocument.exists=true", {
      method: "PATCH", body: JSON.stringify({ fields: { nombre: { stringValue: nom }, whatsapp: { stringValue: wa }, tradelink: { stringValue: tl } } })
    }).then(function (r) { if (!r.ok) throw new Error("Error " + r.status); u.nombre = nom; u.whatsapp = wa; u.tradelink = tl; st.editU = null; st.uMsg = ""; pintar(); })
      .catch(function (e) { st.uMsg = "No se guardó: " + e.message; pintar(); });
  }
  function eliminarUsuario(uid) {
    var base = "projects/" + FB.projectId + "/databases/(default)/documents/";
    st.uMsg = "Eliminando…"; pintar();
    consulta("rayas_part", "uid", uid, 300).then(function (docs) {
      var ws = docs.map(function (d) { return { delete: d.name }; }); ws.push({ delete: base + "rayas_users/" + uid });
      return token().then(function (tk) { return fetch(BASE.replace(/documents\/$/, "documents:commit"), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify({ writes: ws }) }); });
    }).then(function (r) {
      if (r.status === 403) throw new Error("Firebase no permite borrar usuarios todavía: falta la regla 'allow delete: if isAdmin();' en rayas_users.");
      if (!r.ok) throw new Error("Error " + r.status);
      st.delU = null; st.usuarios = null; st.uMsg = ""; pintar();
    }).catch(function (e) { st.delU = null; st.uMsg = e.message; pintar(); });
  }
  function crearCuenta(pre) {
    var g = function (i) { var e = document.getElementById(i); return e ? e.value.trim() : ""; };
    var d = pre || { nombre: g("pa-nc-nombre"), email: g("pa-nc-email").toLowerCase(), pass: (document.getElementById("pa-nc-pass") || {}).value || "", wsp: g("pa-nc-wsp"), trade: g("pa-nc-trade"), cred: g("pa-nc-cred") };
    st.nc = d; st.ncOk = false;
    var cred = Math.max(0, Math.floor(Number(d.cred) || 0));
    if (!d.nombre || !d.email || d.pass.length < 6) { st.ncMsg = "Falta nombre, correo o la contraseña (mínimo 6 caracteres)."; pintar(); return; }
    if (d.trade && !tradeValido(d.trade)) { st.ncMsg = "El trade link no es válido."; pintar(); return; }
    st.ncMsg = "Creando cuenta…"; st.ncOk = true; pintar();
    fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(FB.apiKey), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: d.email, password: d.pass, returnSecureToken: true })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.idToken) throw new Error((j.error && j.error.message) || "SIGNUP_FAILED");
      return fetch(BASE + "rayas_users/" + encodeURIComponent(j.localId) + "?currentDocument.exists=false", {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + j.idToken },
        body: JSON.stringify({ fields: { nombre: { stringValue: d.nombre }, whatsapp: { stringValue: d.wsp }, email: { stringValue: d.email }, tradelink: { stringValue: d.trade }, creditos: { integerValue: "0" }, creado: { timestampValue: new Date().toISOString() } } })
      }).then(function (r) {
        if (!r.ok) throw new Error("PERFIL_" + r.status);
        if (!cred) return;
        return fs("rayas_users/" + encodeURIComponent(j.localId) + "?updateMask.fieldPaths=creditos&currentDocument.exists=true", { method: "PATCH", body: JSON.stringify({ fields: { creditos: { integerValue: String(cred) } } }) });
      });
    }).then(function () {
      st.nc = null; st.ncMsg = pre ? "✔ Cuenta de prueba creada. Correo: " + d.email + " · Contraseña: " + d.pass + " · 100 soles" : "✔ Cuenta creada: " + d.email; st.ncOk = true; st.usuarios = null; pintar();
    }).catch(function (e) {
      var m = String(e && e.message); st.ncOk = false;
      st.ncMsg = /EMAIL_EXISTS/.test(m) ? "Ese correo ya tiene cuenta." : (/WEAK_PASSWORD/.test(m) ? "Contraseña muy débil." : (/INVALID_EMAIL/.test(m) ? "Correo no válido." : (/^PERFIL_/.test(m) ? "La cuenta se creó pero falló el perfil (" + m + ")." : "No se pudo crear: " + m)));
      pintar();
    });
  }
  function crearPrueba() {
    var n = ((st.usuarios || []).filter(function (u) { return /^Prueba \d+/.test(u.nombre); }).length) + 1, r = Math.random().toString(36).slice(2, 8);
    crearCuenta({ nombre: "Prueba " + n, email: "prueba" + n + "." + r + "@prueba.litlejacob.trade", pass: "Prueba-" + r + "9", wsp: "+51900000000", trade: "", cred: "100" });
  }
  // Ficha: pedidos y rifas del usuario
  function cargarFicha(uid) {
    if (st.pedU[uid] !== undefined) return;
    st.pedU[uid] = "cargando";
    Promise.all([consulta("orders", "uid", uid, 200).catch(function () { return null; }), consulta("rayas_part", "uid", uid, 200).catch(function () { return []; })]).then(function (r) {
      var n = 0, total = 0, ult = "", listaP = [];
      if (r[0]) r[0].forEach(function (d) { var f = d.fields || {}, m = Number(f.creditos && (f.creditos.integerValue || f.creditos.doubleValue) || 0), t = f.createdAt && f.createdAt.timestampValue || ""; if (m > 0) { n++; total += m; if (t > ult) ult = t; } var pp = leerPedidoDoc(d); pp.tienda = f.tienda && f.tienda.stringValue || ""; pp.origen = f.origen && f.origen.stringValue || ""; listaP.push(pp); });
      listaP.sort(function (a, b) { return (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0); });
      var premios = (st.estado && st.estado.premios) || [];
      var rifas = r[1].map(function (d) {
        var f = d.fields || {}, pid = f.premio && f.premio.stringValue || "", pr = premios.filter(function (p) { return p.id === pid; })[0];
        var cant = Math.max(1, Number(f.cantidad && f.cantidad.integerValue || 1)), costo = Number(f.costo && (f.costo.integerValue || f.costo.doubleValue) || 0);
        return esc(pr ? pr.nombre : (f.premioNombre && f.premioNombre.stringValue || pid)) + " · " + cant + (cant === 1 ? " ticket" : " tickets") + " · " + costo + " soles · " + esc(fechaHora(f.creado && f.creado.timestampValue)) + (pr && pr.ganadorUid === uid ? " · <b>🏆 ganador</b>" : "");
      });
      st.pedU[uid] = { ped: r[0] ? { n: n, total: Math.round(total * 100) / 100, ult: ult } : null, rifas: rifas, lista: listaP };
      pintar();
    });
  }
  // ---------- Informe de compras del cliente (página aparte) ----------
  function infFotoUrl(i) {
    var it = window.ljItems && window.ljItems.itemDe ? window.ljItems.itemDe(i.id, i.nombre) : null;
    if (!it || !it.img || /^fs:/.test(it.img)) return "";
    try { return new URL(it.img, location.href).href; } catch (e) { return ""; }
  }
  function informeHtml(u, lista) {
    var EST = { pagado: ["Por entregar", "#ffc93c"], cooldown: ["En cooldown", "#7fb8ff"], entregado: ["Entregado", "#41d98f"], cancelado: ["Cancelado", "#8b9097"], pendiente: ["Pendiente", "#ffc93c"], confirmado: ["Confirmado", "#7fb8ff"] };
    var vivos = lista.filter(function (p) { return p.estado !== "cancelado"; });
    var gastado = vivos.reduce(function (a, p) { return a + (Number(p.total) || 0); }, 0);
    var nItems = vivos.reduce(function (a, p) { return a + p.items.reduce(function (b, i) { return b + (Number(i.qty) || 1); }, 0); }, 0);
    var prim = lista.length ? lista[lista.length - 1].fecha : null, ult = lista.length ? lista[0].fecha : null;
    function chip(est) { var e = EST[est] || [est, "#8b9097"]; return '<span class="chip" style="color:' + e[1] + ';border-color:' + e[1] + '55;background:' + e[1] + '1a">' + esc(e[0]) + '</span>'; }
    var filas = lista.map(function (p) {
      var its = p.items.map(function (i) {
        var f = infFotoUrl(i);
        return '<div class="it">' + (f ? '<img src="' + esc(f) + '" alt="" loading="lazy">' : '<span class="nofo">🎁</span>') + '<span class="itn">' + esc(i.nombre) + '</span><span class="itq">×' + (Number(i.qty) || 1) + '</span><span class="itp">' + fmtPrecio((Number(i.precio) || 0) * (Number(i.qty) || 1)) + '</span></div>';
      }).join("");
      var origen = p.origen === "manual" ? "Pedido manual" : (p.origen && p.origen !== "items" ? "Sets Caché" : "Items");
      return '<section class="ped' + (p.estado === "cancelado" ? ' can' : '') + '"><header><div><b>' + esc(p.code) + '</b><small>' + esc(p.fecha ? p.fecha.toLocaleString("es-PE") : "—") + ' · ' + esc(origen) + (p.tienda ? ' · ' + esc(p.tienda === "rayas" ? "Rayas Store" : "LitleJacob Store") : '') + '</small></div>' + chip(p.estado) + '<b class="tot">' + fmtPrecio(p.total) + '</b></header>' + (its || '<p class="sin">Sin detalle de items.</p>') + '</section>';
    }).join("");
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Informe de compras · ' + esc(u ? u.nombre : "Cliente") + ' · LitleJacob Store</title><style>' +
      ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#121114;color:#eef0f3;padding:28px 18px 60px}' +
      '.caja{max-width:860px;margin:0 auto}h1{font-size:22px;margin:0}h1 b{color:#ff5a63}.sub{color:#8b9097;margin:4px 0 20px;font-size:13px}' +
      '.cli{display:flex;flex-wrap:wrap;gap:8px 22px;border:1px solid #3d3f45;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,.04);margin-bottom:14px;font-size:14px}.cli span{color:#8b9097}.cli b{font-weight:700}' +
      '.res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:22px}.res div{border:1px solid #3d3f45;border-radius:13px;padding:11px 13px;background:rgba(255,255,255,.05)}.res small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8b9097}.res b{font-size:20px}.res .acc b{color:#ff5a63}' +
      '.ped{border:1px solid #3d3f45;border-radius:14px;background:rgba(255,255,255,.03);margin-bottom:12px;overflow:hidden}.ped.can{opacity:.55}' +
      '.ped header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #2a2b30}.ped header small{display:block;color:#8b9097}.ped header .tot{margin-left:auto;color:#ff5a63}' +
      '.chip{padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:800;border:1px solid}' +
      '.it{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px dashed #2a2b30}.it:last-child{border-bottom:0}' +
      '.it img,.nofo{width:52px;height:35px;border-radius:6px;object-fit:cover;background:rgba(0,0,0,.4);flex:none;display:inline-flex;align-items:center;justify-content:center}' +
      '.itn{flex:1;min-width:0}.itq{color:#8b9097}.itp{font-variant-numeric:tabular-nums}.sin{color:#8b9097;padding:10px 16px;margin:0}' +
      '.pie{color:#8b9097;font-size:12px;margin-top:24px;text-align:center}@media print{body{background:#fff;color:#111}}' +
      '</style></head><body><div class="caja">' +
      '<h1><b>LITLEJACOB STORE</b> · Informe de compras</h1><p class="sub">Generado el ' + esc(new Date().toLocaleString("es-PE")) + '</p>' +
      (u ? '<div class="cli"><b>' + esc(u.nombre || "(sin nombre)") + '</b>' +
        (u.email ? '<span>✉ ' + esc(u.email) + '</span>' : '') +
        (u.whatsapp ? '<span>📱 ' + esc(u.whatsapp) + '</span>' : '') +
        (u.steam ? '<span>Steam: ' + esc(u.steam) + '</span>' : '') +
        '<span>Saldo actual: <b style="color:#41d98f">S/ ' + esc(fmtSol(u.creditos)) + '</b></span></div>' : '') +
      '<div class="res"><div><small>Compras</small><b>' + vivos.length + '</b></div><div class="acc"><small>Total gastado</small><b>' + fmtPrecio(gastado) + '</b></div><div><small>Items comprados</small><b>' + nItems + '</b></div><div><small>Primera compra</small><b style="font-size:14px">' + esc(prim ? prim.toLocaleDateString("es-PE") : "—") + '</b></div><div><small>Última compra</small><b style="font-size:14px">' + esc(ult ? ult.toLocaleDateString("es-PE") : "—") + '</b></div></div>' +
      (filas || '<p class="sin">Este cliente todavía no tiene compras.</p>') +
      '<p class="pie">LitleJacob Store · litlejacob.trade · Informe para uso del administrador</p></div></body></html>';
  }
  function abrirInforme(uid) {
    var u = usuarioPorUid(uid);
    var d = st.pedU[uid];
    var lista = d && d !== "cargando" && d.lista ? d.lista : (st.pedidos || []).filter(function (p) { return p.uid === uid; });
    var html = informeHtml(u, lista);
    var url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function fichaHtml(uid) {
    var u = usuarioPorUid(uid), id = esc(uid);
    if (!u) return "";
    if (st.editU === uid) {
      return '<div class="pa-ficha"><h4>Editar datos de ' + esc(u.nombre) + '</h4>' +
        '<div class="pa-field"><label for="pa-eu-nombre">Nombre</label><input id="pa-eu-nombre" maxlength="40" value="' + esc(u.nombre) + '"></div>' +
        '<div class="pa-field"><label for="pa-eu-wa">WhatsApp</label><input id="pa-eu-wa" inputmode="tel" value="' + esc(u.whatsapp) + '"></div>' +
        '<div class="pa-field"><label for="pa-eu-trade">Trade link de Steam</label><input id="pa-eu-trade" inputmode="url" value="' + esc(u.tradelink) + '"></div>' +
        (st.uMsg ? '<p class="pa-hint err">' + esc(st.uMsg) + '</p>' : '') +
        '<div class="pa-acc"><button class="pa-btn rojo sm" type="button" data-pa="guardarU" data-uid="' + id + '">Guardar</button><button class="pa-btn ghost sm" type="button" data-pa="cancelarU">Cancelar</button></div></div>';
    }
    if (!st.estado) cargarEstado();
    cargarFicha(uid);
    var fx = st.pedU[uid], ped = fx === "cargando" ? "Cargando…" : (!fx || !fx.ped ? "No se pudo leer (revisa permisos)" : fx.ped.n + (fx.ped.n === 1 ? " pedido" : " pedidos") + (fx.ped.n ? " · S/ " + fx.ped.total + " gastados · última compra " + esc(fechaHora(fx.ped.ult) || "—") : ""));
    var rifas = fx && fx !== "cargando" ? fx.rifas : [];
    return '<div class="pa-ficha"><div class="pa-fhead">' + avatarUsuario(u, true) + '<div class="pa-fnom"><b>' + esc(u.nombre || "(sin nombre)") + '</b>' +
      (u.steamPais ? '<small>📍 ' + esc(u.steamPais) + '</small>' : '') + (urlSteamOk(u.steamPerfilUrl) ? '<a href="' + esc(u.steamPerfilUrl) + '" target="_blank" rel="noopener noreferrer">Ver perfil de Steam ↗</a>' : '') + '</div>' +
      '<span class="pa-fcred">◆ ' + fmtSol(u.creditos) + ' soles</span></div>' +
      (u.steamPublico === false ? '<p class="pa-hint">🔒 Perfil de Steam privado: no se puede ver su inventario ni verificar la entrega de antemano.</p>' : '') +
      '<div class="pa-frow"><span>Pedidos</span><div>' + ped + (fx && fx !== "cargando" && fx.ped && fx.ped.n ? ' <button class="pa-ico wide" type="button" data-pa="informe" data-uid="' + id + '">🧾 Ver informe detallado</button>' : '') + '</div></div>' +
      '<div class="pa-frow"><span>WhatsApp</span><div>' + (soloDigitos(u.whatsapp) ? '<a href="https://wa.me/' + esc(waNum(u.whatsapp)) + '" target="_blank" rel="noopener">' + esc(u.whatsapp) + ' ↗</a>' : '—') + '</div></div>' +
      '<div class="pa-frow"><span>Correo</span><div><a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a></div></div>' +
      '<div class="pa-frow"><span>Trade link</span><div>' + (tradeValido(u.tradelink) ? '<a href="' + esc(u.tradelink) + '" target="_blank" rel="noopener">Abrir en Steam ↗</a> <button class="pa-ico txt" type="button" data-pa="copiar" data-txt="' + esc(u.tradelink) + '">' + (u.copiado && Date.now() - u.copiado < 3000 ? "✔ Copiado" : "Copiar") + '</button>' : '<span class="pa-warn">Sin trade link</span>') + '</div></div>' +
      (u.steam ? '<div class="pa-frow"><span>ID de Steam</span><div>' + esc(u.steam) + '</div></div>' : '') +
      (u.steamId && u.steamId !== u.steam ? '<div class="pa-frow"><span>SteamID64</span><div>' + esc(u.steamId) + '</div></div>' : '') +
      '<div class="pa-frow"><span>Registro</span><div>' + (u.creado ? esc(fechaHora(u.creado)) : "—") + '</div></div>' +
      '<div class="pa-frow"><span>Rifas</span><div>' + (fx === "cargando" ? "Cargando…" : rifas.length ? '<ul class="pa-frifas">' + rifas.map(function (x) { return '<li>' + x + '</li>'; }).join("") + '</ul>' : "Ninguna todavía") + '</div></div>' +
      '<div class="pa-acc"><button class="pa-btn rojo sm" type="button" data-pa="editU" data-uid="' + id + '">✎ Editar datos</button></div></div>';
  }
  function tabUsuarios() {
    if (st.usuarios === null) { cargarUsuarios(); return '<p class="pa-hint">Cargando usuarios…</p>'; }
    var sub = st.subU === "crear" ? "crear" : "lista";
    var subtabs = '<div class="pa-sub" role="tablist"><button type="button" role="tab" data-pa="subU" data-s="lista" aria-selected="' + (sub === "lista") + '">👥 Usuarios (' + st.usuarios.length + ')</button>' +
      '<button type="button" role="tab" data-pa="subU" data-s="crear" aria-selected="' + (sub === "crear") + '">➕ Crear cuenta</button></div>';
    if (sub === "crear") {
      var nc = st.nc || {};
      return subtabs + '<div class="pa-grp"><h3>Crear cuenta nueva</h3>' +
        '<div class="pa-field"><label for="pa-nc-nombre">Nombre</label><input id="pa-nc-nombre" maxlength="60" value="' + esc(nc.nombre) + '"></div>' +
        '<div class="pa-field"><label for="pa-nc-email">Correo</label><input id="pa-nc-email" type="email" autocomplete="off" value="' + esc(nc.email) + '"></div>' +
        '<div class="pa-field"><label for="pa-nc-pass">Contraseña (mínimo 6)</label><input id="pa-nc-pass" type="text" autocomplete="off" value="' + esc(nc.pass) + '"></div>' +
        '<div class="pa-field"><label for="pa-nc-wsp">WhatsApp</label><input id="pa-nc-wsp" inputmode="tel" placeholder="+51..." value="' + esc(nc.wsp) + '"></div>' +
        '<div class="pa-field"><label for="pa-nc-trade">Trade link de Steam (opcional)</label><input id="pa-nc-trade" value="' + esc(nc.trade) + '"></div>' +
        '<div class="pa-field"><label for="pa-nc-cred">Saldo inicial (S/)</label><input id="pa-nc-cred" type="number" min="0" step="1" value="' + esc(nc.cred || "0") + '"></div>' +
        '<div class="pa-acc"><button class="pa-btn rojo" type="button" data-pa="crearCuenta">+ Crear cuenta</button><button class="pa-btn ghost" type="button" data-pa="crearPrueba">🧪 Crear cuenta de prueba</button></div>' +
        (st.ncMsg ? '<p class="pa-hint ' + (st.ncOk ? 'ok' : 'err') + '">' + esc(st.ncMsg) + '</p>' : '') +
        '<p class="pa-hint">Pásale al usuario su correo y contraseña. Luego puede cambiarla con "¿Olvidaste tu contraseña?".</p></div>';
    }
    var f = st.uFiltro.trim().toLowerCase();
    var lista = st.usuarios.filter(function (u) { return !f || (u.nombre + " " + u.email + " " + u.whatsapp + " " + u.tradelink + " " + u.steam).toLowerCase().indexOf(f) >= 0; });
    var _tot = 0, _con = 0;
    st.usuarios.forEach(function (u) { var c = Number(u.creditos) || 0; _tot += c; if (c > 0) _con++; });
    var statsU = '<div class="adm-stats">' +
      '<div class="adm-stat"><small>Usuarios</small><b>' + st.usuarios.length + '</b></div>' +
      '<div class="adm-stat acc"><small>Saldo total</small><b>S/ ' + esc((_tot % 1 ? (Math.round(_tot * 100) / 100).toFixed(2) : _tot)) + '</b></div>' +
      '<div class="adm-stat"><small>Con saldo</small><b>' + _con + '</b></div></div>';
    return subtabs + statsU + '<div class="pa-grp"><h3>Lista de usuarios</h3>' +
      '<div class="pa-field"><label for="pa-u-buscar">Buscar</label><input id="pa-u-buscar" placeholder="Nombre, Steam, correo o WhatsApp" value="' + esc(st.uFiltro) + '" autocomplete="off"></div>' +
      (st.uMsg && !st.editU ? '<p class="pa-hint err">' + esc(st.uMsg) + '</p>' : '') +
      '<div class="pa-ulist">' + (lista.length ? lista.map(function (u) {
        var id = esc(u.uid), ab = st.uAbierto === u.uid;
        var cab = '<button type="button" class="pa-urow-h" data-pa="uAbrir" data-uid="' + id + '" aria-expanded="' + ab + '">' + avatarUsuario(u) + '<b>' + esc(u.nombre || "(sin nombre)") + '</b><span class="pa-usal' + ((Number(u.creditos) || 0) > 0 ? '' : ' cero') + '">S/ ' + fmtSol(u.creditos) + '</span><i>' + (ab ? "▴" : "▾") + '</i></button>';
        if (!ab) return '<div class="pa-urow">' + cab + '</div>';
        return '<div class="pa-urow open">' + cab + '<div class="pa-ut"><span>WhatsApp: ' + esc(u.whatsapp || "—") + '</span><span>' + esc(u.email) + '</span>' +
          (tradeValido(u.tradelink) ? '<span><a href="' + esc(u.tradelink) + '" target="_blank" rel="noopener">Abrir trade link ↗</a></span>' : '<span class="pa-warn">Sin trade link</span>') + '</div>' +
          '<div class="pa-ucred"><button class="pa-ico" type="button" data-pa="cred" data-uid="' + id + '" data-d="-1" aria-label="Quitar S/ 1">−</button>' +
          '<input class="pa-credset" data-uid="' + id + '" type="number" min="0" step="0.01" inputmode="decimal" value="' + u.creditos + '" aria-label="Saldo de ' + esc(u.nombre) + '">' +
          '<button class="pa-ico" type="button" data-pa="cred" data-uid="' + id + '" data-d="1" aria-label="Sumar S/ 1">+</button>' +
          '<button class="pa-ico txt" type="button" data-pa="cred" data-uid="' + id + '" data-d="5">+5</button><button class="pa-ico txt" type="button" data-pa="cred" data-uid="' + id + '" data-d="10">+10</button>' +
          '<span class="pa-usave">' + (u.guardando ? "Guardando…" : (u.ok && Date.now() - u.ok < 4000 ? "✔ Guardado" : "")) + '</span></div>' +
          '<div class="pa-acc"><button type="button" class="pa-btn rojo sm" data-pa="editU" data-uid="' + id + '">✎ Editar datos</button>' +
          (u.uid === ADMIN_UID ? '' : (st.delU === u.uid
            ? '<span class="pa-hint err">¿Eliminar a <b>' + esc(u.nombre || u.email) + '</b> y sus participaciones?</span><button class="pa-btn ghost sm" type="button" data-pa="delUSi" data-uid="' + id + '">Sí, eliminar</button><button class="pa-btn ghost sm" type="button" data-pa="delUNo">No</button>'
            : '<button type="button" class="pa-btn ghost sm" data-pa="delU" data-uid="' + id + '">🗑 Eliminar cuenta</button>')) + '</div>' +
          '<button type="button" class="pa-mas" data-pa="verFicha" data-uid="' + id + '"><span>' + (st.fichaU === u.uid ? "Ocultar ficha" : "Ver ficha completa") + '</span><i>' + (st.fichaU === u.uid ? "▴" : "▾") + '</i></button>' +
          (st.fichaU === u.uid ? fichaHtml(u.uid) : '') + '</div>';
      }).join("") : '<p class="pa-hint">' + (f ? "Nadie coincide con la búsqueda." : "Todavía nadie se ha registrado.") + '</p>') + '</div>' +
      '<p class="pa-hint">El saldo se guarda al instante (no hace falta publicar).</p>' +
      '<button class="pa-btn ghost ancho" type="button" data-pa="recargarU">Actualizar lista</button></div>';
  }

  /* ---------- Pedidos de items ---------- */
  function leerPedidoDoc(d) {
    var f = d.fields || {}, sv = function (k) { return f[k] && f[k].stringValue || ""; }, nv = function (k) { var x = f[k]; return x ? Number(x.doubleValue !== undefined ? x.doubleValue : x.integerValue || 0) : 0; };
    var its = ((f.items && f.items.arrayValue && f.items.arrayValue.values) || []).map(function (v) {
      var m = (v.mapValue && v.mapValue.fields) || {};
      return { id: m.id && m.id.stringValue || "", nombre: m.name && m.name.stringValue || "Item", qty: Number(m.qty && (m.qty.integerValue || m.qty.doubleValue) || 1), precio: Number(m.price && (m.price.doubleValue !== undefined ? m.price.doubleValue : m.price.integerValue) || 0) };
    });
    return { id: d.name.split("/").pop(), code: sv("code") || d.name.split("/").pop(), cliente: sv("customerName"), steam: sv("steamId"), email: sv("email"), tradelink: sv("tradelink"),
      whatsapp: sv("phone"), uid: sv("uid"), correoAdmin: !!(f.correoAdmin && f.correoAdmin.booleanValue), correoCliente: !!(f.correoCliente && f.correoCliente.booleanValue), correoError: sv("correoError"),
      estado: sv("status") || "pagado", tienda: sv("tienda"), total: nv("total"), creditos: nv("creditos"), items: its, fecha: f.createdAt && f.createdAt.timestampValue ? new Date(f.createdAt.timestampValue) : null,
      entregaDesde: f.entregaDesde && f.entregaDesde.timestampValue || "", liberadoEn: f.liberadoEn && f.liberadoEn.timestampValue || "",
      correoLiberadoAdmin: !!(f.correoLiberadoAdmin && f.correoLiberadoAdmin.booleanValue), correoLiberadoCliente: !!(f.correoLiberadoCliente && f.correoLiberadoCliente.booleanValue), bot: leerBot(f.bot) };
  }
  /* ---------- Bot de Steam (entrega automática, solo lo que apruebas) ---------- */
  var BOT_EST = { aprobado: "⏳ En cola del bot", enviando: "📤 Enviando oferta…", enviada: "📨 Oferta enviada", aceptada: "✅ Aceptada por el cliente", fallida: "✖ El bot no pudo", retenida: "⏸ Retenida por Steam", cancelar: "🚫 Cancelando…", cancelada: "🚫 Cancelada" };
  function leerBot(v) {
    var m = v && v.mapValue && v.mapValue.fields; if (!m) return null;
    var sv = function (k) { return m[k] && m[k].stringValue || ""; };
    return { estado: sv("estado"), motivo: sv("motivo"), ofertaId: sv("ofertaId") };
  }
  function botVivo(p) { return !!(p.bot && /^(aprobado|enviando|enviada|cancelar|retenida)$/.test(p.bot.estado)); }
  function cargarBotEstado() {
    if (st.cargandoBot) return; st.cargandoBot = true;
    fs("bot_estado/steam").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) {
      var f = d.fields || {}, t = f.ultimaVez && f.ultimaVez.timestampValue ? new Date(f.ultimaVez.timestampValue).getTime() : 0;
      st.botEst = { enLinea: !!(f.enLinea && f.enLinea.booleanValue) && Date.now() - t < 3 * 60000, hace: t, items: Number(f.items && f.items.integerValue || -1), aviso: f.aviso && f.aviso.stringValue || "" };
    }).catch(function () { st.botEst = { enLinea: false, hace: 0, items: -1, aviso: "", nunca: true }; })
      .then(function () { st.cargandoBot = false; pintar(); });
  }
  function botLineaHtml() {
    if (!st.botEst) { cargarBotEstado(); return '<p class="pa-hint">🤖 Revisando el bot…</p>'; }
    var b = st.botEst;
    if (b.enLinea) return '<p class="pa-hint">🟢 <b>Bot de Steam en línea</b>' + (b.items >= 0 ? ' · ' + b.items + ' items para entregar' : '') + (b.aviso ? '<br><span class="pa-warn">' + esc(b.aviso) + '</span>' : '') + '</p>';
    return '<p class="pa-hint">🔴 <b>Bot de Steam apagado</b>' + (b.hace ? ' (última señal: ' + esc(fechaHora(b.hace)) + ')' : b.nunca ? ' (todavía no se ha conectado)' : '') + '. Puedes aprobar envíos igual: saldrán cuando se prenda.</p>';
  }
  function botPedidoHtml(p) {
    if (p.estado !== "pagado" && !(p.bot && p.bot.estado)) return "";
    var b = p.bot || {}, est = b.estado || "", h = '<div class="pa-field"><label>🤖 Bot de Steam</label>';
    if (est) h += '<p class="pa-hint"><b>' + esc(BOT_EST[est] || est) + '</b>' + (b.ofertaId ? ' · oferta #' + esc(b.ofertaId) : '') + (b.motivo ? '<br>' + esc(b.motivo) : '') + '</p>';
    var puedeEnviar = p.estado === "pagado" && (!est || est === "fallida" || est === "cancelada");
    if (puedeEnviar) h += tradeValido(p.tradelink) ? '<button type="button" class="pa-btn rojo" data-pa="botEnviar" data-id="' + esc(p.id) + '">' + (est ? "🔁 Reintentar con el bot" : "🤖 Enviar con el bot") + '</button><p class="pa-hint">El bot le manda la oferta a su trade link y, cuando acepte, el pedido pasa solo a Entregado.</p>' : '<p class="pa-hint pa-warn">Para usar el bot, el cliente necesita un trade link válido.</p>';
    if (est === "aprobado" || est === "enviada") h += '<button type="button" class="pa-btn ghost" data-pa="botCancelar" data-id="' + esc(p.id) + '">' + (est === "enviada" ? "Cancelar la oferta" : "Sacar de la cola") + '</button>';
    return h + '</div>';
  }
  function botAccion(id, accion) {
    var p = (st.pedidos || []).filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var antes = p.bot, campos = { estado: { stringValue: accion }, motivo: { stringValue: accion === "aprobado" ? "Aprobado desde el panel." : "Cancelación pedida desde el panel." } };
    var mask = ["bot.estado", "bot.motivo"];
    if (accion === "aprobado") { campos.aprobadoEn = { timestampValue: new Date().toISOString() }; mask.push("bot.aprobadoEn", "bot.ofertaId", "bot.assetids"); }
    p.bot = { estado: accion, motivo: campos.motivo.stringValue, ofertaId: accion === "aprobado" ? "" : (antes && antes.ofertaId) || "" }; pintar();
    fs("orders/" + encodeURIComponent(id) + "?" + mask.map(function (m) { return "updateMask.fieldPaths=" + encodeURIComponent(m); }).join("&"), {
      method: "PATCH", body: JSON.stringify({ fields: { bot: { mapValue: { fields: campos } } } })
    }).then(function (r) { if (!r.ok) throw new Error("Error " + r.status); vigilarBot(); })
      .catch(function (e) { p.bot = antes; st.pedMsg = "No se guardó: " + e.message; pintar(); });
  }
  // Mientras haya envíos en curso, refresca la lista cada 10 s para ver cómo avanzan.
  function vigilarBot() {
    clearTimeout(st.botTimer);
    st.botTimer = setTimeout(function () {
      if (!st.abierto || st.tab !== "pedidos" || !(st.pedidos || []).some(botVivo)) return;
      st.botEst = null; cargarPedidos(); vigilarBot();
    }, 10000);
  }
  function cargarPedidos() {
    if (st.cargandoP) return; st.cargandoP = true; st.pedMsg = "";
    consulta("orders", "origen", "items", 300).then(function (docs) {
      st.pedidos = docs.map(leerPedidoDoc).filter(function (p) { return p.tienda !== "rayas"; }).sort(function (a, b) { return (b.fecha || 0) - (a.fecha || 0); });
      if (st.pedidos.some(botVivo)) vigilarBot();
    }).catch(function (e) { st.pedidos = []; st.pedMsg = e.message; }).then(function () { st.cargandoP = false; pintar(); });
  }
  function cambiarEstadoPedido(id, estado) {
    var p = (st.pedidos || []).filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var antes = p.estado; p.estado = estado; pintar();
    fs("orders/" + encodeURIComponent(id) + "?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt", {
      method: "PATCH", body: JSON.stringify({ fields: { status: { stringValue: estado }, updatedAt: { timestampValue: new Date().toISOString() } } })
    }).then(function (r) { if (!r.ok) throw new Error("Error " + r.status); }).catch(function (e) { p.estado = antes; st.pedMsg = "No se guardó: " + e.message; pintar(); });
  }
  function pedClave(p) { return p.uid || p.steam || (p.cliente || "").toLowerCase(); }
  // Enlace de WhatsApp (agrega 51 si es un celular peruano de 9 dígitos).
  function waLink(tel) {
    var d = String(tel || "").replace(/\D/g, "");
    if (d.length === 9 && d.charAt(0) === "9") d = "51" + d;
    return d.length >= 10 && d.length <= 15 ? "https://wa.me/" + d : "";
  }
  function waHtml(tel) {
    var u = waLink(tel);
    return u ? '<a href="' + u + '" target="_blank" rel="noopener" title="Escribirle por WhatsApp">' + esc(tel) + ' ↗</a>' : esc(tel || "—");
  }
  // Línea de item del pedido: foto + nombre con enlace a su página (como se vende).
  function pedItemHtml(i, mini) {
    var r = window.ljItems && window.ljItems.porPedido ? window.ljItems.porPedido(i.id, i.nombre) : null;
    var tn = esc(i.qty + " × " + i.nombre);
    return '<span class="ped-it' + (mini ? ' mini' : '') + '"><span class="ped-fo">' + (r && r.img || "🎁") + '</span>' +
      (r ? '<a class="ped-ln" href="' + r.href + '" target="_blank" rel="noopener" title="Ver el item como se vende ↗">' + tn + ' ↗</a>' : '<span class="ped-ln">' + tn + '</span>') + '</span>';
  }
  function historialHtml(p) {
    var k = pedClave(p), todos = (st.pedidos || []).filter(function (x) { return pedClave(x) === k; }), vivos = todos.filter(function (x) { return x.estado !== "cancelado"; });
    var gastado = vivos.reduce(function (a, x) { return a + x.total; }, 0);
    return '<div class="pa-hist"><b>📜 Historial de compras de este cliente</b>' + (p.uid ? '<button class="pa-ico wide" type="button" data-pa="informe" data-uid="' + esc(p.uid) + '">🧾 Informe completo</button>' : '') + '<small>' + vivos.length + (vivos.length === 1 ? ' compra' : ' compras') + ' · ' + fmtPrecio(gastado) + ' en total</small>' +
      todos.map(function (x) {
        var est = (PED_ESTADOS.filter(function (e) { return e[0] === x.estado; })[0] || [0, x.estado])[1], its = x.items.map(function (i) { return pedItemHtml(i, true); }).join("");
        return '<div class="pa-histr' + (x.id === p.id ? ' cur' : '') + '"><span>' + esc(x.fecha ? x.fecha.toLocaleDateString("es-PE") : "") + ' · <b>' + esc(x.code) + '</b></span><span class="hist-its">' + its + '</span><span>' + fmtPrecio(x.total) + ' · ' + esc(est) + '</span></div>';
      }).join("") + '</div>';
  }
  function tabPedidos() {
    if (st.pedidos === null) { cargarPedidos(); return '<p class="pa-hint">Cargando pedidos…</p>'; }
    var fl = st.pedFiltro || "pagado", todos = st.pedidos;
    var cuenta = function (k) { return todos.filter(function (p) { return k === "todos" || p.estado === k; }).length; };
    var chips = [["pagado", "💰 Por entregar"], ["cooldown", "🔒 En cooldown"], ["entregado", "✅ Entregados"], ["cancelado", "✖ Cancelados"], ["todos", "Todos"]].map(function (c) {
      return '<button type="button" role="tab" data-pa="pedFiltro" data-f="' + c[0] + '" aria-selected="' + (fl === c[0]) + '">' + c[1] + ' (' + cuenta(c[0]) + ')</button>'; }).join("");
    var lista = todos.filter(function (p) { return fl === "todos" || p.estado === fl; });
    var fb = (st.pedBusca || "").trim().toLowerCase();
    if (fb) lista = lista.filter(function (p) { return ((p.cliente || "") + " " + p.code + " " + (p.steam || "") + " " + (p.whatsapp || "") + " " + p.items.map(function (i) { return i.nombre; }).join(" ")).toLowerCase().indexOf(fb) >= 0; });
    return '<div class="pa-sub chips" role="tablist">' + chips + '</div><div class="pa-grp"><h3>Pedidos de items (' + lista.length + ')</h3>' +
      '<div class="pa-field"><label for="pa-ped-buscar">Buscar</label><input id="pa-ped-buscar" placeholder="Cliente, código, item, Steam o WhatsApp" value="' + esc(st.pedBusca || "") + '" autocomplete="off"></div>' +
      '<p class="pa-hint">Los pedidos de Sets Caché siguen en la barra de <b>Sets Caché</b> → Pedidos.</p>' + botLineaHtml() +
      (st.pedMsg ? '<p class="pa-hint err">' + esc(st.pedMsg) + '</p>' : '') +
      '<div class="pa-ulist">' + (lista.length ? lista.map(function (p) {
        var ab = st.pedAbierto === p.id, n = p.items.reduce(function (a, i) { return a + i.qty; }, 0);
        var estTx = (PED_ESTADOS.filter(function (e) { return e[0] === p.estado; })[0] || [0, p.estado])[1];
        var cab = '<button type="button" class="pa-urow-h" data-pa="pedAbrir" data-id="' + esc(p.id) + '" aria-expanded="' + ab + '"><b>' + esc(p.cliente || "Sin nombre") + ' · ' + n + (n === 1 ? ' item' : ' items') + (p.estado === "cooldown" ? ' <small class="pedcd">🔒 entregar el ' + esc(fechaCorta(p.entregaDesde)) + '</small>' : '') + '</b><small class="ped-est e-' + esc(p.estado) + '">' + esc(estTx) + (p.bot && p.bot.estado ? ' · ' + esc((BOT_EST[p.bot.estado] || "").split(" ")[0]) : '') + '</small><span class="pa-usal">' + fmtPrecio(p.total) + '</span><i>' + (ab ? "▴" : "▾") + '</i></button>';
        if (!ab) return '<div class="pa-urow">' + cab + '</div>';
        return '<div class="pa-urow open">' + cab + '<div class="pa-ut"><span>Pedido <b>' + esc(p.code) + '</b> · ' + (p.fecha ? esc(p.fecha.toLocaleString("es-PE")) : "") + '</span>' +
          p.items.map(function (i) { return '<span class="ped-row">' + pedItemHtml(i) + '<b class="ped-pr">' + fmtPrecio(i.precio * i.qty) + '</b></span>'; }).join("") +
          '<span>ID de Steam: ' + esc(p.steam || "—") + '</span><span>WhatsApp: ' + waHtml(p.whatsapp) + '</span><span>' + esc(p.email) + '</span>' +
          (tradeValido(p.tradelink) ? '<span><a href="' + esc(p.tradelink) + '" target="_blank" rel="noopener">Abrir trade link ↗</a></span>' : '<span class="pa-warn">Sin trade link</span>') +
          '<span>Pagado con saldo: ' + fmtPrecio(p.creditos) + '</span>' +
          (p.entregaDesde ? '<span class="pedcd-l">🔒 ' + (p.estado === "cooldown" ? 'En cooldown de Steam: <b>no lo entregues todavía</b>. Se libera el <b>' + esc(fechaEntrega(p.entregaDesde)) + '</b>' + (cdRestante(p.entregaDesde) ? ' (faltan ' + esc(cdRestante(p.entregaDesde)) + ')' : ' (ya pasó: en la próxima hora pasa solo a Por entregar)') : 'Estuvo en cooldown hasta el ' + esc(fechaEntrega(p.entregaDesde)) + (p.liberadoEn ? ' · liberado y avisado por correo' : '')) + '</span>' : '') +
          '<span>✉ Correo a ti: ' + (p.correoAdmin ? '✔ enviado' : '✖ no enviado') + ' · Correo al cliente: ' + (p.correoCliente ? '✔ enviado' : '✖ no enviado') + (p.liberadoEn ? ' · Aviso de liberación: ' + (p.correoLiberadoAdmin ? '✔ a ti' : '✖ a ti') + ' / ' + (p.correoLiberadoCliente ? '✔ al cliente' : '✖ al cliente') : '') + '</span>' +
          (p.correoError ? '<span class="pa-warn">Motivo: ' + esc(p.correoError) + '</span>' : '') + '</div>' + botPedidoHtml(p) + historialHtml(p) +
          '<div class="pa-field"><label for="pa-pe-' + esc(p.id) + '">Estado</label><select id="pa-pe-' + esc(p.id) + '" class="pa-pedEstado" data-id="' + esc(p.id) + '">' + PED_ESTADOS.map(function (e) { return '<option value="' + e[0] + '"' + (p.estado === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join("") + '</select></div>' +
          (p.estado === "cancelado" ? '<p class="pa-hint">Cancelar no devuelve el saldo solo: súmalo en Usuarios y saldo.</p>' : '') + (p.estado === "cooldown" ? '<p class="pa-hint">Cuando el item se libere, el pedido pasa solo a <b>Por entregar</b> y les llega un correo a ti y al cliente.</p>' : '') + '</div>';
      }).join("") : '<p class="pa-hint">No hay pedidos aquí. Cuando alguien compre un item aparecerá y te llegará un correo.</p>') + '</div>' +
      '<button class="pa-btn ghost ancho" type="button" data-pa="pedRecargar">Actualizar lista</button></div>';
  }

  /* ---------- Items y Compras (los dibuja items.js) ---------- */
  function tabItems() { return window.ljItems && window.ljItems.adminLista ? window.ljItems.adminLista() : '<p class="pa-hint">Cargando…</p>'; }
  function tabCompras() { return window.ljItems && window.ljItems.compras ? '<div class="pa-grp">' + window.ljItems.compras().replace('Admin · ', '') + '</div>' : '<p class="pa-hint">Cargando…</p>'; }

  /* ---------- generador de publicaciones (publicador.js se carga solo al usarlo) ---------- */
  function tabPub() {
    return '<div class="pa-grp"><h3>🖼 Generador de publicaciones</h3>' +
      '<p class="pa-hint">Sube la foto in-game del item (y si quieres la oficial de Steam), pon el nombre y los precios, y te arma la <b>imagen de venta 1080×1350</b> con el estilo de LitleJacob más <b>3 textos para WhatsApp</b> listos para copiar. Todo se hace en tu navegador; no se guarda ni se publica nada.</p>' +
      '<div class="pa-acc"><button type="button" class="pa-btn rojo" data-pa="pubAbrir">Abrir generador</button></div>' +
      (st.pubMsg ? '<p class="pa-hint err">' + esc(st.pubMsg) + '</p>' : '') + '</div>';
  }
  function abrirPub() {
    if (!esAdmin()) return;
    var ir = function () { st.pubMsg = ""; cerrar(); window.ljPublicador.abrir(); };
    if (window.ljPublicador) return ir();
    var sc = document.createElement("script"); sc.src = "publicador.js?v=11";
    sc.onload = function () { if (window.ljPublicador) ir(); };
    sc.onerror = function () { st.pubMsg = "No se pudo cargar el generador. Revisa que publicador.js esté subido al repositorio."; pintar(); };
    document.head.appendChild(sc);
  }

  /* ---------- dibujo ---------- */
  function estadoPublicacion() {
    var d = document.getElementById("draftStatus"); return d ? d.textContent.replace(/^[^A-Za-zÁÉÍÓÚáéíóú]+/, "") : "";
  }
  /* ---------- Bot de Steam (módulo compartido bot-panel.js) ---------- */
  function tabBot() {
    return window.BotPanel ? window.BotPanel.html({ token: token, projectId: FB.projectId, repintar: pintar, acento: "#e0313b" })
      : '<p class="pa-hint">Cargando el panel del bot…</p>';
  }
  function pintar() {
    var r = st.raiz; if (!r || !st.abierto) return;
    var sc = seccion(), lista = tabsDe(sc);
    if (lista.indexOf(st.tab) < 0) st.tab = lista[0];
    var nom = sc === "items" ? "Compra y venta de items" : "General";
    var cuerpo = st.tab === "config" ? tabConfig(sc) : st.tab === "usuarios" ? tabUsuarios() : st.tab === "pagina" ? tabPagina() : st.tab === "items" ? tabItems() : st.tab === "bot" ? tabBot() : st.tab === "pedidos" ? tabPedidos() : st.tab === "pub" ? tabPub() : st.tab === "reclamos" ? tabReclamos() : st.tab === "ventas" ? tabVentas() : tabCompras();
    var body = r.querySelector(".pa-body"), top = body ? body.scrollTop : 0, foco = document.activeElement && r.contains(document.activeElement) ? document.activeElement.id : "", sel = foco && document.activeElement.selectionStart;
    var pill = document.getElementById("draftStatus"), pub = estadoPublicacion(), sucio = !!(pill && pill.classList.contains("dirty"));
    r.innerHTML = '<div class="pa-scrim" data-pa="cerrar"></div><aside class="pa-drawer" role="dialog" aria-modal="true" aria-label="Panel de administración">' +
      '<div class="pa-head"><h2>Panel admin · ' + nom + '</h2><div class="pa-head-b"><button class="pa-btn ghost sm peligro" type="button" data-pa="salir">⎋ Cerrar sesión</button><button class="pa-btn ghost sm" type="button" data-pa="cerrar">Cerrar panel</button></div></div>' +
      '<div class="pa-body"><div class="pa-tabs" role="tablist">' + lista.map(function (k) {
        return '<button type="button" role="tab" data-pa="tab" data-t="' + k + '" aria-selected="' + (st.tab === k) + '">' + (k === "config" && sc === "inicio" ? "⚙ Configuraciones principales" : TABS[k]) + '</button>';
      }).join("") + '</div><div class="pa-cnt">' + cuerpo + '</div></div>' +
      '<div class="pa-foot"><button class="pa-btn rojo ancho" type="button" data-pa="proxy" data-id="adminPublishBtn"' + (sucio ? '' : ' disabled') + '>Guardar y publicar</button>' +
      '<div class="pa-pub' + (sucio ? ' pend' : '') + '" role="status">' + esc(sucio ? pub || "Tienes cambios sin publicar." : (pub && !/todo publicado/i.test(pub) ? pub : "Todo está publicado.")) + '</div></div></aside>';
    var nb = r.querySelector(".pa-body"); if (nb && top) nb.scrollTop = top;
    if (foco) { var fe = document.getElementById(foco); if (fe) { fe.focus(); try { if (sel != null) fe.setSelectionRange(sel, sel); } catch (e) { /* nada */ } } }
    try { if (window.ljItems && window.ljItems.hidratar) window.ljItems.hidratar(); } catch (e) { /* nada */ }
  }
  function abrir(tab) {
    if (!esAdmin()) return false;
    montar(); st.abierto = true; if (tab) st.tab = tab;
    st.raiz.hidden = false; document.documentElement.classList.add("ljc-lock");
    pintar(); requestAnimationFrame(function () { st.raiz.classList.add("open"); });
    return true;
  }
  function cerrar() {
    st.abierto = false; if (!st.raiz) return;
    st.raiz.classList.remove("open"); document.documentElement.classList.remove("ljc-lock");
    setTimeout(function () { if (!st.abierto) st.raiz.hidden = true; }, 200);
  }

  /* ---------- eventos ---------- */
  function alClic(e) {
    var t = e.target.closest("[data-pa]"); if (!t) return;
    var a = t.getAttribute("data-pa"), uid = t.getAttribute("data-uid");
    switch (a) {
      case "cerrar": if (t.tagName !== "A") e.preventDefault(); cerrar(); break;
      case "salir": cerrar(); if (window.ljCuenta) window.ljCuenta.salir(); break;
      case "tab": st.tab = t.getAttribute("data-t"); pintar(); var b = st.raiz.querySelector(".pa-body"); if (b) b.scrollTop = 0; break;
      case "proxy": var bt = document.getElementById(t.getAttribute("data-id")); if (bt) { if (t.getAttribute("data-id") !== "adminPublishBtn") cerrar(); bt.click(); setTimeout(pintar, 600); } break;
      case "cfg": guardarCfg(t.getAttribute("data-k")); break;
      case "probarCorreos": probarCorreos(); break;
      case "guardarTextos": guardarTextos(); break;
      case "subU": st.subU = t.getAttribute("data-s"); pintar(); break;
      case "venPer": st.venPer = t.getAttribute("data-p"); pintar(); break;
      case "recFiltro": st.recFiltro = t.getAttribute("data-f"); st.recAbierto = null; pintar(); break;
      case "recAbrir": var rid = t.getAttribute("data-id"); st.recAbierto = st.recAbierto === rid ? null : rid; pintar(); break;
      case "recEstado": recCambiarEstado(t.getAttribute("data-id"), t.getAttribute("data-e")); break;
      case "recRecargar": st.reclamos = null; st.recMsg = ""; pintar(); break;
      case "recTodas": st.recTodas = !!t.checked; pintar(); break;
      case "uAbrir": st.uAbierto = st.uAbierto === uid ? null : uid; st.delU = null; pintar(); break;
      case "cred": var u = usuarioPorUid(uid); if (u && !u.guardando) guardarCreditos(uid, u.creditos + Number(t.getAttribute("data-d"))); break;
      case "editU": st.uAbierto = uid; st.fichaU = uid; st.editU = uid; st.uMsg = ""; pintar(); break;
      case "cancelarU": st.editU = null; st.uMsg = ""; pintar(); break;
      case "guardarU": guardarUsuario(uid); break;
      case "delU": st.delU = uid; pintar(); break;
      case "delUNo": st.delU = null; pintar(); break;
      case "delUSi": eliminarUsuario(uid); break;
      case "verFicha": st.fichaU = st.fichaU === uid ? null : uid; st.editU = null; pintar(); break;
      case "copiar": var uc = usuarioPorUid(st.fichaU); try { navigator.clipboard.writeText(t.getAttribute("data-txt")); } catch (x) { /* nada */ } if (uc) { uc.copiado = Date.now(); pintar(); setTimeout(pintar, 3100); } break;
      case "crearCuenta": crearCuenta(); break;
      case "crearPrueba": crearPrueba(); break;
      case "informe": abrirInforme(t.getAttribute("data-uid")); break;
      case "recargarU": st.usuarios = null; st.pedU = {}; pintar(); break;
      case "pedAbrir": var pid = t.getAttribute("data-id"); st.pedAbierto = st.pedAbierto === pid ? null : pid; pintar(); break;
      case "pedFiltro": st.pedFiltro = t.getAttribute("data-f"); pintar(); break;
      case "pedRecargar": st.pedidos = null; st.botEst = null; pintar(); break;
      case "botEnviar": botAccion(t.getAttribute("data-id"), "aprobado"); break;
      case "botCancelar": botAccion(t.getAttribute("data-id"), "cancelar"); break;
      case "pubAbrir": abrirPub(); break;
    }
  }
  function alCambio(e) {
    var t = e.target;
    if (t.classList.contains("pa-pedEstado")) cambiarEstadoPedido(t.getAttribute("data-id"), t.value);
    else if (t.classList.contains("pa-credset")) guardarCreditos(t.getAttribute("data-uid"), t.value);
  }
  function alEscribir(e) {
    if (e.target.id === "pa-u-buscar") { st.uFiltro = e.target.value; pintar(); }
    if (e.target.id === "pa-ped-buscar") { st.pedBusca = e.target.value; pintar(); }
  }
  function montar() {
    if (st.raiz) return;
    var r = document.createElement("div"); r.id = "ljPanelAdmin"; r.className = "pa"; r.hidden = true; document.body.appendChild(r); st.raiz = r;
    r.addEventListener("click", alClic); r.addEventListener("change", alCambio); r.addEventListener("input", alEscribir);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && st.abierto && !document.querySelector("#itxModal .itx-pop")) cerrar(); });
    window.addEventListener("lj-ruta", function () { if (st.abierto) pintar(); });
    var dr = document.getElementById("draftStatus");
    if (dr && "MutationObserver" in window) new MutationObserver(function () { if (st.abierto) pintar(); }).observe(dr, { childList: true, characterData: true, subtree: true });
  }
  // Botón "⚙ Panel admin" en la barra de abajo (Sets Caché), para abrir el mismo panel desde ahí.
  function botonBarra() {
    var acc = document.querySelector("#adminBar .adm-actions"); if (!acc || document.getElementById("adminPanelBtn")) return;
    var b = document.createElement("button"); b.id = "adminPanelBtn"; b.type = "button"; b.className = "adm-btn"; b.textContent = "⚙ Panel admin";
    b.addEventListener("click", function () { abrir(); });
    acc.insertBefore(b, acc.firstChild);
  }

  window.ljPanel = { abrir: abrir, cerrar: cerrar, refrescar: function () { if (st.abierto && (st.tab === "items" || st.tab === "compras")) setTimeout(pintar, 0); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", botonBarra); else botonBarra();
})();
