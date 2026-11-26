// Pantalla propia «Validación» (Parametrización): qué permisos se validan en la puerta, con qué topes y etiquetas.
// JS plano, sin compilar: lee del gateway simulado los tipos de acreditados y el catálogo de permisos (como el micro) y
// guarda las reglas en localStorage. La monta shell.js en #ish-pantalla; el micro no se toca.
//
// Del acta de la reunión del 24-nov con Danna:
//  · el permiso se crea en el catálogo; al ASIGNARLO a un tipo de acreditado se dice si «cuenta con validación»;
//  · si cuenta, se abre el tope: por NÚMERO de usos o por FECHA (rango), ninguno obligatorio;
//  · un permiso puede tener ETIQUETAS (desayuno, almuerzo…): entonces los topes van por etiqueta, y el global es opcional.
(() => {
  const KEY = 'naowee.acreditaciones.validacion';
  const GW = '/public-gateway/v1/accreditation';
  const MODOS = [['ninguno', 'Sin tope'], ['numero', 'Por número'], ['fecha', 'Por fecha']];

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (path) => new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open('GET', GW + path);
    x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { ko(e); } };
    x.onerror = () => ko(new Error('Sin conexión con el gateway'));
    x.send();
  });

  // ── Almacén ────────────────────────────────────────────────────────────────
  let D = {};
  const leer = () => { try { D = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { D = {}; } };
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  const tope0 = () => ({ modo: 'ninguno', numero: null, desde: '', hasta: '' });
  const regla = (eid, rol, pid) => {
    D.reglas = D.reglas || {}; D.reglas[eid] = D.reglas[eid] || {}; D.reglas[eid][rol] = D.reglas[eid][rol] || {};
    const r = D.reglas[eid][rol][pid] = D.reglas[eid][rol][pid] || { valida: false, global: tope0(), etiquetas: {} };
    r.global = r.global || tope0(); r.etiquetas = r.etiquetas || {};
    return r;
  };
  // Las etiquetas se crean en «Permisos de acceso» y vienen en la lista de permisos del gateway.
  const etiquetasDe = (pid) => ((S.permisos.find((p) => p.id === pid) || {}).tags || []);

  // Datos de ejemplo la primera vez: el caso que Danna dio (alimentación con etiquetas; transporte por fecha).
  const sembrar = (eid, roles, permisos) => {
    D.reglas = D.reglas || {};
    if (!D.reglas[eid]) {
      const dep = roles.find((r) => /deportista/i.test(r.nombre));
      if (dep) dep.permisos.forEach((p) => {
        const r = regla(eid, dep.code, p.id);
        if (/aliment/i.test(p.nombre)) { r.valida = true; etiquetasDe(p.id).forEach((t) => { r.etiquetas[t] = { modo: 'numero', numero: 1, desde: '', hasta: '' }; }); }
        if (/transporte/i.test(p.nombre)) { r.valida = true; r.global = { modo: 'fecha', numero: null, desde: '2026-09-01', hasta: '2026-09-07' }; }
      });
      D.reglas[eid] = D.reglas[eid] || {};
    }
    guardar();
  };

  // ── Vista ──────────────────────────────────────────────────────────────────
  const S = { rol: null, roles: [], permisos: [], eid: 7, cargando: true, error: '', guardado: '', avisos: {} };
  let cont = null;

  const fecha = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—');
  const resumen = (t) => (t.modo === 'numero' ? (t.numero ? `${t.numero} ${t.numero === 1 ? 'uso' : 'usos'}` : 'Sin número') : t.modo === 'fecha' ? `${fecha(t.desde)} → ${fecha(t.hasta)}` : 'Sin tope');

  const campo = (rotulo, tipo, valor, attrs, extra) =>
    `<div class="nwt-text-field ish-campo" nwt-size="medium"><div class="nwt-input-box"><div class="nwt-input-box__content"><label class="nwt-input-box__label">${rotulo}</label>` +
    `<div class="nwt-input-box__control"><input class="nwt-text-field__input" type="${tipo}" value="${esc(valor)}" ${attrs}${extra || ''}></div></div></div></div>`;

  const topeHTML = (pid, ambito, t, key) => {
    const a = `data-pid="${pid}" data-ambito="${esc(ambito)}"`;
    const seg = MODOS.map(([m, n]) => `<button type="button" role="radio" aria-checked="${t.modo === m}" class="ish-seg__b${t.modo === m ? ' on' : ''}" data-modo="${m}" ${a} data-key="${key}-${m}">${n}</button>`).join('');
    let campos = '';
    if (t.modo === 'numero') campos = campo('Usos máximos por persona', 'number', t.numero == null ? '' : t.numero, `${a} data-campo="numero" data-key="${key}-n" min="1" step="1" inputmode="numeric" placeholder="Ej: 3"`);
    if (t.modo === 'fecha') campos = campo('Válido desde', 'date', t.desde, `${a} data-campo="desde" data-key="${key}-d"`) + campo('Válido hasta', 'date', t.hasta, `${a} data-campo="hasta" data-key="${key}-h"`);
    const aviso = S.avisos[key] ? `<p class="ish-aviso" role="alert">${esc(S.avisos[key])}</p>` : '';
    return `<div class="ish-tope"><div class="ish-seg" role="radiogroup" aria-label="Tipo de tope">${seg}</div>${campos ? `<div class="ish-tope__campos">${campos}</div>` : ''}${aviso}</div>`;
  };

  const permisoHTML = (rol, p) => {
    const r = regla(S.eid, rol.code, p.id), tags = etiquetasDe(p.id);
    const sw = `<div class="nwt-switch${r.valida ? ' nwt-switch--checked' : ''}" role="switch" tabindex="0" aria-checked="${r.valida}" aria-labelledby="sw-${p.id}" data-valida="${p.id}" data-key="sw-${p.id}"><div class="nwt-switch__component"><div class="nwt-switch__component__element"></div></div></div>`;
    let cuerpo = '';
    if (r.valida) {
      cuerpo = `<div class="ish-perm__reglas"><section class="ish-bloque"><h4>Tope general <span>opcional</span></h4>${topeHTML(p.id, 'global', r.global, `g${p.id}`)}</section>`;
      if (tags.length) {
        cuerpo += `<section class="ish-bloque"><h4>Topes por etiqueta <span>opcional</span></h4>` + tags.map((t) => {
          const tt = (r.etiquetas[t] = r.etiquetas[t] || tope0());
          return `<div class="ish-etq"><b>${esc(t)}</b>${topeHTML(p.id, 'e:' + t, tt, `e${p.id}-${t.replace(/\W/g, '')}`)}</div>`;
        }).join('') + '</section>';
      }
      cuerpo += '</div>';
    }
    const sub = r.valida ? (tags.length ? `Etiquetas: ${tags.map(esc).join(' · ')}` : 'Sin etiquetas') : 'No se valida en la puerta';
    const res = r.valida ? `<span class="ish-perm__res">${tags.length ? `${tags.filter((t) => (r.etiquetas[t] || tope0()).modo !== 'ninguno').length} de ${tags.length} etiquetas con tope · ` : ''}General: ${esc(resumen(r.global))}</span>` : '';
    return `<article class="ish-perm${r.valida ? ' on' : ''}"><header class="ish-perm__top"><div class="ish-perm__nombre"><b>${esc(p.nombre)}</b><small>${sub}</small></div>${res}` +
      `<div class="ish-sw"><span id="sw-${p.id}">Cuenta con validación</span>${sw}</div></header>${cuerpo}</article>`;
  };

  const reglasHTML = () => {
    const rol = S.roles.find((r) => r.code === S.rol) || S.roles[0];
    if (!rol) return '<p class="ish-vacio">Este evento todavía no tiene tipos de acreditados.</p>';
    const lista = S.roles.map((r) => {
      const n = r.permisos.filter((p) => regla(S.eid, r.code, p.id).valida).length;
      return `<button type="button" class="ish-rol${r.code === rol.code ? ' on' : ''}" data-rol="${esc(r.code)}" data-key="rol-${esc(r.code)}" aria-pressed="${r.code === rol.code}"><b>${esc(r.nombre)}</b><small>${n} de ${r.permisos.length} con validación</small></button>`;
    }).join('');
    const perms = rol.permisos.length ? rol.permisos.map((p) => permisoHTML(rol, p)).join('') : '<p class="ish-vacio">Este tipo no tiene permisos. Asígnalos desde «Tipos de acreditados».</p>';
    return `<div class="ish-split"><nav class="ish-roles" aria-label="Tipos de acreditados">${lista}</nav>` +
      `<div class="ish-detalle"><div class="ish-detalle__cab"><h3>${esc(rol.nombre)}</h3><p>Activa la validación en los permisos que se controlan en la puerta y define cuántas veces o hasta cuándo se pueden usar.</p></div>${perms}</div></div>`;
  };

  const dibujar = () => {
    if (!cont) return;
    const foco = document.activeElement && cont.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const cuerpo = S.cargando ? '<p class="ish-vacio">Cargando…</p>' : S.error ? `<p class="ish-vacio" role="alert">${esc(S.error)}</p>` : reglasHTML();
    cont.innerHTML =
      `<section class="nws-access-permissions ish-val"><div class="nws-access-permissions__header"><div class="nws-access-permissions__description"><span class="nwt-h5-font-bold">Validación de permisos</span>` +
      `<small class="nwt-smalltext-font-regular">Define qué permisos se validan en la puerta y con qué topes. Las etiquetas de cada permiso se crean en «Permisos de acceso». Lo configura el admin.</small></div>` +
      `<div class="nws-access-permissions__actions"><span class="ish-guardado" role="status" aria-live="polite">${esc(S.guardado)}</span></div></div>` +
      `<div class="nwt-card ish-val__card" nwt-variant="quiet" nwt-size="medium"><div class="nwt-card__body"><div class="nwt-card__content">` +
      `${cuerpo}</div></div></div></section>`;
    if (foco) { const e = [...cont.querySelectorAll('[data-key]')].find((x) => x.dataset.key === foco); if (e) e.focus(); }
  };

  const anotar = () => { guardar(); S.guardado = 'Guardado · ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };
  const alterna = (pid, ambito, fn) => {
    const rol = S.roles.find((r) => r.code === S.rol); if (!rol) return;
    const r = regla(S.eid, rol.code, pid);
    const t = ambito === 'global' ? r.global : (r.etiquetas[ambito.slice(2)] = r.etiquetas[ambito.slice(2)] || tope0());
    fn(t, r);
  };

  // ── Eventos (delegados) ────────────────────────────────────────────────────
  const onClick = (e) => {
    const t = e.target, q = (s) => t.closest(s);
    let b;
    if ((b = q('[data-rol]'))) { S.rol = b.dataset.rol; return dibujar(); }
    if ((b = q('[data-valida]'))) { const rol = S.roles.find((r) => r.code === S.rol); const r = regla(S.eid, rol.code, +b.dataset.valida); r.valida = !r.valida; anotar(); return dibujar(); }
    if ((b = q('[data-modo]'))) { alterna(+b.dataset.pid, b.dataset.ambito, (tp) => { tp.modo = b.dataset.modo; }); delete S.avisos[b.dataset.key.replace(/-[^-]+$/, '')]; anotar(); return dibujar(); }
  };
  const onKey = (e) => {
    const sw = e.target.closest && e.target.closest('[data-valida]');
    if (sw && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); sw.click(); }
  };
  const onChange = (e) => {
    const i = e.target; if (!i.dataset || !i.dataset.campo) return;
    const key = i.dataset.key.replace(/-[^-]+$/, '');
    alterna(+i.dataset.pid, i.dataset.ambito, (tp) => {
      if (i.dataset.campo === 'numero') { const n = Math.max(1, Math.floor(+i.value) || 0); tp.numero = n || null; i.value = n || ''; }
      else {
        const nuevo = { desde: tp.desde, hasta: tp.hasta, [i.dataset.campo]: i.value };
        if (nuevo.desde && nuevo.hasta && nuevo.hasta < nuevo.desde) { S.avisos[key] = 'La fecha final no puede ser anterior a la inicial.'; return; }
        delete S.avisos[key]; tp[i.dataset.campo] = i.value;
      }
    });
    anotar(); dibujar();
  };
  // ── Carga y montaje ────────────────────────────────────────────────────────
  const cargar = async () => {
    S.cargando = true; S.error = '';
    try {
      S.eid = window.__ACRED_EVENT_ID || 7;
      const [rs, ps] = await Promise.all([get(`/roles?limit=100&event_id=${S.eid}&page=1`), get('/permissions?limit=100&page=1')]);
      S.permisos = (ps.data || []).filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.name, code: p.code, tags: Array.isArray(p.tags) ? p.tags : [] }));
      S.roles = (rs.data || []).filter((r) => r.is_active !== false).map((r) => ({
        code: r.code, nombre: String(r.role_name || '').replace(/\s*\([^)]*\)\s*$/, ''),
        permisos: (r.permissions || []).map((p) => ({ id: p.permission_id, nombre: p.permission_name }))
      }));
      leer(); sembrar(S.eid, S.roles, S.permisos);
      if (!S.roles.some((r) => r.code === S.rol)) S.rol = S.roles[0] && S.roles[0].code;
    } catch (e) { S.error = 'No se pudieron leer los permisos y tipos de acreditados. Vuelve a intentarlo.'; }
    S.cargando = false; dibujar();
  };

  window.ACRED_PANTALLAS = window.ACRED_PANTALLAS || {};
  window.ACRED_PANTALLAS.validacion = {
    render(el) {
      cont = el; S.guardado = '';
      if (!cont.__ligado) { const mia = (f) => (e) => { if (cont && cont.dataset.id === 'validacion') f(e); }; cont.addEventListener('click', mia(onClick)); cont.addEventListener('keydown', mia(onKey)); cont.addEventListener('change', mia(onChange)); cont.__ligado = true; }
      dibujar(); cargar();
    }
  };
})();
