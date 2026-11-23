// Marco de la demo, mismo diseño que la web de Metodólogos (NwtSidebar + encabezado + pie).
// Es JS plano y no pasa por la compilación: navega con history.pushState, que el bundle ya intercepta.
(() => {
  const base = window.__BASE__ || '';
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
    swap: svg('<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>'),
  };

  // Sección → ítems [etiqueta, ruta, ícono, rutas hermanas que también la marcan].
  const NAV = [
    { s: 'Parametrización', c: [['Permisos de acceso', '/parametrization/access-permissions', 'key'], ['Tipos de acreditados', '/parametrization/accredited-types', 'tags'], ['Certificados', '/parametrization/certificates', 'id']] },
    { s: 'Entrega de acreditaciones', c: [['Gestión de acreditables', '/delivery/enabled', 'users'], ['Lista de acreditados', '/delivery/accredited', 'list', ['/delivery/event-accredited']], ['Lotes de carnets', '/delivery/card-batches', 'box'], ['Certificados', '/delivery/certificates', 'shield']] },
    { s: 'Auditoría', c: [['Auditoría del evento', '/audit', 'clock']] }
  ];

  const rel = () => location.pathname.slice(base.length) || '/';
  const on = (p) => rel() === p || rel().startsWith(p + '/');
  const onAny = (m) => on(m[1]) || (m[3] || []).some(on);
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
    return `<a class="ish-row${act ? ' on' : ''}" href="${base}${m[1]}" data-go="${m[1]}" title="${esc(m[0])}" aria-label="${esc(m[0])}"${act ? ' aria-current="page"' : ''}>${act ? '<div class="ish-bar"></div>' : ''}<div class="ish-icon">${I[m[2]]}</div><span class="ish-lbl">${esc(m[0])}</span></a>`;
  };
  const pintar = () => {
    root.classList.toggle('shell-colapsado', colapsado);
    host.innerHTML =
      `<div class="ish-logo"><button type="button" class="ish-burger" data-act="colapsar" aria-label="${colapsado ? 'Expandir menú' : 'Colapsar menú'}" aria-pressed="${colapsado}">${I.menu}</button>` +
        `<img class="ish-img" src="${base}/assets/logos/mindeporte.svg" alt="Ministerio del Deporte"><div class="ish-sep"></div><img class="ish-img" src="${base}/assets/logos/suid.png" alt="SUID"></div>` +
      `<nav class="ish-nav">${NAV.map((g) => `<div class="ish-section">${esc(g.s)}</div>` + g.c.map(row).join('')).join('')}</nav>`;
  };
  const pintarTop = () => {
    top.innerHTML =
      `<div class="ish-bellw"><button type="button" class="ish-bell" data-act="avisos" aria-haspopup="dialog" aria-expanded="false" aria-label="Notificaciones">${I.bell}</button>` +
        `<div class="ish-dd ish-avisos" role="dialog" aria-label="Notificaciones" hidden><h2>Notificaciones</h2><p>No tienes notificaciones.</p></div></div>` +
      `<div class="ish-user"><div class="ish-chip ish-chip--fijo">` +
        `<div class="ish-ava"><div class="ish-ring">DN</div><div class="ish-dot"></div></div>` +
        `<div class="ish-info"><span class="ish-name">Demo Naowee</span><span class="ish-role">Administrador</span></div></div>`;
    pie.innerHTML = `<img src="${base}/assets/logos/naowee.svg" alt="Naowee" height="24"><span class="ish-sep" aria-hidden="true"></span><span>Todos los derechos reservados © 2026</span>`;
  };

  const cerrar = () => {
    top.querySelectorAll('.ish-dd').forEach((e) => { e.hidden = true; });
    top.querySelectorAll('[aria-expanded]').forEach((e) => e.setAttribute('aria-expanded', 'false'));
  };
  document.addEventListener('click', (e) => {
    const t = e.target;
    const nav = t.closest('[data-go]');
    if (nav && (host.contains(nav) || top.contains(nav))) { e.preventDefault(); cerrar(); if (rel() !== nav.dataset.go) go(nav.dataset.go); return; }
    if (t.closest('[data-act=colapsar]')) { colapsado = !colapsado; try { localStorage.setItem(KEY, colapsado ? '1' : '0'); } catch (x) {} pintar(); return; }
    const b = t.closest('[data-act=avisos]');
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
  window.addEventListener('popstate', pintar);
  window.addEventListener('acred-ruta', pintar);
  pintar(); pintarTop();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('shell-listo')));
})();
