import { AccreditationPhase } from '../../domain/entities/accreditation-phase';
import { SuiteEvent } from '../../domain/entities/suite-event';
import type {
  EventCatalogResponse,
  SuiteEventDetailResponse,
  SuiteEventPhaseResponse
} from '../models/suite-event.model';

// El catálogo del módulo se mapea a la MISMA entidad que /v2/events: para la pantalla de
// entrada un evento es un evento, y así elegirlo sigue funcionando igual.
export function catalogResponseToSuiteEvent(
  response: EventCatalogResponse
): SuiteEvent {
  return new SuiteEvent(
    response.event_code,
    response.name ?? response.event_name ?? response.event_code,
    response.start_date ? new Date(response.start_date) : null
  );
}

export function responseToAccreditationPhase(
  response: SuiteEventPhaseResponse
): AccreditationPhase {
  return new AccreditationPhase(
    response.code,
    response.name,
    response.sequence_number ?? 0,
    response.start_date ? new Date(response.start_date) : null
  );
}

// Solo las fases con proceso de acreditación son candidatas: son las que orc
// registra en el módulo, y por tanto las únicas que tienen event_id.
//
// Una fase dividida en momentos no se acredita entera: sale una opción POR MOMENTO, en el
// orden en que orc los devuelve, y la fase sola no se ofrece.
export function responseToAccreditationPhases(
  response: SuiteEventDetailResponse
): AccreditationPhase[] {
  return (response.phases ?? [])
    .filter((phase) => phase.has_accreditation_process)
    .sort(
      (one, other) => (one.sequence_number ?? 0) - (other.sequence_number ?? 0)
    )
    .flatMap((phase) => {
      const base = responseToAccreditationPhase(phase);

      if (!phase.moments?.length) {
        return [base];
      }

      return phase.moments.map(
        (moment) =>
          new AccreditationPhase(
            base.code,
            base.name,
            base.sequenceNumber,
            base.startDate,
            moment.code,
            moment.name,
            moment.sport_codes ?? []
          )
      );
    });
}
