import type { EventCatalogResponse } from '../models/suite-event.model';

// Eventos de ejemplo para el interruptor de demo. En el camino real salen del catálogo del
// módulo (GET /v1/accreditation/events/catalog), que es el que lista los eventos con
// acreditación configurada.
export const SUITE_EVENTS_MOCK: EventCatalogResponse[] = [
  {
    event_code: '80fd12ca-337b-417b-83cd-fe39ad4a343a',
    name: 'Juegos Nacionales 2026',
    start_date: '2026-09-01T08:00:00Z'
  },
  {
    event_code: 'a6f0c5b1-2d34-4c8e-9b57-1f7e2d9a4c10',
    name: 'Festival Deportivo Escolar',
    start_date: '2026-10-15T08:00:00Z'
  }
];
