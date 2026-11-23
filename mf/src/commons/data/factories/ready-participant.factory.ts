import type {
  ParticipantFacet,
  ParticipantFacets
} from '../../domain/entities/ready-participant';
import { ReadyParticipant } from '../../domain/entities/ready-participant';
import type {
  ParticipantFacetResponse,
  ParticipantFacetsResponse,
  ReadyParticipantResponse
} from '../models/ready-participant.model';

export function responseToReadyParticipant(
  response: ReadyParticipantResponse
): ReadyParticipant {
  return new ReadyParticipant(
    response.user_code,
    response.user_role,
    response.user_first_name ?? '',
    response.user_second_name ?? '',
    response.user_first_lastname ?? '',
    response.user_second_lastname ?? '',
    response.document_type_name ?? response.document_type ?? '',
    response.document_number ?? '',
    response.department_code ?? '',
    response.department_name ?? '',
    response.requirements_approved ?? 0,
    response.requirements_total ?? 0,
    response.requirements_loaded ?? 0,
    response.overall_status ?? '',
    response.sport_names ?? [],
    response.sport_codes ?? [],
    response.municipality_code ?? '',
    response.municipality_name ?? '',
    response.organization_name ?? '',
    // Ausente = fila de plataforma: el backend solo manda la clave para el personal de
    // misión. Ver `ReadyParticipantResponse.identity_type`.
    response.identity_type ?? 'PLATFORM_USER',
    response.support_role_codes ?? [],
    response.support_role_names ?? [],
    // Con `??` y no con `=== null`: en la fila sin acreditar estas tres claves llegan
    // AUSENTES, no nulas. Comprobado contra staging con `Object.keys()` de la respuesta.
    response.accreditation_code ?? null,
    response.accreditation_status ?? null,
    response.delivery_status ?? null,
    response.region_code ?? '',
    response.region_name ?? ''
  );
}

// Las facetas se ordenan por etiqueta acá y no en el servidor: es presentación, y el
// backend ya las devuelve agrupadas por tipo.
function responseToFacet(
  response: ParticipantFacetResponse
): ParticipantFacet | null {
  const code = response.code?.trim();

  if (!code) {
    return null;
  }

  // Sin nombre —el catálogo no respondió— la opción se etiqueta con el código: filtrar por
  // código sí funciona, y una opción en blanco no.
  return {
    code,
    label: response.name?.trim() || code,
    total: response.total ?? 0
  };
}

function responseToFacetList(
  responses?: ParticipantFacetResponse[] | null
): ParticipantFacet[] {
  return (responses ?? [])
    .map(responseToFacet)
    .filter((facet): facet is ParticipantFacet => !!facet)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function responseToParticipantFacets(
  response: ParticipantFacetsResponse
): ParticipantFacets {
  return {
    sports: responseToFacetList(response.sports),
    departments: responseToFacetList(response.departments),
    municipalities: responseToFacetList(response.municipalities)
  };
}
