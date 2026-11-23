import { type ApiConfig, runtimeConfig } from '@naowee-tech/sdk-frontend-web';

export function resolveApiUrlV1(): string {
  return (
    runtimeConfig('apiv1') ??
    // El bundle de federación no define import.meta.env; sin el `?.` esto
    // revienta en lugar de caer al valor por defecto.
    import.meta.env?.API_URL_V1 ??
    '/public-gateway/v1'
  );
}

// Hoy ningún endpoint del módulo vive en v2 —el listado de eventos era el último y lo
// reemplazó el catálogo de acreditación—, pero el shell sigue publicando `apiv2` en su
// configuración de runtime, así que la resolución se queda acá para el día que vuelva.
export function resolveApiUrlV2(): string {
  return (
    runtimeConfig('apiv2') ??
    import.meta.env?.API_URL_V2 ??
    '/public-gateway/v2'
  );
}

export const API_CONFIG: ApiConfig = {
  get baseUrl() {
    return resolveApiUrlV1();
  },
  auth: {
    loginPath: '/auth/login',
    logoutPath: '/auth/logout',
    mePath: '/auth/me'
  }
};

// El módulo de acreditación cuelga de su propio prefijo dentro de v1:
// /public-gateway/v1/accreditation/*.
export const ACCREDITATION_PATH = '/accreditation';

// El gateway solo comprueba este permiso en los tres endpoints de carnets, pero
// el accreditation-ms lo valida en los diez (confirmado por backend), así que sin
// él no se puede ni leer el catálogo. Es el único permiso del módulo:
// `accreditation:list` no existe.
export const ACCREDITATION_MANAGE = 'accreditation:manage';

// Prefijo de file-storage, que también vive en v1 pero fuera de acreditación.
export const FILES_PATH = '/files';

// Las rutas viven aquí y no en cada repositorio porque el registro de mocks
// también las necesita, y al importarlas desde los repositorios se formaba un
// ciclo (registro → repositorio → cliente → registro) que dejaba la inyección de
// dependencias a medio inicializar.
export const ACCESS_PERMISSIONS_URL = `${ACCREDITATION_PATH}/permissions`;
export const ACCREDITED_TYPES_URL = `${ACCREDITATION_PATH}/roles`;
export const ACCREDITATIONS_URL = `${ACCREDITATION_PATH}/accreditations`;
export const PERSONS_URL = `${ACCREDITATION_PATH}/persons`;
// Los dos contadores del evento —generadas y entregadas— en una sola consulta agregada del
// backend. Existe justo para no traerse el listado entero y contarlo en el navegador.
export const ACCREDITATIONS_SUMMARY_URL = `${ACCREDITATIONS_URL}/summary`;

/**
 * La auditoría TRANSVERSAL del evento: quién hizo qué, a quién y cuándo (SUV2, handoff del
 * 2026-09-15). Es el endpoint que faltaba —hasta ahora los movimientos solo se podían pedir
 * de a uno, por acreditación, y armar la línea de tiempo habría costado una petición por
 * acreditado—.
 *
 * Se pide con `event_code` Y `phase_code`, los dos uuid y los dos OBLIGATORIOS: en el ms cada
 * fila de `events` es un par evento+fase, así que el `event_id` entero que se usa en el resto
 * del módulo identifica UNA fase y no el evento. Pedirlo con él habría devuelto la auditoría
 * de una sola fase sin ninguna señal de que faltaba el resto.
 *
 * Medido contra staging el 2026-09-15: con los dos códigos, 200 y 71 movimientos; con uno
 * solo o con el viejo `event_id`, 400.
 */
export const ACCREDITATIONS_AUDIT_URL = `${ACCREDITATIONS_URL}/audit`;
export const EVENT_REGISTRATIONS_URL = `${ACCREDITATION_PATH}/events`;
// Los eventos que SÍ tienen acreditación configurada, con búsqueda de servidor: es lo que
// la pantalla de entrada necesita para no recorrer los 485 eventos de /v2/events.
export const EVENT_CATALOG_URL = `${EVENT_REGISTRATIONS_URL}/catalog`;
export const PRESIGNED_UPLOAD_URL = `${FILES_PATH}/presigned-upload`;
// Los lotes de carnets: el POST del carnet devuelve un batch_code y este GET es el
// único sitio donde se ve si el PDF ya existe.
export const CARD_BATCHES_URL = `${ACCREDITATION_PATH}/card-batches`;
// El mismo dato visto por persona: una fila por acreditado con carnet, con su lote. Es lo
// que pinta «Lista de acreditados».
export const CARD_BATCH_MEMBERS_URL = `${CARD_BATCHES_URL}/members`;

