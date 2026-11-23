import { EnabledPerson } from '../../domain/entities/enabled-person';
import type { EnabledPersonResponse } from '../models/enabled-person.model';

export function responseToEnabledPerson(
  response: EnabledPersonResponse
): EnabledPerson {
  return new EnabledPerson(
    response.id,
    response.accredited_type,
    response.document_type,
    response.document,
    response.name,
    response.second_name,
    response.last_name,
    response.second_last_name,
    response.sex,
    response.email,
    response.delegation
  );
}
