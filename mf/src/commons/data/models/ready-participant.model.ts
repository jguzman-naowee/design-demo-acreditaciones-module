import type { CatalogStatus, DeliveryStatus } from '../../domain/types/status.type';

// Los participantes LISTOS para acreditar: los de la fase con toda su documentación
// obligatoria aprobada, según documentation-ms.
//
// GET /v1/documentation/processes/by-event/{eventCode}/phase/{phaseCode}
//     /participants/ready-for-accreditation?user_role=
//
// Ojo: vive fuera del prefijo de acreditación, y se pide por el par de UUIDS del
// evento y la fase —no por el `event_id` entero del módulo—.
//
// Medido contra dev el 2026-08-13 con el caso de prueba de backend: 4 listos y el que
// tiene un requisito RECHAZADO no aparece, que es justo lo que hace útil esta lista.
// Con qué identificador se acredita una fila.
//
// El personal de MISIÓN se inscribe por delegación y no tiene cuenta en la plataforma, así
// que su acreditación va con `mission_staff_code` y no con `user_code`. Es la diferencia que
// `user_role` no expresaba, y sin ella el front mandaría `user_code` para media lista.
export type IdentityType = 'PLATFORM_USER' | 'MISSION_STAFF';

// Ojo: MISSION_STAFF es la CATEGORÍA paraguas, no un rol. En una fila de misión, `user_role`
// trae el rol de verdad —JMI, FIS, MED…, de la tabla `mission_staff_role` de event-sport-orc,
// 29 en total— y ese mismo código es el que va como `platform_subrole` del tipo de acreditado
// y el que se puede mandar como `role_code` al acreditar. Confirmado por backend el
// 2026-09-09.

export interface ReadyParticipantResponse {
  // La identidad con la que se crea la persona y se acredita. Para el personal de misión
  // NO es un usuario de la plataforma —no lo tiene— sino su código del registro de misión;
  // cuál de los dos es, lo dice `identity_type`.
  user_code: string;
  user_role: string;
  // Opcional a propósito, porque las dos fuentes se contradicen: la prueba del gateway
  // (`TestGetParticipantsReadyForAccreditation_KeepsIdentityType`) exige que la fila de
  // plataforma NO lo traiga, y backend lo midió en staging el 2026-09-09 llegando como
  // PLATFORM_USER en los atletas. El respaldo cubre las dos: ausente = plataforma.
  identity_type?: IdentityType | null;
  // La FUNCIÓN del personal de apoyo —Docente/Entrenador, Auxiliar Discapacidad…—, que
  // `user_role` no distingue: ahí todos son SUPPORT_PERSONNEL, y un docente entrenador y un
  // docente asistente llegaban indistinguibles.
  //
  // Es una LISTA porque la función se asigna POR DEPORTE: el mismo apoyo puede ser entrenador
  // en uno y asistente en otro. Al acreditar hay un solo tipo por persona, así que hay que
  // elegir; ver `resolveAccreditedTypeCode`.
  //
  // Las dos listas van ALINEADAS POR POSICIÓN —`support_role_names[i]` es el nombre de
  // `support_role_codes[i]`—, y backend garantiza que nunca se corren: si el catálogo no
  // conoce un código, el nombre llega con el código tal cual en vez de saltarse la posición.
  support_role_codes?: string[] | null;
  support_role_names?: string[] | null;
  user_first_name?: string | null;
  user_second_name?: string | null;
  user_first_lastname?: string | null;
  user_second_lastname?: string | null;
  document_type?: string | null;
  document_type_name?: string | null;
  document_number?: string | null;
  birth_date?: string | null;
  // Llegan desde el despliegue del 2026-08-13 (enriquecidos contra user-auth). Ojo:
  // el enrich reenvía los permisos de la sesión, así que una sesión SIN `user:read`
  // los ve en null —y también el documento—. Por eso la pantalla avisa cuando faltan:
  // sin ellos la persona se crea sin delegación y no hay PATCH que la corrija.
  department_code?: string | null;
  department_name?: string | null;
  // Deporte y territorio de la INSCRIPCIÓN, que el gateway hidrata contra orc: es la
  // delegación real del participante, la misma contra la que resuelven los filtros
  // transversales. `municipality_name` lo resuelve el gateway con el catálogo; puede
  // faltar si el catálogo no respondió, y ahí sólo queda el código.
  sport_codes?: string[] | null;
  sport_names?: string[] | null;
  municipality_code?: string | null;
  municipality_name?: string | null;
  organization_name?: string | null;
  // La zona, RESUELTA por el backend (2026-09-18). No se deduce del departamento: el personal
  // del Comité Organizador Sede llega sin `department_code` y aun así tiene zona.
  region_code?: string | null;
  region_name?: string | null;
  requirements_total?: number | null;
  requirements_approved?: number | null;
  // Cuántos requisitos tiene CARGADOS, que no es lo mismo que aprobados: sirve para decirle a
  // quien reclama su acreditación si le falta subir algo o si está esperando revisión. Llegó con
  // el despliegue del 2026-09-01; medido en dev.
  requirements_loaded?: number | null;
  // APPROVED también cuando el participante no tiene proceso documental que lo cubra —y ahí
  // `requirements_total` viene en 0—. Es el arreglo de «el personal de apoyo no aparece»:
  // medido en dev, esas filas ya salen en la lista.
  overall_status?: string | null;
  // ── Si esta persona YA está acreditada ────────────────────────────────────────────────
  //
  // Los tres llegan juntos o no llega ninguno. Desplegados en staging el 2026-09-15 y medidos
  // ahí mismo: son los que permiten que esta lista sea la ÚNICA puerta de entrada en vez de
  // dos pantallas que se solapan.
  //
  // OJO CON CÓMO LLEGAN: en la fila NO acreditada las tres claves vienen **ausentes**, no en
  // `null` —comprobado con `Object.keys()` sobre la respuesta real—, así que un
  // `=== null` no detecta nada. Se leen con `??`.
  //
  // El backend garantiza UNA fila por identidad aunque la persona se haya reacreditado: si
  // tiene una ACTIVE manda esa, y si solo tiene INACTIVE manda la más reciente. Medido: el
  // documento 1007099002 (1 ACTIVE + 1 INACTIVE) vuelve una sola vez, con la ACTIVE.
  //
  // El cruce con el personal de MISIÓN va por DOCUMENTO y no por `mission_staff_code`, porque
  // acreditaciones no lo guarda (backend lo verificó en el modelo y en las migraciones).
  accreditation_code?: string | null;
  // Los mismos dos ejes que el listado de `/accreditations`: el estado por un lado y la
  // entrega por otro. Una entregada sigue estando ACTIVE.
  accreditation_status?: CatalogStatus | null;
  delivery_status?: DeliveryStatus | null;
}

