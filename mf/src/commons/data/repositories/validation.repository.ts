import {
  HttpEndpoint,
  HttpMethod,
  RequestEntityByPage
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { AccreditationValidation } from '../../domain/entities/accreditation-validation';
import type { ValidationLog } from '../../domain/entities/accreditation-validation';
import {
  useAccreditationMock,
  VALIDATE_URL,
  VALIDATION_LOGS_URL
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import {
  responseToValidation,
  responseToValidationLog
} from '../factories/validation.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  ValidationLogResponse,
  ValidationPayload,
  ValidationResponse
} from '../models/validation.model';
import { EventScopedPaginationRepository } from './event-scoped.repository';

// La lectura del QR en la puerta. Es una escritura, no un catálogo: consume usos.
export class AccreditationValidationRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public async validate(
    payload: ValidationPayload
  ): Promise<AccreditationValidation> {
    const response = await (useAccreditationMock()
      ? mockResponse<ValidationResponse>({
          accreditation_code: 'demo-acreditacion',
          full_name: 'Acreditado de ejemplo',
          role_name: 'Deportista',
          status: 'ACTIVE',
          results: payload.permission_ids.map((permissionId) => ({
            permission_id: permissionId,
            permission_name: 'Permiso de ejemplo',
            result: 'GRANTED',
            used_count: 1,
            max_uses_per_person: 5
          }))
        })
      : this.apiClient.execute(
          new HttpEndpoint<ValidationResponse>(VALIDATE_URL, HttpMethod.Post, {
            payload
          })
        ));

    return responseToValidation(response);
  }
}

registerDependency(AccreditationValidationRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});

const PAGE_LIMIT = 10;

// El recorrido de la auditoría: páginas grandes y un tope, para que un evento enorme no se
// traiga el histórico entero. Ver `requestAllForEvent`.
const LOGS_PAGE_LIMIT = 100;

// El tope del contrato para las lecturas de una acreditación: es lo que se trae el detalle.
const PAGE_SIZE = 100;
const LOGS_MAX_PAGES = 20;

// Red de seguridad, no el camino normal: la pantalla deja el evento puesto con
// `applyEventScope` antes de montar su controlador. Si alguien lo monta sin scope, este
// event_id imposible vuelve vacío en lugar de mostrar las lecturas de todos los eventos.
const NO_EVENT = 0;

// Las lecturas registradas: las concedidas Y las denegadas, éstas con su `denial_reason`.
//
// Acá decía «Solo entran las CONCEDIDAS: un intento denegado no deja rastro (medido)». Era
// verdad en agosto y dejó de serlo: medido en dev el 2026-09-03, siete de las catorce lecturas
// del evento 1 son DENIED y traen su motivo redactado en español.
export class ValidationLogRepository extends EventScopedPaginationRepository<
  ValidationLog,
  ValidationLogResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, VALIDATION_LOGS_URL, responseToValidationLog, {
      queryParams: { limit: PAGE_LIMIT, event_id: NO_EVENT }
    });
  }

  protected override endpoint(
    page: number
  ): RequestEntityByPage<ValidationLogResponse> {
    return new RequestEntityByPage<ValidationLogResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }

  // TODAS las lecturas del evento, para la auditoría.
  //
  // La pantalla filtra, cuenta y pagina en cliente sobre el conjunto entero —los contadores son
  // el retrato del evento, no de la página—, así que necesita el conjunto. Va por fuera del
  // store paginado a propósito, igual que `requestForReport` del otro repositorio: éste es un
  // singleton y su lista es la que otra pantalla puede estar mostrando.
  //
  // Acotado por diseño: páginas de 100 y tope de 20. No es una petición por fila —eso sería
  // N+1— sino un recorrido de la lista, y 2.000 lecturas es más de lo que nadie audita a ojo.
  // Si un evento las pasara, hace falta paginar en servidor y mover los filtros allá.
  public async requestAllForEvent(eventId: number): Promise<ValidationLog[]> {
    // En modo demo no hay nada que recorrer: la auditoría no tiene datos de mentira sembrados
    // —tampoco los tiene la demo del rediseño— y salir a la red desde ahí daría un error de
    // conexión en vez del vacío explicado que la pantalla ya sabe pintar.
    if (useAccreditationMock()) {
      return [];
    }

    const porId = new Map<string, ValidationLog>();

    for (let page = 1; page <= LOGS_MAX_PAGES; page += 1) {
      // La URL se arma acá, como en `requestForReport`, y NO con `requestAll({page})`: el
      // `requestAll` del SDK llama siempre a `remoteAll(1)`, así que el `page` solo le cambiaba
      // la clave de caché y las tres peticiones salían pidiendo la primera página. Medido: con
      // 254 lecturas se pedían tres páginas y se contaban 100.
      const query = new URLSearchParams({
        event_id: String(eventId),
        limit: String(LOGS_PAGE_LIMIT),
        page: String(page)
      });

      const response = await this.apiClient.execute(
        new HttpEndpoint<{
          data: ValidationLogResponse[];
          meta?: { total?: number };
        }>(`${this.url}?${query}`, HttpMethod.Get)
      );

      const filas = response.data ?? [];
      const antes = porId.size;

      // Por id y no en un array: un backend que ignorara `page` metería las mismas lecturas
      // veinte veces en los contadores.
      filas
        .map(responseToValidationLog)
        .forEach((log) => porId.set(String(log.id), log));

      // Se para por el TOTAL, no por «esta página vino corta»: si el gateway recortara el
      // límite, cortar ahí dejaría fuera el resto sin avisar.
      const total = response.meta?.total;

      if (total !== undefined && page * LOGS_PAGE_LIMIT >= total) {
        break;
      }

      // Y sin total en el sobre, se corta cuando la página no trae nada nuevo: es peor dar
      // veinte vueltas que gastar una petición.
      if (total === undefined && porId.size === antes) {
        break;
      }
    }

    return [...porId.values()];
  }
}

