// GET /v1/accreditation/persons?document_number= — la persona acreditable. Es la
// única fuente de los nombres por separado: el listado y el detalle de la
// acreditación traen `full_name` aplanado.
//
// Devuelve `{data: []}` cuando no existe, sin `meta`, así que sirve además para
// saber si alguien ya está registrado sin provocar el 409 del POST.
export interface AccreditationPersonResponse {
  code: string;
  user_code?: string | null;
  document_number: string;
  name?: string | null;
  second_name?: string | null;
  last_name?: string | null;
  second_last_name?: string | null;
  sex?: string | null;
  email?: string | null;
  // Delegación; hoy ausente en dev (backfill pendiente).
  department_code?: string | null;
  department_name?: string | null;
}

export interface AccreditationPersonsResponse {
  data: AccreditationPersonResponse[];
}

// POST /v1/accreditation/persons — registrar a la persona acreditable.
//
// `user_code` es obligatorio y desde el 2026-08-13 el backend comprueba que ese
// usuario exista en la plataforma: un uuid inventado responde 404.
export interface AccreditationPersonPayload {
  user_code: string;
  document_number: string;
  name?: string;
  second_name?: string;
  last_name?: string;
  second_last_name?: string;
  sex?: string;
  email?: string;
  // Sin ellos la persona queda sin delegación y no hay PATCH que la corrija.
  department_code?: string;
  department_name?: string;
}
