import {
  HttpEndpoint,
  HttpMethod,
  RequestEntityByPage
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { AccreditedType } from '../../domain/entities/accredited-type';
import {
  ACCREDITED_TYPES_URL,
  accreditedTypeStateUrl,
  accreditedTypeUrl,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToAccreditedType } from '../factories/accredited-type.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccreditedTypePayload,
  AccreditedTypeResponse,
  AccreditedTypeUpdatePayload
} from '../models/accredited-type.model';
import { EventScopedPaginationRepository } from './event-scoped.repository';

// El gateway ya filtra por evento y por texto, así que la pantalla no tiene que
// traerse el catálogo entero para recortarlo: manda `event_id` y `search` y recibe
// solo lo suyo. El límite sigue alto porque la paginación visible es en cliente.
const CATALOG_LIMIT = 100;

// usePaginationRepository dispara su primer requestAll() al montar, antes de que la
// pantalla sepa cuál es el evento activo. Hoy las pantallas lo dejan puesto con
// `applyEventScope` antes de montar el controlador, así que esto es una red de seguridad:
// sin ella una llamada sin scope se traería los roles de TODOS los eventos para tirarlos,
// y con un event_id imposible vuelve vacía (comprobado en dev: 200 con total 0).
const NO_EVENT = 0;

// role_code es obligatorio y único por evento. El diseño solo pide el nombre, así
// que el código se deriva de él.
export function toRoleCode(typeName: string): string {
  return typeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes: Coordinador logístico.
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

// El backend quiere la fecha límite en ISO-8601 CON zona (y la normaliza a UTC).
// El calendario del SDK entrega un día, así que el acceso cierra al final de ese
// día en la hora de quien lo elige: 2026-12-20 → 2026-12-20T23:59:59-05:00.
export function toAccessDeadline(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T23:59:59${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

export class AccreditedTypeRepository extends EventScopedPaginationRepository<
  AccreditedType,
  AccreditedTypeResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, ACCREDITED_TYPES_URL, responseToAccreditedType, {
      queryParams: { limit: CATALOG_LIMIT, event_id: NO_EVENT }
    });
  }

  // Se leen de `this.queryParams` y no de una constante para que applyFilters()
  // del controlador llegue de verdad al servidor: ese método los mezcla ahí.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<AccreditedTypeResponse> {
    return new RequestEntityByPage<AccreditedTypeResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }

  // El nombre de cada permiso lo sabe quien tiene el catálogo cargado, no este
  // repositorio: se recibe para que la fila recién creada no muestre ids en el
  // camino de demo, donde no hay un 201 real que los traiga.
  public async create(
    payload: AccreditedTypePayload,
    permissionNames: Record<number, string> = {}
  ): Promise<AccreditedType> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditedTypeResponse>({
          code: crypto.randomUUID(),
          id: Date.now(),
          role_name: payload.role_name,
          role_code: payload.role_code,
          event_id: payload.event_id,
          is_active: true,
          access_deadline: payload.access_deadline ?? null,
          permissions: payload.permissions.map((permission) => ({
            permission_id: permission.permission_id,
            permission_name:
              permissionNames[permission.permission_id] ?? 'Permiso',
            has_limit: permission.max_uses_per_person !== null,
            max_uses_per_person: permission.max_uses_per_person,
            order: permission.order
          }))
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditedTypeResponse>(
            this.url,
            HttpMethod.Post,
            { payload }
          )
        ));

    const accreditedType = responseToAccreditedType(response);

    this.list?.unshift(accreditedType);

    return accreditedType;
  }

  // El PUT reemplaza el rol completo: lo que no venga en `permissions` se pierde,
  // así que el modal manda siempre la lista entera que debe quedar.
  public update(
    accreditedType: AccreditedType,
    payload: AccreditedTypeUpdatePayload,
    permissionNames: Record<number, string> = {}
  ): Promise<AccreditedType> {
    return this.write(
      accreditedType,
      accreditedTypeUrl(accreditedType.code),
      HttpMethod.Put,
      payload,
      permissionNames
    );
  }

  public activate(accreditedType: AccreditedType): Promise<AccreditedType> {
    return this.write(
      accreditedType,
      accreditedTypeStateUrl(accreditedType.code, true),
      HttpMethod.Patch,
      undefined,
      {},
      true
    );
  }

  public deactivate(accreditedType: AccreditedType): Promise<AccreditedType> {
    return this.write(
      accreditedType,
      accreditedTypeStateUrl(accreditedType.code, false),
      HttpMethod.Patch,
      undefined,
      {},
      false
    );
  }

  // Las tres escrituras devuelven el rol completo, así que la fila se reemplaza en
  // el store con lo que respondió el backend y la tabla se repinta sin volver a
  // pedir el catálogo del evento.
  private async write(
    accreditedType: AccreditedType,
    url: string,
    method: HttpMethod,
    payload: AccreditedTypeUpdatePayload | undefined,
    permissionNames: Record<number, string>,
    isActive?: boolean
  ): Promise<AccreditedType> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditedTypeResponse>({
          code: accreditedType.code,
          id: Number(accreditedType.id),
          role_name: payload?.role_name ?? accreditedType.typeName,
          role_code: payload?.role_code ?? accreditedType.roleCode,
          event_id: accreditedType.eventId,
          is_active: isActive ?? accreditedType.isActive,
          access_deadline:
            payload?.access_deadline ??
            accreditedType.accessDeadline?.toISOString() ??
            null,
          permissions: (
            payload?.permissions ??
            // Sin payload —los toggles— la lista se rehace desde la entidad, y lleva `order`
            // por su POSICIÓN para no mentir sobre lo que se enviaría. Ojo que este camino es
            // solo el de demo: activar e inactivar de verdad son PATCH sin cuerpo, así que no
            // mandan permisos y el cambio de SUV2-2330 no los toca.
            accreditedType.permissions.map((permission, posicion) => ({
              permission_id: permission.permissionId,
              max_uses_per_person: permission.maxUsesPerPerson,
              order: posicion + 1
            }))
          ).map((permission) => ({
            permission_id: permission.permission_id,
            permission_name:
              permissionNames[permission.permission_id] ??
              accreditedType.permissions.find(
                (item) => item.permissionId === permission.permission_id
              )?.permissionName ??
              'Permiso',
            has_limit: permission.max_uses_per_person !== null,
            max_uses_per_person: permission.max_uses_per_person,
            order: permission.order
          }))
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditedTypeResponse>(url, method, {
            // Los toggles no llevan cuerpo; el PUT sí.
            ...(payload ? { payload } : {})
          })
        ));

    const updated = responseToAccreditedType(response);

    this.list?.refresh(updated);

    return updated;
  }
}

registerDependency(AccreditedTypeRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});

// El catálogo de tipos para quien necesita los del evento y no los que alguien dejó
// filtrados en la pantalla de parametrización: `queryParams` vive en la instancia y las
// dependencias son singleton, así que compartirla dejaría el modal de emisión
// ofreciendo solo lo buscado allá. Mismo motivo que en permisos.
export class AccreditedTypeCatalogRepository extends AccreditedTypeRepository {}

registerDependency(AccreditedTypeCatalogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