// Las escrituras del catálogo van por `code` (uuid), no por el id numérico.
export function permissionUrl(code: string): string {
  return `${ACCESS_PERMISSIONS_URL}/${code}`;
}

export function permissionStateUrl(code: string, active: boolean): string {
  return `${permissionUrl(code)}/${active ? 'activate' : 'deactivate'}`;
}

export function accreditedTypeUrl(code: string): string {
  return `${ACCREDITED_TYPES_URL}/${code}`;
}

export function accreditedTypeStateUrl(code: string, active: boolean): string {
  return `${accreditedTypeUrl(code)}/${active ? 'activate' : 'deactivate'}`;
}

// El ciclo de vida de la entrega. `deliver` no lleva cuerpo; las otras dos aceptan
// {reason} y son terminales.
export function accreditationActionUrl(
  code: string,
  action: 'deliver' | 'undo-delivery' | 'deactivate'
): string {
  return `${ACCREDITATIONS_URL}/${code}/${action}`;
}

// Cambiar el tipo de acreditado: el backend inactiva la acreditación y emite una nueva para la
// misma persona con el tipo destino, en una sola operación, y le encola el carnet.
export function accreditationChangeRoleUrl(code: string): string {
  return `${ACCREDITATIONS_URL}/${code}/change-role`;
}

export function accreditationBulkUrl(action: 'deliver' | 'deactivate'): string {
  return `${ACCREDITATIONS_URL}/bulk-${action}`;
}

// La emisión masiva. Va aparte y no ensanchando el tipo de arriba a propósito: `bulk-deliver`
// y `bulk-deactivate` actúan sobre acreditaciones que YA existen y se identifican por su
// código, y esta las CREA a partir de `user_code`. Son operaciones distintas con cuerpos
// distintos, y ese tipo cerrado es lo que impide mandar una donde va la otra.
export const ACCREDITATIONS_BULK_CREATE_URL = `${ACCREDITATIONS_URL}/bulk`;

// Acreditar Y encolar el carnet en UNA llamada (SUV2-2382). Mismo cuerpo que la de arriba
// —acreditar a una persona es una lista de un ítem, y el carnet individual ya es un lote de uno
// por dentro—, así que no hay dos caminos que mantener.
//
// Responde **202 y no 201**, y eso es lo que cambia el flujo: acreditar TERMINA en esta
// petición, pero el PDF se encola y su avance se sigue con `GET /card-batches/{code}`.
//
// OJO CON LA DOCUMENTACIÓN, que está mal y no avisa: el handoff y el `.bru` de la colección
// dicen que el bloque `card_batch` viene en camelCase (`batchCode`, `totalCards`…). Es FALSO.
// Medido contra staging el 2026-09-15 acreditando a una persona de verdad: llega en snake_case
// —`batch_code, batch_number, total_cards, total_chunks, cards_without_photo, skipped`—, que es
// lo que declara `AccreditationMsCardBatchCreatedResponse`, el MISMO struct que ya devuelven los
// endpoints de carnet. Por eso `acceptedToCardBatch` lo mapea sin tocar nada.
//
// No lo «arregles» a camelCase: las claves nuevas no darían error de tipos, el lote saldría con
// `id: undefined` y el seguimiento se quedaría pidiendo `/card-batches/undefined` con la
// pantalla congelada en «generando».
export const ACCREDITATIONS_EMIT_WITH_CARD_URL = `${ACCREDITATIONS_URL}/emit-with-card`;

// El reporte de acreditados: se pide, se consulta su estado y se descarga por `upload_id`.
// No cuelga de `/accreditations` porque no es una acción sobre ellas: es un trabajo del
// evento que produce un archivo.
export const ACCREDITATION_REPORTS_URL = `${ACCREDITATION_PATH}/reports`;

