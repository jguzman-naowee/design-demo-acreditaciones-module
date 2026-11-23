import type { AccreditationBatchResponse } from '../models/accreditation-batch.model';

// TODO(api): lotes de ejemplo mientras el gateway expone /accreditation-batches.
// Alimentan los contadores de la franja superior y el correlativo del lote.
export const ACCREDITATION_BATCHES_MOCK: AccreditationBatchResponse[] = [
  {
    id: 'batch-320',
    number: 320,
    created_at: '2026-07-28T10:15:00.000Z',
    total: 200,
    delivered: 120,
    status: 'DOWNLOADED',
    people: [
      {
        accredited_type: 'Deportista',
        document: '150001002001',
        full_name: 'Andrés Camilo Martínez Rodríguez'
      },
      {
        accredited_type: 'Delegado',
        document: '150001002002',
        full_name: 'Paula Fernanda Ossa'
      }
    ]
  },
  {
    id: 'batch-319',
    number: 319,
    created_at: '2026-07-21T14:40:00.000Z',
    total: 154,
    delivered: 154,
    status: 'DOWNLOADED',
    people: [
      {
        accredited_type: 'Voluntario',
        document: '150001001001',
        full_name: 'Sara Lucía Beltrán'
      }
    ]
  }
];
