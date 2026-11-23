import {
  HttpEndpoint,
  HttpMethod,
  RequestEntityByPage
} from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { AccreditationPermission } from '../../domain/entities/accreditation';
import type { AccreditationAudit } from '../../domain/entities/accredited-record';
import type { AccreditationCounters } from '../../domain/entities/accredited-record';
import type { AccreditedRecordDetail } from '../../domain/entities/accredited-record';
import {
  AccreditedRecord,
  AccreditedRecordDetail as AccreditedRecordDetailClass
} from '../../domain/entities/accredited-record';
import type { CardBatch } from '../../domain/entities/card-batch';
import {
  ACCREDITATION_REPORTS_URL,
  accreditationActionUrl,
  accreditationBulkUrl,
  accreditationChangeRoleUrl,
  accreditationHistoryUrl,
  accreditationReportUrl,
  ACCREDITATIONS_AUDIT_URL,
  ACCREDITATIONS_BULK_CREATE_URL,
  ACCREDITATIONS_EMIT_WITH_CARD_URL,
  ACCREDITATIONS_SUMMARY_URL,
  ACCREDITATIONS_URL,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import {
  responseToAccreditationAudit,
  responseToAccreditedRecord,
  responseToAccreditedRecordDetail
} from '../factories/accredited-record.factory';
import { acceptedToCardBatch } from '../factories/card-batch.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccreditationActionResponse,
  AccreditationAuditParams,
  AccreditationBulkCreatePayload,
  AccreditationBulkCreateResponse,
  AccreditationBulkPayload,
  AccreditationBulkResponse,
  AccreditationChangeRolePayload,
  AccreditationChangeRoleResponse,
  AccreditationCreatedResponse,
  AccreditationCreatePayload,
  AccreditationEmitWithCardResponse,
  AccreditationEventAuditResponse,
  AccreditationHistoryResponse,
  AccreditationReportCreatedResponse,
  AccreditationReportPayload,
  AccreditationReportStatusResponse,
  AccreditationSummaryResponse,
  AccreditedRecordDetailResponse,
  AccreditedRecordResponse
} from '../models/accredited-record.model';
import { EventScopedPaginationRepository } from './event-scoped.repository';

// La paginación es del servidor, así que el límite es el de la página visible.
const PAGE_LIMIT = 10;

// El reporte no se pagina en pantalla: se piden páginas grandes hasta agotar el filtro. Ver
// `requestForReport`. Cien es el tamaño que el módulo ya usa contra dev en otras listas.
const REPORT_PAGE_LIMIT = 100;
const REPORT_MAX_PAGES = 20;

// El recorrido de la auditoría del evento. Mismo criterio y mismos números que el del reporte
// y el de las lecturas: 2.000 movimientos son más de lo que nadie audita a ojo.
const AUDIT_PAGE_LIMIT = 100;
const AUDIT_MAX_PAGES = 20;

// Red de seguridad: las pantallas dejan el evento puesto con `applyEventScope` antes de
// montar su controlador, así que esta primera consulta ya no debería salir. Si alguien
// monta un controlador sin scope, este event_id imposible vuelve vacío en lugar de
// traerse las acreditaciones de TODOS los eventos.
const NO_EVENT = 0;

/**
 * Lo mínimo que hace falta para componer la fila de una acreditación recién emitida.
 *
 * Se declara por su FORMA y no como una de las dos entidades porque las dos sirven y no
 * comparten jerarquía: `AccreditationPerson` es quien se buscó por documento en el módulo, y
 * `ReadyParticipant` es una fila del listado de acreditables —que además puede ser personal
 * de misión, o sea alguien que NO tiene usuario de la plataforma y nunca será una
 * `AccreditationPerson`—.
 */
export interface AccreditedRowSubject {
  document: string;
  firstName: string;
  secondName: string;
  lastName: string;
  secondLastName: string;
  departmentName: string;
}

export class AccreditedRecordRepository extends EventScopedPaginationRepository<
  AccreditedRecord,
  AccreditedRecordResponse
