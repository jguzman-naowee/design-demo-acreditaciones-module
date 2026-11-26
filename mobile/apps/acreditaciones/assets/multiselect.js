// Multiselector compartido de las pantallas propias (Usuarios, Permisos de acceso).
// Referencia: «Cobertura territorial» de Incentivos + el dropdown con casillas del SDK (nwt-dropdown__list / __option / __option-checkbox).
//  · campo con fichas de borde de acento y ×; si hay muchas se ven pocas y una ficha «+N» con el resto;
//  · lista desplegable con buscador (sin tildes), «Seleccionar todos» opcional y, si se pide (`crear`), un pie para ESCRIBIR y «Agregar» valores nuevos;
//  · la lista FLOTA sobre el contenido (position:fixed), no lo desplaza, se abre hacia arriba si abajo no cabe y su scroll llega al final.
// El estado (qué lista está abierta, la búsqueda, la animación pendiente) lo guarda quien lo usa en un objeto `st`
// ({ ms, msq, anim, cierre }); la pantalla le pasa un `api` { raiz, redibujar, vivo, alternar, quitar, opciones, seleccionar?, crear? }.
(() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MAX = 2; // fichas visibles antes del «+N»
  const X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const LUPA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  const sinMovimiento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // c: { id, etiqueta, req, ph, opciones:[{v,t}], sel:[v], conTodos, todosTxt, todasTxt, busca, crear, agregaPh }
  const html = (st, c) => {
    const abierto = st.ms === c.id, lbl = 'ms-lbl-' + c.id.replace(/\W/g, '_'), sel = c.sel || [], ops = c.opciones || [];
    const nom = (v) => (ops.find((o) => o.v === v) || {}).t || v;
    const ficha = (t, quitar) => `<span class="ish-ficha">${esc(t)}<button type="button" class="ish-ficha__x" data-ms-quitar="${esc(c.id)}|${esc(quitar)}" aria-label="Quitar ${esc(t)}">${X}</button></span>`;
    const todas = !!c.todasTxt && ops.length > 0 && sel.length === ops.length;
    let vals;
    if (!sel.length) vals = `<span class="ish-ms__ph">${esc(c.ph || '')}</span>`;
    else if (todas) vals = ficha(c.todasTxt, '__todos');
    else {
      const mas = sel.length > MAX ? `<span class="ish-ficha ish-ficha--mas" title="${esc(sel.slice(MAX).map(nom).join(', '))}" aria-label="y ${sel.length - MAX} más">+${sel.length - MAX}</span>` : '';
      vals = sel.slice(0, MAX).map((v) => ficha(nom(v), v)).join('') + mas;
    }
    const op = (v, t, on) => `<li role="option" aria-selected="${on}" tabindex="0" class="nwt-dropdown__option${on ? ' nwt-dropdown__option--selected' : ''}" data-opt="${esc(c.id)}|${esc(v)}" data-key="o-${esc(c.id)}-${esc(v)}">` +
      `<span class="nwt-dropdown__option-checkbox${on ? ' nwt-dropdown__option-checkbox--selected' : ''}" aria-hidden="true">${on ? '<div class="nwt-icon"><i class="naotech-icon-positive"></i></div>' : ''}</span><span>${esc(t)}</span></li>`;
    let lista = '';
    if (abierto) {
      const q = (st.msq || '').trim(), qs = sinTildes(q), vis = ops.filter((o) => !qs || sinTildes(o.t).includes(qs));
      const ap = c.agregaPh || 'Agregar otro (nombre)', hay = !!(st.msadd && st.msadd.trim());
      const pie = c.crear ? `<div class="ish-ms__add"><input type="text" class="ish-ms__addin" data-ms-add data-key="msadd" maxlength="40" placeholder="${esc(ap)}" aria-label="${esc(ap)}" autocomplete="off" value="${esc(st.msadd || '')}">` +
        `<button type="button" class="nwt-button ish-ms__addbtn" nwt-variant="quiet" nwt-size="medium" data-ms-agregar="${esc(c.id)}" data-key="msagregar" ${hay ? '' : 'disabled'}><span class="nwt-button__content"><div class="nwt-icon nwt-button__icon"><i class="naotech-icon-add"></i></div>Agregar</span></button></div>` : '';
      const ph = c.busca || 'Buscar';
      lista = `<div class="ish-ms__list nwt-dropdown__list"><div class="ish-ms__q">${LUPA}<input type="text" class="ish-ms__qin" data-ms-q data-key="msq" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off" value="${esc(st.msq || '')}"></div>` +
        `<ul role="listbox" aria-multiselectable="true" aria-labelledby="${lbl}" class="nwt-dropdown__options ish-ms__ul">${c.conTodos && !qs ? op('__todos', c.todosTxt || 'Seleccionar todos', ops.length > 0 && sel.length === ops.length) : ''}${vis.map((o) => op(o.v, o.t, sel.includes(o.v))).join('')}${vis.length ? '' : '<li class="nwt-dropdown__option nwt-dropdown__option--empty ish-ms__vacio"><span>Sin resultados</span></li>'}</ul>${pie}</div>`;
    }
    return `<div class="ish-ms${abierto ? ' open' : ''}" data-msid="${esc(c.id)}"><label class="nwt-input-box__label" id="${lbl}">${esc(c.etiqueta)}${c.req ? '<span class="nwt-input-box__required">*</span>' : ''}</label>` +
      `<div class="ish-ms__ctl" role="combobox" tabindex="0" aria-haspopup="listbox" aria-expanded="${abierto}" aria-labelledby="${lbl}" data-ms="${esc(c.id)}" data-key="ms-${esc(c.id)}"><div class="ish-ms__vals">${vals}</div>` +
      `<div class="nwt-dropdown__chevron" aria-hidden="true"><div class="nwt-icon"><i class="naotech-icon-chevron-down"></i></div></div></div>${lista}</div>`;
  };

  // Posición de la lista: junto a su campo, del mismo ancho, hacia abajo o arriba según el espacio, con scroll interno hasta el final.
  // El contenido del modal tiene transform, así que «fixed» se mide contra él; se corrige con lo medido.
  const ubicar = (raiz, st) => {
    if (!raiz || !st || !st.ms) return;
    const l = raiz.querySelector('.ish-ms__list'), c = raiz.querySelector('.ish-ms.open .ish-ms__ctl'), k = raiz.querySelector('.nwt-modal__content') || { getBoundingClientRect: () => ({ top: 0, bottom: window.innerHeight }) }; // sin modal (vista de página): se mide contra la ventana
    if (!l || !c || !k) return;
    const r = c.getBoundingClientRect(), vh = window.innerHeight, ul = l.querySelector('.ish-ms__ul'), q = l.querySelector('.ish-ms__q'), pie = l.querySelector('.ish-ms__add');
    const kr = k.getBoundingClientRect(), limInf = Math.min(vh - 12, kr.bottom - 14), limSup = Math.max(12, kr.top + 14);
    const abajo = limInf - r.bottom, arriba = r.top - limSup, sube = abajo < 240 && arriba > abajo;
    const alto = Math.max(160, Math.min(340, sube ? arriba : abajo));
    const primera = !l.dataset.pos; if (primera) l.style.animation = 'none'; // medir sin la transformación de la animación
    l.style.position = 'fixed'; l.style.width = r.width + 'px'; l.style.left = '0px'; l.style.top = '0px';
    if (ul) ul.style.maxHeight = Math.max(80, alto - (q ? q.offsetHeight : 0) - (pie ? pie.offsetHeight : 0) - 14) + 'px';
    const h = l.offsetHeight, p0 = l.getBoundingClientRect(), quiereTop = sube ? r.top - h - 4 : r.bottom + 4;
    l.style.left = (r.left - p0.left) + 'px'; l.style.top = (quiereTop - p0.top) + 'px';
    if (primera) { l.dataset.pos = '1'; void l.offsetWidth; l.style.animation = ''; }
  };

  // Cierra la lista con una salida corta; cualquier otro redibujado cancela el cierre pendiente.
  const cerrar = (st, api, id) => {
    const raiz = api.raiz(), l = raiz && raiz.querySelector('.ish-ms__list');
    if (!l || sinMovimiento()) { st.ms = null; st.msq = ''; st.msadd = ''; return api.redibujar('ms-' + id); }
    if (st.cierre) return;
    const mio = (st.cierre = {}); l.classList.add('ish-saliendo');
    setTimeout(() => { if (api.vivo() && st.cierre === mio) { st.ms = null; st.msq = ''; st.msadd = ''; api.redibujar('ms-' + id); } }, 130);
  };

  const partir = (v) => { const k = v.indexOf('|'); return [v.slice(0, k), v.slice(k + 1)]; };
  // Clic dentro del componente. Devuelve true si lo atendió.
  const click = (e, st, api) => {
    const q = (s) => e.target.closest(s); let b;
    if ((b = q('[data-ms-quitar]'))) { const [id, v] = partir(b.dataset.msQuitar); if (v === '__todos') api.alternar(id, '__todos'); else api.quitar(id, v); api.redibujar('ms-' + id); return true; }
    if ((b = q('[data-ms-agregar]'))) { const id = b.dataset.msAgregar, txt = (st.msadd || '').trim(); if (txt) { api.crear(id, txt); st.msadd = ''; api.redibujar('msadd'); } return true; }
    if ((b = q('[data-opt]'))) { const [id, v] = partir(b.dataset.opt); api.alternar(id, v); api.redibujar('o-' + id + '-' + v); return true; }
    if ((b = q('[data-ms]'))) { const id = b.dataset.ms; if (st.ms === id) { cerrar(st, api, id); return true; } st.ms = id; st.msq = ''; st.msadd = ''; st.anim = 'ms'; api.redibujar('msq'); return true; }
    return false;
  };
  // Escribir en el buscador.
  const entrada = (e, st, api) => {
    const t = e.target; if (!t.matches) return false;
    if (t.matches('[data-ms-add]')) { st.msadd = t.value; const b = t.closest('.ish-ms__add').querySelector('[data-ms-agregar]'); if (b) b.disabled = !t.value.trim(); return true; } // sin redibujar: no se pierde el foco
    if (!t.matches('[data-ms-q]')) return false;
    st.msq = t.value; api.redibujar('msq'); return true;
  };
  // Teclado: Esc cierra la lista (sin cerrar el modal); Enter en el buscador elige la coincidencia o crea el valor; ↓ abre desde el campo.
  const tecla = (e, st, api) => {
    const t = e.target;
    if (e.key === 'Escape' && st.ms) { e.stopPropagation(); cerrar(st, api, st.ms); return true; }
    if (e.key === 'Enter' && t.matches && t.matches('[data-ms-add]')) {
      e.preventDefault(); const id = t.closest('.ish-ms').dataset.msid, txt = t.value.trim();
      if (txt) { api.crear(id, txt); st.msadd = ''; api.redibujar('msadd'); }
      return true;
    }
    if (e.key === 'Enter' && t.matches && t.matches('[data-ms-q]')) {
      e.preventDefault();
      const id = t.closest('.ish-ms').dataset.msid, txt = t.value.trim(); if (!txt) return true;
      const ops = api.opciones(id), qs = sinTildes(txt), exacta = ops.find((o) => sinTildes(o.t) === qs), vis = ops.filter((o) => sinTildes(o.t).includes(qs));
      const elegir = (v) => (api.seleccionar ? api.seleccionar(id, v) : api.alternar(id, v)); // Enter elige, nunca desmarca
      if (exacta) elegir(exacta.v); else if (vis.length === 1) elegir(vis[0].v); else return true;
      st.msq = ''; api.redibujar('msq'); return true;
    }
    if (e.key === 'ArrowDown' && t.matches && t.matches('[role=combobox]') && st.ms !== t.dataset.ms) { e.preventDefault(); t.click(); return true; }
    return false;
  };

  window.ACRED_MS = { html, ubicar, cerrar, click, entrada, tecla, sinTildes };
})();
