// Marco de la demo, mismo diseño que la web de Metodólogos (NwtSidebar + encabezado + pie).
// Es JS plano y no pasa por la compilación: navega con history.pushState, que el bundle ya intercepta.
(() => {
  const base = window.__BASE__ || '';
  // El micro identifica el evento+fase con un `event_id` en cada llamada al gateway: se recuerda el último para las pantallas propias.
  try { const open0 = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { const x = /[?&]event_id=(\d+)/.exec(String(u)); if (x) window.__ACRED_EVENT_ID = +x[1]; return open0.apply(this, arguments); }; } catch (e) {}
  const root = document.documentElement;
  const KEY = 'naowee-acreditaciones-sidebar-collapsed';
  let colapsado = false;
  try { colapsado = localStorage.getItem(KEY) === '1'; } catch (e) {}

  const svg = (d, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    menu: svg('<path d="M4 6.5h16M4 12h16M4 17.5h16"/>', 26),
    shield: svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>'),
    key: svg('<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M17 12v3M20 12v2"/>'),
    tags: svg('<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8.5" r="1.2"/>'),
    chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><path d="M16 5.5a3 3 0 010 5.5M18 14.8c1.8.7 3 2.4 3.3 5.2"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    id: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.5 1.5-2.2 2.5-2.2s2 .7 2.5 2.2M14 10h4M14 13.5h3"/>'),
    box: svg('<path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    scan: svg('<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16"/>'),
    door: svg('<path d="M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4"/><path d="M4 12h10M10 8l4 4-4 4"/>'),
    out: svg('<path d="M10 4H6a1 1 0 00-1 1v14a1 1 0 001 1h4"/><path d="M14 8l4 4-4 4M18 12H9"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 004 0"/>', 26),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>', 14),
    doc: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/>'),
    valida: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>', 16),
    swap: svg('<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>'),
  };

  // Sección → ítems [etiqueta, ruta, ícono, rutas hermanas que también la marcan].
  const NAV = [
    { s: 'Parametrización', c: [['Permisos de acceso', '#permisos', 'key'], ['Categorías', '#categorias', 'id'], ['Tipos de acreditados', '#tipos', 'tags', ['/parametrization/accredited-types']], ['Formularios de registro', '#formularios', 'doc'], ['Certificados', '/parametrization/certificates', 'id']] },
    { s: 'Entrega de acreditaciones', c: [['Gestión de acreditables', '/delivery/enabled', 'users'], ['Lista de acreditados', '/delivery/accredited', 'list', ['/delivery/event-accredited']], ['Lotes de carnets', '/delivery/card-batches', 'box'], ['Certificados', '/delivery/certificates', 'shield']] },
    { s: 'Auditoría', c: [['Auditoría del evento', '/audit', 'clock']] }
  ];

  // Perfiles de la demo, como en Incentivos: cada rol es una persona (avatar con iniciales, nombre, «Rol · descripción»).
  // Jerarquía de arriba abajo. Los NOMBRES DE ROL son provisionales (en la reunión del 24-nov Danna dijo «llamémoslo…») y
  // las personas son el mismo elenco de la demo de Incentivos: se cambian solo acá. `ok` = rutas del menú que ve
  // ('*' = todas); `extra` = lo que aún no existe y se muestra «próximamente». Solo filtra el menú: la ruta escrita a mano abre igual.
  const ROLES = [
    { id: 'gestor', n: 'Gestor de acreditaciones', d: 'Parametriza usuarios, permisos y tipos', p: 'Danna Arrieta', i: 'DA', bg: '#c4b5fd', fg: '#4c1d95', ok: '#usuarios #permisos #categorias #tipos #formularios /parametrization/accredited-types /parametrization/certificates /delivery/enabled /delivery/accredited /delivery/card-batches /delivery/certificates /audit', extra: [{ s: 'Validaciones', c: [['Escanear y validar', '', 'scan'], ['Mis validaciones', '', 'clock']] }] },
    { id: 'operador', n: 'Operador de acreditaciones', d: 'Entrega y gestiona operadores externos', p: 'Jorge Guzman', i: 'JG', bg: '#fed7aa', fg: '#9a3412', ok: '#usuarios #formularios /delivery/enabled /delivery/accredited /delivery/card-batches /delivery/certificates', extra: [{ s: 'Validaciones', c: [['Escanear y validar', '', 'scan'], ['Mis validaciones', '', 'clock']] }] },
    { id: 'externo', n: 'Operador externo', d: 'Registra y valida documentos', p: 'Isa Pabon', i: 'IP', bg: '#bfdbfe', fg: '#1e3a8a', ok: '/delivery/enabled /delivery/accredited' },
    { id: 'validador', n: 'Validador', d: 'Escanea y valida accesos', p: 'Esteban Mora', i: 'EM', bg: '#bbf7d0', fg: '#166534', ok: '', extra: [{ s: 'Control de accesos', c: [['Escanear y validar', '', 'scan'], ['Mis validaciones', '', 'clock']] }] }
  ];
  // Administración GLOBAL (fuera de cualquier evento): sin panel lateral ni chip de evento; se llega desde el selector de eventos
  // (pestañas «Eventos | Usuarios») o desde el menú del perfil. Solo lo ve quien tenga permiso (hoy, el Gestor).
  const GLOBAL = [['Usuarios', '#usuarios', 'users']];
  const ROL_KEY = 'naowee-acreditaciones-rol';
  let rol = ROLES[0];
  try { if (!new URLSearchParams(location.search).has('reset')) rol = ROLES.find((r) => r.id === localStorage.getItem(ROL_KEY)) || ROLES[0]; } catch (e) {}
  // Permisos de la matriz de «Usuarios»: lo que el usuario de este rol tiene desmarcado se quita. El gestor lo tiene todo.
  const ACC4 = ['crear', 'editar', 'inhabilitar', 'descargar'];
  const GRUPO_RUTA = { '/delivery/enabled': 'nuevos', '/delivery/accredited': 'lista', '/delivery/card-batches': 'generar', '/delivery/certificates': 'generar' };
  const permiso = (k, a) => {
    if (rol.id === 'gestor') return true;
    try { const d = JSON.parse(localStorage.getItem('naowee.acreditaciones.usuarios.v4') || 'null'), u = d && (d.usuarios || []).find((x) => x.nombre === rol.p), f = u && u.perm && u.perm.filas && u.perm.filas[k]; return f ? !!f[a] : true; } catch (e) { return true; }
  };
  window.__ACRED_PERMISO__ = permiso;
  const verMenu = (m) => { const k = m[1] === '#usuarios' ? (rol.id === 'operador' ? 'externos' : null) : m[1] === '#formularios' ? 'formularios' : GRUPO_RUTA[m[1]]; return !k || ACC4.some((a) => permiso(k, a)); };
  const permite = (m) => !m[1] || rol.ok === '*' || rol.ok.split(' ').some((p) => p === m[1] || (m[3] || []).includes(p));
  const globales = () => GLOBAL.filter((m) => permite(m) && verMenu(m)).map((m) => (rol.id === 'operador' ? ['Operadores externos', m[1], m[2]] : m));
  // El panel lleva SIEMPRE arriba la sección global «Plataforma» (Eventos para todos; Usuarios según el perfil) y, al entrar en un
  // evento, se despliegan debajo las secciones del evento sin quitar las de arriba.
  const contexto = () => rel() !== '/' && !!evActivo();
  // «Eventos» va suelto arriba (sin título). Para el Gestor, «Usuarios» abre la sección «Parametrización» (siempre visible, también en el
  // selector); el Operador de acreditaciones ve «Operadores externos» justo bajo «Eventos». Las demás secciones son las del evento.
  const menu = () => {
    const enEv = contexto(), gl = enEv ? globales() : [], suelto = [['Eventos', '/', 'list'], ...(rol.id === 'operador' ? gl : [])], usr = rol.id === 'gestor' ? gl : [];
    const ev = [...NAV.slice(0, -1), ...(rol.extra || []), NAV[NAV.length - 1]].map((g) => ({ s: g.s, c: [...(g.s === 'Parametrización' ? usr : []), ...g.c.filter((m) => permite(m) && verMenu(m))] }));
    const base = contexto() ? ev : (usr.length ? [{ s: 'Parametrización', c: usr }] : []);
    return [{ s: '', c: suelto }, ...base.filter((g) => g.c.length)];
  };
  window.__ACRED_ROL__ = () => rol.id;
  window.__ACRED_PERSONA__ = () => rol.p;

  const rel = () => location.pathname.slice(base.length) || '/';
  const on = (p) => rel() === p || rel().startsWith(p + '/');
  // Pantallas propias de la demo (no existen en el micro): viven en window.ACRED_PANTALLAS, se abren con «#/<id>» y se
  // montan en #ish-pantalla encima del contenido del micro, que se oculta. La ruta del micro no cambia.
  const propia = (m) => !!m[1] && m[1][0] === '#';
  const pantallaId = () => (location.hash.indexOf('#/') === 0 ? location.hash.slice(2) : '');
  const pantallaReg = () => (window.ACRED_PANTALLAS || {})[pantallaId()];
  const esGlobal = () => !!pantallaId() && !!pantallaReg() && !!pantallaReg().global && permite(['', '#' + pantallaId()]);
  const onAny = (m) => (propia(m) ? pantallaId() === m[1].slice(1) && !!pantallaReg() : !(pantallaId() && pantallaReg()) && (on(m[1]) || (m[3] || []).some(on)));
  const rutaOk = () => (pantallaId() && pantallaReg() ? esGlobal() || menu().some((g) => g.c.some((m) => propia(m) && onAny(m))) : rel() === '/' || menu().some((g) => g.c.some((m) => m[1] && !propia(m) && onAny(m))));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // El micro presta su `navigate` por el puente `host`: cambia de vista sin remontarse.
  const go = (p) => { const h = window.__ACRED_HOST__; if (h && h.navigate) h.navigate(p); else { history.pushState({}, '', base + p); window.dispatchEvent(new PopStateEvent('popstate')); } };

  const host = document.createElement('aside'); host.className = 'ish-side'; host.setAttribute('aria-label', 'Navegación principal'); host.setAttribute('data-testid', 'web-menu');
  const top = document.createElement('header'); top.className = 'ish-top'; top.setAttribute('data-testid', 'web-encabezado');
  const pie = document.createElement('div'); pie.className = 'ish-pie';
  document.body.append(host, top, pie);
  root.classList.add('con-shell');

  const row = (m) => {
    if (!m[1]) return `<span class="ish-row ish-row--static${m[2] ? '' : ' ish-row--noicon'}">${m[2] ? `<div class="ish-icon">${I[m[2]]}</div>` : ''}<span class="ish-lbl">${esc(m[0])}</span></span>`;
    const act = onAny(m);
    if (propia(m)) return `<a class="ish-row${act ? ' on' : ''}" href="${m[1].replace('#', '#/')}" data-pantalla="${m[1].slice(1)}" title="${esc(m[0])}" aria-label="${esc(m[0])}"${act ? ' aria-current="page"' : ''}>${act ? '<div class="ish-bar"></div>' : ''}<div class="ish-icon">${I[m[2]]}</div><span class="ish-lbl">${esc(m[0])}</span></a>`;
    return `<a class="ish-row${act ? ' on' : ''}" href="${base}${m[1]}" data-go="${m[1]}" title="${esc(m[0])}" aria-label="${esc(m[0])}"${act ? ' aria-current="page"' : ''}>${act ? '<div class="ish-bar"></div>' : ''}<div class="ish-icon">${I[m[2]]}</div><span class="ish-lbl">${esc(m[0])}</span></a>`;
  };
  const pintar = () => {
    root.classList.toggle('shell-colapsado', colapsado);
    pintarEvento();
    pintarPantalla();
    host.innerHTML =
      `<div class="ish-logo"><button type="button" class="ish-burger" data-act="colapsar" aria-label="${colapsado ? 'Expandir menú' : 'Colapsar menú'}" aria-pressed="${colapsado}">${I.menu}</button>` +
        `<img class="ish-img" src="${base}/assets/logos/mindeporte.svg" alt="Ministerio del Deporte"></div>` +
      `<nav class="ish-nav">${menu().map((g) => (g.s ? `<div class="ish-section">${esc(g.s)}</div>` : '') + g.c.map(row).join('')).join('')}</nav>`;
  };
  // Opción C: el evento activo como chip en el encabezado, en todas las vistas con evento elegido. «Cambiar» = volver al
  // selector de eventos (ruta «/»). Lee lo que el micro guarda al elegir; el micro no se toca.
  const pintarEvento = () => {
    const b = top.querySelector('.ish-evento'); if (!b) return;
    let ev = null; try { ev = JSON.parse(localStorage.getItem('naowee.acreditaciones.active-event') || 'null'); } catch (e) {}
    b.hidden = !(ev && ev.name) || rel() === '/';
    if (b.hidden) return;
    const fase = String(ev.phaseName || '').replace(/^Fase\s+/i, '');
    b.setAttribute('aria-label', `Evento: ${ev.name}${fase ? `, fase ${fase}` : ''}. Cambiar de evento`);
    b.title = 'Cambiar de evento';
    b.innerHTML = `<span class="ish-ev-n">${esc(ev.name)}</span>${fase ? `<span class="ish-ev-f">· ${esc(fase)}</span>` : ''}<span class="ish-ev-e">${I.edit}</span>`;
  };
  const pintarTop = () => {
    top.innerHTML =
      `<button type="button" class="ish-evento" data-go="/" hidden></button>` +
      `<div class="ish-brand"><img class="ish-img" src="${base}/assets/logos/mindeporte.svg" alt="Ministerio del Deporte"></div>` +
      `<div class="ish-bellw"><button type="button" class="ish-bell" data-act="avisos" aria-haspopup="dialog" aria-expanded="false" aria-label="Notificaciones">${I.bell}</button>` +
        `<div class="ish-dd ish-avisos" role="dialog" aria-label="Notificaciones" hidden><h2>Notificaciones</h2><p>No tienes notificaciones.</p></div></div>` +
      `<div class="ish-user"><button type="button" class="ish-chip" data-act="perfil" aria-haspopup="menu" aria-expanded="false" aria-label="Cambiar de perfil. Perfil actual: ${esc(rol.p)}, ${esc(rol.n)}">` +
        `<span class="ish-ava"><span class="ish-ring" style="background:${rol.bg};color:${rol.fg}">${rol.i}</span><span class="ish-dot"></span></span>` +
        `<span class="ish-info"><span class="ish-name">${esc(rol.p)}</span><span class="ish-role">${esc(rol.n)}</span></span>` +
        `<span class="ish-chev">${I.down}</span></button>` +
        `<div class="ish-dd ish-perfiles" role="menu" aria-label="Cambiar de perfil" hidden><div class="ish-dd-label">Cambiar de perfil</div>` +
        ROLES.map((r) => `<button type="button" role="menuitemradio" aria-checked="${r === rol}" class="ish-dd-item ish-perfil${r === rol ? ' on' : ''}" data-rol="${r.id}">` +
          `<span class="ish-ring ish-ring--s" style="background:${r.bg};color:${r.fg}">${r.i}</span>` +
          `<span class="ish-perfil-txt"><b>${esc(r.p)}</b><small>${esc(r.n)} · ${esc(r.d)}</small></span>${I.check}</button>`).join('') +
        `</div></div>`;
    pintarEvento();
    pie.innerHTML = `<img src="${base}/assets/logos/naowee.svg" alt="Naowee" height="24"><span class="ish-sep" aria-hidden="true"></span><span>Todos los derechos reservados © 2026</span>`;
  };

  const evActivo = () => { try { return JSON.parse(localStorage.getItem('naowee.acreditaciones.active-event') || 'null'); } catch (e) { return null; } };
  const pintarPantalla = () => {
    let cont = document.getElementById('ish-pantalla');
    if (!cont) { cont = document.createElement('main'); cont.id = 'ish-pantalla'; cont.className = 'ish-pantalla'; cont.hidden = true; document.body.append(cont); }
    const reg = pantallaReg(), abierta = !!reg && permite(['', '#' + pantallaId()]) && (!!reg.global || (!!evActivo() && rel() !== '/'));
    root.classList.toggle('pantalla-propia', abierta);
    if (!abierta) { cont.hidden = true; cont.dataset.id = ''; return; }
    cont.hidden = false;
    if (cont.dataset.id !== pantallaId()) { cont.dataset.id = pantallaId(); cont.innerHTML = ''; reg.render(cont); }
  };
  const abrirPantalla = (id) => { if (pantallaId() !== id) history.pushState(null, '', location.pathname + location.search + '#/' + id); pintar(); };
  const cerrarPantalla = () => { if (pantallaId()) history.pushState(null, '', location.pathname + location.search); }; // push, no replace: «Atrás» vuelve a la pantalla propia
  const cerrar = () => {
    top.querySelectorAll('.ish-dd').forEach((e) => { e.hidden = true; });
    top.querySelectorAll('[aria-expanded]').forEach((e) => e.setAttribute('aria-expanded', 'false'));
  };
  // Entrada directa: el operador externo y el validador entran al evento que se les asignó; el operador de acreditaciones también,
  // salvo que tenga 2 o más (ahí ve el selector). El gestor siempre ve el selector. Los eventos salen de «Usuarios»; si aún no
  // existe ese registro, la demo asume su único evento.
  const EV_DEMO = { code: '80fd12ca-337b-417b-83cd-fe39ad4a343a', name: 'Juegos Intercolegiados', phaseCode: 'fase-elim-1', phaseName: 'Fase Regional', momentCode: null };
  const entraDirecto = () => {
    if (rol.id === 'gestor') return false;
    let l = [EV_DEMO.code];
    try { const d = JSON.parse(localStorage.getItem('naowee.acreditaciones.usuarios.v4') || 'null'), u = d && (d.usuarios || []).find((x) => x.nombre === rol.p); if (u) l = u.eventos ? Object.keys(u.eventos) : []; } catch (e) {}
    return l.length > 0 && !(rol.id === 'operador' && l.length > 1) && l[0] === EV_DEMO.code;
  };
  const entrar = () => {
    try { localStorage.setItem('naowee.acreditaciones.active-event', JSON.stringify(EV_DEMO)); } catch (e) {}
    const p = menu().flatMap((g) => g.c).find((m) => m[1] && m[1] !== '/' && !propia(m));
    const ruta = p ? p[1] : '/delivery/enabled';
    // Desde el selector el micro aún no leyó el evento activo: se recarga en la ruta del evento.
    if (rel() === '/') location.assign(base + ruta); else go(ruta);
  };
  const cambiarRol = (id) => {
    const nuevo = ROLES.find((r) => r.id === id);
    if (!nuevo || nuevo === rol) return;
    rol = nuevo;
    try { localStorage.setItem(ROL_KEY, id); } catch (x) {}
    pintar(); pintarTop();
    window.dispatchEvent(new CustomEvent('acred-rol', { detail: id }));
    // Si la pantalla abierta no existe para el nuevo perfil, lo llevamos a la primera que sí.
    if (entraDirecto()) return entrar();
    if (rol.id === 'operador' && rel() !== '/') { go('/'); return; }
    if (!rutaOk()) { const p = menu().flatMap((g) => g.c).find((m) => m[1] && m[1] !== '/' && !propia(m)); go(p ? p[1] : '/'); }
  };
  document.addEventListener('click', (e) => {
    const t = e.target;
    const r = t.closest('[data-rol]');
    if (r && top.contains(r)) { cerrar(); cambiarRol(r.dataset.rol); return; }
    const pan = t.closest('[data-pantalla]');
    if (pan && host.contains(pan)) { e.preventDefault(); cerrar(); abrirPantalla(pan.dataset.pantalla); return; }
    const nav = t.closest('[data-go]');
    if (nav && (host.contains(nav) || top.contains(nav))) { e.preventDefault(); cerrar(); if (rel() !== nav.dataset.go) go(nav.dataset.go); else { cerrarPantalla(); pintar(); } return; }
    if (t.closest('[data-act=colapsar]')) { colapsado = !colapsado; try { localStorage.setItem(KEY, colapsado ? '1' : '0'); } catch (x) {} pintar(); return; }
    const b = t.closest('[data-act=avisos],[data-act=perfil]');
    if (b && top.contains(b)) {
      const panel = b.nextElementSibling, abrir = panel.hidden;
      cerrar(); panel.hidden = !abrir; b.setAttribute('aria-expanded', String(abrir)); return;
    }
    if (!t.closest('.ish-dd')) cerrar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  // El micro avisa por `acred-ruta` cada vez que cambia de pantalla; los redirects (replaceState) se cubren acá.
  const replace = history.replaceState.bind(history);
  history.replaceState = (...a) => { replace(...a); pintar(); };
  window.addEventListener('acred-permisos', pintar);
  // Botones y acciones del micro (descargar, editar, inhabilitar, crear) según la matriz: se ocultan los que el rol no tiene.
  const ACC_TXT = [[/descargar/i, 'descargar'], [/inhabilit/i, 'inhabilitar'], [/^\s*editar/i, 'editar'], [/^\s*(\+\s*)?(crear|nuevo|agregar)/i, 'crear']];
  let pendiente = false;
  const aplicarPermisos = () => {
    pendiente = false;
    const k = GRUPO_RUTA[rel()];
    root.querySelectorAll('button,[role=menuitem]').forEach((e) => {
      if (e.closest('.ish-side,.ish-top,#ish-pantalla')) return;
      const t = e.textContent || '', a = (ACC_TXT.find(([re]) => re.test(t)) || [])[1];
      const oculta = !!(k && a && !permiso(k, a));
      if (oculta) { e.style.display = 'none'; e.dataset.ishOculto = '1'; } else if (e.dataset.ishOculto) { e.style.display = ''; delete e.dataset.ishOculto; }
    });
  };
  new MutationObserver(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(aplicarPermisos); } }).observe(root, { childList: true, subtree: true });
  window.addEventListener('popstate', pintar);
  window.addEventListener('acred-ruta', pintar);
  pintar(); pintarTop();
  if (rel() === '/' && entraDirecto()) { const ini = () => { window.removeEventListener('acred-ruta', ini); if (rel() === '/') entrar(); }; window.addEventListener('acred-ruta', ini); setTimeout(ini, 1500); }
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('shell-listo')));
})();
