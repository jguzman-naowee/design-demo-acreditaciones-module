// GET /v1/accreditation/accreditations — la lista real de acreditaciones de un
// evento. Verificado en vivo contra dev el 2026-08-12.
//
// Ojo: el checkout local de public-gateway está en `staging` y NO tiene estas rutas
// ni estos filtros; el gateway desplegado en dev sí. Para este módulo el repo local
// ya no es fuente de verdad — medir contra dev.
//
// Query params que acepta: event_id, status, role_code, search, page, limit.

import type { AccreditationPermissionResponse } from './accreditation.model';
import type { AccreditationCardResponse } from './card-batch.model';
import type { IdentityType } from './ready-participant.model';

export interface AccreditedRecordResponse {
  // El identificador es un uuid, no el `id` numérico de los catálogos.
  code: string;
  event_id: number;
  user_code?: string | null;
  document_number: string;
  // Aplanado: los nombres por separado solo están en GET /persons.
  full_name: string;
  // La delegación (departamento) de la persona. El contrato ya los declara en el
  // listado y en el detalle, pero llegan AUSENTES: las personas que existen en dev
  // se crearon antes del campo y el backfill está pendiente. Se mapean igual para
  // que la pantalla se encienda sola el día que haya dato.
  department_code?: string | null;
  department_name?: string | null;
  role_code: string;
  role_name?: string | null;
  // Hoy solo llega ACTIVE; SUSPENDED y REVOKED están diseñados sin implementar, así
  // que el mapeo tolera valores nuevos en lugar de romperse.
  status: string;
  permissions_total: number;
  uses_consumed: number;
  created_at: string;
  // La entrega es OTRO eje que el estado: `status` sigue en ACTIVE tras entregar.
  //
  // Y el listado y el detalle NO traen lo mismo. Medido en staging el 2026-09-08:
  //
  //   listado → `delivery_status` (PENDING | DELIVERED), y NO manda `delivered_at`
  //   detalle → `delivered_at` y `delivered_by_code`, y NO manda `delivery_status`
  //
  // Acá decía que el listado «ya trae delivered_at» y dejó de ser cierto en algún
  // despliegue: como la entidad derivaba la entrega de esa fecha, TODO el listado se
  // pintaba «Sin entregar» —incluidas las 8 de 24 que sí lo estaban— y «Revertir
  // entrega» quedaba deshabilitado para siempre. Por eso los tres son opcionales y la
  // entidad acepta cualquiera de los dos caminos.
  delivery_status?: string | null;
  delivered_at?: string | null;
  delivered_by_code?: string | null;
  /**
   * Cuándo se IMPRIMIÓ el carnet, que no es lo mismo que entregarlo.
   *
   * Acá había un TODO diciendo que faltaba y que por eso solo se podían pintar dos de las
   * cuatro situaciones del rediseño. Ya no: medido en staging el 2026-09-15 sobre el evento
   * 26, llega con valor —«2026-09-08T21:54:21.4495»— en la fila que se imprimió.
   *
   * Es un tercer eje, no un estado más: una acreditación puede estar impresa y todavía sin
   * entregar, que es justo el hueco que el mostrador necesita ver.
   */
  printed_at?: string | null;
  // Solo en el detalle (GET /accreditations/{code}).
  qr_public_token?: string | null;
  // Cuántas veces se ABRIÓ el QR público de esta acreditación. Backend lo añadió el
  // 2026-09-17.
  //
  // NO es lo mismo que las validaciones en puerta, y confundirlos es lo que costó un reporte
  // de QA: el carnet lleva DOS códigos QR y cada uno cuenta en su sitio.
  //
  //   anverso → `qr_validation_token` → POST /validate → queda en `validation-logs`
  //   reverso → `qr_public_token`     → la credencial pública → suma acá
  //
  // Escanear con la cámara del móvil abre el del reverso, así que incrementa ESTE contador y
  // no el otro. QA escaneó, miró el campo que pintaba las validaciones, lo vio en cero y lo
  // reportó como roto. El número era correcto; lo que faltaba era este dato.
  //
  // El endpoint público que lo incrementa (`/accreditation/public/by-token/{token}`) NO lo
  // devuelve, a propósito: no tiene sesión. Solo viaja acá, en el detalle.
  //
  // Solo está en el DETALLE: ni el listado de acreditaciones ni el de integrantes de lote lo
  // traen. Backend se ofreció a sumarlo al listado y no hace falta — en tabla no va, y pedir
  // el detalle fila por fila para pintar una columna sería el mismo error que ya se descartó
  // con el documento del lote.
  public_views_count?: number | null;
  updated_at?: string | null;
  // La CATEGORÍA del tipo de acreditado (ATHLETE, SUPPORT_PERSONNEL, MISSION_STAFF…). Decide
  // si se ofrece «Cambiar tipo de acreditado»: solo el personal de apoyo lo tiene.
  platform_role?: string | null;
}

