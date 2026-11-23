import {
  ApiError,
  HttpEndpoint,
  HttpMethod
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { AccreditationPhase } from '../../domain/entities/accreditation-phase';
import { SuiteEvent } from '../../domain/entities/suite-event';
import {
  EVENT_REGISTRATIONS_URL,
  SUITE_EVENT_DETAIL_URL,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToAccreditationPhases } from '../factories/suite-event.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  EventRegistrationResponse,
  EventRegistrationsResponse,
  SuiteEventDetailResponse
} from '../models/suite-event.model';

// El evento no está registrado en el módulo de acreditación: no es un error de
// red, es que orc todavía no lo dio de alta, así que la pantalla lo explica en
// lugar de ofrecer un reintento.
export class EventNotRegisteredError extends Error {
  constructor(public readonly eventName: string) {
    super(
      `El evento ${eventName} todavía no está registrado en el módulo de acreditación.`
    );
    this.name = 'EventNotRegisteredError';
  }
}

// El evento existe pero ninguna de sus fases tiene proceso de acreditación, así
// que no hay ningún event_id que resolver.
export class EventWithoutPhasesError extends Error {
  constructor(public readonly eventName: string) {
    super(
      `${eventName} no tiene ninguna fase con proceso de acreditación.`
    );
    this.name = 'EventWithoutPhasesError';
  }
}

// La fila del momento todavía no existe y quien entra no puede crearla: registrar un
// momento en el módulo exige `accreditation:manage`. La primera entrada la hace un admin.
export class MomentNotEnabledError extends Error {
  constructor(public readonly label: string) {
    super(
      `${label} todavía no está habilitado en acreditación: un administrador del módulo debe entrar primero a este momento.`
    );
    this.name = 'MomentNotEnabledError';
  }
}

// El lookup vive en un PR sin mergear (accreditation-ms#17 / gateway#550), así
// que mientras tanto la ruta responde 404 y el statusText «Not Found» no le dice
// nada a nadie.
export class EventLookupUnavailableError extends Error {
  constructor() {
    super(
      'El módulo de acreditación todavía no expone la consulta de eventos, así que no podemos resolver el evento activo.'
    );
    this.name = 'EventLookupUnavailableError';
  }
}

// Lo que hace falta del evento activo: sus fases acreditables y el `event_id` del par.
//
// Ya no lista eventos. Lo hacía sobre `/v2/events` —485 filas sin `search`, recorridas de
// a cinco páginas para poder buscar— y eso se murió con el catálogo del módulo, que trae
// solo los eventos con acreditación y busca en el servidor: ver EventCatalogRepository.
export class SuiteEventRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  // Las fases con proceso de acreditación del evento, que son las únicas que el
  // módulo registra y por tanto las únicas que tienen event_id. Salen del detalle
  // de orc, donde el `code` de la fase es el mismo uuid que allá es `phase_code`.
  public async requestPhases(event: SuiteEvent): Promise<AccreditationPhase[]> {
    const response = await (useAccreditationMock()
      ? mockResponse<SuiteEventDetailResponse>({
          event_code: event.code,
          name: event.name,
          phases: [
            {
              code: `${event.code}-fase-1`,
              name: 'Fase Eliminatoria',
              sequence_number: 1,
              has_accreditation_process: true
            }
          ]
        })
      : this.apiClient.execute(
          new HttpEndpoint<SuiteEventDetailResponse>(
            `${SUITE_EVENT_DETAIL_URL}/${event.code}`,
            HttpMethod.Get
          )
        ));

    const phases = responseToAccreditationPhases(response);

    if (!phases.length) {
      throw new EventWithoutPhasesError(event.name);
    }

    return phases;
  }

  // Traduce el par evento+fase al event_id entero que exigen POST /roles y
  // POST /accreditations.
  //
  // Esto tiene que ser una LECTURA, nunca un POST: backend confirmó que
  // POST /events no deduplica y no hay índice único sobre event_code, así que
  // usarlo como lookup crea un evento duplicado con otro id y deja los roles
  // colgando de un id y los carnets de otro (accreditation-ms#17 lo arregla,
  // pero el lookup correcto es este GET de todos modos).
  //
  // Ojo con la forma: esta respuesta viene envuelta en `data` pero SIN `meta`,
  // no es el sobre paginado de /permissions y /roles.
  public async resolveEventId(
    event: SuiteEvent,
    phase: AccreditationPhase
  ): Promise<number> {
    const response = await (useAccreditationMock()
      ? mockResponse<EventRegistrationsResponse>({
          data: [
            {
              id: 1,
              event_code: event.code,
              event_name: event.name,
              phase_code: phase.code,
              phase_name: phase.name,
              moment_code: phase.momentCode,
              moment_name: phase.momentName
            }
          ]
        })
      : this.apiClient
          .execute(
            new HttpEndpoint<EventRegistrationsResponse>(
              EVENT_REGISTRATIONS_URL,
              HttpMethod.Get,
              // `phase_code` lo honra el gateway desde public-gateway#551; antes
              // de ese despliegue lo ignora y devuelve una fila por fase, así que
              // el filtro de abajo deja esto correcto en los dos casos. Con momento,
              // la fila es la del momento, no la de la fase entera.
              {
                queryParams: {
                  event_code: event.code,
                  phase_code: phase.code,
                  ...(phase.momentCode ? { moment_code: phase.momentCode } : {})
                }
              }
            )
          )
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.statusCode === 404) {
              throw new EventLookupUnavailableError();
            }

            throw error;
          }));

    // Coincidencia exacta: el event_id identifica evento+fase(+momento), y un
    // evento puede tener varias filas registradas. Nada de desempatar por id.
    const registration = (response.data ?? []).find(
      (item) =>
        item.event_code === event.code &&
        item.phase_code === phase.code &&
        (item.moment_code ?? null) === phase.momentCode
    );

    if (registration) {
      return registration.id;
    }

    // orc registra en el módulo la fase, no sus momentos: la fila de un momento nace la
    // primera vez que alguien entra a él. El POST es idempotente por (evento, fase, momento)
    // desde accreditation-ms#124 y valida contra orc que el momento sea de la fase.
    if (phase.momentCode) {
      return this.registerMoment(event, phase);
    }

    throw new EventNotRegisteredError(`${event.name} · ${phase.label}`);
  }

  private async registerMoment(
    event: SuiteEvent,
    phase: AccreditationPhase
  ): Promise<number> {
    const created = await this.apiClient
      .execute(
        new HttpEndpoint<EventRegistrationResponse>(
          EVENT_REGISTRATIONS_URL,
          HttpMethod.Post,
          {
            payload: {
              event_code: event.code,
              event_name: event.name,
              phase_code: phase.code,
              phase_name: phase.name,
              moment_code: phase.momentCode
            }
          }
        )
      )
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.statusIsForbidden()) {
          throw new MomentNotEnabledError(`${event.name} · ${phase.label}`);
        }

        throw error;
      });

    return created.id;
  }
}

registerDependency(SuiteEventRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
