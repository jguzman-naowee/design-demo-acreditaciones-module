import {
  Accreditation,
  AccreditationPermission
} from '../../domain/entities/accreditation';
import type {
  AccreditationPermissionResponse,
  AccreditationResponse
} from '../models/accreditation.model';
import { toBackendDate } from './backend-date';

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
    response.file_icon_upload_id ?? null
  );
}

export function responseToAccreditation(
  response: AccreditationResponse
): Accreditation {
  return new Accreditation(
    response.id,
    response.batch_id,
    response.batch_number,
    response.accredited_type,
    response.document_type,
    response.document,
    response.name,
    response.second_name,
    response.last_name,
    response.second_last_name,
    response.sex,
    response.email,
    response.delegation,
    response.user_type,
    response.role,
    response.validation_code,
    response.validations,
    response.validation_limit,
    toBackendDate(response.created_at),
    toBackendDate(response.expires_at),
    toBackendDate(response.printed_at),
    toBackendDate(response.modified_at),
    response.status,
    response.delivery_status,
    (response.permissions ?? []).map(responseToPermission)
  );
}