// El ciclo de vida de la entrega, medido contra dev el 2026-08-13:
//
//   PATCH /accreditations/{code}/deliver          → 200, SIN body, no toca `status`
//   PATCH /accreditations/{code}/undo-delivery    → 200, body {reason?}, TERMINAL
//   PATCH /accreditations/{code}/deactivate       → 200, body {reason?}, TERMINAL
//   POST  /accreditations/bulk-deliver|deactivate → 200 {processed, skipped, ...}
//
// «Terminal» es literal: revertir la entrega inactiva la acreditación y no hay vuelta
// atrás —para re-acreditar se emite otra—, así que las dos acciones se confirman.
//
// Ojo con una asimetría del contrato: entregar de a uno NO acepta observación, pero el
// masivo sí acepta `reason`. El diseño pide texto obligatorio en las dos.
export interface AccreditationActionResponse {
  code: string;
  status: string;
  delivered_at?: string | null;
  delivered_by_code?: string | null;
}

export interface AccreditationBulkPayload {
  // Exactamente UNA fuente: los códigos, o el lote entero.
  codes?: string[];
  batch_code?: string;
  reason?: string;
}

export interface AccreditationSkipped {
  code: string;
  // En español y listo para mostrar: «El carnet ya fue entregado».
  reason: string;
}

export interface AccreditationBulkResponse {
  processed: AccreditationActionResponse[];
  skipped: AccreditationSkipped[];
  total_requested: number;
  total_processed: number;
}

// ── Emisión masiva: POST /accreditations/bulk ────────────────────────────────
//
// Reemplaza el bucle de un POST por persona. Lo que cambia respecto de lo que hacíamos:
//
// - **Solo viaja el `user_code`.** El backend resuelve la persona contra user-auth y la crea
//   si falta, así que el `ensurePerson` del front —una búsqueda y a veces una creación por
//   cabeza, o sea 2N peticiones— desaparece. Y nombre y documento salen del padrón, que es la
//   fuente de verdad: son los que se imprimen en el carnet, no pueden venir del cliente.
// - **Es atómica.** Se acabó el lote a medias cuando falla el número 7 de 20.
// - **Es idempotente**: reenviar la misma lista no duplica, quien ya esté acreditado sale por
//   `skipped`. Sirve para el doble clic.
//
// Contrato leído de `internal/contracts/accreditationMs.go` en `origin/staging` del gateway
// el 2026-09-08. Ojo con dos cosas que el mensaje de Javi no decía: acepta `valid_from` y
// `valid_to` —los que el modal ya manda—, y los dos arrays van SIN `omitempty`, así que un
// lote donde no se acreditó a nadie manda `processed: []` en vez de perder la clave.
// EXACTAMENTE UNA identidad por ítem, igual que en el individual: `user_code` para quien
// tiene cuenta en la plataforma y `mission_staff_code` para el personal de misión, que no la
// tiene.
//
// Llegó con accreditation-ms#67 y public-gateway#722 (2026-09-09). Antes el ítem era
// `user_code` obligatorio y uuid, y como el código de misión también es uuid, mandarlo ahí
// PASABA la validación y moría en `skipped` como «usuario no encontrado», en silencio.
//
// Ojo con el modo de fallo: mandar las dos —o ninguna— NO es un descarte, es un **400 que
// rechaza el lote entero** diciendo qué fila está mal. Es a propósito: un lote mal armado es
// un error de programación, no un éxito parcial.
export interface AccreditationBulkCreateItem {
  user_code?: string;
  mission_staff_code?: string;
  // El rol va POR PERSONA: en la lista de acreditables conviven deportistas y personal de
  // apoyo, y un rol común para todo el lote acreditaría mal a alguien.
  role_code: string;
}

