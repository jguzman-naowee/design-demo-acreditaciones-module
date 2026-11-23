// GET /accreditation/role-catalog?event_id= — la taxonomía: familias, sus funciones y qué tipo
// del evento ocupa cada una. Reemplaza lo que el front tenía quemado. Sin `event_id` responde
// la estática, que es la misma con los conteos a cero.

// El tipo de acreditado del evento que ocupa una función, o el genérico de la familia.
export interface RoleCatalogTypeResponse {
  code: string;
  // El del TIPO, texto libre por evento: no tiene por qué ser el de la función. Medido:
  // `NAOWEE_COORDINATOR` está configurado con `role_code: COORD_NAOWEE`.
  role_code: string;
  role_name: string;
  is_active: boolean;
}

export interface RoleCatalogFunctionResponse {
  // El valor válido de `platform_subrole`.
  code: string;
  name: string;
  // Con qué código llega la persona: `user_role` en ready-for-accreditation, `role_code` en
  // misión. Hoy trae uno solo, igual al `code`, pero es una lista y puede crecer con alias.
  event_role_codes: string[];
  // Lo que hay que mandar al acreditar. NO es el `role_code` del tipo configurado, que es
  // texto libre: usar aquel da el 404 de «no existe el tipo en el evento».
  accredit_role_code: string;
  // Cuántos hay inscritos con esa función. Solo viene en las familias que sacan sus funciones
  // de las inscripciones (`EVENT_ENROLLMENT`); en las demás es null.
  enrolled_count?: number | null;
  configured_type?: RoleCatalogTypeResponse | null;
}

// De dónde salen las funciones de la familia: NONE no tiene, CATALOG es un diccionario fijo,
// EVENT_ENROLLMENT depende de quién esté inscrito en el evento, FIXED es una lista cerrada.
export type RoleCatalogFunctionsSource =
  | 'NONE'
  | 'CATALOG'
  | 'EVENT_ENROLLMENT'
  | 'FIXED';

export interface RoleCatalogFamilyResponse {
  // El valor válido de `platform_role`.
  code: string;
  name: string;
  // Con qué identidad se acredita: `user_code` o `mission_staff_code`.
  identity_type: 'PLATFORM_USER' | 'MISSION_STAFF';
  allows_functions: boolean;
  functions_source: RoleCatalogFunctionsSource;
  // El tipo de la familia SIN función, el que atrapa a quien llega con una que el evento no
  // configuró. Hoy llega null en las cuatro: la pantalla no sabía crearlo.
  default_type?: RoleCatalogTypeResponse | null;
  functions: RoleCatalogFunctionResponse[];
}

export interface RoleCatalogResponse {
  event_id: number | null;
  families: RoleCatalogFamilyResponse[];
}
