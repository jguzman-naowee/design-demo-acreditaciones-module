import {
  AccreditationValidation,
  ValidationLog,
  ValidationResult
} from '../../domain/entities/accreditation-validation';
import { cleanName } from '../helpers/name.helper';
import type {
  ValidationLogResponse,
  ValidationResponse,
  ValidationResultResponse
} from '../models/validation.model';
import { toRoleLabel } from './role-name';

function responseToResult(
  response: ValidationResultResponse
): ValidationResult {
  return new ValidationResult(
    response.permission_id,
    response.permission_name ?? null,
    response.result,
    response.reason ?? null,
    response.used_count ?? null,
    response.max_uses_per_person ?? null
  );
}

export function responseToValidation(
  response: ValidationResponse
): AccreditationValidation {
  return new AccreditationValidation(
    response.accreditation_code,
    response.full_name,
    toRoleLabel(response.role_name),
    response.status,
    (response.results ?? []).map(responseToResult)
  );
}

export function responseToValidationLog(
  response: ValidationLogResponse
): ValidationLog {
  return new ValidationLog(
    response.id,
    response.accreditation_code,
    response.validator_user_code,
    response.permission_id,
    response.permission_name ?? `Permiso ${response.permission_id}`,
    response.validation_result,
    response.observation ?? '',
    new Date(response.scanned_at),
    response.denial_reason ?? '',
    response.used_count ?? null,
    response.max_uses_per_person ?? null,
    // Nombre o nada: una cadena vacía se pintaría como un separador suelto en la meta. Y
    // limpio: el backend lo arma juntando partes y manda dobles espacios.
    cleanName(response.validator_user_name)
  );
}
