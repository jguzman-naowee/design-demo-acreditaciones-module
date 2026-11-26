// Pantalla propia «Permisos de acceso» (catálogo) con ETIQUETAS en el formulario. Reemplaza en el menú a la del micro.
//
// Por qué propia: el formulario del micro no se puede editar, y además en la demo su «Crear» falla (el gateway simulado no
// tiene la operación y responde 501). Esta pantalla lee y escribe el catálogo directamente en el estado del simulador
// (window.__ACRED_ESTADO__), así que lo que se crea lo ven también «Tipos de acreditados» y «Validación».
//
// VALIDACIÓN (reunión del 26-nov, Danna): los topes ya NO se fijan en el permiso, sino por tipo de acreditado (los periodistas reciben
// merienda; los deportistas, todas las comidas). Aquí el permiso solo lleva sus etiquetas; el bloque de topes (ACRED_VAL) lo usa «Tipos».
(() => {
  const ETIQUETAS_SEMILLA = ['Desayuno', 'Almuerzo', 'Cena', 'Merienda'];
  // Sedes del evento de la demo («Juegos Intercolegiados · Fase Regional»); en producción vienen del evento. Un permiso vale en una, varias o todas.
  const SEDES_DEMO = ['Puerto Colombia', 'Agua Azul', 'Cartagena', 'Leticia', 'Valle del Cauca'];
  const TODAS = 'Todas las sedes';
  // Regla de validación: validation = { activa, global: tope, etiquetas: { etiqueta: tope } }; tope = { usos, por: 'total'|'dia', desde, hasta }
  const tope0 = () => ({ usos: '', por: 'total', desde: '', hasta: '' });
  const val0 = () => ({ activa: false, global: tope0(), etiquetas: {} });
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = (d) => (d ? `${+d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1]}` : '');
  const topeTxt = (t) => {
    const u = t && String(t.usos).trim() ? `${t.usos} ${t.por === 'dia' ? 'por día' : (+t.usos === 1 ? 'uso en total' : 'usos en total')}` : '';
    const v = t && t.desde && t.hasta ? `${fecha(t.desde)} → ${fecha(t.hasta)}` : t && t.desde ? `desde ${fecha(t.desde)}` : t && t.hasta ? `hasta ${fecha(t.hasta)}` : '';
    return [u, v].filter(Boolean).join(' · ');
  };
  const errTope = (t, quien) => {
    if (!t) return '';
    const u = String(t.usos).trim();
    if (u && !(/^\d+$/.test(u) && +u >= 1)) return `${quien}: los usos deben ser un número entero desde 1.`;
    if (t.desde && t.hasta && t.hasta < t.desde) return `${quien}: la fecha final no puede ser anterior a la inicial.`;
    return '';
  };
  // La validación es por etiqueta; un permiso sin etiquetas lleva un único tope (el «general», guardado en `global`).
  const errVal = (v, tags, conEtiquetas) => {
    if (!v || !v.activa) return '';
    return conEtiquetas ? tags.map((t) => errTope(v.etiquetas[t], t)).find(Boolean) || '' : errTope(v.global, 'Validación');
  };
  const sedesDe = (p) => (Array.isArray(p.venue_list) ? p.venue_list.slice() : p.venue_name === TODAS ? SEDES_DEMO.slice() : p.venue_name ? [p.venue_name] : []);
  const sedesTxt = (l) => (!l.length ? '' : SEDES_DEMO.every((x) => l.includes(x)) ? TODAS : l.length > 2 ? `${l.slice(0, 2).join(', ')} +${l.length - 2}` : l.join(', '));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ── Datos: el catálogo vive en el estado del simulador ─────────────────────
  const listo = () => new Promise((ok) => {
    let n = 0; const t = () => { if (window.__ACRED_ESTADO__ || ++n > 80) return ok(window.__ACRED_ESTADO__ || null); setTimeout(t, 100); }; t();
  });
  const guardar = () => { try { window.__ACRED_PERSISTIR__ && window.__ACRED_PERSISTIR__(); } catch (e) {} };
  const asegurar = (est) => {
    let cambio = false;
    est.accessPermissions.forEach((p) => { if (!Array.isArray(p.tags)) { p.tags = /aliment/i.test(p.name) && !/^(área|area|zona)/i.test(p.name) ? ETIQUETAS_SEMILLA.slice() : []; cambio = true; } });
    // Por cómo son las acreditaciones olímpicas, los permisos se dividen en ZONAS (llevan indicativo o número) y SERVICIOS (llevan ícono).
    const zonas = est.accessPermissions.filter((p) => p.kind === 'zona');
    est.accessPermissions.forEach((p) => { if (!p.kind) { p.kind = /^(área|area|zona)/i.test(p.name) ? 'zona' : /aliment|transporte|servicio|lavander/i.test(p.name) ? 'servicio' : 'zona'; cambio = true; } });
    // Servicios de ejemplo (con ícono y su regla de validación) para que la pestaña no nazca vacía.
    if (!est.accessPermissions.some((p) => p.kind === 'servicio')) {
      const svgI = (d) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#282834" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`);
      const id0 = Math.max(0, ...est.accessPermissions.map((x) => x.id));
      [['ALIMENTACION', 'Alimentación', 'Comedor de atletas y delegaciones', svgI('<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3"/>'), ETIQUETAS_SEMILLA.slice()],
       ['TRANSPORTE', 'Transporte de delegaciones', 'Traslados entre villas y escenarios', svgI('<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M7 20v-3M17 20v-3"/><circle cx="8" cy="14" r=".8"/><circle cx="16" cy="14" r=".8"/>'), []]].forEach(([code, name, desc, ico, tags], i) => {
        est.accessPermissions.push({ id: id0 + 1 + i, code, name, description: desc, has_limit: false, is_active: true, kind: 'servicio', indicativo: null, zone_name: null, venue_name: TODAS, venue_list: SEDES_DEMO.slice(), file_icon_upload_id: null, icon_data: ico, tags, created_at: new Date().toISOString() });
      });
      cambio = true;
    }
    est.accessPermissions.filter((p) => p.kind === 'zona' && !p.indicativo).forEach((p) => { const usados = est.accessPermissions.map((x) => String(x.indicativo || '')); let n = 1; while (usados.includes(String(n))) n++; p.indicativo = String(n); cambio = true; });
    if (cambio) guardar();
  };
  const slug = (t) => (sinTildes(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 24) || 'PERMISO');
  const crear = (est, d) => {
    const l = est.accessPermissions, id = Math.max(0, ...l.map((p) => p.id)) + 1;
    let code = slug(d.name), k = 2; while (l.some((p) => p.code === code)) code = slug(d.name) + '-' + k++;
    const p = { id, code, name: d.name, description: d.description || null, has_limit: false, is_active: true, kind: d.kind, indicativo: d.kind === 'zona' ? d.indicativo : null, zone_name: d.kind === 'zona' ? d.name : null, venue_name: sedesTxt(d.sedes) || null, venue_list: d.sedes.slice(),
      file_icon_upload_id: null, icon_data: d.kind === 'servicio' ? (d.icon || null) : null, tags: d.tags.slice(), created_at: new Date().toISOString() };
    l.push(p); guardar(); return p;
  };
  const editar = (p, d) => {
    p.name = d.name; p.description = d.description || null; if (p.kind === 'zona') { p.zone_name = d.name; p.indicativo = d.indicativo; } p.venue_name = sedesTxt(d.sedes) || null; p.venue_list = d.sedes.slice(); p.tags = d.tags.slice(); p.validation = d.val;
    if (p.kind === 'servicio' && d.icon !== undefined) p.icon_data = d.icon || null; guardar();
  };
  // Encabezado de tablas (como la referencia): buscador en píldora + filtro «Estado: …» y, abajo, el paginado.
  const TAM = 10;
  const filtroEstado = (v) => `<div class="nwt-dropdown ish-sel"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-dropdown__content">` +
    `<select class="ish-sel__in" data-fest data-key="fest" aria-label="Filtrar por estado">${[['todos', 'Todos'], ['activo', 'Activo'], ['inactivo', 'Inactivo']].map(([k, t]) => `<option value="${k}"${v === k ? ' selected' : ''}>Estado: ${t}</option>`).join('')}</select>` +
    `<div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>`;
  const paginador = (pag, pags) => {
    const btn = (dir, ico, dis, rot) => `<span class="nwt-icon-button${dis ? ' nwt-icon-button--disabled' : ''} nwt-pagination__button" nwt-variant="mute" nwt-size="large"><button type="button" class="nwt-icon-button__content" aria-label="${rot}" ${dis ? 'disabled' : `data-pag="${dir}"`}><div class="nwt-icon"><i class="naotech-icon-${ico}"></i></div></button></span>`;
    return `<div class="ish-pag"><div class="nwt-pagination" nwt-size="small"><div class="nwt-pagination__container"><div class="nwt-pagination__pages"><span class="nwt-pagination__label">Página</span>` +
      `<div class="nwt-pagination__input nwt-pagination__input--disabled"><input class="nwt-pagination__control" aria-label="Página" disabled type="text" value="${pag}"></div><div class="nwt-pagination__total"><span class="nwt-pagination__of">de</span><span class="nwt-pagination__total-value">${pags}</span></div></div>` +
      `<div class="nwt-pagination__controls">${btn('prev', 'chevron-left', pag <= 1, 'Página anterior')}${btn('next', 'chevron-right', pag >= pags, 'Página siguiente')}</div></div></div></div>`;
  };
  // El menú de fila se dibuja fuera del recorte de la tabla (position:fixed junto a su botón) y se cierra al hacer scroll o cambiar el tamaño.
  // Íconos del menú de fila (trazo, heredan el color del texto).
  const svg = (d) => `<svg class="ish-mi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = { editar: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'), inactivar: svg('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'), activar: svg('<path d="M20 6L9 17l-5-5"/>') };
  let limpiaMenu = null;
  const ubicarMenu = (cont, cerrar) => {
    if (limpiaMenu) { limpiaMenu(); limpiaMenu = null; } // sin temporizadores ni oyentes de un menú anterior
    const m = cont && cont.querySelector('.ish-menu'); if (!m) return;
    const b = m.parentElement.querySelector('[data-menu]'), r = b.getBoundingClientRect(), h = m.offsetHeight;
    m.style.position = 'fixed'; m.style.left = 'auto'; m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    m.style.top = (r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - 4 - h) : r.bottom + 4) + 'px';
    const quitar = () => { clearTimeout(t); window.removeEventListener('scroll', fuera, true); window.removeEventListener('resize', fuera); };
    const fuera = () => { quitar(); limpiaMenu = null; cerrar(); };
    const t = setTimeout(() => { window.addEventListener('scroll', fuera, true); window.addEventListener('resize', fuera); }, 300);
    limpiaMenu = quitar;
  };
  // Para otras pantallas propias: etiquetas de un permiso por id.
  // Estado vacío compartido: si hay filtros activos ofrece limpiarlos; si no, invita a crear el primero.
  const vacioHTML = (filtrado, sinFiltro, conFiltro) => `<div class="ish-nada-g" role="status"><span class="ish-nada-g__i" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg></span><p>${filtrado ? conFiltro : sinFiltro}</p>${filtrado ? '<button type="button" class="nwt-button nwt-button--text" data-limpiar>Limpiar búsqueda y filtros</button>' : ''}</div>`;
  window.ACRED_DATOS = Object.assign(window.ACRED_DATOS || {}, { vacioHTML, listo, TAM, ubicarMenu, ICO, filtroEstado, paginador, etiquetasDe: (id) => { const e = window.__ACRED_ESTADO__; const p = e && e.accessPermissions.find((x) => x.id === id); return (p && p.tags) || []; } });

  // ── Estado de la vista ─────────────────────────────────────────────────────
  const S = { tab: 'zona', q: '', estado: 'todos', pag: 1, est: null, menu: null, modal: null, aviso: '' };
  let cont = null, opener = null, modalEl = null;
  const vacio = () => ({ indicativo: '', name: '', description: '', zone: '', sedes: [], tags: [], icon: undefined, iconNombre: '', error: '', errorIcono: '' });

  const campo = (rotulo, valor, attrs, req) =>
    `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}${req ? '<span class="nwt-input-box__required">*</span>' : ''}</label>` +
    `<div class="nwt-input-box__control"><input class="nwt-text-field__input" type="text" value="${esc(valor)}" ${attrs}></div></div></div></div>`;

  // ── Tabla ──────────────────────────────────────────────────────────────────
  const filtrada = () => {
    const q = sinTildes(S.q.trim()); if (!S.est) return [];
    return S.est.accessPermissions.filter((p) => p.kind === S.tab && (S.estado === 'todos' || (S.estado === 'activo') === (p.is_active !== false)) && (!q || sinTildes([p.name, p.description, p.indicativo, (p.tags || []).join(' ')].join(' ')).includes(q)));
  };
  const filaHTML = (p) => {
    const tags = (p.tags || []).length ? p.tags.map((t) => `<span class="nwt-tag ish-tag-et" nwt-size="small">${esc(t)}</span>`).join('') : '—';
    const ico = p.icon_data ? `<img class="ish-ico" src="${esc(p.icon_data)}" alt="Ícono de ${esc(p.name)}">` : '—';
    const ident = p.kind === 'zona' ? `<span class="ish-ind" title="Indicativo de la zona">${esc(p.indicativo || '—')}</span>` : ico;
    const act = p.is_active !== false;
    const abierto = S.menu === p.id;
    return `<tr class="nwt-datatable__record"><td class="nwt-datatable__cell nwt-width-xs-10">${ident}</td><td class="nwt-datatable__cell nwt-width-xs-15"><span class="nwt-text-font-medium">${esc(p.name)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15"><span>${esc(p.description || '—')}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-30"><div class="ish-chips">${tags}</div></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-10 ish-c"><span class="nwt-badge nwt-badge--vignette" role="status" nwt-theme="${act ? 'positive' : 'neutral'}" nwt-size="medium" nwt-variant="quiet"><div class="nwt-badge__content"><div class="nwt-badge__label">${act ? 'Activo' : 'Inactivo'}</div></div></span></td>` +
      `<td class="nwt-datatable__cell nwt-datatable__cell--actions nwt-align-right ish-acc"><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="Acciones de ${esc(p.name)}" aria-haspopup="menu" aria-expanded="${abierto}" data-menu="${p.id}" data-key="m-${p.id}"><div class="nwt-icon"><i class="naotech-icon-overflow-menu-vertical"></i></div></button></span>` +
      (abierto ? `<div class="ish-menu" role="menu"><button type="button" role="menuitem" data-editar="${p.id}" data-key="ed-${p.id}">${ICO.editar}<span>Editar</span></button><button type="button" role="menuitem" data-estado="${p.id}">${act ? ICO.inactivar : ICO.activar}<span>${act ? 'Inactivar' : 'Activar'}</span></button></div>` : '') + `</td></tr>`;
  };
  // Pestañas Zonas | Servicios: las del SDK (nwt-tabs), con la línea del color de acento bajo la activa.
  const cuenta = (k) => (S.est ? S.est.accessPermissions.filter((p) => p.kind === k).length : 0);
  const tabsHTML = () => `<div class="ish-tabs"><div class="nwt-tabs"><div class="nwt-tabs__list" role="tablist" aria-label="Tipo de permiso"><div class="nwt-tabs__divider"></div>` +
    [['zona', 'Zonas'], ['servicio', 'Servicios']].map(([k, t]) => `<button type="button" role="tab" class="nwt-tabs__tab nwt-tabs__tab--auto${S.tab === k ? ' nwt-tabs__tab--active' : ''}" aria-selected="${S.tab === k}" data-tab="${k}" data-key="tab-${k}"><span class="nwt-tabs__label"><span class="nwt-tabs__label-text">${t} (${cuenta(k)})</span></span></button>`).join('') +
    `<span class="nwt-tabs__indicator" aria-hidden="true"></span></div></div></div>`;
  // El indicador se mide sobre la pestaña activa.
  const pintaPildora = (anima) => { const l = cont && cont.querySelector('.nwt-tabs__list'); if (!l) return; const a = l.querySelector('.nwt-tabs__tab--active'), p = l.querySelector('.nwt-tabs__indicator'); if (!a || !p) return; if (!anima) p.style.transition = 'none'; p.style.width = a.offsetWidth + 'px'; p.style.insetInlineStart = a.offsetLeft + 'px'; if (!anima) { void p.offsetWidth; p.style.transition = ''; } };
  let tAv = null; // el aviso («Tipo creado»…) es pasajero: se quita solo a los 4 s
  const avisoTransitorio = () => { clearTimeout(tAv); if (S.aviso) tAv = setTimeout(() => { S.aviso = ''; const e = cont && cont.querySelector('.ish-guardado'); if (e) e.textContent = ''; }, 4000); };
  const dibujar = () => {
    if (!cont) return;
    avisoTransitorio();
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const todas = filtrada(), pags = Math.max(1, Math.ceil(todas.length / TAM)); if (S.pag > pags) S.pag = pags;
    const l = todas.slice((S.pag - 1) * TAM, S.pag * TAM);
    const cuerpo = !S.est ? '<p class="ish-vacio">Cargando…</p>' : l.length ? `<div class="nwt-datatable"><div class="nwt-datatable__table"><table><thead class="nwt-datatable__head"><tr class="nwt-datatable__header">` +
      `<th class="nwt-datatable__title nwt-width-xs-10">${S.tab === 'zona' ? 'Indicativo' : 'Ícono'}</th><th class="nwt-datatable__title nwt-width-xs-15">${S.tab === 'zona' ? 'Nombre de la zona' : 'Nombre del servicio'}</th><th class="nwt-datatable__title nwt-width-xs-15">Descripción</th><th class="nwt-datatable__title nwt-width-xs-30">Etiquetas</th><th class="nwt-datatable__title nwt-width-xs-10 ish-c">Estado</th><th class="nwt-datatable__title nwt-datatable__title--actions nwt-align-right"></th></tr></thead>` +
      `<tbody class="nwt-datatable__body">${l.map(filaHTML).join('')}</tbody></table></div></div>${paginador(S.pag, pags)}` : vacioHTML(!!(S.q || S.estado !== 'todos'), S.tab === 'zona' ? 'Todavía no hay zonas. Crea la primera con «Agregar zona».' : 'Todavía no hay servicios. Crea el primero con «Agregar servicio».', 'Ningún permiso coincide con la búsqueda.');
    cont.innerHTML =
      `<section class="nws-access-permissions ish-perms"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">Catálogo de permisos de acceso</span>` +
      `<small class="nwt-smalltext-font-regular">Los permisos se dividen en zonas (llevan un indicativo o número) y servicios (llevan un ícono). Cada uno puede tener etiquetas, por ejemplo alimentación: desayuno, almuerzo, cena.</small></div>` +
      `<div class="nws-access-permissions__actions"><span class="ish-guardado" role="status" aria-live="polite">${esc(S.aviso)}</span><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="medium" data-nuevo data-key="nuevo"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>${S.tab === 'zona' ? 'Agregar zona' : 'Agregar servicio'}</span></button></div></div>` +
      `${tabsHTML()}` +
      `<div class="nwt-card nws-access-permissions__catalog" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `<div class="ish-filtros"><div class="ish-busca"><div class="nwt-searchbox"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-searchbox__container"><div class="nwt-icon"><i class="naotech-icon-search"></i></div>` +
      `<input class="nwt-searchbox__input" placeholder="Buscar por nombre, indicativo o etiqueta" type="text" value="${esc(S.q)}" data-buscar data-key="buscar" aria-label="Buscar permisos"></div></div></div></div></div></div>${filtroEstado(S.estado)}</div>${cuerpo}</div></div></div></section>`;
    pintaPildora(false);
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) { e.focus(); if (e.matches('[data-buscar]')) e.setSelectionRange(e.value.length, e.value.length); } }
    ubicarMenu(cont, () => { if (S.menu != null) { S.menu = null; dibujar(); } });
  };

  // ── Modal (mismo marcado y clases que el del micro) ────────────────────────
  // Multiselector compartido (multiselect.js): sedes (con «Todas») y etiquetas (se pueden crear).
  const MS = window.ACRED_MS;
  const unicos = (l) => { const v = []; l.forEach((t) => { if (!v.some((x) => sinTildes(x) === sinTildes(t))) v.push(t); }); return v; };
  const opcionesMs = (id) => {
    const f = S.modal && S.modal.form; if (!f) return [];
    if (id === 'sede') return unicos([...SEDES_DEMO, ...f.sedes]).map((t) => ({ v: t, t }));
    const del = S.est ? S.est.accessPermissions.flatMap((p) => p.tags || []) : [];
    return unicos([...del, ...f.tags]).map((t) => ({ v: t, t }));
  };
  const msApi = {
    raiz: () => modalEl, redibujar: (foco) => montarModal(foco), vivo: () => !!S.modal, opciones: (id) => opcionesMs(id),
    alternar: (id, v) => {
      const f = S.modal.form;
      if (id === 'sede' && v === '__todos') { const todas = opcionesMs('sede').every((o) => f.sedes.includes(o.v)); f.sedes = todas ? [] : opcionesMs('sede').map((o) => o.v); return; }
      const l = id === 'sede' ? f.sedes : f.tags, i = l.findIndex((x) => sinTildes(x) === sinTildes(v));
      if (i >= 0) l.splice(i, 1); else l.push(v);
    },
    quitar: (id, v) => { const f = S.modal.form, l = id === 'sede' ? f.sedes : f.tags, i = l.indexOf(v); if (i >= 0) l.splice(i, 1); },
    seleccionar: (id, v) => { const f = S.modal.form, l = id === 'sede' ? f.sedes : f.tags; if (!l.some((x) => sinTildes(x) === sinTildes(v))) l.push(v); },
    crear: (id, txt) => { const v = txt.replace(/\s+/g, ' ').replace(/\|/g, '').trim(); if (!v) return; const ya = opcionesMs('tags').find((o) => sinTildes(o.t) === sinTildes(v)); const t = ya ? ya.t : v; if (!S.modal.form.tags.some((x) => sinTildes(x) === sinTildes(t))) S.modal.form.tags.push(t); }
  };
  window.addEventListener('resize', () => MS.ubicar(modalEl, S.modal));
  // Topes (usos y vigencia). Ya no viven en el permiso: se fijan POR TIPO DE ACREDITADO (los periodistas no comen lo mismo que los deportistas).
  // Este bloque lo dibuja el modal de «Tipos de acreditados». `pid` identifica el permiso; `k`, el tope: 'g' (general) o el nombre de la etiqueta.
  const celdaV = (tipo, valor, k, campo, rotulo, quien, extra) => `<div class="ish-tope-c" data-l="${rotulo}"><div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><input class="nwt-text-field__input" type="${tipo}" value="${esc(valor)}" data-vf="${esc(k)}|${campo}" aria-label="${rotulo} · ${esc(quien)}" ${extra || ''} autocomplete="off"></div></div></div></div></div>`;
  const selCeldaV = (valor, k, quien) => `<div class="ish-tope-c" data-l="Por"><div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select class="ish-sel__in" data-vf="${esc(k)}|por" aria-label="Por · ${esc(quien)}"><option value="total"${valor === 'total' ? ' selected' : ''}>En total</option><option value="dia"${valor === 'dia' ? ' selected' : ''}>Por día</option></select><div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div></div>`;
  const filaTope = (nombreHTML, t, k, quien) => `<div class="ish-tope-card"><div class="ish-tope-n">${nombreHTML}</div><div class="ish-tope-g">${celdaV('number', t.usos, k, 'usos', 'Usos', quien, 'min="1" step="1" placeholder="Sin tope" inputmode="numeric"')}${selCeldaV(t.por, k, quien)}${celdaV('date', t.desde, k, 'desde', 'Desde', quien)}${celdaV('date', t.hasta, k, 'hasta', 'Hasta', quien, `min="${esc(t.desde)}"`)}</div></div>`;
  const valHTML = (v, tags, pid, nombre, extra, conEtiq) => {
    const sw = `<div class="nwt-switch${v.activa ? ' nwt-switch--checked' : ''}" role="switch" tabindex="0" aria-checked="${v.activa}" aria-label="Cuenta con validación · ${esc(nombre)}" data-vsw="${pid}" data-key="vsw-${pid}"><div class="nwt-switch__component"><div class="nwt-switch__component__element"></div></div></div>`;
    let cuerpo = '';
    if (v.activa) {
      cuerpo = `<div class="ish-tope-tabla">` + (conEtiq
        ? (tags.length ? `<div class="ish-tope-et">${tags.map((t) => filaTope(`<span class="nwt-tag ish-tag-et" nwt-size="small">${esc(t)}</span>`, v.etiquetas[t] || tope0(), pid + '~' + t, t)).join('')}</div>` : '<p class="ish-vacio">Elige al menos una etiqueta para asignarle usos.</p>')
        : filaTope('<b>Validación</b>', v.global, pid + '~g', 'validación')) +
        `</div><div class="nwt-alert nwt-alert--visible ish-alerta ish-alerta--form" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div><span class="nwt-alert__label" data-err-val="${pid}">${esc(errVal(v, tags, conEtiq))}</span></div></div>`;
    }
    return `<div class="ish-val-bloque" data-val="${pid}"><div class="ish-val-top"><span class="ish-val-n">${esc(nombre)}</span><label class="ish-sw-fila">${sw}<span>Cuenta con validación</span></label></div>${extra || ''}${cuerpo}</div>`;
  };
  window.ACRED_VAL = { tope0, val0, errVal, topeTxt, valHTML };
  const modalHTML = () => {
    const m = S.modal, f = m.form, edita = m.modo === 'editar', zona = m.kind === 'zona', titulo = (edita ? 'Editar ' : 'Nueva ').replace('Nueva ', zona ? 'Nueva ' : 'Nuevo ') + (zona ? 'zona' : 'servicio');
    return `<div class="nwt-modal nwt-modal--visible nws-accreditations-module nws-access-permission-modal ish-modal ish-modal--ancho" role="dialog" aria-modal="true" aria-label="${titulo}">` +
      `<div class="nwt-modal__content"><div class="nwt-modal__header"><div class="nwt-modal__header__description"><span class="ish-modal__t">${titulo}</span><span class="ish-modal__sub">${zona ? 'Una zona de acceso: lleva un indicativo o número que aparece en la acreditación.' : 'Un servicio del evento: lleva un ícono que aparece en la acreditación.'}</span></div>` +
      `<span class="nwt-modal__close" role="button" tabindex="0" aria-label="Cerrar" data-cerrar><div class="nwt-icon"><i class="naotech-icon-close"></i></div></span></div>` +
      `<div class="nwt-modal__component"><div class="nws-access-permission-modal__body"><div class="naotech-grid naotech-grid--4">` +
      (zona ? `<div class="naotech-col--2">${campo('Nombre de la zona', f.name, 'data-f="name" placeholder="Ej: Villa Olímpica / Residencial" maxlength="80"', true)}${er('name')}</div>` +
        `<div class="naotech-col--2">${campo('Indicativo o número', f.indicativo, 'data-f="indicativo" placeholder="Ej: 1" maxlength="4" autocomplete="off"', true)}${er('indicativo')}</div>`
        : `<div class="naotech-col--4">${campo('Nombre del servicio', f.name, 'data-f="name" placeholder="Ej: Alimentación" maxlength="80"', true)}${er('name')}</div>`) +
      `<div class="naotech-col--4">${campo('Descripción (opcional)', f.description, 'data-f="description" placeholder="Ej: Áreas donde se aloja y vive la delegación" maxlength="160"')}</div>` +
      // Las sedes de cada permiso están por validarse: por ahora no se piden ni se muestran.
      `<div class="naotech-col--4">${MS.html(m, { id: 'tags', etiqueta: zona ? 'Etiquetas de la zona' : 'Etiquetas del servicio', ph: 'Selecciona o crea etiquetas', opciones: opcionesMs('tags'), sel: f.tags, crear: true, busca: 'Buscar etiqueta', agregaPh: 'Agregar otra etiqueta (nombre)' })}</div>` +
      (zona ? '' : `<div class="naotech-col--4"><div class="nwt-file-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">Ícono del servicio<span class="nwt-input-box__required">*</span></label><div class="nwt-input-box__control"><div class="nwt-file-field__content"><div class="nwt-file-field__icon"><div class="nwt-icon"><i class="naotech-icon-attach"></i></div></div>` +
      `<input class="nwt-file-field__picker" accept="image/svg+xml" type="file" data-icono aria-label="Subir ícono SVG"><input class="nwt-file-field__display" placeholder="Seleccione el archivo" readonly type="text" value="${esc(f.iconNombre)}" tabindex="-1"><div class="nwt-file-field__button"><div class="nwt-icon"><i class="naotech-icon-upload"></i></div></div></div></div>` +
      `<div class="nwt-input-box__message"><span class="${f.errorIcono ? 'ish-err' : ''}">${esc(f.errorIcono || 'Formato del archivo debe ser .svg, máximo 1 MB')}</span></div></div></div></div>${er('icono')}</div>`) +
      (f.error ? `<div class="naotech-col--4"><div class="nwt-alert nwt-alert--visible ish-alerta ish-alerta--form" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div><span class="nwt-alert__label">${esc(f.error)}</span></div></div></div>` : '') +
      `</div><footer class="nws-access-permission-modal__footer ish-modal__footer"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="large" data-cerrar><span class="nwt-button__content">Cancelar</span></button><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="large" data-guardar><span class="nwt-button__content">${edita ? 'Guardar cambios' : 'Crear'}</span></button></footer></div></div></div><div class="nwt-modal__backdrop" data-cerrar></div></div>`;
  };
  // Mensajes por campo: «Crear» siempre está activo; si falta algo marca el campo y dice qué.
  const erroresF = (f) => {
    const e = {}, zona = S.modal && S.modal.kind === 'zona';
    if (!f.name.trim()) e.name = zona ? 'Escribe el nombre de la zona.' : 'Escribe el nombre del servicio.';
    if (zona) {
      const ind = f.indicativo.trim();
      if (!ind) e.indicativo = 'Escribe el indicativo o número de la zona.';
      else { const otra = S.est && S.est.accessPermissions.find((p) => p.kind === 'zona' && p.id !== S.modal.id && sinTildes(String(p.indicativo)) === sinTildes(ind)); if (otra) e.indicativo = `El indicativo «${ind}» ya lo usa la zona «${otra.name}».`; }
    }
    if (!zona && !f.icon && !f.iconNombre) e.icono = 'Sube el ícono del servicio.';
    return e;
  };
  const er = (k) => { const m = S.modal && S.modal.form.ver && erroresF(S.modal.form)[k]; return m ? `<p class="ish-err" role="alert" data-err="${k}">${esc(m)}</p>` : ''; };
  const refrescaErr = () => { const m = S.modal; if (!m || !m.form.ver || !modalEl) return; const e = erroresF(m.form); modalEl.querySelectorAll('[data-err]').forEach((p) => { if (!e[p.dataset.err]) { const pe = p.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.remove('nwt-input-box--error'); } p.remove(); } }); };
  const valido = (f) => !Object.keys(erroresF(f)).length; // la descripción es opcional; las sedes están por validarse
  const montarModal = (foco) => {
    const bd = modalEl && modalEl.querySelector('.nws-access-permission-modal__body'), sc = bd ? bd.scrollTop : 0;
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div'); modalEl.id = 'ish-modal-permiso'; modalEl.innerHTML = modalHTML();
    modalEl.dataset.anim = (S.modal && S.modal.anim) || ''; if (S.modal) { S.modal.anim = ''; S.modal.cierre = null; }
    modalEl.querySelectorAll('[data-err]').forEach((p) => { const pe = p.previousElementSibling; if (pe) { pe.classList.add('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.add('nwt-input-box--error'); } });
    document.body.append(modalEl);
    const b2 = modalEl.querySelector('.nws-access-permission-modal__body'); if (b2) b2.scrollTop = sc;
    const e = foco && (foco[0] === '[' ? modalEl.querySelector(foco) : [...modalEl.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco));
    const el = e || modalEl.querySelector('[data-f="name"]'); el.focus(); if (el.matches && el.matches('[data-ms-q]')) el.setSelectionRange(el.value.length, el.value.length);
    MS.ubicar(modalEl, S.modal); if (b2) b2.addEventListener('scroll', () => MS.ubicar(modalEl, S.modal));
  };
  const abrir = (modo, p) => {
    opener = document.activeElement; S.menu = null;
    S.modal = { modo, id: p && p.id, kind: p ? p.kind : S.tab, ms: null, msq: '', msadd: '', anim: '', cierre: null, form: p ? Object.assign(vacio(), { name: p.name, indicativo: p.indicativo || '', description: p.description || '', sedes: sedesDe(p), tags: (p.tags || []).slice(), iconNombre: p.icon_data ? 'Ícono cargado' : '' }) : vacio() };
    dibujar(); montarModal();
  };
  const cerrarModal = () => { if (modalEl) { modalEl.remove(); modalEl = null; } S.modal = null; if (opener && document.contains(opener)) opener.focus(); };
  const guardarModal = () => {
    const m = S.modal, f = m.form;
    if (!valido(f)) { f.ver = true; m.ms = null; montarModal(); const p = modalEl.querySelector('[data-err]'); if (p) p.scrollIntoView({ block: 'nearest' }); return; }
    const igual = S.est.accessPermissions.some((p) => p.id !== m.id && p.kind === m.kind && sinTildes(p.name.trim()) === sinTildes(f.name.trim()));
    if (igual) { f.error = m.kind === 'zona' ? 'Ya existe un permiso con ese nombre.' : 'Ya existe un permiso con ese nombre.'; return montarModal('[data-f="name"]'); }
    const d = { kind: m.kind, indicativo: f.indicativo.trim(), name: f.name.trim(), description: f.description.trim(), sedes: f.sedes, tags: f.tags, icon: f.icon };
    if (m.modo === 'editar') editar(S.est.accessPermissions.find((p) => p.id === m.id), d); else crear(S.est, Object.assign(d, { icon: f.icon || null }));
    S.aviso = m.modo === 'editar' ? 'Cambios guardados' : (m.kind === 'zona' ? 'Zona creada' : 'Servicio creado');
    const era = m.modo; opener = null; cerrarModal(); dibujar();
    const b = cont.querySelector(era === 'editar' ? '[data-menu]' : '[data-nuevo]'); if (b && era !== 'editar') b.focus();
  };

  // ── Eventos ────────────────────────────────────────────────────────────────
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if ((b = q('[data-pag]'))) { S.pag += b.dataset.pag === 'next' ? 1 : -1; return dibujar(); }
    if ((b = q('[data-tab]'))) { if (S.tab === b.dataset.tab) return; const antes = cont.querySelector('.nwt-tabs__indicator'), x0 = antes ? antes.style.insetInlineStart : '', w0 = antes ? antes.style.width : ''; S.tab = b.dataset.tab; S.pag = 1; S.menu = null; dibujar(); const p = cont.querySelector('.nwt-tabs__indicator'); if (p) { p.style.transition = 'none'; p.style.insetInlineStart = x0; p.style.width = w0; void p.offsetWidth; p.style.transition = ''; pintaPildora(true); } return; }
    if (q('[data-limpiar]')) { S.q = ''; S.estado = 'todos'; S.pag = 1; return dibujar(); }
    if ((b = q('[data-nuevo]'))) return abrir('crear');
    if ((b = q('[data-menu]'))) { const id = +b.dataset.menu, cerrando = S.menu === id; S.menu = cerrando ? null : id; dibujar(); if (cerrando && e.detail) { const a = document.activeElement; if (a && a.matches && a.matches('[data-menu]')) a.blur(); } return; }
    if ((b = q('[data-editar]'))) return abrir('editar', S.est.accessPermissions.find((p) => p.id === +b.dataset.editar));
    if ((b = q('[data-estado]'))) { const p = S.est.accessPermissions.find((x) => x.id === +b.dataset.estado); p.is_active = p.is_active === false; guardar(); S.menu = null; S.aviso = p.is_active ? 'Permiso activado' : 'Permiso inactivado'; return dibujar(); }
    if (S.menu != null && !q('.ish-menu')) { S.menu = null; dibujar(); }
  };
  const onModal = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if (q('[data-cerrar]')) return cerrarModal();
    if (MS.click(e, S.modal, msApi)) return;
    if (S.modal.ms && !q('.ish-ms')) { S.modal.ms = null; S.modal.msq = ''; montarModal(); }
    if (q('[data-guardar]')) return guardarModal();
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.matches('[data-buscar]')) { S.q = t.value; S.pag = 1; return dibujar(); }
    if (!S.modal) return;
    if (MS.entrada(e, S.modal, msApi)) return;
    if (t.dataset.f) { S.modal.form[t.dataset.f] = t.value; S.modal.form.error = ''; refrescaErr(); }
  };
  const onKeyModal = (e) => {
    if (S.modal && MS.tecla(e, S.modal, msApi)) return;
    if (e.key === 'Escape') { e.stopPropagation(); return cerrarModal(); }
    if (e.target.matches && e.target.matches('[role=option],[role=combobox],[role=switch]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return e.target.click(); }
    if (e.target.matches && e.target.matches('[data-cerrar]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return cerrarModal(); }
    if (e.key === 'Tab' && modalEl) { // el foco no sale del modal
      const f = [...modalEl.querySelectorAll('button:not([disabled]),input:not([tabindex="-1"]),[tabindex="0"]')].filter((x) => x.offsetParent);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  const onChangeModal = (e) => {
    const t = e.target;
    if (!t.matches || !t.matches('[data-icono]') || !S.modal) return;
    const f = S.modal.form, file = t.files && t.files[0]; if (!file) return;
    if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) { f.errorIcono = 'El archivo debe ser .svg.'; return montarModal(); }
    if (file.size > 1024 * 1024) { f.errorIcono = 'El archivo pesa más de 1 MB.'; return montarModal(); }
    const r = new FileReader(); r.onload = () => { f.icon = String(r.result); f.iconNombre = file.name; f.errorIcono = ''; montarModal(); }; r.readAsDataURL(file);
  };
  document.addEventListener('click', (e) => { if (modalEl && modalEl.contains(e.target)) onModal(e); });
  document.addEventListener('input', (e) => { if (modalEl && modalEl.contains(e.target)) onInput(e); });
  document.addEventListener('keydown', (e) => { if (modalEl && modalEl.contains(e.target) || (modalEl && e.key === 'Escape')) onKeyModal(e); else if (e.key === 'Escape' && S.menu != null && cont && cont.dataset.id === 'permisos' && cont.contains(e.target)) { S.menu = null; dibujar(); } });
  document.addEventListener('change', (e) => { if (modalEl && modalEl.contains(e.target)) onChangeModal(e); });

  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.permisos = {
    render(el) {
      cont = el; S.aviso = ''; S.menu = null;
      if (!cont.__ligadoP) { const mia = (f) => (e) => { if (cont && cont.dataset.id === 'permisos') f(e); }; cont.addEventListener('click', mia(onClick)); cont.addEventListener('input', mia(onInput)); cont.addEventListener('change', mia((e) => { if (e.target.matches('[data-fest]')) { S.estado = e.target.value; S.pag = 1; dibujar(); } })); cont.__ligadoP = true; }
      dibujar();
      listo().then((est) => { if (!est) { cont.innerHTML = '<p class="ish-vacio" role="alert">No se pudo leer el catálogo de permisos.</p>'; return; } asegurar(est); S.est = est; dibujar(); });
    }
  };
})();
