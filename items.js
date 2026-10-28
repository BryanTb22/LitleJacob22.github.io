/* =====================================================================
   COMPRAR ITEMS y VENDER ITEMS en LitleJacob Store (página principal)
   - Catálogo compartido con Rayas Store (colección rayas_items) y la misma cuenta de cliente.
   - El administrador es la cuenta con ADMIN_UID: al entrar con ella aparecen los botones de agregar/editar.
   - Autocompletar desde un link del Mercado de Steam: función itemSteam (solo admin).
   - Vender items: el cliente pega su trade link, ve su inventario y el precio al que se lo compramos.
   ===================================================================== */
(function () {
  "use strict";
  const FB = { apiKey: "AIzaSyDbyLi7IK3ikwUp7A0VzRRqPucqRXPpL3E", projectId: "litlejacob-store" };
  const BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/";
  const DOC_URL = BASE + "rayas/estado";
  const ADMIN_UID = "eLEZkdXiG5b0PpxHQCCei8D0Qxy1";
  const ITEMS_URL = "https://compraritem-seqcayr4iq-uc.a.run.app";
  const INV_URL = "https://inventario-seqcayr4iq-uc.a.run.app";
  const STEAM_URL = "https://us-central1-" + FB.projectId + ".cloudfunctions.net/itemSteam";
  const WA = "51952997030";
  const TIENDA = "LITLEJACOB STORE";
  const TRADE_AYUDA = '<a href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" target="_blank" rel="noopener">¿Dónde encuentro mi link?</a>';

  const ITEM_TIPOS = ["Wearable", "Courier", "Ward", "HUD Skin", "Announcer", "Bundle", "Loading Screen", "Pennant", "Sticker", "Otro"];
  const ITEM_CALIDADES = ["Standard", "Genuine", "Unusual", "Inscribed", "Autographed", "Heroic", "Corrupted", "Frozen", "Cursed", "Infused", "Exalted"];
  const LISTA_RAREZAS = ["ARCANO", "INMORTAL", "LEGENDARIO", "MÍTICO", "RARO", "POCO COMÚN", "COMÚN"];
  const RAREZAS = { "ARCANO": "#ade55c", "INMORTAL": "#e4ae39", "LEGENDARIO": "#d32ce6", "MÍTICO": "#8847ff", "RARO": "#4b69ff", "POCO COMÚN": "#5e98d9", "COMÚN": "#b0c3d9" };
  const HEROES_DOTA = ["Abaddon", "Alchemist", "Ancient Apparition", "Anti-Mage", "Arc Warden", "Axe", "Bane", "Batrider", "Beastmaster", "Bloodseeker", "Bounty Hunter", "Brewmaster", "Bristleback", "Broodmother", "Centaur Warrunner", "Chaos Knight", "Chen", "Clinkz", "Clockwerk", "Crystal Maiden", "Dark Seer", "Dark Willow", "Dawnbreaker", "Dazzle", "Death Prophet", "Disruptor", "Doom", "Dragon Knight", "Drow Ranger", "Earth Spirit", "Earthshaker", "Elder Titan", "Ember Spirit", "Enchantress", "Enigma", "Faceless Void", "Grimstroke", "Gyrocopter", "Hoodwink", "Huskar", "Invoker", "Io", "Jakiro", "Juggernaut", "Keeper of the Light", "Kez", "Kunkka", "Largo", "Legion Commander", "Leshrac", "Lich", "Lifestealer", "Lina", "Lion", "Lone Druid", "Luna", "Lycan", "Magnus", "Marci", "Mars", "Medusa", "Meepo", "Mirana", "Monkey King", "Morphling", "Muerta", "Naga Siren", "Nature's Prophet", "Necrophos", "Night Stalker", "Nyx Assassin", "Ogre Magi", "Omniknight", "Oracle", "Outworld Destroyer", "Pangolier", "Phantom Assassin", "Phantom Lancer", "Phoenix", "Primal Beast", "Puck", "Pudge", "Pugna", "Queen of Pain", "Razor", "Riki", "Ringmaster", "Rubick", "Sand King", "Shadow Demon", "Shadow Fiend", "Shadow Shaman", "Silencer", "Skywrath Mage", "Slardar", "Slark", "Snapfire", "Sniper", "Spectre", "Spirit Breaker", "Storm Spirit", "Sven", "Techies", "Templar Assassin", "Terrorblade", "Tidehunter", "Timbersaw", "Tinker", "Tiny", "Treant Protector", "Troll Warlord", "Tusk", "Underlord", "Undying", "Ursa", "Vengeful Spirit", "Venomancer", "Viper", "Visage", "Void Spirit", "Warlock", "Weaver", "Windranger", "Winter Wyvern", "Witch Doctor", "Wraith King", "Zeus"];
  const SLOTS_DOTA = ["Ability 1", "Ability 2", "Ability 3", "Ability 4", "Ancient", "Announcer", "Armor", "Arms", "Back", "Belt", "Body - Head", "Costume", "Courier", "Cursor Pack", "Dire Creeps", "Dire Siege Creeps", "Dire Towers", "Gloves", "HUD Skin", "Head", "Hero Base", "Heroic Effigy", "Legs", "Loading Screen", "Mega-Kill Announcer", "Misc", "Mount", "Multikill Banner", "Music", "N/A", "Neck", "Off-Hand", "Radiant Creeps", "Radiant Siege Creeps", "Radiant Towers", "Shapeshift", "Shoulder", "Summoned Unit", "Tail", "Taunt", "Terrain", "Ultimate", "Versus Screen", "Voice", "Ward", "Weapon", "Weather"];

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtPrecio = (n) => "S/ " + (Math.round(Number(n) * 100) / 100).toFixed(2).replace(/\.00$/, "");
  const soloDigitos = (s) => String(s || "").replace(/\D+/g, "");
  const colorRareza = (r) => RAREZAS[String(r || "").toUpperCase()] || "#d4af37";
  const MOVIL = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // La app de WhatsApp para Windows daña los emojis del enlace: en PC se envía sin emojis.
  const sinEmojis = (t) => String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/ +\n/g, "\n").replace(/^ +/gm, "");
  const waLink = (texto) => "https://wa.me/" + WA + "?text=" + encodeURIComponent(MOVIL ? texto : sinEmojis(texto));
  function safeImg(src) {
    src = String(src || "").trim();
    if (/^img\/[\w.\-]+$/.test(src)) return src;
    if (/^https:\/\/[^\s"'<>()]+$/.test(src)) return src.replace(/(steamstatic\.com\/economy\/image\/[^\s"'<>()]+)\/(\d+)fx(\d+)f$/, (m, a, w) => (Number(w) > 256 ? a + "/256fx256f" : m));
    return "";
  }

  /* ---------- sesión (la maneja cuenta.js) ---------- */
  const cuenta = () => window.ljCuenta || null;
  const sesion = () => { const c = cuenta(); return c && c.sesion ? c.sesion() : null; };
  const perfil = () => { const c = cuenta(); return c && c.perfil ? c.perfil() : null; };
  const esAdmin = () => { const s = sesion(); return !!(s && s.uid === ADMIN_UID); };
  const token = () => { const c = cuenta(); return c && c.token ? c.token() : Promise.reject(new Error("NO_SESSION")); };
  function fsPedir(ruta, opts) {
    return token().then((tk) => {
      opts = opts || {};
      opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tk };
      return fetch(BASE + ruta, opts);
    });
  }

  /* ---------- imágenes (fs:img-… guardadas en Firestore, o https) ---------- */
  const IMG_CACHE = {}, IMG_PEND = {};
  const esFs = (src) => /^fs:img-[\w\-]+$/.test(String(src || ""));
  function imgTag(src, alt, extra) {
    if (esFs(src)) {
      const id = src.slice(3);
      return '<img data-fs="' + esc(id) + '"' + (IMG_CACHE[id] ? ' src="' + IMG_CACHE[id] + '"' : "") + ' alt="' + esc(alt) + '"' + (extra || "") + ">";
    }
    const u = safeImg(src);
    return u ? '<img src="' + esc(u) + '" alt="' + esc(alt) + '" decoding="async"' + (extra || "") + ">" : "";
  }
  function hidratarImgs() {
    document.querySelectorAll(".itx img[data-fs]:not([src]), #itxModal img[data-fs]:not([src])").forEach((el) => {
      const id = el.getAttribute("data-fs");
      if (IMG_CACHE[id]) { el.src = IMG_CACHE[id]; return; }
      if (!IMG_PEND[id]) IMG_PEND[id] = fetch(BASE + "rayas/" + id).then((r) => (r.ok ? r.json() : null)).then((d) => {
        const u = d && d.fields && d.fields.data && d.fields.data.stringValue;
        if (u && /^data:image\/(webp|jpeg|png);base64,/.test(u)) IMG_CACHE[id] = u;
        return IMG_CACHE[id];
      }).catch(() => null);
      IMG_PEND[id].then((u) => { if (u) document.querySelectorAll('img[data-fs="' + id + '"]').forEach((x) => { x.src = u; }); });
    });
  }
  // Achica la foto en el navegador y la guarda como documento en Firestore.
  function subirImagen(file, maxPx) {
    return new Promise((ok, fail) => {
      if (!file || !/^image\//.test(file.type)) return fail(new Error("Elige un archivo de imagen (JPG, PNG o WEBP)."));
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const max = maxPx || 720, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        let q = 0.85, data = cv.toDataURL("image/webp", q);
        if (data.indexOf("data:image/webp") !== 0) data = cv.toDataURL("image/png");
        while (data.length > 650000 && q > 0.3) { q -= 0.15; data = cv.toDataURL("image/webp", q); }
        if (data.length > 900000) return fail(new Error("La imagen es demasiado pesada. Prueba con una más pequeña."));
        ok(data);
      };
      im.onerror = () => { URL.revokeObjectURL(url); fail(new Error("No se pudo leer la imagen.")); };
      im.src = url;
    }).then((data) => {
      const id = "img-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return fsPedir("rayas/" + id, { method: "PATCH", body: JSON.stringify({ fields: { data: { stringValue: data } } }) }).then((r) => {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Tu sesión no tiene permiso. Vuelve a entrar con la cuenta de administrador." : "No se pudo subir (" + r.status + ").");
        IMG_CACHE[id] = data;
        return "fs:" + id;
      });
    });
  }

  /* ---------- estado ---------- */
  const items = { lista: [], cargado: false, cargando: false, err: "" };
  const filtros = { q: "", min: "", max: "", tipo: "", heroe: "", ranura: "", rareza: "", calidad: "", orden: "nuevo", limite: 24 };
  const ven = { link: "", cargando: false, err: "", lista: null, noTrad: 0, sel: {}, precios: [], pCargado: false, pCargando: false, q: "", f: { tipo: "", heroe: "", ranura: "", rareza: "", calidad: "", min: "", max: "", orden: "mayor" } };
  const adm = { form: null, msg: "", guardando: false, subiendo: false, steamCargando: false, steamInfo: "", itemDel: null, cp: {} };
  const sec = { cargado: false, items: false };   // sección visible para clientes (rayas/estado → secciones.items)
  let modal = null;

  const itemPorId = (id) => items.lista.find((x) => x.id === id) || null;
  function distintos(k, base) {
    const set = {}, out = [];
    (base || []).concat(items.lista.map((x) => x[k])).forEach((v) => { if (v && !set[v]) { set[v] = 1; out.push(v); } });
    return out.sort((a, b) => a.localeCompare(b));
  }
  const COLOR_OPCION = { "ARCANO": "#ade55c", "INMORTAL": "#e4ae39", "LEGENDARIO": "#e455f5", "MÍTICO": "#a37dff", "RARO": "#6f8aff", "POCO COMÚN": "#7db3ec", "COMÚN": "#c3d2e3" };
  const opciones = (lista, sel, vacio) => '<option value="">' + esc(vacio) + "</option>" + lista.map((v) => '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + (COLOR_OPCION[v] ? ' style="color:' + COLOR_OPCION[v] + ';font-weight:700"' : "") + ">" + esc(v) + "</option>").join("");

  /* ---------- datos de items ---------- */
  function itemDeDoc(d) {
    const f = (d && d.fields) || {};
    const sv = (k) => (f[k] && f[k].stringValue) || "";
    const nv = (k) => (f[k] ? Number(f[k].doubleValue !== undefined ? f[k].doubleValue : (f[k].integerValue || 0)) : 0);
    return { id: d.name.split("/").pop(), nombre: sv("nombre"), img: sv("img"), precio: nv("precio"), stock: f.stock ? nv("stock") : 1,
      tipo: sv("tipo"), heroe: sv("heroe"), ranura: sv("ranura"), rareza: sv("rareza"), calidad: sv("calidad"),
      estilos: nv("estilos"), estOk: sv("estOk"),
      activo: f.activo ? f.activo.booleanValue !== false : true, creado: (f.creado && f.creado.timestampValue) || "" };
  }
  function itemAFields(it) {
    const s = (v) => ({ stringValue: String(v || "") });
    return { fields: { nombre: s(it.nombre), img: s(it.img), precio: { doubleValue: Number(it.precio) }, stock: { integerValue: String(Math.max(0, Math.floor(Number(it.stock) || 0))) },
      tipo: s(it.tipo), heroe: s(it.heroe), ranura: s(it.ranura), rareza: s(it.rareza), calidad: s(it.calidad),
      estilos: { integerValue: String(Math.max(0, Math.min(8, Math.floor(Number(it.estilos) || 0)))) }, estOk: s(it.estOk),
      activo: { booleanValue: it.activo !== false }, creado: { timestampValue: it.creado || new Date().toISOString() } } };
  }
  function cargarItems(forzar) {
    if (items.cargando || (items.cargado && !forzar)) return;
    items.cargando = true; items.err = "";
    const acc = [];
    const pag = (t) => fetch(BASE + "rayas_items?pageSize=300" + (t ? "&pageToken=" + encodeURIComponent(t) : ""), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("No se pudo cargar el catálogo (" + r.status + ").");
      return r.json();
    }).then((j) => {
      (j.documents || []).forEach((d) => acc.push(itemDeDoc(d)));
      return j.nextPageToken && acc.length < 2000 ? pag(j.nextPageToken) : null;
    });
    pag("").then(() => { items.lista = acc; items.cargado = true; }).catch((e) => { items.err = e.message || "No se pudo cargar el catálogo."; })
      .then(() => { items.cargando = false; renderTodo(); });
  }
  function cargarSecciones() {
    fetch(DOC_URL, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      try { const j = JSON.parse(d.fields.json.stringValue); sec.items = !!(j.secciones && j.secciones.items); } catch (e) { sec.items = false; }
    }).catch(() => { /* sin dato: queda oculto */ }).then(() => { sec.cargado = true; renderTodo(); });
  }
  const visible = () => esAdmin() || sec.items;

  /* ---------- estilos (Estilo 1, Estilo 2 (Bloqueado)…) ---------- */
  const estilosOkLista = (it) => String(it.estOk || "").split(",").map((x) => parseInt(x, 10)).filter((x) => x > 0);
  function estilosHtml(it) {
    const n = Math.max(0, Math.min(8, Math.floor(Number(it.estilos) || 0)));
    if (n < 1) return "";
    const ok = estilosOkLista(it);
    let h = '<div class="itx-estilos"><b>Estilos:</b>';
    for (let k = 1; k <= n; k++) h += ok.indexOf(k) >= 0 ? '<span class="est">Estilo ' + k + "</span>" : '<span class="est lock">Estilo ' + k + " (Bloqueado)</span>";
    return h + "</div>";
  }

  /* ---------- filtros y tarjetas ---------- */
  function itemsFiltrados() {
    const q = sinTildes(filtros.q), mn = parseFloat(filtros.min), mx = parseFloat(filtros.max), admin = esAdmin();
    const l = items.lista.filter((it) => {
      if (!it.activo && !admin) return false;
      if (filtros.tipo && it.tipo !== filtros.tipo) return false;
      if (filtros.heroe && it.heroe !== filtros.heroe) return false;
      if (filtros.ranura && it.ranura !== filtros.ranura) return false;
      if (filtros.rareza && it.rareza !== filtros.rareza) return false;
      if (filtros.calidad && it.calidad !== filtros.calidad) return false;
      if (isFinite(mn) && it.precio < mn) return false;
      if (isFinite(mx) && it.precio > mx) return false;
      if (q && sinTildes(it.nombre + " " + it.heroe + " " + it.tipo).indexOf(q) < 0) return false;
      return true;
    });
    l.sort((a, b) => {
      if (filtros.orden === "menor") return a.precio - b.precio;
      if (filtros.orden === "mayor") return b.precio - a.precio;
      if (filtros.orden === "nombre") return a.nombre.localeCompare(b.nombre);
      return String(b.creado).localeCompare(String(a.creado));
    });
    return l;
  }
  function itemCardHtml(it) {
    const agot = it.stock <= 0, col = colorRareza(it.rareza), admin = esAdmin();
    return '<article class="itx-card' + (agot ? " agot" : "") + (it.activo ? "" : " oculto") + '" data-itx="ver" data-id="' + esc(it.id) + '" tabindex="0" role="button" aria-label="Ver ' + esc(it.nombre) + '">' +
      '<div class="itx-thumb" style="--rar:' + col + '">' + (imgTag(it.img, it.nombre, ' loading="lazy"') || '<span class="sinfoto">Sin foto</span>') +
      (agot ? '<span class="itx-tag agotado">Agotado</span>' : (it.stock > 1 ? '<span class="itx-tag">x' + it.stock + "</span>" : "")) + (it.activo ? "" : '<span class="itx-tag oc">Oculto</span>') + "</div>" +
      (admin ? '<div class="itx-admb"><button type="button" class="itx-btn ghost sm" data-itx="editar" data-id="' + esc(it.id) + '" aria-label="Editar">✎</button>' +
        (adm.itemDel === it.id ? '<button type="button" class="itx-btn sm del" data-itx="borrarSi" data-id="' + esc(it.id) + '">¿Quitar? Sí</button>' : '<button type="button" class="itx-btn ghost sm" data-itx="borrar" data-id="' + esc(it.id) + '" aria-label="Quitar">🗑</button>') + "</div>" : "") +
      '<div class="itx-body"><h4>' + esc(it.nombre) + "</h4>" +
      '<div class="itx-meta">' + (it.rareza ? '<span style="color:' + col + '">' + esc(it.rareza) + "</span>" : "") + (it.calidad ? "<span>" + esc(it.calidad) + "</span>" : "") + (it.heroe ? "<span>" + esc(it.heroe) + "</span>" : "") + "</div>" +
      '<div class="itx-price"><b>' + fmtPrecio(it.precio) + '</b><span class="itx-buy">' + (agot ? "Agotado" : "Comprar") + "</span></div></div></article>";
  }
  function gridHtml() {
    if (items.err) return '<div class="itx-empty"><strong>No se pudo cargar</strong><span>' + esc(items.err) + "</span></div>";
    if (!items.cargado) return '<div class="itx-empty"><strong>Cargando items…</strong></div>';
    const l = itemsFiltrados();
    if (!l.length) return '<div class="itx-empty"><strong>' + (items.lista.length ? "Ningún item coincide" : "Pronto nuevos items") + "</strong><span>" + (items.lista.length ? "Prueba con otros filtros." : "Estamos subiendo el catálogo.") + "</span></div>";
    return '<div class="itx-grid">' + l.slice(0, filtros.limite).map(itemCardHtml).join("") + "</div>" +
      (l.length > filtros.limite ? '<div style="text-align:center;margin-top:18px"><button class="itx-btn ghost" type="button" data-itx="mas">Ver más (' + (l.length - filtros.limite) + ")</button></div>" : "");
  }
  function pintarGrid() {
    const g = document.getElementById("itxGrid"); if (!g) return;
    g.innerHTML = gridHtml(); hidratarImgs();
    const c = document.getElementById("itxCuenta"); if (c) c.textContent = items.cargado ? itemsFiltrados().length + " items" : "";
  }

  /* ---------- Comprar items: vista ---------- */
  function cabecera(kicker, t1, t2, sub) {
    return '<div class="crumb"><a href="#inicio">Inicio</a> <span>›</span> <span>' + esc(t1 + " " + t2) + "</span></div>" +
      '<header class="text-center mb-8 sm:mb-10"><div class="hero-kicker">' + esc(kicker) + '</div><h1 class="font-cinzel font-extrabold text-2xl sm:text-4xl md:text-5xl tracking-wider gold-gradient-text uppercase leading-tight">' + esc(t1) + " " + esc(t2) + "</h1>" +
      '<div class="ornamental-divider"><div class="ornamental-dot"></div><div class="ornamental-line-left"></div><div class="ornamental-diamond"></div><div class="ornamental-line-right"></div><div class="ornamental-dot"></div></div>' +
      '<p class="mt-2 text-xs sm:text-sm text-stone-300 max-w-xl mx-auto">' + sub + "</p></header>";
  }
  const aviso = () => (sec.items ? "" : '<p class="itx-hint" style="text-align:center">🔒 Esta sección está oculta: solo tú (administrador) la ves. Actívala con el interruptor de abajo cuando esté lista.</p>');
  function switchSeccion() {
    if (!esAdmin()) return "";
    return '<label class="itx-chk" style="justify-content:center;margin:6px 0 14px"><input type="checkbox" data-itx="secciones"' + (sec.items ? " checked" : "") + '> Mostrar “Comprar items” y “Vender items” a los clientes (también en Rayas Store)</label>';
  }
  function comprarHtml() {
    if (!visible()) return cabecera("Catálogo", "Comprar", "items", "Esta sección estará disponible pronto.");
    const tabs = ['<button type="button" class="itx-tab' + (!filtros.tipo ? " on" : "") + '" data-itx="tipo" data-v="">Todos</button>'].concat(ITEM_TIPOS.map((t) =>
      '<button type="button" class="itx-tab' + (filtros.tipo === t ? " on" : "") + '" data-itx="tipo" data-v="' + esc(t) + '">' + esc(t) + "</button>")).join("");
    const filt = '<aside class="itx-filt"><details' + (window.innerWidth > 820 ? " open" : "") + "><summary>Filtros</summary>" +
      '<div class="ff"><label>Precio (S/)</label><div class="ff2"><input id="itx-min" inputmode="decimal" placeholder="Desde" value="' + esc(filtros.min) + '"><input id="itx-max" inputmode="decimal" placeholder="Hasta" value="' + esc(filtros.max) + '"></div></div>' +
      '<div class="ff"><label for="itx-heroe">Héroe</label><select id="itx-heroe">' + opciones(distintos("heroe", HEROES_DOTA), filtros.heroe, "Todos") + "</select></div>" +
      '<div class="ff"><label for="itx-ranura">Ranura</label><select id="itx-ranura">' + opciones(distintos("ranura", SLOTS_DOTA), filtros.ranura, "Todas") + "</select></div>" +
      '<div class="ff"><label for="itx-rareza">Rareza</label><select id="itx-rareza">' + opciones(LISTA_RAREZAS, filtros.rareza, "Todas") + "</select></div>" +
      '<div class="ff"><label for="itx-calidad">Calidad</label><select id="itx-calidad">' + opciones(distintos("calidad", ITEM_CALIDADES), filtros.calidad, "Todas") + "</select></div>" +
      '<button type="button" class="itx-btn ghost sm" data-itx="reset" style="width:100%">Restablecer filtros</button></details></aside>';
    return cabecera("Catálogo", "Comprar", "items", "Elige tu item y págalo con créditos o por WhatsApp.") + aviso() + switchSeccion() +
      (esAdmin() ? '<div class="itx-admin"><b>Modo administrador</b><button type="button" class="itx-btn gold sm" data-itx="nuevo">+ Agregar item</button><span class="itx-hint">Pasa por una tarjeta y usa ✎ para editar o 🗑 para quitarla. Los cambios se guardan al instante.</span></div>' + formHtml() : "") +
      '<div class="itx-tabs">' + tabs + "</div>" +
      '<div class="itx-shop">' + filt + '<div class="itx-main"><div class="itx-bar"><input id="itx-q" type="search" placeholder="Buscar items…" value="' + esc(filtros.q) + '" autocomplete="off">' +
      '<select id="itx-orden" aria-label="Ordenar">' + [["nuevo", "Más nuevos"], ["menor", "Precio: menor a mayor"], ["mayor", "Precio: mayor a menor"], ["nombre", "Nombre A-Z"]].map((o) => '<option value="' + o[0] + '"' + (filtros.orden === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>" +
      '<span class="itx-count" id="itxCuenta"></span></div><div id="itxGrid">' + gridHtml() + "</div></div></div>";
  }

  /* ---------- Admin: formulario de item ---------- */
  const nuevoForm = () => ({ id: "", nombre: "", img: "", precio: "", stock: "1", tipo: "Wearable", heroe: "", ranura: "", rareza: "", calidad: "", estilos: "0", estOk: "1", activo: true, creado: "", link: "" });
  function formHtml() {
    const F = adm.form; if (!F) return "";
    const nEst = Number(F.estilos) || 0;
    return '<div class="itx-form" id="itxForm"><h3>' + (F.id ? "Editar item" : "Nuevo item") + "</h3>" +
      '<div class="field"><label for="itf-link">Link del Mercado de Steam</label><input id="itf-link" inputmode="url" placeholder="https://steamcommunity.com/market/listings/570/…" value="' + esc(F.link || "") + '"></div>' +
      '<div class="cav"><button type="button" class="itx-btn gold sm" data-itx="steam">' + (adm.steamCargando ? "Leyendo Steam…" : "⚡ Rellenar desde Steam") + "</button></div>" +
      (adm.steamInfo ? '<p class="itx-hint">' + esc(adm.steamInfo) + "</p>" : "") +
      (F.img ? '<div class="itx-fotoprev">' + imgTag(F.img, "", ' width="140"') + "</div>" : "") +
      '<div class="cav"><label class="itx-btn ghost sm" for="itf-file">' + (adm.subiendo ? "Subiendo…" : (F.img ? "Cambiar foto" : "Subir foto")) + '</label><input id="itf-file" type="file" accept="image/*" hidden>' +
      (F.img ? '<button type="button" class="itx-btn ghost sm" data-itx="quitarFoto">Quitar foto</button>' : "") + "</div>" +
      '<div class="field"><label for="itf-nombre">Nombre</label><input id="itf-nombre" maxlength="90" value="' + esc(F.nombre) + '"></div>' +
      '<div class="field"><label for="itf-precio">Precio en soles (S/)</label><input id="itf-precio" inputmode="decimal" value="' + esc(F.precio) + '"></div>' +
      '<div class="field"><label for="itf-stock">Stock (cuántos tienes)</label><input id="itf-stock" inputmode="numeric" value="' + esc(F.stock) + '"></div>' +
      '<div class="field"><label for="itf-tipo">Tipo</label><select id="itf-tipo">' + opciones(ITEM_TIPOS, F.tipo, "—") + "</select></div>" +
      '<div class="field"><label for="itf-heroe">Héroe</label><input id="itf-heroe" list="itx-dl-heroe" maxlength="40" value="' + esc(F.heroe) + '"><datalist id="itx-dl-heroe">' + distintos("heroe", HEROES_DOTA).map((v) => '<option value="' + esc(v) + '">').join("") + "</datalist></div>" +
      '<div class="field"><label for="itf-ranura">Ranura (Weapon, Head, Back…)</label><input id="itf-ranura" list="itx-dl-ranura" maxlength="40" value="' + esc(F.ranura) + '"><datalist id="itx-dl-ranura">' + distintos("ranura", SLOTS_DOTA).map((v) => '<option value="' + esc(v) + '">').join("") + "</datalist></div>" +
      '<div class="field"><label for="itf-rareza">Rareza</label><select id="itf-rareza">' + opciones(LISTA_RAREZAS, F.rareza, "—") + "</select></div>" +
      '<div class="field"><label for="itf-calidad">Calidad</label><input id="itf-calidad" list="itx-dl-calidad" maxlength="30" value="' + esc(F.calidad) + '"><datalist id="itx-dl-calidad">' + distintos("calidad", ITEM_CALIDADES).map((v) => '<option value="' + esc(v) + '">').join("") + "</datalist></div>" +
      '<div class="field"><label for="itf-estilos">Estilos (solo si el item los tiene)</label><select id="itf-estilos">' + ["0", "2", "3", "4", "5", "6"].map((v) => '<option value="' + v + '"' + (String(F.estilos || 0) === v ? " selected" : "") + ">" + (v === "0" ? "Sin estilos" : v + " estilos") + "</option>").join("") + "</select></div>" +
      (nEst > 0 ? '<div class="field"><label>Estilos que SÍ tiene (los demás saldrán “Bloqueado”)</label><div class="itx-estchk">' + (() => { let o = ""; const ok = estilosOkLista(F); for (let k = 1; k <= nEst; k++) o += '<label class="itx-chk"><input type="checkbox" id="itf-est-' + k + '"' + (ok.indexOf(k) >= 0 ? " checked" : "") + "> Estilo " + k + "</label>"; return o; })() + "</div></div>" : "") +
      '<label class="itx-chk"><input type="checkbox" id="itf-activo"' + (F.activo ? " checked" : "") + "> Visible para los clientes</label>" +
      (adm.msg ? '<p class="itx-hint" style="color:#ff6b6b">' + esc(adm.msg) + "</p>" : "") +
      '<div class="cav"><button type="button" class="itx-btn gold sm" data-itx="guardar">' + (adm.guardando ? "Guardando…" : "💾 Guardar item") + '</button><button type="button" class="itx-btn ghost sm" data-itx="cerrarForm">Cancelar</button></div></div>';
  }
  function formEvento(el) {
    const F = adm.form; if (!F || !el.id || el.id.indexOf("itf-") !== 0) return false;
    const m = { "itf-link": "link", "itf-nombre": "nombre", "itf-precio": "precio", "itf-stock": "stock", "itf-tipo": "tipo", "itf-heroe": "heroe", "itf-ranura": "ranura", "itf-rareza": "rareza", "itf-calidad": "calidad" };
    if (el.id === "itf-activo") { F.activo = el.checked; return true; }
    if (el.id === "itf-estilos") {
      F.estilos = el.value;
      const nn = Number(el.value) || 0;
      let oks = estilosOkLista(F).filter((x) => x <= nn);
      if (nn > 0 && !oks.length) oks = [1];
      F.estOk = oks.join(",");
      renderTodo(); return true;
    }
    if (/^itf-est-\d+$/.test(el.id)) {
      const num = parseInt(el.id.slice(8), 10), cur = estilosOkLista(F), pos = cur.indexOf(num);
      if (el.checked && pos < 0) cur.push(num); else if (!el.checked && pos >= 0) cur.splice(pos, 1);
      cur.sort((a, b) => a - b); F.estOk = cur.join(","); return true;
    }
    if (m[el.id]) { F[m[el.id]] = el.value; return true; }
    return false;
  }
  function irAlForm() { const e = document.getElementById("itxForm"); if (e && e.scrollIntoView) e.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function rellenarDesdeSteam() {
    const F = adm.form; if (!F || adm.steamCargando) return;
    if (!/steamcommunity\.com\/market\/listings\/570\//i.test(F.link || "")) { adm.msg = "Pega un link del Mercado de Steam de Dota 2 (…/market/listings/570/…)."; renderTodo(); return; }
    adm.steamCargando = true; adm.msg = ""; adm.steamInfo = ""; renderTodo();
    token().then((tk) => fetch(STEAM_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify({ link: F.link.trim() }) }))
      .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok || !j.item) throw new Error(j.error || "No se pudo leer el item (" + r.status + ")."); return j.item; }))
      .then((d) => {
        if (d.nombre) F.nombre = d.nombre;
        if (d.tipo) F.tipo = ITEM_TIPOS.indexOf(d.tipo) >= 0 ? d.tipo : "Otro";
        if (d.heroe) F.heroe = d.heroe;
        if (d.ranura) F.ranura = d.ranura;
        if (d.rareza && LISTA_RAREZAS.indexOf(d.rareza) >= 0) F.rareza = d.rareza;
        if (d.calidad) F.calidad = d.calidad;
        if (d.estilos > 1) { F.estilos = String(d.estilos); F.estOk = d.estOk || "1"; } else { F.estilos = "0"; F.estOk = ""; }
        adm.steamInfo = d.precioUsd ? "Precio en Steam: US$ " + d.precioUsd.toFixed(2) + " (referencia). Pon tú el precio en soles." : "Pon tú el precio en soles.";
        if (d.diag) adm.steamInfo += " [Steam no dio héroe/ranura. Datos: " + d.diag + "]";
        if (!d.imgData) return null;
        return fetch(d.imgData).then((x) => x.blob()).then((b) => subirImagen(new File([b], "item.png", { type: b.type || "image/png" }), 640))
          .then((ref) => { F.img = ref; }).catch(() => { adm.steamInfo += " (La foto no se pudo guardar: súbela a mano.)"; });
      })
      .then(() => { adm.steamCargando = false; renderTodo(); })
      .catch((e) => { adm.steamCargando = false; adm.msg = (e && e.message === "NO_SESSION") ? "Vuelve a iniciar sesión con la cuenta de administrador." : ((e && e.message) || "No se pudo leer el item."); renderTodo(); });
  }
  function guardarItem() {
    const F = adm.form; if (!F || adm.guardando) return;
    const precio = parseFloat(String(F.precio).replace(",", "."));
    let stock = parseInt(F.stock, 10);
    if (!F.nombre.trim()) { adm.msg = "Escribe el nombre del item."; renderTodo(); return; }
    if (!isFinite(precio) || precio <= 0) { adm.msg = "Pon un precio mayor a 0."; renderTodo(); return; }
    if (!isFinite(stock) || stock < 0) stock = 1;
    const it = { id: F.id || ("it-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), nombre: F.nombre.trim(), img: F.img, precio: Math.round(precio * 100) / 100, stock,
      tipo: F.tipo, heroe: F.heroe.trim(), ranura: F.ranura.trim(), rareza: F.rareza, calidad: F.calidad.trim(),
      estilos: Number(F.estilos) || 0, estOk: Number(F.estilos) > 0 ? estilosOkLista(F).join(",") : "", activo: F.activo, creado: F.creado || new Date().toISOString() };
    adm.guardando = true; adm.msg = ""; renderTodo();
    fsPedir("rayas_items/" + encodeURIComponent(it.id), { method: "PATCH", body: JSON.stringify(itemAFields(it)) }).then((r) => {
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Tu sesión no tiene permiso. Entra con la cuenta de administrador." : "No se pudo guardar (" + r.status + ").");
      const k = items.lista.findIndex((x) => x.id === it.id);
      if (k >= 0) items.lista[k] = it; else items.lista.unshift(it);
      adm.form = null; adm.guardando = false; renderTodo();
    }).catch((e) => { adm.guardando = false; adm.msg = e.message || "No se pudo guardar."; renderTodo(); });
  }
  function borrarItem(id) {
    fsPedir("rayas_items/" + encodeURIComponent(id), { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("No se pudo borrar (" + r.status + ").");
      items.lista = items.lista.filter((x) => x.id !== id); adm.itemDel = null; renderTodo();
    }).catch((e) => { adm.msg = e.message; adm.itemDel = null; renderTodo(); });
  }
  function cambiarSeccion(on) {
    fetch(DOC_URL, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      let j = {}; try { j = JSON.parse(d.fields.json.stringValue); } catch (e) { throw new Error("No se pudo leer la configuración actual."); }
      j.secciones = { items: !!on };
      return fsPedir("rayas/estado?updateMask.fieldPaths=json", { method: "PATCH", body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(j) } } }) });
    }).then((r) => { if (!r.ok) throw new Error("No se pudo guardar (" + r.status + ")."); sec.items = !!on; renderTodo(); })
      .catch((e) => { adm.msg = (e && e.message) || "No se pudo cambiar."; renderTodo(); });
  }

  /* ---------- Modal de un item (comprar) ---------- */
  function modalHtml() {
    if (!modal) return "";
    let h = "", btns = "";
    const cerrar = '<button class="itx-btn ghost" type="button" data-itx="cerrarModal">Cerrar</button>';
    if (modal.tipo === "item") {
      const it = itemPorId(modal.id);
      if (!it) { h = "<h3>Item no encontrado</h3>"; btns = cerrar; }
      else {
        const cred = Math.ceil(it.precio - 1e-9), agot = it.stock <= 0, p = perfil();
        h = "<h3>" + esc(it.nombre) + "</h3>" +
          '<div class="itx-thumb big" style="--rar:' + colorRareza(it.rareza) + '">' + (imgTag(it.img, it.nombre) || '<span class="sinfoto">Sin foto</span>') + "</div>" +
          '<p class="itx-hint">' + [it.rareza, it.calidad, it.tipo, it.heroe, it.ranura].filter(Boolean).map(esc).join(" · ") + "</p>" + estilosHtml(it) +
          '<p class="itx-resumen">Precio: <b>' + fmtPrecio(it.precio) + "</b> · o <b>" + cred + " créditos</b></p>" +
          (agot ? '<p class="itx-hint" style="color:#ff6b6b">Este item está agotado.</p>' : (p ? '<p class="itx-hint">Tienes <b>' + p.creditos + "</b> créditos.</p>" : '<p class="itx-hint">Para pagar con créditos entra a tu cuenta.</p>'));
        btns = (agot ? "" : '<button class="itx-btn fucsia" type="button" data-itx="cred" data-id="' + esc(it.id) + '">💎 Pagar con ' + cred + " créditos</button>" +
          '<button class="itx-btn gold" type="button" data-itx="wsp" data-id="' + esc(it.id) + '">💬 Comprar por WhatsApp</button>') + cerrar;
      }
    } else if (modal.tipo === "cargando") { h = "<h3>Procesando…</h3><p class='itx-hint'>Un momento por favor.</p>"; }
    else if (modal.tipo === "error") { h = "<h3>No se pudo completar</h3><p class='itx-hint'>" + esc(modal.msg) + "</p>"; btns = cerrar; }
    else if (modal.tipo === "ok") {
      h = "<h3>¡Compra lista! 🎉</h3><p class='itx-hint'>Compraste <b>" + esc(modal.nombre) + "</b>. Pedido <b>" + esc(modal.code) + "</b>. Te quedan <b>" + modal.saldo + "</b> créditos. Te escribiremos para entregártelo por Steam; asegúrate de tener tu link de intercambio en tu cuenta.</p>";
      btns = cerrar;
    }
    return '<div class="itx-scrim" data-itx="cerrarModal"></div><div class="itx-dialog" role="dialog" aria-modal="true">' + h + '<div class="itx-dbtns">' + btns + "</div></div>";
  }
  function mensajeItem(it) {
    const p = perfil();
    return "¡Hola! 👋🔥 Quiero comprar este item de *" + TIENDA + "* 🛒\n\n🎮 *" + it.nombre + "*" + (it.calidad ? " (" + it.calidad + ")" : "") + "\n💰 Precio: " + fmtPrecio(it.precio) +
      (p ? "\n\n👤 " + p.nombre + " (📧 " + p.email + ")" : "") + "\n\n¿Sigue disponible? 🙏✨";
  }
  function comprarConCreditos(id) {
    const it = itemPorId(id); if (!it) return;
    if (!perfil()) { modal = null; renderTodo(); if (cuenta()) cuenta().abrir("login", "Entra a tu cuenta para pagar con créditos."); return; }
    modal = { tipo: "cargando" }; renderTodo();
    token().then((tk) => fetch(ITEMS_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify({ id }) }))
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
      .then((x) => {
        if (!x.ok) { modal = { tipo: "error", msg: (x.j && x.j.error) || "No se pudo completar la compra." }; renderTodo(); cargarItems(true); return; }
        modal = { tipo: "ok", code: x.j.code, nombre: it.nombre, saldo: x.j.saldo }; renderTodo();
        if (cuenta() && cuenta().recargar) cuenta().recargar();
        cargarItems(true);
      }).catch((e) => { modal = { tipo: "error", msg: (e && e.message === "NO_SESSION") ? "Tu sesión venció. Vuelve a entrar." : "No se pudo completar la compra. No se descontaron créditos." }; renderTodo(); });
  }

  /* ---------- Vender items ---------- */
  const claveCompra = (n) => sinTildes(n).replace(/\s+/g, " ").trim();
  const slugCompra = (n) => claveCompra(n).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || ("x" + Date.now().toString(36));
  function cargarPrecios(forzar) {
    if (ven.pCargando || (ven.pCargado && !forzar)) return;
    ven.pCargando = true;
    const acc = [];
    const pag = (t) => fetch(BASE + "rayas_compra?pageSize=300" + (t ? "&pageToken=" + encodeURIComponent(t) : ""), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("precios " + r.status);
      return r.json();
    }).then((j) => {
      (j.documents || []).forEach((d) => {
        const f = d.fields || {};
        acc.push({ id: d.name.split("/").pop(), nombre: (f.nombre && f.nombre.stringValue) || "", precio: f.precio ? Number(f.precio.doubleValue !== undefined ? f.precio.doubleValue : (f.precio.integerValue || 0)) : 0 });
      });
      return j.nextPageToken && acc.length < 3000 ? pag(j.nextPageToken) : null;
    });
    pag("").then(() => { ven.precios = acc; ven.pCargado = true; }).catch(() => { ven.pCargado = true; })
      .then(() => { ven.pCargando = false; renderTodo(); });
  }
  function precioCompra(nombre) {
    const k = claveCompra(nombre);
    for (let i = 0; i < ven.precios.length; i++) if (claveCompra(ven.precios[i].nombre) === k) return ven.precios[i].precio;
    return null;
  }
  function verInventario() {
    const link = String(ven.link || "").trim();
    if (!/[?&]partner=\d+/.test(link)) { ven.err = "Pega tu trade link completo (debe incluir partner= y token=)."; renderTodo(); return; }
    ven.cargando = true; ven.err = ""; ven.lista = null; ven.sel = {}; renderTodo();
    fetch(INV_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link }) })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
      .then((x) => {
        ven.cargando = false;
        if (!x.ok) ven.err = (x.j && x.j.error) || "No se pudo leer tu inventario.";
        else { ven.lista = x.j.items || []; ven.noTrad = x.j.noTradables || 0; }
        renderTodo();
      }).catch(() => { ven.cargando = false; ven.err = "No se pudo conectar. Intenta de nuevo."; renderTodo(); });
  }
  function ventaTotales() {
    let n = 0, tot = 0, sinP = 0;
    (ven.lista || []).forEach((g) => {
      const c = ven.sel[g.k] || 0; if (!c) return;
      n += c; const p = precioCompra(g.name); if (p === null) sinP += c; else tot += p * c;
    });
    return { n, tot, sinP };
  }
  function venderCardHtml(g, idx) {
    const p = precioCompra(g.name), c = ven.sel[g.k] || 0;
    return '<article class="itx-card' + (c ? " vsel" : "") + '"><div class="itx-thumb" style="--rar:' + esc(g.color || "#8a8fb0") + '">' + (imgTag(g.icon, g.name, ' loading="lazy"') || '<span class="sinfoto">Sin foto</span>') +
      (g.n > 1 ? '<span class="itx-tag">x' + g.n + "</span>" : "") + "</div>" +
      '<div class="itx-body"><h4>' + esc(g.name) + "</h4>" +
      '<div class="itx-price"><b>' + (p === null ? "Consultar" : fmtPrecio(p)) + "</b></div>" +
      '<div class="itx-step"><button type="button" class="itx-btn ghost sm" data-itx="venMenos" data-i="' + idx + '" aria-label="Quitar uno"' + (c ? "" : " disabled") + ">−</button>" +
      "<span>" + c + '</span><button type="button" class="itx-btn ghost sm" data-itx="venMas" data-i="' + idx + '" aria-label="Agregar uno"' + (c >= g.n ? " disabled" : "") + ">+</button></div></div></article>";
  }
  function venFiltrados() {
    const f = ven.f, q = sinTildes(ven.q), mn = parseFloat(f.min), mx = parseFloat(f.max);
    const vis = (ven.lista || []).map((g, i) => ({ g, i, p: precioCompra(g.name) })).filter((o) => {
      const g = o.g;
      if (q && sinTildes(g.name).indexOf(q) < 0) return false;
      if (f.tipo && g.tipo !== f.tipo) return false;
      if (f.heroe && g.heroe !== f.heroe) return false;
      if (f.ranura && g.ranura !== f.ranura) return false;
      if (f.rareza && g.rareza !== f.rareza) return false;
      if (f.calidad && g.calidad !== f.calidad) return false;
      if (isFinite(mn) && (o.p === null || o.p < mn)) return false;
      if (isFinite(mx) && (o.p === null || o.p > mx)) return false;
      return true;
    });
    vis.sort((a, b) => {
      if (f.orden === "nombre") return a.g.name.localeCompare(b.g.name);
      const pa = a.p === null ? -1 : a.p, pb = b.p === null ? -1 : b.p;
      return f.orden === "menor" ? pa - pb : pb - pa;
    });
    return vis;
  }
  function venDistintos(k, base) {
    const set = {}, out = [];
    (base || []).concat((ven.lista || []).map((x) => x[k])).forEach((v) => { if (v && !set[v]) { set[v] = 1; out.push(v); } });
    return out.sort((a, b) => a.localeCompare(b));
  }
  function venderHtml() {
    if (!visible()) return cabecera("Tus items", "Vender", "items", "Esta sección estará disponible pronto.");
    let cuerpo;
    if (ven.cargando) cuerpo = '<div class="itx-empty"><strong>Leyendo tu inventario…</strong><span>Puede tardar unos segundos.</span></div>';
    else if (ven.lista === null) cuerpo = '<div class="itx-empty"><strong>Pega tu trade link para empezar</strong><span>Verás tus items de Dota 2 que se pueden intercambiar y el precio al que te los compramos.</span></div>';
    else if (!ven.lista.length) cuerpo = '<div class="itx-empty"><strong>No hay items intercambiables</strong><span>Revisa que tu inventario de Dota 2 sea público y tenga items que puedas tradear.</span></div>';
    else {
      const f = ven.f, vis = venFiltrados(), T = ventaTotales();
      const tabs = ['<button type="button" class="itx-tab' + (!f.tipo ? " on" : "") + '" data-itx="venTipo" data-v="">Todos</button>'].concat(ITEM_TIPOS.map((t) =>
        '<button type="button" class="itx-tab' + (f.tipo === t ? " on" : "") + '" data-itx="venTipo" data-v="' + esc(t) + '">' + esc(t) + "</button>")).join("");
      const filt = '<aside class="itx-filt"><details' + (window.innerWidth > 820 ? " open" : "") + "><summary>Filtros</summary>" +
        '<div class="ff"><label>Precio (S/)</label><div class="ff2"><input id="itv-min" inputmode="decimal" placeholder="Desde" value="' + esc(f.min) + '"><input id="itv-max" inputmode="decimal" placeholder="Hasta" value="' + esc(f.max) + '"></div></div>' +
        '<div class="ff"><label for="itv-heroe">Héroe</label><select id="itv-heroe">' + opciones(venDistintos("heroe", HEROES_DOTA), f.heroe, "Todos") + "</select></div>" +
        '<div class="ff"><label for="itv-ranura">Ranura</label><select id="itv-ranura">' + opciones(venDistintos("ranura", SLOTS_DOTA), f.ranura, "Todas") + "</select></div>" +
        '<div class="ff"><label for="itv-rareza">Rareza</label><select id="itv-rareza">' + opciones(LISTA_RAREZAS, f.rareza, "Todas") + "</select></div>" +
        '<div class="ff"><label for="itv-calidad">Calidad</label><select id="itv-calidad">' + opciones(venDistintos("calidad", ITEM_CALIDADES), f.calidad, "Todas") + "</select></div>" +
        '<button type="button" class="itx-btn ghost sm" data-itx="venReset" style="width:100%">Restablecer filtros</button></details></aside>';
      cuerpo = '<div class="itx-tabs">' + tabs + "</div>" +
        '<div class="itx-shop">' + filt + '<div class="itx-main"><div class="itx-bar"><input id="itv-q" type="search" placeholder="Buscar en tu inventario…" value="' + esc(ven.q) + '" autocomplete="off">' +
        '<select id="itv-orden" aria-label="Ordenar">' + [["mayor", "Precio: mayor a menor"], ["menor", "Precio: menor a mayor"], ["nombre", "Nombre A-Z"]].map((o) => '<option value="' + o[0] + '"' + (f.orden === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>" +
        '<span class="itx-count">' + vis.length + " de " + ven.lista.length + " tipos de item" + (ven.noTrad ? " · " + ven.noTrad + " no intercambiables" : "") + "</span></div>" +
        (vis.length ? '<div class="itx-grid">' + vis.map((o) => venderCardHtml(o.g, o.i)).join("") + "</div>" : '<div class="itx-empty"><strong>Ningún item coincide</strong><span>Prueba con otros filtros.</span></div>') +
        "</div></div>" +
        '<div class="itx-vbar"><div><b>' + T.n + "</b> item" + (T.n === 1 ? "" : "s") + " elegido" + (T.n === 1 ? "" : "s") + (T.n ? " · Total: <b>" + fmtPrecio(T.tot) + "</b>" + (T.sinP ? " + " + T.sinP + " a consultar" : "") : "") + "</div>" +
        '<button class="itx-btn gold" type="button" data-itx="venWsp"' + (T.n ? "" : " disabled") + ">💬 Vender por WhatsApp</button></div>";
    }
    const p = perfil();
    return cabecera("Tus items", "Vender", "items", "Pega tu trade link, elige lo que quieres vender y mira cuánto te pagamos.") + aviso() + switchSeccion() +
      '<div class="itx-vlink"><label for="itv-link">Tu trade link de Steam</label>' +
      '<div class="itx-vrow"><input id="itv-link" type="url" inputmode="url" placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…" value="' + esc(ven.link) + '" autocomplete="off">' +
      '<button class="itx-btn fucsia" type="button" data-itx="venVer"' + (ven.cargando ? " disabled" : "") + ">Ver mi inventario</button></div>" +
      '<p class="itx-hint">' + TRADE_AYUDA + "</p>" +
      '<p class="itx-hint">Tu inventario de Dota 2 debe estar en <b>Público</b>. Tu trade link lo encuentras en Steam → Inventario → Ofertas de intercambio → “¿Quién puede enviarme ofertas?”.' +
      (p && p.tradelink && !ven.link ? ' <button type="button" class="itx-btn ghost sm" data-itx="venMio">Usar el de mi cuenta</button>' : "") + "</p>" +
      (ven.err ? '<p class="itx-hint" style="color:#ff6b6b" role="alert">' + esc(ven.err) + "</p>" : "") + "</div>" + cuerpo + (esAdmin() ? comprasAdminHtml() : "");
  }
  function mensajeVenta() {
    const p = perfil(), T = ventaTotales(), l = [];
    (ven.lista || []).forEach((g) => {
      const c = ven.sel[g.k] || 0; if (!c) return;
      const pr = precioCompra(g.name);
      l.push("• " + c + "x " + g.name + " — " + (pr === null ? "precio a consultar" : fmtPrecio(pr * c)));
    });
    return "¡Hola! 👋 Quiero *VENDER* estos items a *" + TIENDA + "* 💰\n\n" + l.join("\n") + "\n\n🧾 Total: " + fmtPrecio(T.tot) + (T.sinP ? " + " + T.sinP + " a consultar" : "") +
      "\n🔗 Mi trade link: " + String(ven.link).trim() + (p ? "\n\n👤 " + p.nombre + " (📧 " + p.email + ")" : "") + "\n\n¿Me confirmas? 🙏✨";
  }

  /* ---------- Admin: lista de precios de compra (rayas_compra) ---------- */
  function comprasAdminHtml() {
    if (!ven.pCargado && !ven.pCargando) cargarPrecios();
    const C = adm.cp;
    const lista = ven.precios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    return '<details class="itx-form" style="margin-top:22px"><summary><b>Admin · Lista de precios de compra (' + lista.length + ")</b></summary>" +
      '<p class="itx-hint">Aquí pones cuánto pagas por cada item. Los items de los clientes que estén en esta lista salen con precio; el resto sale “Consultar”. El nombre debe ser igual al de Steam (en inglés), por ejemplo <b>Inscribed Golden Sunscorch Whip</b>.</p>' +
      '<div class="field"><label for="itc-nombre">Nombre del item</label><input id="itc-nombre" maxlength="120" value="' + esc(C.nombre || "") + '"></div>' +
      '<div class="field"><label for="itc-precio">Precio que pagas (S/)</label><input id="itc-precio" inputmode="decimal" value="' + esc(C.precio || "") + '"></div>' +
      '<div class="cav"><button class="itx-btn fucsia sm" type="button" data-itx="cpGuardar">' + (C.edit ? "Guardar cambios" : "Agregar a la lista") + "</button>" + (C.edit ? '<button class="itx-btn ghost sm" type="button" data-itx="cpCancelar">Cancelar</button>' : "") + "</div>" +
      '<details style="margin-top:12px"><summary>Pegar varios a la vez</summary><p class="itx-hint">Una línea por item: <b>Nombre = precio</b></p>' +
      '<textarea id="itc-bulk" rows="6" style="width:100%">' + esc(C.bulk || "") + '</textarea><button class="itx-btn ghost sm" type="button" data-itx="cpBulk">Guardar lista pegada</button></details>' +
      (C.msg ? '<p class="itx-hint" role="status">' + esc(C.msg) + "</p>" : "") +
      (lista.length ? lista.map((r) => '<div class="itx-fila"><div><b>' + esc(r.nombre) + "</b> — " + fmtPrecio(r.precio) + '</div><div class="cav">' +
        '<button class="itx-btn ghost sm" type="button" data-itx="cpEditar" data-id="' + esc(r.id) + '">Editar</button>' +
        (C.del === r.id ? '<button class="itx-btn fucsia sm" type="button" data-itx="cpBorrarSi" data-id="' + esc(r.id) + '">¿Seguro? Borrar</button>' : '<button class="itx-btn ghost sm" type="button" data-itx="cpBorrar" data-id="' + esc(r.id) + '">Borrar</button>') + "</div></div>").join("") : '<p class="itx-hint">Todavía no hay precios.</p>') + "</details>";
  }
  function guardarPrecio(nombre, precio) {
    nombre = String(nombre || "").trim();
    const p = parseFloat(String(precio).replace(",", "."));
    if (!nombre || !isFinite(p) || p <= 0) return Promise.reject(new Error("Revisa el nombre y el precio."));
    const id = slugCompra(nombre), val = Math.round(p * 100) / 100;
    return fsPedir("rayas_compra/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ fields: { nombre: { stringValue: nombre }, precio: { doubleValue: val } } }) }).then((r) => {
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Tu sesión no tiene permiso. Vuelve a entrar." : "No se pudo guardar (" + r.status + ").");
      const k = ven.precios.findIndex((x) => x.id === id), o = { id, nombre, precio: val };
      if (k >= 0) ven.precios[k] = o; else ven.precios.push(o);
    });
  }
  function accionCompras(a, t) {
    const C = adm.cp;
    if (a === "cpGuardar") guardarPrecio(C.nombre, C.precio).then(() => { adm.cp = { msg: "Guardado ✔" }; renderTodo(); }).catch((e) => { C.msg = e.message; renderTodo(); });
    else if (a === "cpBulk") {
      const lineas = String(C.bulk || "").split(/\n+/).map((s) => { const m = /^(.+?)\s*[=;\t]\s*([\d.,]+)\s*$/.exec(s.trim()); return m ? [m[1], m[2]] : null; }).filter(Boolean);
      if (!lineas.length) { C.msg = "No encontré líneas con el formato Nombre = precio."; renderTodo(); return; }
      let ok = 0;
      lineas.reduce((pr, l) => pr.then(() => guardarPrecio(l[0], l[1]).then(() => { ok++; }, () => { /* sigue */ })), Promise.resolve())
        .then(() => { adm.cp = { msg: "Se guardaron " + ok + " de " + lineas.length + " líneas." }; renderTodo(); });
    } else if (a === "cpEditar") {
      const r = ven.precios.find((x) => x.id === t.getAttribute("data-id"));
      if (r) { adm.cp = { nombre: r.nombre, precio: String(r.precio), edit: true }; renderTodo(); }
    } else if (a === "cpCancelar") { adm.cp = {}; renderTodo(); }
    else if (a === "cpBorrar") { C.del = t.getAttribute("data-id"); renderTodo(); }
    else if (a === "cpBorrarSi") {
      const id = t.getAttribute("data-id");
      fsPedir("rayas_compra/" + encodeURIComponent(id), { method: "DELETE" }).then((r2) => {
        if (!r2.ok) throw new Error("No se pudo borrar (" + r2.status + ").");
        ven.precios = ven.precios.filter((x) => x.id !== id); C.del = null; renderTodo();
      }).catch((e) => { C.msg = e.message; renderTodo(); });
    }
  }

  /* ---------- pintar ---------- */
  function conservarFoco(fn) {
    const a = document.activeElement, id = a && a.id, ini = a && a.selectionStart, fin = a && a.selectionEnd;
    fn();
    if (id) { const n = document.getElementById(id); if (n && n !== a) { n.focus(); try { if (ini != null) n.setSelectionRange(ini, fin); } catch (e) { /* nada */ } } }
  }
  function renderTodo() {
    conservarFoco(() => {
      const r1 = document.getElementById("itemsRoot"), r2 = document.getElementById("venderRoot");
      if (r1 && !r1.hidden) { r1.innerHTML = comprarHtml(); }
      if (r2 && !r2.hidden) { r2.innerHTML = venderHtml(); }
      let m = document.getElementById("itxModal");
      if (!m) { m = document.createElement("div"); m.id = "itxModal"; m.className = "itx"; document.body.appendChild(m); }
      m.innerHTML = modalHtml(); m.hidden = !modal;
      pintarNav();
      if (r1 && !r1.hidden) pintarGrid();
    });
    hidratarImgs();
  }
  function pintarNav() {
    const on = visible();
    document.querySelectorAll("[data-itx-nav]").forEach((a) => {
      a.hidden = !on;
      const sin = a.getAttribute("data-itx-label");
      a.textContent = sin + (!sec.items && esAdmin() ? " 🔒" : "");
    });
  }

  /* ---------- eventos ---------- */
  const cont = () => [document.getElementById("itemsRoot"), document.getElementById("venderRoot"), document.getElementById("itxModal")].filter(Boolean);
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-itx]"); if (!t || !cont().some((c) => c.contains(t))) return;
    const a = t.getAttribute("data-itx");
    if (t.tagName === "INPUT") return;   // los checkbox se manejan en "change"
    // dentro de una tarjeta, los botones de admin no deben abrir el item
    if (a === "ver" && ev.target.closest("[data-itx='editar'],[data-itx='borrar'],[data-itx='borrarSi']")) return;
    switch (a) {
      case "ver": modal = { tipo: "item", id: t.getAttribute("data-id") }; renderTodo(); break;
      case "cerrarModal": modal = null; renderTodo(); break;
      case "tipo": filtros.tipo = t.getAttribute("data-v") || ""; filtros.limite = 24; renderTodo(); break;
      case "mas": filtros.limite += 24; pintarGrid(); break;
      case "reset": Object.assign(filtros, { q: "", min: "", max: "", tipo: "", heroe: "", ranura: "", rareza: "", calidad: "", orden: "nuevo", limite: 24 }); renderTodo(); break;
      case "cred": comprarConCreditos(t.getAttribute("data-id")); break;
      case "wsp": { const it = itemPorId(t.getAttribute("data-id")); if (it) window.open(waLink(mensajeItem(it)), "_blank", "noopener"); break; }
      case "nuevo": adm.form = nuevoForm(); adm.msg = ""; adm.steamInfo = ""; renderTodo(); irAlForm(); break;
      case "editar": { const ie = itemPorId(t.getAttribute("data-id")); if (ie) { adm.form = Object.assign({}, ie, { precio: String(ie.precio), stock: String(ie.stock), estilos: String(ie.estilos || 0), estOk: ie.estOk || (ie.estilos ? "1" : ""), link: "" }); adm.msg = ""; adm.steamInfo = ""; renderTodo(); irAlForm(); } break; }
      case "cerrarForm": adm.form = null; adm.msg = ""; renderTodo(); break;
      case "guardar": guardarItem(); break;
      case "steam": rellenarDesdeSteam(); break;
      case "quitarFoto": if (adm.form) { adm.form.img = ""; renderTodo(); } break;
      case "borrar": adm.itemDel = t.getAttribute("data-id"); renderTodo(); break;
      case "borrarSi": borrarItem(t.getAttribute("data-id")); break;
      case "venVer": verInventario(); break;
      case "venTipo": ven.f.tipo = t.getAttribute("data-v") || ""; renderTodo(); break;
      case "venReset": ven.f = { tipo: "", heroe: "", ranura: "", rareza: "", calidad: "", min: "", max: "", orden: "mayor" }; ven.q = ""; renderTodo(); break;
      case "venMio": { const p = perfil(); if (p && p.tradelink) { ven.link = p.tradelink; renderTodo(); } break; }
      case "venMas": case "venMenos": {
        const g = (ven.lista || [])[Number(t.getAttribute("data-i"))]; if (!g) break;
        const c = ven.sel[g.k] || 0, n = a === "venMas" ? Math.min(g.n, c + 1) : Math.max(0, c - 1);
        if (n) ven.sel[g.k] = n; else delete ven.sel[g.k];
        renderTodo(); break;
      }
      case "venWsp": { if (ventaTotales().n) window.open(waLink(mensajeVenta()), "_blank", "noopener"); break; }
      default: if (/^cp/.test(a)) accionCompras(a, t);
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && modal) { modal = null; renderTodo(); return; }
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches(".itx-card[data-itx='ver']")) { ev.preventDefault(); ev.target.click(); }
  });
  function campoEvento(el, tipo) {
    if (!el.id) return false;
    const mapa = { "itx-q": "q", "itx-min": "min", "itx-max": "max", "itx-heroe": "heroe", "itx-ranura": "ranura", "itx-rareza": "rareza", "itx-calidad": "calidad", "itx-orden": "orden" };
    if (mapa[el.id]) { filtros[mapa[el.id]] = el.value; filtros.limite = 24; pintarGrid(); return true; }
    if (el.id === "itv-link") { ven.link = el.value; return true; }
    const VF = { "itv-min": "min", "itv-max": "max", "itv-heroe": "heroe", "itv-ranura": "ranura", "itv-rareza": "rareza", "itv-calidad": "calidad", "itv-orden": "orden" };
    if (VF[el.id]) { ven.f[VF[el.id]] = el.value; renderTodo(); return true; }
    if (el.id === "itv-q") { ven.q = el.value; renderTodo(); return true; }
    if (el.id === "itc-nombre" || el.id === "itc-precio" || el.id === "itc-bulk") { adm.cp[el.id.slice(4)] = el.value; return true; }
    return formEvento(el);
  }
  document.addEventListener("input", (ev) => { if (cont().some((c) => c.contains(ev.target))) campoEvento(ev.target, "input"); });
  document.addEventListener("change", (ev) => {
    const el = ev.target; if (!cont().some((c) => c.contains(el))) return;
    if (el.id === "itf-file" && el.files && el.files[0]) {
      adm.subiendo = true; adm.msg = ""; renderTodo();
      subirImagen(el.files[0], 640).then((ref) => { if (adm.form) adm.form.img = ref; adm.subiendo = false; renderTodo(); })
        .catch((e) => { adm.subiendo = false; adm.msg = (e && e.message) || "No se pudo subir la foto."; renderTodo(); });
      return;
    }
    if (el.getAttribute && el.getAttribute("data-itx") === "secciones") { cambiarSeccion(el.checked); return; }
    campoEvento(el, "change");
  });

  /* ---------- arranque ---------- */
  let uidVisto = null;
  function vigilarSesion() {
    const s = sesion(), uid = s ? s.uid : null;
    if (uid !== uidVisto) { uidVisto = uid; renderTodo(); }
  }
  function alCambiarRuta() {
    const h = location.hash.replace(/^#\/?/, "");
    if (h === "items" || h === "vender") { cargarItems(); if (h === "vender") cargarPrecios(); setTimeout(renderTodo, 0); }
  }
  function iniciar() {
    cargarSecciones(); cargarItems();
    window.addEventListener("hashchange", alCambiarRuta);
    setInterval(vigilarSesion, 1500);
    alCambiarRuta(); renderTodo();
  }
  window.ljItems = { render: renderTodo };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
