import { cacheStore, RequestEntityByPage } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { SuiteEvent } from '../../domain/entities/suite-event';
import { EVENT_CATALOG_URL } from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { catalogResponseToSuiteEvent } from '../factories/suite-event.factory';
import type { EventCatalogResponse } from '../models/suite-event.model';
import { DedupedPaginationRepository } from './deduped.repository';

// La página de la pantalla de entrada: se ven varios a la vez y se elige uno.
const PAGE_LIMIT = 10;

// Los eventos que tienen acreditación configurada.
//
// Es el endpoint que le pedí a backend y sustituye a `/v2/events` en la pantalla de
// entrada. La diferencia no es cosmética: allá hay 485 eventos sin `search`, y los que
// sirven estaban en las posiciones 453 a 465, así que la pantalla tenía que recorrer las
// cinco páginas para poder buscar. Acá vienen solo los útiles, paginados, y la búsqueda la
// hace el servidor.
export class EventCatalogRepository extends DedupedPaginationRepository<
  SuiteEvent,
  EventCatalogResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, EVENT_CATALOG_URL, catalogResponseToSuiteEvent, {
      queryParams: { limit: PAGE_LIMIT }
    });
  }

  /**
   * Olvida las páginas ya traídas, para que la próxima consulta empiece por la primera.
   *
   * La lista vive en una caché GLOBAL del SDK, con clave url+params, y va acumulando páginas:
   * `list.currentPage` es la última traída. Como el repositorio es un singleton, eso sobrevive
   * a salir de la pantalla y volver — y por eso elegir un evento de la página 2 y pulsar
   * «Cambiar» devolvía a la 2, a media lista.
   *
   * No sirve el controlador para esto: sus `goToPage` y `refresh` se salen de inmediato si el
   * estado está en `loading`, que es justo como nace, así que llamarlos al montar no hace
   * nada (medido). Y `goToPage` además solo sabe AVANZAR: su bucle busca páginas hacia
   * adelante y nunca vuelve atrás.
   *
   * Solo borra; no pide nada. Se llama antes de montar el controlador y es su propio
   * `requestAll()` el que trae la primera página, así que no hay una petición de más.
   */
  public forgetPages(): void {
    cacheStore().delete(this.key);
  }

  // Los params se leen de `this.queryParams` para que el applyFilters() del controlador
  // —donde viaja la búsqueda— llegue de verdad al servidor.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<EventCatalogResponse> {
    return new RequestEntityByPage<EventCatalogResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }
}

registerDependency(EventCatalogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
