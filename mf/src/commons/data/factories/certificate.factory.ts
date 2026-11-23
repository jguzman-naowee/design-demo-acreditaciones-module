import {
  ActiveAccredited,
  CertificateBatch,
  CertificateBatchRequested,
  CertificateConfig,
  CertificateItem,
  CertificateSportDate,
  EventSport
} from '../../domain/entities/certificate';
import type {
  ActiveAccreditationResponse,
  CertificateBatchListItemResponse,
  CertificateBatchRequestedResponse,
  CertificateBatchResponse,
  CertificateConfigResponse,
  CertificateItemResponse,
  EventSportSummaryResponse
} from '../models/certificate.model';

export function responseToCertificateConfig(
  response: CertificateConfigResponse
): CertificateConfig {
  return new CertificateConfig(
    response.code,
    response.event_code,
    response.phase_code ?? null,
    response.template_code,
    response.enabled,
    response.sports.map(
      (sport) =>
        new CertificateSportDate(
          sport.sport_code ?? null,
          sport.delivery_date,
          sport.enabled
        )
    )
  );
}

export function requestedToCertificateBatch(
  response: CertificateBatchRequestedResponse
): CertificateBatchRequested {
  return new CertificateBatchRequested(
    response.batch_code,
    response.total_certificates,
    response.delivery_date
  );
}

export function responseToCertificateItem(
  response: CertificateItemResponse
): CertificateItem {
  return new CertificateItem(
    response.code,
    response.accreditation_code,
    response.user_code ?? null,
    response.full_name,
    response.document_number,
    response.role_name,
    response.delivery_date,
    response.upload_id ?? null,
    response.status,
    response.error_detail ?? null
  );
}

export function responseToCertificateBatch(
  response: CertificateBatchResponse
): CertificateBatch {
  return new CertificateBatch(
    response.batch_code,
    response.kind,
    response.sport_code ?? null,
    response.delivery_date,
    response.status,
    response.total_certificates,
    response.error_detail ?? null,
    (response.certificates ?? []).map(responseToCertificateItem)
  );
}

export function listedToCertificateBatch(
  response: CertificateBatchListItemResponse
): CertificateBatch {
  return new CertificateBatch(
    response.batch_code,
    response.kind,
    response.sport_code ?? null,
    response.delivery_date,
    response.status,
    response.total_certificates,
    null,
    [],
    response.created_at ?? null
  );
}

export function responseToEventSport(
  response: EventSportSummaryResponse
): EventSport {
  return new EventSport(response.sport_code, response.sport_name);
}

export function responseToActiveAccredited(
  response: ActiveAccreditationResponse
): ActiveAccredited {
  return new ActiveAccredited(
    response.code,
    response.user_code ?? null,
    response.full_name,
    response.document_number,
    response.role_name ?? null
  );
}
