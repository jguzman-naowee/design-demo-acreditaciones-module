import { EntityRepository } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { EnabledPerson } from '../../domain/entities/enabled-person';
import { MockApiClient } from '../config/mock-api-client';
import { responseToEnabledPerson } from '../factories/enabled-person.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  EnabledPersonPayload,
  EnabledPersonResponse
} from '../models/enabled-person.model';

export class EnabledPersonRepository extends EntityRepository<
  EnabledPerson,
  EnabledPersonResponse
> {
  constructor(apiClient: MockApiClient) {
    super(apiClient, '/enabled-people', responseToEnabledPerson);
  }

  // TODO(api): sin contrato en el gateway; la creación vive en memoria y se
  // pierde al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async create(payload: EnabledPersonPayload): Promise<EnabledPerson> {
    const response = await mockResponse<EnabledPersonResponse>({
      id: crypto.randomUUID(),
      accredited_type: payload.accredited_type,
      document_type: payload.document_type,
      document: payload.document,
      name: payload.name,
      second_name: payload.second_name,
      last_name: payload.last_name,
      second_last_name: payload.second_last_name,
      sex: payload.sex,
      email: payload.email,
      // TODO(diseño): el formulario todavía no pide delegación.
      delegation: 'Sin delegación'
    });

    const person = responseToEnabledPerson(response);

    this.store?.unshift(person);

    return person;
  }
}

registerDependency(EnabledPersonRepository, {
  singleton: true,
  injects: [{ token: MockApiClient, singleton: true }]
});
