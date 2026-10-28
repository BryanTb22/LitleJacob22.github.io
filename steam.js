/* =====================================================================
   ENTRAR CON STEAM (tienda y rifas)
   Lo comparten cuenta.js (tienda) y rifas.js (rifas). El inicio de sesión lo verifica el
   servidor (funciones steamIniciar / steamCallback, ver STEAM_LOGIN.md en Rayas Store);
   aquí solo se pide la dirección de Steam y, al volver, se canjea el token por la sesión
   (misma clave "lj_rifas_ses" y misma estructura que el login normal).
   ===================================================================== */
(function () {
  "use strict";
  var FB = { apiKey: "AIzaSyDbyLi7IK3ikwUp7A0VzRRqPucqRXPpL3E", projectId: "litlejacob-store" };
  var SES_KEY = "lj_rifas_ses";
  var URL_INICIAR = "https://us-central1-" + FB.projectId + ".cloudfunctions.net/steamIniciar";
  var LOGO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-9.96 9.1l5.35 2.2a2.8 2.8 0 0 1 1.6-.5h.15l2.38-3.45v-.05a3.75 3.75 0 1 1 3.75 3.75h-.09l-3.4 2.43a2.8 2.8 0 0 1-5.55.45L2.3 14.3A10 10 0 1 0 12 2zm-4.9 14.5-1.2-.5a2.1 2.1 0 0 0 4-.75 2.1 2.1 0 0 0-2.8-2l1.24.5a1.55 1.55 0 1 1-1.24 2.75zm8.9-5.1a2.5 2.5 0 1 0-2.5-2.5 2.5 2.5 0 0 0 2.5 2.5zm0-.95a1.55 1.55 0 1 1 1.55-1.55 1.55 1.55 0 0 1-1.55 1.55z"/></svg>';
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // tokenFn = función que devuelve una promesa con el idToken (para VINCULAR); null = entrar.
  function ir(tokenFn) {
    return (tokenFn ? tokenFn() : Promise.resolve(null)).then(function (tk) {
      var h = { "Content-Type": "application/json" }; if (tk) h.Authorization = "Bearer " + tk;
      return fetch(URL_INICIAR, { method: "POST", headers: h, body: JSON.stringify({ origen: location.origin, ruta: location.pathname }) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.error || "No se pudo conectar con Steam."); location.href = j.url; });
    });
  }

  var usado = false;
  // Lee la dirección al volver de Steam. Devuelve null si no hay nada, o { tipo, msg, pre, entrar }:
  //   tipo "error" | "vinculado" | "token" (entrar() canjea el token y devuelve una promesa con la sesión).
  function alCargar() {
    if (usado) return null;
    var h = String(location.hash || "").replace(/^#/, "");
    if (!/(^|&)(steamtoken|steam|steamerror)=/.test(h)) return null;
    usado = true;
    var o = {}; h.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) { try { o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignorar */ } } });
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* nada */ }
    if (o.steamerror) return { tipo: "error", msg: o.steamerror.slice(0, 160) };
    if (o.steam === "ok") return { tipo: "vinculado", msg: "✔ Steam vinculado a tu cuenta." };
    if (!o.steamtoken) return null;
    return {
      tipo: "token", pre: { sid: String(o.sid || "").replace(/\D/g, ""), nom: String(o.nom || "").slice(0, 40), av: imgOk(o.av) ? String(o.av) : "", pa: String(o.pa || "").replace(/[<>\u0000-\u001f]/g, "").slice(0, 60), pu: o.pu === "1" ? true : (o.pu === "0" ? false : null) },
      entrar: function () {
        return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + encodeURIComponent(FB.apiKey), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: o.steamtoken, returnSecureToken: true })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j.idToken) throw new Error((j.error && j.error.message) || "LOGIN_FAILED");
          var s = { id: j.idToken, ref: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000, email: "", uid: j.localId || null };
          try { localStorage.setItem(SES_KEY, JSON.stringify(s)); } catch (e) { /* sin almacenamiento */ }
          return s;
        });
      }
    };
  }

  // ID de Steam vinculado: el del perfil o, en cuentas nuevas con Steam, el que viene dentro del token.
  function vinculado(perfilSteamId) {
    if (perfilSteamId) return String(perfilSteamId);
    try {
      var s = JSON.parse(localStorage.getItem(SES_KEY) || "null");
      var c = JSON.parse(atob(s.id.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return String(c.steamId || "");
    } catch (e) { return ""; }
  }

  // Datos de Steam = texto externo: la foto solo si es https de Steam; el enlace solo si es de steamcommunity.com.
  function imgOk(u) { return /^https:\/\/[a-z0-9.-]+\.(steamstatic\.com|akamaihd\.net|steamusercontent\.com|steamcommunity\.com)\/[^\s"'<>]{1,300}$/i.test(String(u || "")); }
  function urlOk(u) { return /^https:\/\/steamcommunity\.com\/[^\s"'<>]{1,200}$/.test(String(u || "")); }
  // Campos extra del perfil (formato Firestore) para una cuenta nueva con Steam: se guardan al crear el perfil.
  function camposPerfil(pre) {
    var c = {}; if (!pre || !pre.sid) return c;
    c.steamId = { stringValue: pre.sid }; c.steamPerfilUrl = { stringValue: "https://steamcommunity.com/profiles/" + pre.sid };
    if (pre.av && imgOk(pre.av)) c.steamAvatar = { stringValue: pre.av };
    if (pre.pa) c.steamPais = { stringValue: pre.pa };
    if (typeof pre.pu === "boolean") c.steamPublico = { booleanValue: pre.pu };
    return c;
  }

  window.ljSteam = {
    imgOk: imgOk, urlOk: urlOk, camposPerfil: camposPerfil,
    logo: LOGO, ir: ir, alCargar: alCargar, vinculado: vinculado,
    boton: function (clase, acc) { return '<button type="button" class="' + clase + '" data-a="' + acc + '">' + LOGO + '<span>Entrar con Steam</span></button>'; },
    botonVincular: function (clase) { return '<button type="button" class="' + clase + '" data-a="steamVincular">' + LOGO + '<span>Vincular mi Steam</span></button>'; },
    bloqueVinculo: function (perfilSteamId, claseBtn, claseHint, claseGrp) {
      var v = vinculado(perfilSteamId);
      return '<div class="' + claseGrp + ' ljsteam-vinculo"><h3>Steam</h3>' + (v
        ? '<p class="' + claseHint + '" style="color:#6fd08c">✔ Steam vinculado (ID ' + esc(v) + '). Ya puedes entrar con «Entrar con Steam».</p>'
        : '<p class="' + claseHint + '">Vincula tu Steam y entra con un clic, sin contraseña. No pierdes tu saldo.</p>' + '<button type="button" class="' + claseBtn + '" data-a="steamVincular">' + LOGO + '<span>Vincular mi Steam</span></button>') + '</div>';
    }
  };
})();
