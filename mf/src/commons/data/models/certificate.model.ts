// Certificados de participación: configuración por evento+fase, generación
// (masiva por deporte o individual por user_codes) y consulta. Contrato medido
// contra stg el 2026-09-07 (E2E completo con el backend recién desplegado).
//
//   PUT  /accreditation/events/{eventCode}/certificates/config
//   GET  /accreditation/events/{eventCode}/certificates/config?phase_code=
//   POST /accreditation/events/{eventCode}/certificates          → 202-style
//   GET  /accreditation/certificates?event_code=&search=
//   GET  /accreditation/certificates/batches?event_code=
//   GET  /accreditation/certificates/batches/{code}
//
// Dos cosas no obvias:
// - La fecha impresa se resuelve al generar: delivery_date del POST > fecha del
//   deporte > default (sport_code null). Sin ninguna → 422.
// - El PDF es uno por persona; el lote cierra COMPLETED cuando todos existen en
//   S3 (medido: ~12-15 s por certificado en stg).

export interface CertificateSportDateResponse {
  // null = la fecha default del evento/fase.
  sport_code: string | null;
  delivery_date: string;
  enabled: boolean;
}

export interface CertificateConfigResponse {
  code: string;
  event_code: string;
  phase_code: string | null;
  template_code: string;
  enabled: boolean;
  sports: CertificateSportDateResponse[];
}

export interface CertificateConfigPayload {
  phase_code?: string;
  // Con la fase dividida, cada momento tiene su propia configuración.
  moment_code?: string;
  template_code: string;
  enabled: boolean;
  sports: {
    sport_code: string | null;
    delivery_date: string;
    enabled: boolean;
  }[];
}

export interface GenerateCertificatesPayload {
  phase_code?: string;
  moment_code?: string;
  // Exactamente uno de los tres modos.
  sport_code?: string;
  user_codes?: string[];
  // Individual por acreditación: única vía para el personal de misión (sin user_code).
  accreditation_codes?: string[];
  // Pisa la fecha configurada.
  delivery_date?: string;
}

// POST → 202-style.
export interface CertificateBatchRequestedResponse {
  batch_code: string;
  total_certificates: number;
  delivery_date: string;
}

export interface CertificateItemResponse {
  code: string;
  accreditation_code: string;
  user_code: string | null;
  full_name: string;
  document_number: string;
  role_name: string;
  sport_code: string | null;
  delivery_date: string;
  upload_id: string | null;
  status: string;
  error_detail: string | null;
  batch_code: string | null;
  created_at: string | null;
}

export interface CertificateBatchResponse {
  batch_code: string;
  event_code: string;
  kind: string;
  sport_code: string | null;
  delivery_date: string;
  status: string;
  total_certificates: number;
  error_detail: string | null;
  certificates: CertificateItemResponse[];
}

export interface CertificateBatchListItemResponse {
  batch_code: string;
  event_code: string;
  kind: string;
  sport_code: string | null;
  delivery_date: string;
  status: string;
  total_certificates: number;
  requested_by: string | null;
  created_at: string | null;
}

export interface CertificateBatchesPageResponse {
  batches: CertificateBatchListItemResponse[];
  meta: { total: number; page: number; limit: number; last_page: number };
}

export interface CertificatesPageResponse {
  certificates: CertificateItemResponse[];
  meta: { total: number; page: number; limit: number; last_page: number };
}

// GET /event-rules/{eventCode}/sports?phase_code= — deportes configurados del
// evento (competition-rules), para las filas de fecha por deporte.
export interface EventSportSummaryResponse {
  sport_code: string;
  sport_name: string;
  sport_type: string;
}

// Recorte del listado de acreditaciones para el selector de generación
// individual: solo lo que la búsqueda pinta.
export interface ActiveAccreditationResponse {
  code: string;
  user_code: string | null;
  full_name: string;
  document_number: string;
  role_name: string | null;
}

export interface ActiveAccreditationsPageResponse {
  data: ActiveAccreditationResponse[];
}
