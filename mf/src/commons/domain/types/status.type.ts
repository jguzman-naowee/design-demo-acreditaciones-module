export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

// Estado de un lote: PENDING mientras no se descarga; DOWNLOADED cuando ya se
// descargó y sus acreditaciones quedaron registradas como impresas.
export type BatchStatus = 'PENDING' | 'DOWNLOADED';

// Eje independiente del de CatalogStatus: una acreditación activa puede estar
// generada (impresa pero sin entregar) o ya entregada a su titular.
export type DeliveryStatus = 'PENDING' | 'DELIVERED';

// Ciclo de vida que registra el historial de una acreditación. Las dos últimas
// son lecturas en los accesos del evento: lo que ve Control de accesos.
export type AccreditationAction =
  | 'GENERATED'
  | 'PRINTED'
  | 'DELIVERED'
  | 'DEACTIVATED'
  | 'SCANNED_OK'
  | 'SCANNED_ERROR';

// Las acciones que registra el control de accesos, para recortar la bitácora.
export const VALIDATION_ACTIONS: AccreditationAction[] = [
  'SCANNED_OK',
  'SCANNED_ERROR'
];