export interface AccreditationBulkCreatePayload {
  event_id: number;
  items: AccreditationBulkCreateItem[];
  valid_from?: string;
  valid_to?: string;
}

export interface AccreditationBulkProcessed {
  code: string;
  // La identidad CON LA QUE SE MANDÓ el ítem, sea de plataforma o de misión; `identity_type`
  // dice cuál de las dos es. Sirve para reconciliar la fila sin adivinar.
  user_code: string;
  identity_type?: IdentityType;
  // Lo trae el backend, del padrón. Por eso `bulkCreate` no necesita la persona que la
  // pantalla haya buscado, a diferencia de `create`.
  full_name: string;
  role_code: string;
}

// Se identifica por `user_code` y NO por código de acreditación —justamente no se creó
// ninguna—, así que no se puede reutilizar `AccreditationSkipped`, que lleva `code`.
export interface AccreditationBulkSkipped {
  user_code: string;
  identity_type?: IdentityType;
  // En español y listo para mostrar. Los seis de siempre —ya tiene una acreditación activa ·
  // no se encontró el usuario · el usuario no tiene documento registrado · no existe el tipo
  // de acreditado en el evento · el tipo está inactivo · viene repetido en la solicitud— más
  // los dos propios del personal de misión: «No se encontró personal de misión con ese código
  // en el evento y la fase» y «El personal de misión no tiene número de documento registrado
  // en el evento».
  reason: string;
}

export interface AccreditationBulkCreateResponse {
  processed: AccreditationBulkProcessed[];
  skipped: AccreditationBulkSkipped[];
  total_requested: number;
  total_processed: number;
}

// ── Acreditar y encolar el carnet de una vez: POST /accreditations/emit-with-card ─────
//
// Las dos mitades viajan separadas porque no son simétricas: acreditar termina en la misma
// petición y el carnet se encola. Por eso responde 202.
//
// `card_batch` es un PUNTERO, y con `omitempty`: cuando no se generó ninguno la clave llega
// AUSENTE, no en `null` —la misma trampa de `accreditation_code` en acreditables—. Se lee
// con `??`.
//
// LA REGLA QUE NO HAY QUE EQUIVOCAR: que no haya lote **no invalida las acreditaciones**. Son
// dos casos distintos y en los dos el HTTP es 202:
//
//   nadie quedó acreditado    → `total_processed: 0`, sin lote, con motivo
//   nadie tiene foto aprobada → `processed` LLENO, sin lote, con motivo
//
// Para saber a quién se acreditó se mira SIEMPRE `accreditation.total_processed`, y
// `card_batch_skipped_reason` solo explica por qué todavía no hay PDF. Tratar la ausencia del
// lote como error le diría al usuario que no se acreditó a nadie justo cuando sí se acreditó, y
// backend eligió el 202 a propósito para que no se pudiera confundir.
export interface AccreditationEmitWithCardResponse {
  accreditation: AccreditationBulkCreateResponse;
  card_batch?: AccreditationCardResponse | null;
  card_batch_skipped_reason?: string | null;
}

// ── Cambiar el tipo de acreditado: POST /accreditations/{code}/change-role ─────────────
//
// El tipo no se edita en sitio: la acreditación vieja queda INACTIVE (su QR deja de validar) y
// sale una NUEVA, con otro código, para la misma persona. Es atómico: si la nueva no se puede
// emitir, la vieja sigue activa y el backend responde 4xx con el motivo.
//
// Responde 202 con la misma regla del lote que `emit-with-card`: `card_batch` llega AUSENTE
// cuando no se generó el carnet (por ejemplo, sin foto aprobada), y eso NO es un fallo.
export interface AccreditationChangeRolePayload {
  role_code: string;
  reason?: string;
}

export interface AccreditationChangeRoleResponse {
  previous_code: string;
  accreditation: AccreditationBulkProcessed;
  card_batch?: AccreditationCardResponse | null;
  card_batch_skipped_reason?: string | null;
}

// ── El reporte de acreditados: POST /reports → polling → upload_id ──────────
//
// Reemplaza al CSV que se armaba en el navegador, que pedía páginas de 100 con tope de 20 y
// por tanto CORTABA a las 2.000 filas sin decirlo. El evento de producción tiene ~116 000
// acreditados: el archivo salía con el 2% y quien lo abría creía que ese era el total.
//
// Ahora es un .xlsx de verdad —título con evento y etapa, cabecera con filtro y panel
// congelado— y se lleva lo FILTRADO, no la página.
export interface AccreditationReportPayload {
  event_id: number;
  search?: string;
  status?: string;
}

