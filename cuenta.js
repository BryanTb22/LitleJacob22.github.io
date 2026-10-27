/* =====================================================================
   CUENTAS DE CLIENTES en la tienda (Sets Caché / Inicio / Compro)
   Usa la MISMA cuenta que Rifas (y Rayas Store): Firebase Auth + colección
   rayas_users. La sesión se comparte con rifas.html (misma clave "lj_rifas_ses").
   Datos del cliente: nombre, WhatsApp, correo, ID de Steam (código de amigo)
   y link de intercambio (trade link).
   ===================================================================== */
(function () {
  "use strict";
  var FB = { apiKey: "AIzaSyDbyLi7IK3ikwUp7A0VzRRqPucqRXPpL3E", projectId: "litlejacob-store" };
  var BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/";
  var SES_KEY = "lj_rifas_ses";
  var ADMIN_UID = "eLEZkdXiG5b0PpxHQCCei8D0Qxy1";   // la cuenta de administrador (el servidor y las reglas usan el mismo dato)
  var CUSTOMER_KEY = "litlejacob_customer_v1";   // lo usa el formulario de pedido de la tienda
  var GOOGLE_CLIENT_ID = "547624378539-m3dct3sir3r9vbe51hm6q1ojejg1i14q.apps.googleusercontent.com";

  var st = { abierto: false, modo: "login", perfil: null, cargando: false, msg: "", tipo: "" };

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function leerSesion() { try { return JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch (e) { return null; } }
  function guardarSesion(s) { try { if (s) localStorage.setItem(SES_KEY, JSON.stringify(s)); else localStorage.removeItem(SES_KEY); } catch (e) { /* sin almacenamiento */ } }
  function tradeValido(u) { return /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/.test(String(u || "").trim()); }
  // Acepta el código de amigo (números), el SteamID64 o el link del perfil (/profiles/7656…). Devuelve el código de amigo.
  function steamNorm(v) {
    v = String(v || "").trim();
    if (!v) return "";
    var largo = /765611\d{11}/.exec(v);
    if (largo && typeof BigInt === "function") return (BigInt(largo[0]) - BigInt("76561197960265728")).toString();
    var d = v.replace(/[\s.-]/g, "");
    return /^\d{3,11}$/.test(d) ? d : null;
  }
  // Código de amigo sacado del trade link (partner=…), por si el cliente no lo sabe
  function steamDeTrade(u) { var m = /[?&]partner=(\d{3,11})/.exec(String(u || "")); return m ? m[1] : ""; }
  function telNorm(v) { var d = String(v || "").replace(/\D+/g, ""); return d.length === 9 ? "51" + d : d; }
  var AYUDA_TRADE = '<a href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" target="_blank" rel="noopener">¿Dónde encuentro mi trade link?</a>';
  var AYUDA_STEAM = 'En Steam: <b>Amigos → Añadir un amigo</b> → "Tu código de amigo". También puedes pegar el link de tu perfil.';

  function sesionDe(j) { return { id: j.idToken, ref: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000, email: j.email, uid: j.localId }; }
  function auth(metodo, cuerpo) {
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:" + metodo + "?key=" + encodeURIComponent(FB.apiKey), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message || "AUTH");
      return j;
    });
  }
  function entrar(email, pass) { return auth("signInWithPassword", { email: email, password: pass, returnSecureToken: true }).then(function (j) { var s = sesionDe(j); guardarSesion(s); return s; }); }
  function crearUsuario(email, pass) { return auth("signUp", { email: email, password: pass, returnSecureToken: true }).then(function (j) { var s = sesionDe(j); guardarSesion(s); return s; }); }
  function entrarGoogle(cred) {
    return auth("signInWithIdp", { postBody: "id_token=" + cred + "&providerId=google.com", requestUri: location.origin, returnIdpCredential: true, returnSecureToken: true })
      .then(function (j) { var s = sesionDe(j); guardarSesion(s); return s; });
  }
  function token() {
    var s = leerSesion();
    if (!s) return Promise.reject(new Error("NO_SESSION"));
    if (s.exp > Date.now()) return Promise.resolve(s.id);
    return fetch("https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(FB.apiKey), {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.ref)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.id_token) { guardarSesion(null); throw new Error("NO_SESSION"); }
      s.id = j.id_token; s.ref = j.refresh_token || s.ref; s.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000;
      guardarSesion(s); return s.id;
    });
  }
  function fs(ruta, opts) {
    return token().then(function (tk) {
      opts = opts || {};
      opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tk };
      return fetch(BASE + ruta, opts);
    });
  }
  function leerPerfil(d) {
    var f = (d && d.fields) || {}, sv = function (k) { return (f[k] && f[k].stringValue) || ""; };
    return { nombre: sv("nombre"), whatsapp: sv("whatsapp"), email: sv("email"), tradelink: sv("tradelink"), steam: sv("steam"),
      creditos: f.creditos ? Number(f.creditos.integerValue || f.creditos.doubleValue || 0) : 0,
      promoUsada: !!(f.promoUsada && f.promoUsada.booleanValue === true) };
  }
  function crearPerfil(ses, d) {
    return fs("rayas_users/" + encodeURIComponent(ses.uid) + "?currentDocument.exists=false", {
      method: "PATCH",
      body: JSON.stringify({ fields: {
        nombre: { stringValue: d.nombre }, whatsapp: { stringValue: d.whatsapp }, email: { stringValue: d.email },
        tradelink: { stringValue: d.tradelink }, steam: { stringValue: d.steam },
        creditos: { integerValue: "0" }, creado: { timestampValue: new Date().toISOString() }
      } })
    }).then(function (r) { if (!r.ok) throw new Error("PERFIL_" + r.status); });
  }
  // Rellena el formulario de pedido de la tienda con los datos de la cuenta
  function compartirConPedido(p) {
    if (!p) return;
    try {
      var prev = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}");
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: p.nombre || prev.name || "", steam: p.steam || prev.steam || "", phone: telNorm(p.whatsapp) || prev.phone || "" }));
    } catch (e) { /* sin almacenamiento */ }
    ["custName", "custSteam"].forEach(function (id, i) { var el = document.getElementById(id); if (el && !el.value) el.value = i ? (p.steam || "") : (p.nombre || ""); });
  }
  function errAuth(m) {
    m = String(m || "");
    if (/EMAIL_EXISTS/.test(m)) return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m)) return "Correo o contraseña incorrectos.";
    if (/WEAK_PASSWORD/.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/INVALID_EMAIL/.test(m)) return "Ese correo no es válido.";
    if (/TOO_MANY_ATTEMPTS/.test(m)) return "Demasiados intentos. Espera unos minutos.";
    return "No se pudo completar (" + m + ").";
  }

  /* ---------- carga del perfil ---------- */
  function esAdmin(s) { s = s || leerSesion(); return !!s && s.uid === ADMIN_UID; }
  // Entrando con la cuenta de administrador se activa solo el panel de edición de la tienda.
  function entrarAdmin() { try { if (window.ljAdminEntrar) window.ljAdminEntrar(leerSesion()); } catch (e) { /* la tienda aún no carga */ } }
  function cargarPerfil() {
    var s = leerSesion();
    if (!s) { st.perfil = null; pintarBoton(); return Promise.resolve(); }
    if (esAdmin(s)) { st.perfil = null; st.modo = "admin"; st.cargando = false; entrarAdmin(); pintar(); pintarBoton(); return Promise.resolve(); }
    st.cargando = true; pintar();
    return fs("rayas_users/" + encodeURIComponent(s.uid)).then(function (r) {
      if (r.status === 404) { st.perfil = null; st.modo = "completar"; return; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json().then(function (d) { st.perfil = leerPerfil(d); if (st.modo !== "perfil") st.modo = "perfil"; compartirConPedido(st.perfil); });
    }).catch(function (e) {
      if (e && e.message === "NO_SESSION") { st.perfil = null; st.modo = "login"; }
      else { st.msg = "No se pudo cargar tu cuenta. Revisa tu internet."; st.tipo = "err"; }
    }).then(function () { st.cargando = false; pintar(); pintarBoton(); });
  }
  function trasEntrar() { st.msg = ""; st.modo = "perfil"; return cargarPerfil(); }

  /* ---------- interfaz ---------- */
  var raiz, boton, recBtn;
  function montar() {
    var nav = document.querySelector(".site-nav .nav-right");
    if (nav && !document.getElementById("ljCuentaBtn")) {
      boton = document.createElement("button");
      boton.id = "ljCuentaBtn"; boton.type = "button"; boton.className = "ljc-navbtn";
      boton.addEventListener("click", function () { abrir(); });
      var adm = document.getElementById("loginOpenBtn");
      nav.insertBefore(boton, adm || null);
    }
    raiz = document.createElement("div");
    raiz.id = "ljCuenta"; raiz.className = "ljc"; raiz.hidden = true;
    document.body.appendChild(raiz);
    raiz.addEventListener("click", alClic);
    raiz.addEventListener("submit", alEnviar);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && st.abierto) cerrar(); });
    pintarBoton();
    if (leerSesion()) cargarPerfil();
    // Permite abrir la cuenta con #cuenta en la dirección
    if (/^#cuenta$/.test(location.hash)) abrir();
  }
  function pintarBoton() {
    if (!boton) return;
    var s = leerSesion(), p = st.perfil;
    if (recBtn) recBtn.hidden = esAdmin(s);
    boton.innerHTML = esAdmin(s) ? '<span class="ljc-ico">🔧</span>Admin' : s ? '<span class="ljc-ico">👤</span>' + (p ? esc((p.nombre || "Mi cuenta").split(" ")[0]) + ' <small>' + p.creditos + ' créd.</small>' : "Mi cuenta") : "Entrar / Registrarme";
    boton.classList.toggle("on", !!s);
    if (!recBtn && boton.parentNode) {
      recBtn = document.createElement("button");
      recBtn.id = "ljRecargarBtn"; recBtn.type = "button"; recBtn.className = "ljc-navbtn ljc-recbtn";
      recBtn.addEventListener("click", function () { if (window.ljRecarga) window.ljRecarga.abrir(); });
      recBtn.textContent = "💎 Recargar";
      boton.parentNode.insertBefore(recBtn, boton);
    }
  }
  function abrir(modo) {
    st.abierto = true;
    if (modo) st.modo = modo;
    else if (!leerSesion()) st.modo = st.modo === "registro" ? "registro" : "login";
    else if (!st.perfil && !st.cargando) { st.modo = "perfil"; cargarPerfil(); }
    else st.modo = st.perfil ? "perfil" : st.modo;
    if (esAdmin()) { st.modo = "admin"; entrarAdmin(); }
    raiz.hidden = false; document.documentElement.classList.add("ljc-lock");
    pintar();
    requestAnimationFrame(function () { raiz.classList.add("open"); var f = raiz.querySelector("input:not([disabled])"); if (f) f.focus(); });
  }
  function cerrar() {
    st.abierto = false; raiz.classList.remove("open"); document.documentElement.classList.remove("ljc-lock");
    setTimeout(function () { if (!st.abierto) raiz.hidden = true; }, 220);
  }
  function campo(id, label, attrs, ayuda, valor) {
    return '<div class="ljc-field"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + attrs + (valor != null ? ' value="' + esc(valor) + '"' : "") + '>' + (ayuda ? '<p class="ljc-hint">' + ayuda + '</p>' : "") + '</div>';
  }
  function mensaje() { return '<p class="ljc-msg ' + (st.tipo || "") + '" role="status">' + esc(st.msg || "") + '</p>'; }
  function camposCliente(pre, p) {
    p = p || {};
    return campo(pre + "-nombre", "Nombre o apodo (de Dota 2)", 'maxlength="40" required autocomplete="nickname"', "", p.nombre) +
      campo(pre + "-wa", "WhatsApp", 'inputmode="tel" maxlength="20" required placeholder="987 654 321"', "", p.whatsapp) +
      campo(pre + "-steam", "ID de Steam (código de amigo)", 'inputmode="numeric" maxlength="80" required placeholder="Ej. 123456789"', AYUDA_STEAM, p.steam) +
      campo(pre + "-trade", "Link de intercambio de Steam (trade link)", 'inputmode="url" required placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…"', AYUDA_TRADE, p.tradelink);
  }
  function pintar() {
    if (!raiz || raiz.hidden && !st.abierto) return;
    var s = leerSesion(), p = st.perfil, titulo = "", cuerpo = "";
    if (st.modo === "registro") {
      titulo = "Crear mi cuenta";
      cuerpo = '<form class="ljc-body" id="ljcRegistro" novalidate>' + gBtn() +
        campo("ljr-email", "Correo", 'type="email" autocomplete="email" required') +
        campo("ljr-pass", "Contraseña (mínimo 6)", 'type="password" autocomplete="new-password" minlength="6" required') +
        camposCliente("ljr") +
        '<button class="ljc-btn red" type="submit">Crear mi cuenta</button>' + mensaje() +
        '<p class="ljc-hint">La misma cuenta sirve para la tienda y para las <a href="rifas.html">rifas</a>.</p>' +
        '<p class="ljc-hint">¿Ya tienes cuenta? <a href="#" data-a="login">Entra aquí</a></p></form>';
    } else if (st.modo === "completar" && s) {
      titulo = "Completa tu perfil";
      cuerpo = '<form class="ljc-body" id="ljcCompletar" novalidate><p class="ljc-hint">Entraste con <b>' + esc(s.email || "") + '</b>. Completa tus datos para comprar y participar en las rifas.</p>' +
        camposCliente("ljc") + '<button class="ljc-btn red" type="submit">Guardar mi perfil</button>' + mensaje() +
        '<button class="ljc-btn ghost sm" type="button" data-a="salir">Cerrar sesión</button></form>';
    } else if (st.modo === "perfil" && s) {
      titulo = "Mi cuenta";
      cuerpo = '<div class="ljc-body">' + (p
        ? '<div class="ljc-saldo"><small>Tus créditos</small><b>' + p.creditos + '</b><a class="ljc-rec" href="#" data-a="recargar">💎 Recargar créditos</a><a href="rifas.html">Ir a las rifas →</a></div>' +
          '<form id="ljcPerfil" novalidate><h3>Mis datos</h3>' + camposCliente("ljp", p) +
          campo("ljp-email", "Correo", "disabled", "", p.email || s.email) +
          (p.steam ? "" : '<p class="ljc-hint warn">Agrega tu ID de Steam para que podamos agregarte y enviarte tus sets.</p>') +
          '<button class="ljc-btn silver" type="submit">Guardar cambios</button>' + mensaje() + '</form>'
        : '<p class="ljc-hint">' + (st.cargando ? "Cargando tu cuenta…" : esc(st.msg || "")) + '</p>') +
        '<button class="ljc-btn ghost sm" type="button" data-a="salir">Cerrar sesión</button></div>';
    } else if (st.modo === "admin" && s) {
      titulo = "Administrador";
      cuerpo = '<div class="ljc-body"><div class="ljc-saldo"><small>Sesión de administrador</small><b style="font-size:30px">🔧 Panel activo</b><span style="color:#8b9097;font-size:13px">' + esc(s.email || "") + '</span></div>' +
        '<p class="ljc-hint">Ya puedes editar el catálogo, el stock y los pedidos desde la barra de abajo.</p>' +
        '<button class="ljc-btn silver" type="button" data-a="cerrar">Ir al panel</button>' +
        '<button class="ljc-btn ghost sm" type="button" data-a="salir">Cerrar sesión</button></div>';
    } else if (st.modo === "olvide") {
      titulo = "Recuperar contraseña";
      cuerpo = '<form class="ljc-body" id="ljcOlvide" novalidate>' + campo("ljo-email", "Tu correo", 'type="email" autocomplete="email" required') +
        '<button class="ljc-btn red" type="submit">Enviarme el enlace</button>' + mensaje() +
        '<p class="ljc-hint"><a href="#" data-a="login">Volver</a></p></form>';
    } else {
      titulo = "Entrar";
      cuerpo = '<form class="ljc-body" id="ljcLogin" novalidate>' + gBtn() +
        campo("ljl-email", "Correo", 'type="email" autocomplete="username" required') +
        campo("ljl-pass", "Contraseña", 'type="password" autocomplete="current-password" required') +
        '<button class="ljc-btn silver" type="submit">Entrar</button>' + mensaje() +
        '<p class="ljc-hint"><a href="#" data-a="olvide">¿Olvidaste tu contraseña?</a></p>' +
        '<p class="ljc-hint">¿No tienes cuenta? <a href="#" data-a="registro">Créala aquí</a> · Es la misma de las rifas.</p></form>';
    }
    raiz.innerHTML = '<div class="ljc-back" data-a="cerrar"></div><aside class="ljc-panel" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
      '<header class="ljc-head"><h2>' + esc(titulo) + '</h2><button class="ljc-btn ghost sm" type="button" data-a="cerrar">Cerrar</button></header>' + cuerpo + '</aside>';
    if (document.getElementById("ljc-g")) montarGoogle();
  }
  function gBtn() { return GOOGLE_CLIENT_ID ? '<div id="ljc-g" class="ljc-g"></div><div class="ljc-sep"><span>o con tu correo</span></div>' : ""; }
  var gsi = null;
  function montarGoogle() {
    if (!gsi) gsi = new Promise(function (ok, no) {
      var sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
      sc.onload = ok; sc.onerror = function () { gsi = null; no(); }; document.head.appendChild(sc);
    });
    gsi.then(function () {
      var el = document.getElementById("ljc-g"); if (!el || !window.google) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: function (resp) {
        st.msg = "Entrando con Google…"; st.tipo = ""; pintar();
        entrarGoogle(resp.credential).then(trasEntrar).catch(function (e) { st.msg = errAuth(e && e.message); st.tipo = "err"; pintar(); });
      } });
      window.google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", locale: "es", width: 300 });
    }).catch(function () { /* sin conexión con Google */ });
  }

  /* ---------- eventos ---------- */
  function alClic(e) {
    var a = e.target.closest("[data-a]"); if (!a) return;
    var acc = a.getAttribute("data-a");
    if (acc === "cerrar") { e.preventDefault(); cerrar(); }
    else if (acc === "login" || acc === "registro" || acc === "olvide") { e.preventDefault(); st.modo = acc; st.msg = ""; pintar(); }
    else if (acc === "recargar") { e.preventDefault(); cerrar(); if (window.ljRecarga) window.ljRecarga.abrir(); }
    else if (acc === "salir") { try { if (window.ljAdminSalir) window.ljAdminSalir(); } catch (er) { /* nada */ } guardarSesion(null); st.perfil = null; st.modo = "login"; st.msg = "Cerraste sesión."; st.tipo = ""; pintar(); pintarBoton(); }
  }
  function leerCliente(pre) {
    var v = function (id) { var el = document.getElementById(pre + "-" + id); return el ? el.value.trim() : ""; };
    var d = { nombre: v("nombre").replace(/\s+/g, " ").slice(0, 40), whatsapp: v("wa"), tradelink: v("trade") };
    var stm = steamNorm(v("steam"));
    if (stm === "" && tradeValido(d.tradelink)) stm = steamDeTrade(d.tradelink);
    d.steam = stm;
    var err = !d.nombre ? ["nombre", "Escribe tu nombre o apodo."]
      : String(d.whatsapp).replace(/\D+/g, "").length < 6 ? ["wa", "Escribe tu WhatsApp (ej. 987 654 321)."]
      : !d.steam ? ["steam", d.steam === null ? "Tu ID de Steam son solo números (ej. 123456789) o el link de tu perfil." : "Escribe tu ID de Steam (código de amigo)."]
      : !tradeValido(d.tradelink) ? ["trade", "Pega tu trade link completo: https://steamcommunity.com/tradeoffer/new/?partner=…&token=…"] : null;
    if (err) { var el = document.getElementById(pre + "-" + err[0]); if (el) el.focus(); throw new Error("VALIDACION:" + err[1]); }
    return d;
  }
  function falla(e) {
    var m = String(e && e.message || "");
    st.msg = /^VALIDACION:/.test(m) ? m.slice(11) : /^PERFIL_/.test(m) ? "No se pudo guardar tu perfil (" + m + "). Avísanos por WhatsApp." : errAuth(m);
    st.tipo = "err";
    var out = raiz.querySelector(".ljc-msg"); if (out) { out.className = "ljc-msg err"; out.textContent = st.msg; }
  }
  function estado(txt) { st.msg = txt; st.tipo = ""; var out = raiz.querySelector(".ljc-msg"); if (out) { out.className = "ljc-msg"; out.textContent = txt; } }
  function alEnviar(e) {
    var f = e.target; e.preventDefault();
    try {
      if (f.id === "ljcLogin") {
        var em = document.getElementById("ljl-email").value.trim(), pw = document.getElementById("ljl-pass").value;
        if (!em || !pw) throw new Error("VALIDACION:Escribe tu correo y contraseña.");
        estado("Entrando…");
        entrar(em, pw).then(trasEntrar).catch(falla);
      } else if (f.id === "ljcOlvide") {
        var eo = document.getElementById("ljo-email").value.trim();
        if (!eo) throw new Error("VALIDACION:Escribe tu correo.");
        estado("Enviando…");
        auth("sendOobCode", { requestType: "PASSWORD_RESET", email: eo }).then(function () { estado("Listo. Revisa tu correo (y la carpeta de spam)."); }).catch(falla);
      } else if (f.id === "ljcRegistro") {
        var email = document.getElementById("ljr-email").value.trim(), pass = document.getElementById("ljr-pass").value;
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("VALIDACION:Escribe un correo válido.");
        if (pass.length < 6) throw new Error("VALIDACION:La contraseña debe tener al menos 6 caracteres.");
        var d = leerCliente("ljr"); d.email = email;
        estado("Creando tu cuenta…");
        crearUsuario(email, pass).then(function (s) { return crearPerfil(s, d); }, function (er) {
          if (!/EMAIL_EXISTS/.test(String(er && er.message))) throw er;
          // El correo ya existía: si la contraseña coincide, solo completamos el perfil que falte
          return entrar(email, pass).then(function (s) {
            return fs("rayas_users/" + encodeURIComponent(s.uid)).then(function (r) { if (r.status === 404) return crearPerfil(s, d); if (!r.ok) throw new Error("PERFIL_" + r.status); });
          });
        }).then(trasEntrar).catch(falla);
      } else if (f.id === "ljcCompletar") {
        var s = leerSesion(), dc = leerCliente("ljc"); dc.email = (s && s.email) || "";
        estado("Guardando…");
        crearPerfil(s, dc).then(trasEntrar).catch(falla);
      } else if (f.id === "ljcPerfil") {
        var dp = leerCliente("ljp");
        estado("Guardando…");
        var campos = ["nombre", "whatsapp", "tradelink", "steam"];
        fs("rayas_users/" + encodeURIComponent(leerSesion().uid) + "?" + campos.map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&") + "&currentDocument.exists=true", {
          method: "PATCH", body: JSON.stringify({ fields: { nombre: { stringValue: dp.nombre }, whatsapp: { stringValue: dp.whatsapp }, tradelink: { stringValue: dp.tradelink }, steam: { stringValue: dp.steam } } })
        }).then(function (r) {
          if (!r.ok) throw new Error("PERFIL_" + r.status);
          Object.assign(st.perfil, dp); compartirConPedido(st.perfil); pintarBoton(); pintar();
          estado("✔ Cambios guardados.");
        }).catch(falla);
      }
    } catch (er) { falla(er); }
  }

  // API para la tienda (pagar el carrito con créditos)
  window.ljCuenta = {
    sesion: leerSesion,
    perfil: function () { return st.perfil; },
    token: token,
    abrir: function (modo, msg) { if (msg) { st.msg = msg; st.tipo = ""; } abrir(modo); },
    recargar: cargarPerfil,
    salir: function () { try { if (window.ljAdminSalir) window.ljAdminSalir(); } catch (er) { /* nada */ } guardarSesion(null); st.perfil = null; st.modo = "login"; pintarBoton(); pintar(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
