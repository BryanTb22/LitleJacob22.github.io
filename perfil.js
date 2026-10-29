/* =====================================================================
   PERFIL DEL CLIENTE (tienda + rifas): Información personal · Transacciones · Seguridad
   Vive en su propia página: perfil.html (#transacciones, #seguridad). En la tienda y en Rifas,
   window.ljPerfil.abrir(tab) solo lleva a esa página. Misma cuenta (Firebase Auth + rayas_users),
   sesión compartida "lj_rifas_ses".
   ===================================================================== */
(function () {
  "use strict";
  var FB = { apiKey: "AIzaSyDbyLi7IK3ikwUp7A0VzRRqPucqRXPpL3E", projectId: "litlejacob-store" };
  var BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/";
  var SES_KEY = "lj_rifas_ses";
  var ADMIN_UID = "eLEZkdXiG5b0PpxHQCCei8D0Qxy1";
  var TABS = [["info", "👤", "Información personal"], ["trans", "🔁", "Transacciones"], ["seg", "🔒", "Seguridad"]];
  var EST = { pagado: "Por entregar", entregado: "Entregado", cancelado: "Cancelado" };
  var st = { abierto: false, tab: "info", perfil: null, compras: null, partes: null, premios: null, items: null, cargando: false, abiertos: {}, tTipo: "", tBuscar: "", msg: "", tipo: "", tienePass: undefined, emailAuth: "", verPass: false };
  var raiz = null, IMG_CACHE = {}, IMG_PEND = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mon(n) { return "S/ " + (Math.round(Number(n) * 100) / 100).toFixed(2); }
  function sinTildes(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function leerSesion() { try { return JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch (e) { return null; } }
  function guardarSesion(s) { try { if (s) localStorage.setItem(SES_KEY, JSON.stringify(s)); else localStorage.removeItem(SES_KEY); } catch (e) { /* sin almacenamiento */ } }
  function fechaHora(t) {
    try { return new Date(t).toLocaleString("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " ·"); } catch (e) { return ""; }
  }
  function tradeValido(u) { return /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/.test(String(u || "").trim()); }
  function steamNorm(v) {
    v = String(v || "").trim(); if (!v) return "";
    var largo = /765611\d{11}/.exec(v);
    if (largo && typeof BigInt === "function") return (BigInt(largo[0]) - BigInt("76561197960265728")).toString();
    var d = v.replace(/[\s.-]/g, ""); return /^\d{3,11}$/.test(d) ? d : null;
  }
  function steamDeTrade(u) { var m = /[?&]partner=(\d{3,11})/.exec(String(u || "")); return m ? m[1] : ""; }
  function errAuth(m) {
    m = String(m || "");
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m)) return "La contraseña actual no es correcta.";
    if (/WEAK_PASSWORD/.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/TOO_MANY_ATTEMPTS/.test(m)) return "Demasiados intentos. Espera unos minutos.";
    if (/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED/.test(m)) return "Tu sesión es antigua. Cierra sesión, vuelve a entrar e inténtalo otra vez.";
    return "No se pudo completar (" + m + ").";
  }

  /* ---------- sesión y datos ---------- */
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
  function consulta(coleccion, campo, valor, limite) {
    return token().then(function (tk) {
      return fetch(BASE.replace("/documents/", "/documents:runQuery"), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coleccion }], where: { fieldFilter: { field: { fieldPath: campo }, op: "EQUAL", value: { stringValue: valor } } }, limit: limite || 100 } }) });
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { return (j || []).filter(function (x) { return x.document; }).map(function (x) { return x.document; }); });
  }
  function leerPerfil(d) {
    var f = (d && d.fields) || {}, sv = function (k) { return (f[k] && f[k].stringValue) || ""; };
    return { nombre: sv("nombre"), steamId: sv("steamId"), steamAvatar: sv("steamAvatar"), whatsapp: sv("whatsapp"), email: sv("email"), tradelink: sv("tradelink"), steam: sv("steam"),
      creditos: f.creditos ? Number(f.creditos.integerValue || f.creditos.doubleValue || 0) : 0 };
  }
  function cargarTodo() {
    var s = leerSesion(); if (!s || s.uid === ADMIN_UID) return;
    st.cargando = true;
    fs("rayas_users/" + encodeURIComponent(s.uid)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) st.perfil = leerPerfil(d); })
      .catch(function () { /* sin perfil */ }).then(function () { st.cargando = false; pintar(); });
    consulta("orders", "uid", s.uid, 100).then(function (docs) {
      st.compras = docs.map(function (d) {
        var f = d.fields || {};
        var its = ((f.items && f.items.arrayValue && f.items.arrayValue.values) || []).map(function (v) {
          var g = (v.mapValue && v.mapValue.fields) || {}, num = function (k) { return Number(g[k] && (g[k].integerValue || g[k].doubleValue) || 0); };
          return { id: g.id && g.id.stringValue || "", name: g.name && g.name.stringValue || "Item", qty: num("qty") || 1, price: num("price") };
        });
        return { code: f.code && f.code.stringValue || "", monto: Number(f.creditos && (f.creditos.integerValue || f.creditos.doubleValue) || 0), t: f.createdAt && f.createdAt.timestampValue || "",
          items: its, estado: f.status && f.status.stringValue || "pagado", tienda: f.tienda && f.tienda.stringValue || "" };
      }).filter(function (c) { return c.monto > 0; });
    }).catch(function () { st.compras = []; }).then(pintar);
    consulta("rayas_part", "uid", s.uid, 100).then(function (docs) {
      st.partes = docs.map(function (d) {
        var f = d.fields || {};
        return { premio: f.premio && f.premio.stringValue || "", costo: Number(f.costo && (f.costo.integerValue || f.costo.doubleValue) || 0), cantidad: Math.max(1, Number(f.cantidad && f.cantidad.integerValue || 1)),
          creado: f.creado && f.creado.timestampValue || "", premioNombre: f.premioNombre && f.premioNombre.stringValue || "" };
      });
      if (!st.partes.length) return;
      return fetch(BASE + "rayas/estado", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var j = d && d.fields && d.fields.json && JSON.parse(d.fields.json.stringValue); st.premios = (j && j.premios) || [];
      });
    }).catch(function () { st.partes = st.partes || []; }).then(pintar);
    var acc = [];
    (function pag(t) {
      return fetch(BASE + "rayas_items?pageSize=300" + (t ? "&pageToken=" + encodeURIComponent(t) : ""), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { documents: [] }; }).then(function (j) {
        (j.documents || []).forEach(function (d) { var f = d.fields || {}; acc.push({ id: d.name.split("/").pop(), nombre: f.nombre && f.nombre.stringValue || "", img: f.img && f.img.stringValue || "" }); });
        return j.nextPageToken && acc.length < 2000 ? pag(j.nextPageToken) : null;
      });
    })("").catch(function () { /* sin catálogo */ }).then(function () { st.items = acc; pintar(); });
  }
  function imgDe(it) {
    var l = st.items || [], b = null;
    if (it.id) b = l.filter(function (x) { return x.id === it.id; })[0];
    if (!b) b = l.filter(function (x) { return sinTildes(x.nombre) === sinTildes(it.name); })[0];
    return b ? b.img : "";
  }
  /* ---------- imágenes (fs:img-… guardadas en Firestore, o https / img/…) ---------- */
  function imgTag(src, alt) {
    src = String(src || "").trim();
    if (/^fs:img-[\w\-]+$/.test(src)) { var id = src.slice(3); return '<img data-fs="' + esc(id) + '"' + (IMG_CACHE[id] ? ' src="' + IMG_CACHE[id] + '"' : "") + ' alt="' + esc(alt) + '">'; }
    if (/^img\/[\w.\-]+$/.test(src) || /^https:\/\/[^\s"'<>()]+$/.test(src)) return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" decoding="async">';
    return "";
  }
  function hidratar() {
    if (!raiz) return;
    raiz.querySelectorAll("img[data-fs]:not([src])").forEach(function (el) {
      var id = el.getAttribute("data-fs");
      if (IMG_CACHE[id]) { el.src = IMG_CACHE[id]; return; }
      if (!IMG_PEND[id]) IMG_PEND[id] = fetch(BASE + "rayas/" + id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var u = d && d.fields && d.fields.data && d.fields.data.stringValue; if (u && /^data:image\/(webp|jpeg|png);base64,/.test(u)) IMG_CACHE[id] = u; return IMG_CACHE[id];
      }).catch(function () { return null; });
      IMG_PEND[id].then(function (u) { if (u) raiz.querySelectorAll('img[data-fs="' + id + '"]').forEach(function (x) { x.src = u; }); });
    });
  }

  /* ---------- filas de transacciones ---------- */
  function filas() {
    var out = [];
    (st.partes || []).forEach(function (x) {
      var p = (st.premios || []).filter(function (q) { return q.id === x.premio; })[0] || {}, nom = p.nombre || x.premioNombre || "Rifa", est = "curso", txt = "En curso";
      var gan = String(p.ganador || "").trim();
      if (p.estado === "cerrada" && gan) {
        var win = p.ganadorUid ? p.ganadorUid === (leerSesion() || {}).uid : gan.toLowerCase() === String(st.perfil && st.perfil.nombre || "").trim().toLowerCase();
        est = win ? "entregado" : "cancelado"; txt = win ? "¡Ganaste!" : "No ganaste";
      }
      out.push({ key: "r_" + x.premio + "_" + x.creado, t: x.creado, tipo: "rifa", titulo: "Rifa: " + nom, code: "", est: est, estTxt: txt, monto: x.costo, tienda: "",
        det: [{ nombre: nom, img: p.img || "", qty: x.cantidad, unidad: x.cantidad === 1 ? "ticket" : "tickets", unit: x.cantidad ? x.costo / x.cantidad : 0, sub: x.costo, est: est, estTxt: txt }] });
    });
    (st.compras || []).forEach(function (c) {
      out.push({ key: "c_" + (c.code || c.t), t: c.t, tipo: "compra", titulo: "Compra de items", code: c.code, est: c.estado, estTxt: EST[c.estado] || c.estado, monto: c.monto,
        tienda: c.tienda === "litlejacob" ? "LitleJacob Store" : (c.tienda === "rayas" ? "Rayas Store" : ""),
        det: c.items.map(function (i) { return { nombre: i.name, img: imgDe(i), qty: i.qty, unidad: "", unit: i.price, sub: i.price * i.qty, est: c.estado, estTxt: EST[c.estado] || "" }; }) });
    });
    return out.sort(function (a, b) { return String(b.t).localeCompare(String(a.t)); });
  }
  function transHtml() {
    var f = filas(), cargandoAun = st.compras === null && st.partes === null;
    var cab = '<div class="pf-tools"><div class="pf-sec-h"><h2>Transacciones</h2><p>Tus compras de items y tickets de rifas. Toca una fila para ver el detalle.</p></div><div class="pf-filtros">' +
      '<select id="pf-tipo" aria-label="Tipo de transacción"><option value="">Todas</option><option value="compra"' + (st.tTipo === "compra" ? " selected" : "") + '>Compras de items</option><option value="rifa"' + (st.tTipo === "rifa" ? " selected" : "") + '>Rifas</option></select>' +
      '<input id="pf-buscar" type="search" placeholder="Buscar por ID o nombre del item" autocomplete="off" value="' + esc(st.tBuscar) + '"></div></div>';
    if (!f.length) return cab + '<div class="pf-vacio-t">' + (cargandoAun ? "Cargando tus transacciones…" : "Todavía no tienes transacciones. Tus compras de items y tus tickets de rifas aparecerán aquí.") + '</div>';
    return cab + '<div class="pf-tabla"><div class="pf-th"><span>Tipo / Fecha</span><span>ID</span><span>Estado</span><span>Sistema de pago</span><span>Importe</span><span class="r">Saldo</span></div>' +
      f.map(function (r) {
        var ab = !!st.abiertos[r.key], q = sinTildes(r.code + " " + r.titulo + " " + r.det.map(function (d) { return d.nombre; }).join(" "));
        var det = '<div class="pf-det"><div class="pf-dh"><span>Nombre del item</span><span>Cantidad</span><span>Estado</span><span>Precio unitario</span><span class="r">Subtotal</span></div>' +
          (r.det.length ? r.det.map(function (d) {
            return '<div class="pf-dr"><span class="pf-it"><span class="pf-foto">' + (imgTag(d.img, d.nombre) || "<i>🎁</i>") + '</span><b>' + esc(d.nombre) + '</b></span>' +
              '<span data-l="Cantidad">' + d.qty + (d.unidad ? " " + d.unidad : "") + '</span><span data-l="Estado"><i class="pf-dot est-' + esc(d.est) + '"></i>' + esc(d.estTxt) + '</span>' +
              '<span data-l="Precio unitario">' + mon(d.unit) + '</span><span class="r" data-l="Subtotal"><b>' + mon(d.sub) + '</b></span></div>';
          }).join("") : '<div class="pf-dr"><span class="ljc-hint">No hay detalle guardado de esta compra.</span></div>') +
          (r.tienda ? '<div class="pf-pie">Comprado en <b>' + esc(r.tienda) + '</b></div>' : "") + '</div>';
        return '<div class="pf-tx' + (ab ? " open" : "") + '" data-tipo="' + r.tipo + '" data-q="' + esc(q) + '"><button type="button" class="pf-row" data-a="txAbrir" data-k="' + esc(r.key) + '" aria-expanded="' + ab + '">' +
          '<span class="c-tipo"><b>' + esc(r.titulo) + '<i class="pf-fl" aria-hidden="true">▾</i></b><small>' + (r.t ? esc(fechaHora(r.t)) : "—") + '</small></span>' +
          '<span class="c-id" data-l="ID">' + (esc(r.code) || "—") + '</span><span class="c-est" data-l="Estado"><i class="pf-dot est-' + esc(r.est) + '"></i>' + esc(r.estTxt) + '</span>' +
          '<span class="c-pago" data-l="Sistema de pago">Saldo</span><span class="c-imp" data-l="Importe">' + mon(r.monto) + '</span><span class="c-sal neg r" data-l="Saldo">−' + mon(r.monto) + '</span></button>' + det + '</div>';
      }).join("") + '<p class="pf-nada" hidden>Ninguna transacción coincide con tu búsqueda.</p></div>';
  }
  function filtrar() {
    if (!raiz) return;
    var tipo = st.tTipo, q = sinTildes(st.tBuscar).trim(), n = 0;
    raiz.querySelectorAll(".pf-tx").forEach(function (el) {
      var ok = (!tipo || el.getAttribute("data-tipo") === tipo) && (!q || (el.getAttribute("data-q") || "").indexOf(q) >= 0); el.hidden = !ok; if (ok) n++;
    });
    var nada = raiz.querySelector(".pf-nada"); if (nada) nada.hidden = n > 0;
  }

  /* ---------- pestañas ---------- */
  function campo(id, label, attrs, ayuda, valor, extra) {
    return '<div class="ljc-field' + (extra ? " " + extra : "") + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + attrs + (valor != null ? ' value="' + esc(valor) + '"' : "") + '>' + (ayuda ? '<p class="ljc-hint">' + ayuda + '</p>' : "") + '</div>';
  }
  function infoHtml(p) {
    return '<form class="pf-form" id="pfInfo" novalidate><div class="pf-sec-h"><h2>Información personal</h2><p>Estos datos los usamos para enviarte tus items por Steam.</p></div><div class="pf-grid">' +
      campo("pf-nombre", "Nombre de usuario", 'maxlength="40" required autocomplete="nickname"', "", p.nombre) +
      campo("pf-email", "Correo", "disabled", "", p.email || (leerSesion() || {}).email) +
      campo("pf-wa", "WhatsApp", 'inputmode="tel" maxlength="30" required', "", p.whatsapp) +
      campo("pf-steam", "ID de Steam (código de amigo)", 'inputmode="numeric" maxlength="80" required placeholder="Ej. 123456789"', 'En Steam: <b>Amigos → Añadir un amigo</b> → "Tu código de amigo". También puedes pegar el link de tu perfil.', p.steam) +
      campo("pf-trade", "Link de intercambio de Steam", 'inputmode="url" required placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…"', '<a href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" target="_blank" rel="noopener">¿Dónde encuentro mi trade link?</a>', p.tradelink, "pf-ancho") +
      '</div>' + (p.steam ? "" : '<p class="pf-aviso">Agrega tu ID de Steam para que podamos agregarte y enviarte tus items.</p>') +
      '<div class="pf-acciones"><button class="ljc-btn silver" type="submit">Guardar cambios</button><span class="ljc-msg" role="status" id="pfInfoMsg"></span></div></form>';
  }
  function segHtml(p) {
    var v = window.ljSteam ? window.ljSteam.vinculado(p.steamId) : p.steamId, ab = !!st.claveAbierta, clave;
    if (st.tienePass === false) {
      clave = '<div class="pf-fila"><div class="pf-fila-tx"><b>Contraseña</b><span>Entras con Steam o Google y aún no tienes contraseña.</span></div>' +
        (p.email ? '<button class="ljc-btn ghost sm" type="button" data-a="crearClave">Crear contraseña</button>' : '') + '</div>';
    } else {
      clave = '<div class="pf-fila"><div class="pf-fila-tx"><b>Contraseña</b><span>Cámbiala cuando quieras. Te pediremos la actual.</span></div>' +
        '<button class="ljc-btn ghost sm" type="button" data-a="claveToggle" aria-expanded="' + ab + '">' + (ab ? "Cancelar" : "Cambiar") + '</button>' +
        (ab ? '<form class="pf-form pf-clave" id="pfClave" novalidate><div class="pf-grid">' +
          campo("pf-k0", "Contraseña actual", 'type="password" autocomplete="current-password" required', "", null, "pf-ancho") +
          campo("pf-k1", "Nueva (mínimo 6)", 'type="password" minlength="6" autocomplete="new-password" required') +
          campo("pf-k2", "Repite la nueva", 'type="password" minlength="6" autocomplete="new-password" required') +
          '</div><div class="pf-acciones"><button class="ljc-btn silver sm" type="submit">Guardar contraseña</button><a href="#" class="pf-link" data-a="crearClave">¿Olvidaste la actual?</a></div>' +
          '<p class="ljc-msg" role="status" id="pfClaveMsg"></p></form>' : '') + '</div>';
    }
    return '<div class="pf-sec-h"><h2>Seguridad</h2><p>Controla cómo entras a tu cuenta.</p></div><div class="pf-lista">' + clave +
      '<div class="pf-fila"><div class="pf-fila-tx"><b>Steam</b><span>' + (v ? '✔ Vinculado (ID ' + esc(v) + '). Puedes entrar con «Entrar con Steam».' : 'Vincúlalo para entrar con un clic, sin contraseña.') + '</span></div>' +
        (v ? '' : '<button type="button" class="ljc-btn ghost sm" data-a="steamVincular">Vincular Steam</button>') + '</div>' +
      '<div class="pf-fila"><div class="pf-fila-tx"><b>Sesión</b><span>Cierra tu sesión en este dispositivo.</span></div><button class="ljc-btn ghost sm" type="button" data-a="salir">Cerrar sesión</button></div></div>';
  }
  var RUTA = { info: "", trans: "#transacciones", seg: "#seguridad" };
  function tabDeHash() { var h = location.hash; return h === "#transacciones" ? "trans" : h === "#seguridad" ? "seg" : "info"; }
  function avatar(p) {
    var a = p && p.steamAvatar && window.ljSteam && window.ljSteam.imgOk && window.ljSteam.imgOk(p.steamAvatar) ? p.steamAvatar : "";
    return a ? '<img src="' + esc(a) + '" alt="" width="56" height="56">' : '<span>' + esc(String(p && p.nombre || "?").trim().charAt(0).toUpperCase() || "?") + '</span>';
  }
  function pintar() {
    if (!raiz) return;
    var p = st.perfil, s = leerSesion(), cuerpo;
    st.tab = tabDeHash();
    if (!s) cuerpo = '<div class="pf-card pf-vacio"><b>Entra a tu cuenta para ver tu perfil.</b><div class="pf-acciones"><a class="ljc-btn silver" href="index.html#cuenta">Entrar</a><a class="ljc-btn ghost" href="index.html">Volver a la tienda</a></div></div>';
    else if (s.uid === ADMIN_UID) cuerpo = '<div class="pf-card pf-vacio"><b>Esta es la cuenta de administrador.</b><div class="pf-acciones"><a class="ljc-btn silver" href="index.html">Ir a la tienda</a></div></div>';
    else if (!p) cuerpo = '<div class="pf-card pf-vacio">' + (st.cargando ? "Cargando tu cuenta…" : "No se pudo cargar tu cuenta. Revisa tu internet e inténtalo otra vez.") + '</div>';
    else {
      cuerpo = '<div class="pf-top"><div class="pf-user"><span class="pf-av">' + avatar(p) + '</span><div><h1>' + esc(p.nombre || "Mi cuenta") + '</h1><small>' + esc(p.email || s.email || "") + '</small></div></div>' +
        '<div class="pf-saldo"><div><small>Saldo</small><b>S/ ' + (Math.round(p.creditos * 100) / 100).toFixed(2) + '</b></div><a class="ljc-btn red sm" href="index.html#recargar">Recargar</a></div></div>' +
        '<nav class="pf-nav" aria-label="Secciones del perfil">' + TABS.map(function (t) {
          return '<a href="perfil.html' + RUTA[t[0]] + '"' + (st.tab === t[0] ? ' class="on" aria-current="page"' : '') + '>' + (t[0] === "info" ? 'Información<span class="pf-largo"> personal</span>' : t[2]) + '</a>';
        }).join("") + '</nav>' +
        (st.msg ? '<p class="pf-msg ' + (st.tipo === "err" ? "err" : "ok") + '" role="status">' + esc(st.msg) + '</p>' : '') +
        '<div class="pf-card">' + (st.tab === "trans" ? transHtml() : st.tab === "seg" ? segHtml(p) : infoHtml(p)) + '</div>';
    }
    raiz.innerHTML = '<div class="pf-wrap"><nav class="pf-mig" aria-label="Ruta"><a href="index.html">Inicio</a><span aria-hidden="true">/</span><span>Mi perfil</span></nav>' + cuerpo + '</div>';
    hidratar(); if (st.tab === "trans") filtrar();
    if (st.tab === "seg" && p) verPass();
    pintarCab();
  }

  /* ---------- seguridad ---------- */
  function verPass() {
    if (st.tienePass !== undefined || st.verPass) return; st.verPass = true;
    token().then(function (tk) {
      return fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(FB.apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: tk }) });
    }).then(function (r) { return r.json(); }).then(function (j) {
      var u = j && j.users && j.users[0]; if (!u) throw new Error("x");
      st.tienePass = (u.providerUserInfo || []).some(function (x) { return x.providerId === "password"; }); st.emailAuth = u.email || "";
      if (tabDeHash() === "seg") pintar();
    }).catch(function () { st.tienePass = true; }).then(function () { st.verPass = false; });
  }
  function authPost(metodo, cuerpoJson) {
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:" + metodo + "?key=" + encodeURIComponent(FB.apiKey), { method: "POST", headers: { "Content-Type": "application/json", "X-Firebase-Locale": "es" }, body: JSON.stringify(cuerpoJson) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error.message || "AUTH"); return j; });
  }
  function cambiarClave(actual, nueva) {
    var s = leerSesion(), em = st.emailAuth || (s && s.email) || (st.perfil && st.perfil.email) || "";
    if (!em) return Promise.reject(new Error("EMAIL_NOT_FOUND"));
    return authPost("signInWithPassword", { email: em, password: actual, returnSecureToken: true }).then(function (a) {
      return authPost("update", { idToken: a.idToken, password: nueva, returnSecureToken: true });
    }).then(function (j) {
      guardarSesion({ id: j.idToken, ref: j.refreshToken || (s && s.ref), exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000, email: em, uid: s.uid });
    });
  }
  function enviarClave() {
    var em = (st.perfil && st.perfil.email) || st.emailAuth || "";
    if (!em) { st.msg = "Tu cuenta no tiene un correo registrado."; st.tipo = "err"; pintar(); return; }
    authPost("sendOobCode", { requestType: "PASSWORD_RESET", email: em }).then(function () {
      st.msg = "Te enviamos un correo a " + em + " para crear una contraseña nueva. Revisa también spam."; st.tipo = "ok";
    }).catch(function (e) { st.msg = "No se pudo enviar el correo (" + (e && e.message) + ")."; st.tipo = "err"; }).then(pintar);
  }
  function salir() {
    guardarSesion(null);
    try { localStorage.removeItem("litlejacob_customer_v1"); } catch (e) { /* nada */ }
    location.href = "index.html";
  }

  /* ---------- eventos ---------- */
  function alClic(e) {
    var a = e.target.closest("[data-a]"); if (!a) return;
    var acc = a.getAttribute("data-a");
    if (acc === "claveToggle") { st.claveAbierta = !st.claveAbierta; pintar(); var k = raiz.querySelector("#pf-k0"); if (k) k.focus(); }
    else if (acc === "txAbrir") { var kk = a.getAttribute("data-k"); st.abiertos[kk] = !st.abiertos[kk]; pintar(); }
    else if (acc === "crearClave") { e.preventDefault(); enviarClave(); }
    else if (acc === "salir") { e.preventDefault(); salir(); }
    else if (acc === "steamVincular") {
      e.preventDefault();
      if (window.ljSteam) window.ljSteam.ir(token).catch(function (er) { st.msg = (er && er.message === "NO_SESSION") ? "Tu sesión venció. Vuelve a entrar." : ((er && er.message) || "No se pudo conectar con Steam."); st.tipo = "err"; pintar(); });
    }
  }
  function aviso(id, txt, ok) { var el = raiz && raiz.querySelector("#" + id); if (el) { el.className = "ljc-msg" + (ok === true ? " ok" : ok === false ? " err" : ""); el.textContent = txt; } }
  function alEnviar(e) {
    var f = e.target; e.preventDefault();
    if (f.id === "pfInfo") {
      var v = function (id) { var el = raiz.querySelector("#pf-" + id); return el ? el.value.trim() : ""; };
      var d = { nombre: v("nombre").replace(/\s+/g, " ").slice(0, 40), whatsapp: v("wa"), tradelink: v("trade") }, stm = steamNorm(v("steam"));
      if (stm === "" && tradeValido(d.tradelink)) stm = steamDeTrade(d.tradelink);
      d.steam = stm;
      var err = !d.nombre ? "Escribe tu nombre de usuario." : String(d.whatsapp).replace(/\D+/g, "").length < 6 ? "Escribe tu WhatsApp (ej. 987 654 321)."
        : !d.steam ? (d.steam === null ? "Tu ID de Steam son solo números (ej. 123456789) o el link de tu perfil." : "Escribe tu ID de Steam (código de amigo).")
        : !tradeValido(d.tradelink) ? "Pega tu trade link completo: https://steamcommunity.com/tradeoffer/new/?partner=…&token=…" : "";
      if (err) { aviso("pfInfoMsg", err, false); return; }
      aviso("pfInfoMsg", "Guardando…");
      var campos = ["nombre", "whatsapp", "tradelink", "steam"];
      fs("rayas_users/" + encodeURIComponent(leerSesion().uid) + "?" + campos.map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&") + "&currentDocument.exists=true", {
        method: "PATCH", body: JSON.stringify({ fields: { nombre: { stringValue: d.nombre }, whatsapp: { stringValue: d.whatsapp }, tradelink: { stringValue: d.tradelink }, steam: { stringValue: d.steam } } })
      }).then(function (r) {
        if (!r.ok) throw new Error("Error " + r.status);
        Object.assign(st.perfil, d); pintar(); aviso("pfInfoMsg", "✔ Cambios guardados.", true);
        try { window.dispatchEvent(new CustomEvent("lj-perfil-cambio")); } catch (x) { /* nada */ }
      }).catch(function (er) { aviso("pfInfoMsg", "No se pudo guardar (" + ((er && er.message) || "error") + ").", false); });
    } else if (f.id === "pfClave") {
      var a0 = raiz.querySelector("#pf-k0").value, a1 = raiz.querySelector("#pf-k1").value, a2 = raiz.querySelector("#pf-k2").value;
      if (a1.length < 6) { aviso("pfClaveMsg", "La contraseña nueva debe tener al menos 6 caracteres.", false); return; }
      if (a1 !== a2) { aviso("pfClaveMsg", "Las dos contraseñas nuevas no coinciden.", false); return; }
      if (a1 === a0) { aviso("pfClaveMsg", "La contraseña nueva debe ser distinta de la actual.", false); return; }
      aviso("pfClaveMsg", "Cambiando…");
      cambiarClave(a0, a1).then(function () { st.claveAbierta = false; st.msg = "✔ Contraseña cambiada. Úsala la próxima vez que entres."; st.tipo = "ok"; pintar(); })
        .catch(function (er) { aviso("pfClaveMsg", errAuth(er && er.message), false); });
    }
  }
  function alInput(e) {
    if (e.target.id === "pf-buscar") { st.tBuscar = e.target.value; filtrar(); }
    else if (e.target.id === "pf-tipo") { st.tTipo = e.target.value; filtrar(); }
  }
  /* ---------- cabecera (misma que la tienda y Rifas) ---------- */
  function pintarCab() {
    var der = document.getElementById("ljPfRight"); if (!der) return;
    var s = leerSesion(), p = st.perfil;
    if (!s) { der.innerHTML = '<a class="ljc-navbtn" href="index.html#cuenta">Entrar / Registrarme</a>'; return; }
    if (!p) { der.innerHTML = ''; return; }
    var ab = !!st.menuAbierto, saldo = (Math.round(p.creditos * 100) / 100).toFixed(2).replace(/\.00$/, "");
    der.innerHTML = '<a class="ljc-misrifas" href="rifas.html#misrifas">🎟️ Mis rifas</a>' +
      '<span class="ljc-dropwrap"><button class="ljc-navbtn on" type="button" data-cab="toggle" aria-haspopup="menu" aria-expanded="' + ab + '"><b>◆ S/ ' + saldo + '</b><span class="nm"> · ' + esc(p.nombre || "Mi cuenta") + '</span><span class="fl" aria-hidden="true"> ▾</span></button>' +
      '<div class="ljc-drop" role="menu"' + (ab ? '' : ' hidden') + '><div class="ljc-drop-head"><b>' + esc(p.nombre || "Mi cuenta") + '</b><small>' + esc(p.email || s.email || "") + '</small><span>Saldo: <b>S/ ' + saldo + '</b></span></div>' +
      '<button type="button" role="menuitem" data-cab="recargar"><i>💎</i>Recargar saldo</button>' +
      '<button type="button" role="menuitem" data-cab="info"><i>👤</i>Perfil</button>' +
      '<button type="button" role="menuitem" data-cab="trans"><i>🧾</i>Transacciones</button>' +
      '<button type="button" role="menuitem" class="out" data-cab="salir"><i>⎋</i>Cerrar sesión</button></div></span>';
  }
  function alClicCab(e) {
    var b = e.target.closest && e.target.closest("[data-cab]");
    if (!b) { if (st.menuAbierto && !(e.target.closest && e.target.closest(".ljc-dropwrap"))) { st.menuAbierto = false; pintarCab(); } return; }
    var a = b.getAttribute("data-cab");
    if (a === "toggle") { st.menuAbierto = !st.menuAbierto; pintarCab(); return; }
    st.menuAbierto = false; pintarCab();
    if (a === "recargar") location.href = "index.html#recargar";
    else if (a === "info" || a === "trans") { var h = RUTA[a]; if (location.hash !== h && !(a === "info" && !location.hash)) location.hash = h; }
    else if (a === "salir") salir();
  }
  function seccionesItems() {
    fetch(BASE + "rayas/estado", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var j = d && d.fields && d.fields.json && JSON.parse(d.fields.json.stringValue);
      if (j && j.secciones && j.secciones.items) document.querySelectorAll("[data-pf-items]").forEach(function (a) { a.hidden = false; });
    }).catch(function () { /* sin conexión */ });
  }
  function montar() {
    raiz = document.getElementById("ljPerfilPagina");
    if (!raiz) return;   // en la tienda y en Rifas este archivo solo da el enlace a la página
    document.addEventListener("click", alClicCab);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && st.menuAbierto) { st.menuAbierto = false; pintarCab(); } });
    seccionesItems();
    raiz.addEventListener("click", alClic); raiz.addEventListener("submit", alEnviar); raiz.addEventListener("input", alInput); raiz.addEventListener("change", alInput);
    window.addEventListener("hashchange", function () { st.msg = ""; st.tipo = ""; st.claveAbierta = false; pintar(); });
    var vs = window.ljSteam && window.ljSteam.alCargar();   // ¿volvemos de vincular Steam?
    if (vs) {
      st.msg = vs.msg || ""; st.tipo = vs.tipo === "error" ? "err" : "ok";
      try { history.replaceState(null, "", location.pathname + "#seguridad"); } catch (e) { /* nada */ }
    }
    if (leerSesion()) { st.cargando = true; cargarTodo(); }
    pintar();
  }
  function abrir(tab) {
    var s = leerSesion(); if (!s || s.uid === ADMIN_UID) return false;
    location.href = "perfil.html" + (RUTA[tab] || "");
    return true;
  }
  function cerrar() { /* la página no se cierra: es una página */ }
  window.ljPerfil = { abrir: abrir, cerrar: cerrar };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
