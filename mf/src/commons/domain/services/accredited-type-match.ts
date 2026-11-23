import type { AccreditedType } from '../entities/accredited-type';
import type { ReadyParticipant } from '../entities/ready-participant';

/**
 * Qué tipo de acreditado del evento le corresponde a un participante.
 *
 * Existe porque hasta ahora mandábamos **el rol equivocado**: el ítem del masivo iba con
 * `candidate.roleCode`, que es el `user_role` de la PLATAFORMA (ATHLETE, SUPPORT_PERSONNEL,
 * DELEGADO), no el `role_code` del tipo del evento, que es texto libre. Que funcionara era
 * una coincidencia de nombres —el tipo «Deportista» suele tener `role_code: ATHLETE`— y es la
 * razón real por la que hubo que añadir un tipo genérico «Personal de apoyo» a mano: para que
 * los códigos casaran. Dos de los seis motivos de `skipped` son justo eso: «no existe el tipo
 * de acreditado en el evento» y «el tipo está inactivo».
 *
 * El orden va de lo más específico a lo más general, y cada escalón resuelve un caso que el
 * siguiente no puede:
 *
 * 1. **Por función** (`platformSubrole`): un docente entrenador y un docente asistente llegan
 *    los dos como SUPPORT_PERSONNEL y solo `supportRoleCodes` los distingue. Es lo único que
 *    permite acreditarlos con tipos distintos.
 * 2. **Por categoría** (`platformRole` sin función): el tipo por defecto de los deportistas,
 *    del apoyo o de la misión.
 * 3. **Por código**, el camino viejo: para los eventos cuyos tipos nunca recibieron
 *    `platform_role` —medidos el 2026-09-09: 7 de los 15 que hay— y que hoy funcionan
 *    justamente por esa coincidencia. Quitarlo los dejaría a todos en `skipped`.
 *
 * Solo mira los tipos ACTIVOS: uno inactivo también cae en `skipped`, así que elegirlo sería
 * cambiar un fallo por otro.
 *
 * Devuelve `undefined` cuando el evento no tiene ningún tipo que le sirva. Quien llama decide
 * qué hacer con eso; lo que NO debe hacer es inventarse uno.
 */
export function resolveAccreditedTypeCode(
  participant: ReadyParticipant,
  types: AccreditedType[]
): string | undefined {
  const activos = types.filter((type) => type.isActive);

  // Las funciones de esta fila, según de quién sea:
  //
  // - **personal de apoyo**: vienen en `supportRoleCodes`, y son VARIAS porque la función se
  //   asigna por deporte —el mismo apoyo puede ser entrenador en uno y asistente en otro—;
  // - **personal de misión**: su `roleCode` YA ES la función (JMI, FIS, MED…). MISSION_STAFF
  //   es la CATEGORÍA paraguas y no un rol: no existe un `role_code = MISSION_STAFF` en
  //   ningún catálogo. Confirmado por backend el 2026-09-09, con la tabla `mission_staff_role`
  //   de event-sport-orc detrás (29 roles).
  const funciones = participant.isMissionStaff
    ? [participant.roleCode]
    : participant.supportRoleCodes;

  // 1. Por función. Se recorren en el orden en que llegan y gana la primera que el evento
  //    tenga configurada: el contrato no dice cuál debería ganar cuando hay varias —está
  //    preguntado a backend— y elegir la primera al menos es estable y explicable, en vez de
  //    depender del orden de los tipos del evento.
  for (const funcion of funciones) {
    const porFuncion = activos.find((type) => type.platformSubrole === funcion);

    if (porFuncion) {
      return porFuncion.roleCode;
    }
  }

  // 2. Por categoría, y solo los tipos SIN función: el tipo por defecto de la categoría. Uno
  //    con función es el de UNA función concreta, y dárselo a quien no la tiene lo acreditaría
  //    mal —que es justo lo que este cambio viene a evitar—.
  //
  //    Para el apoyo y los deportistas la categoría es su `roleCode` (SUPPORT_PERSONNEL,
  //    ATHLETE); para la misión hay que ponerla a mano, porque su `roleCode` es la función.
  const categoria = participant.isMissionStaff
    ? 'MISSION_STAFF'
    : participant.roleCode;

  const porCategoria = activos.find(
    (type) => !type.platformSubrole && type.platformRole === categoria
  );

  if (porCategoria) {
    return porCategoria.roleCode;
  }

  // 3. El camino viejo: el código del rol de plataforma usado como `role_code`.
  return activos.find((type) => type.roleCode === participant.roleCode)
    ?.roleCode;
}

/**
 * Los tipos del evento con los que SE PUEDE acreditar a un participante de apoyo, uno por
 * cada función suya que el evento tenga configurada y activa.
 *
 * El apoyo trae VARIAS funciones porque se asigna por deporte —el mismo docente puede ser
 * entrenador en fútbol sala y asistente en voleibol—. `resolveAccreditedTypeCode` elige la
 * primera y ya; con dos o más opciones esa elección es de quien acredita, no de la pantalla:
 * en prod (28-sep-2026) salieron cuatro docentes acreditados como asistentes siendo
 * entrenadores y hubo que inactivarlos y reemitirlos.
 *
 * Devuelve vacío o un solo tipo cuando no hay nada que elegir; el personal de misión y los
 * deportistas tienen una sola función, así que nunca llegan a dos.
 */
export function accreditedTypeOptions(
  participant: ReadyParticipant,
  types: AccreditedType[]
): AccreditedType[] {
  if (participant.isMissionStaff) {
    return [];
  }

  const activos = types.filter((type) => type.isActive);
  const opciones = new Map<string, AccreditedType>();

  for (const funcion of participant.supportRoleCodes) {
    const tipo = activos.find((type) => type.platformSubrole === funcion);

    if (tipo && !opciones.has(tipo.roleCode)) {
      opciones.set(tipo.roleCode, tipo);
    }
  }

  return [...opciones.values()];
}
