// Contrato congelado del gateway: AccreditationMsPermissionResponse.
// GET/POST /v1/accreditation/permissions · PATCH /v1/accreditation/permissions/{code}
// PATCH .../{code}/activate · PATCH .../{code}/deactivate
export interface AccessPermissionResponse {
  // El identificador de las escrituras: los PATCH van por `code` (uuid), NO por el
  // `id` numérico, que es el que usan las asignaciones a los roles.
  code: string;
  id: number;
  name: string;
  description?: string | null;
  has_limit: boolean;
  // upload_id de file-storage, no el nombre del archivo.
  file_icon_upload_id?: string | null;
  // Texto libre, sin catálogo: es lo que el diseño llamaba «zonas/sedes».
  zone_name?: string | null;
  venue_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

// AccreditationMsCreatePermissionRequest. Solo `name` es obligatorio; `has_limit`
// no es puntero en el contrato, así que omitirlo equivale a false.
export interface AccessPermissionPayload {
  name: string;
  description?: string;
  has_limit: boolean;
  file_icon_upload_id?: string;
  zone_name?: string;
  venue_name?: string;
}

// AccreditationMsUpdatePermissionRequest: edición PARCIAL, solo se aplica lo que se
// manda. Por eso todo es opcional y el icono se omite cuando no se cambia —mandarlo
// vacío lo borraría—. Activar e inactivar NO van acá, tienen sus propios endpoints.
//
// Dos reglas del backend que la pantalla tiene que saber contar:
// - Pasar `has_limit` a true da 409 si el permiso ya está asignado a algún rol.
// - Un permiso inactivo no se puede asignar a un tipo de acreditado nuevo (409).
export interface AccessPermissionUpdatePayload {
  name?: string;
  description?: string;
  has_limit?: boolean;
  file_icon_upload_id?: string;
  zone_name?: string;
  venue_name?: string;
}
