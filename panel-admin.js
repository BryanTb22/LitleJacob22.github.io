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
  var PED_ESTADOS = [["pagado", "💰 Por entregar"], ["entregado", "✅ Entregado"], ["cancelado", "✖ Cancelado"]];
  var TABS = { config: "⚙ Configuración", usuarios: "Usuarios y saldo", pagina: "Textos y contactos", items: "Items", pedidos: "🛒 Pedidos", compras: "Compras" };

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
  function tabsDe(sc) { return sc === "items" ? ["config", "items", "pedidos", "compras", "usuarios"] : ["config", "usuarios", "pagina"]; }

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
    }).then(function (j) { st.usuarios = (j.documents || []).map(leerPerfilDoc).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); }); })
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
      var n = 0, total = 0, ult = "";
      if (r[0]) r[0].forEach(function (d) { var f = d.fields || {}, m = Number(f.creditos && (f.creditos.integerValue || f.creditos.doubleValue) || 0), t = f.createdAt && f.createdAt.timestampValue || ""; if (m > 0) { n++; total += m; if (t > ult) ult = t; } });
      var premios = (st.estado && st.estado.premios) || [];
      var rifas = r[1].map(function (d) {
        var f = d.fields || {}, pid = f.premio && f.premio.stringValue || "", pr = premios.filter(function (p) { return p.id === pid; })[0];
        var cant = Math.max(1, Number(f.cantidad && f.cantidad.integerValue || 1)), costo = Number(f.costo && (f.costo.integerValue || f.costo.doubleValue) || 0);
        return esc(pr ? pr.nombre : (f.premioNombre && f.premioNombre.stringValue || pid)) + " · " + cant + (cant === 1 ? " ticket" : " tickets") + " · " + costo + " soles · " + esc(fechaHora(f.creado && f.creado.timestampValue)) + (pr && pr.ganadorUid === uid ? " · <b>🏆 ganador</b>" : "");
      });
      st.pedU[uid] = { ped: r[0] ? { n: n, total: Math.round(total * 100) / 100, ult: ult } : null, rifas: rifas };
      pintar();
    });
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
      '<div class="pa-frow"><span>Pedidos</span><div>' + ped + '</div></div>' +
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
    return subtabs + '<div class="pa-grp"><h3>Usuarios (' + st.usuarios.length + ')</h3>' +
      '<div class="pa-field"><label for="pa-u-buscar">Buscar</label><input id="pa-u-buscar" placeholder="Nombre, Steam, correo o WhatsApp" value="' + esc(st.uFiltro) + '" autocomplete="off"></div>' +
      (st.uMsg && !st.editU ? '<p class="pa-hint err">' + esc(st.uMsg) + '</p>' : '') +
      '<div class="pa-ulist">' + (lista.length ? lista.map(function (u) {
        var id = esc(u.uid), ab = st.uAbierto === u.uid;
        var cab = '<button type="button" class="pa-urow-h" data-pa="uAbrir" data-uid="' + id + '" aria-expanded="' + ab + '">' + avatarUsuario(u) + '<b>' + esc(u.nombre || "(sin nombre)") + '</b><span class="pa-usal">S/ ' + fmtSol(u.creditos) + '</span><i>' + (ab ? "▴" : "▾") + '</i></button>';
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
      return { nombre: m.name && m.name.stringValue || "Item", qty: Number(m.qty && (m.qty.integerValue || m.qty.doubleValue) || 1), precio: Number(m.price && (m.price.doubleValue !== undefined ? m.price.doubleValue : m.price.integerValue) || 0) };
    });
    return { id: d.name.split("/").pop(), code: sv("code") || d.name.split("/").pop(), cliente: sv("customerName"), steam: sv("steamId"), email: sv("email"), tradelink: sv("tradelink"),
      whatsapp: sv("phone"), uid: sv("uid"), correoAdmin: !!(f.correoAdmin && f.correoAdmin.booleanValue), correoCliente: !!(f.correoCliente && f.correoCliente.booleanValue), correoError: sv("correoError"),
      estado: sv("status") || "pagado", tienda: sv("tienda"), total: nv("total"), creditos: nv("creditos"), items: its, fecha: f.createdAt && f.createdAt.timestampValue ? new Date(f.createdAt.timestampValue) : null };
  }
  function cargarPedidos() {
    if (st.cargandoP) return; st.cargandoP = true; st.pedMsg = "";
    consulta("orders", "origen", "items", 300).then(function (docs) {
      st.pedidos = docs.map(leerPedidoDoc).filter(function (p) { return p.tienda !== "rayas"; }).sort(function (a, b) { return (b.fecha || 0) - (a.fecha || 0); });
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
  function historialHtml(p) {
    var k = pedClave(p), todos = (st.pedidos || []).filter(function (x) { return pedClave(x) === k; }), vivos = todos.filter(function (x) { return x.estado !== "cancelado"; });
    var gastado = vivos.reduce(function (a, x) { return a + x.total; }, 0);
    return '<div class="pa-hist"><b>📜 Historial de compras de este cliente</b><small>' + vivos.length + (vivos.length === 1 ? ' compra' : ' compras') + ' · ' + fmtPrecio(gastado) + ' en total</small>' +
      todos.map(function (x) {
        var est = (PED_ESTADOS.filter(function (e) { return e[0] === x.estado; })[0] || [0, x.estado])[1], n = x.items.map(function (i) { return i.qty + ' × ' + i.nombre; }).join(", ");
        return '<div class="pa-histr' + (x.id === p.id ? ' cur' : '') + '"><span>' + esc(x.fecha ? x.fecha.toLocaleDateString("es-PE") : "") + ' · <b>' + esc(x.code) + '</b></span><span>' + esc(n) + '</span><span>' + fmtPrecio(x.total) + ' · ' + esc(est) + '</span></div>';
      }).join("") + '</div>';
  }
  function tabPedidos() {
    if (st.pedidos === null) { cargarPedidos(); return '<p class="pa-hint">Cargando pedidos…</p>'; }
    var fl = st.pedFiltro || "pagado", todos = st.pedidos;
    var cuenta = function (k) { return todos.filter(function (p) { return k === "todos" || p.estado === k; }).length; };
    var chips = [["pagado", "💰 Por entregar"], ["entregado", "✅ Entregados"], ["cancelado", "✖ Cancelados"], ["todos", "Todos"]].map(function (c) {
      return '<button type="button" role="tab" data-pa="pedFiltro" data-f="' + c[0] + '" aria-selected="' + (fl === c[0]) + '">' + c[1] + ' (' + cuenta(c[0]) + ')</button>'; }).join("");
    var lista = todos.filter(function (p) { return fl === "todos" || p.estado === fl; });
    return '<div class="pa-sub chips" role="tablist">' + chips + '</div><div class="pa-grp"><h3>Pedidos de items (' + lista.length + ')</h3>' +
      '<p class="pa-hint">Los pedidos de Sets Caché siguen en la barra de <b>Sets Caché</b> → Pedidos.</p>' +
      (st.pedMsg ? '<p class="pa-hint err">' + esc(st.pedMsg) + '</p>' : '') +
      '<div class="pa-ulist">' + (lista.length ? lista.map(function (p) {
        var ab = st.pedAbierto === p.id, n = p.items.reduce(function (a, i) { return a + i.qty; }, 0);
        var cab = '<button type="button" class="pa-urow-h" data-pa="pedAbrir" data-id="' + esc(p.id) + '" aria-expanded="' + ab + '"><b>' + esc(p.cliente || "Sin nombre") + ' · ' + n + (n === 1 ? ' item' : ' items') + '</b><span class="pa-usal">' + fmtPrecio(p.total) + '</span><i>' + (ab ? "▴" : "▾") + '</i></button>';
        if (!ab) return '<div class="pa-urow">' + cab + '</div>';
        return '<div class="pa-urow open">' + cab + '<div class="pa-ut"><span>Pedido <b>' + esc(p.code) + '</b> · ' + (p.fecha ? esc(p.fecha.toLocaleString("es-PE")) : "") + '</span>' +
          p.items.map(function (i) { return '<span>' + i.qty + ' × ' + esc(i.nombre) + ' — ' + fmtPrecio(i.precio * i.qty) + '</span>'; }).join("") +
          '<span>ID de Steam: ' + esc(p.steam || "—") + '</span><span>WhatsApp: ' + esc(p.whatsapp || "—") + '</span><span>' + esc(p.email) + '</span>' +
          (tradeValido(p.tradelink) ? '<span><a href="' + esc(p.tradelink) + '" target="_blank" rel="noopener">Abrir trade link ↗</a></span>' : '<span class="pa-warn">Sin trade link</span>') +
          '<span>Pagado con saldo: ' + fmtPrecio(p.creditos) + '</span>' +
          '<span>✉ Correo a ti: ' + (p.correoAdmin ? '✔ enviado' : '✖ no enviado') + ' · Correo al cliente: ' + (p.correoCliente ? '✔ enviado' : '✖ no enviado') + '</span>' +
          (p.correoError ? '<span class="pa-warn">Motivo: ' + esc(p.correoError) + '</span>' : '') + '</div>' + historialHtml(p) +
          '<div class="pa-field"><label for="pa-pe-' + esc(p.id) + '">Estado</label><select id="pa-pe-' + esc(p.id) + '" class="pa-pedEstado" data-id="' + esc(p.id) + '">' + PED_ESTADOS.map(function (e) { return '<option value="' + e[0] + '"' + (p.estado === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join("") + '</select></div>' +
          (p.estado === "cancelado" ? '<p class="pa-hint">Cancelar no devuelve el saldo solo: súmalo en Usuarios y saldo.</p>' : '') + '</div>';
      }).join("") : '<p class="pa-hint">No hay pedidos aquí. Cuando alguien compre un item aparecerá y te llegará un correo.</p>') + '</div>' +
      '<button class="pa-btn ghost ancho" type="button" data-pa="pedRecargar">Actualizar lista</button></div>';
  }

  /* ---------- Items y Compras (los dibuja items.js) ---------- */
  function tabItems() { return window.ljItems && window.ljItems.adminLista ? window.ljItems.adminLista() : '<p class="pa-hint">Cargando…</p>'; }
  function tabCompras() { return window.ljItems && window.ljItems.compras ? '<div class="pa-grp">' + window.ljItems.compras().replace('Admin · ', '') + '</div>' : '<p class="pa-hint">Cargando…</p>'; }

  /* ---------- dibujo ---------- */
  function estadoPublicacion() {
    var d = document.getElementById("draftStatus"); return d ? d.textContent.replace(/^[^A-Za-zÁÉÍÓÚáéíóú]+/, "") : "";
  }
  function pintar() {
    var r = st.raiz; if (!r || !st.abierto) return;
    var sc = seccion(), lista = tabsDe(sc);
    if (lista.indexOf(st.tab) < 0) st.tab = lista[0];
    var nom = sc === "items" ? "Compra y venta de items" : "General";
    var cuerpo = st.tab === "config" ? tabConfig(sc) : st.tab === "usuarios" ? tabUsuarios() : st.tab === "pagina" ? tabPagina() : st.tab === "items" ? tabItems() : st.tab === "pedidos" ? tabPedidos() : tabCompras();
    var body = r.querySelector(".pa-body"), top = body ? body.scrollTop : 0, foco = document.activeElement && r.contains(document.activeElement) ? document.activeElement.id : "", sel = foco && document.activeElement.selectionStart;
    var pill = document.getElementById("draftStatus"), pub = estadoPublicacion(), sucio = !!(pill && pill.classList.contains("dirty"));
    r.innerHTML = '<div class="pa-scrim" data-pa="cerrar"></div><aside class="pa-drawer" role="dialog" aria-modal="true" aria-label="Panel de administración">' +
      '<div class="pa-head"><h2>Panel admin · ' + nom + '</h2><div class="pa-head-b"><button class="pa-btn ghost sm peligro" type="button" data-pa="salir">⎋ Cerrar sesión</button><button class="pa-btn ghost sm" type="button" data-pa="cerrar">Cerrar panel</button></div></div>' +
      '<div class="pa-body"><div class="pa-tabs" role="tablist">' + lista.map(function (k) {
        return '<button type="button" role="tab" data-pa="tab" data-t="' + k + '" aria-selected="' + (st.tab === k) + '">' + (k === "config" && sc === "inicio" ? "⚙ Configuraciones principales" : TABS[k]) + '</button>';
      }).join("") + '</div>' + cuerpo + '</div>' +
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
      case "recargarU": st.usuarios = null; st.pedU = {}; pintar(); break;
      case "pedAbrir": var pid = t.getAttribute("data-id"); st.pedAbierto = st.pedAbierto === pid ? null : pid; pintar(); break;
      case "pedFiltro": st.pedFiltro = t.getAttribute("data-f"); pintar(); break;
      case "pedRecargar": st.pedidos = null; pintar(); break;
    }
  }
  function alCambio(e) {
    var t = e.target;
    if (t.classList.contains("pa-pedEstado")) cambiarEstadoPedido(t.getAttribute("data-id"), t.value);
    else if (t.classList.contains("pa-credset")) guardarCreditos(t.getAttribute("data-uid"), t.value);
  }
  function alEscribir(e) {
    if (e.target.id === "pa-u-buscar") { st.uFiltro = e.target.value; pintar(); }
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
