import { RequestEntityByPage } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { CardBatchMemberRecord } from '../../domain/entities/card-batch';
import { CARD_BATCH_MEMBERS_URL } from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToCardBatchMemberRecord } from '../factories/card-batch.factory';
import type { CardBatchMemberResponse } from '../models/card-batch.model';
import { EventScopedPaginationRepository } from './event-scoped.repository';

const PAGE_LIMIT = 10;

// Red de seguridad: la pantalla deja el evento puesto con `applyEventScope` antes de montar
// su controlador. Sin `event_code` el listado devolvería los carnets de todos los eventos.
const NO_EVENT = '00000000-0000-0000-0000-000000000000';

// Los acreditados que YA tienen carnet, uno por fila, con el lote al que pertenecen.
//
// Se filtra por `event_code` —el uuid del evento— y no por el `event_id` del par
// evento+fase: los carnets son del evento, igual que los lotes. Medido contra staging el
// 2026-09-03: con `event_code` devuelve solo las filas de ese evento (4 de 10), y el gateway
// se come en silencio los parámetros que no conoce, así que mandar `event_id` por error no da
// error: devuelve TODOS los eventos mezclados. Cuesta una tarde entender por qué.
//
// Con `phase_code` (y `moment_code`) el back ya acota la lista a la fase; el controlador lo
// manda desde `applyEventScope`. Sin fase devuelve el evento entero.
export class CardBatchMemberRepository extends EventScopedPaginationRepository<
  CardBatchMemberRecord,
  CardBatchMemberResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, CARD_BATCH_MEMBERS_URL, responseToCardBatchMemberRecord, {
      queryParams: { limit: PAGE_LIMIT, event_code: NO_EVENT }
    });
  }

  // Se leen de `this.queryParams` para que el applyFilters() del controlador —donde viaja
  // la búsqueda— llegue de verdad al servidor.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<CardBatchMemberResponse> {
    return new RequestEntityByPage<CardBatchMemberResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }
}

registerDependency(CardBatchMemberRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
