import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import {
  DEPARTMENTS_CATALOG_URL,
  REGIONS_CATALOG_URL
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';

/** Una zona del país: el código con el que se filtra y su nombre. */
export interface RegionItem {
  code: string;
  name: string;
}

/**
 * Un departamento con la zona a la que pertenece, YA traducido.
 *
 * El nombre de la clave importa y estaba mal: durante un tiempo esto dijo que el endpoint
 * devolvía `regionCode` en camelCase. **No lo hace.** Medido contra staging el 2026-09-16:
 *
 *   [{"code":"05","name":"ANTIOQUIA","region_code":"3"}, …]
 *
 * y este gateway no transforma nada —todos los modelos de al lado están en snake_case y se
 * mapean a mano—, así que `item.regionCode` era `undefined` en las 33 filas.
 *
 * Costaba la CASCADA zona→delegación de las dos pantallas de entrega: `regionOf[code] === zona`
 * comparaba `undefined` contra el código de la zona, nunca daba cierto, y el desplegable de
 * delegación se quedaba con su rótulo y nada más en cuanto se elegía una zona. Sin error, sin
 * petición fallida y sin nada rojo: solo un desplegable vacío que se lee como «este evento no
 * tiene delegaciones en esta zona».
 *
 * Por eso la traducción vive ACÁ y no en cada pantalla: son dos las que la usan y la tercera
 * que venga la heredaría mal.
 */
export interface DepartmentItem {
  code: string;
  name: string;
  regionCode: string;
}

/** Lo que de verdad llega por el cable. Se acepta también el camelCase por si algún día sí. */
interface DepartmentResponse {
  code: string;
  name?: string | null;
  region_code?: string | null;
  regionCode?: string | null;
}

/**
 * Las zonas del país, que es lo único que el módulo necesita del grupo de localización.
 *
 * Los departamentos y municipios NO se piden aquí: para esos la pantalla usa las FACETAS del
 * evento (`requestFacets`), que además de nombrarlos dicen cuánta gente hay en cada uno y ya
 * vienen acotadas a la fase. Traerlos del catálogo general ofrecería los 33 departamentos del
 * país en un evento que tiene cuatro.
 *
 * Las zonas no salen en las facetas —la región no es una columna de la inscripción, el backend
 * la traduce a departamentos al filtrar— así que este es el único sitio de donde pueden salir.
 */
export class LocationRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public async requestRegions(): Promise<RegionItem[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<RegionItem[]>(REGIONS_CATALOG_URL, HttpMethod.Get)
    );

    return (response ?? []).filter((item) => !!item?.code && !!item?.name);
  }

  /**
   * Los departamentos con su zona, que es lo ÚNICO para lo que se piden: saber qué
   * departamentos caen en la zona elegida.
   *
   * No se usan para poblar el desplegable de delegación —ese sale de las facetas del evento,
   * que además dicen cuánta gente hay en cada una—: aquí se ofrecerían los 33 del país en un
   * evento que tiene cuatro.
   */
  public async requestDepartments(): Promise<DepartmentItem[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<DepartmentResponse[]>(
        DEPARTMENTS_CATALOG_URL,
        HttpMethod.Get
      )
    );

    return (response ?? [])
      .filter((item) => !!item?.code)
      .map((item) => ({
        code: item.code,
        name: item.name ?? item.code,
        // Sin zona el departamento se queda FUERA de cualquier recorte por zona, que es lo
        // correcto: ofrecerlo en todas las zonas sería peor que no ofrecerlo en ninguna.
        regionCode: item.region_code ?? item.regionCode ?? ''
      }));
  }
}

registerDependency(LocationRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
