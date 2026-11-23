import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import {
  ACCREDITED_TYPE_FUNCTIONS_URL,
  EVENT_ROLE_CATALOG_URL,
  SPORT_CATEGORY_CATALOG_URL,
  SUPPORT_PERSONNEL_ROLE_CATALOG_URL
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import type {
  AccreditedTypeFunctionResponse,
  AccreditedTypeFunctionsResponse
} from '../models/accredited-type.model';

/** Una entrada del diccionario: el código que guarda el backend y su nombre en español. */
export interface EventRoleCatalogItem {
  code: string;
  name: string;
}

/**
 * Los roles que el gateway publica para armar un tipo de acreditado.
 *
 * Reemplaza a `ACCREDITED_TYPE_OPTIONS`, cinco nombres inventados en la época del mock que
 * llevaban un `TODO(api)` desde entonces. Se notó porque «Personal de apoyo» no salía —y no
 * salía por nada más que porque nadie lo escribió—, y porque el filtro de la pantalla no
 * encontraba los tipos que el evento tiene de verdad.
 *
 * Son DOS diccionarios de `/catalogs/:type`, no uno: `event-role` cubre al personal del
 * evento (Voluntario, Médico, Juez Nacional…) y `support-personnel-role` al personal de
 * apoyo de las delegaciones (Docente/Entrenador, Auxiliar Discapacidad…). Comparten la forma
 * exacta —array pelado de `{code, name}`, no el sobre `{data, meta}` del resto del módulo—,
 * así que los sirve la misma clase en vez de duplicarla entera.
 *
 * Ninguno de los dos trae «Deportista» ni «Delegado»: cubren personal, no el lado de
 * participantes. Esos dos se añaden aparte —ver ACCREDITED_TYPE_EXTRAS— y están pedidos a
 * backend.
 */
export class EventRoleCatalogRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public requestAll(): Promise<EventRoleCatalogItem[]> {
    return this.requestCatalog(EVENT_ROLE_CATALOG_URL);
  }

  public requestSupportPersonnel(): Promise<EventRoleCatalogItem[]> {
    return this.requestCatalog(SUPPORT_PERSONNEL_ROLE_CATALOG_URL);
  }

  /**
   * Las categorías deportivas, para el filtro del listado de acreditados.
   *
   * No son roles, y la clase se llama como se llama. Va acá igual por lo mismo que están
   * juntos los otros dos: es EL MISMO endpoint `/catalogs/:type` con la misma forma —array
   * pelado de `{code, name}`— y una clase aparte sería una copia de estas quince líneas con
   * otro nombre. Si algún día el módulo necesita un cuarto diccionario, esto se renombra.
   */
  public requestSportCategories(): Promise<EventRoleCatalogItem[]> {
    return this.requestCatalog(SPORT_CATEGORY_CATALOG_URL);
  }

  /**
   * Las funciones de MISIÓN del evento.
   *
   * Va aparte y no por `requestCatalog` porque no comparte la forma de los otros dos: viene
   * en un sobre `{event_id, functions}` y cada función trae, además del par código/nombre,
   * si el evento YA la tiene configurada y con qué `role_code`. Aplanarla a
   * `EventRoleCatalogItem` tiraría justo lo que sirve para no ofrecer duplicados.
   */
  public async requestMissionFunctions(
    eventId: number
  ): Promise<AccreditedTypeFunctionResponse[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditedTypeFunctionsResponse>(
        ACCREDITED_TYPE_FUNCTIONS_URL,
        HttpMethod.Get,
        { queryParams: { event_id: eventId } }
      )
    );

    return (response?.functions ?? []).filter((item) => !!item?.code);
  }

  private async requestCatalog(url: string): Promise<EventRoleCatalogItem[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<EventRoleCatalogItem[]>(url, HttpMethod.Get)
    );

    return (response ?? []).filter((item) => !!item?.name);
  }
}

registerDependency(EventRoleCatalogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
