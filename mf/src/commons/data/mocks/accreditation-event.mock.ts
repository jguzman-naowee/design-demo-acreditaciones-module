import type { AccreditationEventResponse } from '../models/accreditation-event.model';

const AUTHOR = 'Andrea Montalvo Díaz';

// TODO(api): datos de ejemplo mientras el gateway expone /accreditation-events.
// Cada acreditación sembrada nace generada e impresa (sus lotes ya se
// descargaron); acc-04 además está inactiva, con el motivo que se registró.
export const ACCREDITATION_EVENTS_MOCK: AccreditationEventResponse[] = [
  {
    id: 'ev-01',
    accreditation_id: 'acc-01',
    accredited_type: 'Deportista',
    action: 'GENERATED',
    detail: 'Lote 320',
    note: '',
    validations: 0,
    created_at: '2026-07-28T10:15:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-02',
    accreditation_id: 'acc-01',
    accredited_type: 'Deportista',
    action: 'PRINTED',
    detail: '',
    note: '',
    validations: 0,
    created_at: '2026-07-28T11:00:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-03',
    accreditation_id: 'acc-02',
    accredited_type: 'Delegado',
    action: 'GENERATED',
    detail: 'Lote 320',
    note: '',
    validations: 0,
    created_at: '2026-07-28T10:15:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-04',
    accreditation_id: 'acc-02',
    accredited_type: 'Delegado',
    action: 'PRINTED',
    detail: '',
    note: '',
    validations: 0,
    created_at: '2026-07-28T11:00:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-05',
    accreditation_id: 'acc-03',
    accredited_type: 'Voluntario',
    action: 'GENERATED',
    detail: 'Lote 319',
    note: '',
    validations: 0,
    created_at: '2026-07-21T14:40:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-06',
    accreditation_id: 'acc-03',
    accredited_type: 'Voluntario',
    action: 'PRINTED',
    detail: '',
    note: '',
    validations: 0,
    created_at: '2026-07-21T15:10:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-07',
    accreditation_id: 'acc-04',
    accredited_type: 'Voluntario',
    action: 'GENERATED',
    detail: 'Lote 319',
    note: '',
    validations: 0,
    created_at: '2026-07-21T14:40:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-08',
    accreditation_id: 'acc-04',
    accredited_type: 'Voluntario',
    action: 'PRINTED',
    detail: '',
    note: '',
    validations: 0,
    created_at: '2026-07-21T15:10:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-09',
    accreditation_id: 'acc-04',
    accredited_type: 'Voluntario',
    action: 'DEACTIVATED',
    detail: '',
    note: 'El titular se retiró de la delegación antes del inicio del evento.',
    validations: 0,
    created_at: '2026-07-30T09:05:00.000Z',
    author: AUTHOR
  },
  // Lecturas en los accesos del evento: el contador de cada una es el que
  // llevaba la acreditación en ese momento, y el último cuadra con el que trae
  // hoy. TODO(diseño): las creará "Validar un participante" cuando tenga
  // captura; hasta entonces son semilla.
  {
    id: 'ev-10',
    accreditation_id: 'acc-01',
    accredited_type: 'Deportista',
    action: 'SCANNED_ERROR',
    detail: '',
    note: 'La acreditación no estaba habilitada para esa zona.',
    validations: 9,
    created_at: '2026-08-01T13:20:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-11',
    accreditation_id: 'acc-01',
    accredited_type: 'Deportista',
    action: 'SCANNED_OK',
    detail: '',
    note: '',
    validations: 10,
    created_at: '2026-08-01T14:05:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-12',
    accreditation_id: 'acc-02',
    accredited_type: 'Delegado',
    action: 'SCANNED_OK',
    detail: '',
    note: '',
    validations: 9,
    created_at: '2026-08-02T09:30:00.000Z',
    author: AUTHOR
  },
  {
    id: 'ev-13',
    accreditation_id: 'acc-03',
    accredited_type: 'Voluntario',
    action: 'SCANNED_OK',
    detail: '',
    note: '',
    validations: 8,
    created_at: '2026-08-03T16:45:00.000Z',
    author: AUTHOR
  }
];
