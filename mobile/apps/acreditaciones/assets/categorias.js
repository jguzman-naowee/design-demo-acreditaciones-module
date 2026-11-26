// Pantalla propia «Categorías» (Parametrización, Gestor). Una categoría es la organización a la que pertenece un tipo de acreditado
// (Comité Organizador, Ministerio del Deporte…) y es la franja con siglas de color al pie de la acreditación (ej. «COJNJ»).
// Así puede haber varios «Staff» de categorías distintas. Se elige al crear el tipo de acreditado en «Tipos de acreditados».
// Guarda en localStorage (`naowee.acreditaciones.categorias`); `window.ACRED_CATS` lo comparte con tipos.js.
(() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const UI = () => window.ACRED_DATOS;
  const KEY = 'naowee.acreditaciones.categorias';
  const COLORES = [['#d9532b', 'Naranja'], ['#1f4e9c', 'Azul'], ['#2f8a4a', 'Verde'], ['#7a3fb0', 'Morado'], ['#c2185b', 'Rosa'], ['#4a4f6a', 'Gris']];
  // Nombres de color en español → código hex (se puede escribir «azul» o un código).
  const NOMBRES = { rojo: '#d32f2f', vinotinto: '#7a1f2e', naranja: '#d9532b', amarillo: '#f2b705', dorado: '#c9a227', verde: '#2f8a4a', turquesa: '#1aa6a6', celeste: '#29a8e0', azul: '#1f4e9c', morado: '#7a3fb0', violeta: '#6a3fd0', rosa: '#e91e63', fucsia: '#c2185b', cafe: '#6d4c41', marron: '#6d4c41', gris: '#4a4f6a', negro: '#1c1c28' };
  const hexDe = (txt) => { const t = sinTildes(String(txt || '')).trim(); if (NOMBRES[t]) return NOMBRES[t]; const m = t.match(/^#?([0-9a-f]{6})$/) || t.match(/^#?([0-9a-f]{3})$/); if (!m) return null; const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]; return '#' + h; };
  const nombreDeHex = (hex) => { const h = String(hex).toLowerCase(), k = Object.keys(NOMBRES).find((n) => NOMBRES[n] === h && n !== 'marron'); return k ? k.charAt(0).toUpperCase() + k.slice(1) : String(hex).toUpperCase(); };
  // Siglas sugeridas: la inicial de cada palabra (se omiten artículos y preposiciones: de, la, los, y…).
  const POCAS = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'por', 'con', 'a'];
  const iniciales = (nombre) => sinTildes(nombre).split(/\s+/).filter((w) => w && !POCAS.includes(w)).map((w) => w.charAt(0)).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const semilla = () => [
    { id: 'c1', siglas: 'COJNJ', nombre: 'Comité Organizador de los Juegos', color: '#d9532b', activo: true },
    { id: 'c2', siglas: 'MINDEP', nombre: 'Ministerio del Deporte', color: '#1f4e9c', activo: true },
    { id: 'c3', siglas: 'COC', nombre: 'Comité Olímpico Colombiano', color: '#2f8a4a', activo: true }
  ];
  const lista = () => { try { let l = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!l) { l = semilla(); localStorage.setItem(KEY, JSON.stringify(l)); } return l; } catch (x) { return semilla(); } };
  const guarda = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch (x) { return false; } };
  window.ACRED_CATS = { lista, activas: () => lista().filter((c) => c.activo !== false), porSiglas: (s) => lista().find((c) => c.siglas === s) };

  const S = { q: '', estado: 'todos', pag: 1, menu: null, modal: null, aviso: '' };
  let cont = null, modalEl = null, opener = null, tAv = null;
  const usos = (c) => { const e = window.__ACRED_ESTADO__; return e && e.roles ? e.roles.filter((r) => r.acred_categoria === c.siglas).length : 0; };
  const pill = (c) => `<span class="ish-catp" style="background:${esc(c.color)}">${esc(c.siglas)}</span>`;

  // ── Listado ────────────────────────────────────────────────────────────────
  const filtrados = () => { const q = sinTildes(S.q.trim()); return lista().filter((c) => (S.estado === 'todos' || (S.estado === 'activo') === (c.activo !== false)) && (!q || sinTildes(c.nombre + ' ' + c.siglas).includes(q))); };
  const filaHTML = (c) => {
    const act = c.activo !== false, ab = S.menu === c.id, ICO = UI().ICO, n = usos(c);
    return `<tr class="nwt-datatable__record"><td class="nwt-datatable__cell nwt-width-xs-15">${pill(c)}</td><td class="nwt-datatable__cell nwt-width-xs-35"><span class="nwt-text-font-medium">${esc(c.nombre)}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-20"><span>${n ? `${n} ${n === 1 ? 'tipo' : 'tipos'}` : '—'}</span></td>` +
      `<td class="nwt-datatable__cell nwt-width-xs-15 ish-c"><span class="nwt-badge nwt-badge--vignette" role="status" nwt-theme="${act ? 'positive' : 'neutral'}" nwt-size="medium" nwt-variant="quiet"><div class="nwt-badge__content"><div class="nwt-badge__label">${act ? 'Activa' : 'Inactiva'}</div></div></span></td>` +
      `<td class="nwt-datatable__cell nwt-datatable__cell--actions nwt-align-right ish-acc"><span class="nwt-icon-button" nwt-variant="mute" nwt-size="medium"><button type="button" class="nwt-icon-button__content" aria-label="Acciones de ${esc(c.nombre)}" aria-haspopup="menu" aria-expanded="${ab}" data-menu="${esc(c.id)}" data-key="m-${esc(c.id)}"><div class="nwt-icon"><i class="naotech-icon-overflow-menu-vertical"></i></div></button></span>` +
      (ab ? `<div class="ish-menu" role="menu"><button type="button" role="menuitem" data-editar="${esc(c.id)}" data-key="ed-${esc(c.id)}">${ICO.editar}<span>Editar</span></button><button type="button" role="menuitem" data-estado="${esc(c.id)}">${act ? ICO.inactivar : ICO.activar}<span>${act ? 'Inactivar' : 'Activar'}</span></button></div>` : '') + `</td></tr>`;
  };
  const dibujar = () => {
    if (!cont) return;
    clearTimeout(tAv); if (S.aviso) tAv = setTimeout(() => { S.aviso = ''; const e = cont && cont.querySelector('.ish-guardado'); if (e) e.textContent = ''; }, 4000);
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const TAM = UI().TAM, todos = filtrados(), pags = Math.max(1, Math.ceil(todos.length / TAM)); if (S.pag > pags) S.pag = pags;
    const l = todos.slice((S.pag - 1) * TAM, S.pag * TAM);
    const cuerpo = l.length
      ? `<div class="nwt-datatable"><div class="nwt-datatable__table"><table><thead class="nwt-datatable__head"><tr class="nwt-datatable__header"><th class="nwt-datatable__title nwt-width-xs-15">Siglas</th><th class="nwt-datatable__title nwt-width-xs-35">Nombre de la categoría</th><th class="nwt-datatable__title nwt-width-xs-20">Usada por</th><th class="nwt-datatable__title nwt-width-xs-15 ish-c">Estado</th><th class="nwt-datatable__title nwt-width-xs-15"></th></tr></thead>` +
        `<tbody class="nwt-datatable__body">${l.map(filaHTML).join('')}</tbody></table></div></div>${UI().paginador(S.pag, pags)}`
      : UI().vacioHTML(!!(S.q || S.estado !== 'todos'), 'Aún no hay categorías. Crea la primera.', 'Ninguna categoría coincide con la búsqueda.');
    cont.innerHTML =
      `<section class="nws-access-permissions ish-perms"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">Categorías</span>` +
      `<small class="nwt-smalltext-font-regular">La organización a la que pertenece un tipo de acreditado. Sus siglas van en la franja de color de la acreditación.</small></div>` +
      `<div class="nws-access-permissions__actions"><span class="ish-guardado" role="status" aria-live="polite">${esc(S.aviso)}</span><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="medium" data-nuevo data-key="nuevo"><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>Agregar categoría</span></button></div></div>` +
      `<div class="nwt-card nws-access-permissions__catalog" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `<div class="ish-filtros"><div class="ish-busca"><div class="nwt-searchbox"><div class="nwt-input-box"><div class="nwt-input-box__content"><div class="nwt-input-box__control"><div class="nwt-searchbox__container"><div class="nwt-icon"><i class="naotech-icon-search"></i></div>` +
      `<input class="nwt-searchbox__input" placeholder="Buscar por nombre o siglas" type="text" value="${esc(S.q)}" data-buscar data-key="buscar" aria-label="Buscar categorías"></div></div></div></div></div></div>${UI().filtroEstado(S.estado)}</div>${cuerpo}</div></div></div></section>`;
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) { e.focus(); if (e.matches('[data-buscar]')) e.setSelectionRange(e.value.length, e.value.length); } }
    UI().ubicarMenu(cont, () => { if (S.menu != null) { S.menu = null; dibujar(); } });
  };

  // ── Modal ──────────────────────────────────────────────────────────────────
  const vacio = () => ({ nombre: '', siglas: '', siglasManual: false, color: COLORES[0][0], colorTxt: nombreDeHex(COLORES[0][0]), ver: false });
  const errores = (f) => {
    const e = {}, sg = f.siglas.trim().toUpperCase();
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre de la categoría.';
    if (!sg) e.siglas = 'Escribe las siglas.';
    else if (!/^[A-Z0-9]{2,8}$/.test(sg)) e.siglas = 'Usa de 2 a 8 letras o números, sin espacios.';
    else { const otra = lista().find((c) => c.id !== (S.modal && S.modal.id) && c.siglas === sg); if (otra) e.siglas = `Las siglas «${sg}» ya las usa «${otra.nombre}».`; }
    if (f.colorTxt.trim() && !hexDe(f.colorTxt)) e.color = 'No reconozco ese color: escribe uno como «azul» o un código como #1F4E9C, o elígelo en la barra.';
    return e;
  };
  const er = (k) => { const m = S.modal && S.modal.f.ver && errores(S.modal.f)[k]; return m ? `<p class="ish-err" role="alert" data-err="${k}">${esc(m)}</p>` : ''; };
  const campo = (rotulo, valor, attrs, req) => `<div class="nwt-text-field"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}${req ? '<span class="nwt-input-box__required">*</span>' : ''}</label><div class="nwt-input-box__control"><input class="nwt-text-field__input" type="text" value="${esc(valor)}" ${attrs} autocomplete="off"></div></div></div></div>`;
  const modalHTML = () => {
    const m = S.modal, f = m.f, edita = m.modo === 'editar', titulo = edita ? 'Editar categoría' : 'Nueva categoría', sg = f.siglas.trim().toUpperCase() || 'SIGLAS';
    return `<div class="nwt-modal nwt-modal--visible nws-accreditations-module nws-access-permission-modal ish-modal ish-modal--ancho" role="dialog" aria-modal="true" aria-label="${titulo}"><div class="nwt-modal__content"><div class="nwt-modal__header"><div class="nwt-modal__header__description"><span class="ish-modal__t">${titulo}</span><span class="ish-modal__sub">Sus siglas salen en la franja de color de la acreditación.</span></div>` +
      `<span class="nwt-modal__close" role="button" tabindex="0" aria-label="Cerrar" data-cerrar><div class="nwt-icon"><i class="naotech-icon-close"></i></div></span></div><div class="nwt-modal__component"><div class="nws-access-permission-modal__body"><div class="naotech-grid naotech-grid--4">` +
      `<div class="naotech-col--3">${campo('Nombre de la categoría', f.nombre, 'data-f="nombre" data-key="nombre" placeholder="Ej: Comité Organizador de los Juegos" maxlength="80"', true)}${er('nombre')}</div>` +
      `<div class="naotech-col--1">${campo('Siglas', f.siglas, 'data-f="siglas" data-key="siglas" placeholder="Ej: COJNJ" maxlength="8" style="text-transform:uppercase"', true)}${er('siglas')}</div>` +
      `<div class="naotech-col--4"><div class="ish-color-fila"><div>${campo('Color de la franja', f.colorTxt, 'data-f="colorTxt" data-key="colorTxt" placeholder="Ej: azul, rojo o #1F4E9C"', true)}${er('color')}</div>` +
      `<label class="ish-colorbar" title="Elegir el color en la barra"><span class="ish-rueda" aria-hidden="true"></span><input type="color" value="${esc(f.color)}" data-colorpick data-key="colorpick" aria-label="Elegir el color en la barra de color"><span class="ish-hex" data-hex>${esc(f.color.toUpperCase())}</span></label></div></div>` +
      `<div class="naotech-col--4"><span class="ish-q-rot">Así se verá</span><div class="ish-cat-franja" style="background:${esc(f.color)}">${esc(sg)}</div></div>` +
      `</div></div><footer class="nws-access-permission-modal__footer ish-modal__footer"><button type="button" class="nwt-button" nwt-variant="quiet" nwt-size="large" data-cerrar><span class="nwt-button__content">Cancelar</span></button><button type="button" class="nwt-button" nwt-variant="loud" nwt-size="large" data-guardar><span class="nwt-button__content">${edita ? 'Guardar cambios' : 'Crear categoría'}</span></button></footer></div></div><div class="nwt-modal__backdrop" data-cerrar></div></div>`;
  };
  const montar = (foco) => {
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div'); modalEl.id = 'ish-modal-categoria'; modalEl.innerHTML = modalHTML();
    modalEl.querySelectorAll('[data-err]').forEach((p) => { const pe = p.previousElementSibling; if (pe) { pe.classList.add('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.add('nwt-input-box--error'); } });
    document.body.append(modalEl);
    const e = foco && [...modalEl.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); (e || modalEl.querySelector('input')).focus();
  };
  const abrir = (modo, c) => { opener = document.activeElement; S.menu = null; S.modal = { modo, id: c && c.id, f: c ? { nombre: c.nombre, siglas: c.siglas, siglasManual: true, color: c.color, colorTxt: nombreDeHex(c.color), ver: false } : vacio() }; dibujar(); montar('nombre'); };
  const cerrar = () => { if (modalEl) { modalEl.remove(); modalEl = null; } S.modal = null; if (opener && document.contains(opener)) opener.focus(); };
  const guardar = () => {
    const m = S.modal, f = m.f;
    if (Object.keys(errores(f)).length) { f.ver = true; montar(); const p = modalEl.querySelector('[data-err]'); if (p) { const c = p.previousElementSibling && p.previousElementSibling.querySelector('input'); if (c) c.focus(); } return; }
    const l = lista(), sg = f.siglas.trim().toUpperCase(), datos = { siglas: sg, nombre: f.nombre.trim(), color: f.color };
    if (m.modo === 'editar') {
      const c = l.find((x) => x.id === m.id), antes = c.siglas;
      // Si cambian las siglas, los tipos que ya la usan la siguen.
      if (antes !== sg && window.__ACRED_ESTADO__) { window.__ACRED_ESTADO__.roles.forEach((r) => { if (r.acred_categoria === antes) r.acred_categoria = sg; }); try { window.__ACRED_PERSISTIR__ && window.__ACRED_PERSISTIR__(); } catch (x) {} }
      Object.assign(c, datos);
    } else l.push({ id: 'c' + Date.now(), activo: true, ...datos });
    if (!guarda(l)) { f.error = 'No se pudo guardar.'; return; }
    S.aviso = m.modo === 'editar' ? 'Cambios guardados' : 'Categoría creada'; opener = null; cerrar(); dibujar();
  };

  // ── Eventos ────────────────────────────────────────────────────────────────
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s); let b;
    if ((b = q('[data-pag]'))) { S.pag += b.dataset.pag === 'next' ? 1 : -1; return dibujar(); }
    if (q('[data-limpiar]')) { S.q = ''; S.estado = 'todos'; S.pag = 1; return dibujar(); }
    if (q('[data-nuevo]')) return abrir('crear');
    if ((b = q('[data-menu]'))) { const id = b.dataset.menu, cerrando = S.menu === id; S.menu = cerrando ? null : id; return dibujar(); }
    if ((b = q('[data-editar]'))) return abrir('editar', lista().find((x) => x.id === b.dataset.editar));
    if ((b = q('[data-estado]'))) { const l = lista(), c = l.find((x) => x.id === b.dataset.estado); c.activo = c.activo === false; guarda(l); S.menu = null; S.aviso = c.activo ? 'Categoría activa' : 'Categoría inactiva'; return dibujar(); }
    if (S.menu != null && !q('.ish-menu')) { S.menu = null; dibujar(); }
  };
  document.addEventListener('click', (e) => {
    if (!modalEl || !modalEl.contains(e.target)) return;
    const q = (s) => e.target.closest(s); let b;
    if (q('[data-cerrar]')) return cerrar();
    if (q('[data-guardar]')) return guardar();
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (modalEl && modalEl.contains(t) && S.modal && (t.dataset.f || t.matches('[data-colorpick]'))) {
      const f = S.modal.f, q = (sel) => modalEl.querySelector(sel);
      const franja = () => { const fr = q('.ish-cat-franja'); if (fr) { fr.style.background = f.color; fr.textContent = f.siglas.trim().toUpperCase() || 'SIGLAS'; } };
      if (t.matches('[data-colorpick]')) { f.color = t.value; f.colorTxt = nombreDeHex(t.value); const tx = q('[data-f="colorTxt"]'); if (tx) tx.value = f.colorTxt; const hx = q('[data-hex]'); if (hx) hx.textContent = t.value.toUpperCase(); franja(); }
      else {
        f[t.dataset.f] = t.value;
        if (t.dataset.f === 'nombre' && !f.siglasManual) { f.siglas = iniciales(t.value); const sg = q('[data-f="siglas"]'); if (sg) sg.value = f.siglas; }
        if (t.dataset.f === 'siglas') f.siglasManual = !!t.value.trim(); // al editarlas, quedan como las dejó; si las borra, vuelve a sugerir
        if (t.dataset.f === 'colorTxt') { const h = hexDe(t.value); if (h) { f.color = h; const cp = q('[data-colorpick]'); if (cp) cp.value = h; const hx = q('[data-hex]'); if (hx) hx.textContent = h.toUpperCase(); } }
        franja();
      }
      if (f.ver || t.dataset.f === 'colorTxt') { const er0 = errores(f); if (!er0.color && t.dataset.f === 'colorTxt') { const p0 = modalEl.querySelector('[data-err="color"]'); if (p0) { const pe = p0.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.remove('nwt-input-box--error'); } p0.remove(); } } if (f.ver) modalEl.querySelectorAll('[data-err]').forEach((p) => { if (!er0[p.dataset.err]) { const pe = p.previousElementSibling; if (pe) { pe.classList.remove('ish-inv'); const ib = pe.matches('.nwt-input-box') ? pe : pe.querySelector('.nwt-input-box'); if (ib) ib.classList.remove('nwt-input-box--error'); } p.remove(); } }); }
    } else if (cont && cont.dataset.id === 'categorias' && cont.contains(t) && t.matches('[data-buscar]')) { S.q = t.value; S.pag = 1; dibujar(); }
  });
  document.addEventListener('keydown', (e) => {
    if (modalEl && (modalEl.contains(e.target) || e.key === 'Escape')) {
      if (e.key === 'Escape') { e.stopPropagation(); return cerrar(); }
      if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-f]')) { e.preventDefault(); return guardar(); }
      if (e.target.matches && e.target.matches('[data-cerrar][role=button]') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); cerrar(); }
      if (e.key === 'Tab') { const f = [...modalEl.querySelectorAll('button:not([disabled]),input,[tabindex="0"]')].filter((x) => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    } else if (e.key === 'Escape' && S.menu != null && cont && cont.dataset.id === 'categorias') { S.menu = null; dibujar(); }
  });

  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.categorias = {
    render(el) {
      cont = el; S.aviso = ''; S.menu = null; S.modal = null;
      if (!cont.__ligadoC) {
        const mia = (f) => (e) => { if (cont && cont.dataset.id === 'categorias') f(e); };
        cont.addEventListener('click', mia(onClick));
        cont.addEventListener('change', mia((e) => { if (e.target.matches('[data-fest]')) { S.estado = e.target.value; S.pag = 1; dibujar(); } }));
        cont.__ligadoC = true;
      }
      dibujar();
    }
  };
})();
