import {
  RoleCatalogFamily,
  RoleCatalogFunction,
  RoleCatalogType
} from '../../domain/entities/role-catalog';
import type {
  RoleCatalogFamilyResponse,
  RoleCatalogFunctionResponse,
  RoleCatalogTypeResponse
} from '../models/role-catalog.model';

function responseToType(
  response?: RoleCatalogTypeResponse | null
): RoleCatalogType | null {
  return response
    ? new RoleCatalogType(
        response.code,
        response.role_code,
        response.role_name,
        response.is_active
      )
    : null;
}

function responseToFunction(
  response: RoleCatalogFunctionResponse
): RoleCatalogFunction {
  return new RoleCatalogFunction(
    response.code,
    response.name,
    response.event_role_codes ?? [],
    // Sin él no se puede acreditar; se cae al código de la función, que es lo que el backend
    // usa cuando no hay uno propio.
    response.accredit_role_code || response.code,
    response.enrolled_count ?? null,
    responseToType(response.configured_type)
  );
}

export function responseToRoleCatalogFamily(
  response: RoleCatalogFamilyResponse
): RoleCatalogFamily {
  return new RoleCatalogFamily(
    response.code,
    response.name,
    response.identity_type ?? 'PLATFORM_USER',
    response.allows_functions ?? false,
    response.functions_source ?? 'NONE',
    responseToType(response.default_type),
    (response.functions ?? []).map(responseToFunction)
  );
}
