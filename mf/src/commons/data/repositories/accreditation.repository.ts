import { type EntityId, EntityRepository } from '@naowee-tech/sdk-frontend-web';
import { clone } from '@rolster/commons';
import { registerDependency } from '@rolster/invertly';

import { Accreditation } from '../../domain/entities/accreditation';
import type { EnabledPerson } from '../../domain/entities/enabled-person';
import type { AccreditationAction } from '../../domain/types/status.type';
import { MockApiClient } from '../config/mock-api-client';
import { responseToAccreditation } from '../factories/accreditation.factory';
import { mockResponse } from '../mocks/mock.helper';
import type { AccreditationResponse } from '../models/accreditation.model';
import { AccreditationEventRepository } from './accreditation-event.repository';

const EXPIRATION_YEARS = 1;

// El mismo valor que trae por defecto el formulario de tipos de acreditado.
const DEFAULT_VALIDATION_LIMIT = 30;

// Los permisos que el backend materializa a partir del rol; mientras la creación
// viva en memoria se replican acá para que las pantallas no vean acreditaciones
// sin permisos.
const NEW_ACCREDITATION_PERMISSIONS = [
  {
    permission_id: 5,
    permission_name: 'Alimentación',
    has_limit: true,
    max_uses_per_person: 5,
    used_count: 0,
    status: 'ACTIVE',
    file_icon_upload_id: '9b90d0f7-6375-4551-9329-b2d1ff43c933'
  },
  {
    permission_id: 6,
    permission_name: 'Áreas de prensa',
    has_limit: false,
    used_count: 0,
    status: 'ACTIVE'
  }
];

export class AccreditationRepository extends EntityRepository<
  Accreditation,
  AccreditationResponse
> {
  constructor(
    apiClient: MockApiClient,
    private readonly eventRepository: AccreditationEventRepository
  ) {
    super(apiClient, '/accreditations', responseToAccreditation);
  }

  // TODO(api): sin contrato en el gateway; las acreditaciones viven en memoria
  // y se pierden al recargar. Al existir el endpoint, reemplazar por
  // HttpEndpoint.
  // Recibe los habilitados completos (no el BatchPerson del detalle del lote)
  // para que el detalle del acreditado no pierda documento, sexo ni correo.
  public async createFromBatch(
    batchId: EntityId,
    batchNumber: number,
    people: EnabledPerson[]
  ): Promise<Accreditation[]> {
    // El store solo existe después del primer requestAll; sin esto, unshift
    // sería un no-op silencioso cuando el lote se genera sin haber entrado
    // nunca a la lista de acreditados.
    await this.requestAll();

    const createdAt = new Date();
    const expiresAt = new Date(createdAt);

    expiresAt.setFullYear(expiresAt.getFullYear() + EXPIRATION_YEARS);

    // TODO(api): el id de validación lo emitirá el backend; aquí se numera
    // correlativo sobre lo que ya existe.
    const nextCode = this.items.length;

    const responses = await mockResponse<AccreditationResponse[]>(
      people.map((person, index) => ({
        id: crypto.randomUUID(),
        // Entity.id admite número; sobre el cable el id siempre viaja en texto.
        batch_id: String(batchId),
        batch_number: batchNumber,
        accredited_type: person.accreditedType,
        document_type: person.documentType,
        document: person.document,
        name: person.firstName,
        second_name: person.secondName,
        last_name: person.lastName,
        second_last_name: person.secondLastName,
        sex: person.sex,
        email: person.email,
        delegation: person.delegation,
        // TODO(api): ni el habilitado ni el formulario traen tipo de usuario ni
        // rol todavía.
        user_type: 'Anónimo',
        role: 'Acreditado',
        validation_code: String(nextCode + index + 1).padStart(8, '0'),
        validations: 0,
        // TODO(api): el tope lo define el tipo de acreditado; hasta que el
        // gateway exponga /accredited-types se usa el mismo valor por defecto
        // que ofrece Parametrización.
        validation_limit: DEFAULT_VALIDATION_LIMIT,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        printed_at: null,
        modified_at: null,
        status: 'ACTIVE',
        delivery_status: 'PENDING',
        // TODO(api): el backend materializa los permisos del rol al crear la
        // acreditación (los devuelve en el 201 y en GET /accreditations/{code}).
        // Acá se siembran los mismos que traen las semillas para que el perfil de
        // una acreditación recién creada no salga sin permisos.
        permissions: NEW_ACCREDITATION_PERMISSIONS
      }))
    );

    const accreditations = responses.map(responseToAccreditation);

    // Al revés para que el orden del lote quede igual arriba de la lista.
    [...accreditations]
      .reverse()
      .forEach((accreditation) => this.store?.unshift(accreditation));

    await this.registerEvents(
      accreditations,
      'GENERATED',
      `Lote ${batchNumber}`
    );

    return accreditations;
  }

  // TODO(api): sin contrato en el gateway; el cambio vive en memoria y se
  // pierde al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async deliver(
    accreditations: Accreditation[],
    note: string
  ): Promise<Accreditation[]> {
    const updated = await this.update(accreditations, {
      deliveryStatus: 'DELIVERED',
      modifiedAt: new Date()
    });

    await this.registerEvents(updated, 'DELIVERED', '', note);

    return updated;
  }

  // TODO(api): sin contrato en el gateway; el cambio vive en memoria y se
  // pierde al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async deactivate(
    accreditations: Accreditation[],
    note: string
  ): Promise<Accreditation[]> {
    const updated = await this.update(accreditations, {
      status: 'INACTIVE',
      modifiedAt: new Date()
    });

    await this.registerEvents(updated, 'DEACTIVATED', '', note);

    return updated;
  }

  // La impresión se sella cuando el lote se descarga, no cuando se genera.
  public async markPrinted(batchId: EntityId): Promise<void> {
    const pending = this.items.filter(
      (accreditation) =>
        accreditation.batchId === String(batchId) && !accreditation.printedAt
    );

    if (pending.length) {
      const updated = await this.update(pending, { printedAt: new Date() });

      await this.registerEvents(updated, 'PRINTED');
    }
  }

  // Sirve igual para una acción individual (una acreditación) que para una
  // masiva: el merge reemplaza todas y notifica una sola vez.
  private async update(
    accreditations: Accreditation[],
    changes: Partial<Accreditation>
  ): Promise<Accreditation[]> {
    const updated = accreditations.map((accreditation) =>
      clone(accreditation, changes)
    );

    this.store?.merge(updated);

    try {
      await mockResponse(updated.length);
    } catch (error) {
      this.store?.merge(accreditations); // Revertir el cambio optimista.

      throw error;
    }

    return updated;
  }

  // El historial se escribe aquí y no en las pantallas: así ninguna acción
  // puede olvidarse de dejar rastro.
  private registerEvents(
    accreditations: Accreditation[],
    action: AccreditationAction,
    detail = '',
    note = ''
  ): Promise<unknown> {
    return this.eventRepository.register(
      accreditations.map((accreditation) => ({
        accreditation_id: String(accreditation.id),
        accredited_type: accreditation.accreditedType,
        action,
        detail,
        note
      }))
    );
  }
}

registerDependency(AccreditationRepository, {
  singleton: true,
  injects: [
    { token: MockApiClient, singleton: true },
    { token: AccreditationEventRepository, singleton: true }
  ]
});
