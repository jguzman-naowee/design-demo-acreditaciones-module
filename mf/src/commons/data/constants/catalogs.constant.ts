// Los dos tipos que los diccionarios del gateway NO publican.
//
// Los catálogos reales son `/catalogs/event-role` y `/catalogs/support-personnel-role` (ver
// EventRoleCatalogRepository): 30 + 3 roles con su código, medidos contra staging el
// 2026-09-08. Reemplazaron a una lista de cinco nombres inventados en la época del mock, que
// llevaba un `TODO(api)` desde entonces y que se notó porque «Personal de apoyo» no salía
// —por nada más que porque nadie lo escribió—.
//
// Pero los dos cubren PERSONAL, no participantes: falta «Deportista», que se añade acá.
// «Delegado» estuvo y se retiró: el backend no lo conoce en ningún lado y daba 400 al
// guardar. Verificado en producción el 2026-09-23.
//
// El código va explícito y NO derivado del nombre, igual que los del catálogo: derivarlo
// daba «DEPORTISTA» donde la plataforma manda «ATHLETE», que es de donde salía el 404 al
// acreditar.
export const ACCREDITED_TYPE_EXTRAS: { code: string; name: string }[] = [
  { code: 'ATHLETE', name: 'Deportista' },
  // El GENÉRICO del personal de apoyo, que no es lo mismo que los tres oficios que sí
  // publica el diccionario (Auxiliar Discapacidad, Docente/Asistente, Docente/Entrenador):
  // esos son a qué se dedica la persona, y este es el rol con el que la PLATAFORMA la
  // reconoce.
  //
  // Sin él quedaba un hueco por el que no se podía pasar: `ready-for-accreditation` devuelve
  // a esa gente con `user_role: SUPPORT_PERSONNEL`, la emisión manda ese mismo código, y el
  // evento necesita un tipo que lo tenga… pero el desplegable no lo ofrecía. El resultado
  // era uno de los seis motivos de `skipped`: «No existe el tipo de acreditado 'X' en el
  // evento», sin forma de arreglarlo desde la pantalla.
  { code: 'SUPPORT_PERSONNEL', name: 'Personal de apoyo' },
  // La cuarta categoría, de SUV2-2228: se inscribe por delegación y no tiene cuenta en la
  // plataforma. Sin ella no había forma de llegar a sus funciones —Jefe de Misión,
  // Fisioterapeuta…— desde la pantalla.
  { code: 'MISSION_STAFF', name: 'Personal de misión' }
];

export const VALIDATION_LIMIT_OPTIONS: number[] = [10, 20, 30, 50, 100];

// El formulario guarda el código y el detalle muestra el nombre largo: los dos
// salen de aquí para que no se desincronicen.
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  CE: 'Cédula de extranjería',
  PA: 'Pasaporte'
};

// Los dos roles que la plataforma reconoce, en español. Es el mismo par que el tipo de
// acreditado guarda en `platform_role`, y el que `ready-for-accreditation` devuelve en
// `user_role`.
//
// Existe porque el código crudo —ATHLETE, SUPPORT_PERSONNEL— no le dice nada a quien usa la
// pantalla: es la identidad del rol de cara al servidor. Lo reportó QA.
export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  ATHLETE: 'Deportista',
  SUPPORT_PERSONNEL: 'Personal de apoyo'
};

// El catálogo es del backend, no una convención nuestra: H = Hombre, M = Mujer. Es el
// código que user-auth guarda y que /persons devuelve desde que el backend llena el sexo al
// crear la persona.
//
// Ojo con la trampa, que backend avisó expresamente: `M` es MUJER, no Male. Con el mapeo
// anterior —M → Masculino— una mujer salía en pantalla como hombre. Lo que llegue fuera del
// catálogo se muestra crudo: es más honesto que traducirlo mal.
export const SEX_LABELS: Record<string, string> = {
  H: 'Hombre',
  M: 'Mujer'
};

// TODO(api): el perfil no tiene endpoint todavía; esta información deportiva es
// la misma para todas las acreditaciones.
export const PROFILE_SPORT_INFO = {
  category: 'Juvenil',
  event: '100 metros planos',
  sport: 'Atletismo'
};
