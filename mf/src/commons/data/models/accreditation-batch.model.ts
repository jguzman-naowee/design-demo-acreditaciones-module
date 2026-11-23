export interface BatchPersonResponse {
  accredited_type: string;
  document: string;
  full_name: string;
}

export interface AccreditationBatchResponse {
  id: string;
  number: number;
  created_at: string;
  total: number;
  delivered: number;
  status: 'PENDING' | 'DOWNLOADED';
  people: BatchPersonResponse[];
}

export interface AccreditationBatchPayload {
  people: BatchPersonResponse[];
}
