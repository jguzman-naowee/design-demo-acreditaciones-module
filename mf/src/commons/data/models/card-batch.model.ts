// El carnet en PDF: lo genera el backend de forma asíncrona y nosotros pedimos,
// esperamos y descargamos. Medido en vivo contra dev el 2026-08-12.
//
//   1. POST /accreditation/accreditations/{code}/card   → 202 + batch_code
//   2. GET  /accreditation/card-batches/{batch_code}    → hasta un estado terminal
//   3. GET  /files/{upload_id}/download-url             → URL prefirmada del PDF
//
// Tres cosas que no son obvias y que costó medir:
//
// - El POST NO devuelve `status` ni `chunks`: solo el `batch_code` y el conteo. No
//   hay forma de saber si el PDF está listo sin pasar por el GET.
// - La generación sí es de fondo: encolado un lote y esperados 40 s SIN consultar
//   ninguna vez, la primera consulta ya lo dio COMPLETED. O sea que el polling solo
//   observa —y por eso perderlo de vista no cancela nada—, al contrario de lo que
//   teníamos anotado de antes.
// - El chunk trae `upload_id` desde que está ENQUEUED, o sea ANTES de que el archivo
//   exista. Descargar por tener upload_id da NoSuchKey; hay que esperar a que el
//   chunk esté COMPLETED.
//
// El paquete del 2026-08-18 añadió tres datos que cambian lo que se puede mostrar:
//
// - `batch_number`: el consecutivo del lote DENTRO DEL EVENTO (Lote #1, #2, #3...), en
//   el 202, en el listado y en el detalle. Los lotes anteriores quedaron numerados
//   hacia atrás, y el carnet individual comparte la misma serie del evento.
// - `accreditations`: quiénes van en el lote. Solo viaja poblada cuando el lote está en
//   un estado FINAL; mientras se genera llega vacía, así que una pantalla que la muestre
//   tiene que seguir consultando en lugar de decir que el lote está vacío.
// - `skipped`: los códigos que se pidieron y no entraron, con su motivo redactado por el
//   backend. Llega en el 202 y PERSISTE en el detalle, así que no se pierde si se cae la
//   respuesta del POST.

// Un carnet que se pidió y no salió. `reason` llega MIXTO desde SUV2-2531 —medido en el test
// de backend—: los de la SELECCIÓN vienen redactados («No existe la acreditación en el
// evento») y los del DESPACHO como código (`PHOTO_MISSING`). De ahí la caída al texto crudo.
export interface CardBatchSkippedResponse {
  code: string;
  reason: string;
  // Desde SUV2-2531. Los lotes anteriores no lo traen, y sin él solo queda el uuid.
  full_name?: string | null;
}

// POST /accreditation/accreditations/{code}/card → 202.
export interface AccreditationCardResponse {
  batch_code: string;
  // El consecutivo del lote en el evento. Opcional porque los lotes creados antes del
  // 2026-08-18 y el camino de demo pueden no traerlo.
  batch_number?: number | null;
  total_cards: number;
  total_chunks: number;
  skipped?: CardBatchSkippedResponse[] | null;
  // Quién no tiene foto aprobada. OJO, significa DOS cosas según la época del lote: antes de
  // SUV2-2531 esos carnets SALÍAN con marcador y desde entonces no se emiten. Backend no
  // migró el campo ni marca cuál es, así que en pantalla se dice el hecho, no la consecuencia.
  cards_without_photo?: string[] | null;
}

// Un chunk es un PDF: el lote se parte para no generar un archivo gigante. Para un
// carnet individual siempre es uno.
export interface CardBatchChunkResponse {
  chunk_index: number;
  card_count: number;
  // ENQUEUED mientras no se ha generado, COMPLETED cuando el PDF ya está en el
  // bucket. Valores nuevos se toleran en lugar de romper el mapeo.
  status: string;
  upload_id?: string | null;
  error_detail?: string | null;
}

// Un integrante del lote. El contrato da el código y el nombre, y nada más.
//
// TODO(api): falta `document_number`. QA pidió el 2026-09-16 que el detalle del lote
// identifique a la gente por su documento y no por el uuid de la acreditación, que es lo que
// se pintaba y no le dice nada a quien reparte carnets. Hoy el documento no se puede sacar de
// ningún otro sitio a un coste razonable: `card-batches/members` sí lo trae pero NO filtra por
// lote y pagina de diez en diez —un lote de 200 serían veinte y pico peticiones, y encima
// colaría a los inactivos, que este detalle no lista—, y `/accreditations/{code}` sería una
// petición por integrante.
//
// Se declara opcional desde ya y se mapea igual, así que la columna se enciende sola el día
// que el backend lo mande, sin tocar la pantalla. Es el mismo camino que siguieron
// `department_name` y `municipality_name` acá abajo, que llegaron el 2026-09-16.
export interface CardBatchAccreditationResponse {
  accreditation_code: string;
  full_name: string;
  document_number?: string | null;
}