// Qué lista se pide. READY es el default del backend; con un valor distinto de estos dos
// responde 400 —«readiness must be one of: READY, PENDING»—, medido en dev.
export type ReadinessFilter = 'READY' | 'PENDING';

// Los filtros transversales de inscripción, que el gateway resuelve contra orc.
//
// Van como CSV y no como parámetro repetido: el `QueryParams` del SDK es
// `Record<string, string | number | boolean>` y no admite arreglos. El backend acepta las dos
// formas.
//
// El gateway resuelve estos filtros ANTES de paginar y `total` ya viene recortado. Antes los
// aplicaba sobre la página ya traída —igual que `exclude_accredited`— y una página podía venir
// vacía con el total intacto: con `department_codes=05` sobre un evento de 72 listos volvían 0
// filas y `total` en 72. El gateway conserva ese camino viejo como respaldo mientras
// documentation-ms no tenga el endpoint nuevo, así que la pantalla sigue avisando cuando la
// página viene corta.
export interface ReadyTransversalFilters {
  category_codes?: string;
  department_codes?: string;
  discipline_codes?: string;
  // El municipio de la DELEGACIÓN, igual que el departamento; no el del perfil.
  municipality_codes?: string;
  // La ZONA. La región no existe como columna: el backend la traduce a los departamentos que
  // la componen —las ocho de `/locations/regions`—. Medido en staging: `region_codes=1` da los
  // mismos 14 que `department_codes=76`, y `region_codes=1,6` los 29 de los dos juntos.
  //
  // TRAMPA: pedir zona Y un departamento suelto es una UNIÓN, no una intersección.
  // `region_codes=6&department_codes=76` devolvió 29 filas, no 0. Por eso la pantalla encadena
  // los dos desplegables en vez de ofrecerlos sueltos.
  region_codes?: string;
  // Desde el despliegue del 2026-09-15 es el sexo de la PERSONA, no el de la prueba inscrita:
  // pedir mujeres devolvía antes a quienes compiten en pruebas femeninas. Medido: `sex_codes=M`
  // devuelve exactamente las 2 filas cuyo `sex_code` es M.
  sex_codes?: string;
  sport_codes?: string;
}

// El sobre trae el par evento+fase, la lista y su paginación. Ojo: NO es el
// `{data, meta}` del resto del gateway —los totales van sueltos en la raíz y la clave
// del tamaño es `size`, no `limit`— así que no sirve el PaginationRepository del SDK.
//
// `participants` viaja siempre, vacío incluido.
export interface ReadyParticipantsResponse {
  event_code: string;
  phase_code?: string | null;
  phase_name?: string | null;
  participants?: ReadyParticipantResponse[] | null;
  total?: number | null;
  page?: number | null;
  size?: number | null;
  counts?: Partial<Record<ReadinessFilter, number | null>> | null;
}

// Un valor disponible para filtrar, con cuántos lo tienen. `name` puede faltar si el
// catálogo no respondió: el código sigue sirviendo para filtrar.
export interface ParticipantFacetResponse {
  code?: string | null;
  name?: string | null;
  total?: number | null;
}

// Las tres facetas del evento en una sola respuesta.
//
// Ojo con el alcance: salen de los INSCRITOS del evento, no de quiénes están listos para
// acreditar —eso solo lo sabe documentation-ms y calcularlo es justo el costo que este
// endpoint evita—. O sea que un desplegable puede ofrecer un valor que en la pestaña activa
// no devuelva filas; es preferible a omitir opciones.
export interface ParticipantFacetsResponse {
  event_code?: string | null;
  sports?: ParticipantFacetResponse[] | null;
  departments?: ParticipantFacetResponse[] | null;
  municipalities?: ParticipantFacetResponse[] | null;
}
