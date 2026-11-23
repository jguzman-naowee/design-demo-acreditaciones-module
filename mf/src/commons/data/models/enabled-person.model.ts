export interface EnabledPersonResponse {
  id: string;
  accredited_type: string;
  document_type: string;
  document: string;
  name: string;
  second_name: string;
  last_name: string;
  second_last_name: string;
  sex: string;
  email: string;
  delegation: string;
}

export interface EnabledPersonPayload {
  document_type: string;
  document: string;
  name: string;
  second_name: string;
  last_name: string;
  second_last_name: string;
  sex: string;
  email: string;
  accredited_type: string;
}
