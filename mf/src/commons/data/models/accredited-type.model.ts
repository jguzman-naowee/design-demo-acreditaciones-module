// Contrato congelado del gateway: nuestro «tipo de acreditado» es el rol
// acreditado del backend (accredited_roles).
//
// GET/POST /v1/accreditation/roles · PUT /v1/accreditation/roles/{code}
// PATCH .../{code}/activate · PATCH .../{code}/deactivate

// AccreditationMsRolePermissionDetail: lo que devuelve el GET de roles. Ojo, el
// contrato tiene tres formas distintas de `permissions[]` según el contexto;
// esta es la de lectura del rol (sin used_count ni vigencias).
export interface AccreditedTypePermissionResponse {
  permission_id: number;
  permission_name: string;
  has_limit: boolean;
  max_uses_per_person?: number | null;
  /**
   * La POSICIÓN que el usuario le dio al permiso dentro de su tipo (SUV2-2330).
   *
   * Existe porque el carnet pinta los iconos en el orden en que llegan, y ese orden no
   * estaba definido: lo decidía Postgres, así que el mismo rol podía salir distinto entre
   * dos emisiones y no se sabía cuál se recortaba —el reverso solo muestra ocho—.
   *
   * La lista llega YA ORDENADA por él, así que acá no se ordena: medido contra staging el
   * 2026-09-15, los 6 tipos con permisos vienen ordenados y numerados 1..N. Si algún día
   * llega desordenado es un fallo de backend que hay que reportar, no tapar con un `sort`
   * que lo escondería.
   *
   * Opcional porque un rol guardado antes del despliegue puede no traerlo.
   */
  order?: number | null;
}

// El rol que la PLATAFORMA reconoce, aparte del `role_code` del evento. Añadido por backend el
// 2026-08-26 (accreditation-ms #43, lambdas #30, public-gateway #620).
//
// Existe para resolver el 404 al acreditar: `role_code` es texto libre por evento —lo derivamos
// del nombre con toRoleCode(), así que «Deportista» da DEPORTISTA— y si el evento tiene el tipo
// creado como ATHLETE, el POST de la acreditación no lo encontraba. Con esto, el backend busca
// primero por código y cae a `platform_role`.
//
// La FAMILIA del rol. No se cierra en una unión: las publica `role-catalog` y cerrarlas acá
// obliga a tocar el front cada vez que backend añade una, que es justo lo que se quitó.
//
// MISSION_STAFF llegó con SUV2-2228 (gateway fc3bf94): es el personal de misión, que se
// inscribe por delegación y no tiene cuenta en la plataforma.
//
// NO reemplaza al nombre visible: el carnet imprime `role_name`, y eso ya funcionaba.
export type PlatformRole = string;

// La FUNCIÓN dentro de la categoría: FISIOTERAPEUTA, JEFE_MISION, ENT… Con `platform_role`
// forman la pareja que ancla el tipo de acreditado al rol que traen orc y documentation-ms,
// para que el front pueda acreditar sin conocer el `role_code`, que es texto libre por evento.
//
// No se valida contra una lista —su catálogo vive en orc y es POR EVENTO—, solo `max=60`.
//
// Ojo: la unicidad pasa a ser de la PAREJA (rol, función), y de ahí sale que un evento pueda
// tener varios tipos SUPPORT_PERSONNEL con funciones distintas. Es lo que Javi anunció, pero
// esa regla vive en accreditation-ms y no se puede leer desde el gateway: si no estuviera
// desplegada, crear el segundo tipo de una misma categoría responde 409 en vez de crearse.
export type PlatformSubrole = string;

export interface AccreditedTypeResponse {
  // El uuid: es por donde van el PUT y los toggles. El id numérico se queda para
  // el store y para las asignaciones.
  code: string;
  id: number;
  role_name?: string | null;
  role_code: string;
  // Opcional porque los tipos creados ANTES de ese despliegue no lo traen: medido en staging el
  // 2026-08-26, sus dos tipos llegan sin la clave. Medido otra vez el 2026-09-09: de los 15
  // tipos que hay, 8 lo traen y 7 no.
  platform_role?: PlatformRole | null;
  // La función. Medido contra staging el 2026-09-09: NINGUNO de los 15 tipos existentes la
  // trae, así que todos son —a ojos del backend— el tipo por defecto de su categoría.
  platform_subrole?: PlatformSubrole | null;
  event_id: number;
  is_active: boolean;
  // Fecha límite de acceso del rol, ISO-8601 con zona. El backend la normaliza a
  // UTC: mandando -05:00 devuelve el mismo instante en Z.
  access_deadline?: string | null;
  permissions: AccreditedTypePermissionResponse[];
  created_at?: string | null;
}

