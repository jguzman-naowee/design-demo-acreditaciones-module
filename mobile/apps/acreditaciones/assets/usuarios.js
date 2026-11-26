// Pantalla propia «Usuarios» (de cada evento: dentro del evento, para el Gestor y el Operador): quién entra a la plataforma, con qué perfil y qué puede ver y hacer.
// Los usuarios son de la cuenta, no de un evento: la pantalla vive fuera del evento (sin panel ni chip de evento, junto al selector
// de eventos). Lo que sí es de un evento —los tipos de acreditado que gestiona— se elige por evento dentro del formulario.
// JS plano, sin compilar. Lee del gateway simulado los tipos de acreditados y el catálogo de permisos y guarda los usuarios
// en localStorage. La monta shell.js en #ish-pantalla (hash «#/usuarios»); el micro no se toca.
//
// Modelo de roles (25-nov, aclaración de Danna): Gestor de acreditaciones (usuarios, permisos, tipos) · Operador de acreditaciones
// (toda la entrega; crea operadores externos) · Operador externo (es un tipo de acreditado con acceso para registrar y validar
// documentos; no valida accesos) · Validador (valida por zona y etiqueta). El gestor crea los tres últimos; el operador solo externos.
// Los nombres de perfil son provisionales; se cambian en PERFILES.
(() => {
  const KEY = 'naowee.acreditaciones.usuarios.v4';
  const GW = '/public-gateway/v1/accreditation';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const get = (path) => new Promise((ok, ko) => {
    const x = new XMLHttpRequest(); x.open('GET', GW + path);
    x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { ko(e); } };
    x.onerror = () => ko(new Error('Sin conexión con el gateway')); x.send();
  });
  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const sumar = (iso, dias) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fmt = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  // ── Modelo ─────────────────────────────────────────────────────────────────
  const ACCIONES = [['crear', 'Crear'], ['editar', 'Editar'], ['inhabilitar', 'Inhabilitar'], ['descargar', 'Descargar']];
  const GRUPOS = [
    { g: 'entrega', t: 'Entrega de acreditaciones', filas: [
      { k: 'nuevos', t: 'Nuevos acreditados', a: ['crear', 'editar', 'inhabilitar', 'descargar'] },
      { k: 'generar', t: 'Generar acreditaciones', a: ['crear', 'inhabilitar', 'descargar'] },
      { k: 'lista', t: 'Lista de acreditados', a: ['descargar'] }] },
    { g: 'usuarios', t: 'Usuarios y formularios', filas: [
      { k: 'externos', t: 'Operadores externos', a: ['crear', 'editar', 'inhabilitar'] },
      { k: 'formularios', t: 'Formularios de registro', a: ['crear', 'editar', 'inhabilitar'] }] },
    // Validaciones: los validadores escanean y validan en puerta. «Crear» deja crear validadores y pide qué pueden validar.
    { g: 'validaciones', t: 'Validaciones', filas: [
      { k: 'validadores', t: 'Validadores', a: ['crear', 'editar', 'inhabilitar'] }] }
  ];
  const PERFILES = [
    { id: 'gestor', n: 'Gestor de acreditaciones', d: 'Parametriza usuarios, permisos y tipos de acreditado.', alcance: 'todos' },
    { id: 'operador', n: 'Operador de acreditaciones', d: 'Gestiona toda la entrega y crea operadores externos.', alcance: 'tipos' },
    { id: 'externo', n: 'Operador externo', d: 'Es un tipo de acreditado con acceso para registrar y validar documentos.', alcance: 'externo' },
    { id: 'validador', n: 'Validador', d: 'Escanea y valida los permisos que se le asignen.', alcance: 'permisos' }
  ];
  // Quién crea a quién: el gestor crea operadores, externos y validadores; el operador solo crea operadores externos.
  const CREA = { gestor: ['gestor', 'operador', 'externo', 'validador'], operador: ['externo'] };
  const miRol = () => (window.__ACRED_ROL__ ? window.__ACRED_ROL__() : 'gestor');
  const perfilesNuevos = () => PERFILES.filter((p) => (CREA[miRol()] || []).includes(p.id));
  const verPerfil = (id) => miRol() !== 'operador' || id === 'externo';
  const perfil = (id) => PERFILES.find((p) => p.id === id) || PERFILES[0];
  // Acciones DISPONIBLES por perfil: el operador tiene toda la entrega; el externo solo registra (sin generar ni lista).
  const TODAS = ['crear', 'editar', 'inhabilitar', 'descargar'];
  const DISPONIBLE = {
    gestor: { nuevos: TODAS, generar: TODAS, lista: TODAS, externos: TODAS, formularios: TODAS, validadores: TODAS },
    operador: { nuevos: ['crear', 'editar', 'inhabilitar', 'descargar'], generar: ['crear', 'inhabilitar', 'descargar'], lista: ['inhabilitar', 'descargar'], externos: ['crear', 'editar', 'inhabilitar'], formularios: ['crear', 'editar', 'inhabilitar'] },
    externo: { nuevos: ['crear', 'editar'], generar: [], lista: [] }
  };
  // Gestor y operador ven la cuadrícula completa: lo que el operador no trae de fábrica (antes una raya) sale desmarcado y se puede marcar.
  const disponibles = (pid, fi) => (pid === 'gestor' || pid === 'operador' ? TODAS : DISPONIBLE[pid] && DISPONIBLE[pid][fi.k] ? fi.a.filter((a) => DISPONIBLE[pid][fi.k].includes(a)) : fi.a);
  const filas0 = () => { const o = {}; GRUPOS.forEach((g) => g.filas.forEach((f) => { o[f.k] = {}; })); return o; };
  const marca = (o, k, acs) => { acs.forEach((a) => { o[k][a] = true; }); };
  // Lo que cada perfil trae de fábrica. El gestor lo ajusta después.
  const preset = (pid, permisos) => {
    const p = { entrega: false, validacion: false, filas: filas0(), valida: [] };
    if (pid === 'gestor') {
      p.entrega = p.validacion = true; GRUPOS.forEach((g) => g.filas.forEach((f) => marca(p.filas, f.k, TODAS))); p.valida = permisos.map((x) => x.id);
    } else if (pid === 'operador') {
      p.entrega = true; marca(p.filas, 'nuevos', ['crear', 'editar', 'descargar']); marca(p.filas, 'generar', ['crear', 'inhabilitar', 'descargar']); marca(p.filas, 'lista', ['descargar']); marca(p.filas, 'externos', ['crear', 'editar', 'inhabilitar']); marca(p.filas, 'formularios', ['crear', 'editar', 'inhabilitar']);
    } else if (pid === 'externo') {
      p.entrega = true; p.ext = ext0(); marca(p.filas, 'nuevos', ['crear', 'editar']);
    } else { p.validacion = true; }
    return p;
  };

  let D = {};
  const leer = () => { try { D = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { D = {}; } };
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  const lista = () => (D.usuarios = D.usuarios || []);

  // Primera vez: el mismo elenco del selector de perfiles, para que la demo arranque con datos.
  // `eventos` = { código del evento: [códigos de tipos de acreditado] }; el gestor entra a todos (eventos: null).
  const sembrar = () => {
    if (D.usuarios) return;
    const ev = S.eventos[0], codEv = ev && ev.code, tipos = (S.tipos[codEv] || []).map((r) => r.code);
    const vol = (S.tipos[codEv] || []).find((r) => /voluntari/i.test(r.nombre)) || (S.tipos[codEv] || [])[0];
    const alim = S.permisos.find((p) => /aliment/i.test(p.name));
    const mk = (id, nombre, correo, pf, eventos, extra) => Object.assign({ propios: {}, id, nombre, correo, desde: '2026-11-01', hasta: '2026-12-31', perfil: pf, activo: true, eventos, perm: preset(pf, S.permisos), creado: '2026-11-01' }, extra || {});
    const propio = (S.tipos[codEv] || []).find((r) => /coord/i.test(r.nombre)) || vol;
    const c = mk(2, 'Isa Pabon', 'isa.pabon@demo.co', 'externo', codEv ? { [codEv]: vol ? [vol.code] : [] } : {}, propio ? { propios: { [codEv]: propio.code }, formulario: 'f1' } : {});
    const v = mk(4, 'Esteban Mora', 'esteban.mora@demo.co', 'validador', codEv ? { [codEv]: [] } : {});
    v.perm.valida = alim ? [alim.id] : [];
    D.usuarios = [mk(1, 'Danna Arrieta', 'danna.arrieta@demo.co', 'gestor', null), c, mk(3, 'Jorge Guzman', 'jorge.guzman@demo.co', 'operador', codEv ? { [codEv]: tipos } : {}), v];
    guardar();
  };

  // ── Estado de la vista ─────────────────────────────────────────────────────
  const UI = () => window.ACRED_DATOS;
  const S = { q: '', estado: 'todos', pag: 1, eventos: [], tipos: {}, permisos: [], cargando: true, error: '', menu: null, aviso: '', toast: '' };
  let cont = null, modalEl = null, opener = null, M = null, toastT = null;
  const estado = (u) => (!u.activo ? 'Inactivo' : u.hasta && u.hasta < hoy() ? 'Vencido' : 'Activo');
  const nombreEvento = (c) => (S.eventos.find((e) => e.code === c) || {}).nombre || c;
  const nombreTipo = (ev, c) => ((S.tipos[ev] || []).find((r) => r.code === c) || {}).nombre || c;
  const eventosTxt = (u) => {
    if (!u.eventos) return 'Todos los eventos';
    const k = Object.keys(u.eventos); if (!k.length) return 'Sin eventos asignados';
    return k.length > 1 ? `${k.length} eventos` : nombreEvento(k[0]);
  };
  const detalleTxt = (u) => {
    if (!u.eventos) return '';
    if (u.perfil === 'validador') { const n = (u.perm.valida || []).map((id) => (S.permisos.find((p) => p.id === id) || {}).name).filter(Boolean), t = Object.entries(u.eventos).flatMap(([ev, l]) => l.map((c) => nombreTipo(ev, c))); return (n.length ? 'Valida: ' + n.join(', ') : 'Sin permisos que validar') + (t.length ? ' · Tipos: ' + (t.length > 2 ? `${t.slice(0, 2).join(', ')} +${t.length - 2}` : t.join(', ')) : ''); }
    const t = Object.entries(u.eventos).flatMap(([ev, l]) => l.map((c) => nombreTipo(ev, c)));
    if (u.perfil === 'externo') { const p = Object.entries(u.propios || {}).map(([ev, c]) => nombreTipo(ev, c)); return (p.length ? 'Es: ' + p.join(', ') : 'Sin tipo propio') + (t.length ? ' · Registra: ' + (t.length > 2 ? `${t.slice(0, 2).join(', ')} +${t.length - 2}` : t.join(', ')) : ''); }
    const v = (u.perm.valida || []).map((id) => (S.permisos.find((p) => p.id === id) || {}).name).filter(Boolean);
    return (t.length ? 'Tipos: ' + (t.length > 2 ? `${t.slice(0, 2).join(', ')} +${t.length - 2}` : t.join(', ')) : 'Todos los tipos') + (v.length ? ' · Valida: ' + v.join(', ') : '');
  };
  const campoT = (rotulo, tipo, valor, attrs, req, msg) =>
    `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}${req ? '<span class="nwt-input-box__required">*</span>' : ''}</label>` +
    `<div class="nwt-input-box__control"><input class="nwt-text-field__input" type="${tipo}" value="${esc(valor)}" ${attrs}></div>${msg ? `<div class="nwt-input-box__message"><span>${msg}</span></div>` : ''}</div></div></div>`;
  const chk = (marcado, etiqueta, data, extra) =>
    `<div class="nwt-checkbox${marcado ? ' nwt-checkbox--checked' : ''}${extra && extra.dis ? ' nwt-checkbox--disabled' : ''}" nwt-size="medium" role="checkbox" tabindex="${extra && extra.dis ? -1 : 0}" aria-checked="${!!marcado}"${extra && extra.dis ? ' aria-disabled="true"' : ''} aria-label="${esc(etiqueta)}" ${data}>` +
    `<div class="nwt-checkbox__control">${marcado ? '<div class="nwt-icon"><i class="naotech-icon-positive"></i></div>' : ''}</div>${extra && extra.visible ? `<span class="nwt-checkbox__label">${esc(etiqueta)}</span>` : ''}</div>`;
  const sw = (on, etiqueta, data) => `<div class="nwt-switch${on ? ' nwt-switch--checked' : ''}" role="switch" tabindex="0" aria-checked="${on}" aria-label="${esc(etiqueta)}" ${data}><div class="nwt-switch__component"><div class="nwt-switch__component__element"></div></div></div>`;
  const boton = (txt, variante, attrs, tam) => `<button type="button" class="nwt-button" nwt-variant="${variante}" nwt-size="${tam || 'large'}" ${attrs}><span class="nwt-button__content">${txt}</span></button>`;

  // ── Listado ────────────────────────────────────────────────────────────────
  // La gestión de usuarios es de cada evento: se ven los del evento activo (y los gestores, que entran a todos).
  const evAct = () => eventoVinculo();
  const visibles = () => lista().filter((u) => verPerfil(u.perfil) && (!u.eventos || u.eventos[evAct()] !== undefined));
  const filtrados = () => { const q = sinTildes(S.q.trim()); return visibles().filter((u) => (S.estado === 'todos' || (S.estado === 'activo') === (estado(u) === 'Activo')) && (!q || sinTildes([u.nombre, u.correo, perfil(u.perfil).n, eventosTxt(u), detalleTxt(u)].join(' ')).includes(q))); };
  const filaHTML = (u) => {
    const est = estado(u), tema = est === 'Activo' ? 'positive' : est === 'Vencido' ? 'warning' : 'neutral', ab = S.menu === u.id;
    return `<tr class="nwt-datatable__record"><td class="nwt-datatable__cell nwt-width-xs-15"><span class="nwt-text-font-medium">${esc(u.nombre)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><span>${esc(u.correo)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15"><span class="ish-perfil-t">${esc(perfil(u.perfil).n)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><div class="ish-cel"><span class="ish-trunc" data-tip="${esc(u.eventos ? (detalleTxt(u) || '—') : 'Todos los eventos')}">${esc(u.eventos ? (detalleTxt(u) || '—') : 'Todos los eventos')}</span></div></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15"><span class="ish-vigencia">${u.desde || u.hasta ? `<span class="ish-f">${fmt(u.desde)}</span>  <span class="ish-f">${fmt(u.hasta)}</span>` : '<span class="ish-sin">Sin vencimiento</span>'}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-10 ish-c"><span class="nwt-badge nwt-badge--vignette" role="status" nwt-theme="${tema}" nwt-size="medium" nwt-variant="quiet"><div class="nwt-badge__content"><div class="nwt-badge__label">${est}</div></div></span></td>` +
      `<td class="nwt-datatable__cell nwt-datatable__cell--actions nwt-align-right ish-acc"><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="Acciones de ${esc(u.nombre)}" aria-haspopup="menu" aria-expanded="${ab}" data-menu="${u.id}" data-key="m-${u.id}"><div class="nwt-icon"><i class="naotech-icon-overflow-menu-vertical"></i></div></button></span>` +
      (ab ? `<div class="ish-menu" role="menu"><button type="button" role="menuitem" data-editar="${u.id}" data-key="ed-${u.id}">${UI().ICO.editar}<span>Editar</span></button><button type="button" role="menuitem" data-estado="${u.id}">${u.activo ? UI().ICO.inactivar : UI().ICO.activar}<span>${u.activo ? 'Inactivar usuario' : 'Activar usuario'}</span></button></div>` : '') + `</td></tr>`;
  };
  const dibujar = () => {
    if (!cont) return;
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const todos = filtrados(), TAM = (UI() && UI().TAM) || 10, pags = Math.max(1, Math.ceil(todos.length / TAM)); if (S.pag > pags) S.pag = pags;
    const l = todos.slice((S.pag - 1) * TAM, S.pag * TAM);
    const cuerpo = S.cargando ? '<p class="ish-vacio">Cargando…</p>' : S.error ? `<p class="ish-vacio ish-err" role="alert">${esc(S.error)}</p>` : l.length
      ? `<div class="nwt-datatable"><div class="nwt-datatable__table"><table><thead class="nwt-datatable__head"><tr class="nwt-datatable__header">` +
        `<th class="nwt-datatable__title nwt-width-xs-15">Nombre</th><th class="nwt-datatable__title nwt-width-xs-20">Correo electrónico</th><th class="nwt-datatable__title nwt-width-xs-15">Rol</th><th class="nwt-datatable__title nwt-width-xs-20">Asignación</th><th class="nwt-datatable__title nwt-width-xs-15">Vigencia</th><th class="nwt-datatable__title nwt-width-xs-10 ish-c">Estado</th><th class="nwt-datatable__title nwt-datatable__title--actions nwt-align-right"></th></tr></thead>` +
        `<tbody class="nwt-datatable__body">${l.map(filaHTML).join('')}</tbody></table></div></div>${UI() ? UI().paginador(S.pag, pags) : ''}`
      : `<div class="ish-vacio-g"><p class="nwt-subtitle-font-bold">${S.q ? 'Ningún usuario coincide con la búsqueda' : 'Aún no hay usuarios'}</p><p class="ish-vacio">${S.q ? 'Prueba con otro nombre, correo o rol.' : 'Crea el primer usuario y asígnale su perfil y permisos.'}</p></div>`;
    cont.innerHTML =
      `<section class="nws-access-permissions ish-perms"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">${miRol() === 'operador' ? 'Operadores externos' : 'Usuarios'}</span>` +
      `<small class="nwt-smalltext-font-regular">${miRol() === 'operador' ? 'Personas con acceso para registrar acreditados de los tipos que les asignes.' : 'Las personas con acceso a este evento: aquí se crean, se les da un rol y se define qué pueden hacer.'}</small></div>` +
      `<div class="nws-access-permissions__actions"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="medium" data-reporte data-key="reporte"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-download"></i></div>Descargar reporte</span></button>` +
      `<button type="button" class="nwt-button" nwt-variant="loud" nwt-size="medium" data-nuevo data-key="nuevo"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>${miRol() === 'operador' ? 'Nuevo operador externo' : 'Nuevo usuario'}</span></button></div></div>` +
      `<div class="nwt-card nws-access-permissions__catalog" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `<div class="ish-filtros"><div class="ish-busca"><div class="nwt-searchbox"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-searchbox__container"><div class="nwt-icon"><i class="naotech-icon-search"></i></div>` +
      `<input class="nwt-searchbox__input" placeholder="Buscar por nombre, correo o rol" type="text" value="${esc(S.q)}" data-buscar data-key="buscar" aria-label="Buscar usuarios"></div></div></div></div></div></div>${UI() ? UI().filtroEstado(S.estado) : ''}</div>${cuerpo}</div></div></div></section>` +
      `<div class="ish-toast${S.toast ? ' on' : ''}" role="status" aria-live="polite">${S.toast ? S.toast : ''}</div>`;
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) { e.focus(); if (e.matches('[data-buscar]')) e.setSelectionRange(e.value.length, e.value.length); } }
    // Lo que el rol no tiene marcado en la matriz se quita (el gestor lo tiene todo).
    const pu = (a) => miRol() === 'gestor' || !window.__ACRED_PERMISO__ || window.__ACRED_PERMISO__('externos', a);
    if (!pu('crear')) cont.querySelectorAll('[data-nuevo]').forEach((e) => e.remove());
    if (!pu('editar')) cont.querySelectorAll('[data-editar]').forEach((e) => e.remove());
    if (!pu('inhabilitar')) cont.querySelectorAll('[data-estado]').forEach((e) => e.remove());
    if (!pu('editar') && !pu('inhabilitar')) cont.querySelectorAll('[data-menu]').forEach((e) => { const w = e.closest('.nwt-icon-button'); (w || e).remove(); });
    if (UI()) UI().ubicarMenu(cont, () => { if (S.menu != null) { S.menu = null; dibujar(); } });
  };
  const avisar = (html) => { S.toast = html; dibujar(); clearTimeout(toastT); toastT = setTimeout(() => { S.toast = ''; dibujar(); }, 5000); };

  // ── Modal de crear / editar (2 pasos) ─────────────────────────────────────
  const vacioF = () => ({ nombre: '', correo: '', desde: hoy(), hasta: sumar(hoy(), 30), perfil: '', eventos: {}, propios: {}, formulario: '', perm: null, error: '' });
  const pasosTotal = () => 2;
  // Errores por campo: el botón «Siguiente» siempre está activo; si falta algo, marca cada campo y dice qué falta.
  const errores = (f, paso) => {
    const e = {};
    if (paso === 1) {
      if (!f.nombre.trim()) e.nombre = 'Escribe el nombre del usuario.';
      if (!f.correo.trim()) e.correo = 'Escribe el correo electrónico.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) e.correo = 'Escribe un correo válido, como nombre@correo.com.';
      if (f.desde && f.hasta && f.hasta < f.desde) e.hasta = 'La fecha de cierre no puede ser anterior a la de inicio.';
      return e;
    }
    if (!f.perfil) { e.perfil = 'Selecciona un rol.'; return e; }
    const al = perfil(f.perfil).alcance, sinPerm = ['gestor', 'operador'].includes(f.perfil) && !celdasMatriz(f).some(([k, a]) => f.perm.filas[k][a]);
    if (sinPerm) e.matriz = 'Marca al menos un permiso.';
    if (al === 'todos') return e;
    const ev = evAct(), evs = ev ? [ev] : [];
    if (!evs.length) { e.ev = 'No hay un evento activo.'; return e; }
    if (al === 'externo') evs.forEach((c) => { if (!f.propios[c]) e['po:' + c] = 'Selecciona su tipo de acreditado.'; });
    if (al === 'externo') { if (!(f.eventos[ev] || []).length) evs.forEach((c) => { if ((S.tipos[c] || []).length) e['tp:' + c] = 'Selecciona al menos un tipo de acreditado.'; }); }
    if (al === 'externo') { if (!formularios().length) e.form = 'Primero crea un formulario de registro.'; else if (!f.formulario) e.form = 'Selecciona el formulario de registro.'; }
    if (al === 'permisos' && !f.perm.valida.length) e.valida = 'Selecciona al menos un permiso que valida.';
    return e;
  };
  const validoPaso = (f, paso) => !Object.keys(errores(f, paso)).length;
  // Mensaje bajo el campo anterior; montar() le pone el borde rojo a ese campo.
  // Aviso general de error con el componente de alerta del SDK (tema negativo).
  const alertaErr = (txt) => `<div class="nwt-alert nwt-alert--visible ish-alerta ish-alerta--form" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div><span class="nwt-alert__label">${esc(txt)}</span></div></div>`;
  const er = (k) => { const m = M && M.ver && errores(M.f, M.paso)[k]; return m ? `<p class="ish-err" role="alert" data-err="${esc(k)}">${esc(m)}</p>` : ''; };
  // Formularios de registro: se crean antes (pantalla pendiente); la demo trae dos de ejemplo.
  // Formularios de registro: los crea «Formularios de registro» (formularios.js); aquí solo se eligen los activos.
  const formularios = () => (window.ACRED_FORMS ? window.ACRED_FORMS.activos() : []);
  const EXT = [['registrar', 'Registrar acreditados'], ['revisar', 'Revisar documentación (si el tipo la pide)'], ['decidir', 'Aprobar o rechazar'], ['mandar', 'Mandar a acreditar'], ['link', 'Crear el link del formulario para registros masivos']];
  const ext0 = () => ({ registrar: true, revisar: true, decidir: true, mandar: true, link: true });
  // «Marcar todo» / «Desmarcar todo»: botón de texto a la derecha del título de la sección (mismo en permisos y validación).
  const btnTodo = (que, todo) => `<button type="button" class="ish-todo" data-marcar-todo="${que}" data-key="${que === 'matriz' ? 'mt' : 'mv'}">${todo ? 'Desmarcar todo' : 'Marcar todo'}</button>`;
  const CHEV = (abierto) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  const celdasMatriz = (f) => GRUPOS.flatMap((g) => g.filas.flatMap((fi) => disponibles(f.perfil, fi).map((a) => [fi.k, a])));
  const matrizTodo = (f) => { const t = celdasMatriz(f); return t.length > 0 && t.every(([k, a]) => f.perm.filas[k][a]); };
  const matrizHTML = (f) => {
    const p = f.perm;
    const fila = (fi) => { const ok = disponibles(f.perfil, fi); if (!ok.length) return ''; return `<tr class="ish-m-fila"><th scope="row">${esc(fi.t)}</th>${ACCIONES.map(([a, t]) => `<td>${ok.includes(a) ? chk(p.filas[fi.k][a], `${fi.t}: ${t}`, `data-celda="${fi.k}:${a}" data-key="c-${fi.k}-${a}"`) : '<span class="ish-m-no" aria-hidden="true">—</span>'}</td>`).join('')}</tr>`; };
    const grupos = GRUPOS.map((g) => { const col = !!(M.col && M.col[g.g]); return `<tr class="ish-m-grupo"><th scope="row" colspan="5"><div class="ish-m-g"><button type="button" class="ish-m-colapsa${col ? '' : ' abierta'}" data-colapsa="${g.g}" data-key="col-${g.g}" aria-expanded="${!col}" aria-label="${col ? 'Expandir' : 'Contraer'} ${esc(g.t)}">${CHEV(!col)}</button><span>${esc(g.t)}</span></div></th></tr>` + (col ? '' : g.filas.map(fila).join('')); }).join('');
    return `<table class="ish-matriz"><colgroup><col class="ish-col-n">${ACCIONES.map(() => '<col class="ish-col-a">').join('')}</colgroup><thead><tr><th scope="col">Permisos</th>${ACCIONES.map(([, t]) => `<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${grupos}</tbody></table>`;
  };
  const validacionHTML = (f, requerido) => {
    const p = f.perm, todos = S.permisos.length > 0 && S.permisos.every((x) => p.valida.includes(x.id));
    const items = S.permisos.map((x) => `<div class="ish-vp">${chk(p.valida.includes(x.id), x.name, `data-valida="${x.id}" data-key="v-${x.id}"`, { visible: true })}${x.tags.length ? `<small>${x.tags.map(esc).join(' · ')}</small>` : ''}</div>`).join('');
    return `<div class="ish-bloque__top"><h4>${requerido ? 'Qué valida<span class="nwt-input-box__required">*</span>' : 'Qué pueden validar los validadores que cree'}</h4>${S.permisos.length ? btnTodo('valida', todos) : ''}</div>` +
      `<div class="ish-vp-lista">${items || '<p class="ish-vacio">No hay permisos en el catálogo.</p>'}</div>${requerido ? er('valida') : ''}`;
  };
  // Multiselector compartido (multiselect.js). Aquí solo se describe cada campo.
  const MS = window.ACRED_MS;
  const msHTML = (id, etiqueta, req, ph, opciones, sel, conTodos) => MS.html(M, { id, etiqueta, req, ph, opciones, sel, conTodos, busca: id === 'ev' ? 'Buscar evento' : 'Buscar tipo' });
  const opcionesMs = (id) => (id === 'ev' ? S.eventos.map((e) => ({ v: e.code, t: e.nombre })) : (S.tipos[id.slice(3)] || []).map((r) => ({ v: r.code, t: r.nombre })));
  const msApi = {
    raiz: () => modalEl, redibujar: (foco) => montar(foco), vivo: () => !!M, opciones: opcionesMs,
    alternar: (id, v) => msToggle(id, v),
    seleccionar: (id, v) => { const f = M.f; if (id === 'ev') { if (!f.eventos[v]) f.eventos[v] = []; } else { const a = f.eventos[id.slice(3)]; if (a && !a.includes(v)) a.push(v); } },
    quitar: (id, v) => { if (id === 'ev') delete M.f.eventos[v]; else alterna(M.f.eventos[id.slice(3)], v); }
  };
  const msToggle = (id, v, forzar) => {
    const f = M.f;
    if (id === 'ev') {
      if (v === '__todos') { const todos = S.eventos.every((e) => f.eventos[e.code]); S.eventos.forEach((e) => { if (todos) delete f.eventos[e.code]; else if (!f.eventos[e.code]) f.eventos[e.code] = []; }); return; }
      if (f.eventos[v] && forzar !== 'on') delete f.eventos[v]; else if (!f.eventos[v]) f.eventos[v] = [];
      return;
    }
    const code = id.slice(3), arr = f.eventos[code], t = (S.tipos[code] || []).map((r) => r.code);
    if (!arr) return;
    if (v === '__todos') { f.eventos[code] = arr.length === t.length ? [] : t.slice(); return; }
    alterna(arr, v);
  };
  const paso1 = (f) =>
    `<div class="naotech-grid naotech-grid--4"><div class="naotech-col--2">${campoT('Nombre del usuario', 'text', f.nombre, 'data-f="nombre" placeholder="Ej: Ana Gómez" maxlength="80" autocomplete="off"', true)}${er('nombre')}</div>` +
    `<div class="naotech-col--2">${campoT('Correo electrónico', 'email', f.correo, 'data-f="correo" placeholder="nombre@correo.com" maxlength="120" autocomplete="off"', true, 'Aquí llegan las credenciales de acceso.')}${er('correo')}</div>` +
    `<div class="naotech-col--2">${campoT('Fecha de inicio', 'date', f.desde, 'data-f="desde"', false, 'Opcional.')}</div>` +
    `<div class="naotech-col--2">${campoT('Fecha de cierre', 'date', f.hasta, `data-f="hasta" min="${esc(f.desde)}"`, false, 'Opcional. Pasada esta fecha el acceso se vence; sin fecha, no vence.')}${er('hasta')}</div></div>`;
  // Operador externo: «su» tipo de acreditado por evento (lo que aparece en su acreditación); aparte, los tipos que puede registrar.
  const propioSel = (code, tipos, valor) => `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label" for="ish-propio-${esc(code)}">Su tipo de acreditado<span class="nwt-input-box__required">*</span></label>` +
    `<div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select id="ish-propio-${esc(code)}" class="ish-sel__in" data-propio="${esc(code)}" data-key="po-${esc(code)}"><option value=""${valor ? '' : ' selected'} disabled>Selecciona su tipo</option>${tipos.map((r) => `<option value="${esc(r.code)}"${valor === r.code ? ' selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select>` +
    `<div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>`;
  const paso2 = (f) => {
    const pf = f.perfil ? perfil(f.perfil) : null;
    const edGestor = M.modo === 'editar' && f.perfil === 'gestor';
    const opciones = (edGestor || (M.modo === 'editar' && !perfilesNuevos().some((x) => x.id === f.perfil)) ? PERFILES : perfilesNuevos()).map((x) => `<option value="${x.id}"${f.perfil === x.id ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
    const desplegable = `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label" for="ish-perfil">Rol<span class="nwt-input-box__required">*</span></label>` +
      `<div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select id="ish-perfil" class="ish-sel__in" data-perfil-sel data-key="pf" ${edGestor ? 'disabled' : ''}><option value=""${f.perfil ? '' : ' selected'} disabled>Selecciona un rol</option>${opciones}</select>` +
      `<div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>`;
    const formBloque = () => {
      if (!pf || pf.alcance !== 'externo') return '';
      const fl = formularios();
      if (!fl.length) return `<div class="nwt-alert nwt-alert--visible ish-alerta" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div><span class="nwt-alert__label">Aún no hay formularios de registro. Crea uno antes de seguir.</span></div></div>`;
      return `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label" for="ish-form">Formulario de registro<span class="nwt-input-box__required">*</span></label>` +
        `<div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select id="ish-form" class="ish-sel__in" data-formulario data-key="fm"><option value=""${f.formulario ? '' : ' selected'} disabled>Selecciona el formulario</option>${fl.map((x) => `<option value="${esc(x.id)}"${f.formulario === x.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>` +
        `<div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>${er('form')}`;
    };
    let alcance = '';
    if (pf && pf.alcance !== 'todos') {
      const conTipos = pf.alcance === 'externo', selEv = evAct() ? [evAct()] : [];
      const sinTipos = selEv.filter((code) => !(S.tipos[code] || []).length).map((code) => `«${esc(nombreEvento(code))}»`);
      const lista = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0]);
      const alerta = sinTipos.length ? `<div class="nwt-alert nwt-alert--visible ish-alerta" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div>` +
        `<span class="nwt-alert__label">${sinTipos.length > 1 ? 'Los eventos' : 'El evento'} ${lista(sinTipos)} aún no ${sinTipos.length > 1 ? 'tienen' : 'tiene'} tipos de acreditado configurados.</span></div></div>` : '';
      const tiposMs = selEv.filter((code) => (S.tipos[code] || []).length).map((code) => {
        const t = S.tipos[code] || [];
        return (pf.alcance === 'externo' ? propioSel(code, t, f.propios[code]) + er('po:' + code) : '') + msHTML('tp:' + code, (pf.alcance === 'externo' ? 'Tipos que puede registrar' : 'Tipos de acreditado'), conTipos, conTipos ? 'Selecciona uno o varios tipos' : 'Todos los tipos (opcional)', t.map((r) => ({ v: r.code, t: r.nombre })), f.eventos[code], true) + er('tp:' + code);
      }).join('');
      alcance = `<div class="ish-bloque"><small class="ish-ayuda">Queda vinculado al evento ${selEv.map((c) => esc(nombreEvento(c))).join(', ')}.</small></div>` + ((tiposMs || alerta) ? `<div class="ish-bloque ish-ms-grupo">${alerta}${tiposMs}</div>` : '') + (pf.alcance === 'externo' && selEv.length ? `<div class="ish-bloque">${formBloque()}</div>` : '');
    }
    // Operador externo: los permisos (registrar, revisar, aprobar/rechazar, mandar a acreditar, link masivo) vienen por defecto y no se muestran.
    const extHTML = () => '';
    const permisos = pf ? (pf.id === 'externo' ? extHTML() : pf.id === 'validador'
      ? `<div class="ish-bloque">${validacionHTML(f, true)}</div>`
      : `<div class="ish-bloque"><div class="ish-bloque__top"><h4>Permisos</h4>${btnTodo('matriz', matrizTodo(f))}</div>${matrizHTML(f)}${er('matriz')}</div>` + (f.perm.filas.validadores && f.perm.filas.validadores.crear ? `<div class="ish-bloque">${validacionHTML(f, false)}</div>` : '')) : '';
    return `<div class="ish-bloque">${desplegable}${er('perfil')}</div>${alcance}${permisos}`;
  };
  const modalHTML = () => {
    const f = M.f, total = pasosTotal(f), edita = M.modo === 'editar', paso = M.paso, ultimo = paso === total;
    const titulos = ['Datos del usuario', 'Rol y permisos'];
    const subs = ['Recibirá un correo con sus credenciales para entrar a la plataforma.', 'Elige su rol y lo que puede hacer en este evento.'];
    const cuerpo = paso === 1 ? paso1(f) : paso2(f);
    const atras = paso > 1 ? `<button type="button" class="ish-atras" data-atras aria-label="Volver al paso anterior" data-key="atras"><div class="nwt-icon"><i class="naotech-icon-chevron-left"></i></div></button>` : '';
    return `<div class="nwt-modal nwt-modal--visible nws-accreditations-module ish-modal ish-modal--ancho" role="dialog" aria-modal="true" aria-label="${edita ? 'Editar usuario' : 'Nuevo usuario'}: ${titulos[paso - 1]}">` +
      `<div class="nwt-modal__content"><div class="nwt-modal__header"><div class="nwt-modal__header__description"><span class="ish-paso">${atras}${paso} de ${total}</span><span class="ish-modal__t">${titulos[paso - 1]}</span><span class="ish-modal__sub">${subs[paso - 1]}</span></div>` +
      `<span class="nwt-modal__close" role="button" tabindex="0" aria-label="Cerrar" data-cerrar><div class="nwt-icon"><i class="naotech-icon-close"></i></div></span></div>` +
      `<div class="nwt-modal__component"><div class="ish-modal__body">${cuerpo}${f.error ? alertaErr(f.error) : ''}</div>` +
      `<footer class="ish-modal__footer">${boton('Cancelar', 'quiet', 'data-cerrar', 'large')}${boton(ultimo ? (edita ? 'Guardar cambios' : 'Crear usuario') : 'Siguiente', 'loud', 'data-siguiente', 'large')}</footer></div></div><div class="nwt-modal__backdrop" data-cerrar></div></div>`;
  };
  // La lista del multiselector sale SOBRE el contenido (position:fixed junto a su campo): no desplaza nada, se abre hacia arriba si
  // abajo no cabe y su alto se ajusta para que el scroll interno llegue hasta la última opción. El contenido del modal tiene
  // transform, así que «fixed» se mide contra él; se corrige con lo medido.
  window.addEventListener('resize', () => MS.ubicar(modalEl, M));
  // Al corregir un campo se quita su aviso sin redibujar (no pierde el foco).
  const refrescaErr = () => { if (!M || !M.ver || !modalEl) return; const e = errores(M.f, M.paso); modalEl.querySelectorAll('[data-err]').forEach((p) => { if (!e[p.dataset.err]) { const pe = p.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.remove('nwt-input-box--error'); } p.remove(); } }); };
  const montar = (foco) => {
    const sc = modalEl && modalEl.querySelector('.ish-modal__body') ? modalEl.querySelector('.ish-modal__body').scrollTop : 0;
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div'); modalEl.id = 'ish-modal-usuario'; modalEl.innerHTML = modalHTML(); modalEl.dataset.anim = (M && M.anim) || ''; if (M) { M.anim = ''; M.cierre = null; } document.body.append(modalEl);
    modalEl.querySelectorAll('[data-err]').forEach((p) => { const pe = p.previousElementSibling; if (pe) { pe.classList.add('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.add('nwt-input-box--error'); } });
    const b = modalEl.querySelector('.ish-modal__body'); if (b) b.scrollTop = sc;
    const e = foco && [...modalEl.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco);
    const el = e || modalEl.querySelector('input,select:not([disabled]),button:not([disabled])'); el.focus(); if (el.matches && el.matches('[data-ms-q]')) el.setSelectionRange(el.value.length, el.value.length);
    MS.ubicar(modalEl, M); if (b) b.addEventListener('scroll', () => MS.ubicar(modalEl, M));
  };
  const abrirForm = (modo, u) => {
    opener = document.activeElement; S.menu = null;
    const f = vacioF();
    if (u) Object.assign(f, { nombre: u.nombre, correo: u.correo, desde: u.desde, hasta: u.hasta, perfil: u.perfil, eventos: u.eventos ? JSON.parse(JSON.stringify(u.eventos)) : {}, propios: JSON.parse(JSON.stringify(u.propios || {})), formulario: u.formulario || '', perm: JSON.parse(JSON.stringify(u.perm)) });
    if (!u && perfilesNuevos().length === 1) { f.perfil = perfilesNuevos()[0].id; f.perm = preset(f.perfil, S.permisos); autoEvento(f); }
    autoEvento(f);
    if (f.perm) GRUPOS.forEach((g) => g.filas.forEach((x) => { if (!f.perm.filas[x.k]) { f.perm.filas[x.k] = {}; if (f.perfil === 'gestor') marca(f.perm.filas, x.k, TODAS); } }));
    M = { modo, id: u && u.id, paso: 1, f }; dibujar(); montar('nombre');
  };
  const cerrarModal = (sinFoco) => { if (modalEl) { modalEl.remove(); modalEl = null; } M = null; if (!sinFoco && opener && document.contains(opener)) opener.focus(); };
  // Operador externo y Validador no eligen eventos: quedan vinculados al evento donde se gestionan (el activo; si no hay, el de la demo).
  const eventoVinculo = () => { let c = null; try { c = (JSON.parse(localStorage.getItem('naowee.acreditaciones.active-event') || 'null') || {}).code; } catch (e) {} return S.eventos.some((x) => x.code === c) ? c : (S.eventos[0] || {}).code; };
  const autoEvento = (f) => { if (f.perfil && perfil(f.perfil).alcance !== 'todos') { const c = eventoVinculo(); if (c && f.eventos[c] === undefined) f.eventos[c] = []; } };
  const elegirPerfil = (id) => {
    const f = M.f; if (f.perfil === id) return;
    f.perfil = id; f.perm = preset(id, S.permisos); f.eventos = {}; f.propios = {}; f.formulario = ''; autoEvento(f); f.error = ''; M.ms = null;
  };
  const siguiente = () => {
    const f = M.f; if (!validoPaso(f, M.paso)) { M.ver = true; const k = Object.keys(errores(f, M.paso))[0]; M.ms = null; montar(k === 'nombre' ? undefined : undefined); const p = modalEl.querySelector('[data-err]'); if (p) { const c = p.previousElementSibling && p.previousElementSibling.querySelector('input,select,[tabindex="0"]'); if (c) c.focus(); p.scrollIntoView({ block: 'nearest' }); } return; }
    if (M.paso === 1) {
      const dup = lista().some((u) => u.id !== M.id && sinTildes(u.correo.trim()) === sinTildes(f.correo.trim()));
      if (dup) { f.error = 'Ya existe un usuario con ese correo.'; return montar('correo'); }
    }
    f.error = '';
    if (M.paso < pasosTotal(f)) { M.paso++; M.ver = false; M.ms = null; return montar('pf'); }
    guardarUsuario();
  };
  const guardarUsuario = () => {
    const f = M.f, d = { nombre: f.nombre.trim(), correo: f.correo.trim(), desde: f.desde, hasta: f.hasta, perfil: f.perfil, eventos: perfil(f.perfil).alcance === 'todos' ? null : f.eventos, formulario: perfil(f.perfil).alcance === 'externo' ? f.formulario : '', propios: perfil(f.perfil).alcance === 'externo' ? Object.fromEntries(Object.entries(f.propios).filter(([c]) => f.eventos[c])) : {}, perm: f.perm };
    const edita = M.modo === 'editar'; let u;
    if (edita) { u = lista().find((x) => x.id === M.id); const vencido = u.hasta && u.hasta < hoy(); Object.assign(u, d); if (vencido && (!u.hasta || u.hasta >= hoy())) u.activo = true; }
    else { u = Object.assign({ id: Math.max(0, ...lista().map((x) => x.id)) + 1, activo: true, creado: hoy() }, d); lista().push(u); }
    guardar(); window.dispatchEvent(new CustomEvent('acred-permisos')); cerrarModal(true); dibujar();
    if (edita) { avisar(`<b>Cambios guardados</b><span>${esc(u.nombre)} ya tiene sus datos y permisos actualizados.</span>`); const b = cont.querySelector(`[data-menu="${u.id}"]`); if (b) b.focus(); }
    else { opener = null; mensaje('ok', 'Usuario creado con éxito', `${esc(u.nombre)} ya puede entrar como ${esc(perfil(u.perfil).n)}. Las credenciales de acceso fueron enviadas a ${esc(u.correo)}.`, ['El usuario debe ingresar con los datos recibidos para activar su cuenta.', `Su acceso vence el ${fmt(u.hasta)}.`]); }
  };

  // ── Confirmaciones (mismo estilo que el Figma: icono, lista, acciones) ─────
  const mensaje = (tipo, titulo, texto, items, accion) => {
    if (modalEl) modalEl.remove();
    const ok = tipo === 'ok';
    modalEl = document.createElement('div'); modalEl.id = 'ish-modal-usuario';
    modalEl.innerHTML = `<div class="nwt-modal nwt-modal--visible ish-modal" role="alertdialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="nwt-modal__content ish-conf"><div class="ish-conf__ico ${ok ? 'ok' : 'warn'}" aria-hidden="true">${ok ? '✓' : '!'}</div>` +
      `<h2 class="nwt-subtitle-font-bold">${esc(titulo)}</h2>${texto ? `<p class="ish-conf__t">${texto}</p>` : ''}<ul class="ish-conf__l">${(items || []).map((t) => `<li>${t}</li>`).join('')}</ul>` +
      `<div class="ish-conf__a">${ok ? boton('Aceptar', 'loud', 'data-cerrar data-key="aceptar"') : boton('Cancelar', 'quiet', 'data-cerrar') + boton(accion, 'loud', 'data-confirmar data-key="confirmar"')}</div></div><div class="nwt-modal__backdrop" data-cerrar></div></div>`;
    document.body.append(modalEl); M = Object.assign(M || {}, { conf: true, tipo }); (modalEl.querySelector('[data-key="aceptar"],[data-key="confirmar"]') || modalEl).focus();
  };
  const cambiarEstado = (u, activar) => {
    u.activo = activar; if (activar && u.hasta && u.hasta < hoy()) u.hasta = sumar(hoy(), 30); guardar(); cerrarModal(); dibujar();
    avisar(activar ? `<b>Usuario activo</b><span>Activaste a ${esc(u.nombre)}; ya tiene acceso de nuevo.</span>` : `<b>Usuario inactivo</b><span>Inactivaste correctamente a ${esc(u.nombre)}, y ya no tendrá acceso a la plataforma.</span>`);
  };
  const reporte = () => {
    const filas = [['Nombre', 'Correo', 'Rol', 'Asignación', 'Inicio', 'Cierre', 'Estado']].concat(visibles().map((u) => [u.nombre, u.correo, perfil(u.perfil).n, u.eventos ? (detalleTxt(u) || '—') : 'Todos los eventos', u.desde, u.hasta, estado(u)]));
    const csv = '﻿' + filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'usuarios-acreditaciones.csv'; document.body.append(a); a.click(); a.remove();
    avisar('<b>Reporte descargado</b><span>usuarios-acreditaciones.csv</span>');
  };

  // ── Eventos ────────────────────────────────────────────────────────────────
  const alterna = (arr, v) => { const i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); };
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if ((b = q('[data-pag]'))) { S.pag += b.dataset.pag === 'next' ? 1 : -1; return dibujar(); }
    if (q('[data-nuevo]')) return abrirForm('crear');
    if (q('[data-reporte]')) return reporte();
    if ((b = q('[data-menu]'))) { const id = +b.dataset.menu, cerrando = S.menu === id; S.menu = cerrando ? null : id; dibujar(); if (cerrando && e.detail) { const a = document.activeElement; if (a && a.matches && a.matches('[data-menu]')) a.blur(); } return; }
    if ((b = q('[data-editar]'))) return abrirForm('editar', lista().find((u) => u.id === +b.dataset.editar));
    if ((b = q('[data-estado]'))) {
      const u = lista().find((x) => x.id === +b.dataset.estado); S.menu = null; opener = cont.querySelector(`[data-menu="${u.id}"]`); dibujar();
      if (!u.activo) return cambiarEstado(u, true);
      M = { conf: true, id: u.id }; return mensaje('warn', 'Inactivar usuario', '', ['Al inactivar el usuario, perderá el acceso a la plataforma.', 'Podrás reactivarlo en cualquier momento editando su fecha de cierre o desde el menú.'], 'Inactivar usuario');
    }
    if (S.menu != null && !q('.ish-menu')) { S.menu = null; dibujar(); }
  };
  const onModal = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if (q('[data-cerrar]')) return cerrarModal();
    if (q('[data-confirmar]')) { const u = lista().find((x) => x.id === M.id); return u && cambiarEstado(u, false); }
    if (!M || M.conf) return;
    const f = M.f;
    if (MS.click(e, M, msApi)) return;
    if (M.ms && !q('.ish-ms')) { M.ms = null; M.msq = ''; montar(); }
    if (q('[data-siguiente]')) return siguiente();
    if (q('[data-atras]')) { M.paso--; M.ver = false; M.ms = null; return montar(); }
    if ((b = q('[data-colapsa]'))) { M.col = M.col || {}; M.col[b.dataset.colapsa] = !M.col[b.dataset.colapsa]; M.anim = M.col[b.dataset.colapsa] ? 'cerrar' : 'abrir'; return montar('col-' + b.dataset.colapsa); }
    if ((b = q('[data-tipo]'))) { const [c, v] = b.dataset.tipo.split('|'); alterna(f.eventos[c], v); return montar('t-' + v); }
    if ((b = q('[data-marcar-todo]'))) {
      if (b.dataset.marcarTodo.indexOf('tipos:') === 0) { const c = b.dataset.marcarTodo.slice(6), t = (S.tipos[c] || []).map((x) => x.code); f.eventos[c] = t.every((x) => f.eventos[c].includes(x)) ? [] : t; return montar('mtp'); }
      if (b.dataset.marcarTodo === 'matriz') { const c = celdasMatriz(f), todo = c.every(([k, a]) => f.perm.filas[k][a]); c.forEach(([k, a]) => { f.perm.filas[k][a] = !todo; }); return montar('mt'); }
      const todo = S.permisos.every((x) => f.perm.valida.includes(x.id)); f.perm.valida = todo ? [] : S.permisos.map((x) => x.id); return montar('mv');
    }
    if ((b = q('[data-ext]'))) { f.perm.ext[b.dataset.ext] = !f.perm.ext[b.dataset.ext]; return montar('x-' + b.dataset.ext); }
    if ((b = q('[data-celda]'))) { const [k, a] = b.dataset.celda.split(':'); f.perm.filas[k][a] = !f.perm.filas[k][a]; return montar('c-' + k + '-' + a); }
    if ((b = q('[data-valida]'))) { alterna(f.perm.valida, +b.dataset.valida); return montar('v-' + b.dataset.valida); }
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.matches('[data-buscar]')) { S.q = t.value; S.pag = 1; return dibujar(); }
    if (M && !M.conf && t.matches && t.matches('[data-formulario]')) { M.f.formulario = t.value; refrescaErr(); return; }
    if (M && !M.conf && t.matches && t.matches('[data-propio]')) { M.f.propios[t.dataset.propio] = t.value; refrescaErr(); return; }
    if (M && !M.conf && t.matches && t.matches('[data-perfil-sel]')) { elegirPerfil(t.value); return montar('pf'); }
    if (M && !M.conf && MS.entrada(e, M, msApi)) return;
    if (!M || M.conf || !t.dataset.f) return;
    M.f[t.dataset.f] = t.value; M.f.error = '';
    if (t.dataset.f === 'desde') { const h = modalEl.querySelector('[data-f="hasta"]'); if (h) { h.min = t.value; if (M.f.hasta && M.f.hasta < t.value) { M.f.hasta = t.value; h.value = t.value; } } }
    refrescaErr();
  };
  const onKey = (e) => {
    if (M && !M.conf && MS.tecla(e, M, msApi)) return;
    if (e.key === 'Escape') { e.stopPropagation(); return cerrarModal(); }
    const t = e.target;
    if (t.matches && t.matches('[role=checkbox],[role=switch],[role=option],[role=combobox],[data-cerrar][role=button]') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return t.click(); }
    if (e.key === 'Enter' && M && !M.conf && t.matches && t.matches('[data-f]')) { e.preventDefault(); return siguiente(); }
    if (e.key === 'Tab' && modalEl) {
      const f = [...modalEl.querySelectorAll('button:not([disabled]),input:not([tabindex="-1"]),[tabindex="0"]')].filter((x) => x.offsetParent);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  document.addEventListener('click', (e) => { if (modalEl && modalEl.contains(e.target)) onModal(e); });
  document.addEventListener('input', (e) => { if (modalEl && modalEl.contains(e.target)) onInput(e); });
  document.addEventListener('keydown', (e) => {
    if (modalEl && (modalEl.contains(e.target) || e.key === 'Escape')) onKey(e);
    else if (e.key === 'Escape' && S.menu != null && cont && cont.dataset.id === 'usuarios' && cont.contains(e.target)) { S.menu = null; dibujar(); }
    else if (cont && cont.dataset.id === 'usuarios' && cont.contains(e.target) && e.target.matches && e.target.matches('[role=checkbox],[role=switch]') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.target.click(); }
  });

  // Tooltip para textos recortados con «…»: solo aparece si el texto de verdad no cabe (`.ish-trunc[data-tip]`).
  let tip = null;
  const verTip = (e) => {
    const t = e.target.closest && e.target.closest('.ish-trunc[data-tip]');
    if (!t || t.scrollWidth <= t.clientWidth + 1) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'ish-tooltip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
    tip.textContent = t.dataset.tip; const r = t.getBoundingClientRect(); tip.style.maxWidth = '340px'; tip.classList.add('on');
    const h = tip.offsetHeight, w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px'; tip.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
  };
  const ocultaTip = () => { if (tip) tip.classList.remove('on'); };
  document.addEventListener('mouseover', verTip); document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.ish-trunc[data-tip]')) ocultaTip(); });
  window.addEventListener('scroll', ocultaTip, true);

  // ── Carga y montaje ────────────────────────────────────────────────────────
  const cargar = async () => {
    S.cargando = true; S.error = '';
    try {
  // Tipos creados desde «Tipos de acreditados» con otro event_id quedaban fuera de lo que lee la demo (event_id=7): se reparan.
  const repara = () => { const e = window.__ACRED_ESTADO__; if (!e || !e.roles) return; let n = false; e.roles.forEach((r) => { if (/^tipo-/.test(r.code || '') && Number(r.event_id) !== 7) { r.event_id = 7; n = true; } }); if (n) try { window.__ACRED_PERSISTIR__ && window.__ACRED_PERSISTIR__(); } catch (x) {} };
      repara();
      const [cat, rs, ps] = await Promise.all([get('/events/catalog?limit=100&page=1'), get('/roles?limit=100&event_id=7&page=1'), get('/permissions?limit=100&page=1')]);
      S.eventos = (cat.data || []).map((e) => ({ code: e.event_code, nombre: e.name }));
      // El gateway simulado devuelve máximo 10 filas aunque se pida limit=100: se lee el estado completo (si no, los tipos y permisos nuevos desaparecen).
      const est = window.__ACRED_ESTADO__, rolesAll = est && est.roles ? est.roles.filter((r) => Number(r.event_id) === 7) : (rs.data || []), permsAll = est && est.accessPermissions ? est.accessPermissions : (ps.data || []);
      S.permisos = permsAll.filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.name, tags: Array.isArray(p.tags) ? p.tags : (/aliment/i.test(p.name) ? ['Desayuno', 'Almuerzo', 'Cena', 'Merienda'] : []) }));
      // En la demo solo el primer evento (el de los Juegos) trae tipos de acreditado configurados.
      S.tipos = {}; if (S.eventos[0]) { const l = rolesAll.filter((r) => r.is_active !== false).map((r) => ({ code: r.code, nombre: String(r.role_name || '').replace(/\s*\([^)]*\)\s*$/, '') })); S.tipos[S.eventos[0].code] = [...l.filter((x) => /^tipo-/.test(x.code)), ...l.filter((x) => !/^tipo-/.test(x.code))]; } // en la demo solo el primer evento trae tipos; los creados por el gestor van primero
      leer(); sembrar();
    } catch (er) { S.error = 'No se pudieron leer los eventos y permisos. Vuelve a intentarlo.'; }
    S.cargando = false; dibujar();
  };
  window.addEventListener('acred-rol', () => { S.pag = 1; S.menu = null; if (cont && cont.dataset.id === 'usuarios') dibujar(); });
  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.usuarios = {
    render(el) {
      cont = el; S.aviso = ''; S.menu = null; S.toast = '';
      if (!cont.__ligadoU) { const mia = (f) => (e) => { if (cont && cont.dataset.id === 'usuarios') f(e); }; cont.addEventListener('click', mia(onClick)); cont.addEventListener('input', mia(onInput)); cont.addEventListener('change', mia((e) => { if (e.target.matches('[data-fest]')) { S.estado = e.target.value; S.pag = 1; dibujar(); } })); cont.__ligadoU = true; }
      dibujar(); cargar();
    }
  };
})();
