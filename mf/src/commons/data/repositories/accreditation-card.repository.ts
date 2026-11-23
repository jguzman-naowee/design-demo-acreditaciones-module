import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { CardBatch } from '../../domain/entities/card-batch';
import {
  accreditationCardUrl,
  cardBatchUrl,
  eventCardsUrl,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import {
  acceptedToCardBatch,
  responseToCardBatch
} from '../factories/card-batch.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccreditationCardResponse,
  CardBatchResponse,
  EventCardsPayload
} from '../models/card-batch.model';

// El PDF del carnet. No es un catálogo —no hay listado ni store— sino dos llamadas
// que se turnan: pedir la generación y preguntar si ya está.
//
// Quién orquesta el ciclo completo es `useAccreditationCard`; acá viven solo las dos
// peticiones, para que la espera y sus estados sean cosa de la pantalla.
export class AccreditationCardRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  // Encola la generación. Responde 202: no devuelve el archivo ni su estado, solo el
  // lote que hay que consultar. Cada llamada crea un lote nuevo en el backend y no
  // hay DELETE, así que conviene reusar el batch_code en lugar de reintentar el POST.
  public async requestCard(accreditationCode: string): Promise<CardBatch> {
    if (useAccreditationMock()) {
      return acceptedToCardBatch(
        await mockResponse<AccreditationCardResponse>({
          batch_code: `demo-${accreditationCode}`,
          // El carnet individual comparte la serie del evento con los lotes.
          batch_number: 1,
          total_cards: 1,
          total_chunks: 1,
          cards_without_photo: [accreditationCode],
          skipped: []
        })
      );
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditationCardResponse>(
        accreditationCardUrl(accreditationCode),
        HttpMethod.Post
      )
    );

    return acceptedToCardBatch(response);
  }

  // Los carnets de varias acreditaciones en UN lote: por selección, por tipo, o todas
  // las del evento. Mismo ciclo que el individual —202 y después el polling— pero con
  // un solo PDF para todos, que es lo que se manda a imprimir.
  public async requestEventCards(
    eventCode: string,
    payload: EventCardsPayload = {}
  ): Promise<CardBatch> {
    if (useAccreditationMock()) {
      return acceptedToCardBatch(
        await mockResponse<AccreditationCardResponse>({
          batch_code: `demo-lote-${eventCode}`,
          batch_number: 2,
          total_cards: payload.accreditation_codes?.length ?? 1,
          total_chunks: 1,
          cards_without_photo: payload.accreditation_codes ?? [],
          skipped: []
        })
      );
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditationCardResponse>(
        eventCardsUrl(eventCode),
        HttpMethod.Post,
        {
          // Sin `include_without_photo`: desde SUV2-2531 el backend lo ignora —un carnet
          // sin foto aprobada ya no se emite para ningún rol— y lo acepta solo para no
          // romper clientes. Mandarlo sugeriría que la pantalla puede elegir, y no puede.
          payload
        }
      )
    );

    return acceptedToCardBatch(response);
  }

  // El estado del lote. Es solo observar: el backend lo genera de fondo lo consulten
  // o no (medido: 40 s sin preguntar y la primera consulta ya lo dio COMPLETED), así
  // que abandonar la pantalla no cancela el PDF, solo deja de mirarlo.
  public async requestBatch(batchCode: string): Promise<CardBatch> {
    if (useAccreditationMock()) {
      return responseToCardBatch(
        await mockResponse<CardBatchResponse>({
          batch_code: batchCode,
          batch_number: 1,
          kind: 'INDIVIDUAL',
          status: 'COMPLETED',
          total_cards: 1,
          total_chunks: 1,
          cards_without_photo: [],
          // El lote terminado sí publica a sus integrantes; en curso llegarían vacíos.
          accreditations: [
            {
              accreditation_code: `demo-${batchCode}`,
              full_name: 'Acreditado de ejemplo'
            }
          ],
          skipped: [],
          chunks: [
            {
              chunk_index: 0,
              card_count: 1,
              status: 'COMPLETED',
              upload_id: `demo-pdf-${batchCode}`
            }
          ],
          created_at: new Date().toISOString()
        })
      );
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<CardBatchResponse>(cardBatchUrl(batchCode), HttpMethod.Get)
    );

    return responseToCardBatch(response);
  }
}

registerDependency(AccreditationCardRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
