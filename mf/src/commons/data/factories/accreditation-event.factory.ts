import { AccreditationEvent } from '../../domain/entities/accreditation-event';
import type { AccreditationEventResponse } from '../models/accreditation-event.model';
import { toBackendDate } from './backend-date';

export function responseToAccreditationEvent(
  response: AccreditationEventResponse
): AccreditationEvent {
  return new AccreditationEvent(
    response.id,
    response.accreditation_id,
    response.accredited_type,
    response.action,
    response.detail,
    response.note,
    response.validations,
    toBackendDate(response.created_at),
    response.author
  );
}
