// Pantalla propia «Formularios de registro» (Parametrización). Un creador sencillo —no un Google Forms—: se nombra el formulario y se le
// ponen preguntas de tres clases: respuesta abierta (texto corto, párrafo, número, fecha), selector (opciones, una o varias) y archivo
// (tipos permitidos y tamaño máximo). Los formularios quedan en un catálogo; el operador externo recibe uno de ellos al crearlo en «Usuarios».
// Guarda en localStorage (`naowee.acreditaciones.formularios`); `window.ACRED_FORMS` lo comparte con usuarios.js.
(() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const UI = () => window.ACRED_DATOS, MS = window.ACRED_MS;
  const KEY = 'naowee.acreditaciones.formularios';
  const TIPOS = { abierta: 'Respuesta abierta', selector: 'Selector', archivo: 'Archivo' };
  const FORMATOS = [['texto', 'Texto corto'], ['parrafo', 'Párrafo'], ['numero', 'Número'], ['fecha', 'Fecha']];
  const ARCH = [['pdf', 'PDF'], ['jpg', 'JPG'], ['png', 'PNG']];
  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = (d) => (d ? `${+d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '—');
  let uidN = 0;
  const nuevaQ = (tipo) => ({ uid: ++uidN, col: false, tipo, texto: '', sub: '', req: false, formato: 'texto', multi: false, opciones: tipo === 'selector' ? ['', ''] : [], tipos: [], mb: 5 });

  // ── Catálogo (localStorage) ────────────────────────────────────────────────
  const semilla = () => [
    { id: 'f1', nombre: 'Registro de voluntarios', activo: true, creado: '2026-11-01', modificadoPor: 'Danna Arrieta', preguntas: [
      Object.assign(nuevaQ('abierta'), { texto: 'Nombre completo', req: true }), Object.assign(nuevaQ('abierta'), { texto: 'Número de documento', req: true, formato: 'numero' }),
      Object.assign(nuevaQ('selector'), { texto: 'Talla de camiseta', opciones: ['S', 'M', 'L', 'XL'] }), Object.assign(nuevaQ('archivo'), { texto: 'Documento de identidad', req: true, tipos: ['pdf', 'jpg', 'png'] })] },
    { id: 'f2', nombre: 'Registro de prensa', activo: true, creado: '2026-11-01', modificadoPor: 'Danna Arrieta', preguntas: [
      Object.assign(nuevaQ('abierta'), { texto: 'Nombre completo', req: true }), Object.assign(nuevaQ('abierta'), { texto: 'Medio de comunicación', req: true }),
      Object.assign(nuevaQ('archivo'), { texto: 'Carta del medio', req: true, tipos: ['pdf'], mb: 10 })] }
  ];
  // Formularios guardados antes de acotar los tipos de archivo a PDF, JPG y PNG: «imagen» pasa a JPG y PNG; Word y Excel se descartan.
  const migra = (l) => { l.forEach((f) => (f.preguntas || []).forEach((q) => { if (q.tipos) q.tipos = [...new Set(q.tipos.flatMap((t) => (t === 'imagen' ? ['jpg', 'png'] : [t])).filter((t) => ARCH.some((a) => a[0] === t)))]; })); return l; };
  const lista = () => { try { let l = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!l) { l = semilla(); localStorage.setItem(KEY, JSON.stringify(l)); } return migra(l); } catch (x) { return semilla(); } };
  const guardaLista = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch (x) { return false; } };
  const persona = () => (window.__ACRED_PERSONA__ ? window.__ACRED_PERSONA__() : 'Danna Arrieta');
  window.ACRED_FORMS = { lista, activos: () => lista().filter((f) => f.activo !== false).map((f) => ({ id: f.id, nombre: f.nombre })) };

  const S = { q: '', estado: 'todos', pag: 1, menu: null, modal: null, aviso: '' };
  let cont = null, modalEl = null, opener = null;
  const miRol = () => (window.__ACRED_ROL__ ? window.__ACRED_ROL__() : 'gestor');
  const pu = (a) => miRol() === 'gestor' || !window.__ACRED_PERMISO__ || window.__ACRED_PERMISO__('formularios', a);

  // ── Listado ────────────────────────────────────────────────────────────────
  const svg = (d) => `<svg class="ish-mi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO_COPIA = svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>');
  const filtrados = () => { const q = sinTildes(S.q.trim()); return lista().filter((f) => (S.estado === 'todos' || (S.estado === 'activo') === (f.activo !== false)) && (!q || sinTildes(f.nombre).includes(q))); };
  const filaHTML = (f) => {
    const act = f.activo !== false, ab = S.menu === f.id, ICO = UI().ICO;
    return `<tr class="nwt-datatable__record"><td class="nwt-datatable__cell nwt-width-xs-35"><span class="nwt-text-font-medium">${esc(f.nombre)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15"><span>${(f.preguntas || []).length}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><div class="ish-cel"><span>${esc(fecha(f.modificado || f.creado))}</span><small class="ish-sub">${esc(f.modificadoPor || 'Danna Arrieta')}</small></div></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15 ish-c"><span class="nwt-badge nwt-badge--vignette" role="status" nwt-theme="${act ? 'positive' : 'neutral'}" nwt-size="medium" nwt-variant="quiet"><div class="nwt-badge__content"><div class="nwt-badge__label">${act ? 'Activo' : 'Inactivo'}</div></div></span></td>` +
      `<td class="nwt-datatable__cell nwt-datatable__cell--actions nwt-align-right ish-acc"><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="Acciones de ${esc(f.nombre)}" aria-haspopup="menu" aria-expanded="${ab}" data-menu="${esc(f.id)}" data-key="m-${esc(f.id)}"><div class="nwt-icon"><i class="naotech-icon-overflow-menu-vertical"></i></div></button></span>` +
      (ab ? `<div class="ish-menu" role="menu"><button type="button" role="menuitem" data-editar="${esc(f.id)}" data-key="ed-${esc(f.id)}">${ICO.editar}<span>Editar</span></button>` +
        `<button type="button" role="menuitem" data-duplicar="${esc(f.id)}">${ICO_COPIA}<span>Duplicar</span></button>` +
        `<button type="button" role="menuitem" data-estado="${esc(f.id)}">${act ? ICO.inactivar : ICO.activar}<span>${act ? 'Inactivar' : 'Activar'}</span></button></div>` : '') + `</td></tr>`;
  };
  // El aviso («Formulario creado»…) es una confirmación pasajera: se quita solo a los 4 s.
  let tAv = null;
  const avisoTransitorio = () => { clearTimeout(tAv); if (S.aviso) tAv = setTimeout(() => { S.aviso = ''; const e = cont && cont.querySelector('.ish-guardado'); if (e) e.textContent = ''; }, 4000); };
  const dibujarLista = () => {
    if (!cont) return;
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    avisoTransitorio();
    const TAM = UI().TAM, todos = filtrados(), pags = Math.max(1, Math.ceil(todos.length / TAM)); if (S.pag > pags) S.pag = pags;
    const l = todos.slice((S.pag - 1) * TAM, S.pag * TAM);
    const cuerpo = l.length
      ? `<div class="nwt-datatable"><div class="nwt-datatable__table"><table><thead class="nwt-datatable__head"><tr class="nwt-datatable__header"><th class="nwt-datatable__title nwt-width-xs-35">Nombre del formulario</th><th class="nwt-datatable__title nwt-width-xs-15">Preguntas</th><th class="nwt-datatable__title nwt-width-xs-20">Última modificación</th><th class="nwt-datatable__title nwt-width-xs-15 ish-c">Estado</th><th class="nwt-datatable__title nwt-width-xs-15"></th></tr></thead>` +
        `<tbody class="nwt-datatable__body">${l.map(filaHTML).join('')}</tbody></table></div></div>${UI().paginador(S.pag, pags)}`
      : UI().vacioHTML(!!(S.q || S.estado !== 'todos'), 'Aún no hay formularios. Crea el primero.', 'Ningún formulario coincide con la búsqueda.');
    cont.innerHTML =
      `<section class="nws-access-permissions ish-perms"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">Formularios de registro</span>` +
      `<small class="nwt-smalltext-font-regular">Los formularios que usan los operadores externos para registrar acreditados. Se asignan al crear el operador en «Usuarios».</small></div>` +
      `<div class="nws-access-permissions__actions"><span class="ish-guardado" role="status" aria-live="polite">${esc(S.aviso)}</span><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="medium" data-nuevo data-key="nuevo"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>Nuevo formulario</span></button></div></div>` +
      `<div class="nwt-card nws-access-permissions__catalog" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `<div class="ish-filtros"><div class="ish-busca"><div class="nwt-searchbox"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-searchbox__container"><div class="nwt-icon"><i class="naotech-icon-search"></i></div>` +
      `<input class="nwt-searchbox__input" placeholder="Buscar formulario" type="text" value="${esc(S.q)}" data-buscar data-key="buscar" aria-label="Buscar formularios"></div></div></div></div></div></div>${UI().filtroEstado(S.estado)}</div>${cuerpo}</div></div></div></section>`;
    // Lo que el rol no tiene marcado en la matriz se quita.
    if (!pu('crear')) cont.querySelectorAll('[data-nuevo]').forEach((e) => e.remove());
    if (!pu('editar')) cont.querySelectorAll('[data-editar]').forEach((e) => e.remove());
    if (!pu('crear')) cont.querySelectorAll('[data-duplicar]').forEach((e) => e.remove());
    if (!pu('inhabilitar')) cont.querySelectorAll('[data-estado]').forEach((e) => e.remove());
    if (!pu('editar') && !pu('crear') && !pu('inhabilitar')) cont.querySelectorAll('[data-menu]').forEach((e) => { (e.closest('.nwt-icon-button') || e).remove(); });
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) { e.focus(); if (e.matches('[data-buscar]')) e.setSelectionRange(e.value.length, e.value.length); } }
    UI().ubicarMenu(cont, () => { if (S.menu != null) { S.menu = null; dibujarLista(); } });
  };

  // ── Editor (vista de página, no modal) ─────────────────────────────────────
  const errores = (f) => {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre del formulario.';
    if (!f.preguntas.length) e.preguntas = 'Agrega al menos una pregunta.';
    f.preguntas.forEach((q, i) => {
      if (!q.texto.trim()) e['q' + i + 't'] = 'Escribe la pregunta.';
      if (q.tipo === 'selector' && q.opciones.filter((o) => o.trim()).length < 2) e['q' + i + 'o'] = 'Agrega al menos dos opciones.';
      if (q.tipo === 'archivo' && !q.tipos.length) e['q' + i + 'a'] = 'Selecciona al menos un tipo de archivo.';
    });
    return e;
  };
  const er = (k) => { const m = S.modal && S.modal.f.ver && errores(S.modal.f)[k]; return m ? `<p class="ish-err" role="alert" data-err="${esc(k)}">${esc(m)}</p>` : ''; };
  const campo = (rotulo, valor, attrs, req, tipo) => `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}${req ? '<span class="nwt-input-box__required">*</span>' : ''}</label><div class="nwt-input-box__control"><input class="nwt-text-field__input" type="${tipo || 'text'}" value="${esc(valor)}" ${attrs} autocomplete="off"></div></div></div></div>`;
  const selNat = (rotulo, attrs, ops, val) => `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}</label><div class="nwt-input-box__control"><div class="nwt-dropdown__content"><select class="ish-sel__in" ${attrs}>${ops.map(([k, t]) => `<option value="${k}"${String(val) === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select><div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>`;
  const ib = (icono, etiqueta, attrs, dis) => `<span class="nwt-icon-button${dis ? ' nwt-icon-button--disabled' : ''}" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="${etiqueta}" ${attrs} ${dis ? 'disabled' : ''}><div class="nwt-icon"><i class="naotech-icon-${icono}"></i></div></button></span>`;
  const sw = (on, etiqueta, data) => `<label class="ish-sw-fila"><div class="nwt-switch${on ? ' nwt-switch--checked' : ''}" role="switch" tabindex="0" aria-checked="${on}" aria-label="${esc(etiqueta)}" ${data}><div class="nwt-switch__component"><div class="nwt-switch__component__element"></div></div></div><span>${esc(etiqueta)}</span></label>`;
  const preguntaHTML = (q, i, n) => {
    let esp = '';
    if (q.tipo === 'abierta') esp = `<div class="ish-q-fila">${selNat('Formato de respuesta', `data-q="${i}|formato" data-key="q-${i}-f"`, FORMATOS, q.formato)}</div>`;
    if (q.tipo === 'selector') {
      esp = `<div class="ish-q-fila">${selNat('Elección', `data-q="${i}|multi" data-key="q-${i}-m"`, [['0', 'Una opción'], ['1', 'Varias opciones']], q.multi ? '1' : '0')}</div>` +
        `<div class="ish-q-ops"><span class="ish-q-rot">Opciones<span class="nwt-input-box__required">*</span></span>${q.opciones.map((o, j) => `<div class="ish-q-op">${campo('', o, `data-o="${i}|${j}" data-key="o-${i}-${j}" placeholder="Opción ${j + 1}" maxlength="80"`)}${ib('close', 'Quitar la opción ' + (j + 1), `data-delopt="${i}|${j}"`, q.opciones.length <= 2)}</div>`).join('')}` +
        `<div><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="small" data-addopt="${i}" data-key="ao-${i}"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>Agregar opción</span></button></div>${er('q' + i + 'o')}</div>`;
    }
    if (q.tipo === 'archivo') {
      esp = `<div class="naotech-grid naotech-grid--4"><div class="naotech-col--3">${MS.html(S.modal, { id: 'ft:' + i, etiqueta: 'Tipos de archivo permitidos', req: true, ph: 'Selecciona los tipos', opciones: ARCH.map(([v, t]) => ({ v, t })), sel: q.tipos, busca: 'Buscar tipo' })}${er('q' + i + 'a')}</div>` +
        `<div class="naotech-col--1">${campo('Máx. (MB)', q.mb, `data-q="${i}|mb" min="1" max="50" inputmode="numeric"`, false, 'number')}</div></div>`;
    }
    // Fila compacta (propuesta B): arriba la etiqueta del tipo y las acciones; debajo la pregunta y su aclaración; la configuración propia del tipo va en el pie.
    const IC = { abierta: '<path d="M4 7h16M4 12h10M4 17h13"/>', selector: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M9 11l3 3 3-3"/>', archivo: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 14l2-2 2 2M12 12v5"/>' };
    const sv = (d, w) => `<svg width="${w || 18}" height="${w || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const grip = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="5" r="1.5"/><circle cx="10" cy="5" r="1.5"/><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="4" cy="15" r="1.5"/><circle cx="10" cy="15" r="1.5"/></svg>';
    return `<div class="ish-qr${q.col ? ' col' : ''}${S.modal.nuevo === q.uid ? ' nueva' : ''}" data-fila="${q.uid}"><div class="ish-qr__top"><span class="ish-qr__asa" aria-hidden="true">${grip}</span><span class="ish-qr__ico" aria-hidden="true">${sv(IC[q.tipo])}</span>` +
      `<div class="ish-qr__cuerpo"><div class="ish-qr__cab"><span class="nwt-tag ish-tag-et" nwt-size="small">${TIPOS[q.tipo]}</span>${q.col ? `<span class="ish-qr__res">${esc(q.texto.trim() || 'Pregunta sin título')}${q.req ? '<span class="nwt-input-box__required">*</span>' : ''}</span>` : ''}<span class="ish-qr__acc">${sw(q.req, 'Obligatoria', `data-req="${i}" data-key="q-${i}-r"`)}${ib(q.col ? 'chevron-down' : 'chevron-up', (q.col ? 'Expandir' : 'Colapsar') + ' la pregunta ' + (i + 1), `data-col="${i}" data-key="q-${i}-c"`)}${ib('arrow-up', 'Subir la pregunta ' + (i + 1), `data-up="${i}"`, i === 0)}${ib('arrow-down', 'Bajar la pregunta ' + (i + 1), `data-down="${i}"`, i === n - 1)}${ib('delete', 'Eliminar la pregunta ' + (i + 1), `data-delq="${i}"`)}</span></div>` +
      (q.col ? '' : `${campo('', q.texto, `data-q="${i}|texto" data-key="q-${i}-t" placeholder="Escribe la pregunta" aria-label="Pregunta ${i + 1}" maxlength="140"`, false)}${er('q' + i + 't')}` +
      `<div class="ish-qr__acl">${campo('', q.sub || '', `data-q="${i}|sub" data-key="q-${i}-s" placeholder="Subtítulo o aclaración (opcional)" aria-label="Subtítulo o aclaración de la pregunta ${i + 1}" maxlength="160"`, false)}</div>`) + `</div></div>` +
      `${esp && !q.col ? `<div class="ish-qr__cfg">${esp}</div>` : ''}</div>`;
  };
  // Una sola acción para agregar: un botón punteado que abre los tres tipos como fichas.
  const tiposPanel = () => {
    const X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const IC = { abierta: '<path d="M4 7h16M4 12h10M4 17h13"/>', selector: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M9 11l3 3 3-3"/>', archivo: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 14l2-2 2 2M12 12v5"/>' };
    const DESC = { abierta: 'Texto corto, párrafo, número o fecha.', selector: 'Elige entre opciones que tú defines.', archivo: 'Pide un archivo: PDF, JPG o PNG.' };
    const ficha = (t) => `<button type="button" class="ish-tp__f" data-addq="${t}" data-key="add-${t}"><span class="ish-qr__ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[t]}</svg></span><b>${TIPOS[t]}</b><span>${DESC[t]}</span></button>`;
    return `<div class="ish-tp" id="ish-tp"><div class="ish-tp__top"><span>¿Qué tipo de pregunta?</span><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" data-cerrar-panel data-key="cerrar-panel" title="Cerrar" aria-label="Cerrar">${X}</button></span></div><div class="ish-tp__g">${['abierta', 'selector', 'archivo'].map(ficha).join('')}</div></div>`;
  };
  // Vista previa en vivo (columna derecha): cómo verá el formulario quien se registre. Es solo de lectura.
  const chkP = (txt) => `<div class="nwt-checkbox" nwt-size="medium"><div class="nwt-checkbox__control"></div><span class="nwt-checkbox__label">${esc(txt)}</span></div>`;
  const campoP = (q) => {
    const ph = 'Tu respuesta';
    if (q.tipo === 'abierta') {
      if (q.formato === 'parrafo') return `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control ish-prev__area"><textarea class="nwt-text-field__input" rows="3" placeholder="${ph}" tabindex="-1" readonly></textarea></div></div></div></div>`;
      const tipo = q.formato === 'fecha' ? 'date' : 'text', p = q.formato === 'numero' ? '0' : q.formato === 'fecha' ? '' : ph;
      return `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><input class="nwt-text-field__input" type="${tipo}" placeholder="${p}" tabindex="-1" readonly></div></div></div></div>`;
    }
    if (q.tipo === 'selector') {
      const ops = q.opciones.filter((o) => o.trim());
      if (q.multi) return `<div class="ish-prev__chks">${(ops.length ? ops : ['Opción 1', 'Opción 2']).map(chkP).join('')}</div>`;
      return `<div class="nwt-dropdown ish-sel ish-sel--full"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-dropdown__content"><span class="ish-prev__ph">Selecciona una opción</span><div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div></div></div></div></div>`;
    }
    const tipos = q.tipos.map((v) => (ARCH.find((a) => a[0] === v) || [])[1]).filter(Boolean).join(', ') || 'Elige los tipos permitidos';
    return `<div class="ish-prev__drop"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 8.5 4 4 0 0117.5 18H7z"/><path d="M12 16v-5M9.8 12.8L12 10.6l2.2 2.2"/></svg><b>Elige un archivo o arrástralo aquí</b><small>${esc(tipos)} · Hasta ${Math.max(1, +q.mb || 5)} MB</small><span class="ish-prev__btn">Buscar archivos</span></div>`;
  };
  const previaHTML = (f) => {
    const ancho = (q) => q.tipo === 'archivo' || (q.tipo === 'abierta' && q.formato === 'parrafo') || (q.tipo === 'selector' && q.multi);
    const cuerpo = f.preguntas.length ? f.preguntas.map((q) => `<div class="ish-prev__q${ancho(q) ? ' ish-prev__q--w' : ''}"><label class="ish-prev__l${q.texto.trim() ? '' : ' ish-prev__l--vacio'}">${esc(q.texto.trim() || 'Pregunta sin título')}${q.req ? '<span class="nwt-input-box__required">*</span>' : ''}</label>${q.sub && q.sub.trim() ? `<span class="ish-prev__sub">${esc(q.sub.trim())}</span>` : ''}${campoP(q)}</div>`).join('') : '<p class="ish-vacio">Agrega preguntas y las verás aquí.</p>';
    return `<div class="ish-prev__card"><div class="ish-prev__head"><span class="ish-prev__ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/></svg></span><div><b class="ish-prev__t">${esc(f.nombre.trim() || 'Nombre del formulario')}</b><small>${esc((f.descripcion || '').trim() || 'Así lo verá quien se registre')}</small></div></div><div class="ish-prev__body" inert>${cuerpo}</div></div>`;
  };
  const pintaPrev = () => { const el = cont && cont.querySelector('[data-prev]'); if (el && S.modal) el.innerHTML = previaHTML(S.modal.f); };
  const editorHTML = () => {
    const m = S.modal, f = m.f, edita = m.modo === 'editar', titulo = edita ? 'Editar formulario' : 'Nuevo formulario';
    const add = (t) => `<button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="medium" data-addq="${t}" data-key="add-${t}"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>${TIPOS[t]}</span></button>`;
    const icv = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const vb = (v, t, d) => `<span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" data-vista="${v}" data-key="v-${v}" title="${t}" aria-label="${t}">${icv(d)}</button></span>`;
    const ctl = m.vista === 'previa' ? vb('split', 'Contraer la vista previa', '<path d="M20 9h-5V4M4 15h5v5M15 9l6-6M9 15l-6 6"/>') : vb('previa', 'Expandir la vista previa', '<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>') + vb('creador', 'Ocultar la vista previa', '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16M8 10l2 2-2 2"/>');
    return `<section class="ish-ed"><div class="ish-ed__grid ish-ed__grid--${m.vista}${m.animaVista ? ' ish-ed__grid--anima' : ''}"><div class="ish-ed__izq"><header class="ish-ed__ttl"><nav class="ish-ed__mig" aria-label="Ruta"><button type="button" class="ish-ed__vol" data-volver data-key="volver">Formularios de registro</button><span aria-hidden="true">›</span><span class="ish-ed__act">${titulo}</span></nav>` +
      `<h2 class="ish-ed__h">${edita ? 'Editar' : 'Crear'} formulario de registro</h2></header>` +
      `<div class="ish-ed__build"><div class="ish-ed__blk">${campo('Nombre del formulario', f.nombre, 'data-f="nombre" data-key="nombre" placeholder="Ej: Registro de voluntarios" maxlength="80"', true)}${er('nombre')}</div>` +
      `<div class="ish-ed__blk">${campo('Descripción (opcional)', f.descripcion || '', 'data-f="descripcion" data-key="descripcion" placeholder="Ej: Datos para acreditar a los voluntarios del evento" maxlength="200"', false)}<small class="ish-ayuda">Aparece bajo el nombre, en la vista previa y para quien se registre.</small></div>` +
      `<div class="ish-ed__blk"><div class="ish-bloque__top"><h4>Preguntas</h4></div>` +
      `<div class="ish-q-lista">${f.preguntas.length ? f.preguntas.map((q, i) => preguntaHTML(q, i, f.preguntas.length)).join('') : '<p class="ish-vacio">Aún no hay preguntas. Agrega una respuesta abierta, un selector o un archivo.</p>'}${er('preguntas')}</div>${m.panel ? tiposPanel() : `<button type="button" class="ish-add" data-abrir-panel data-key="abrir-panel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Agregar pregunta</button>`}</div></div></div>` +
      `<aside class="ish-ed__der" aria-label="Vista previa del formulario"><div class="ish-prev"><div class="ish-prev__bar"><span class="ish-prev__tag">Vista previa</span><span class="ish-prev__ctl">${ctl}</span></div><div data-prev>${previaHTML(f)}</div></div></aside>${m.vista === 'creador' ? `<button type="button" class="ish-prev__abrir" data-vista="split" data-key="v-split" aria-label="Mostrar la vista previa"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Vista previa</button>` : ''}</div>` +
      `<div class="ish-ed__bar"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="large" data-cancelar data-key="cancelar"><span class="nwt-button__content">Cancelar</span></button><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="large" data-guardar data-key="guardar"><span class="nwt-button__content">${edita ? 'Guardar cambios' : 'Crear formulario'}</span></button></div></section>`;
  };
  const msApi = {
    raiz: () => cont, redibujar: (foco) => dibujar(foco), vivo: () => !!S.modal, opciones: () => ARCH.map(([v, t]) => ({ v, t })),
    alternar: (id, v) => { const q = S.modal.f.preguntas[+id.slice(3)], i = q.tipos.indexOf(v); if (i >= 0) q.tipos.splice(i, 1); else q.tipos.push(v); },
    quitar: (id, v) => { const q = S.modal.f.preguntas[+id.slice(3)], i = q.tipos.indexOf(v); if (i >= 0) q.tipos.splice(i, 1); },
    seleccionar: (id, v) => { const q = S.modal.f.preguntas[+id.slice(3)]; if (!q.tipos.includes(v)) q.tipos.push(v); }
  };
  const reubicar = () => { if (S.modal && cont) MS.ubicar(cont, S.modal); };
  window.addEventListener('resize', reubicar); window.addEventListener('scroll', reubicar, true);
  const marca = () => cont.querySelectorAll('[data-err]').forEach((p) => { const pe = p.previousElementSibling; if (pe) { pe.classList.add('ish-inv'); const b = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (b) b.classList.add('nwt-input-box--error'); } });
  // Dibuja la vista actual: el editor si hay uno abierto y, si no, el catálogo. Conserva el scroll y el foco.
  const dibujar = (foco) => {
    if (!cont) return;
    if (!S.modal) return dibujarLista();
    const iz = cont.querySelector('.ish-ed__izq'), dr = cont.querySelector('.ish-ed__der'), y1 = iz ? iz.scrollTop : 0, y2 = dr ? dr.scrollTop : 0, f0 = foco || (document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null);
    cont.innerHTML = editorHTML(); marca();
    const iz2 = cont.querySelector('.ish-ed__izq'), dr2 = cont.querySelector('.ish-ed__der'); if (iz2) iz2.scrollTop = y1; if (dr2) dr2.scrollTop = y2;
    const e = f0 && [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === f0);
    if (e) { e.focus({ preventScroll: true }); if (e.matches('[data-ms-q]')) e.setSelectionRange(e.value.length, e.value.length); }
    MS.ubicar(cont, S.modal);
  };
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const abrir = (modo, fo) => {
    S.menu = null;
    S.modal = { modo, vista: 'split', panel: false, nuevo: null, id: fo && fo.id, ms: null, msq: '', msadd: '', anim: '', cierre: null, f: fo ? { nombre: fo.nombre, descripcion: fo.descripcion || '', preguntas: copia(fo.preguntas || []), ver: false } : { nombre: '', descripcion: '', preguntas: [], ver: false } };
    window.scrollTo(0, 0); dibujar('nombre');
  };
  const volver = (aviso) => { S.modal = null; if (aviso) S.aviso = aviso; dibujarLista(); window.scrollTo(0, 0); const b = cont.querySelector('[data-nuevo]'); if (b) b.focus(); };
  // Guardar: primero se valida; luego un pop-up pide confirmar y, al terminar, un aviso abajo a la derecha dice si salió bien o mal.
  let confEl = null, toastEl = null, toastT = null;
  const toast = (ok, titulo, texto) => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ish-toast'; toastEl.setAttribute('role', ok ? 'status' : 'alert'); document.body.append(toastEl); }
    toastEl.classList.toggle('ish-toast--err', !ok); toastEl.setAttribute('role', ok ? 'status' : 'alert');
    toastEl.innerHTML = `<b>${esc(titulo)}</b><span>${esc(texto)}</span>`; void toastEl.offsetWidth; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => { if (toastEl) toastEl.classList.remove('on'); }, 5000);
  };
  const cierraConf = () => { if (confEl) { confEl.remove(); confEl = null; } };
  const confirmaGuardar = () => {
    const m = S.modal, f = m.f, edita = m.modo === 'editar';
    if (Object.keys(errores(f)).length) { f.ver = true; m.ms = null; const er0 = errores(f); f.preguntas.forEach((q, i) => { if (Object.keys(er0).some((k) => /^q\d+[toa]$/.test(k) && +k.slice(1, -1) === i)) q.col = false; }); dibujar(); const p = cont.querySelector('[data-err]'); if (p) { const c = p.previousElementSibling && p.previousElementSibling.querySelector('input,select,[tabindex="0"]'); if (c) c.focus({ preventScroll: true }); p.scrollIntoView({ block: 'center' }); } return; }
    cierraConf();
    confEl = document.createElement('div'); confEl.id = 'ish-modal-formulario-conf';
    const titulo = edita ? 'Guardar cambios' : 'Crear formulario', texto = edita ? `¿Quieres guardar los cambios de «${f.nombre.trim()}»?` : `¿Quieres crear «${f.nombre.trim()}»? Quedará disponible para asignarlo a los operadores externos.`;
    confEl.innerHTML = `<div class="nwt-modal nwt-modal--visible ish-modal" role="alertdialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="nwt-modal__content ish-conf"><div class="ish-conf__ico ok" aria-hidden="true">?</div><h2 class="nwt-subtitle-font-bold">${titulo}</h2><p class="ish-conf__t">${esc(texto)}</p>` +
      `<div class="ish-conf__a"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="large" data-fc-cerrar><span class="nwt-button__content">Cancelar</span></button><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="large" data-fc-ok data-key="fc-ok"><span class="nwt-button__content">${edita ? 'Guardar' : 'Crear'}</span></button></div></div><div class="nwt-modal__backdrop" data-fc-cerrar></div></div>`;
    confEl.addEventListener('click', (e) => { if (e.target.closest('[data-fc-cerrar]')) cierraConf(); else if (e.target.closest('[data-fc-ok]')) { cierraConf(); guardarEditor(); } });
    confEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); cierraConf(); } });
    document.body.append(confEl); confEl.querySelector('[data-fc-ok]').focus();
  };
  const guardarEditor = () => {
    const m = S.modal, f = m.f, edita = m.modo === 'editar', nombre = f.nombre.trim();
    const l = lista(), datos = { nombre, descripcion: (f.descripcion || '').trim(), preguntas: f.preguntas.map((q) => ({ ...q, texto: q.texto.trim(), opciones: q.opciones.map((o) => o.trim()).filter(Boolean), mb: Math.max(1, +q.mb || 5) })), modificado: hoy(), modificadoPor: persona() };
    if (edita) Object.assign(l.find((x) => x.id === m.id), datos); else l.push({ id: 'f' + Date.now(), activo: true, creado: hoy(), ...datos });
    if (!guardaLista(l)) return toast(false, 'No se pudo guardar', 'El formulario no se guardó. Inténtalo de nuevo.');
    volver(); toast(true, edita ? 'Cambios guardados' : 'Formulario creado', edita ? `«${nombre}» se actualizó.` : `«${nombre}» ya está en el catálogo.`);
  };

  // ── Eventos ────────────────────────────────────────────────────────────────
  const cierraPanel = () => { const p = cont.querySelector('#ish-tp'); const ya = () => { S.modal.panel = false; dibujar('abrir-panel'); }; if (p && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { p.classList.add('cierra'); setTimeout(ya, 150); } else ya(); };
  const mueve = (i, d) => { const p = S.modal.f.preguntas, j = i + d; if (j < 0 || j >= p.length) return false; [p[i], p[j]] = [p[j], p[i]]; return true; };
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if (S.modal) {
      const f = S.modal.f;
      if (MS.click(e, S.modal, msApi)) return;
      if (S.modal.ms && !q('.ish-ms')) { S.modal.ms = null; S.modal.msq = ''; dibujar(); }
      if ((b = q('[data-vista]'))) { S.modal.vista = b.dataset.vista; S.modal.ms = null; S.modal.animaVista = true; setTimeout(() => { if (S.modal) S.modal.animaVista = false; }, 400); dibujar('v-' + (b.dataset.vista === 'split' ? 'previa' : b.dataset.vista === 'previa' ? 'split' : 'split')); window.scrollTo(0, 0); return; }
      if (q('[data-volver]') || q('[data-cancelar]')) return volver();
      if (q('[data-guardar]')) return confirmaGuardar();
      if (q('[data-abrir-panel]')) { S.modal.panel = true; return dibujar('add-abierta'); }
      if (q('[data-cerrar-panel]')) return cierraPanel();
      if ((b = q('[data-addq]'))) { const nq = nuevaQ(b.dataset.addq); f.preguntas.push(nq); S.modal.panel = false; S.modal.nuevo = nq.uid; dibujar(`q-${f.preguntas.length - 1}-t`); S.modal.nuevo = null; const el = cont.querySelector(`[data-key="q-${f.preguntas.length - 1}-t"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if ((b = q('[data-delq]'))) { const idx = +b.dataset.delq, fila = b.closest('[data-fila]'); if (fila && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { fila.classList.add('sale'); setTimeout(() => { f.preguntas.splice(idx, 1); dibujar('abrir-panel'); }, 180); return; } f.preguntas.splice(idx, 1); return dibujar('abrir-panel'); }
      if ((b = q('[data-up]'))) { const i = +b.dataset.up; return mueve(i, -1) && dibujar(`q-${i - 1}-t`); }
      if ((b = q('[data-down]'))) { const i = +b.dataset.down; return mueve(i, 1) && dibujar(`q-${i + 1}-t`); }
      if ((b = q('[data-addopt]'))) { const i = +b.dataset.addopt; f.preguntas[i].opciones.push(''); return dibujar(`o-${i}-${f.preguntas[i].opciones.length - 1}`); }
      if ((b = q('[data-delopt]'))) { const [i, j] = b.dataset.delopt.split('|').map(Number); f.preguntas[i].opciones.splice(j, 1); return dibujar(`ao-${i}`); }
      if ((b = q('[data-col]'))) { const i = +b.dataset.col; f.preguntas[i].col = !f.preguntas[i].col; return dibujar(`q-${i}-c`); }
      if ((b = q('[data-req]'))) { const i = +b.dataset.req; f.preguntas[i].req = !f.preguntas[i].req; return dibujar(`q-${i}-r`); }
      return;
    }
    if ((b = q('[data-pag]'))) { S.pag += b.dataset.pag === 'next' ? 1 : -1; return dibujar(); }
    if (q('[data-limpiar]')) { S.q = ''; S.estado = 'todos'; S.pag = 1; return dibujar(); }
    if (q('[data-nuevo]')) return abrir('crear');
    if ((b = q('[data-menu]'))) { const id = b.dataset.menu, cerrando = S.menu === id; S.menu = cerrando ? null : id; dibujar(); return; }
    if ((b = q('[data-editar]'))) return abrir('editar', lista().find((x) => x.id === b.dataset.editar));
    if ((b = q('[data-duplicar]'))) { const l = lista(), o = l.find((x) => x.id === b.dataset.duplicar); l.push({ ...copia(o), id: 'f' + Date.now(), nombre: 'Copia de ' + o.nombre, activo: true, creado: hoy(), modificado: hoy(), modificadoPor: persona() }); guardaLista(l); S.menu = null; S.aviso = 'Formulario duplicado'; return dibujar(); }
    if ((b = q('[data-estado]'))) { const l = lista(), o = l.find((x) => x.id === b.dataset.estado); o.activo = o.activo === false; o.modificado = hoy(); o.modificadoPor = persona(); guardaLista(l); S.menu = null; S.aviso = o.activo ? 'Formulario activo' : 'Formulario inactivo'; return dibujar(); }
    if (S.menu != null && !q('.ish-menu')) { S.menu = null; dibujar(); }
  };
  // Al corregir un campo se quita su aviso sin redibujar (no pierde el foco).
  const refrescaErr = () => { const m = S.modal; if (!m || !m.f.ver) return; const er0 = errores(m.f); cont.querySelectorAll('[data-err]').forEach((p) => { if (!er0[p.dataset.err]) { const pe = p.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const b = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (b) b.classList.remove('nwt-input-box--error'); } p.remove(); } }); };
  const onInput = (e) => {
    const t = e.target;
    if (!S.modal) { if (t.matches('[data-buscar]')) { S.q = t.value; S.pag = 1; dibujar(); } return; }
    if (MS.entrada(e, S.modal, msApi)) return;
    const f = S.modal.f;
    if (t.matches('[data-f="nombre"]')) f.nombre = t.value;
    else if (t.matches('[data-f="descripcion"]')) f.descripcion = t.value;
    else if (t.dataset.q) { const [i, c] = t.dataset.q.split('|'), q = f.preguntas[+i]; q[c] = c === 'multi' ? t.value === '1' : t.value; }
    else if (t.dataset.o) { const [i, j] = t.dataset.o.split('|').map(Number); f.preguntas[i].opciones[j] = t.value; }
    refrescaErr(); pintaPrev();
  };
  const onKey = (e) => {
    if (S.modal) {
      if (MS.tecla(e, S.modal, msApi)) return;
      if (e.key === 'Escape' && S.modal.panel) { e.preventDefault(); return cierraPanel(); }
      if (e.target.matches && e.target.matches('[role=option],[role=combobox],[role=switch]') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.target.click(); }
      return;
    }
    if (e.key === 'Escape' && S.menu != null) { S.menu = null; dibujar(); }
    else if (e.target.matches && e.target.matches('[role=switch]') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.target.click(); }
  };

  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.formularios = {
    render(el) {
      cont = el; S.aviso = ''; S.menu = null; S.modal = null;
      if (!cont.__ligadoF) {
        const mia = (f) => (e) => { if (cont && cont.dataset.id === 'formularios') f(e); };
        cont.addEventListener('click', mia(onClick)); cont.addEventListener('input', mia(onInput)); cont.addEventListener('keydown', mia(onKey));
        cont.addEventListener('change', mia((e) => { if (e.target.matches('[data-fest]')) { S.estado = e.target.value; S.pag = 1; dibujar(); } }));
        cont.__ligadoF = true;
      }
      dibujar();
    }
  };
})();