> {
  constructor(apiClient: GatewayApiClient) {
    super(apiClient, ACCREDITATIONS_URL, responseToAccreditedRecord, {
      queryParams: { limit: PAGE_LIMIT, event_id: NO_EVENT }
    });
  }

  // Los params se leen de `this.queryParams` para que applyFilters() del controlador
  // llegue al servidor: ese método los mezcla ahí.
  protected override endpoint(
    page: number
  ): RequestEntityByPage<AccreditedRecordResponse> {
    return new RequestEntityByPage<AccreditedRecordResponse>(this.url, page, {
      queryParams: this.queryParams
    });
  }

  // TODAS las acreditaciones que casan con el filtro, para el reporte.
  //
  // La tabla pagina de a diez contra el servidor, así que un reporte hecho con lo que hay en
  // pantalla saldría con diez filas y quien lo abra creería que el evento tiene diez
  // acreditados. Acá se piden todas las páginas del filtro.
  //
  // Va por fuera del store paginado a propósito, igual que `requestDetail`: este repositorio es
  // un singleton y su lista es la que la tabla está mostrando. Un `requestAll` con limit 100 la
  // reemplazaría y la tabla se quedaría en la página 1 con cien filas debajo del cursor.
  //
  // El tope de 20 páginas es una red por si el backend ignora el filtro: 2.000 filas es más de
  // lo que nadie abre en Excel, y sin él un evento grande se traería el catálogo entero.
  public async requestForReport(
    queryParams: Record<string, string | number>
  ): Promise<AccreditedRecord[]> {
    if (useAccreditationMock()) {
      return this.items;
    }

    // Por código y no en un array: así un backend que ignorara `page` y devolviera siempre la
    // primera no metería las mismas filas veinte veces en el reporte.
    const porCodigo = new Map<string, AccreditedRecord>();

    for (let page = 1; page <= REPORT_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(queryParams).map(([clave, valor]) => [
            clave,
            String(valor)
          ])
        ),
        limit: String(REPORT_PAGE_LIMIT),
        page: String(page)
      });

      const response = await this.apiClient.execute(
        new HttpEndpoint<{
          data: AccreditedRecordResponse[];
          meta?: { total?: number };
        }>(`${this.url}?${query}`, HttpMethod.Get)
      );

      const filas = response.data ?? [];
      const antes = porCodigo.size;

      filas
        .map(responseToAccreditedRecord)
        .forEach((registro) => porCodigo.set(String(registro.id), registro));

      // Se corta por el TOTAL que trae el sobre. Antes se cortaba con «esta página no trajo
      // nada nuevo», y eso gastaba SIEMPRE una petición de más: con cuatro acreditaciones se
      // pedía la página 2 solo para descubrir que estaba vacía. Medido en la auditoría, que
      // hace este recorrido en cada carga.
      const total = response.meta?.total;

      if (total !== undefined && page * REPORT_PAGE_LIMIT >= total) {
        break;
      }

      // Y si el sobre no trajera total, se vuelve al corte de antes: es peor gastar una
      // petición que quedarse dando vueltas.
      if (total === undefined && porCodigo.size === antes) {
        break;
      }
    }

    return [...porCodigo.values()];
  }

  // El detalle trae lo que el listado no: el token público del QR y los permisos con
  // sus usos y vigencias. No pasa por el store de la lista —es otra forma— así que se
  // pide cada vez que se abre la pantalla; son datos que cambian con cada validación.
  // Los contadores del evento para la banda superior: una consulta agregada del backend,
  // no el listado contado en el navegador. Se pide una vez por evento y fase.
  public async requestSummary(
    eventCode: string,
    phaseCode?: string,
    momentCode?: string | null
  ): Promise<AccreditationCounters> {
    if (useAccreditationMock()) {
      return mockResponse({ generated: 0, delivered: 0 });
    }

    const query = new URLSearchParams({ event_code: eventCode });

    if (phaseCode) {
      query.set('phase_code', phaseCode);
    }

    // Con momento, solo los contadores de ese momento de la fase.
    if (momentCode) {
      query.set('moment_code', momentCode);
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditationSummaryResponse>(
        `${ACCREDITATIONS_SUMMARY_URL}?${query.toString()}`,
        HttpMethod.Get
      )
    );

    return {
      generated: response.generated ?? 0,
      delivered: response.delivered ?? 0
    };
  }

  public async requestDetail(code: string): Promise<AccreditedRecordDetail> {
    if (useAccreditationMock()) {
      const listed = this.findOrNullById(code);

      return mockResponse(
        buildMockDetail(code, listed)
      );
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditedRecordDetailResponse>(
        `${this.url}/${code}`,
        HttpMethod.Get
      )
    );

    return responseToAccreditedRecordDetail(response);
  }

  // Emitir la acreditación de UNA persona, con la identidad que traiga el payload:
  // `user_code` para quien tiene cuenta en la plataforma y `mission_staff_code` para el
  // personal de misión, que no la tiene. Exactamente una de las dos, o 400.
  //
  // La respuesta del backend no trae documento ni nombre, así que la fila se compone
  // con el sujeto que la pantalla ya tiene: sin eso, la acreditación recién creada
  // aparecería en el listado sin saber de quién es.
  //
  // El sujeto se pide por su FORMA y no como `AccreditationPerson` porque el personal de
  // misión no llega por ahí: llega como `ReadyParticipant`, que no tiene —ni puede tener—
  // un usuario de la plataforma. Los dos traen estos seis campos, que son los únicos que
  // esto usa.
  public async create(
    payload: AccreditationCreatePayload,
    subject: AccreditedRowSubject
  ): Promise<AccreditedRecord> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationCreatedResponse>({
          code: crypto.randomUUID(),
          event_id: payload.event_id,
          user_code: payload.user_code,
          role_code: payload.role_code,
          role_name: payload.role_code,
          status: 'ACTIVE',
          qr_public_token: crypto.randomUUID(),
          permissions: [],
          created_at: new Date().toISOString()
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationCreatedResponse>(
            this.url,
            HttpMethod.Post,
            { payload }
          )
        ));

    const record = responseToAccreditedRecord({
      code: response.code,
      event_id: response.event_id,
      user_code: response.user_code,
      document_number: subject.document,
      full_name: [
        subject.firstName,
        subject.secondName,
        subject.lastName,
        subject.secondLastName
      ]
        .filter(Boolean)
        .join(' '),
      department_name: subject.departmentName,
      role_code: response.role_code,
      role_name: response.role_name,
      status: response.status,
      permissions_total: (response.permissions ?? []).length,
      uses_consumed: 0,
      created_at: response.created_at ?? new Date().toISOString()
    });

    this.list?.unshift(record);

    return record;
  }

  /**
   * La auditoría de TODO el evento: quién hizo qué, a quién y cuándo.
   *
   * Es el endpoint que faltaba. Acá decía que no existía y que armar la línea de tiempo
   * costaría una petición por acreditado; backend lo expuso el 2026-09-15 y esto lo conecta.
   *
   * Los dos códigos son obligatorios y van juntos por tipo: en el ms cada fila de `events` es
   * un par evento+fase, así que pedirlo con el `event_id` entero habría devuelto la auditoría
   * de UNA fase sin avisar de que faltaba el resto.
   *
   * Recorrido acotado, igual que las lecturas —páginas de 100 y tope de 20—: la pantalla
   * filtra y cuenta en cliente sobre el conjunto, así que necesita el conjunto, pero 2.000
   * movimientos son más de lo que nadie audita a ojo. Si un evento los pasa, hay que paginar
   * en servidor y mover los filtros allá.
   */
  public async requestEventAudit(
    params: AccreditationAuditParams
  ): Promise<AccreditationAudit[]> {
    // En demo no hay nada que recorrer, igual que las lecturas: salir a la red desde ahí daría
    // un error de conexión en vez del vacío que la pantalla ya sabe explicar.
    if (useAccreditationMock()) {
      return [];
    }

    const movimientos: AccreditationAudit[] = [];

    for (let page = 1; page <= AUDIT_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        ...params,
        limit: String(AUDIT_PAGE_LIMIT),
        page: String(page)
      });

      const response = await this.apiClient.execute(
        new HttpEndpoint<{
          data: AccreditationEventAuditResponse[];
          meta?: { total?: number };
        }>(`${ACCREDITATIONS_AUDIT_URL}?${query}`, HttpMethod.Get)
      );

      const filas = response.data ?? [];

      movimientos.push(...filas.map(responseToAccreditationAudit));

      // Por el TOTAL y no por «esta página vino corta»: si el gateway recortara el límite,
      // cortar ahí dejaría fuera el resto en silencio. Sin total en el sobre, se para cuando
      // la página no trae nada.
      const total = response.meta?.total;

      if (total !== undefined) {
        if (page * AUDIT_PAGE_LIMIT >= total) {
          break;
        }
      } else if (!filas.length) {
        break;
      }
    }

    return movimientos;
  }

  // La auditoría de la acreditación, de a una. Sigue valiendo para el detalle, donde la
  // persona es el dueño de la URL.
  public async requestHistory(code: string): Promise<AccreditationAudit[]> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationHistoryResponse>({ data: [] })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationHistoryResponse>(
            accreditationHistoryUrl(code),
            HttpMethod.Get
          )
        ));

    return (response.data ?? []).map(responseToAccreditationAudit);
  }

  // Entregar el carnet. No acepta observación —el contrato del individual no tiene
  // cuerpo, aunque el masivo sí acepte `reason`— y NO cambia el estado: entregada y
  // activa son dos ejes distintos.
  public deliver(record: AccreditedRecord): Promise<AccreditedRecord> {
    return this.action(record, 'deliver');
  }

  // Las dos terminales. Revertir la entrega además INACTIVA: no hay vuelta atrás, y
  // para volver a acreditar se emite una nueva.
  public undoDelivery(
    record: AccreditedRecord,
    reason?: string
  ): Promise<AccreditedRecord> {
    return this.action(record, 'undo-delivery', reason);
  }

  public deactivate(
    record: AccreditedRecord,
    reason?: string
  ): Promise<AccreditedRecord> {
    return this.action(record, 'deactivate', reason);
  }

  private async action(
    record: AccreditedRecord,
    action: 'deliver' | 'undo-delivery' | 'deactivate',
    reason?: string
  ): Promise<AccreditedRecord> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationActionResponse>({
          code: String(record.id),
          status: action === 'deliver' ? record.statusCode : 'REVOKED',
          delivered_at:
            action === 'deliver'
              ? new Date().toISOString()
              : action === 'undo-delivery'
                ? null
                : (record.deliveredAt?.toISOString() ?? null)
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationActionResponse>(
            accreditationActionUrl(String(record.id), action),
            HttpMethod.Patch,
            // `deliver` no lleva cuerpo; en las otras la observación es opcional para
            // el backend, aunque la pantalla la exija.
            reason ? { payload: { reason } } : {}
          )
        ));

    return this.applyAction(record, response);
  }

  // El reporte de acreditados, en tres pasos: pedirlo (202), consultar su estado hasta que
  // sea terminal, y descargarlo por su `upload_id` con el mismo camino que los carnets.
  //
  // Se lleva lo FILTRADO y no la página, igual que el CSV al que reemplaza. La diferencia es
  // que aquél lo armaba el navegador pidiendo 20 páginas de 100 y cortaba a las 2.000 filas
  // sin avisar; éste no tiene tope, y si se cortara terminaría en FAILED con su motivo en vez
  // de en COMPLETED con filas de menos.
  public async requestReport(
    payload: AccreditationReportPayload
  ): Promise<AccreditationReportCreatedResponse> {
    return this.apiClient.execute(
      new HttpEndpoint<AccreditationReportCreatedResponse>(
        ACCREDITATION_REPORTS_URL,
        HttpMethod.Post,
        { payload }
      )
    );
  }

  // Solo observa: el backend lo genera de fondo lo consulten o no.
  public async requestReportStatus(
    reportCode: string
  ): Promise<AccreditationReportStatusResponse> {
    return this.apiClient.execute(
      new HttpEndpoint<AccreditationReportStatusResponse>(
        accreditationReportUrl(reportCode),
        HttpMethod.Get
      )
    );
  }

  // Emitir en bloque: UNA llamada atómica en vez del bucle que había.
  //
  // Lo que se fue con ella: el `ensurePerson` por cabeza —una búsqueda y a veces una
  // creación, o sea 2N peticiones—, y el lote a medias cuando fallaba uno del medio. El
  // backend resuelve la persona contra user-auth y la crea si falta.
  //
  // A diferencia de `create`, acá NO hace falta pasarle la persona: `processed` trae
  // `full_name` del padrón, que es de donde tiene que salir —es el que se imprime en el
  // carnet—. Por eso esto no compone la fila y `create` sí.
  //
  // No se vuelca al store paginado a propósito. La respuesta no trae ni el documento ni el
  // estado de entrega ni los permisos, así que una fila armada con esto saldría coja en la
  // tabla; las pantallas que emiten recargan (`onEmitted`), que es más barato que fingir.
  /**
   * Acreditar Y encolar el carnet en una sola llamada.
   *
   * Mismo payload que `bulkCreate` —lo dice el contrato del gateway, que reutiliza su request—,
   * y responde 202: las acreditaciones ya están, el PDF no. El lote vuelve ya traducido a
   * `CardBatch` con `acceptedToCardBatch`, el MISMO mapeo del 202 de los endpoints de carnet,
   * porque el bloque llega con sus mismas claves snake_case. Medido contra staging.
   *
   * `cardBatch` en null NO es un fallo: puede que no se acreditara a nadie, o que nadie tenga
   * foto aprobada —y en ese segundo caso las acreditaciones SÍ quedaron creadas—. El motivo
   * viene aparte para poder explicarlo sin llamarlo error.
   */
  public async emitWithCard(payload: AccreditationBulkCreatePayload): Promise<{
    accreditation: AccreditationBulkCreateResponse;
    cardBatch: CardBatch | null;
    cardBatchSkippedReason: string | null;
  }> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditationEmitWithCardResponse>(
        ACCREDITATIONS_EMIT_WITH_CARD_URL,
        HttpMethod.Post,
        { payload }
      )
    );

    // Con `??` y no con `=== null`: la clave llega AUSENTE cuando no hay lote.
    const lote = response.card_batch ?? null;

    return {
      accreditation: response.accreditation,
      cardBatch: lote ? acceptedToCardBatch(lote) : null,
      cardBatchSkippedReason: response.card_batch_skipped_reason ?? null
    };
  }

  /**
   * Cambia el tipo de acreditado: inactiva la acreditación y emite una nueva para la misma
   * persona con el tipo destino. Devuelve el código de la NUEVA, que es la que hay que abrir:
   * la vieja queda inactiva.
   *
   * `cardBatch` en null no es un fallo, igual que en `emitWithCard`: la acreditación nueva SÍ
   * quedó creada y el motivo explica por qué todavía no hay PDF.
   */
  public async changeRole(
    code: string,
    payload: AccreditationChangeRolePayload
  ): Promise<{
    newCode: string;
    cardBatch: CardBatch | null;
    cardBatchSkippedReason: string | null;
  }> {
    const response = await this.apiClient.execute(
      new HttpEndpoint<AccreditationChangeRoleResponse>(
        accreditationChangeRoleUrl(code),
        HttpMethod.Post,
        { payload }
      )
    );

    // La vieja quedó INACTIVE en el backend: si está en la lista cargada se repinta como
    // en las demás acciones del ciclo de vida, o al volver por el migajón seguiría activa.
    const listed = this.findOrNullById(code);

    if (listed) {
      this.applyAction(listed, {
        code,
        status: 'INACTIVE',
        delivered_at: listed.deliveredAt?.toISOString() ?? null,
        delivered_by_code: listed.deliveredByCode
      });
    }

    const lote = response.card_batch ?? null;

    return {
      newCode: response.accreditation.code,
      cardBatch: lote ? acceptedToCardBatch(lote) : null,
      cardBatchSkippedReason: response.card_batch_skipped_reason ?? null
    };
  }

  public async bulkCreate(
    payload: AccreditationBulkCreatePayload
  ): Promise<AccreditationBulkCreateResponse> {
    return this.apiClient.execute(
      new HttpEndpoint<AccreditationBulkCreateResponse>(
        ACCREDITATIONS_BULK_CREATE_URL,
        HttpMethod.Post,
        { payload }
      )
    );
  }

  // Las acciones masivas aceptan UNA fuente: los códigos o el lote completo. Lo
  // interesante de la respuesta es `skipped`, que explica en español por qué se saltó
  // cada uno; la pantalla lo muestra tal cual en lugar de decir «algunas fallaron».
  public async bulk(
    action: 'deliver' | 'deactivate',
    payload: AccreditationBulkPayload,
    records: AccreditedRecord[] = []
  ): Promise<AccreditationBulkResponse> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationBulkResponse>({
          processed: records.map((record) => ({
            code: String(record.id),
            status: action === 'deliver' ? record.statusCode : 'REVOKED',
            delivered_at:
              action === 'deliver'
                ? new Date().toISOString()
                : (record.deliveredAt?.toISOString() ?? null)
          })),
          skipped: [],
          total_requested: records.length,
          total_processed: records.length
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationBulkResponse>(
            accreditationBulkUrl(action),
            HttpMethod.Post,
            { payload }
          )
        ));

    // Solo se repintan las que el backend dice haber tocado: las saltadas se quedan
    // como estaban, que es justo lo que el motivo explica.
    (response.processed ?? []).forEach((processed) => {
      const record = this.findOrNullById(processed.code);

      if (record) {
        this.applyAction(record, processed);
      }
    });

    return response;
  }

  // La respuesta de las acciones es parcial (code, status y la entrega), así que la
  // fila se reconstruye sobre la que ya estaba en lugar de perder el resto.
  private applyAction(
    record: AccreditedRecord,
    response: AccreditationActionResponse
  ): AccreditedRecord {
    const updated = new AccreditedRecord(
      String(record.id),
      record.eventId,
      record.document,
      record.fullName,
      record.roleCode,
      record.roleName,
      response.status ?? record.statusCode,
      record.permissionsTotal,
      record.usesConsumed,
      record.createdAt,
      record.departmentName,
      response.delivered_at ? new Date(response.delivered_at) : null,
      response.delivered_by_code ?? null
    );

    this.list?.refresh(updated);

    return updated;
  }
}

