import type { NwtTheme } from '@naowee-tech/sdk-react-components';

// Los estados del lote son los del generador de PDFs, no los de un catálogo, así que
// tienen su propia tabla en lugar de reusar la de activo/inactivo. Viven acá porque los
// comparten el listado de lotes y su detalle.
//
// PENDING salió midiendo dev: son lotes que quedaron creados sin generarse nunca —los
// del 500 de POST /events/{code}/cards, con total_chunks en 0—. No se inventa un estado
// bonito para ellos: se dice que están pendientes y no se ofrece descarga.
export const CARD_BATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ENQUEUED: 'En cola',
  PROCESSING: 'Generando',
  COMPLETED: 'Listo',
  COMPLETED_WITH_ERRORS: 'Listo con errores',
  FAILED: 'Falló',
  // El que deja «Inactivar lote». Sin esto el badge pintaba el código crudo: QA lo vio como
  // «DELETED» en staging el 2026-09-22.
  DELETED: 'Inactivo'
};

export const CARD_BATCH_STATUS_THEMES: Record<string, NwtTheme> = {
  PENDING: 'neutral',
  ENQUEUED: 'informative',
  PROCESSING: 'informative',
  COMPLETED: 'positive',
  COMPLETED_WITH_ERRORS: 'warning',
  FAILED: 'negative',
  DELETED: 'neutral'
};

// Por qué un carnet no salió. Los del DESPACHO llegan como código y hay que traducirlos;
// los de la SELECCIÓN llegan ya redactados en español por el backend, y en la misma
// respuesta —medido en el test de accreditation-ms#110—, así que la caída es obligatoria.
const CARD_SKIP_REASONS: Record<string, string> = {
  PHOTO_MISSING: 'No tiene foto aprobada',
  ATHLETE_DATA_MISSING:
    'Al deportista le falta categoría o deporte en la inscripción',
  PERMISSION_ICON_UNRESOLVED: 'No se pudo cargar el icono de un permiso'
};

// Un código que no esté en la tabla se devuelve TAL CUAL, no vacío: si backend estrena un
// motivo, es mejor verlo raro que no ver ninguno.
export function cardSkipReasonLabel(reason: string): string {
  return CARD_SKIP_REASONS[reason] ?? reason;
}
