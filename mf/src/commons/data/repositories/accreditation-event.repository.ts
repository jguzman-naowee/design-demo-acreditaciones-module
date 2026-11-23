import { EntityRepository } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { AccreditationEvent } from '../../domain/entities/accreditation-event';
import type { AccreditationAction } from '../../domain/types/status.type';
import { getCurrentUser } from '../config/current-user';
import { MockApiClient } from '../config/mock-api-client';
import { responseToAccreditationEvent } from '../factories/accreditation-event.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccreditationEventPayload,
  AccreditationEventResponse
} from '../models/accreditation-event.model';

export class AccreditationEventRepository extends EntityRepository<
  AccreditationEvent,
  AccreditationEventResponse
> {
  constructor(apiClient: MockApiClient) {
    super(apiClient, '/accreditation-events', responseToAccreditationEvent);
  }

  // Los eventos de una acreditación, del más reciente al más antiguo, como los
  // pinta el diseño.
  public findByAccreditation(accreditationId: string): AccreditationEvent[] {
    return this.items
      .filter((event) => event.accreditationId === accreditationId)
      .sort((first, second) => +second.createdAt - +first.createdAt);
  }

  // El último movimiento de cada acreditación, en una sola pasada: las dos
  // pantallas de listado lo necesitan para todas las filas a la vez. Con
  // `actions` se acota al último de ese tipo — el control de accesos pide la
  // última lectura, no el último cambio de estado.
  public latestByAccreditation(
    actions?: AccreditationAction[]
  ): Map<string, AccreditationEvent> {
    return this.items.reduce((latest, event) => {
      if (actions && !actions.includes(event.action)) {
        return latest;
      }

      const current = latest.get(event.accreditationId);

      if (!current || event.createdAt > current.createdAt) {
        latest.set(event.accreditationId, event);
      }

      return latest;
    }, new Map<string, AccreditationEvent>());
  }

  // TODO(api): sin contrato en el gateway; los eventos viven en memoria y se
  // pierden al recargar. Al existir el endpoint, reemplazar por HttpEndpoint.
  public async register(
    payloads: AccreditationEventPayload[]
  ): Promise<AccreditationEvent[]> {
    if (!payloads.length) {
      return [];
    }

    // El store solo existe después del primer requestAll; sin esto, el registro
    // sería un no-op silencioso cuando la acción ocurre sin haber abierto nunca
    // el historial.
    await this.requestAll();

    const createdAt = new Date().toISOString();
    const author = getCurrentUser();

    const responses = await mockResponse<AccreditationEventResponse[]>(
      payloads.map((payload) => ({
        id: crypto.randomUUID(),
        accreditation_id: payload.accreditation_id,
        accredited_type: payload.accredited_type,
        action: payload.action,
        detail: payload.detail ?? '',
        note: payload.note ?? '',
        validations: payload.validations ?? 0,
        created_at: createdAt,
        author
      }))
    );

    const events = responses.map(responseToAccreditationEvent);

    // Un solo merge para no disparar una notificación por evento.
    this.store?.merge(events);

    return events;
  }
}

registerDependency(AccreditationEventRepository, {
  singleton: true,
  injects: [{ token: MockApiClient, singleton: true }]
});