// En modo demo no hay un 201 real del que sacar el detalle: se compone con la fila
// que el listado ya tiene y unos permisos de ejemplo, para que la pantalla se pueda
// recorrer sin backend.
function buildMockDetail(
  code: string,
  listed?: AccreditedRecord
): AccreditedRecordDetail {
  return new AccreditedRecordDetailClass(
    code,
    listed?.eventId ?? 1,
    listed?.document ?? '—',
    listed?.fullName ?? 'Acreditado de ejemplo',
    listed?.roleCode ?? 'DEPORTISTA',
    listed?.roleName ?? 'Deportista',
    listed?.statusCode ?? 'ACTIVE',
    listed?.permissionsTotal ?? 2,
    listed?.usesConsumed ?? 0,
    listed?.createdAt ?? new Date(),
    listed?.departmentName ?? 'Bogotá D.C.',
    listed?.deliveredAt ?? null,
    listed?.deliveredByCode ?? null,
    'demo-qr-token',
    listed?.createdAt ?? new Date(),
    [
      new AccreditationPermission(
        5,
        'Alimentación',
        true,
        5,
        listed?.usesConsumed ?? 0,
        new Date('2026-08-01T00:00:00'),
        new Date('2026-12-31T23:59:59'),
        '9b90d0f7-6375-4551-9329-b2d1ff43c933'
      ),
      new AccreditationPermission(
        6,
        'Áreas de prensa',
        false,
        null,
        0,
        new Date('2026-08-01T00:00:00'),
        new Date('2026-12-31T23:59:59'),
        null
      )
    ]
  );
}

registerDependency(AccreditedRecordRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
