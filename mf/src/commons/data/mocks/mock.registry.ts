import {
  ACCESS_PERMISSIONS_URL,
  ACCREDITATIONS_URL,
  ACCREDITED_TYPES_URL,
  CERTIFICATE_BATCHES_URL,
  CERTIFICATES_URL,
  EVENT_CATALOG_URL} from '../config/api-config';
import { ACCREDITATIONS_MOCK } from './accreditation.mock';
import { ACCREDITATION_BATCHES_MOCK } from './accreditation-batch.mock';
import { ACCREDITATION_EVENTS_MOCK } from './accreditation-event.mock';
import { ACCREDITED_RECORDS_MOCK } from './accredited-record.mock';
import { ENABLED_PEOPLE_MOCK } from './enabled-person.mock';
import { SUITE_EVENTS_MOCK } from './suite-event.mock';

// Sobre paginado del gateway: {data, meta}. Los catálogos de parametrización
// arrancan vacíos a propósito, para que el camino mock siga mostrando el estado
// vacío del diseño.
function emptyPage(): unknown {
  return { data: [], meta: { total: 0, page: 1, limit: 100, last_page: 1 } };
}

// TODO(api): las cuatro colecciones sin contrato en el gateway (acreditaciones,
// lotes, bitácora y personas habilitadas) siguen resolviéndose contra este
// registro por el MockApiClient. Las rutas sin entrada responden lista vacía.
// Ojo: EntityRepository.refresh() borra la caché y vuelve a leer estas
// semillas, así que las pantallas no deben llamar refresh() o se perdería lo
// creado en memoria.
//
// Las tres rutas que sí tienen contrato guardan la respuesta con la forma
// congelada del gateway, para que el interruptor de demo ejercite los mismos
// factories que el camino real.
export const MOCK_RESPONSES: Record<string, unknown> = {
  '/accreditation-batches': ACCREDITATION_BATCHES_MOCK,
  '/accreditation-events': ACCREDITATION_EVENTS_MOCK,
  '/accreditations': ACCREDITATIONS_MOCK,
  '/enabled-people': ENABLED_PEOPLE_MOCK,
  [ACCESS_PERMISSIONS_URL]: emptyPage(),
  // Certificados de participación: en demo las listas arrancan vacías.
  [CERTIFICATE_BATCHES_URL]: { batches: [], meta: { total: 0, page: 1, limit: 50, last_page: 1 } },
  [CERTIFICATES_URL]: { certificates: [], meta: { total: 0, page: 1, limit: 50, last_page: 1 } },
  [ACCREDITED_TYPES_URL]: emptyPage(),
  [ACCREDITATIONS_URL]: ACCREDITED_RECORDS_MOCK,
  // La pantalla de entrada lee el catálogo del módulo; en demo se le sirven eventos de
  // mentira, porque sin ellos no se podría elegir nada y el módulo entero quedaría
  // inaccesible con el interruptor puesto.
  [EVENT_CATALOG_URL]: {
    data: SUITE_EVENTS_MOCK,
    meta: {
      total: SUITE_EVENTS_MOCK.length,
      page: 1,
      limit: 100,
      last_page: 1
    }
  }
};
