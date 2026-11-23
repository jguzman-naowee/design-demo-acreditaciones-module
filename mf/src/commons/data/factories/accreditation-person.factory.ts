import { AccreditationPerson } from '../../domain/entities/accreditation-person';
import type { AccreditationPersonResponse } from '../models/accreditation-person.model';

export function responseToAccreditationPerson(
  response: AccreditationPersonResponse
): AccreditationPerson {
  return new AccreditationPerson(
    response.code,
    response.user_code ?? '',
    response.document_number,
    response.name ?? '',
    response.second_name ?? '',
    response.last_name ?? '',
    response.second_last_name ?? '',
    response.sex ?? '',
    response.email ?? '',
    response.department_name ?? ''
  );
}