// GET /accreditation/card-batches/{batch_code}.
export interface CardBatchResponse extends AccreditationCardResponse {
  event_code?: string | null;
  // INDIVIDUAL para el carnet de una acreditación; el lote del evento usa otro.
  kind?: string | null;
  status: string;
  // El motivo del fallo A NIVEL DE LOTE, que hasta SUV2-2278 no se usaba: los fallos de
  // generación salían en el chunk. Ahora backend garantiza que un lote que no responde pasa
  // a FAILED a los quince minutos y pone AQUÍ su motivo en español —«La generación de los
  // carnets no respondió en el tiempo esperado. Vuelve a emitir el lote.»—, y ese lote puede
  // no tener ningún chunk con error, así que leyendo solo el chunk se perdía.
  error_detail?: string | null;
  chunks?: CardBatchChunkResponse[] | null;
  // Vacía mientras el lote no esté en un estado final: ver la nota de la cabecera.
  accreditations?: CardBatchAccreditationResponse[] | null;
  created_at?: string | null;
}

// Los estados en los que el lote ya no se mueve: dejar de consultar en cualquier
// otro sería quedarse esperando un PDF que nadie va a generar.
export const CARD_BATCH_TERMINAL_STATUSES = [
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  // Un lote inactivado tampoco se mueve ya. Faltaba, y el detalle lo daba por generándose.
  'DELETED'
];

// GET /accreditation/card-batches?event_code=&page=&limit= — el listado de lotes,
// más recientes primero, con {data, meta}.
//
// Ojo con dos diferencias contra el detalle, medidas contra dev:
// - `cards_without_photo` acá es un CONTEO; en el detalle por code es la lista de
//   uuids. Mismo nombre, otro tipo.
// - El `status` puede venir REZAGADO: el listado no dispara la reconciliación con
//   file-storage, que corre en el GET por code (confirmado por backend). Por eso al
//   descargar se vuelve a pedir el lote y se repinta la fila con lo fresco.
export interface CardBatchListItemResponse {
  batch_code: string;
  batch_number?: number | null;
  event_code: string;
  kind: string;
  status: string;
  total_cards: number;
  total_chunks: number;
  cards_without_photo: number;
  // El user_code de quien lo pidió; no viene el nombre.
  requested_by?: string | null;
  created_at?: string | null;
}

// GET /accreditation/card-batches/members?event_code=&page=&limit=&search= — el listado
// APLANADO: una fila por acreditado que tiene carnet, con el lote al que pertenece.
//
// Es el ángulo opuesto al del detalle del lote (allá se pregunta «quién va en este lote»;
// acá, «en qué lote está esta persona»), y es lo que la pantalla del diseño necesita: la
// tabla de acreditados con su número de lote.
//
// Dos cosas que no da y que la tabla del diseño sí pide: la fecha de emisión y el
// vencimiento. Pedidas a backend; no se inventan acá.
//
// TODO(api): confirmar contra dev si es UNA fila por acreditado o una por par
// persona+lote. Backend lo describió como «tus 11 personas», o sea una por persona con su
// lote más reciente, y así lo asume la pantalla; si en realidad devolviera una fila por
// cada carnet generado, alguien con dos generaciones saldría dos veces.
export interface CardBatchMemberResponse {
  accreditation_code: string;
  full_name: string;
  document_number?: string | null;
  role_code?: string | null;
  role_name?: string | null;
  status: string;
  delivered?: boolean | null;
  // El territorio de la DELEGACIÓN, con los mismos nombres que en `ready-for-accreditation`.
  // Llegan desde el 2026-09-16 y son lo que permite que las dos pantallas enseñen la misma
  // tabla: hasta entonces esta columna no se podía pintar porque el dato no existía acá.
  department_name?: string | null;
  municipality_name?: string | null;
  // true si nombre, documento o sexo cambiaron tras imprimir el carnet vigente (SUV2-2317).
  // Opcional: en prod no llega hasta que backend lo despliegue.
  card_outdated?: boolean | null;
  // El lote de esa persona. Un carnet individual también numera, en la misma serie del
  // evento, y su `batch_kind` lo distingue.
  batch_code: string;
  batch_number?: number | null;
  batch_kind?: string | null;
}

// POST /accreditation/events/{eventCode}/cards. Medido: sin body → todas las del evento;
// `role_code` → solo las de ese tipo (422 NO_ACCREDITATIONS si ninguna); `accreditation_codes`
// vacío → 422 EMPTY_SELECTION. `include_without_photo` se fue: el backend lo ignora.
export interface EventCardsPayload {
  role_code?: string;
  accreditation_codes?: string[];
}
