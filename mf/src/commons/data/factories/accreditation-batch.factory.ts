import { AccreditationBatch } from '../../domain/entities/accreditation-batch';
import type { AccreditationBatchResponse } from '../models/accreditation-batch.model';
import { toBackendDate } from './backend-date';

export function responseToAccreditationBatch(
  response: AccreditationBatchResponse
): AccreditationBatch {
  return new AccreditationBatch(
    response.id,
    response.number,
    toBackendDate(response.created_at),
    response.total,
    response.delivered,
    response.status,
    response.people.map((person) => ({
      accreditedType: person.accredited_type,
      document: person.document,
      fullName: person.full_name
    }))
  );
}
