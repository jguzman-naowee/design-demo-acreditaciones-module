import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { RoleCatalogFamily } from '../../domain/entities/role-catalog';
import { ROLE_CATALOG_URL } from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToRoleCatalogFamily } from '../factories/role-catalog.factory';
import type { RoleCatalogResponse } from '../models/role-catalog.model';

// La taxonomía del evento: familias, sus funciones y cuál está ocupada. Reemplaza tres listas
// que el front tenía a mano —las categorías, la familia de cada función y con qué código llega
// la persona—, así que cada rol nuevo sale solo.
export class RoleCatalogRepository {
  // Solo la taxonomía SIN evento: la piden dos consumidores a la vez y no cambia en la sesión.
  // La de un evento trae la ocupación, que sí cambia al crear un tipo. Y se guarda el ÉXITO
  // nada más: un fallo cacheado dejaría la pantalla rota hasta recargar.
  private familias?: RoleCatalogFamily[];

  constructor(private readonly apiClient: GatewayApiClient) {}

  public async requestFamilies(eventId?: number): Promise<RoleCatalogFamily[]> {
    if (!eventId && this.familias) {
      return this.familias;
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<RoleCatalogResponse>(ROLE_CATALOG_URL, HttpMethod.Get, {
        ...(eventId ? { queryParams: { event_id: eventId } } : {})
      })
    );

    const familias = (response?.families ?? [])
      .filter((family) => !!family?.code)
      .map(responseToRoleCatalogFamily);

    if (!eventId && familias.length) {
      this.familias = familias;
    }

    return familias;
  }
}

registerDependency(RoleCatalogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
