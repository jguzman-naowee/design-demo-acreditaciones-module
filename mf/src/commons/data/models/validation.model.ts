// La validación en punto de acceso, medida contra dev el 2026-08-13 con el token que
// salió del QR del carnet.
//
//   POST /v1/accreditation/accreditations/validate
//   GET  /v1/accreditation/validation-logs?event_id=&validator_user_code=&accreditation_code=
//   GET  /v1/accreditation/validators?event_id=
//
// Tres cosas que no son obvias:
//
// - El token NO es el del perfil público. El carnet lleva DOS QRs: el del reverso
//   abre la credencial pública con `qr_public_token`, y el del anverso trae el
//   `qr_validation_token` desnudo, que es el que se manda acá. Ningún GET lo expone:
//   solo existe impreso en el carnet.
// - **Tener el permiso `accreditation:validate` no alcanza**: el usuario además tiene
//   que estar registrado como VALIDADOR de ese permiso en ese evento
//   (POST /validators). Si no, todo vuelve DENIED con «No estás autorizado para
//   validar este permiso en el evento», que es lo que se muestra tal cual.
// - Los intentos DENEGADOS **sí quedan** en `validation-logs`, con su motivo. Acá decía lo
//   contrario —«comprobado: tres denegados y el log siguió vacío», del 2026-08-13— y dejó de
//   ser cierto en algún despliegue posterior sin que nadie lo mirara: medido el 2026-09-03
//   sobre el evento 1, de sus 14 lecturas SIETE son `DENIED` y traen `denial_reason`
//   redactado en español. El historial de la acreditación sigue registrando el VALIDATED.

export interface ValidationPayload {
  qr_validation_token: string;
  // Los permisos que el validador consume en esta lectura; al menos uno.
  permission_ids: number[];
  observation?: string;
}

export interface ValidationResultResponse {
  permission_id: number;
  // Null cuando la acreditación no tiene ese permiso.
  permission_name?: string | null;
  // GRANTED | DENIED
  result: string;
  // El motivo del rechazo, en español y listo para mostrar.
  reason?: string | null;
  used_count?: number | null;
  max_uses_per_person?: number | null;
}

// La respuesta identifica a la persona incluso cuando todo sale denegado: en la puerta
// hace falta saber a quién se le está negando el paso.
export interface ValidationResponse {
  accreditation_code: string;
  full_name: string;
  role_name?: string | null;
  status: string;
  results: ValidationResultResponse[];
}

// Una lectura registrada, concedida o denegada. Los campos son los medidos en dev el
// 2026-09-03; antes acá se declaraban cinco de nueve.
export interface ValidationLogResponse {
  // El consecutivo de la lectura. Es la identidad real de la fila: antes se componía una a
  // mano con código+permiso+fecha porque no se sabía que este campo existía.
  id: number;
  accreditation_code: string;
  validator_user_code: string;
  // El NOMBRE del validador. Existe desde el despliegue del 31 de agosto; las lecturas
  // anteriores llegan sin la clave y se quedan sin nombre.
  validator_user_name?: string | null;
  permission_id: number;
  permission_name?: string | null;
  // GRANTED | DENIED.
  validation_result: string;
  observation?: string | null;
  // Por qué se denegó, redactado por el backend y listo para mostrar: «No estás autorizado
  // para validar este permiso en el evento». Vacío en las concedidas.
  denial_reason?: string | null;
  // Los usos de ese permiso CONGELADOS en el momento de la lectura, no los de ahora: es lo
  // que hace auditable un «11/30» de hace tres días. Llegan en null en las denegadas, que no
  // consumen nada.
  used_count?: number | null;
  max_uses_per_person?: number | null;
  scanned_at: string;
}

// POST /validators devuelve un ARRAY plano (una fila por permiso), no el sobre {data}.
export interface ValidatorResponse {
  code: string;
  validator_user_code: string;
  event_id: number;
  permission_id: number;
  permission_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
}
