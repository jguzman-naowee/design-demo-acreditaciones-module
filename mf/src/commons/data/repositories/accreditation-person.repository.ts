import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import type { AccreditationPerson } from '../../domain/entities/accreditation-person';
import type {
  ParticipantFacets,
  ReadyParticipant
} from '../../domain/entities/ready-participant';
import {
  participantFacetsUrl,
  PERSONS_URL,
  readyForAccreditationUrl,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { responseToAccreditationPerson } from '../factories/accreditation-person.factory';
import {
  responseToParticipantFacets,
  responseToReadyParticipant
} from '../factories/ready-participant.factory';
import { mockResponse } from '../mocks/mock.helper';
import type {
  AccreditationPersonPayload,
  AccreditationPersonResponse,
  AccreditationPersonsResponse
} from '../models/accreditation-person.model';
import type {
  ParticipantFacetsResponse,
  ReadinessFilter,
  ReadyParticipantsResponse,
  ReadyTransversalFilters
} from '../models/ready-participant.model';

// El backend topa el límite en 100 (ver READY_LIMIT_MAX), así que el tamaño de página lo
// decide la pantalla, no el contrato.
//
// Cuatro y no diez porque es lo que CABE. La lista del modal de acreditar vive en un cuerpo de
// alto fijo —el modal no se mueve entre estados, que QA reportó dos veces— y ahí entran cuatro
// filas: la fila mide 63px más 8 de separación, así que una página de cuatro pide 292px de
// contenido, contando el «Seleccionar toda la página». Con diez pedía 702px en 292px y QA se
// quejó del scroll de dentro de la lista. Para ver el resto está la paginación, que ya estaba.
const READY_LIMIT = 4;

// El tope que el contrato acepta por página, y hasta dónde recorre el reporte. 20 páginas de
// 100 son 2.000 acreditables: más de lo que nadie abre en Excel, y sin el tope un evento
// grande se traería la inscripción entera.
const READY_LIMIT_MAX = 100;
const READY_MAX_PAGES = 20;

// La página de candidatos. No se usa el PaginationRepository del SDK porque el sobre
// de este endpoint no es `{data, meta}`.
export interface ReadyParticipantsPage {
  items: ReadyParticipant[];
  page: number;
  size: number;
  total: number;
  counts?: Record<ReadinessFilter, number>;
}

// La búsqueda por documento es exacta y devuelve 0 o 1: no es un listado. Por eso
// esto no es un PaginationRepository —la respuesta no trae `meta`— sino una consulta
// puntual.
//
// TODO(api): hace falta el listado paginado con búsqueda para la Lista de
// habilitados; hoy solo se puede preguntar por un documento concreto.
export class AccreditationPersonRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public async findByDocument(
    document: string
  ): Promise<AccreditationPerson | undefined> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationPersonsResponse>({ data: [] })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationPersonsResponse>(
            PERSONS_URL,
            HttpMethod.Get,
            { queryParams: { document_number: document } }
          )
        ));

    const person = response.data?.[0];

    return person ? responseToAccreditationPerson(person) : undefined;
  }

  // Registrar a la persona en el módulo. El `user_code` es la identidad y desde el
  // 2026-08-13 el backend valida que ese usuario exista de verdad: con uno inventado
  // responde 404 «No se encontró el usuario … en la plataforma», que es justo lo que
  // queríamos para no dejar personas colgando de nadie.
  public async create(
    payload: AccreditationPersonPayload
  ): Promise<AccreditationPerson> {
    const response = await (useAccreditationMock()
      ? mockResponse<AccreditationPersonResponse>({
          code: crypto.randomUUID(),
          user_code: payload.user_code,
          document_number: payload.document_number,
          name: payload.name,
          second_name: payload.second_name,
          last_name: payload.last_name,
          second_last_name: payload.second_last_name,
          sex: payload.sex,
          email: payload.email,
          department_code: payload.department_code,
          department_name: payload.department_name
        })
      : this.apiClient.execute(
          new HttpEndpoint<AccreditationPersonResponse>(
            PERSONS_URL,
            HttpMethod.Post,
            { payload }
          )
        ));

    return responseToAccreditationPerson(response);
  }

  // Los participantes de la fase con toda su documentación obligatoria aprobada: la
  // fuente de «habilitados». El que tenga un requisito rechazado no aparece.
  //
  // Pagina y busca en el SERVIDOR desde el despliegue del 2026-08-13, y solo la página
  // devuelta se enriquece contra user-auth: por eso el buscador de la pantalla viaja
  // en lugar de recortar lo que ya llegó. `limit` tope 100.
  //
  // Va con `exclude_accredited` por defecto: ofrecer en el mostrador a alguien que ya tiene su
  // acreditación activa solo lleva al 409 de «una acreditación por persona y evento». La lista
  // unificada lo apaga porque quiere las dos poblaciones; ver `excludeAccredited`.
  //
  // Con una trampa que backend dejó dicha y que la pantalla tiene que contar: el filtro
  // corre SOBRE LA PÁGINA, así que una página puede venir corta —o vacía— sin que el
  // `total` baje. Y si accreditation-ms no responde, degrada a la página sin filtrar.
  // TODOS los que casan con el filtro, para el reporte. Mismo criterio que el listado de
  // acreditados: un CSV hecho con la página que se ve saldría con diez filas y quien lo abra
  // creería que la fase tiene diez acreditables.
  //
  // Corta cuando una página no trae NINGÚN código nuevo, y no cuando trae menos de las
  // pedidas: así también cubre un backend que ignore `page`, y de paso el recorte-sobre-la-
  // página de los transversales, que devuelve páginas cortas en medio del recorrido.
  public async requestAllReady(
    eventCode: string,
    phaseCode: string,
    params: Parameters<AccreditationPersonRepository['requestReady']>[2] = {}
  ): Promise<ReadyParticipant[]> {
    const porCodigo = new Map<string, ReadyParticipant>();

    for (let page = 1; page <= READY_MAX_PAGES; page += 1) {
      const pagina = await this.requestReady(eventCode, phaseCode, {
        ...params,
        limit: READY_LIMIT_MAX,
        page
      });

      pagina.items.forEach((item) => porCodigo.set(String(item.id), item));

      // Se para por el TOTAL, no por «esta página vino corta». Con el recorte de los
      // transversales una página intermedia puede venir VACÍA sin que se hayan acabado los
      // datos, así que cortar ahí dejaría fuera a los de las páginas siguientes.
      //
      // Y si el backend ignorara `page`, el Map por código evita repetir filas y el total
      // acota el bucle igual.
      if (page * READY_LIMIT_MAX >= pagina.total) {
        break;
      }
    }

    return [...porCodigo.values()];
  }

  // Los valores que se pueden filtrar en el evento, con su conteo. UNA consulta agregada en
  // orc: no depende del tamaño del evento y no obliga a documentation-ms a cargar candidatos.
  //
  // `role` acota a deportistas o a personal de apoyo. Ojo: con SUPPORT_PERSONNEL el bloque de
  // deportes viene vacío a propósito —el deporte del apoyo no sale del mismo sitio que el
  // filtro sabe honrar—, así que ese desplegable se queda sin opciones en esa vista.
  public async requestFacets(
    eventCode: string,
    phaseCode?: string,
    role?: string
  ): Promise<ParticipantFacets> {
    if (useAccreditationMock()) {
      return mockResponse({ sports: [], departments: [], municipalities: [] });
    }

    const response = await this.apiClient.execute(
      new HttpEndpoint<ParticipantFacetsResponse>(
        participantFacetsUrl(eventCode),
        HttpMethod.Get,
        {
          queryParams: {
            ...(phaseCode ? { phase_code: phaseCode } : {}),
            ...(role ? { role } : {})
          }
        }
      )
    );

    return responseToParticipantFacets(response);
  }

  public async requestReady(
    eventCode: string,
    phaseCode: string,
    params: {
      // Qué lista: los acreditables (READY, el default) o los que tienen documentación
      // incompleta (PENDING). Con otro valor el backend responde 400.
      readiness?: ReadinessFilter;
      limit?: number;
      page?: number;
      search?: string;
      // El rol EN SINGULAR. Sigue vivo —medido en staging: `user_role=ATHLETE` devuelve los 58
      // deportistas de la fase— y es lo que usa el modal de acreditar. Para la lista se
      // prefiere `roles`, que además sabe nombrar al personal de misión.
      userRole?: string;
      // Los tipos de rol EN LISTA: ATHLETE, SUPPORT_PERSONNEL, MISSION_STAFF. Reemplaza a
      // `userRole` y es el único que puede pedir personal de misión. CSV.
      //
      // Ojo: el `role` a secas (sin `user_`) está muerto: el gateway lo IGNORA en silencio y
      // devuelve la lista entera. Medido.
      roles?: string;
      // La FUNCIÓN concreta dentro del rol —ENT, DAS del apoyo; JMI, MED del personal de
      // misión—. Un deportista no tiene función, así que este filtro lo excluye por
      // construcción. CSV.
      subroleCodes?: string;
      // Los transversales de inscripción, ya en CSV. Ver ReadyTransversalFilters.
      transversal?: ReadyTransversalFilters;
      // Si se restan los que YA están acreditados. Por defecto SÍ, que es lo que quiere el
      // modal de acreditar: ofrecer ahí a quien ya tiene su acreditación activa solo lleva al
      // 409 de «una acreditación por persona y evento».
      //
      // La lista unificada manda `false` a propósito: quiere las dos poblaciones para poder
      // pintar el estado de cada una. Medido en staging: resta SOLO las ACTIVE —las INACTIVE
      // se quedan, marcadas—, 62 filas con `false` contra 61 con `true`.
      excludeAccredited?: boolean;
      // Y el de al lado: solo los que YA están acreditados. Llegó el 2026-09-16 y es la vista
      // inversa, la que faltaba para que esta lista pudiera contarlo todo.
      //
      // Los dos a la vez son un 400 y con razón: no dejarían a nadie. La pantalla manda uno o
      // ninguno —su desplegable es de tres valores, no dos casillas— así que el caso no se
      // puede armar desde la UI; aun así el tipo los deja sueltos y quien los combine se lleva
      // el 400 del backend, que es mejor que un filtro nuestro que los silencie.
      //
      // Medido en staging sobre la fase Regionales: 23 en la unión, 15 con `only_accredited` y
      // 8 con `exclude_accredited`. Los dos parten el conjunto sin solaparse.
      onlyAccredited?: boolean;
      // Momento de la fase: deportistas y apoyo de sus deportes, el personal de misión
      // registrado en él y todo el personal Naowee. Sin él, la fase entera.
      momentCode?: string | null;
    } = {}
  ): Promise<ReadyParticipantsPage> {
    const response = await (useAccreditationMock()
      ? mockResponse<ReadyParticipantsResponse>({
          event_code: eventCode,
          phase_code: phaseCode,
          participants: [],
          total: 0,
          page: 1,
          size: params.limit ?? READY_LIMIT
        })
      : this.apiClient.execute(
          new HttpEndpoint<ReadyParticipantsResponse>(
            readyForAccreditationUrl(eventCode, phaseCode),
            HttpMethod.Get,
            {
              queryParams: {
                page: params.page ?? 1,
                limit: params.limit ?? READY_LIMIT,
                exclude_accredited: params.excludeAccredited ?? true,
                ...(params.momentCode
                  ? { moment_code: params.momentCode }
                  : {}),
                ...(params.onlyAccredited ? { only_accredited: true } : {}),
                ...(params.readiness ? { readiness: params.readiness } : {}),
                ...(params.search ? { search: params.search } : {}),
                ...(params.userRole ? { user_role: params.userRole } : {}),
                ...(params.roles ? { roles: params.roles } : {}),
                ...(params.subroleCodes
                  ? { subrole_codes: params.subroleCodes }
                  : {}),
                // Solo los que tienen valor: mandar `sport_codes=` vacío no filtra nada pero
                // ensucia la petición y hace más difícil leer qué se pidió de verdad.
                ...Object.fromEntries(
                  Object.entries(params.transversal ?? {}).filter(
                    ([, valor]) => !!valor
                  )
                )
              }
            }
          )
        ));

    const items = (response.participants ?? []).map(responseToReadyParticipant);

    const { READY, PENDING } = response.counts ?? {};

    return {
      items,
      page: response.page ?? params.page ?? 1,
      size: response.size ?? params.limit ?? READY_LIMIT,
      total: response.total ?? items.length,
      ...(typeof READY === 'number' && typeof PENDING === 'number'
        ? { counts: { READY, PENDING } }
        : {})
    };
  }
}

registerDependency(AccreditationPersonRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