export function accreditationReportUrl(reportCode: string): string {
  return `${ACCREDITATION_REPORTS_URL}/${reportCode}`;
}

// La validación en punto de acceso y sus lecturas.
export const VALIDATE_URL = `${ACCREDITATIONS_URL}/validate`;
export const VALIDATION_LOGS_URL = `${ACCREDITATION_PATH}/validation-logs`;
export const VALIDATORS_URL = `${ACCREDITATION_PATH}/validators`;

export function accreditationHistoryUrl(code: string): string {
  return `${ACCREDITATIONS_URL}/${code}/history`;
}

export function accreditationCardUrl(code: string): string {
  return `${ACCREDITATIONS_URL}/${code}/card`;
}

export function eventCardsUrl(eventCode: string): string {
  return `${EVENT_REGISTRATIONS_URL}/${eventCode}/cards`;
}

export function cardBatchUrl(batchCode: string): string {
  return `${CARD_BATCHES_URL}/${batchCode}`;
}

// Certificados de participación: config por evento+fase y generación (E2E stg 2026-09-07).
export const CERTIFICATES_URL = `${ACCREDITATION_PATH}/certificates`;
export const CERTIFICATE_BATCHES_URL = `${CERTIFICATES_URL}/batches`;

export function certificateConfigUrl(eventCode: string): string {
  return `${EVENT_REGISTRATIONS_URL}/${eventCode}/certificates/config`;
}

export function eventCertificatesUrl(eventCode: string): string {
  return `${EVENT_REGISTRATIONS_URL}/${eventCode}/certificates`;
}

export function certificateBatchUrl(batchCode: string): string {
  return `${CERTIFICATE_BATCHES_URL}/${batchCode}`;
}

// Deportes configurados del evento (competition-rules, fuera de /accreditation):
// las filas de fecha por deporte de la pantalla de configuración. Acepta
// ?phase_code= para recortar a los habilitados en la fase.
export function eventSportsUrl(eventCode: string): string {
  return `/event-rules/${eventCode}/sports`;
}

// Los valores que de verdad hay para filtrar en el evento —deportes, delegaciones y
// municipios, con su conteo— resueltos por orc con UNA consulta agregada. Existe para no
// deducir los desplegables de la primera página del listado: con más de 100 acreditables esa
// deducción omite valores, y la petición obliga a documentation-ms a cargar todos los
// candidatos en memoria. Acepta ?phase_code= y ?role=.
export function participantFacetsUrl(eventCode: string): string {
  return `/event/${eventCode}/participants/facets`;
}

export function fileDownloadUrl(uploadId: string): string {
  return `${FILES_PATH}/${uploadId}/download-url`;
}
// Los eventos de la suite viven en v2, no bajo el prefijo de acreditación.
// Los participantes listos para acreditar viven en documentation-ms, fuera del
// prefijo de acreditación, y se piden por el par de uuids evento+fase.
export function readyForAccreditationUrl(
  eventCode: string,
  phaseCode: string
): string {
  return `/documentation/processes/by-event/${eventCode}/phase/${phaseCode}/participants/ready-for-accreditation`;
}

// El catálogo de roles del evento, del diccionario público del gateway. Fuera del prefijo de
// acreditación: `/catalogs/:type` es el diccionario transversal que también usa la suite
// (ver sus repositorios de `/catalogs/document-type`, `/catalogs/sex`…).
//
// Medido contra staging el 2026-09-08: devuelve 30 roles con `{code, name}` —Voluntario,
// Invitado Especial, Coordinador de Logística, Médico, Periodista, Juez Nacional,
// Digitador…—. Ojo con la ruta: el grupo PROTEGIDO `/catalog/*` (singular) responde 404 en
// staging entero, `genders` incluido; el que sirve es este, `/catalogs/:type`, en plural.
export const EVENT_ROLE_CATALOG_URL = '/catalogs/event-role';

