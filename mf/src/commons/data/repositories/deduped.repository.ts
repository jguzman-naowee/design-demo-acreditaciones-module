import {
  cacheStore,
  type Entity,
  type List,
  PaginationRepository
} from '@naowee-tech/sdk-frontend-web';

export type QueryParams = Record<string, string | number | boolean>;

// Una petición por clave mientras esté en vuelo.
//
// Hace falta porque el controlador de paginación del SDK pide al MONTAR y la pantalla
// aplica sus filtros en un efecto, o sea inmediatamente después: la caché del SDK se llena
// cuando la respuesta LLEGA, así que esas dos llamadas —misma clave, mismos filtros— salían
// como dos peticiones idénticas. Medido en todas las pantallas del módulo.
//
// Misma clave significa mismos filtros, así que quien llegue segundo puede esperar la
// respuesta de la que ya salió.
export abstract class DedupedPaginationRepository<
  T extends Entity,
  R
> extends PaginationRepository<T, R> {
  private readonly pending = new Map<string, Promise<List<T>>>();
  private queue: Promise<void> = Promise.resolve();
  private latest?: Promise<List<T>>;
  private ticket = 0;

  // Tira la lista cacheada SIN volver a pedirla: el `refresh()` del SDK hace las dos cosas,
  // y quien invalida no siempre está mirando la pantalla —inactivar un carnet cambia el
  // lote, y el listado de lotes puede estar en otra pestaña del menú—. Así la próxima vez
  // que se abra, pide; y si nadie la abre, no se gasta nada.
  public invalidate(): void {
    cacheStore().delete(this.key);
  }

  // De una en una y la última gana. El SDK lee `this.key` DESPUÉS del await, así que una
  // respuesta tardía caía en la lista de la búsqueda nueva. Las intermedias ni salen.
  public override requestAll(queryParams?: QueryParams): Promise<List<T>> {
    const key = queryParams
      ? buildCacheKey(this.url, { ...this.defaultQueryParams, ...queryParams })
      : this.key;

    const inFlight = this.pending.get(key);

    if (inFlight && inFlight === this.latest) {
      return inFlight;
    }

    const ticket = ++this.ticket;

    const turn = this.queue.then(() =>
      ticket === this.ticket ? super.requestAll(queryParams) : undefined
    );

    this.queue = turn.then(
      () => undefined,
      () => undefined
    );

    const request: Promise<List<T>> = turn
      .then((list) => list ?? (this.latest as Promise<List<T>>))
      .finally(() => {
        if (this.pending.get(key) === request) {
          this.pending.delete(key);
        }
      });

    this.latest = request;
    this.pending.set(key, request);

    return request;
  }
}

// La misma fórmula que el `buildCacheKey` del SDK (`url?a=1&b=2`, claves ordenadas), que no
// está exportado. Si allá cambiara, no se rompe nada: se volverían a gastar las peticiones
// de más que teníamos antes, y la verificación de extremo a extremo lo cantaría —cuenta las
// peticiones de cada pantalla, justo por esto—.
export function buildCacheKey(namespace: string, params: QueryParams): string {
  const entries = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`);

  return entries.length ? `${namespace}?${entries.join('&')}` : namespace;
}
