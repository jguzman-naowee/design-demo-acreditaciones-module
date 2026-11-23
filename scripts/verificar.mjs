// Verificación en código, sin navegador: rutas, selectores de los casos y cobertura del gateway.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(raiz, 'mobile/apps/acreditaciones');
const leer = (f) => readFileSync(path.join(raiz, f), 'utf8');
let fallos = 0;
const check = (ok, msg) => { if (!ok) fallos++; console.log(`${ok ? 'ok  ' : 'FALLA'} ${msg}`); };

const archivos = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? archivos(p) : [p];
});
const fuente = archivos(path.join(raiz, 'mf/src')).filter((f) => /\.(tsx?|scss)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
const shell = readFileSync(path.join(app, 'assets/shell.js'), 'utf8');
const css = readFileSync(path.join(app, 'assets/app.css'), 'utf8');

// Rutas del micro y del menú
const rutasMicro = [...leer('mf/src/accreditations/presentation/AccreditationsApp.tsx').matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const rutasMenu = [...shell.matchAll(/\['[^']+', '(\/[^']*)'/g)].map((m) => m[1]);
const existe = (r) => rutasMicro.some((p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$').test(r));
for (const r of rutasMenu) check(existe(r), `menú: ${r} existe en el router del micro`);

// Casos
const ctx = { window: {} };
vm.runInNewContext(readFileSync(path.join(app, 'casos.js'), 'utf8'), ctx);
const casos = ctx.window.CASOS;
check(casos.length > 0, `casos: ${casos.length} definidos`);
const hay = (clase) => fuente.includes(clase) || shell.includes(clase) || css.includes(`.${clase}`);
for (const c of casos) {
  check(c.steps[0].t === 'goto', `caso ${c.id}: arranca con goto`);
  check(typeof c.falta === 'string' && c.falta.length > 0, `caso ${c.id}: declara lo que no hace`);
  for (const s of c.steps) {
    if (!s.sel) continue;
    for (const m of s.sel.matchAll(/\.([a-z][\w-]*)/g)) {
      if (m[1] === 'ish-nav' || m[1] === 'on') continue;
      check(hay(m[1]), `caso ${c.id}: la clase .${m[1]} existe`);
    }
    for (const m of s.sel.matchAll(/data-go="([^"]+)"/g)) check(rutasMenu.includes(m[1]), `caso ${c.id}: ${m[1]} está en el menú`);
  }
}
check(shell.includes('ish-nav'), 'shell: pinta .ish-nav');

// Gateway: cada URL del micro que no sea de mutación debe tener contrato (nada cae en el 501)
const { interceptGateway } = await import(pathToFileURL(path.join(raiz, 'mf/gateway.mjs')).href);
const montar = async () => {
  let manejador;
  const estado = await interceptGateway({ route: (_p, h) => { manejador ??= h; }, context: () => ({ route: () => undefined }) });
  const pedir = (method, url, body) => new Promise((ok) => manejador({
    request: () => ({ url: () => `http://x/public-gateway${url}`, method: () => method, postDataJSON: () => body ?? null }),
    fulfill: (r) => ok({ status: r.status, body: JSON.parse(r.body || 'null') })
  }));
  return { estado, pedir };
};
const { estado, pedir } = await montar();
const base = '/v1/accreditation';
const ev = estado.eventCatalog[0].event_code;
const sondas = [
  `${base}/events/catalog`, `${base}/permissions`, `${base}/roles?event_id=7`, `${base}/accreditations?event_id=7`,
  `${base}/card-batches?event_id=7`, `/v1/event/${ev}`, '/v1/locations/regions', '/v1/locations/departments'
];
for (const u of sondas) {
  const r = await pedir('GET', u);
  check(r.status !== 501, `gateway: GET ${u} tiene contrato (${r.status})`);
}

// Persistencia: el estado es JSON puro y los manejadores lo leen en vivo
const otro = await montar();
const copia = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(estado).filter(([k]) => !['requests', 'unexpected', 'bucket'].includes(k)))));
const nuevo = { ...copia.roles[0], code: 'persistido-0001', role_name: 'Rol persistido', id: 999 };
copia.roles.push(nuevo);
Object.assign(otro.estado, copia);
const lista = await otro.pedir('GET', `${base}/roles?event_id=${nuevo.event_id}&limit=100`);
check(JSON.stringify(lista.body).includes('persistido-0001'), 'persistencia: el estado restaurado llega a las respuestas');

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en orden');
process.exit(fallos ? 1 : 0);