// El 202: el archivo todavía no existe, hay que preguntar por el estado con este código.
export interface AccreditationReportCreatedResponse {
  report_code: string;
  status: string;
}

// PENDING → PROCESSING → COMPLETED | FAILED.
//
// Los cuatro últimos se declaran `| null` y NO opcionales a propósito: el contrato promete
// que la clave viaja SIEMPRE y que `null` significa «todavía no», nunca «el campo se fue».
// El propio contrato del gateway lo comenta citando nuestro incidente con `delivered_at`,
// que fue exactamente al revés —un campo que desapareció y lo leímos como vacío— y dejó el
// listado entero diciendo «Sin entregar».
export interface AccreditationReportStatusResponse {
  report_code: string;
  event_id: number;
  event_code: string;
  status: string;
  total_rows: number | null;
  upload_id: string | null;
  file_name: string | null;
  // En español y listo para mostrar cuando el estado es FAILED.
  error_detail: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// GET /accreditations/{code}/history — la auditoría, sin `meta`.
export interface AccreditationAuditResponse {
  // CREATED | DELIVERED | DELIVERY_REVERTED | DEACTIVATED | VALIDATED
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  // Es un user_code: el nombre de quien lo hizo no viene en el contrato.
  changed_by_code: string;
  // El NOMBRE de quien hizo el movimiento. Existe desde el despliegue del 31 de agosto y solo
  // viene en los movimientos posteriores: el historial no se reescribe, así que los anteriores
  // llegan sin la clave —el gateway la omite— y esos se quedan sin autor para siempre.
  changed_by_name?: string | null;
  changed_at: string;
  comments?: string | null;
}

export interface AccreditationHistoryResponse {
  data: AccreditationAuditResponse[];
}

/**
 * La auditoría del EVENTO entero. Mismo movimiento que el historial de una acreditación, más
 * a quién se le hizo: el transversal no puede darlo por sabido.
 *
 * Los tres campos son opcionales porque el historial por acreditación —que comparte tipo— no
 * los manda: allá la persona es el dueño de la URL.
 */
export interface AccreditationEventAuditResponse
  extends AccreditationAuditResponse {
  accreditation_code?: string;
  full_name?: string;
  document_number?: string;
}

// Los dos códigos que exige el endpoint transversal. Van juntos en un tipo para que no se
// pueda llamar con uno solo, que es justo el 400 que devuelve el backend.
export interface AccreditationAuditParams {
  event_code: string;
  phase_code: string;
  // Solo las operaciones de ese momento de la fase; sin él, todos sus momentos.
  moment_code?: string;
}

// El detalle: el listado más el token, la modificación y los permisos con sus usos.
//
// Medido contra dev: NO trae `permissions_total` ni `uses_consumed` —esos son
// agregados del listado— y sus permisos NO traen `file_icon_upload_id`, así que el
// icono hay que cruzarlo con el catálogo de permisos.
export interface AccreditedRecordDetailResponse
  extends Omit<AccreditedRecordResponse, 'permissions_total' | 'uses_consumed'> {
  permissions_total?: number;
  uses_consumed?: number;
  permissions: AccreditationPermissionResponse[];
  // Añadidos el 2026-08-13. `sports_info` se resuelve EN VIVO contra orc y solo
  // existe para deportistas a título individual: el apoyo y los deportes de
  // conjunto llegan en null SIN error. Si orc no responde, el motivo viene en
  // `sports_info_error`, en español y listo para mostrar.
  sports_info?: AccreditedRecordSportsInfoResponse | null;
  sports_info_error?: string | null;
  // Los dos son URL PREFIRMADAS de vida corta —diez minutos, medido— y se regeneran
  // en cada carga: se abren, no se guardan ni se cachean.
  //
  // Los dos llevaban meses en null y empezaron a traer dato el 2026-09-07. Siguen
  // siendo opcionales porque dependen de que exista la foto aprobada en el paquete
  // documental y de que alguien de la organización haya emitido el certificado; que
  // lleguen null es normal y NO es un error.
  photo_url?: string | null;
  certificate_url?: string | null;
  // ── El carnet vigente (SUV2-2278) ──────────────────────────────────────────
  // Con qué se pinta el botón del carnet sin tener que emitirlo para averiguarlo.
  //
  // Antes el detalle solo traía `batch_number`, un número con el que no se puede consultar
  // nada —el lote se consulta por `code`—, así que la ÚNICA puerta al PDF era volver a
  // emitir. Y emitir no es idempotente: cada intento crea un lote. En staging quedaron siete
  // lotes de la misma acreditación en cuatro minutos.
  //
  // Las tres claves viajan SIEMPRE, con null explícito —backend las puso sin `omitempty` a
  // propósito—, así que los tres casos se distinguen sin ambigüedad:
  //
  //     batch_code null                        → nunca se emitió
  //     batch_code + card_url                  → está listo, se abre
  //     batch_code y card_url null             → mirar batch_status
  //
  // Ojo: `batch_number` y `printed_at` sí llevan `omitempty` y desaparecen de la respuesta
  // cuando no hay lote, así que NO sirven para preguntar por presencia. Estos tres sí.
  batch_code?: string | null;
  // PENDING · PROCESSING · COMPLETED · COMPLETED_WITH_ERRORS · FAILED
  batch_status?: string | null;
  // El PDF ya generado, prefirmado: se abre directo, sin sesión ni cabeceras. Comprobado por
  // backend contra staging —200, application/pdf, 55 KB—.
  //
  // Vive DIEZ MINUTOS y se renueva en cada carga del detalle, igual que `photo_url`: se
  // abre, no se guarda en estado global ni se cachea entre pantallas. Y puede llegar null si
  // el presign falla del lado del backend, con el resto del detalle completo: hay que
  // aguantarlo sin romper.
  card_url?: string | null;
}

export interface AccreditedRecordSportsInfoResponse {
  sport_name?: string | null;
  category_name?: string | null;
  disciplines?: string[] | null;
}

// El sobre trae una tercera clave además de data y meta: `summary`, que solo llega
// cuando se manda `event_id` (medido: ausente sin él y ausente con `search` a secas).
export interface AccreditedRecordSummary {
  total: number;
  by_status: Record<string, number>;
}

// POST /v1/accreditation/accreditations — emitir la acreditación de una persona.
//
// Tres cosas medidas contra dev:
//
// - `user_code` es la identidad, NO el documento: una acreditación por persona+evento,
//   y repetir da 409 «La persona ya tiene una acreditación para el evento N».
// - `valid_from`/`valid_to` son LocalDateTime naive en hora del evento (Bogotá) y SIN
//   `Z`: con zona el parser responde 400.
// - La respuesta NO trae el documento ni el nombre —solo el usuario— así que la fila
//   del listado se compone con la persona que ya se buscó.
// Desde SUV2-2228 lleva EXACTAMENTE UNA identidad: `user_code` para quien tiene cuenta en la
// plataforma, `mission_staff_code` para el personal de misión, que se inscribe por delegación
// y no la tiene. Mandar las dos —o ninguna— responde 400 «Envíe user_code o
// mission_staff_code, exactamente uno de los dos»: la regla la valida el handler del gateway
// (`validateAccreditationIdentity`), no el validador de campos.
//
// Y NO lleva `identity_type`, aunque el mensaje de backend lo mencionara: leído en
// `AccreditationMsCreateAccreditationRequest` del gateway (fc3bf94), ese campo solo existe en
// el LISTADO de acreditables, para decidir cuál de los dos códigos mandar acá.
export interface AccreditationCreatePayload {
  event_id: number;
  role_code: string;
  user_code?: string;
  mission_staff_code?: string;
  valid_from?: string;
  valid_to?: string;
}

export interface AccreditationCreatedResponse {
  code: string;
  event_id: number;
  user_code?: string | null;
  role_code: string;
  role_name?: string | null;
  status: string;
  qr_public_token?: string | null;
  permissions?: AccreditationPermissionResponse[];
  created_at?: string | null;
}

// Los contadores del evento para la banda superior. Es una consulta agregada del backend
// (un COUNT, no el listado): la pantalla los pide una vez por evento, no por fila.
//
// `generated` cuenta las acreditaciones ACTIVE del evento; `delivered`, las que además
// tienen fecha de entrega. Sin `phase_code` el backend suma todas las fases del evento.
export interface AccreditationSummaryResponse {
  event_code?: string | null;
  phase_code?: string | null;
  generated?: number | null;
  delivered?: number | null;
}
