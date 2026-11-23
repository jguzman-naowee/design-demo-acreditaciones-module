import {
  RequestEntityByPage
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { CardBatchListed } from '../../domain/entities/card-batch';
import { CARD_BATCHES_URL } from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToCardBatchListed } from '../factories/card-batch.factory';
import type { CardBatchListItemResponse } from '../models/card-batch.model';
import { EventScopedPaginationRepository } from './event-scoped.repository';

const PAGE_LIMIT = 10;

// Red de seguridad, no el camino normal: la pantalla deja el evento puesto con
// `applyEventScope` antes de montar su controlador. Sin event_code el gateway devuelve los
// lotes de TODOS los eventos (medido), así que un uuid imposible responde 200 con total 0
// en lugar de mostrar por un instante lotes que no son de este evento.
const NO_EVENT = '00000000-0000-0000-0000-000000000000';

// Los lotes de carnets del evento, los más recientes primero.
//
// Ojo: se filtran por `event_code` (el uuid del evento), no por el `event_id` del
// par evento+fase que usan los roles y las acreditaciones. Los carnets son del
// evento, no de la fase.
export class CardBatchRepository extends EventScopedPaginationRepository<
  CardBatchListed,
  CardBatchListItemResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, CARD_BATCHES_URL, responseToCardBatchListed, {
      queryParams: { limit: PAGE_LIMIT, event_code: NO_EVENT }
    });
  }

  // Se leen de `this.queryParams` para que applyFilters() del controlador llegue de
  // verdad al servidor: ese método los mezcla ahí.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<CardBatchListItemResponse> {
    return new RequestEntityByPage<CardBatchListItemResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }

  // El listado no refresca el estado del lote contra file-storage; eso pasa en el
  // GET por code. Cuando ese GET trae algo distinto, la fila se repinta con lo
  // fresco en lugar de dejar en pantalla un «Procesando» que ya no es cierto.
  public syncStatus(batch: CardBatchListed, statusCode: string): void {
    if (batch.statusCode === statusCode) {
      return;
    }

    this.list?.refresh(
      responseToCardBatchListed({
        batch_code: String(batch.id),
        // Sin el número, repintar la fila la dejaría llamándose por el prefijo del uuid.
        batch_number: batch.batchNumber,
        event_code: batch.eventCode,
        kind: batch.kindCode,
        status: statusCode,
        total_cards: batch.totalCards,
        total_chunks: batch.totalChunks,
        cards_without_photo: batch.cardsWithoutPhoto,
        requested_by: batch.requestedBy,
        created_at: batch.createdAt?.toISOString() ?? null
      })
    );
  }
}

registerDependency(CardBatchRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
