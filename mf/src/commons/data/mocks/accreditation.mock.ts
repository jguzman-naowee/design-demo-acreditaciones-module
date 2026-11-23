import type { AccreditationResponse } from '../models/accreditation.model';

// TODO(api): acreditaciones de ejemplo mientras el gateway expone
// /accreditations. Corresponden a los lotes sembrados (319 y 320), cuyo total
// es mayor que el detalle de personas que traen.
// Todas nacen delivery_status PENDING: el contador de entregadas suma el
// histórico de los lotes más lo que se entregue aquí, así que sembrarlas como
// entregadas las contaría dos veces.
export const ACCREDITATIONS_MOCK: AccreditationResponse[] = [
  {
    id: 'acc-01',
    batch_id: 'batch-320',
    batch_number: 320,
    accredited_type: 'Deportista',
    document_type: 'CC',
    document: '150001002001',
    name: 'Andrés',
    second_name: 'Camilo',
    last_name: 'Martínez',
    second_last_name: 'Rodríguez',
    sex: 'H',
    email: 'andres.martinez@naowee.com',
    delegation: 'Antioquia',
    user_type: 'Anónimo',
    role: 'Acreditado',
    validation_code: '00000001',
    validations: 10,
    validation_limit: 30,
    created_at: '2026-07-28T10:15:00.000Z',
    expires_at: '2027-07-28T10:15:00.000Z',
    printed_at: '2026-07-28T11:00:00.000Z',
    modified_at: null,
    status: 'ACTIVE',
    delivery_status: 'PENDING',
    // Los permisos del rol, con la forma del contrato real. El icono del primero
    // es un upload_id de verdad de dev, para que el perfil pinte un svg real.
    permissions: [
      {
        permission_id: 5,
        permission_name: 'Alimentación',
        has_limit: true,
        max_uses_per_person: 5,
        used_count: 2,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE',
        file_icon_upload_id: '9b90d0f7-6375-4551-9329-b2d1ff43c933'
      },
      {
        permission_id: 6,
        permission_name: 'Áreas de prensa',
        has_limit: false,
        used_count: 0,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE'
      }
    ]
  },
  {
    id: 'acc-02',
    batch_id: 'batch-320',
    batch_number: 320,
    accredited_type: 'Delegado',
    document_type: 'CC',
    document: '150001002002',
    name: 'Paula',
    second_name: 'Fernanda',
    last_name: 'Ossa',
    second_last_name: '',
    sex: 'M',
    email: 'paula.ossa@naowee.com',
    delegation: 'Bolívar',
    user_type: 'Anónimo',
    role: 'Acreditado',
    validation_code: '00000002',
    validations: 9,
    validation_limit: 20,
    created_at: '2026-07-28T10:15:00.000Z',
    expires_at: '2027-07-28T10:15:00.000Z',
    printed_at: '2026-07-28T11:00:00.000Z',
    modified_at: null,
    status: 'ACTIVE',
    delivery_status: 'PENDING',
    // Los permisos del rol, con la forma del contrato real. El icono del primero
    // es un upload_id de verdad de dev, para que el perfil pinte un svg real.
    permissions: [
      {
        permission_id: 5,
        permission_name: 'Alimentación',
        has_limit: true,
        max_uses_per_person: 5,
        used_count: 2,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE',
        file_icon_upload_id: '9b90d0f7-6375-4551-9329-b2d1ff43c933'
      },
      {
        permission_id: 6,
        permission_name: 'Áreas de prensa',
        has_limit: false,
        used_count: 0,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE'
      }
    ]
  },
  {
    id: 'acc-03',
    batch_id: 'batch-319',
    batch_number: 319,
    accredited_type: 'Voluntario',
    document_type: 'TI',
    document: '150001001001',
    name: 'Sara',
    second_name: 'Lucía',
    last_name: 'Beltrán',
    second_last_name: '',
    sex: 'M',
    email: 'sara.beltran@naowee.com',
    delegation: 'Caldas',
    user_type: 'Anónimo',
    role: 'Acreditado',
    validation_code: '00000003',
    validations: 8,
    validation_limit: 10,
    created_at: '2026-07-21T14:40:00.000Z',
    expires_at: '2027-07-21T14:40:00.000Z',
    printed_at: '2026-07-21T15:10:00.000Z',
    modified_at: null,
    status: 'ACTIVE',
    delivery_status: 'PENDING',
    // Los permisos del rol, con la forma del contrato real. El icono del primero
    // es un upload_id de verdad de dev, para que el perfil pinte un svg real.
    permissions: [
      {
        permission_id: 5,
        permission_name: 'Alimentación',
        has_limit: true,
        max_uses_per_person: 5,
        used_count: 2,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE',
        file_icon_upload_id: '9b90d0f7-6375-4551-9329-b2d1ff43c933'
      },
      {
        permission_id: 6,
        permission_name: 'Áreas de prensa',
        has_limit: false,
        used_count: 0,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE'
      }
    ]
  },
  {
    id: 'acc-04',
    batch_id: 'batch-319',
    batch_number: 319,
    accredited_type: 'Voluntario',
    document_type: 'CC',
    document: '150001003089',
    name: 'Juan',
    second_name: 'Sebastián',
    last_name: 'Molina',
    second_last_name: '',
    sex: 'H',
    email: 'juan.molina@naowee.com',
    delegation: 'Atlántico',
    user_type: 'Anónimo',
    role: 'Acreditado',
    validation_code: '00000004',
    validations: 3,
    validation_limit: 10,
    created_at: '2026-07-21T14:40:00.000Z',
    expires_at: '2027-07-21T14:40:00.000Z',
    printed_at: '2026-07-21T15:10:00.000Z',
    modified_at: '2026-07-30T09:05:00.000Z',
    status: 'INACTIVE',
    delivery_status: 'PENDING',
    // Los permisos del rol, con la forma del contrato real. El icono del primero
    // es un upload_id de verdad de dev, para que el perfil pinte un svg real.
    permissions: [
      {
        permission_id: 5,
        permission_name: 'Alimentación',
        has_limit: true,
        max_uses_per_person: 5,
        used_count: 2,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE',
        file_icon_upload_id: '9b90d0f7-6375-4551-9329-b2d1ff43c933'
      },
      {
        permission_id: 6,
        permission_name: 'Áreas de prensa',
        has_limit: false,
        used_count: 0,
        valid_from: '2026-08-01T00:00:00',
        valid_to: '2026-12-31T23:59:59',
        status: 'ACTIVE'
      }
    ]
  }
];
