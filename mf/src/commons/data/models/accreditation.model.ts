// Este modelo es nuestro, de las pantallas con datos en memoria: la sección de
// Entrega sigue en mocks porque el backend no tiene lotes, entrega, inactivación
// ni bitácora (SUV2-1632).
//
// Lo que YA existe y hay que usar el día que se conecte, medido contra dev:
//   GET /v1/accreditation/accreditations?event_id&status&role_code&search&page&limit
//     → { data: [{ code, event_id, user_code, document_number, full_name,
//                  role_code, role_name, status, permissions_total,
//                  uses_consumed, created_at }],
//         meta: {…}, summary: { total, by_status } }   ← summary SOLO con event_id
//   GET /v1/accreditation/accreditations/{code}
//     → lo anterior + qr_public_token, updated_at y permissions[] (ocho campos)
//
// Y lo que NO alcanza, para no repetir el análisis: no hay lote (ni número ni id),
// ni vencimiento en el listado (solo por permiso en el detalle), ni estado de
// entrega, ni fecha de impresión, ni bitácora, ni tipo de documento, ni tipo de
// usuario, ni rol, ni delegación. Los nombres vienen aplanados en `full_name`; los
// separados están en GET /persons?document_number=.
//
// Dos reglas confirmadas por backend para el POST:
//   · `valid_from`/`valid_to` son LocalDateTime naive, en hora del evento
//     (America/Bogota) y sin `Z`: `2026-05-10T00:00:00`. Con `Z` responde 400.
//   · `status` hoy solo vale ACTIVE; SUSPENDED y REVOKED están diseñados pero sin
//     implementar, así que el mapeo debe tolerar valores nuevos.

// Permiso materializado en la acreditación, con la forma del contrato real
// (AccreditationMsPermissionUsageDetail).
export interface AccreditationPermissionResponse {
  permission_id: number;
  permission_name: string;
  has_limit: boolean;
  max_uses_per_person?: number | null;
  used_count: number;
  valid_from?: string | null;
  valid_to?: string | null;
  status: string;
  // No viene en el contrato del permiso de la acreditación: se cruza con el
  // catálogo para poder pintar el icono. Opcional a propósito.
  file_icon_upload_id?: string | null;
  // Estos sí llegan desde el paquete del 2026-08-13, y son los del permiso del
  // catálogo: texto libre, sin catálogo de zonas.
  zone_name?: string | null;
  venue_name?: string | null;
}

export interface AccreditationResponse {
  id: string;
  batch_id: string;
  batch_number: number;
  accredited_type: string;
  document_type: string;
  document: string;
  name: string;
  second_name: string;
  last_name: string;
  second_last_name: string;
  sex: string;
  email: string;
  delegation: string;
  user_type: string;
  role: string;
  validation_code: string;
  validations: number;
  validation_limit: number;
  created_at: string;
  expires_at: string | null;
  printed_at: string | null;
  modified_at: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  delivery_status: 'PENDING' | 'DELIVERED';
  permissions: AccreditationPermissionResponse[];
}
