import { EntityRepository } from '@naowee-tech/sdk-frontend-web';
import { clone } from '@rolster/commons';
import { registerDependency } from '@rolster/invertly';

import { AccreditationBatch } from '../../domain/entities/accreditation-batch';
import type { EnabledPerson } from '../../domain/entities/enabled-person';
import { MockApiClient } from '../config/mock-api-client';
import { responseToAccreditationBatch } from '../factories/accreditation-batch.factory';
import { mockResponse } from '../mocks/mock.helper';
import type { AccreditationBatchResponse } from '../models/accreditation-batch.model';
import { AccreditationRepository } from './accreditation.repository';

export class AccreditationBatchRepository extends EntityRepository<
  AccreditationBatch,
  AccreditationBatchResponse
> {
  constructor(
    apiClient: MockApiClient,
    private readonly accreditationRepository: AccreditationRepository
  ) {
    super(apiClient, '/accreditation-batches', responseToAccreditationBatch);
  }

  public get lastNumber(): number {
    return this.items.reduce((last, batch) => Math.max(last, batch.number), 0);
  }

  // TODO(api): sin contrato en el gateway; el lote vive en memoria y se pierde
  // al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async create(people: EnabledPerson[]): Promise<AccreditationBatch> {
    // Sin store, lastNumber daría 0 y el unshift sería un no-op silencioso.
    await this.requestAll();

    const number = this.lastNumber + 1;

    const response = await mockResponse<AccreditationBatchResponse>({
      id: `batch-${number}`,
      number,
      created_at: new Date().toISOString(),
      total: people.length,
      delivered: 0,
      status: 'PENDING',
      people: people.map((person) => ({
        accredited_type: person.accreditedType,
        document: person.document,
        full_name: person.fullName
      }))
    });

    const batch = responseToAccreditationBatch(response);

    this.store?.unshift(batch);

    // Cada lote genera además sus acreditaciones individuales, que son las que
    // se ven en "Lista de acreditados". Va aquí para que el invariante no
    // dependa de que la página se acuerde de hacerlo. Se les pasa la persona
    // habilitada completa, no el BatchPerson, que solo tiene lo del detalle.
    await this.accreditationRepository.createFromBatch(
      batch.id,
      number,
      people
    );

    return batch;
  }

  // TODO(api): sin contrato en el gateway; el estado vive en memoria y se
  // pierde al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async markDownloaded(
    batch: AccreditationBatch
  ): Promise<AccreditationBatch> {
    if (batch.status === 'DOWNLOADED') {
      return batch;
    }

    const updated = clone(batch, { status: 'DOWNLOADED' });

    this.store?.refresh(updated);

    try {
      await mockResponse(updated.status);
    } catch (error) {
      this.store?.refresh(batch); // Revertir el cambio optimista.

      throw error;
    }

    // Descargar el lote es lo que lo imprime: recién ahí las acreditaciones
    // tienen fecha de impresión que mostrar en su detalle.
    await this.accreditationRepository.markPrinted(batch.id);

    return updated;
  }
}

registerDependency(AccreditationBatchRepository, {
  singleton: true,
  injects: [
    { token: MockApiClient, singleton: true },
    { token: AccreditationRepository, singleton: true }
  ]
});
