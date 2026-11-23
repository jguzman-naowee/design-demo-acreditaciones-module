// AccreditationMsEventResponse. El `id` entero es el `event_id` que exigen
// POST /roles y POST /accreditations.
export interface EventRegistrationResponse {
  id: number;
  event_code: string;
  event_name: string;
  phase_code?: string | null;
  phase_name?: string | null;
  // La fila de un momento de la fase; nulo = la fase entera.
  moment_code?: string | null;
  moment_name?: string | null;
  created_at?: string | null;
}

// GET /v1/accreditation/events?event_code={uuid}&phase_code={uuid} — el lookup
// del event_id. Viene envuelto en `data` pero SIN `meta`: no es el sobre paginado
// de /permissions y /roles. `data: []` significa que orc todavía no registró ese
// par evento+fase. Los dos códigos se validan como uuid (400 si vienen mal).
//
// Con `phase_code` la respuesta trae 0 o 1 filas; sin él, una por fase
// registrada, en orden de id ascendente.
export interface EventRegistrationsResponse {
  data: EventRegistrationResponse[];
}

// GET /v1/accreditation/events/catalog?page=&limit=&search= — los eventos que tienen
// acreditación configurada, UNA fila por evento (el lookup de arriba trae una por PAR
// evento+fase, así que un evento con tres fases aparecía tres veces). Paginado con el
// {data, meta} del módulo y con `search` por nombre, parcial y tolerante a tildes.
//
// Se aceptan las dos convenciones del nombre por lo mismo que arriba: la fila de eventos
// no tiene contrato fijado y el gateway ha usado las dos.
export interface EventCatalogResponse {
  event_code: string;
  event_name?: string;
  name?: string;
  start_date?: string | null;
}

// GET /public-gateway/v1/event/{code} — el detalle de orc. Solo se leen las fases:
// las que tienen `has_accreditation_process` son las que el módulo registra, y su
// `code` es el mismo uuid que allá se llama `phase_code`.
export interface SuiteEventPhaseResponse {
  code: string;
  name: string;
  sequence_number?: number;
  has_accreditation_process?: boolean;
  // La fecha que el catálogo no manda. Medido en staging: acá sí viene, por fase.
  start_date?: string | null;
  // Momentos de la fase (DEP-377). Solo viene en las fases divididas; cada uno se acredita
  // por separado.
  moments?: SuiteEventPhaseMomentResponse[] | null;
}

export interface SuiteEventPhaseMomentResponse {
  code: string;
  name: string;
  sport_codes?: string[];
}

export interface SuiteEventDetailResponse {
  event_code: string;
  name: string;
  phases?: SuiteEventPhaseResponse[];
}
