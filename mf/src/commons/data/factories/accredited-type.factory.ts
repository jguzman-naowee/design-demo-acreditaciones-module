import {
  AccreditedType,
  AccreditedTypePermission
} from '../../domain/entities/accredited-type';
import type {
  AccreditedTypePermissionResponse,
  AccreditedTypeResponse
} from '../models/accredited-type.model';
import { toBackendDate } from './backend-date';
import { toRoleLabel } from './role-name';

function responseToPermission(
  response: AccreditedTypePermissionResponse
): AccreditedTypePermission {
  return new AccreditedTypePermission(
    response.permission_id,
    response.permission_name,
    response.has_limit,
    response.max_uses_per_person ?? null,
    response.order ?? undefined
  );
}

export function responseToAccreditedType(
  response: AccreditedTypeResponse
): AccreditedType {
  return new AccreditedType(
    response.id,
    response.code,
    // role_name es opcional en el contrato; el código sirve de respaldo para no
    // pintar una fila sin nombre.
    toRoleLabel(response.role_name, response.role_code),
    response.role_code,
    response.event_id,
    response.is_active,
    toBackendDate(response.access_deadline),
    // SIN ordenar: el contrato garantiza que vienen por `order` y así llegan —medido contra
    // staging el 2026-09-15 sobre los 6 tipos con permisos—. Un `sort` acá escondería el día
    // que backend dejara de cumplirlo, y eso hay que verlo, no taparlo.
    (response.permissions ?? []).map(responseToPermission),
    response.role_name ?? response.role_code,
    response.platform_role ?? undefined,
    response.platform_subrole ?? undefined
  );
}