registerDependency(ValidationLogRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});

// Las lecturas de UNA acreditación, para su historial de validaciones.
//
// Va aparte del repositorio paginado por evento y no como un filtro suyo: ese es un
// singleton con su caché por clave, y la pantalla de validar lo tiene puesto en el evento
// entero. Si el historial le cambiara los filtros, se pisarían entre pantallas.
//
// Sin paginación a propósito: el historial de una acreditación son unas pocas lecturas y el
// diseño las pagina en pantalla, no en el servidor. `limit` va al tope del contrato.
export class ValidationLogByAccreditationRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  // Las lecturas de ESTA acreditación, con su total.
  //
  // Devuelve las dos cosas de una sola petición porque las dos pantallas del detalle las
  // necesitan: la pestaña de acreditación solo pinta el número y el historial las pinta una a
  // una. Hubo un momento en que el número se pedía aparte con `limit=1`; eran dos viajes al
  // mismo endpoint con el mismo filtro.
  //
  // El `total` sale del sobre y NO de contar `data`: el contrato topa en 100 por página, y una
  // credencial muy usada habría dicho «100» para siempre. Cuando el total pasa de lo cargado,
  // la pantalla lo dice en vez de fingir que eso es todo lo que hay.
  public async requestWithTotal(
    accreditationCode: string
  ): Promise<{ logs: ValidationLog[]; total: number }> {
    if (useAccreditationMock()) {
      return { logs: [], total: 0 };
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<{
        data: ValidationLogResponse[];
        meta?: { total?: number };
      }>(
        `${VALIDATION_LOGS_URL}?accreditation_code=${accreditationCode}&limit=${PAGE_SIZE}&page=1`,
        HttpMethod.Get
      )
    );

    const logs = (response.data ?? []).map(responseToValidationLog);

    return { logs, total: response.meta?.total ?? logs.length };
  }

  public async requestAll(accreditationCode: string): Promise<ValidationLog[]> {
    const response = await (useAccreditationMock()
      ? mockResponse<{ data: ValidationLogResponse[] }>({ data: [] })
      : this.apiClient.execute(
          new HttpEndpoint<{ data: ValidationLogResponse[] }>(
            `${VALIDATION_LOGS_URL}?accreditation_code=${accreditationCode}&limit=100&page=1`,
            HttpMethod.Get
          )
        ));

    return (response.data ?? []).map(responseToValidationLog);
  }
}

registerDependency(ValidationLogByAccreditationRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