// Las categorías deportivas: Iniciación, Pre Infantil, Infantil, Pre Juvenil, Juvenil,
// Única. Medido contra staging el 2026-09-10; es el mismo `/catalogs/:type` plano.
//
// Ojo con los vecinos: `categories` y `event-category` también responden 200 pero devuelven
// `[]`. El que trae las seis es este.
export const SPORT_CATEGORY_CATALOG_URL = '/catalogs/sport-category';

// Las funciones de MISIÓN que el evento puede ofrecer. Cuelga del prefijo de acreditación
// —no es un diccionario público como los dos de abajo— y es POR EVENTO: el catálogo de
// funciones vive en orc y cada evento inscribe las suyas.
//
// Medido contra staging el 2026-09-09: el evento 20 devuelve AJM/FIS/JMI…, y los demás
// `functions: []`. Con un event_id que no existe responde 404.
export const ACCREDITED_TYPE_FUNCTIONS_URL = `${ACCREDITED_TYPES_URL}/functions`;

// La taxonomía entera: familias con sus funciones y con qué tipo del evento ocupa cada una.
// Sustituye a `/roles/functions`, que backend mantiene como alias mientras migramos.
export const ROLE_CATALOG_URL = `${ACCREDITATION_PATH}/role-catalog`;

// El otro medio del desplegable de tipos: el personal de apoyo de las delegaciones, que vive
// en su propio diccionario y NO sale en `event-role`.
//
// Medido contra staging el 2026-09-08: tres entradas con la misma forma que el de arriba
// —array pelado de `{code, name}`— ADI/Auxiliar Discapacidad, DAS/Docente Asistente y
// ENT/Docente Entrenador. Ninguno de sus códigos choca con los 30 de `event-role`, así que
// las dos listas se pueden unir sin desambiguar.
export const SUPPORT_PERSONNEL_ROLE_CATALOG_URL =
  '/catalogs/support-personnel-role';

// Las ZONAS del país, para el filtro de territorio de acreditables.
//
// No cuelga de `/catalogs/:type` sino del grupo de localización, el mismo que ya usa la suite
// para departamentos y municipios. Medido contra staging el 2026-09-15: ocho entradas planas
// `{code, name}` —Pacífico, Orinoquia, Eje Cafetero, Centro Sur, Centro Oriente, Caribe 1,
// Caribe 2, Amazonía— con el código en «1».. «8».
//
// Existe porque `region_codes` sí es un filtro del backend pero la región NO es una columna:
// el gateway la traduce a los departamentos que la componen. Sin este diccionario el
// desplegable diría «1», «2»… en vez de la zona.
export const REGIONS_CATALOG_URL = '/locations/regions';

// Los departamentos con su zona. Solo sirve para CRUZAR: qué departamentos caen en la zona
// elegida, y así encadenar los dos desplegables. Las opciones de delegación siguen saliendo de
// las facetas del evento.
//
// Devuelve `regionCode` en camelCase —el grupo de localización no sigue la convención del
// resto del gateway—. Medido contra staging el 2026-09-15: 33 departamentos en 8 zonas.
export const DEPARTMENTS_CATALOG_URL = '/locations/departments';

// El detalle del evento vive en v1 (es el de orc) y es de donde salen las fases con
// proceso de acreditación. El LISTADO de v2 ya no se usa: los eventos que sirven los da
// EVENT_CATALOG_URL, que además busca en el servidor.
export const SUITE_EVENT_DETAIL_URL = '/event';

export const USE_MOCK_KEY = 'naowee.acreditaciones.use-mock';

// El accreditation-ms no está desplegado en dev y stg está apagado, así que las
// pantallas conectadas no traen datos hasta que backend despliegue. Este
// interruptor las devuelve a los mocks en memoria para una demo.
//
// Dos formas de prenderlo: el shell publica el global desde su
// ACCREDITATION_USE_MOCK al arrancar (el bundle de federación no recibe
// import.meta.env), o a mano y sin recompilar, que es lo que sobrevive a un
// recargue: localStorage.setItem('naowee.acreditaciones.use-mock', 'true').
export function useAccreditationMock(): boolean {
  if (globalThis.__NAOWEE_ACCREDITATION_MOCK__ === true) {
    return true;
  }

  try {
    return localStorage.getItem(USE_MOCK_KEY) === 'true';
  } catch {
    return false;
  }
}
