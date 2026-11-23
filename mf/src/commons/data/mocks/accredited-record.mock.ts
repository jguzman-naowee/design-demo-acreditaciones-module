import type { AccreditedRecordResponse } from '../models/accredited-record.model';
import { ACCREDITATIONS_MOCK } from './accreditation.mock';

// El sobre {data, meta, summary} tal como lo devuelve el gateway, derivado de las
// mismas semillas que usa la sección de Entrega para que el interruptor de demo
// ejercite los mismos factories que el camino real.
const data: AccreditedRecordResponse[] = ACCREDITATIONS_MOCK.map((item) => ({
  code: item.id,
  event_id: 1,
  document_number: item.document,
  full_name: [item.name, item.second_name, item.last_name, item.second_last_name]
    .filter(Boolean)
    .join(' '),
  role_code: item.accredited_type.toUpperCase(),
  role_name: item.accredited_type,
  status: item.status,
  permissions_total: item.permissions.length,
  uses_consumed: item.validations,
  created_at: item.created_at
}));

export const ACCREDITED_RECORDS_MOCK = {
  data,
  meta: { total: data.length, page: 1, limit: 10, last_page: 1 },
  summary: {
    total: data.length,
    by_status: data.reduce<Record<string, number>>((result, item) => {
      result[item.status] = (result[item.status] ?? 0) + 1;

      return result;
    }, {})
  }
};
