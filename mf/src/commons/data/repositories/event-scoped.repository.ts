import type { Entity } from '@naowee-tech/sdk-frontend-web';

import {
  buildCacheKey,
  DedupedPaginationRepository,
  type QueryParams
} from './deduped.repository';

// Los catálogos que se leen POR EVENTO. Además de no repetir la petición en vuelo —eso lo
// hereda—, dejan el evento puesto antes de que el controlador monte.
//
// Sin eso, la primera petición de cada pantalla salía con un evento imposible
// (`event_id=0`, `event_code=0000…`) y se descartaba entera al llegar la buena.
export abstract class EventScopedPaginationRepository<
  T extends Entity,
  R
> extends DedupedPaginationRepository<T, R> {
  // La ÚLTIMA clave de scope que se aplicó, que no es lo mismo que la clave viva del
  // repositorio: esa cambia cada vez que la pantalla filtra. Ver el porqué abajo.
  private scopeKey?: string;

  public applyEventScope(scope: QueryParams): void {
    const params = { ...this.defaultQueryParams, ...scope };
    const key = buildCacheKey(this.url, params);

    // Se llama en CADA RENDER de la pantalla —tiene que ser así: el controlador del SDK
    // dispara su primer `requestAll()` en un efecto propio, que corre antes que los de la
    // pantalla, así que un efecto nuestro llegaría tarde—. De ahí la guarda.
    //
    // Y la guarda compara contra el último SCOPE, no contra la clave viva. Comparar contra
    // `this.key` rompía la búsqueda, y así:
    //
    // 1. al montar se cachea la lista sin filtro bajo K0, y `this.key` = K0;
    // 2. la pantalla filtra → `requestAll({event_id, search})` pone `this.key` = K1 y sale
    //    la petición, ya con el `search`;
    // 3. teclear repinta, y este método veía `this.key`(K1) ≠ K0 y DEVOLVÍA la clave a K0,
    //    con la petición todavía en vuelo;
    // 4. al llegar la respuesta, `remoteAll` del SDK hace `const list = this.list` DESPUÉS
    //    del await —o sea, con la clave de ahora, K0—, encuentra la lista sin filtrar y
    //    entra por su rama `list.merge(entities)`: funde los resultados en ella y devuelve
    //    LA MISMA referencia;
    // 5. `setList(mismaRef)` no repinta nada, y la tabla se queda con las filas de antes.
    //
    // O sea: el `search` viajaba, el backend filtraba, y el resultado se perdía en silencio.
    // Reportado por Andrés en «Acreditados del evento»; el fallo era latente en las siete
    // pantallas con scope, y solo se ve donde hay un filtro encima del scope.
    if (this.scopeKey === key) {
      return;
    }

    this.scopeKey = key;
    this.queryParams = params;
    this.key = key;
  }
}
