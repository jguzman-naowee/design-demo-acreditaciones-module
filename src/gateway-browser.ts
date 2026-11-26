// El contrato del gateway es JS puro, copiado tal cual del e2e del micro.
import { interceptGateway } from '../mf/gateway.mjs';

const KEY = 'naowee.acreditaciones-module.estado';
// Bitácoras del propio simulador: crecen sin parar y no son datos del evento.
const VOLATILES = ['requests', 'unexpected', 'bucket'];

// Nombre del evento de la demo (decisión del 24-nov): el contrato trae el de staging y se renombra al entregar cada respuesta.
const RENOMBRES: Array<[string, string]> = [
  ['Juegos Intercolegiados 2026 - Mini migración STG', 'Juegos Intercolegiados'],
  ['Fase Eliminatoria', 'Fase Regional']
];
const renombrar = (t: string) => RENOMBRES.reduce((a, [de, a2]) => a.split(de).join(a2), t);

type Handler = (route: unknown) => unknown;
type Estado = Record<string, unknown>;

function guardado(): Estado | null {
  try {
    if (new URLSearchParams(location.search).has('reset')) {
      localStorage.removeItem(KEY);
      return null;
    }
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function persistir(estado: Estado): void {
  try {
    const copia = { ...estado };
    for (const k of VOLATILES) delete copia[k];
    localStorage.setItem(KEY, JSON.stringify(copia));
  } catch {
    /* sin almacenamiento: la demo sigue, solo que sin memoria entre recargas */
  }
}

// El contrato habla con Playwright (`page.route`): se le da una página falsa que guarda el
// manejador, y el XMLHttpRequest del SDK le pasa cada llamada como si fuera una ruta.
export function installGateway(): void {
  const handlers: Handler[] = [];
  const fakePage = {
    route: (_p: string, h: Handler) => handlers.push(h),
    context: () => ({ route: () => undefined })
  };

  const listo: Promise<Estado> = interceptGateway(fakePage).then((estado: Estado) => {
    const previo = guardado();
    if (previo) Object.assign(estado, previo);
    // Las pantallas propias de la demo (JS plano en mobile/apps/acreditaciones/assets) leen y escriben el estado del simulador.
    const w = window as unknown as Record<string, unknown>;
    w.__ACRED_ESTADO__ = estado;
    w.__ACRED_PERSISTIR__ = () => persistir(estado);
    return estado;
  });

  const proto = XMLHttpRequest.prototype;
  const realOpen = proto.open;
  const realSend = proto.send;
  type Tagged = XMLHttpRequest & { __gw?: { method: string; url: URL } };

  proto.open = function (this: Tagged, method: string, url: string | URL, ...rest: unknown[]) {
    const u = new URL(String(url), location.href);
    this.__gw = u.pathname.includes('/public-gateway/')
      ? { method: method.toUpperCase(), url: u }
      : undefined;
    return (realOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

  proto.send = function (this: Tagged, body?: Document | XMLHttpRequestBodyInit | null) {
    const gw = this.__gw;
    if (!gw) return realSend.call(this, body);

    let json: unknown = null;
    try {
      json = typeof body === 'string' && body ? JSON.parse(body) : null;
    } catch {
      /* sin cuerpo JSON */
    }

    const route = {
      request: () => ({
        url: () => gw.url.href,
        method: () => gw.method,
        postDataJSON: () => json
      }),
      fulfill: ({ status, contentType, body: cuerpo }: { status: number; contentType: string; body: string }) => {
        const text = renombrar(cuerpo);
        const set = (k: string, v: unknown) =>
          Object.defineProperty(this, k, { value: v, configurable: true });
        set('readyState', 4);
        set('status', status);
        set('statusText', status < 400 ? 'OK' : 'Error');
        set('responseURL', gw.url.href);
        set('responseText', text);
        set('response', this.responseType === 'json' ? JSON.parse(text || 'null') : text);
        this.getResponseHeader = (h: string) =>
          h.toLowerCase() === 'content-type' ? contentType : null;
        this.getAllResponseHeaders = () => `content-type: ${contentType}\r\n`;
        for (const ev of ['readystatechange', 'load', 'loadend']) this.dispatchEvent(new Event(ev));
      }
    };

    void listo.then(async (estado) => {
      await handlers[0](route);
      if (gw.method !== 'GET') persistir(estado);
    });
  } as typeof proto.send;
}
