import {
  HttpEndpoint,
  HttpMethod,
  PaginationRepository,
  RequestEntityByPage
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { AccessPermission } from '../../domain/entities/access-permission';
import {
  ACCESS_PERMISSIONS_URL,
  permissionStateUrl,
  permissionUrl,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToAccessPermission } from '../factories/access-permission.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccessPermissionPayload,
  AccessPermissionResponse,
  AccessPermissionUpdatePayload
} from '../models/access-permission.model';

// El gateway ya acepta `search`, así que el buscador filtra en el servidor. El
// límite sigue alto porque la paginación visible es en cliente.
const CATALOG_LIMIT = 100;

export class AccessPermissionRepository extends PaginationRepository<
  AccessPermission,
  AccessPermissionResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, ACCESS_PERMISSIONS_URL, responseToAccessPermission, {
      queryParams: { limit: CATALOG_LIMIT }
    });
  }

  // El GET devuelve {data, meta}, que es exactamente el PaginationResponse del
  // SDK; por eso este repositorio es de paginación y no un EntityRepository.
  //
  // Los params se leen de `this.queryParams` para que applyFilters() del
  // controlador llegue al servidor: ese método los mezcla ahí.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<AccessPermissionResponse> {
    return new RequestEntityByPage<AccessPermissionResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }

  public async create(
    payload: AccessPermissionPayload
  ): Promise<AccessPermission> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccessPermissionResponse>({
          code: crypto.randomUUID(),
          id: Date.now(),
          name: payload.name,
          description: payload.description ?? null,
          has_limit: payload.has_limit,
          file_icon_upload_id: payload.file_icon_upload_id ?? null,
          zone_name: payload.zone_name ?? null,
          venue_name: payload.venue_name ?? null,
          is_active: true
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccessPermissionResponse>(
            this.url,
            HttpMethod.Post,
            { payload }
          )
        ));

    const permission = responseToAccessPermission(response);

    this.list?.unshift(permission);

    return permission;
  }

  // Edición parcial: solo viaja lo que cambió. Va por `code`, no por el id.
  public update(
    permission: AccessPermission,
    payload: AccessPermissionUpdatePayload
  ): Promise<AccessPermission> {
    return this.write(permission, permissionUrl(permission.code), payload);
  }

  public activate(permission: AccessPermission): Promise<AccessPermission> {
    return this.write(permission, permissionStateUrl(permission.code, true), {
      is_active: true
    });
  }

  public deactivate(permission: AccessPermission): Promise<AccessPermission> {
    return this.write(permission, permissionStateUrl(permission.code, false), {
      is_active: false
    });
  }

  // Los tres endpoints de escritura devuelven el permiso completo, así que la fila
  // se reemplaza en el store con lo que dijo el backend —no con lo que la pantalla
  // creía— y la tabla se repinta sin volver a pedir el catálogo.
  private async write(
    permission: AccessPermission,
    url: string,
    payload: AccessPermissionUpdatePayload & { is_active?: boolean }
  ): Promise<AccessPermission> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccessPermissionResponse>({
          code: permission.code,
          id: Number(permission.id),
          name: payload.name ?? permission.name,
          description: payload.description ?? permission.description,
          has_limit: payload.has_limit ?? permission.hasLimit,
          file_icon_upload_id:
            payload.file_icon_upload_id ?? permission.fileIconUploadId,
          zone_name: payload.zone_name ?? permission.zoneName,
          venue_name: payload.venue_name ?? permission.venueName,
          is_active: payload.is_active ?? permission.isActive
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccessPermissionResponse>(url, HttpMethod.Patch, {
            // Los toggles no llevan cuerpo; el PATCH de edición sí.
            ...(payload.is_active === undefined
              ? { payload: toUpdatePayload(payload) }
              : {})
          })
        ));

    const updated = responseToAccessPermission(response);

    this.list?.refresh(updated);

    return updated;
  }
}

// El PATCH es parcial y `normalizeJson` del cliente ya quita las claves nulas, así
// que basta con no incluir lo que no cambió: mandar un campo vacío lo borraría.
function toUpdatePayload(
  payload: AccessPermissionUpdatePayload
): AccessPermissionUpdatePayload {
  const { name, description, has_limit, file_icon_upload_id, zone_name, venue_name } =
    payload;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(has_limit !== undefined ? { has_limit } : {}),
    ...(file_icon_upload_id !== undefined ? { file_icon_upload_id } : {}),
    ...(zone_name !== undefined ? { zone_name } : {}),
    ...(venue_name !== undefined ? { venue_name } : {})
  };
}

registerDependency(AccessPermissionRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});

// El catálogo completo, para quien necesita TODOS los permisos y no los que
// alguien dejó filtrados en otra pantalla.
//
// PaginationRepository guarda `queryParams` y la clave de caché en la instancia, y
// las dependencias son singleton: si el modal de tipos de acreditado compartiera
// instancia con la pantalla de permisos, buscar «prensa» allá dejaría al modal
// ofreciendo solo ese permiso, y se podría crear un rol al que le faltan permisos
// sin que nadie lo note. Con dos instancias cada una lleva sus propios filtros; la
// caché del SDK es por url+params, así que la petición sin filtros se comparte y no
// cuesta una llamada extra.
export class AccessPermissionCatalogRepository extends AccessPermissionRepository {}

registerDependency(AccessPermissionCatalogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
