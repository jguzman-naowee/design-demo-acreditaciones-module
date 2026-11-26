// Pantalla propia «Tipos de acreditados» (Parametrización, Gestor). Reemplaza la del micro.
// Hay tres «padres» (decisión de Danna, 26-nov):
//  · Personal de la delegación: quienes se inscriben desde otros módulos (deportistas, docente entrenador, docente asistente, auxiliar
//    de discapacidad…). Este módulo los TRAE ya como tipos: no se crean aquí; se EDITAN para ponerles permisos y, ya editados, se inactivan.
//  · Personal del evento: externos que se registran el día del evento o los registra un operador externo (médicos, voluntarios,
//    coordinador de voluntarios, prensa…). Sus tipos se CREAN aquí.
//  · Personal Naowee: coordinador Naowee, digitador Naowee… También se crean aquí.
// Lee/escribe el estado del simulador (`window.__ACRED_ESTADO__`.roles); 
// Validación (reunión del 26-nov): los topes de uso se fijan AQUÍ, por permiso y por tipo (ACRED_VAL, de permisos.js), no en el permiso.
(() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const UI = () => window.ACRED_DATOS, MS = window.ACRED_MS, V = window.ACRED_VAL;
  const GRUPOS = { delegacion: 'Personal de la delegación', evento: 'Personal del evento', naowee: 'Personal Naowee' };
  // Padres en los que se puede CREAR (la delegación llega de otros módulos) y la categoría de plataforma que guardan.
  const CREABLES = [['evento', 'Personal del evento', 'MISSION_STAFF'], ['naowee', 'Personal Naowee', 'NAOWEE_STAFF']];
    const get = (path) => new Promise((ok, ko) => { const x = new XMLHttpRequest(); x.open('GET', '/public-gateway/v1/accreditation' + path); x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { ko(e); } }; x.onerror = ko; x.send(); });
  const guardar = () => { try { window.__ACRED_PERSISTIR__ && window.__ACRED_PERSISTIR__(); } catch (e) {} };
  const slug = (t) => (sinTildes(t).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 60) || 'TIPO');
  const limpia = (t) => String(t || '').replace(/\s*\([^)]*\)\s*$/, '');

  const S = { q: '', estado: 'todos', pag: 1, est: null, cat: [], menu: null, modal: null, aviso: '' };
  let cont = null, modalEl = null, opener = null;
  const vacio = () => ({ cat: '', grupo: 'evento', nombre: '', permisos: [], val: {}, etiq: {}, error: '', ver: false });
  // Tipos creados con otro event_id quedaban fuera de lo que lee la demo (event_id=7): se reparan.
  const repara = () => { const e = window.__ACRED_ESTADO__; if (!e || !e.roles) return; let n = false; e.roles.forEach((r) => { if (/^tipo-/.test(r.code || '') && Number(r.event_id) !== 7) { r.event_id = 7; n = true; } }); if (n) guardar(); };
  const listo = () => (UI() ? UI().listo() : Promise.resolve(window.__ACRED_ESTADO__ || null));
  // El gateway de la demo lee los tipos con event_id=7 (Usuarios también): los creados aquí usan el mismo, o no se verían.
  const eventoId = () => 7;
  const roles = () => (S.est ? S.est.roles.filter((r) => Number(r.event_id) === eventoId()) : []);
  const grupoDe = (r) => (['ATHLETE', 'SUPPORT_PERSONNEL'].includes(r.platform_role) ? 'delegacion' : r.platform_role === 'NAOWEE_STAFF' ? 'naowee' : r.platform_role === 'MISSION_STAFF' ? 'evento' : /delegad/i.test(r.role_name || '') ? 'delegacion' : 'evento');
  const nombreDe = (r) => limpia(r.role_name);
  // Un tipo de la delegación nace «por configurar»: sin permisos y sin activar. Al editarlo con permisos pasa a activo.
  const configurado = (r) => (r.permissions || []).length > 0;
  const porConfigurar = (r) => grupoDe(r) === 'delegacion' && !configurado(r);
  // Trae a los tipos de la delegación que llegan de inscripción (los del catálogo de personal de apoyo que aún no tienen tipo).
  const precarga = () => {
    if (!S.est) return;
    const ap = S.cat.find((c) => c.code === 'SUPPORT_PERSONNEL'); if (!ap) return;
    let n = false;
    (ap.functions || []).filter((f) => !f.configured_type).forEach((f) => {
      if (roles().some((r) => sinTildes(nombreDe(r)) === sinTildes(f.name) || r.platform_subrole === f.code)) return;
      S.est.roles.push({ code: `tipo-d${S.est.roles.length + 1}-0000-4000-8000-000000000000`, id: 200 + S.est.roles.length, role_name: f.name, role_code: f.code, platform_role: 'SUPPORT_PERSONNEL', platform_subrole: f.code, event_id: eventoId(), is_active: false, access_deadline: null, permissions: [] });
      n = true;
    });
    // La categoría es obligatoria: los tipos de ejemplo salen con una por padre para que el catálogo no quede vacío.
    const C = window.ACRED_CATS, por = { delegacion: 'COC', evento: 'COJNJ', naowee: 'MINDEP' };
    if (C) roles().forEach((r) => { const s = por[grupoDe(r)]; if (!r.acred_categoria && s && C.porSiglas(s)) { r.acred_categoria = s; n = true; } });
    if (n) guardar();
  };
  const opcionesPm = () => (S.est ? S.est.accessPermissions.filter((p) => p.is_active !== false).map((p) => ({ v: String(p.id), t: p.name })) : []);

  // ── Tabla ──────────────────────────────────────────────────────────────────
  const filtrados = () => {
    const q = sinTildes(S.q.trim());
    return roles().filter((r) => (S.estado === 'todos' || (S.estado === 'activo') === (r.is_active !== false)) && (!q || sinTildes([nombreDe(r), GRUPOS[grupoDe(r)]].join(' ')).includes(q)));
  };
  // Categoría (organización) del tipo: franja de color con sus siglas, como en la acreditación.
  const catPill = (s) => { const c = s && window.ACRED_CATS && window.ACRED_CATS.porSiglas(s); return c ? `<span class="ish-catp" style="background:${esc(c.color)}" title="${esc(c.nombre)}">${esc(c.siglas)}</span>` : '—'; };
  const nVal = (r) => (r.permissions || []).filter((p) => p.validation && p.validation.activa).length;
  const filaHTML = (r) => {
    const act = r.is_active !== false, ab = S.menu === r.code, ICO = UI().ICO, pc = porConfigurar(r);
    const badge = pc ? ['warning', 'Por configurar'] : act ? ['positive', 'Activo'] : ['neutral', 'Inactivo'];
    return `<tr class="nwt-datatable__record"><td class="nwt-datatable__cell nwt-width-xs-25"><span class="nwt-text-font-medium">${esc(nombreDe(r))}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><span>${esc(GRUPOS[grupoDe(r)])}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15">${catPill(r.acred_categoria)}</td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><div class="ish-cel"><span>${(r.permissions || []).length}</span>${nVal(r) ? `<small class="ish-sub">${nVal(r)} con validación</small>` : ''}</div></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15 ish-c"><span class="nwt-badge nwt-badge--vignette" role="status" nwt-theme="${badge[0]}" nwt-size="medium" nwt-variant="quiet"><div class="nwt-badge__content"><div class="nwt-badge__label">${badge[1]}</div></div></span></td>` +
      `<td class="nwt-datatable__cell nwt-datatable__cell--actions nwt-align-right ish-acc"><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="Acciones de ${esc(nombreDe(r))}" aria-haspopup="menu" aria-expanded="${ab}" data-menu="${esc(r.code)}" data-key="m-${esc(r.code)}"><div class="nwt-icon"><i class="naotech-icon-overflow-menu-vertical"></i></div></button></span>` +
      (ab ? `<div class="ish-menu" role="menu"><button type="button" role="menuitem" data-editar="${esc(r.code)}" data-key="ed-${esc(r.code)}">${ICO.editar}<span>Editar</span></button>` +
        (pc ? '' : `<button type="button" role="menuitem" data-estado="${esc(r.code)}" data-key="es-${esc(r.code)}">${act ? ICO.inactivar : ICO.activar}<span>${act ? 'Inactivar' : 'Activar'}</span></button>`) + '</div>' : '') + `</td></tr>`;
  };
  let tAv = null; // el aviso («Tipo creado»…) es pasajero: se quita solo a los 4 s
  const avisoTransitorio = () => { clearTimeout(tAv); if (S.aviso) tAv = setTimeout(() => { S.aviso = ''; const e = cont && cont.querySelector('.ish-guardado'); if (e) e.textContent = ''; }, 4000); };
  const dibujar = () => {
    if (!cont) return;
    avisoTransitorio();
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const TAM = UI().TAM, todos = filtrados(), pags = Math.max(1, Math.ceil(todos.length / TAM)); if (S.pag > pags) S.pag = pags;
    const l = todos.slice((S.pag - 1) * TAM, S.pag * TAM);
    const cuerpo = !S.est ? '<p class="ish-vacio">Cargando…</p> ' : l.length
      ? `<div class="nwt-datatable"><div class="nwt-datatable__table"><table><thead class="nwt-datatable__head"><tr class="nwt-datatable__header"><th class="nwt-datatable__title nwt-width-xs-25">Tipo de acreditado</th><th class="nwt-datatable__title nwt-width-xs-20">Tipo de personal</th><th class="nwt-datatable__title nwt-width-xs-15">Categoría</th><th class="nwt-datatable__title nwt-width-xs-20">Permisos</th><th class="nwt-datatable__title nwt-width-xs-15 ish-c">Estado</th><th class="nwt-datatable__title nwt-width-xs-10"></th></tr></thead>` +
        `<tbody class="nwt-datatable__body">${l.map(filaHTML).join('')}</tbody></table></div></div>${UI().paginador(S.pag, pags)}`
      : UI().vacioHTML(!!(S.q || S.estado !== 'todos'), 'Aún no hay tipos de acreditado.', 'Ningún tipo coincide con la búsqueda.');
    cont.innerHTML =
      `<section class="nws-access-permissions ish-perms"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">Tipos de acreditados</span>` +
      `<small class="nwt-smalltext-font-regular">Los tipos de la delegación llegan de inscripción: edítalos para darles permisos. Los del evento y de Naowee se crean aquí.</small></div>` +
      `<div class="nws-access-permissions__actions"><span class="ish-guardado" role="status" aria-live="polite">${esc(S.aviso)}</span><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="medium" data-nuevo data-key="nuevo"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>Nuevo tipo de acreditado</span></button></div></div>` +
      `<div class="nwt-card nws-access-permissions__catalog" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `<div class="ish-filtros"><div class="ish-busca"><div class="nwt-searchbox"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-searchbox__container"><div class="nwt-icon"><i class="naotech-icon-search"></i></div>` +
      `<input class="nwt-searchbox__input" placeholder="Buscar por tipo o tipo de personal" type="text" value="${esc(S.q)}" data-buscar data-key="buscar" aria-label="Buscar tipos"></div></div></div></div></div></div>${UI().filtroEstado(S.estado)}</div>${cuerpo}</div></div></div></section>`;
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) { e.focus(); if (e.matches('[data-buscar]')) e.setSelectionRange(e.value.length, e.value.length); } }
    UI().ubicarMenu(cont, () => { if (S.menu != null) { S.menu = null; dibujar(); } });
  };

  // ── Modal (crear / editar) ─────────────────────────────────────────────────
  const tagsDe = (id) => { const p = S.est && S.est.accessPermissions.find((x) => String(x.id) === String(id)); return (p && p.tags) || []; };
  // Etiquetas elegidas del permiso para este tipo: por defecto todas las que tenga; solo ellas llevan tope propio.
  const etiqDe = (f, id) => (f.etiq[id] === undefined ? tagsDe(id).slice() : f.etiq[id]);
  const val1 = (f, id) => (f.val[id] = f.val[id] || V.val0());
  const errVal1 = (f, id) => V.errVal(f.val[id], etiqDe(f, id), tagsDe(id).length > 0);
  const errores = (f, edita) => {
    const e = {};
    if (!edita && !f.nombre.trim()) e.nm = 'Escribe el nombre del tipo de acreditado.';
    if (!f.permisos.length) e.pm = 'Selecciona al menos un permiso.';
    if (f.permisos.some((id) => errVal1(f, id))) e.val = true;
    if (!f.cat) e.cat = window.ACRED_CATS && window.ACRED_CATS.activas().length ? 'Selecciona la categoría.' : 'Primero crea una categoría en «Categorías».';
    return e;
  };
  const er = (k) => { const m = S.modal && S.modal.form.ver && errores(S.modal.form, S.modal.modo === 'editar')[k]; return m ? `<p class="ish-err" role="alert" data-err="${k}">${esc(m)}</p>` : ''; };
  const lectura = (rotulo, valor) => `<div class="nwt-text-field"><div class="nwt-input-box nwt-input-box--disabled"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}</label><div class="nwt-input-box__control"><input class="nwt-text-field__input" type="text" value="${esc(valor)}" disabled></div></div></div></div>`;
  const modalHTML = () => {
    const m = S.modal, f = m.form, edita = m.modo === 'editar', r = edita ? S.est.roles.find((x) => x.code === m.id) : null;
    const nm = `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label" for="ish-nombre">Nombre del tipo de acreditado<span class="nwt-input-box__required">*</span></label><div class="nwt-input-box__control"><input id="ish-nombre" class="nwt-text-field__input" type="text" value="${esc(f.nombre)}" data-nombre data-key="nombre" placeholder="Ej: Médico" maxlength="80" autocomplete="off"></div></div></div></div>${er('nm')}`;
    const cats = (window.ACRED_CATS ? window.ACRED_CATS.activas() : []).slice(); if (f.cat && !cats.some((c) => c.siglas === f.cat) && window.ACRED_CATS && window.ACRED_CATS.porSiglas(f.cat)) cats.push(window.ACRED_CATS.porSiglas(f.cat));
    const selCat = `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label" for="ish-cat">Categoría<span class="nwt-input-box__required">*</span></label><div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select id="ish-cat" class="ish-sel__in" data-cat data-key="cat"><option value=""${f.cat ? '' : ' selected'} disabled>Selecciona la categoría</option>${cats.map((c) => `<option value="${esc(c.siglas)}"${f.cat === c.siglas ? ' selected' : ''}>${esc(c.siglas)} · ${esc(c.nombre)}</option>`).join('')}</select><div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div><div class="nwt-input-box__message"><span>La organización a la que pertenece; sus siglas van en la franja de la acreditación.</span></div></div></div></div>${er('cat')}`;
    const cabeza = edita ? `<div class="naotech-col--2">${lectura('Tipo de acreditado', nombreDe(r))}</div><div class="naotech-col--2">${lectura('Tipo de personal', GRUPOS[grupoDe(r)])}</div><div class="naotech-col--4">${selCat}</div>` : `<div class="naotech-col--4">${nm}</div><div class="naotech-col--4">${selCat}</div>`;
    const titulo = edita ? 'Editar tipo de acreditado' : 'Nuevo tipo de acreditado';
    return `<div class="nwt-modal nwt-modal--visible nws-accreditations-module nws-access-permission-modal ish-modal ish-modal--ancho" role="dialog" aria-modal="true" aria-label="${titulo}">` +
      `<div class="nwt-modal__content"><div class="nwt-modal__header"><div class="nwt-modal__header__description"><span class="ish-modal__t">${titulo}</span><span class="ish-modal__sub">${edita ? 'Asigna los permisos que tendrá y cuántas veces puede usar cada uno.' : 'Escribe su nombre, elige la categoría y los permisos con su validación.'}</span></div>` +
      `<span class="nwt-modal__close" role="button" tabindex="0" aria-label="Cerrar" data-cerrar><div class="nwt-icon"><i class="naotech-icon-close"></i></div></span></div>` +
      `<div class="nwt-modal__component"><div class="nws-access-permission-modal__body"><div class="naotech-grid naotech-grid--4">` + cabeza +
      `<div class="naotech-col--4">${MS.html(m, { id: 'pm', etiqueta: 'Seleccionar permisos', req: true, ph: 'Selecciona los permisos', opciones: opcionesPm(), sel: f.permisos, conTodos: true, busca: 'Buscar permiso' })}${er('pm')}</div>` +
      (f.permisos.length ? `<div class="naotech-col--4"><div class="ish-val-sec"><span class="ish-val-sec__t">Validación por permiso</span><small class="ish-val-sec__s">Cuántas veces puede usar este tipo de acreditado cada etiqueta de un permiso y en qué fechas. Si no se activa, el acceso es libre.</small>${f.permisos.map((id) => { const p = S.est.accessPermissions.find((x) => String(x.id) === String(id)); return p ? V.valHTML(val1(f, id), etiqDe(f, id), id, p.name, tagsDe(id).length ? MS.html(m, { id: 'et:' + id, etiqueta: 'Etiquetas de este permiso', ph: 'Selecciona las etiquetas', opciones: tagsDe(id).map((t) => ({ v: t, t })), sel: etiqDe(f, id), conTodos: true, busca: 'Buscar etiqueta' }) : '', tagsDe(id).length > 0) : ''; }).join('')}</div></div>` : '') +
      (f.error ? `<div class="naotech-col--4"><div class="nwt-alert nwt-alert--visible ish-alerta ish-alerta--form" nwt-theme="negative" nwt-variant="quiet" role="alert"><div class="nwt-alert__content"><div class="nwt-alert__icon"><div class="nwt-icon"><i class="naotech-icon-info"></i></div></div><span class="nwt-alert__label">${esc(f.error)}</span></div></div></div>` : '') +
      `</div><footer class="nws-access-permission-modal__footer ish-modal__footer"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="large" data-cerrar><span class="nwt-button__content">Cancelar</span></button><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="large" data-guardar><span class="nwt-button__content">${edita ? 'Guardar cambios' : 'Crear'}</span></button></footer></div></div></div><div class="nwt-modal__backdrop" data-cerrar></div></div>`;
  };
  const msApi = {
    raiz: () => modalEl, redibujar: (foco) => montar(foco), vivo: () => !!S.modal,
    opciones: (id) => (id.startsWith('et:') ? tagsDe(id.slice(3)).map((t) => ({ v: t, t })) : opcionesPm()),
    alternar: (id, v) => {
      const f = S.modal.form;
      if (id.startsWith('et:')) { const pid = id.slice(3), t = tagsDe(pid), l = etiqDe(f, pid).slice(); if (v === '__todos') f.etiq[pid] = t.every((x) => l.includes(x)) ? [] : t.slice(); else { const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); f.etiq[pid] = l; } return; }
      if (v === '__todos') { const t = opcionesPm().map((o) => o.v); f.permisos = t.every((x) => f.permisos.includes(x)) ? [] : t; return; }
      const i = f.permisos.indexOf(v); if (i >= 0) f.permisos.splice(i, 1); else f.permisos.push(v);
    },
    quitar: (id, v) => { if (id.startsWith('et:')) { const f = S.modal.form, pid = id.slice(3); f.etiq[pid] = etiqDe(f, pid).filter((x) => x !== v); return; } const l = S.modal.form.permisos, i = l.indexOf(v); if (i >= 0) l.splice(i, 1); },
    seleccionar: (id, v) => { if (id.startsWith('et:')) { const f = S.modal.form, pid = id.slice(3), l = etiqDe(f, pid).slice(); if (!l.includes(v)) l.push(v); f.etiq[pid] = l; return; } const l = S.modal.form.permisos; if (!l.includes(v)) l.push(v); }
  };
  window.addEventListener('resize', () => MS.ubicar(modalEl, S.modal));
  const montar = (foco) => {
    const bd = modalEl && modalEl.querySelector('.nws-access-permission-modal__body'), sc = bd ? bd.scrollTop : 0;
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div'); modalEl.id = 'ish-modal-tipo'; modalEl.innerHTML = modalHTML();
    modalEl.dataset.anim = (S.modal && S.modal.anim) || ''; if (S.modal) { S.modal.anim = ''; S.modal.cierre = null; }
    modalEl.querySelectorAll('[data-err]').forEach((p) => { const pe = p.previousElementSibling; if (pe) { pe.classList.add('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.add('nwt-input-box--error'); } });
    document.body.append(modalEl);
    const b2 = modalEl.querySelector('.nws-access-permission-modal__body'); if (b2) b2.scrollTop = sc;
    const e = foco && [...modalEl.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco);
    const el = e || modalEl.querySelector('select,[data-ms],button:not([disabled])'); el.focus(); if (el.matches && el.matches('[data-ms-q]')) el.setSelectionRange(el.value.length, el.value.length);
    MS.ubicar(modalEl, S.modal); if (b2) b2.addEventListener('scroll', () => MS.ubicar(modalEl, S.modal));
  };
  const abrir = (modo, r) => {
    opener = document.activeElement; S.menu = null;
    const f = vacio(); if (r) { f.cat = r.acred_categoria || ''; f.permisos = (r.permissions || []).map((p) => String(p.permission_id)); (r.permissions || []).forEach((p) => { if (Array.isArray(p.tags)) f.etiq[String(p.permission_id)] = p.tags.slice(); const v = p.validation || V.val0(); f.val[String(p.permission_id)] = { activa: !!v.activa, global: Object.assign(V.tope0(), v.global), etiquetas: JSON.parse(JSON.stringify(v.etiquetas || {})) }; }); }
    S.modal = { modo, id: r && r.code, ms: null, msq: '', msadd: '', anim: '', cierre: null, form: f }; dibujar(); montar(modo === 'editar' ? 'pm' : 'nombre');
  };
  const cerrarModal = () => { if (modalEl) { modalEl.remove(); modalEl = null; } S.modal = null; if (opener && document.contains(opener)) opener.focus(); };
  const permisosDe = (f) => f.permisos.map((pid, i) => { const p = S.est.accessPermissions.find((x) => String(x.id) === pid); const tg = etiqDe(f, pid), v = f.val[pid], on = !!(v && v.activa), g = on && /^\d+$/.test(String(v.global.usos).trim()) ? +v.global.usos : null; return { permission_id: p.id, permission_name: p.name, has_limit: on && g != null, max_uses_per_person: g, tags: tg, validation: on ? { activa: true, global: v.global, etiquetas: Object.fromEntries(etiqDe(f, pid).filter((t) => v.etiquetas[t]).map((t) => [t, v.etiquetas[t]])) } : null, order: i + 1 }; });
  const guardarModal = () => {
    const m = S.modal, f = m.form, edita = m.modo === 'editar';
    if (Object.keys(errores(f, edita)).length) { f.ver = true; m.ms = null; montar(); const p = modalEl.querySelector('[data-err],[data-err-val]:not(:empty)'); if (p) p.scrollIntoView({ block: 'nearest' }); return; }
    if (edita) {
      const r = S.est.roles.find((x) => x.code === m.id), eraPorConfigurar = porConfigurar(r);
      r.permissions = permisosDe(f); r.acred_categoria = f.cat || null;
      if (eraPorConfigurar) r.is_active = true; // al configurarlo por primera vez queda activo
      guardar(); S.aviso = 'Cambios guardados';
    } else {
      const nombre = f.nombre.replace(/\s+/g, ' ').trim();
      if (roles().some((r) => sinTildes(nombreDe(r)) === sinTildes(nombre))) { f.error = `«${nombre}» ya es un tipo de acreditado.`; return montar('nombre'); }
      const cat = (CREABLES.find((c) => c[0] === f.grupo) || [])[2];
      [nombre].forEach((nombre) => {
        const l = S.est.roles, id = Math.max(0, ...l.map((r) => r.id || 0)) + 1, code = slug(nombre);
        l.push({ code: `tipo-${id}-0000-4000-8000-000000000000`, id, role_name: nombre, role_code: code, platform_role: cat, platform_subrole: code, event_id: eventoId(), is_active: true, acred_categoria: f.cat || null, access_deadline: null, permissions: permisosDe(f) });
      });
      guardar(); S.aviso = 'Tipo creado';
    }
    opener = null; cerrarModal(); dibujar(); const b = cont.querySelector('[data-nuevo]'); if (b) b.focus();
  };

  // ── Eventos ────────────────────────────────────────────────────────────────
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if ((b = q('[data-pag]'))) { S.pag += b.dataset.pag === 'next' ? 1 : -1; return dibujar(); }
    if (q('[data-limpiar]')) { S.q = ''; S.estado = 'todos'; S.pag = 1; return dibujar(); }
    if (q('[data-nuevo]')) return abrir('crear');
    if ((b = q('[data-menu]'))) { const id = b.dataset.menu, cerrando = S.menu === id; S.menu = cerrando ? null : id; dibujar(); return; }
    if ((b = q('[data-editar]'))) return abrir('editar', S.est.roles.find((x) => x.code === b.dataset.editar));
    if ((b = q('[data-estado]'))) { const r = S.est.roles.find((x) => x.code === b.dataset.estado); r.is_active = r.is_active === false; guardar(); S.menu = null; S.aviso = r.is_active ? 'Tipo activo' : 'Tipo inactivo'; return dibujar(); }
    if (S.menu != null && !q('.ish-menu')) { S.menu = null; dibujar(); }
  };
  const onModal = (e) => {
    const q = (s) => e.target.closest(s);
    if (q('[data-cerrar]')) return cerrarModal();
    const sw = q('[data-vsw]'); if (sw) { const v = val1(S.modal.form, sw.dataset.vsw); v.activa = !v.activa; return montar('vsw-' + sw.dataset.vsw); }
    if (MS.click(e, S.modal, msApi)) return;
    if (S.modal.ms && !q('.ish-ms')) { S.modal.ms = null; S.modal.msq = ''; montar(); }
    if (q('[data-guardar]')) return guardarModal();
  };
  const refrescaErr = () => {
    const m = S.modal; if (!m || !m.form.ver || !modalEl) return; const er0 = errores(m.form, m.modo === 'editar');
    modalEl.querySelectorAll('[data-err]').forEach((p) => { if (!er0[p.dataset.err]) { const pe = p.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.remove('nwt-input-box--error'); } p.remove(); } });
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.matches('[data-buscar]')) { S.q = t.value; S.pag = 1; return dibujar(); }
    if (!S.modal) return;
    if (MS.entrada(e, S.modal, msApi)) return;
    if (t.matches('[data-cat]')) { S.modal.form.cat = t.value; refrescaErr(); return; }
    if (t.matches('[data-nombre]')) { S.modal.form.nombre = t.value; S.modal.form.error = ''; }
    if (t.dataset.vf) {
      const f = S.modal.form, vf = t.dataset.vf, i = vf.lastIndexOf('|'), c = vf.slice(i + 1), j = vf.indexOf('~'), pid = vf.slice(0, j), k = vf.slice(j + 1, i), v = val1(f, pid);
      const tope = k === 'g' ? v.global : (v.etiquetas[k] = v.etiquetas[k] || V.tope0()); tope[c] = t.value;
      if (c === 'desde') { const h = t.closest('.ish-tope-card').querySelector('[data-vf$="|hasta"]'); if (h) h.min = t.value; }
      const er1 = modalEl.querySelector(`[data-err-val="${pid}"]`); if (er1) er1.textContent = V.errVal(v, etiqDe(f, pid), tagsDe(pid).length > 0);
    }
    refrescaErr();
  };
  const onKeyModal = (e) => {
    if (S.modal && MS.tecla(e, S.modal, msApi)) return;
    if (e.key === 'Escape') { e.stopPropagation(); return cerrarModal(); }
    if (e.target.matches && e.target.matches('[role=option],[role=combobox],[role=switch]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return e.target.click(); }
    if (e.target.matches && e.target.matches('[data-cerrar]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return cerrarModal(); }
    if (e.key === 'Tab' && modalEl) {
      const f = [...modalEl.querySelectorAll('button:not([disabled]),input:not([tabindex="-1"]):not([disabled]),select,[tabindex="0"]')].filter((x) => x.offsetParent);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  document.addEventListener('click', (e) => { if (modalEl && modalEl.contains(e.target)) onModal(e); });
  document.addEventListener('input', (e) => { if (modalEl && modalEl.contains(e.target)) onInput(e); });
  document.addEventListener('keydown', (e) => {
    if (modalEl && (modalEl.contains(e.target) || e.key === 'Escape')) onKeyModal(e);
    else if (e.key === 'Escape' && S.menu != null && cont && cont.dataset.id === 'tipos') { S.menu = null; dibujar(); }
  });

  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.tipos = {
    render(el) {
      cont = el; S.aviso = ''; S.menu = null;
      if (!cont.__ligadoT) {
        const mia = (f) => (e) => { if (cont && cont.dataset.id === 'tipos') f(e); };
        cont.addEventListener('click', mia(onClick)); cont.addEventListener('input', mia(onInput));
        cont.addEventListener('change', mia((e) => { if (e.target.matches('[data-fest]')) { S.estado = e.target.value; S.pag = 1; dibujar(); } }));
        cont.__ligadoT = true;
      }
      dibujar();
      Promise.all([listo(), get('/role-catalog?event_id=7').catch(() => null)]).then(([est, cat]) => {
        if (!est) { cont.innerHTML = '<p class="ish-vacio" role="alert">No se pudieron leer los tipos de acreditado.</p>'; return; }
        repara(); S.est = est; S.cat = ((cat && cat.families) || []).map((f) => ({ code: f.code, name: f.name, functions: f.functions || [] })); precarga(); dibujar();
      });
    }
  };
})();
