import type { AccreditationAction } from '../../domain/types/status.type';

export interface AccreditationEventResponse {
  id: string;
  accreditation_id: string;
  accredited_type: string;
  action: AccreditationAction;
  detail: string;
  note: string;
  validations: number;
  created_at: string;
  author: string;
}

export interface AccreditationEventPayload {
  accreditation_id: string;
  accredited_type: string;
  action: AccreditationAction;
  detail?: string;
  note?: string;
  validations?: number;
}