// AccreditationMsRolePermissionAssignment: la forma de escritura. Tres campos, y el
// binding del gateway ignora cualquier otro.
export interface AccreditedTypePermissionPayload {
  permission_id: number;
  max_uses_per_person?: number | null;
  /**
   * OBLIGATORIO desde SUV2-2330, y es un cambio que rompe: sin él el backend responde 400.
   *
   * Entero >= 1 y único dentro de la lista. El contrato permite huecos —1, 2, 5, 9 es
   * válido— porque el número es la posición que elige el usuario y el backend no recompacta;
   * nosotros mandamos siempre la lista completa, así que numeramos 1..N consecutivo y, de
   * paso, cualquier hueco que viniera del backend se cierra al guardar.
   *
   * 🔴 Ojo con el CERO: `normalizeJson` de @rolster/commons descarta las claves sin valor
   * antes de enviar —está documentado más abajo para `max_uses_per_person`—, así que un
   * `order: 0` viajaría AUSENTE y daría el 400 justo en el primer permiso. Por eso la
   * numeración empieza en 1, y no es un detalle estético.
   */
  order: number;
}

export interface AccreditedTypePayload {
  role_name: string;
  // Único por evento; lo derivamos del nombre con toRoleCode().
  role_code: string;
  // La pantalla lo exige al crear, aunque el contrato lo declare opcional: un tipo sin él deja
  // volver el 404 al acreditar. Medido el 2026-08-26: mientras el gateway de staging no tenga
  // el PR #620, este campo se IGNORA —el POST responde 201 y no lo devuelve—, así que mandarlo
  // desde ya no rompe nada.
  //
  // Hoy la pantalla no lo pregunta: lo DERIVA de la función elegida (ver AccreditedTypeModal).
  platform_role?: PlatformRole;
  platform_subrole?: PlatformSubrole;
  event_id: number;
  access_deadline?: string;
  permissions: AccreditedTypePermissionPayload[];
}

// AccreditationMsUpdateRoleRequest: la misma forma del POST sin `event_id` —un rol
// no cambia de evento—. Ojo con dos cosas:
//
// - `permissions` REEMPLAZA la asignación vigente, no la suma: hay que mandar la
//   lista completa que debe quedar.
// - `role_name` y `role_code` son obligatorios, así que se reenvían tal cual. La
//   pantalla no deja renombrar: el role_code es la identidad con la que viajan las
//   acreditaciones ya emitidas, y cambiarlo las dejaría apuntando a un rol que ya
//   no existe.
export interface AccreditedTypeUpdatePayload {
  role_name: string;
  role_code: string;
  // Es la vía para arreglar los tipos que se crearon sin él: en staging los dos que hay no lo
  // tienen, y sin esto habría que borrarlos para volverlos a crear.
  platform_role?: PlatformRole;
  platform_subrole?: PlatformSubrole;
  access_deadline?: string;
  permissions: AccreditedTypePermissionPayload[];
}

// GET /v1/accreditation/roles/functions?event_id= — las funciones de MISIÓN que el evento
// puede ofrecer, para el campo «Función» de la pantalla de tipos.
//
// Solo las de misión: las del personal de apoyo son catálogo y salen por
// `/catalogs/support-personnel-role`, no por acá. Lo dice el contrato del gateway y lo
// confirma la medición del 2026-09-09: el evento 20 devuelve AJM/FIS/JMI…, todas con
// `platform_role: MISSION_STAFF`.
//
// Ojo: casi todos los eventos devuelven `functions: []` —solo trae algo el evento que tenga
// personal de misión inscrito en orc—, así que el campo tiene que saber quedarse vacío sin
// parecer roto.
export interface AccreditedTypeFunctionResponse {
  platform_role: PlatformRole;
  code: string;
  // Puede faltar si orc no resolvió el nombre; queda el código, que sirve igual para guardar.
  name?: string | null;
  // Si el evento YA tiene un tipo con esta función. Sirve para no ofrecer duplicados que
  // después chocan contra la unicidad de la pareja.
  configured: boolean;
  // El `role_code` del tipo que la ocupa, cuando `configured` es true.
  role_code?: string | null;
}

export interface AccreditedTypeFunctionsResponse {
  event_id: number;
  functions: AccreditedTypeFunctionResponse[];
}
