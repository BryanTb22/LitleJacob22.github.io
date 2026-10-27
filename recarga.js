/* =====================================================================
   RECARGA DE CRÉDITOS dentro de la tienda (Sets Caché / Inicio / Compro).
   Misma lógica que la de Rifas: el pago lo cobra la función "cobrar" (servidor),
   que decide el monto y los créditos. Aquí solo se muestra la ventana.
   El interruptor del admin (rayas/estado → pagos.culqi) decide si se paga con tarjeta;
   si está apagado, solo queda "Pagar por WhatsApp". Con ?pagotest=1 se ve siempre.
   ===================================================================== */
(function () {
  "use strict";
  var PROJ = "litlejacob-store";
  var PAGOS = { pk: "pk_test_iK8JCBNB6dJmRlUZ", min: 3, max: 500, minYape: 6,
    url: "https://us-central1-" + PROJ + ".cloudfunctions.net/cobrar", js: "https://checkout.culqi.com/js/v4",
    doc: "https://firestore.googleapis.com/v1/projects/" + PROJ + "/databases/(default)/documents/rayas/estado", wa: "51952997030" };
  var PACKS = [{ s: 10, b: 10 }, { s: 20, b: 20 }, { s: 50, b: 50, p: 55 }, { s: 100, b: 100, p: 110 }];
  var m = { sel: 0, err: "", vista: "monto", info: null, pagosOn: false }, raiz = null, culqiCarga = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api() { return window.ljCuenta; }
  function perfil() { var a = api(); return a && a.perfil && a.perfil(); }
  function creditosPara(s) {
    var pk = PACKS.filter(function (x) { return x.s === s; })[0];
    return pk && pk.p && perfil() && !perfil().promoUsada ? pk.p : s;
  }
  function leerToggle() {
    if (/[?&]pagotest=1(&|$)/.test(location.search)) return Promise.resolve(true);
    return fetch(PAGOS.doc, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var t = d && d.fields && d.fields.json && d.fields.json.stringValue;
      return !!(t && JSON.parse(t).pagos && JSON.parse(t).pagos.culqi === true);
    }).catch(function () { return false; });
  }
  function cargarCulqi() {
    if (window.Culqi) return Promise.resolve();
    if (!culqiCarga) culqiCarga = new Promise(function (ok, no) {
      var sc = document.createElement("script"); sc.src = PAGOS.js; sc.async = true; sc.onload = ok;
      sc.onerror = function () { culqiCarga = null; no(new Error("No se pudo cargar el pago. Revisa tu conexión e intenta de nuevo.")); };
      document.head.appendChild(sc);
    });
    return culqiCarga;
  }
  function wspLink() {
    var p = perfil() || {}, s = m.sel;
    var t = "¡Hola! 👋 Soy *" + (p.nombre || "cliente") + "* (📧 " + (p.email || "") + ").\n\n💎 Quiero recargar créditos en *LitleJacob Store*" +
      (s ? ": *S/ " + s + "* (" + creditosPara(s) + " créditos)." : ".") + "\n\n¿Me ayudas con mi recarga? 🙏";
    return "https://wa.me/" + PAGOS.wa + "?text=" + encodeURIComponent(t);
  }

  function pintar() {
    if (!raiz) return;
    var p = perfil(), primera = !!(p && !p.promoUsada), h = "";
    if (m.vista === "cargando") h = '<h3>Procesando…</h3><p class="rc-h">Un momento por favor. No cierres esta ventana.</p>';
    else if (m.vista === "ok") h = '<h3>¡Recarga lista! 🎉</h3><p class="rc-h">Se sumaron <b>' + m.info.creditos + '</b> créditos' + (m.info.promo ? ' (incluye tu regalo de primera recarga 🎁)' : '') +
      '. Ahora tienes <b>' + (p ? p.creditos : "") + '</b>.</p><button class="rc-btn gold" data-a="cerrar" type="button">Seguir comprando</button>';
    else if (m.vista === "error") h = '<h3>No se pudo completar</h3><p class="rc-h" role="alert">' + esc(m.err) + '</p><button class="rc-btn gold" data-a="volver" type="button">Volver</button><button class="rc-btn ghost" data-a="cerrar" type="button">Cerrar</button>';
    else {
      var sel = m.sel;
      h = '<h3>Recargar créditos 💎</h3>' +
        (primera ? '<div class="rc-promo"><b>🎁 PROMO PRIMERA RECARGA</b><span>S/ 50 → <b>55</b> créditos · S/ 100 → <b>110</b> créditos</span></div>' : '') +
        '<p class="rc-h"><b>1.</b> Elige cuánto quieres recargar (S/ 1 = 1 crédito)</p><div class="rc-packs">' +
        PACKS.map(function (pk) {
          var ex = primera && pk.p ? pk.p : 0;
          return '<button type="button" class="rc-pack' + (ex ? ' promo' : '') + (sel === pk.s ? ' sel' : '') + '" data-a="monto" data-s="' + pk.s + '">' +
            (ex ? '<i>🎁 +' + (ex - pk.b) + ' GRATIS</i>' : '') + '<b>S/ ' + pk.s + '</b><span>' + (ex || pk.b) + ' créditos</span></button>';
        }).join("") + '</div>' +
        '<div class="rc-otro"><label for="rcOtro">Otro monto (S/ ' + PAGOS.min + ' a S/ ' + PAGOS.max + ')</label><div class="rc-row"><input id="rcOtro" type="number" inputmode="numeric" min="' + PAGOS.min + '" max="' + PAGOS.max + '" step="1" placeholder="Ej. 30">' +
        '<button class="rc-btn ghost sm" type="button" data-a="otro">Usar</button></div></div>' +
        (m.err ? '<p class="rc-err" role="alert">' + esc(m.err) + '</p>' : '') +
        (sel ? '<p class="rc-res">Pagas <b>S/ ' + sel + '</b> y recibes <b>' + creditosPara(sel) + ' créditos</b>' + (creditosPara(sel) > sel ? ' 🎁' : '') + '</p><p class="rc-h"><b>2.</b> Elige cómo quieres pagar</p>' : '') +
        (sel && m.pagosOn ? '<button class="rc-btn red" type="button" data-a="pagar">💳 Pagar con tarjeta · al instante</button>' : '') +
        (sel ? '<a class="rc-btn gold" href="' + esc(wspLink()) + '" target="_blank" rel="noopener">💬 Pagar por WhatsApp</a>' : '') +
        (m.pagosOn ? '<p class="rc-note">Tarjeta: pago seguro con Culqi desde S/ ' + PAGOS.min + ', tus créditos se suman solos. <b>Yape / QR: desde S/ ' + PAGOS.minYape + '</b> (si no te aparece en el pago, usa tarjeta o WhatsApp).</p>' +
          '<p class="rc-note">¿Montos menores a S/ ' + PAGOS.minYape + ' con Yape, o prefieres pagar con una persona? Elige <b>Pagar por WhatsApp</b> y te atiende el encargado, que carga tus créditos él mismo.</p>'
          : '<p class="rc-note">Elige el monto y pídelo por WhatsApp: el encargado carga tus créditos él mismo.</p>') +
        '<button class="rc-btn ghost" type="button" data-a="cerrar">Cerrar</button>';
    }
    raiz.querySelector(".rc-box").innerHTML = h;
  }
  function montar() {
    if (raiz) return;
    var st = document.createElement("style");
    st.textContent = ".rc{position:fixed;inset:0;z-index:130;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72)}.rc[hidden]{display:none}" +
      ".rc-box{width:min(460px,100%);max-height:92vh;overflow-y:auto;display:grid;gap:12px;padding:22px;background:#131316;border:1px solid #3d3f45;box-shadow:0 24px 70px rgba(0,0,0,.6);font-family:Inter,system-ui,sans-serif;color:#f4f5f7}" +
      ".rc-box h3{margin:0;text-align:center;font:700 26px Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.03em}.rc-h{margin:0;font-size:13.5px;color:#c4c8ce;text-align:center}" +
      ".rc-promo{display:grid;gap:2px;text-align:center;padding:10px;border:1px solid #8a6a2a;background:linear-gradient(90deg,#4a1b3b,#4a3a17);font-size:13px}.rc-promo b{letter-spacing:.06em}" +
      ".rc-packs{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rc-pack{position:relative;display:grid;gap:2px;justify-items:center;padding:20px 8px 12px;border:0;cursor:pointer;color:#14141a;font-family:inherit;background:linear-gradient(180deg,#f4f5f7,#aeb3ba)}" +
      ".rc-pack b{font:700 24px Oswald,Impact,sans-serif}.rc-pack span{font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.rc-pack.promo{color:#fff;background:linear-gradient(180deg,#e0343d,#8e0f16)}" +
      ".rc-pack i{position:absolute;top:5px;font-style:normal;font-size:10px;font-weight:800;background:#fff;color:#8e0f16;padding:1px 8px;border-radius:9px}.rc-pack.sel{outline:3px solid #e8c26a}" +
      ".rc-otro{display:grid;gap:6px;text-align:center;font-size:13px}.rc-row{display:flex;gap:8px}.rc-row input{flex:1;padding:11px 12px;background:#1b1b1f;border:1px solid #3d3f45;color:#fff;font:inherit}" +
      ".rc-btn{display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;padding:13px 16px;font:800 13px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:#fff;background:#2a2b30}" +
      ".rc-btn.red{background:linear-gradient(180deg,#e0343d,#8e0f16)}.rc-btn.gold{background:linear-gradient(180deg,#e8c26a,#b98a2a);color:#1a1205}.rc-btn.ghost{background:transparent;box-shadow:inset 0 0 0 1px #3d3f45;color:#c4c8ce}.rc-btn.sm{padding:0 16px}" +
      ".rc-res{margin:0;text-align:center;font-size:15px}.rc-err{margin:0;color:#ff6b73;font-size:13px;text-align:center}.rc-note{margin:0;font-size:12px;color:#8b9097;text-align:center;line-height:1.45}";
    document.head.appendChild(st);
    raiz = document.createElement("div"); raiz.className = "rc"; raiz.hidden = true;
    raiz.innerHTML = '<div class="rc-box"></div>'; document.body.appendChild(raiz);
    raiz.addEventListener("click", function (ev) {
      var t = ev.target; if (t === raiz) { cerrar(); return; }
      var b = t.closest("[data-a]"); if (!b) return; var a = b.getAttribute("data-a");
      if (a === "cerrar") cerrar();
      else if (a === "volver") { m.vista = "monto"; m.err = ""; pintar(); }
      else if (a === "monto") { m.sel = Number(b.getAttribute("data-s")); m.err = ""; pintar(); }
      else if (a === "otro") {
        var v = Number((raiz.querySelector("#rcOtro") || {}).value);
        if (!(v >= PAGOS.min && v <= PAGOS.max) || Math.floor(v) !== v) { m.err = "Escribe un monto entero entre S/ " + PAGOS.min + " y S/ " + PAGOS.max + "."; m.sel = 0; }
        else { m.sel = v; m.err = ""; }
        pintar();
      } else if (a === "pagar") pagar(m.sel);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !raiz.hidden) cerrar(); });
  }
  function cerrar() { raiz.hidden = true; document.documentElement.style.overflow = ""; }
  function pagar(soles) {
    m.vista = "cargando"; pintar();
    cargarCulqi().then(function () {
      var C = window.Culqi;
      window.culqi = function () {
        if (C.token && C.token.id) { var tid = C.token.id; try { C.close(); } catch (e) { /* ya cerrada */ } cobrar(soles, tid); }
        else { m.vista = "error"; m.err = (C.error && (C.error.user_message || C.error.merchant_message)) || "No se pudo procesar el pago."; raiz.hidden = false; pintar(); }
      };
      C.publicKey = PAGOS.pk;
      C.settings({ title: "LitleJacob Store", currency: "PEN", description: "Recarga de créditos", amount: soles * 100 });
      C.options({ lang: "es", installments: false, paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false } });
      raiz.hidden = true; C.open();
    }).catch(function (e) { m.vista = "error"; m.err = (e && e.message) || "No se pudo abrir el pago."; pintar(); });
  }
  function cobrar(soles, tokenId) {
    raiz.hidden = false; m.vista = "cargando"; pintar();
    api().token().then(function (tk) {
      return fetch(PAGOS.url, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify({ soles: soles, tokenId: tokenId }) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok || !x.j.ok) throw new Error(x.j.error || "No se pudo confirmar el pago. Si te cobraron, escríbenos por WhatsApp con tu correo; no pagues otra vez.");
        m.info = { creditos: x.j.creditos, promo: !!x.j.promo };
        return api().recargar();
      }).then(function () { m.vista = "ok"; pintar(); })
      .catch(function (e) { m.vista = "error"; m.err = (e && e.message) || "No se pudo completar el pago."; pintar(); });
  }
  function abrir() {
    montar();
    var a = api();
    if (!a || !a.sesion()) { a && a.abrir("registro", "Para recargar primero crea tu cuenta (o entra si ya tienes una)."); return; }
    if (!perfil()) { a.abrir("perfil"); return; }
    m.sel = 0; m.err = ""; m.vista = "monto";
    leerToggle().then(function (on) { m.pagosOn = on; pintar(); });
    m.pagosOn = false; pintar(); raiz.hidden = false;
  }
  window.ljRecarga = { abrir: abrir };
})();
