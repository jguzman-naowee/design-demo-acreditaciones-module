import {
  CardBatch,
  CardBatchChunk,
  CardBatchListed,
  CardBatchMember,
  CardBatchMemberRecord,
  CardBatchSkip
} from '../../domain/entities/card-batch';
import type {
  AccreditationCardResponse,
  CardBatchAccreditationResponse,
  CardBatchChunkResponse,
  CardBatchListItemResponse,
  CardBatchMemberResponse,
  CardBatchResponse,
  CardBatchSkippedResponse
} from '../models/card-batch.model';
import { toBackendDate } from './backend-date';
import { toRoleLabel } from './role-name';

function responseToChunk(response: CardBatchChunkResponse): CardBatchChunk {
  return new CardBatchChunk(
    response.chunk_index,
    response.card_count,
    response.status,
    response.upload_id ?? null,
    response.error_detail ?? null
  );
}

function responseToMember(
  response: CardBatchAccreditationResponse
): CardBatchMember {
  return new CardBatchMember(
    response.accreditation_code,
    response.full_name,
    response.document_number ?? ''
  );
}

function responseToSkip(response: CardBatchSkippedResponse): CardBatchSkip {
  return new CardBatchSkip(
    response.code,
    response.reason,
    response.full_name ?? ''
  );
}

export function responseToCardBatch(response: CardBatchResponse): CardBatch {
  return new CardBatch(
    response.batch_code,
    response.status,
    response.total_cards,
    response.total_chunks,
    response.cards_without_photo ?? [],
    (response.chunks ?? []).map(responseToChunk),
    toBackendDate(response.created_at),
    response.batch_number ?? null,
    (response.accreditations ?? []).map(responseToMember),
    (response.skipped ?? []).map(responseToSkip),
    response.error_detail ?? null
  );
}

// El 202 del POST no trae ni estado ni chunks, así que se compone un lote recién
// encolado: la primera consulta lo reemplaza por el de verdad.
export function acceptedToCardBatch(
  response: AccreditationCardResponse
): CardBatch {
  return new CardBatch(
    response.batch_code,
    'ENQUEUED',
    response.total_cards,
    response.total_chunks,
    response.cards_without_photo ?? [],
    [],
    null,
    response.batch_number ?? null,
    // Los integrantes no vienen en el 202; los omitidos sí, y son lo primero que la
    // pantalla tiene que contar.
    [],
    (response.skipped ?? []).map(responseToSkip)
  );
}

export function responseToCardBatchListed(
  response: CardBatchListItemResponse
): CardBatchListed {
  return new CardBatchListed(
    response.batch_code,
    response.batch_number ?? null,
    response.event_code,
    response.kind,
    response.status,
    response.total_cards,
    response.total_chunks,
    response.cards_without_photo,
    response.requested_by ?? null,
    toBackendDate(response.created_at)
  );
}

export function responseToCardBatchMemberRecord(
  response: CardBatchMemberResponse
): CardBatchMemberRecord {
  return new CardBatchMemberRecord(
    // Acreditación + lote: el par identifica la fila sea cual sea la forma que devuelva el
    // endpoint. Ver el comentario del constructor.
    `${response.accreditation_code}:${response.batch_code}`,
    response.full_name,
    response.document_number ?? '',
    response.role_code ?? '',
    toRoleLabel(response.role_name, response.role_code ?? ''),
    response.status,
    response.delivered ?? false,
    response.batch_code,
    response.batch_number ?? null,
    response.batch_kind ?? '',
    response.accreditation_code,
    response.department_name ?? '',
    response.municipality_name ?? '',
    response.card_outdated ?? false
  );
}
