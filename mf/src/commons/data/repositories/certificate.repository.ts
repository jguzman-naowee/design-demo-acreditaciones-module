import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type {
  ActiveAccredited,
  CertificateBatch,
  CertificateBatchRequested,
  CertificateConfig,
  CertificateItem,
  EventSport
} from '../../domain/entities/certificate';
import {
  ACCREDITATIONS_URL,
  CERTIFICATE_BATCHES_URL,
  certificateBatchUrl,
  certificateConfigUrl,
  CERTIFICATES_URL,
  eventCertificatesUrl,
  eventSportsUrl
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import {
  listedToCertificateBatch,
  requestedToCertificateBatch,
  responseToActiveAccredited,
  responseToCertificateBatch,
  responseToCertificateConfig,
  responseToCertificateItem,
  responseToEventSport
} from '../factories/certificate.factory';
import type {
  ActiveAccreditationsPageResponse,
  CertificateBatchesPageResponse,
  CertificateBatchRequestedResponse,
  CertificateBatchResponse,
  CertificateConfigPayload,
  CertificateConfigResponse,
  CertificatesPageResponse,
  EventSportSummaryResponse,
  GenerateCertificatesPayload
} from '../models/certificate.model';

// La paginación visible de lotes y certificados es en cliente (mismo criterio
// que el catálogo de tipos): el volumen por evento es corto.
const PAGE_LIMIT = 50;

// 404 CERTIFICATE_CONFIG_NOT_FOUND = el evento/fase aún no tiene configuración:
// para la pantalla eso es "formulario vacío", no un error.
function isConfigNotFound(error: unknown): boolean {
  const details = (error as { details?: { code?: string } })?.details;
  const status = (error as { status?: number })?.status;

  return details?.code === 'CERTIFICATE_CONFIG_NOT_FOUND' || status === 404;
}

export class CertificateRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public async getConfig(
    eventCode: string,
    phaseCode?: string,
    momentCode?: string | null
  ): Promise<CertificateConfig | null> {
    try {
      const response = await this.apiClient.execute(
        new HttpEndpoint<CertificateConfigResponse>(
          certificateConfigUrl(eventCode),
          HttpMethod.Get,
          {
            queryParams: {
              ...(phaseCode ? { phase_code: phaseCode } : {}),
              ...(momentCode ? { moment_code: momentCode } : {})
            }
          }
        )
      );

      return responseToCertificateConfig(response);
    } catch (error) {
      if (isConfigNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  public async saveConfig(
    eventCode: string,
    payload: CertificateConfigPayload
  ): Promise<CertificateConfig> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<CertificateConfigResponse>(
        certificateConfigUrl(eventCode),
        HttpMethod.Put,
        { payload }
      )
    );

    return responseToCertificateConfig(response);
  }

  public async generate(
    eventCode: string,
    payload: GenerateCertificatesPayload
  ): Promise<CertificateBatchRequested> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<CertificateBatchRequestedResponse>(
        eventCertificatesUrl(eventCode),
        HttpMethod.Post,
        { payload }
      )
    );

    return requestedToCertificateBatch(response);
  }

  public async requestBatch(batchCode: string): Promise<CertificateBatch> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<CertificateBatchResponse>(
        certificateBatchUrl(batchCode),
        HttpMethod.Get
      )
    );

    return responseToCertificateBatch(response);
  }

  // `scope` es el `momentScope` de la fase: con la fase dividida, cada momento tiene sus lotes.
  public async listBatches(
    eventCode: string,
    scope: Record<string, string> = {}
  ): Promise<CertificateBatch[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<CertificateBatchesPageResponse>(
        CERTIFICATE_BATCHES_URL,
        HttpMethod.Get,
        { queryParams: { ...scope, event_code: eventCode, limit: PAGE_LIMIT } }
      )
    );

    return response.batches.map(listedToCertificateBatch);
  }

  public async listCertificates(
    eventCode: string,
    search?: string,
    scope: Record<string, string> = {}
  ): Promise<CertificateItem[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<CertificatesPageResponse>(CERTIFICATES_URL, HttpMethod.Get, {
        queryParams: {
          ...scope,
          event_code: eventCode,
          limit: PAGE_LIMIT,
          ...(search ? { search } : {})
        }
      })
    );

    return response.certificates.map(responseToCertificateItem);
  }

  // Acreditados ACTIVOS del evento para el selector de generación individual.
  // El filtro de texto va al servidor; el tope corto mantiene la lista usable.
  public async searchActiveAccredited(
    eventId: number,
    search?: string
  ): Promise<ActiveAccredited[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<ActiveAccreditationsPageResponse>(
        ACCREDITATIONS_URL,
        HttpMethod.Get,
        {
          queryParams: {
            event_id: eventId,
            status: 'ACTIVE',
            limit: 20,
            ...(search ? { search } : {})
          }
        }
      )
    );

    return (response.data ?? []).map(responseToActiveAccredited);
  }

  public async listEventSports(
    eventCode: string,
    phaseCode?: string
  ): Promise<EventSport[]> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<EventSportSummaryResponse[]>(
        eventSportsUrl(eventCode),
        HttpMethod.Get,
        { queryParams: phaseCode ? { phase_code: phaseCode } : {} }
      )
    );

    return (response ?? []).map(responseToEventSport);
  }
}

registerDependency(CertificateRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
