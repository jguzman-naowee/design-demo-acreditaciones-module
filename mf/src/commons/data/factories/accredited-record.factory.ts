import { AccreditationPermission } from '../../domain/entities/accreditation';
import {
  AccreditationAudit,
  AccreditationSportsInfo
} from '../../domain/entities/accredited-record';
import {
  AccreditedRecord,
  AccreditedRecordDetail
} from '../../domain/entities/accredited-record';
import { cleanName } from '../helpers/name.helper';
import type { AccreditationPermissionResponse } from '../models/accreditation.model';
import type {
  AccreditationAuditResponse,
  AccreditationEventAuditResponse,
  AccreditedRecordDetailResponse,
  AccreditedRecordResponse
} from '../models/accredited-record.model';
import { toBackendDate } from './backend-date';
import { toRoleLabel } from './role-name';

export function responseToAccreditedRecord(
  response: AccreditedRecordResponse
): AccreditedRecord {
  return new AccreditedRecord(
    response.code,
    response.event_id,
    response.document_number,
    response.full_name,
    response.role_code,
    // role_name es opcional en el contrato; el código sirve de respaldo para no
    // pintar una fila sin tipo.
    toRoleLabel(response.role_name, response.role_code),
    response.status,
    response.permissions_total,
    response.uses_consumed,
    toBackendDate(response.created_at),
    response.department_name ?? '',
    toBackendDate(response.delivered_at),
    response.delivered_by_code ?? null,
    // El listado manda esto y NO la fecha; el detalle, al revés.
    response.delivery_status ?? null,
    toBackendDate(response.printed_at)
  );
}

function responseToPermission(
  response: AccreditationPermissionResponse
): AccreditationPermission {
  return new AccreditationPermission(
    response.permission_id,
    response.permission_name,
    response.has_limit,
    response.max_uses_per_person ?? null,
    response.used_count,
    toBackendDate(response.valid_from),
    toBackendDate(response.valid_to),
    response.file_icon_upload_id ?? null,
    response.zone_name ?? '',
    response.venue_name ?? ''
  );
}

export function responseToAccreditedRecordDetail(
  response: AccreditedRecordDetailResponse
): AccreditedRecordDetail {
  const permissions = (response.permissions ?? []).map(responseToPermission);

  return new AccreditedRecordDetail(
    response.code,
    response.event_id,
    response.document_number,
    response.full_name,
    response.role_code,
    toRoleLabel(response.role_name, response.role_code),
    response.status,
    // El detalle no manda los agregados del listado: se derivan de los permisos.
    //
    // `usesConsumed` ya NO se pinta en ninguna pantalla: QA lo mandó quitar del detalle el
    // 2026-09-17, un día después de llevarse la columna «Usos» de la tabla de permisos, y por
    // el mismo motivo. Este total era la suma de esa columna, así que solo sabía decir «0»:
    // depende del modelo de topes por permiso (`has_limit` / `max_uses_per_person`), que está
    // diseñado pero sin usar.
    //
    // Se mantiene el mapeo a propósito. El dato no estorba —viene en la respuesta que ya se
    // pide—, y el día que los topes se usen de verdad, volver a pintarlo es añadir el campo;
    // borrar esto obligaría a rehacer la derivación y a volver a averiguar por qué el detalle
    // no manda el agregado.
    response.permissions_total ?? permissions.length,
    response.uses_consumed ??
      permissions.reduce((total, permission) => total + permission.usedCount, 0),
    toBackendDate(response.created_at),
    response.department_name ?? '',
    toBackendDate(response.delivered_at),
    response.delivered_by_code ?? null,
    response.qr_public_token ?? null,
    toBackendDate(response.updated_at),
    permissions,
    response.sports_info
      ? new AccreditationSportsInfo(
          response.sports_info.sport_name ?? '',
          response.sports_info.category_name ?? '',
          response.sports_info.disciplines ?? []
        )
      : null,
    response.sports_info_error ?? null,
    response.photo_url ?? null,
    response.certificate_url ?? null,
    response.batch_code ?? null,
    response.batch_status ?? null,
    response.card_url ?? null,
    response.public_views_count ?? 0,
    response.platform_role ?? null
  );
}

export function responseToAccreditationAudit(
  response: AccreditationAuditResponse | AccreditationEventAuditResponse
): AccreditationAudit {
  return new AccreditationAudit(
    response.action,
    response.old_status ?? null,
    response.new_status ?? null,
    response.changed_by_code,
    toBackendDate(response.changed_at),
    response.comments ?? null,
    cleanName(response.changed_by_name),
    // Los tres solo llegan en la auditoría del evento; en el historial de una acreditación
    // vienen ausentes y se quedan en null.
    ('accreditation_code' in response ? response.accreditation_code : null) ??
      null,
    cleanName('full_name' in response ? response.full_name : null),
    ('document_number' in response ? response.document_number : null) ?? null
  );
}
