import { AccessPermission } from '../../domain/entities/access-permission';
import type { AccessPermissionResponse } from '../models/access-permission.model';

export function responseToAccessPermission(
  response: AccessPermissionResponse
): AccessPermission {
  return new AccessPermission(
    response.id,
    response.code,
    response.name,
    response.description ?? '',
    response.has_limit,
    response.file_icon_upload_id ?? null,
    response.zone_name ?? '',
    response.venue_name ?? '',
    response.is_active
  );
}
