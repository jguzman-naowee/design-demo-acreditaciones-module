// El contrato congelado del gateway.
//
// Cada forma que aparece acá se midió contra dev, y por eso el mock es EXIGENTE: no
// filtra lo que el gateway no filtra, ni añade lo que no manda. Un mock más generoso que
// el backend da por bueno lo que en producción no funciona.
//
// Es UNA sola interceptación con despacho explícito, y no una ruta por endpoint, por dos
// razones: los globs de Playwright ya nos costaron un rato de rutas que se tapaban entre
// ellas (se resuelven de la última registrada a la primera), y así todo lo que la
// aplicación pida y no esté acá cae en el 501 del final, que es un fallo visible en lugar
// de una llamada silenciosa a dev.
export const SESSION = {
  user_code: 'dev-user',
  email: 'dev@naowee.com',
  nature: 'INDIVIDUAL',
  individual_detail: { first_name: 'Dev', first_last_name: 'PW' },
  roles: ['ROOT'],
  permissions: ['all:all'],
  eventCode: '80fd12ca-337b-417b-83cd-fe39ad4a343a',
  // Largo a propósito, como los de staging: con «Juegos Nacionales 2026» —22 caracteres— el
  // nombre cabía en cualquier sitio y el recorte de la banda del evento no se podía
  // reproducir. QA lo vio con uno de estos.
  eventName: 'Juegos Intercolegiados 2026 - Mini migración STG',
  phaseCode: 'fase-elim-1',
  phaseName: 'Fase Eliminatoria',
  // Las fechas de las fases: es el dato que el catálogo NO manda y que la fila desplegada
  // muestra, leído del detalle del evento.
  phaseStartDate: '2026-08-29T05:00:00Z',
  secondPhaseStartDate: '2026-09-01T05:00:00Z',
  // El event_id del módulo identifica el par evento+fase, no el evento.
  eventId: 7,
  // La segunda fase acreditable, que solo aparece cuando la prueba la enciende: es el
  // caso en el que hay que PREGUNTAR en qué fase se trabaja, porque el event_id cambia.
  secondPhaseCode: 'fase-final-2',
  secondPhaseName: 'Fase Final',
  secondEventId: 8
};

// El lote que NO termina dentro de la verificación. Está sembrado abajo, y se nombra acá
// porque hay dos sitios que dependen de que sea ese: el detalle de la acreditación que
// enseña un carnet en curso, y el lote del que se derivan los casos que sí terminan.
const LOTE_EN_CURSO = 'lote0002-0000-4000-8000-000000000000';

const json = (route, status, body) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });

/**
 * El `order` de cada permiso, validado como lo valida el backend (SUV2-2330).
 *
 * Existe porque sin esto el arnés NO protege del cambio: los dos handlers de roles guardaban
 * el body sin mirarlo, así que si el front dejara de mandar el campo todo seguiría en verde
 * mientras staging responde 400. Con la validación puesta, ese fallo pone rojos los checks
 * de guardar que ya existían.
 *
 * Los mensajes y los códigos son los que devuelve staging DE VERDAD, medidos el 2026-09-15
 * contra el evento 26 con un PUT a mano: sin el campo responde `VALIDATION_ERROR` con una
 * línea por permiso —«permissions[0].order es obligatorio»— y con uno repetido responde
 * `BAD_REQUEST` con «No se puede repetir el orden de los permisos: N está asignado a más de
 * uno». Copiarlos tal cual importa: quien lea este falso para saber qué dice el backend, lee
 * lo que dice el backend.
 *
 * Devuelve `{ code, messages }` o null si la lista está bien.
 */
const errorDeOrden = (permissions) => {
  const lista = permissions ?? [];
  const faltantes = lista
    .map((permiso, i) => (permiso?.order === undefined || permiso?.order === null ? i : -1))
    .filter((i) => i >= 0);

  if (faltantes.length) {
    return {
      code: 'VALIDATION_ERROR',
      messages: faltantes.map((i) => `permissions[${i}].order es obligatorio`)
    };
  }

  const pequenos = lista.findIndex(
    (permiso) => !Number.isInteger(permiso.order) || permiso.order < 1
  );

  if (pequenos >= 0) {
    return {
      code: 'VALIDATION_ERROR',
      messages: [`permissions[${pequenos}].order debe ser al menos 1`]
    };
  }

  const vistos = new Set();

  for (const permiso of lista) {
    if (vistos.has(permiso.order)) {
      return {
        code: 'BAD_REQUEST',
        messages: [
          `No se puede repetir el orden de los permisos: ${permiso.order} está asignado a más de uno`
        ]
      };
    }

    vistos.add(permiso.order);
  }

  return null;
};

// Las ZONAS del país y qué departamentos caen en cada una.
//
// Solo las que el fixture usa —05 ANTIOQUIA, 13 BOLÍVAR, 76 VALLE DEL CAUCA, 08 ATLÁNTICO— más un par de
// vecinos, que es lo que hace falta para que el filtro de zona pueda RECORTAR de verdad: con un
// solo departamento por zona, `region_codes` y `department_codes` darían siempre lo mismo y el
// check no distinguiría un filtro que funciona de uno que no.
//
// Los códigos y nombres de zona son los de staging, medidos el 2026-09-15, y dos de los
// cruces también: el departamento 76 está en la zona 1 y el 08 en la 6. El resto del reparto
// es de este fixture, no del país: lo que tiene que reproducir es la FORMA —una zona agrupa
// varios departamentos— para que la cascada tenga algo que recortar.
const REGION_NAMES = {
  1: 'Pacífico',
  3: 'Eje Cafetero',
  5: 'Centro Oriente',
  6: 'Caribe 1'
};

const REGION_DEPARTMENTS = {
  1: ['76', '27'],
  3: ['05', '66'],
  5: ['13'],
  6: ['08']
};

// El nombre del departamento es el MISMO en el catálogo y en la fila del participante, así que
// cruzar por nombre funciona. Se dice porque acá mismo estuvo mal: las semillas mandaban «VALLE»
// en la fila y «VALLE DEL CAUCA» en el catálogo, y esa discrepancia —inventada por el fixture, no
// por el backend— hizo que alguien complicara una pantalla para defenderse de un caso que no
// existe.
//
// Medido contra staging el 2026-09-17, los tres departamentos con participantes:
//
//     código   en la fila          en el catálogo      ¿coinciden?
//     05       ANTIOQUIA           ANTIOQUIA           sí
//     08       ATLÁNTICO           ATLÁNTICO           sí
//     76       VALLE DEL CAUCA     VALLE DEL CAUCA     sí
//
// Un fixture que miente es peor que no tenerlo: no falla nunca y manda a defenderse de fantasmas.
const DEPARTMENT_NAMES = {
  '05': 'ANTIOQUIA',
  '08': 'ATLÁNTICO',
  13: 'BOLÍVAR',
  27: 'CHOCÓ',
  66: 'RISARALDA',
  76: 'VALLE DEL CAUCA'
};

// Los códigos que llegan en un parámetro CSV, limpios y sin huecos.
const csv = (params, nombre) =>
  (params.get(nombre) ?? '')
    .split(',')
    .map((uno) => uno.trim())
    .filter(Boolean);

// Los TRANSVERSALES: zona, delegación, municipio, deporte, categoría y sexo.
//
// Una sola función para los DOS listados que los aceptan —`ready-for-accreditation` y
// `card-batches/members`—, y a propósito. Los dos filtran por lo mismo y con los mismos
// nombres, así que dos copias empezarían iguales y se separarían en el primer cambio: la
// pantalla que se tocara de segunda quedaría medida contra una regla vieja sin que nada se
// pusiera rojo.
//
// Los dos fixtures nombran sus campos igual —`department_code`, `municipality_code`,
// `sport_codes`, `category_code`, `sex_code`—, que es lo que permite compartirla.
const CAMPOS_TRANSVERSALES = {
  municipality_codes: 'municipality_code',
  sport_codes: 'sport_codes',
  category_codes: 'category_code',
  discipline_codes: 'discipline_code',
  sex_codes: 'sex_code'
};

const recorteTransversal = (rows, params) => {
  let todos = rows;

  for (const [parametro, campo] of Object.entries(CAMPOS_TRANSVERSALES)) {
    const pedidos = csv(params, parametro);

    if (!pedidos.length) {
      continue;
    }

    todos = todos.filter((row) => {
      const suyo = row[campo];

      return Array.isArray(suyo)
        ? suyo.some((uno) => pedidos.includes(uno))
        : pedidos.includes(suyo);
    });
  }

  // Zona y delegación se UNEN, no se cruzan. Es la trampa del contrato y está medida contra
  // staging el 2026-09-16: `region_codes=8&department_codes=05` —una zona a la que Antioquia
  // NO pertenece— devuelve los 19 de Antioquia, no 0. O sea que pedir las dos enseña MÁS
  // gente, no menos, y una pantalla que mandara las dos «para afinar» filtraría al revés.
  //
  // `region_codes` no es una columna: la zona se traduce a sus departamentos, igual que hace
  // el backend. El mapa vive en REGION_DEPARTMENTS.
  const zonas = csv(params, 'region_codes');
  const delegaciones = csv(params, 'department_codes');

  if (zonas.length || delegaciones.length) {
    const admitidos = new Set([
      ...delegaciones,
      ...zonas.flatMap((zona) => REGION_DEPARTMENTS[zona] ?? [])
    ]);

    todos = todos.filter((row) => admitidos.has(row.department_code));
  }

  return todos;
};

// Como el `search` del backend: sin tildes y sin mayúsculas.
const plain = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// El listado paginado del módulo: {data, meta}. El SDK exige las dos claves.
//
// Pagina de verdad, con el `limit` y el `page` que le pidan: un mock que devuelva siempre
// todas las filas esconde justo los errores de paginación —un bucle que no sabe cuándo parar
// da la vuelta entera sin que nadie se entere—.
const paginado = (rows, url) => {
  const limit = Number(url?.searchParams.get('limit')) || 10;
  const page = Number(url?.searchParams.get('page')) || 1;
  const desde = (page - 1) * limit;

  return {
    data: rows.slice(desde, desde + limit),
    meta: {
      total: rows.length,
      page,
      limit,
      last_page: Math.max(1, Math.ceil(rows.length / limit))
    }
  };
};

const page1 = (rows) => paginado(rows);

// `permissions` cambia lo que `GET /v1/auth/me` devuelve, y con eso la sesión que el SDK
// arma. Es la única forma de probar la mitad de SOLO CONSULTA del módulo: las pantallas
// preguntan por `accreditation:manage` y el usuario de siempre trae `all:all`, que se lo
// concede todo.
export async function interceptGateway(page, { permissions } = {}) {
  // Lo que el mock recibió y decidió queda acá para poder afirmar sobre ello: no basta
  // con que la pantalla se vea bien, tiene que MANDAR lo que el contrato pide.
  const state = {
    permissions: permissions ?? SESSION.permissions,
    // El catálogo del módulo: SOLO los eventos con acreditación configurada, una fila por
    // evento. El segundo lleva tildes a propósito: el contrato promete búsqueda tolerante.
    eventCatalog: [
      {
        event_code: SESSION.eventCode,
        name: SESSION.eventName,
        start_date: '2026-09-01T08:00:00Z'
      },
      {
        event_code: 'c1a2b3d4-0000-4000-8000-000000000009',
        name: 'Clásica de Atletismo',
        start_date: '2026-11-03T08:00:00Z'
      },
      // ── Relleno, para que el catálogo tenga DOS páginas ──────────────────────
      // La pantalla pagina de a diez y el fixture traía dos eventos, así que la segunda
      // página no existía y con ella no se podía probar nada de paginar. Es justo donde
      // estaba el fallo que reportó QA: volver con «Cambiar» te dejaba a media lista.
      //
      // Van DESPUÉS de los dos de verdad para que esos sigan en la primera página, que es de
      // donde entran todos los demás bloques.
      ...Array.from({ length: 9 }, (_, indice) => ({
        event_code: `c1a2b3d4-0000-4000-8000-0000000001${String(indice).padStart(2, '0')}`,
        name: `Evento de relleno ${indice + 1}`,
        start_date: '2026-12-01T08:00:00Z'
      }))
    ],
    // Los permisos de acceso del evento. Uno lleva nombre largo a propósito: es lo que estiraba
    // el modal, porque el chip del SDK va con `white-space: nowrap`.
    accessPermissions: [
      {
        id: 21,
        code: 'VIP',
        name: 'Área V.I.P',
        has_limit: false,
        is_active: true
      },
      {
        id: 22,
        code: 'PRENSA',
        name: 'Área de prensa',
        has_limit: false,
        is_active: true
      },
      {
        id: 23,
        code: 'ALIM',
        name: 'Área de alimentación y campo de entrenamiento',
        has_limit: true,
        is_active: true
      },
      {
        id: 24,
        code: 'TRANS',
        name: 'Área de transporte',
        has_limit: false,
        is_active: true
      }
    ],
    roles: [
      {
        code: 'cfd0e564-69c9-4091-bf12-3fdb9d2948ab',
        id: 10,
        // Con el código PEGADO en el nombre, igual que en staging: el tipo se creó así y por
        // eso «(ATHLETE)» salía en el listado, el detalle, el perfil y los desplegables.
        role_name: 'Deportista (ATHLETE)',
        role_code: 'ATHLETE',
        // El rol que reconoce la plataforma, añadido por backend el 2026-08-26. Este lo tiene
        // y los otros tres NO, que es lo que pasa de verdad: los tipos creados antes de ese
        // despliegue llegan sin la clave.
        platform_role: 'ATHLETE',
        event_id: SESSION.eventId,
        is_active: true,
        // Cuatro permisos, y uno CON tope, que es el caso que importa: el backend guarda el
        // tope por permiso, no por tipo.
        //
        // Va SEGUNDO a propósito. La fila de la tabla solo enseña los dos primeros permisos y
        // el resto los cuenta en un «+N», así que con el tope en tercer lugar no habría cómo
        // comprobar que sale en la fila.
        //
        // Y el orden YA NO lo decide el backend (SUV2-2330): lo elige el usuario y llega en
        // `order`. Acá los ids van 21, 23, 22, 24 —desordenados a propósito— para que un
        // check no pueda pasar ordenando por id y creer que ordenó por posición.
        permissions: [
          {
            permission_id: 21,
            permission_name: 'Área V.I.P',
            has_limit: false,
            order: 1
          },
          {
            permission_id: 23,
            permission_name: 'Área de alimentación y campo de entrenamiento',
            has_limit: true,
            max_uses_per_person: 20,
            order: 2
          },
          {
            permission_id: 22,
            permission_name: 'Área de prensa',
            has_limit: false,
            order: 3
          },
          {
            permission_id: 24,
            permission_name: 'Área de transporte',
            has_limit: false,
            order: 4
          }
        ]
      },
      {
        code: '4be744ed-9fe5-46b7-952c-8607e6c609c7',
        id: 11,
        role_name: 'Delegado',
        role_code: 'DELEGADO',
        event_id: SESSION.eventId,
        is_active: true,
        // TODOS sin tope, como los ocho de staging: acá el «Límite de validaciones» no tiene
        // dónde guardarse, y antes aceptaba un número y lo descartaba al guardar.
        //
        // Y con HUECOS en el orden —1, 4, 9—, que el contrato permite porque el número es la
        // posición que eligió el usuario y el backend no recompacta. Este es el tipo con el
        // que se comprueba que la pantalla los pinta igual y que al guardar salen 1..N: para
        // una lista, un hueco no significa nada.
        permissions: [
          {
            permission_id: 21,
            permission_name: 'Área V.I.P',
            has_limit: false,
            order: 1
          },
          {
            permission_id: 22,
            permission_name: 'Área de prensa',
            has_limit: false,
            order: 4
          },
          {
            permission_id: 24,
            permission_name: 'Área de transporte',
            has_limit: false,
            order: 9
          }
        ]
      },
      {
        // Activo pero sin nadie acreditado: es el caso del 422 NO_ACCREDITATIONS.
        code: 'b21f0a2b-0000-4000-8000-000000000003',
        id: 12,
        // Un paréntesis que NO es el código: tiene que quedarse tal cual.
        role_name: 'Prensa (acreditada)',
        role_code: 'PRENSA',
        event_id: SESSION.eventId,
        is_active: true,
        permissions: []
      },
      {
        // Inactivo: no debe ofrecerse para generar carnets.
        code: '7c1f0a2b-0000-4000-8000-000000000004',
        id: 13,
        role_name: 'Tipo inactivo',
        role_code: 'INACTIVO',
        event_id: SESSION.eventId,
        is_active: false,
        permissions: []
      },
      {
        // Un tipo CON función, que es lo que trae SUV2-2228. Calcado del que backend dejó
        // creado en staging (evento 26) para probar esto: categoría SUPPORT_PERSONNEL y
        // función ENT.
        //
        // Es lo que permite que Héctor —personal de apoyo con función ENT— se acredite con
        // ESTE tipo y no con un genérico. Sin él, `resolveAccreditedTypeCode` cae al camino
        // viejo y no habría con qué distinguir un entrenador de un asistente.
        code: '9d2f0a2b-0000-4000-8000-000000000005',
        id: 14,
        role_name: 'Docente/Entrenador',
        role_code: 'DOCENTE_ENTRENADOR',
        platform_role: 'SUPPORT_PERSONNEL',
        platform_subrole: 'ENT',
        event_id: SESSION.eventId,
        is_active: true,
        permissions: [
          {
            permission_id: 21,
            permission_name: 'Área V.I.P',
            has_limit: false,
            order: 1
          }
        ]
      },
      {
        // Un tipo cuyo NOMBRE no se parece al de su función. Existe solo para que el check
        // de «el acreditado enseña su función» pueda fallar: los otros dos tipos con función
        // se llaman igual que ella —«Docente/Entrenador»→ENT, «Jefe de Misión»→JMI—, así que
        // con ellos el check pasaría también si la pantalla pintara el nombre del tipo dos
        // veces, que es justo el error que tiene que atrapar.
        //
        // PER es del diccionario del evento y no lo afirma ningún otro bloque.
        // Un tipo de Naowee, con `role_code` PROPIO: su código no coincide con el de la
        // función, igual que los que Javi creó en staging. Está para que se vea que la tabla
        // rotula por el catálogo y no por el código.
        code: '9d2f0a2b-0000-4000-8000-000000000009',
        id: 18,
        role_name: 'Coordinador Naowee',
        role_code: 'COORD_NAOWEE',
        platform_role: 'NAOWEE_STAFF',
        platform_subrole: 'NAOWEE_COORDINATOR',
        event_id: SESSION.eventId,
        is_active: true,
        permissions: []
      },
      {
        code: '9d2f0a2b-0000-4000-8000-000000000007',
        id: 16,
        role_name: 'Cuerpo de prensa',
        role_code: 'CUERPO_PRENSA',
        platform_role: 'MISSION_STAFF',
        platform_subrole: 'PER',
        event_id: SESSION.eventId,
        is_active: true,
        permissions: []
      },
      {
        // El tipo del personal de MISIÓN. Un evento que acredita misión tiene el suyo, y sin
        // él el filtro de Tipo no podría ofrecerlo: sus opciones son los tipos del evento.
        //
        // Es la salida a la que mandan los dos avisos de la pantalla —el único filtro que
        // alcanza a la misión, porque no pasa por orc—, así que sin este tipo esos avisos
        // estarían mandando a un callejón sin salida.
        code: '9d2f0a2b-0000-4000-8000-000000000006',
        id: 15,
        role_name: 'Jefe de Misión',
        role_code: 'JMI',
        platform_role: 'MISSION_STAFF',
        platform_subrole: 'JMI',
        event_id: SESSION.eventId,
        is_active: true,
        permissions: [
          {
            permission_id: 21,
            permission_name: 'Área V.I.P',
            has_limit: false,
            order: 1
          }
        ]
      }
    ],
    accreditations: [
      {
        code: 'aaaa1111-0000-4000-8000-000000000001',
        event_id: SESSION.eventId,
        user_code: 'user-andres',
        document_number: '150001002001',
        full_name: 'Andrés Camilo Martínez Rodríguez',
        department_name: 'ANTIOQUIA',
        // Los transversales salen de la inscripción en orc, así que SOLO los deportistas los
        // tienen: filtrar por deporte, categoría o sexo deja fuera al personal de apoyo, y
        // eso es lo que la pantalla tiene que avisar. Por eso no se siembran en todas.
        department_code: '05',
        municipality_code: '05001',
        // El NOMBRE del municipio, que es lo que pinta la columna «Territorio»: el endpoint
        // devuelve los dos nombres desde el 2026-09-16 y la tabla no traduce códigos.
        municipality_name: 'Medellín',
        // Datos cambiados tras imprimir el carnet: la única fila que lleva el aviso.
        card_outdated: true,
        sport_codes: ['ATL'],
        category_code: 'JUV',
        sex_code: 'H',
        role_code: 'ATHLETE',
        // Como lo devuelve staging: el nombre trae el código pegado.
        role_name: 'Deportista (ATHLETE)',
        status: 'ACTIVE',
        permissions_total: 2,
        uses_consumed: 0,
        // SIN zona y en UTC, que es como lo manda accreditation-ms de verdad: medido contra
        // staging el 2026-09-10, `"created_at": "2026-09-09T19:38:30.550699"`. Con la `Z` que
        // tenía antes, el fallo de las cinco horas era irreproducible acá.
        created_at: '2026-07-28T10:15:00.550699'
      },
      {
        code: 'aaaa1111-0000-4000-8000-000000000002',
        event_id: SESSION.eventId,
        user_code: 'user-maria',
        document_number: '150001003081',
        full_name: 'María Camila Arias Díaz',
        department_name: 'BOLÍVAR',
        department_code: '13',
        municipality_code: '13001',
        municipality_name: 'Cartagena',
        // Sin deporte, categoría ni sexo: no es deportista, no tiene inscripción. Es la fila
        // con la que se comprueba que esos tres filtros la DEJAN FUERA: sin nadie a quien no
        // le apliquen, «recorta» y «devuelve todo» se verían igual.
        role_code: 'DELEGADO',
        role_name: 'Delegado',
        status: 'ACTIVE',
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-07-29T09:00:00.000Z'
      },
      {
        // Personal de MISIÓN, y por eso sin NADA de territorio ni de competencia: se acredita
        // por `mission_staff_code` y su `user_code` es nulo, así que la allowlist de orc
        // —que cruza por `user_code`— nunca lo alcanza. Backend lo explicó el 2026-09-10 y se
        // mide en el evento 20 de staging: con `department_codes` la fila de misión
        // desaparece (1→0) mientras el apoyo sigue entero (6→6).
        //
        // Es la fila que hace que los avisos de la pantalla se puedan comprobar: sin ella,
        // los checks dirían que el parámetro viaja y no que la lista dice la verdad.
        code: 'aaaa1111-0000-4000-8000-00000000000f',
        event_id: SESSION.eventId,
        user_code: null,
        document_number: '150001010066',
        full_name: 'Carolina Vélez Mission',
        department_name: '',
        role_code: 'JMI',
        role_name: 'Jefe de Misión',
        status: 'ACTIVE',
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-07-29T10:00:00.000Z'
      },
      {
        // Aparece en el listado pero el endpoint de acreditaciones no la reconoce: emula la
        // carrera real de una acreditación que alguien borra o inactiva entre que se
        // pinta la tabla y se manda el lote. Es el caso de `skipped`.
        code: 'aaaa1111-0000-4000-8000-000000000003',
        event_id: SESSION.eventId,
        user_code: 'user-juan',
        document_number: '150001004055',
        full_name: 'Juan Esteban Ríos Peña',
        department_name: 'VALLE DEL CAUCA',
        // Cuelga del tipo cuyo nombre NO es el de su función: es la fila con la que se mide
        // que la columna Tipo enseña la función y no el nombre otra vez.
        role_code: 'CUERPO_PRENSA',
        role_name: 'Cuerpo de prensa',
        status: 'ACTIVE',
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-07-30T09:00:00.000Z',
        orphan: true
      },
      {
        // IMPRESA pero sin entregar: la tercera situación de la columna de entrega, que no se
        // podía pintar hasta que backend empezó a mandar `printed_at` —medido en staging el
        // 2026-09-15—. Es el caso del mostrador: el carnet ya existe en papel y nadie ha
        // pasado a recogerlo.
        code: 'aaaa1111-0000-4000-8000-000000000005',
        event_id: SESSION.eventId,
        user_code: 'user-tomas',
        document_number: '150001009044',
        full_name: 'Tomás Herrera Lozano',
        department_name: 'SANTANDER',
        role_code: 'DELEGADO',
        role_name: 'Delegado',
        status: 'ACTIVE',
        printed_at: '2026-09-08T21:54:21.4495',
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-08-01T09:00:00.000Z'
      },
      {
        code: 'aaaa1111-0000-4000-8000-000000000004',
        event_id: SESSION.eventId,
        user_code: 'user-laura',
        document_number: '150001007033',
        full_name: 'Laura Gómez Peña',
        // La OTRA punta de cada transversal, y por eso los trae todos distintos a los de
        // Andrés: otra zona (6 y no 3), otra delegación, otro municipio, otro deporte, otra
        // categoría y el otro sexo. Con una sola punta, un filtro que devolviera siempre lo
        // mismo pasaría por bueno: hace falta que cada valor deje fuera a alguien y dentro a
        // otro. Su fila es además la única ENTREGADA, que es la otra mitad de `delivered`.
        department_name: 'ATLÁNTICO',
        department_code: '08',
        municipality_code: '08001',
        municipality_name: 'Barranquilla',
        sport_codes: ['NAT'],
        category_code: 'PRE_JUV',
        sex_code: 'M',
        role_code: 'DELEGADO',
        role_name: 'Delegado',
        status: 'ACTIVE',
        // Su carnet se pidió de a uno, así que ya está entregado.
        //
        // Y lleva `printed_at` A PROPÓSITO: una entregada también se imprimió antes, así que
        // es el control de que la columna mira la entrega PRIMERO. Sin este dato, un orden al
        // revés —impresa antes que entregada— pasaría el check igual.
        printed_at: '2026-09-07T15:00:00.000000',
        delivered: true,
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-07-31T09:00:00.000Z'
      },
      {
        // DOS inactivas de la MISMA persona, y a propósito.
        //
        // Cubren dos cosas que no tenían con qué probarse: la cuarta forma de la columna de
        // acreditación —«Inactiva»—, y la regla que backend garantiza y que está medida contra
        // staging: una sola fila por identidad, y cuando no hay ninguna activa, la INACTIVA
        // MÁS RECIENTE. Si el cruce se quedara con la primera que encuentra, acá se vería.
        //
        // Y sigue siendo acreditable: volver a acreditar a quien solo tiene inactivas es
        // justo la reacreditación, no el 409. Por eso `exclude_accredited` nunca las restó.
        //
        // OJO CON EL CÓDIGO: van en 0007 y 0008 porque el 0005 es de Tomás Herrera. Estuvieron
        // repetidas —dos ramas eligieron el mismo hueco y git las juntó sin conflicto, cada una
        // en su sitio— y el cruce por código se quedaba con la primera: la fila de Relleno1
        // salía «Activa» y como «Delegado». Los códigos del fixture son su identidad; repetir
        // uno no rompe nada de forma visible, solo hace que una fila hable de otra persona.
        code: 'aaaa1111-0000-4000-8000-000000000007',
        event_id: SESSION.eventId,
        user_code: 'user-relleno-1',
        document_number: '15000200001',
        full_name: 'Relleno1 De Prueba',
        department_name: 'ANTIOQUIA',
        department_code: '05',
        role_code: 'ATHLETE',
        role_name: 'Deportista (ATHLETE)',
        status: 'INACTIVE',
        permissions_total: 1,
        uses_consumed: 0,
        created_at: '2026-08-02T11:00:00.000Z'
      },
      {
        code: 'aaaa1111-0000-4000-8000-000000000008',
        event_id: SESSION.eventId,
        user_code: 'user-relleno-1',
        document_number: '15000200001',
        full_name: 'Relleno1 De Prueba',
        department_name: 'ANTIOQUIA',
        department_code: '05',
        role_code: 'ATHLETE',
        role_name: 'Deportista (ATHLETE)',
        status: 'INACTIVE',
        permissions_total: 1,
        uses_consumed: 0,
        // La VIEJA: la fila de acreditables tiene que quedarse con la de arriba.
        created_at: '2026-08-01T08:00:00.000Z'
      }
    ],
    // Los permisos que el DETALLE de cada acreditación devuelve. Van aparte del listado a
    // propósito: el listado solo trae el conteo y el detalle trae la lista.
    //
    // Y SÍ traen `file_icon_upload_id`. Acá decía lo contrario, y por eso la pantalla se
    // pasó meses bajando el catálogo entero de permisos para cruzarlo. Medido en staging
    // el 2026-09-08: 156 de 156 permisos de tres eventos lo traen. Se deja uno SIN icono a
    // propósito —el de abajo sí lo tiene— porque el caso mixto es el que destapó que un
    // hueco pintaba una cajita gris diciendo «acá hay algo» sin haber nada.
    detailPermissions: {
      'aaaa1111-0000-4000-8000-000000000002': [
        {
          permission_id: 5,
          permission_name: 'Alimentación',
          has_limit: true,
          max_uses_per_person: 5,
          used_count: 2,
          valid_from: '2026-08-01T00:00:00',
          valid_to: '2026-08-30T23:59:00',
          status: 'ACTIVE',
          // La zona y la sede del permiso, que el contrato trae desde el paquete del
          // 2026-08-13. Estaban sembradas en null y por eso nadie notó que la pantalla no las
          // pintaba: «Área V.I.P» sin decir de qué escenario no sirve en la puerta.
          zone_name: 'Zona norte',
          venue_name: 'Coliseo El Salitre'
        },
        // Un segundo permiso CON icono, para que la tabla quede mixta: uno con archivo y otro
        // sin él. Es el caso de dev —de tres permisos, uno tenía icono— y el que dejaba una
        // columna de cajitas grises diciendo «acá hay algo» sin haber nada.
        {
          permission_id: 6,
          permission_name: 'Áreas de prensa',
          has_limit: false,
          max_uses_per_person: null,
          used_count: 0,
          valid_from: '2026-08-01T00:00:00',
          valid_to: null,
          status: 'ACTIVE',
          zone_name: null,
          venue_name: null,
          file_icon_upload_id: 'upload-icono-prensa'
        }
      ]
    },
    // Las personas del módulo: la única fuente de los nombres por separado, y desde el
    // despliegue del backend de agosto también del sexo y el correo, que él llena solo
    // contra user-auth al CREAR la persona.
    //
    // La primera los tiene y la segunda no, y esa diferencia es el caso real: las personas
    // registradas antes de ese despliegue llegan SIN esas claves —ausentes, no en null— y
    // no hay PATCH que las corrija.
    persons: [
      {
        code: 'per00001-0000-4000-8000-000000000001',
        user_code: 'user-maria',
        document_number: '150001003081',
        name: 'María',
        second_name: 'Camila',
        last_name: 'Arias',
        second_last_name: 'Díaz',
        // El código del catálogo del backend. OJO: `M` es MUJER, no Male.
        sex: 'M',
        email: 'maria.arias@naowee.test',
        department_code: '13',
        department_name: 'BOLÍVAR'
      },
      {
        code: 'per00002-0000-4000-8000-000000000002',
        user_code: 'user-andres',
        document_number: '150001002001',
        name: 'Andrés',
        second_name: 'Camilo',
        last_name: 'Martínez',
        second_last_name: 'Rodríguez',
        department_code: '05',
        department_name: 'ANTIOQUIA'
      }
    ],
    // La auditoría de una acreditación, que el detalle pide aparte. No trae el nombre de
    // quien hizo cada movimiento, solo su user_code.
    audits: {
      'aaaa1111-0000-4000-8000-000000000002': [
        {
          action: 'DEACTIVATED',
          old_status: 'ACTIVE',
          new_status: 'INACTIVE',
          changed_by_code: 'user-supervisora',
          // CON nombre: es un movimiento posterior al despliegue del 31 de agosto, que estrenó
          // `changed_by_name`. Backend lo confirmó el 2026-09-03.
          // Con dobles espacios y espacio final, como llega de verdad: el backend concatena
          // las cuatro partes del nombre aunque las intermedias vengan vacías. Medido en
          // staging: «Juan  Armero ».
          changed_by_name: 'Andrea  Montalvo Díaz ',
          changed_at: '2026-09-03T15:10:00.000Z',
          comments: 'Se retiró de la delegación'
        },
        {
          action: 'VALIDATED',
          old_status: null,
          new_status: null,
          changed_by_code: SESSION.user_code,
          changed_at: '2026-08-02T12:30:00.000Z',
          comments: 'GRANTED 1/1 permisos'
        },
        {
          // SIN `changed_by_name`, y la clave AUSENTE, no en null: es de julio, anterior a la
          // feature, y el gateway omite la clave. El historial no se reescribe, así que estos
          // se quedan sin autor para siempre —por eso la meta no pinta una raya ahí—.
          action: 'CREATED',
          old_status: null,
          new_status: 'ACTIVE',
          changed_by_code: SESSION.user_code,
          changed_at: '2026-07-29T09:00:00.000Z',
          comments: null
        }
      ]
    },
    // Las lecturas del punto de acceso. Dos acreditaciones distintas y una con observación,
    // porque el historial las agrupa por acreditación y marca la que trae comentario.
    //
    // Las lecturas del evento, con la forma medida en dev el 2026-09-03: llevan `id` propio,
    // las DENEGADAS también se registran —siete de catorce allá— y traen su motivo y los usos
    // congelados en el momento de la lectura.
    //
    // El arnés las sembraba solo concedidas y sin id, porque el modelo afirmaba que las
    // denegadas «no se registran». Eso era del 2026-08-13 y dejó de ser cierto.
    validationLogs: [
      {
        id: 41,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000002',
        validator_user_code: SESSION.user_code,
        // La única con nombre: las lecturas anteriores al 31 de agosto llegan sin la clave, y
        // en dev TODAS son del 19 de agosto, así que allá el nombre no se ve todavía.
        validator_user_name: ' Andrea  Montalvo Díaz',
        permission_id: 21,
        permission_name: 'Área V.I.P',
        validation_result: 'GRANTED',
        observation: 'Entró por la puerta norte',
        denial_reason: null,
        used_count: 1,
        max_uses_per_person: 3,
        scanned_at: '2026-08-04T18:20:00.000Z'
      },
      {
        // Denegada por no ser validador de ese permiso: es el motivo más común y el backend lo
        // redacta en español, listo para mostrar.
        id: 40,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000001',
        validator_user_code: 'user-supervisora',
        permission_id: 23,
        permission_name: 'Área de alimentación y campo de entrenamiento',
        validation_result: 'DENIED',
        observation: null,
        denial_reason:
          'No estás autorizado para validar este permiso en el evento',
        used_count: null,
        max_uses_per_person: null,
        scanned_at: '2026-08-03T07:45:00.000Z'
      },
      {
        id: 39,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000002',
        validator_user_code: SESSION.user_code,
        permission_id: 22,
        permission_name: 'Área de prensa',
        validation_result: 'GRANTED',
        observation: null,
        denial_reason: null,
        used_count: 2,
        max_uses_per_person: 5,
        scanned_at: '2026-08-02T12:30:00.000Z'
      },
      {
        id: 38,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000001',
        validator_user_code: SESSION.user_code,
        permission_id: 21,
        permission_name: 'Área V.I.P',
        validation_result: 'GRANTED',
        observation: null,
        denial_reason: null,
        used_count: null,
        max_uses_per_person: null,
        scanned_at: '2026-08-01T09:15:00.000Z'
      }
    ],
    // Los participantes con su documentación aprobada, que es de donde sale el mostrador.
    // El primero YA está acreditado: es el que `exclude_accredited` tiene que quitar.
    readyParticipants: [
      // Periodista de Sede: sin departamento y CON zona. Es el caso que hace observable que la
      // región se lea de la fila en vez de deducirse del departamento.
      {
        user_code: '0d2e4cf2-3771-4940-b593-8c8050e40537',
        user_role: 'PER_SEDE',
        identity_type: 'MISSION_STAFF',
        overall_status: 'APPROVED',
        requirements_total: 5,
        requirements_loaded: 5,
        requirements_approved: 5,
        user_first_name: 'Juan',
        user_second_name: 'Manuel',
        user_first_lastname: 'Lopez',
        user_second_lastname: 'Vergara',
        document_type: 'CC',
        document_number: '23262672',
        // Sin departamento NI municipio, a propósito: no tiene delegación.
        organization_name: 'Caribe 1',
        region_code: '6',
        region_name: 'Caribe 1',
        accreditation_code: 'd8429b07-c7ec-4712-886d-bd27be15b000',
        accreditation_status: 'INACTIVE',
        delivery_status: 'PENDING'
      },
      {
        user_code: 'user-andres',
        user_role: 'ATHLETE',
        overall_status: 'APPROVED',
        requirements_total: 4,
        requirements_loaded: 4,
        requirements_approved: 4,
        user_first_name: 'Andrés',
        user_first_lastname: 'Martínez',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001002001',
        // El sexo de la PERSONA, que desde el despliegue del 2026-09-15 es lo que mira
        // `sex_codes` —antes era el de la prueba inscrita—. Ninguna fila lo traía, así que ese
        // filtro era una rama muerta del mock: recortaba contra un campo inexistente y
        // devolvía cero pasara lo que pasara.
        sex_code: 'H',
        department_code: '05',
        department_name: 'ANTIOQUIA'
      },
      {
        user_code: 'user-sofia',
        // Deporte y municipio de la inscripción: de acá salen dos de las tres facetas, y sin
        // ellos esos desplegables nacían vacíos.
        sport_codes: ['ATL'],
        sport_names: ['Atletismo'],
        municipality_code: '05001',
        municipality_name: 'Medellín',
        overall_status: 'APPROVED',
        requirements_total: 4,
        requirements_loaded: 4,
        requirements_approved: 4,
        user_role: 'ATHLETE',
        user_first_name: 'Sofía',
        user_first_lastname: 'Restrepo',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001005011',
        sex_code: 'M',
        category_code: 'JUV',
        department_code: '05',
        department_name: 'ANTIOQUIA'
      },
      {
        // El SEGUNDO de misión, y este SIN acreditar.
        //
        // Hizo falta cuando el cruce de acreditados pasó a hacerse por DOCUMENTO, que es como
        // lo hace el backend de verdad: Carolina tiene una acreditación activa cuyo
        // `user_code` es nulo, y en cuanto el cruce dejó de mirar solo el `user_code` quedó
        // —con razón— fuera de la lista del modal, que pide `exclude_accredited=true`.
        //
        // Sin este, no quedaba ningún personal de misión al que acreditar y el caso que este
        // fixture existe para cubrir —las dos identidades en la MISMA llamada masiva— se
        // quedaba sin sujeto.
        //
        // Va detrás de Sofía a propósito: el modal trae de a cuatro y tiene que caber.
        user_code: 'mision-ricardo',
        user_role: 'MED',
        identity_type: 'MISSION_STAFF',
        user_first_name: 'Ricardo',
        user_first_lastname: 'Ossa',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001011077',
        department_code: '05',
        department_name: 'ANTIOQUIA',
        overall_status: 'APPROVED',
        requirements_total: 0,
        requirements_loaded: 0,
        requirements_approved: 0
      },
      {
        user_code: 'user-diego',
        user_role: 'DELEGADO',
        user_first_name: 'Diego',
        user_first_lastname: 'Salazar',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001006022',
        // El tercer municipio de las facetas, por lo mismo que el de Laura.
        municipality_code: '13001',
        municipality_name: 'Cartagena',
        department_code: '13',
        department_name: 'BOLÍVAR',
        overall_status: 'APPROVED',
        requirements_total: 2,
        requirements_loaded: 2,
        requirements_approved: 2
      },
      {
        // Personal de apoyo SIN proceso documental que lo cubra: llega aprobado con CERO
        // requisitos. Es el arreglo de «el personal de apoyo no aparece» y está medido tal
        // cual en dev: antes una fase sin proceso documental devolvía la lista vacía.
        user_code: 'user-hector',
        user_role: 'SUPPORT_PERSONNEL',
        // La FUNCIÓN, que `user_role` no distingue: ahí todos son SUPPORT_PERSONNEL. Con ella,
        // Héctor se acredita con el tipo «Docente/Entrenador» y no con un genérico.
        //
        // Las dos listas van alineadas por posición y backend garantiza que no se corren.
        support_role_codes: ['ENT'],
        support_role_names: ['Docente/Entrenador'],
        identity_type: 'PLATFORM_USER',
        user_first_name: 'Héctor',
        user_first_lastname: 'Quintero',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001009055',
        department_code: '05',
        department_name: 'ANTIOQUIA',
        overall_status: 'APPROVED',
        requirements_total: 0,
        requirements_loaded: 0,
        requirements_approved: 0
      },
      {
        // Documentación a medias: solo sale con readiness=PENDING y NO se puede acreditar.
        user_code: 'user-valeria',
        user_role: 'ATHLETE',
        user_first_name: 'Valeria',
        user_first_lastname: 'Ospina',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001008044',
        department_code: '76',
        department_name: 'VALLE DEL CAUCA',
        overall_status: 'PENDING',
        requirements_total: 5,
        requirements_loaded: 4,
        requirements_approved: 3
      },
      {
        // Personal de MISIÓN: se inscribe por delegación y NO tiene cuenta en la plataforma,
        // así que su código es un `mission_staff_code` y no un `user_code`.
        //
        // Este es el caso que staging no puede producir —backend lo dijo: no hay personal de
        // misión inscrito en ningún evento de acreditación— y es justo el que hay que poder
        // probar: el endpoint MASIVO no admite esta identidad, y como el código también es un
        // uuid pasaría la validación y caería en `skipped` en silencio.
        user_code: 'mision-carolina',
        // El rol de VERDAD, no el paraguas: MISSION_STAFF es la categoría y no existe como
        // `role_code` en ningún catálogo. Backend lo aclaró el 2026-09-09 —la fila llega con
        // `user_role: "JMI"`, el mismo código que devuelve el catálogo de funciones—.
        user_role: 'JMI',
        identity_type: 'MISSION_STAFF',
        user_first_name: 'Carolina',
        user_first_lastname: 'Vélez',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001010066',
        department_code: '05',
        department_name: 'ANTIOQUIA',
        overall_status: 'APPROVED',
        requirements_total: 0,
        requirements_loaded: 0,
        requirements_approved: 0
      },
      {
        // La forma ENTREGADA de la columna de acreditación: su acreditación existe, está
        // activa y su carnet ya se entregó (ver `user-laura` en `accreditations`).
        //
        // Sin ella, la pantalla unificada solo podría enseñar tres de las cuatro situaciones y
        // el check de «entregada» no tendría contra qué medir.
        user_code: 'user-laura',
        user_role: 'ATHLETE',
        overall_status: 'APPROVED',
        requirements_total: 3,
        requirements_loaded: 3,
        requirements_approved: 3,
        user_first_name: 'Laura',
        user_first_lastname: 'Gómez',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: '150001007033',
        sex_code: 'M',
        // Su deporte y su municipio, que acá no se usan para filtrar nada: las FACETAS salen
        // de esta lista, así que un valor que no esté sembrado acá no se ofrece en ningún
        // desplegable de las dos pantallas. Sin ellos, «Natación» y «Barranquilla» existirían
        // en las acreditaciones y no habría cómo elegirlos.
        sport_codes: ['NAT'],
        sport_names: ['Natación'],
        category_code: 'PRE_JUV',
        municipality_code: '08001',
        municipality_name: 'Barranquilla',
        department_code: '08',
        department_name: 'ATLÁNTICO'
      },
      // ── Relleno, para que la lista tenga DOS páginas ─────────────────────────
      // La pantalla pagina de a diez y hasta ahora el fixture traía cuatro acreditables, así
      // que la segunda página no existía y con ella no se podía probar nada de paginar. Es
      // justo donde estaba el fallo del contador de la selección.
      //
      // Van con documentación completa para que caigan todos en READY, que es la pestaña
      // donde se acredita.
      ...Array.from({ length: 9 }, (_, indice) => ({
        user_code: `user-relleno-${indice + 1}`,
        user_role: 'ATHLETE',
        overall_status: 'APPROVED',
        requirements_total: 4,
        requirements_loaded: 4,
        requirements_approved: 4,
        user_first_name: `Relleno${indice + 1}`,
        user_first_lastname: 'De Prueba',
        document_type: 'CC',
        document_type_name: 'Cédula',
        document_number: `1500020000${indice + 1}`,
        sex_code: 'H',
        department_code: '05',
        department_name: 'ANTIOQUIA'
      }))
    ],
    // Dos lotes que ya existían antes de entrar: uno terminado y partido en dos PDFs
    // —cada chunk es un PDF de hasta 30 carnets— y uno que sigue generándose, que es el
    // que deja ver qué hace la pantalla cuando el backend todavía no publica nada.
    cardBatches: [
      {
        batch_code: LOTE_EN_CURSO,
        batch_number: 2,
        event_code: SESSION.eventCode,
        kind: 'BULK',
        status: 'PROCESSING',
        total_cards: 3,
        total_chunks: 1,
        cards_without_photo: 3,
        requested_by: SESSION.user_code,
        created_at: '2026-08-17T16:20:00.000Z',
        members: [
          {
            accreditation_code: 'aaaa1111-0000-4000-8000-000000000001',
            full_name: 'Andrés Camilo Martínez Rodríguez'
          },
          {
            // Su carnet se generó con el lote y DESPUÉS la inactivaron (ver
            // `user-relleno-1` en `accreditations`). La pertenencia al lote no se borra —lo
            // que se rehace es el PDF, sin esa hoja— así que sigue saliendo en el listado
            // aplanado, ahí sí como «Inactiva».
            //
            // Es la tercera situación que «Lista de acreditados» tiene que saber pintar, y
            // la única con la que se puede comprobar que las acciones de gestión se
            // ESCONDEN: sin ella, el fixture solo tenía activas.
            accreditation_code: 'aaaa1111-0000-4000-8000-000000000007',
            full_name: 'Relleno1 De Prueba'
          },
          {
            // El personal de MISIÓN, que también se acredita y también lleva carnet. Está acá
            // porque es la única fila SIN NADA de territorio —no se inscribe por delegación,
            // así que su acreditación no trae ni departamento ni municipio— y es la que
            // ejercita los dos respaldos de la columna «Territorio» a la vez.
            //
            // De paso es el control negativo de los tres filtros territoriales: zona,
            // delegación y municipio tienen que dejarla fuera siempre, pasen por donde pasen.
            accreditation_code: 'aaaa1111-0000-4000-8000-00000000000f',
            full_name: 'Carolina Vélez Mission'
          }
        ],
        skipped: [],
        uploads: ['pdf-lote0002-0'],
        // Nunca termina dentro de la verificación: es el lote «en curso».
        settleAfter: Number.POSITIVE_INFINITY
      },
      {
        batch_code: 'lote0001-0000-4000-8000-000000000000',
        batch_number: 1,
        event_code: SESSION.eventCode,
        kind: 'BULK',
        status: 'COMPLETED',
        total_cards: 2,
        total_chunks: 2,
        cards_without_photo: 2,
        requested_by: SESSION.user_code,
        created_at: '2026-08-16T09:00:00.000Z',
        members: [
          {
            accreditation_code: 'aaaa1111-0000-4000-8000-000000000001',
            full_name: 'Andrés Camilo Martínez Rodríguez'
          },
          {
            accreditation_code: 'aaaa1111-0000-4000-8000-000000000002',
            full_name: 'María Camila Arias Díaz'
          }
        ],
        // Los omitidos persisten en el lote: se siguen viendo entrando después, no solo
        // en la respuesta del POST.
        skipped: [
          {
            code: 'aaaa1111-0000-4000-8000-000000000003',
            reason: 'La acreditación no existe en el evento'
          }
        ],
        uploads: ['pdf-lote0001-0', 'pdf-lote0001-1'],
        settleAfter: 0
      },
      {
        // Una acreditación pedida de a una: numera en la misma serie del evento, pero no es un
        // lote de varios y la tabla no debe llamarlo así.
        batch_code: 'indiv001-0000-4000-8000-000000000000',
        batch_number: 3,
        event_code: SESSION.eventCode,
        kind: 'INDIVIDUAL',
        status: 'COMPLETED',
        total_cards: 1,
        total_chunks: 1,
        cards_without_photo: 1,
        requested_by: SESSION.user_code,
        created_at: '2026-08-15T11:30:00.000Z',
        members: [
          {
            accreditation_code: 'aaaa1111-0000-4000-8000-000000000004',
            full_name: 'Laura Gómez Peña'
          }
        ],
        skipped: [],
        uploads: ['pdf-indiv001-0'],
        settleAfter: 0
      }
    ],
    // ── Lo que el DETALLE de una acreditación cuenta de su carnet ──────────────
    //
    // Las tres claves —`batch_code`, `batch_status`, `card_url`— y un acreditado por caso.
    // Está acá, y no incrustado en la ruta, por dos motivos:
    //
    // - el `batchCode` apunta a un lote DE VERDAD de `cardBatches`. Antes eran códigos
    //   inventados —`...0001` y `...0002`, que no son ningún lote—: mientras la pantalla leía
    //   el detalle una sola vez daba igual, pero desde que SIGUE el lote, el del carnet «en
    //   curso» respondía 404 y el botón caía en «Generar», que es justo lo que no puede
    //   ofrecerle a alguien que ya tiene un carnet generándose;
    // - y el detalle tiene que poder CAMBIAR entre dos lecturas, que es lo que pasa cuando el
    //   lote termina con la pantalla abierta. Ver el GET del lote por código.
    carnetDelDetalle: {
      'aaaa1111-0000-4000-8000-000000000001': {
        // Carnet YA generado: la pantalla lo abre sin emitir ni seguir nada.
        batchCode: 'lote0001-0000-4000-8000-000000000000',
        batchStatus: 'COMPLETED',
        cardUrl:
          'https://bucket.pruebas.test/generated/carnet.pdf?X-Amz-Signature=firma'
      },
      'aaaa1111-0000-4000-8000-000000000002': {
        // EN CURSO: hay lote y todavía no hay PDF. Es el lote que no termina nunca dentro de
        // la verificación, así que la pantalla lo ve girando de principio a fin.
        batchCode: LOTE_EN_CURSO,
        batchStatus: 'PROCESSING',
        cardUrl: null
      }
      // El tercer acreditado no tiene entrada: nunca se le emitió nada, y es al único al que
      // se le ofrece «Generar».
    },
    // Un lote para el detalle de una acreditación, derivado del que ya está sembrado en
    // curso: entre un caso y otro lo único que cambia es cuándo se da por terminado y si el
    // detalle se entera.
    //
    //   settleAfter  cuántas consultas aguanta antes de terminar. 0 = ya estaba terminado al
    //                entrar; `Infinity` = no termina nunca.
    //   retrasado    el detalle NO se entera de que el lote terminó: se queda en PROCESSING
    //                con `card_url` en null. Es la ventana medida en staging entre las 15:25
    //                y las 15:27, con el PDF ya hecho y el detalle sin saberlo.
    //
    // Devuelve el lote, que es de donde sale el `upload_id` del PDF que hay que abrir.
    loteDelDetalle(code, { settleAfter = 1, retrasado = false } = {}) {
      const persona = state.accreditations.find((row) => row.code === code);

      state.batchSequence += 1;

      const batchCode = `lote000${state.batchSequence}-0000-4000-8000-000000000000`;

      const lote = {
        ...state.cardBatches.find(
          (batch) => batch.batch_code === LOTE_EN_CURSO
        ),
        batch_code: batchCode,
        batch_number: state.batchSequence,
        // De a uno: el carnet de esta acreditación y nadie más.
        kind: 'INDIVIDUAL',
        status: 'PROCESSING',
        total_cards: 1,
        total_chunks: 1,
        cards_without_photo: 1,
        created_at: '2026-09-16T15:22:34.000Z',
        members: [
          {
            accreditation_code: code,
            full_name: persona?.full_name ?? ''
          }
        ],
        skipped: [],
        uploads: [`pdf-${batchCode}-0`],
        settleAfter
      };

      state.cardBatches.unshift(lote);

      state.carnetDelDetalle[code] = {
        batchCode,
        batchStatus: 'PROCESSING',
        cardUrl: null,
        retrasado
      };

      return lote;
    },
    // El consecutivo del lote es POR EVENTO, y los sembrados ya gastaron del 1 al 3.
    batchSequence: 3,
    // El cuerpo de cada POST de acreditaciones, en orden: es lo que se comprueba.
    cardRequests: [],
    // Y el de cada acción masiva: por códigos o por lote entero, no es lo mismo.
    bulkRequests: [],
    // El de cada acción INDIVIDUAL (`PATCH .../{code}/{accion}`). Va aparte de `bulkRequests`
    // a propósito: revertir en bloque no tiene endpoint masivo y la pantalla recorre el
    // individual, así que lo que hay que poder contar es cuántos PATCH salieron y con qué
    // código cada uno. Mezclarlos escondería justo eso.
    actionRequests: [],
    // Cuántas veces se preguntó por cada lote. El estado avanza con las consultas para
    // ver el «generando» en pantalla sin depender de un reloj.
    polls: {},
    // Todo lo que la aplicación pidió, en orden: sirve para exigir que NO pida cosas.
    requests: [],
    // Los cuerpos que llegaron al POST de un tipo: sirve para exigir que el `role_code` que
    // se guarda sea el DEL CATÁLOGO y no uno derivado del nombre en español.
    // Los cuerpos que llegaron al POST de emisión masiva: sirve para exigir que salga UNA
    // sola petición con el rol POR PERSONA, y no las 2N del bucle que había.
    bulkCreates: [],
    // Lo que se mandó por el endpoint INDIVIDUAL. Es donde se ve con qué identidad viajó cada
    // uno: `user_code` o `mission_staff_code`.
    singleCreates: [],
    // Manda a FAILED el lote que termine, en vez de a COMPLETED. Ver la ruta del GET.
    fallaElLote: false,
    // El catálogo de roles responde 500. De él dependen los desplegables de tipo y función, y
    // antes de este PR el fallo se tragaba en silencio.
    fallaElCatalogoDeRoles: false,
    // Los carnets que el DESPACHO no emite, uno por motivo, aplicados a los últimos de la
    // emisión. Desde SUV2-2531 salen por el `skipped` del 202 CON su nombre, y NO se
    // persisten: el detalle del lote consultado después no los trae.
    omitidosAlGenerar: [],
    // Y este falla solo las N PRIMERAS veces: es lo que deja medir el reintento del hook de
    // rótulos, que con el fallo permanente no se distingue de no reintentar.
    fallosDelCatalogoDeRoles: 0,
    // Enciende el 422 PHASE_REQUIRED al generar un lote. No se puede provocar desde la UI —el
    // fixture es de un evento de una sola fase— y es justo lo que le pasa a los de varias.
    forzarFaseRequerida: false,
    // Un user_code que el masivo tratará como ya acreditado. Ver la ruta de bulk.
    forzarSkipEnBulk: undefined,
    // Enciende el caso de `emit-with-card` en que las acreditaciones SÍ se crean pero no sale
    // ningún carnet porque nadie tiene foto aprobada. Es el que un `if (!card_batch) error`
    // rompería diciendo que no se acreditó a nadie.
    sinCarnetPorFoto: false,
    // Los reportes pedidos, por su código. `settleAfter` es cuántas consultas tarda en
    // terminar; `fail` lo manda a FAILED con su motivo.
    reports: {},
    reportPayloads: [],
    roleCreates: [],
    // Los cuerpos que llegaron al PUT de un tipo: no basta con que la pantalla no falle, tiene
    // que MANDAR el nombre crudo y el rol de plataforma.
    roleUpdates: [],
    // La forma que `GET /card-batches/members` devuelve para alguien con dos generaciones.
    //
    // Por defecto UNA fila por persona, que es como backend lo describió («tus 11 personas»).
    // Pero está SIN confirmar —medido en dev el 2026-09-03: los tres lotes que hay tienen una
    // persona distinta cada uno, así que el caso no se puede observar allá— y la otra forma
    // rompía la tabla de dos maneras según el momento. Con esto en true se prueba esa forma.
    membersOnePerBatch: false,
    // Cuando la prueba lo enciende, el próximo GET del listado de lotes revienta con 500 y su
    // `x-trace-id`: es lo único con lo que backend puede encontrar ESE fallo, así que la
    // pantalla tiene que mostrarlo.
    failCardBatchesWithTrace: null,
    // Lo enciende la verificación para probar el paso de fase de la pantalla de entrada.
    twoPhases: false,
    // Lecturas de relleno para cruzar la frontera de página. Se llenan con `sembrarLecturas`
    // y sirven para una sola cosa: exigir que la auditoría pida por PÁGINAS y no por fila.
    validationLogsExtra: [],

    // Los movimientos de la auditoría, con la forma medida contra staging: `changed_at` en UTC
    // y sin sufijo de zona. Cinco casos: con comentario, sin él —ahí sale el cambio de estado,
    // y llega `DELETED`—, sin autor con nombre, y una acción que el front no conoce.
    eventAudit: [
      {
        action: 'DELIVERED',
        old_status: 'ACTIVE',
        new_status: 'ACTIVE',
        changed_at: '2026-09-14T19:31:36.580281',
        changed_by_code: 'c6e09ada-378d-430c-846c-a4081a87a538',
        changed_by_name: 'Juan Armero',
        comments: 'Entregado en el mostrador norte',
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000004',
        full_name: 'Laura Gómez Peña',
        document_number: '150001007033'
      },
      {
        action: 'CREATED',
        old_status: null,
        new_status: 'ACTIVE',
        changed_at: '2026-09-14T19:31:26.070035',
        changed_by_code: 'c6e09ada-378d-430c-846c-a4081a87a538',
        changed_by_name: 'Juan Armero',
        comments: null,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000001',
        full_name: 'Andrés Camilo Martínez Rodríguez',
        document_number: '150001002001'
      },
      {
        // Sin comentario A PROPÓSITO: es el caso en el que la pantalla enseña el CAMBIO DE
        // ESTADO, y `DELETED` es lo que manda el backend de verdad —no `INACTIVE`—. Andrés lo
        // vio crudo en pantalla, y el fixture no lo tenía.
        action: 'DEACTIVATED',
        old_status: 'ACTIVE',
        new_status: 'DELETED',
        changed_at: '2026-08-20T09:12:00.000000',
        changed_by_code: 'c6e09ada-378d-430c-846c-a4081a87a538',
        changed_by_name: 'Juan Armero',
        comments: null,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000003',
        full_name: 'Carlos Andrés Ruiz Mejía',
        document_number: '150001004092'
      },
      {
        // Sin `changed_by_name`: es de antes del 3 de septiembre. La pantalla cae al código,
        // que al menos identifica a quién fue.
        action: 'DEACTIVATED',
        old_status: 'ACTIVE',
        new_status: 'INACTIVE',
        changed_at: '2026-08-20T21:45:30.358362',
        changed_by_code: 'e0e0e0e0-1111-4000-8000-000000000099',
        comments: 'Se retiró del evento',
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000002',
        full_name: 'María Camila Arias Díaz',
        document_number: '150001003081'
      },
      {
        // Una acción que el front no tiene en su diccionario: tiene que salir humanizada y NO
        // desaparecer. Si backend estrena un verbo, es mejor verlo raro que no verlo.
        action: 'CARD_REPRINTED',
        old_status: 'ACTIVE',
        new_status: 'ACTIVE',
        changed_at: '2026-08-19T14:05:00.000000',
        changed_by_code: 'c6e09ada-378d-430c-846c-a4081a87a538',
        changed_by_name: 'Juan Armero',
        comments: null,
        accreditation_code: 'aaaa1111-0000-4000-8000-000000000004',
        full_name: 'Laura Gómez Peña',
        document_number: '150001007033'
      }
    ],
    // Rellena `cuantas` lecturas de UNA acreditación, repartidas de DOS en dos por día hacia
    // atrás. Es lo que hace falta para probar el historial: agrupa por día, así que con todas
    // en la misma fecha saldría un solo grupo y no habría nada que cortar. Dos por día para
    // que cien lecturas den cincuenta grupos y la lista pase de dos tandas de veinte.
    sembrarLecturasDe(code, cuantas) {
      state.validationLogsExtra = Array.from({ length: cuantas }, (_, indice) => ({
        id: 2000 + indice,
        accreditation_code: code,
        validator_user_code: SESSION.user_code,
        permission_id: 21,
        permission_name: indice % 3 ? 'Área V.I.P' : 'Área de prensa',
        validation_result: indice % 7 ? 'GRANTED' : 'DENIED',
        observation: null,
        denial_reason: indice % 7 ? null : 'Los usos del permiso se agotaron',
        used_count: 1,
        max_uses_per_person: 3,
        // Dos por día, hacia atrás desde el 20 de julio.
        scanned_at: new Date(
          Date.UTC(2026, 6, 20, 15, 0, 0) -
            Math.floor(indice / 2) * 86400000 -
            (indice % 2) * 3600000
        ).toISOString()
      }));
    },
    // Rellena `cuantas` lecturas más. Reusa los códigos de acreditación ya sembrados para que
    // la columna Persona siga resolviendo, y las fecha en julio para que no se cuelen por
    // delante de las cuatro de agosto que las comprobaciones nombran una por una.
    sembrarLecturas(cuantas) {
      state.validationLogsExtra = Array.from({ length: cuantas }, (_, indice) => ({
        id: 1000 + indice,
        accreditation_code:
          indice % 2
            ? 'aaaa1111-0000-4000-8000-000000000001'
            : 'aaaa1111-0000-4000-8000-000000000002',
        validator_user_code: SESSION.user_code,
        permission_id: 21,
        permission_name: 'Área V.I.P',
        validation_result: 'GRANTED',
        observation: null,
        denial_reason: null,
        used_count: 1,
        max_uses_per_person: 3,
        // Minuto a minuto hacia atrás desde el 31 de julio: fechas distintas y ordenables.
        scanned_at: new Date(
          Date.UTC(2026, 6, 31, 12, 0, 0) - indice * 60000
        ).toISOString()
      }));
    },
    // Los PDFs que el navegador pidió de verdad al bucket.
    bucket: [],
    // Todo lo que la aplicación pidió y este contrato no cubre.
    unexpected: []
  };

  // Los integrantes del lote que TODAVÍA salen impresos: el backend rehace el PDF sin las
  // hojas de las inactivadas, pero no borra su pertenencia al lote. Por eso el estado se
  // pregunta en `accreditations` —la única fuente de la verdad— en lugar de sacar al miembro
  // de la lista: sacándolo, una acreditación inactiva desaparecía del listado aplanado y la
  // columna «Estado» de esa pantalla no tenía cómo enseñar nunca una fila inactiva.
  const impresos = (batch) =>
    batch.members.filter(
      (member) =>
        state.accreditations.find(
          (row) => row.code === member.accreditation_code
        )?.status === 'ACTIVE'
    );

  // Las rutas se prueban en orden y la primera que coincide contesta.
  // El manejador de la emisión, compartido por los DOS endpoints que acreditan.
  //
  // `emit-with-card` acredita exactamente igual que `bulk` —el gateway reutiliza su request— y
  // encima encola el carnet. Copiar el manejador habría dejado dos juegos de validaciones que
  // se separan al primer cambio, así que la única diferencia es qué se contesta al final.
  const emitirEnLote =
    (conCarnet) =>
    ({ route }) => {
        const body = route.request().postDataJSON() ?? {};
        const items = body.items ?? [];

        state.bulkCreates.push({ ...body });

        if (items.length > 500) {
          return json(route, 422, {
            code: 'TOO_MANY_ITEMS',
            messages: [`Llegaron ${items.length} y el máximo es 500`]
          });
        }

        const activos = new Set(
          state.accreditations
            .filter((row) => row.status === 'ACTIVE')
            .map((row) => row.user_code)
        );

        // Por la UI no se puede llegar a `skipped`: las dos pantallas piden la lista con
        // `exclude_accredited=true`, así que a quien ya está acreditado no se le ofrece. Y sin
        // embargo el caso EXISTE —dos operadores acreditando a la vez, o el doble clic—, que
        // es media razón de ser de este endpoint. Con esto la prueba lo puede provocar.
        if (state.forzarSkipEnBulk) {
          activos.add(state.forzarSkipEnBulk);
        }

        // EXACTAMENTE UNA identidad por ítem. Mandar las dos —o ninguna— NO es un descarte:
        // rechaza el LOTE ENTERO con 400 diciendo qué fila está mal. Es a propósito, según
        // backend: un lote mal armado es un error de programación, no un éxito parcial.
        const malArmado = items.findIndex(
          (item) => !!item.user_code === !!item.mission_staff_code
        );

        if (malArmado >= 0) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: [
              `El ítem ${malArmado + 1} debe traer user_code o mission_staff_code, exactamente uno de los dos`
            ]
          });
        }

        const processed = [];
        const skipped = [];
        const vistos = new Set();

        for (const item of items) {
          // La identidad con la que vino, sea cual sea: es la que el backend devuelve en
          // `user_code` de `processed` y `skipped`, con `identity_type` al lado para poder
          // reconciliar la fila sin adivinar.
          const identidad = item.user_code ?? item.mission_staff_code;
          const deMision = !!item.mission_staff_code;
          const identityType = deMision ? 'MISSION_STAFF' : 'PLATFORM_USER';

          const persona = state.readyParticipants.find(
            (fila) => fila.user_code === identidad
          );

          // Los motivos del contrato, con los que el arnés puede provocar.
          if (vistos.has(identidad)) {
            skipped.push({
              user_code: identidad,
              identity_type: identityType,
              reason: 'Viene repetido en la solicitud'
            });
            continue;
          }

          vistos.add(identidad);

          if (activos.has(identidad)) {
            skipped.push({
              user_code: identidad,
              identity_type: identityType,
              reason: 'La persona ya tiene una acreditación activa en el evento'
            });
            continue;
          }

          if (!persona) {
            skipped.push({
              user_code: identidad,
              identity_type: identityType,
              // El personal de misión tiene SU motivo: decirle «no se encontró el usuario en
              // la plataforma» a quien nunca tuvo cuenta no explica nada.
              reason: deMision
                ? 'No se encontró personal de misión con ese código en el evento y la fase'
                : 'No se encontró el usuario en la plataforma'
            });
            continue;
          }

          const code = `acr-${state.accreditations.length + processed.length + 1}-0000-4000-8000-000000000000`;

          const fullName = `${persona.user_first_name} ${persona.user_first_lastname}`;

          processed.push({
            code,
            // La identidad CON LA QUE SE MANDÓ el ítem, no siempre un user_code.
            user_code: identidad,
            identity_type: identityType,
            // Del padrón, no del cliente: por eso el front ya no lo manda.
            full_name: fullName,
            role_code: item.role_code
          });

          // Se crean DE VERDAD en el estado, no solo en la respuesta: si no, reenviar la
          // misma lista volvería a acreditar a todos y la idempotencia —que es media razón
          // de ser de este endpoint— quedaría sin poder comprobarse.
          state.accreditations.push({
            code,
            event_id: SESSION.eventId,
            user_code: identidad,
            document_number: persona.document_number,
            full_name: fullName,
            department_name: persona.department_name ?? '',
            role_code: item.role_code,
            role_name: item.role_code,
            status: 'ACTIVE',
            permissions_total: 0,
            uses_consumed: 0,
            created_at: new Date().toISOString()
          });
        }

      if (!conCarnet) {
        return json(route, 200, {
          processed,
          skipped,
          total_requested: items.length,
          total_processed: processed.length
        });
      }

      // ── La mitad del carnet ────────────────────────────────────────────────
      //
      // Responde 202 y NO 201: acreditar terminó, el PDF se encola. El lote entra al MISMO
      // ciclo que los demás —`PROCESSING` y `settleAfter: 1`— para que la pantalla enseñe su
      // espera sin inventar otro mecanismo.
      //
      // `card_batch` va AUSENTE, no en null, cuando no hay lote: es lo que hace el `omitempty`
      // del puntero en el gateway de verdad, y es justo el caso que el front tiene que leer
      // con `??`. Dos motivos para que no lo haya, y significan lo contrario:
      //
      //   nadie quedó acreditado    → `processed` vacío
      //   nadie tiene foto aprobada → `processed` LLENO, y las acreditaciones se conservan
      const sinCarnet = !processed.length
        ? 'No se acreditó a nadie, así que no había carnets que generar'
        : state.sinCarnetPorFoto
          ? 'Ninguna acreditación tiene foto aprobada'
          : null;

      if (sinCarnet) {
        return json(route, 202, {
          accreditation: {
            processed,
            skipped,
            total_requested: items.length,
            total_processed: processed.length
          },
          card_batch_skipped_reason: sinCarnet
        });
      }

      state.batchSequence += 1;

      const numero = state.batchSequence;
      const batchCode = `lote000${numero}-0000-4000-8000-000000000000`;

      // Los que el despacho deja fuera son los ÚLTIMOS, y ya no entran al lote: eso es lo
      // que cambió en SUV2-2531. Salen con nombre por `skipped`, y los de foto siguen
      // además en `cards_without_photo` —lo dice el test de backend—.
      const omitidos = state.omitidosAlGenerar
        .map((motivo, indice) => {
          const quien = processed[processed.length - 1 - indice];

          return quien && { code: quien.code, reason: motivo, full_name: quien.full_name };
        })
        .filter(Boolean);
      const emitidos = processed.filter(
        (uno) => !omitidos.some((fuera) => fuera.code === uno.code)
      );
      const sinFoto = omitidos
        .filter((fuera) => fuera.reason === 'PHOTO_MISSING')
        .map((fuera) => fuera.code);

      state.cardBatches.unshift({
        batch_code: batchCode,
        batch_number: numero,
        event_code: SESSION.eventCode,
        kind: 'BULK',
        status: 'PROCESSING',
        total_cards: emitidos.length,
        total_chunks: 1,
        cards_without_photo: sinFoto,
        requested_by: SESSION.user_code,
        created_at: '2026-09-15T10:00:00.000Z',
        members: emitidos.map((uno) => ({
          accreditation_code: uno.code,
          full_name: uno.full_name
        })),
        uploads: [`pdf-${batchCode}-0`],
        settleAfter: 1,
        // Vacío A PROPÓSITO: backend NO persiste los omitidos del despacho, así que quien
        // entre al lote más tarde no los ve. Es el aviso de Javi, y es lo que obliga a que
        // la pantalla conserve los del 202.
        skipped: []
      });

      return json(route, 202, {
        accreditation: {
          processed,
          skipped,
          total_requested: items.length,
          total_processed: processed.length
        },
        // Snake_case, como lo manda el gateway de verdad —medido contra staging—, y NO el
        // camelCase que dicen su `.bru` y el handoff.
        card_batch: {
          batch_code: batchCode,
          batch_number: numero,
          total_cards: emitidos.length,
          total_chunks: 1,
          cards_without_photo: sinFoto,
          skipped: omitidos
        }
      });
    };

  const routes = [
    [
      'GET',
      /^\/v1\/auth\/me$/,
      ({ route }) =>
        json(route, 200, { ...SESSION, permissions: state.permissions })
    ],

    // La pantalla de entrada: el catálogo del módulo, con búsqueda de SERVIDOR. El mock
    // filtra igual que el contrato promete —parcial y sin distinguir tildes— porque si
    // devolviera todo, un buscador que no manda `search` pasaría por bueno.
    [
      'GET',
      /^\/v1\/accreditation\/events\/catalog$/,
      ({ route, url }) => {
        const search = url.searchParams.get('search');

        return json(
          route,
          200,
          // `paginado` y no `page1`: la pantalla pagina de a diez y devolviendo siempre la
          // primera no se podía reproducir el fallo de volver a media lista.
          paginado(
            state.eventCatalog.filter(
              (row) => !search || plain(row.name).includes(plain(search))
            ),
            url
          )
        );
      }
    ],
    [
      'GET',
      /^\/v1\/event\/[^/]+$/,
      ({ route }) =>
        json(route, 200, {
          event_code: SESSION.eventCode,
          name: SESSION.eventName,
          phases: [
            {
              code: SESSION.phaseCode,
              name: SESSION.phaseName,
              sequence_number: 1,
              start_date: SESSION.phaseStartDate,
              has_accreditation_process: true
            },
            // Una fase SIN acreditación, que no debe salir en la fila desplegada.
            {
              code: 'fase-sin-acreditacion',
              name: 'Fase Municipal',
              sequence_number: 9,
              start_date: '2026-07-01T05:00:00Z',
              has_accreditation_process: false
            },
            ...(state.twoPhases
              ? [
                  {
                    code: SESSION.secondPhaseCode,
                    name: SESSION.secondPhaseName,
                    sequence_number: 2,
                    start_date: SESSION.secondPhaseStartDate,
                    has_accreditation_process: true
                  }
                ]
              : [])
          ]
        })
    ],

    // El lookup del event_id. Ojo con la forma: viene envuelta en `data` pero SIN
    // `meta`. Y va por GET: un POST acá duplicaría la fila del evento.
    [
      'GET',
      /^\/v1\/accreditation\/events$/,
      ({ route, url }) => {
        const phaseCode = url.searchParams.get('phase_code');

        return json(route, 200, {
          data: [
            {
              // Cada fase del evento tiene su propio event_id: por eso hay que elegirla
              // y no se puede adivinar.
              id:
                phaseCode === SESSION.secondPhaseCode
                  ? SESSION.secondEventId
                  : SESSION.eventId,
              event_code: SESSION.eventCode,
              phase_code: phaseCode ?? SESSION.phaseCode
            }
          ]
        });
      }
    ],

    [
      'GET',
      /^\/v1\/accreditation\/permissions$/,
      ({ route }) => json(route, 200, page1(state.accessPermissions))
    ],
    [
      'GET',
      /^\/v1\/accreditation\/roles$/,
      ({ route, url }) => {
        const eventId = url.searchParams.get('event_id');

        return json(
          route,
          200,
          page1(
            state.roles.filter(
              (role) => !eventId || String(role.event_id) === eventId
            )
          )
        );
      }
    ],

    // Crear un tipo de acreditado, con las tres reglas que backend valida sobre la pareja
    // (categoría, función). Sin esto, la pantalla podría ofrecer una opción ocupada y el
    // fallo saldría en producción en lugar de acá.
    //
    // OJO con lo que cambió en SUV2-2228: la unicidad YA NO es del `platform_role` a solas
    // —esa era la regla que dejaba «Crear» apagado para siempre con dos tipos— sino de la
    // PAREJA. Los mensajes son los que backend verificó en staging el 2026-09-09.
    [
      'POST',
      /^\/v1\/accreditation\/roles$/,
      ({ route }) => {
        const body = route.request().postDataJSON() ?? {};
        const platformRole = body.platform_role;
        const platformSubrole = body.platform_subrole;

        if (
          platformRole &&
          !['ATHLETE', 'SUPPORT_PERSONNEL', 'MISSION_STAFF'].includes(
            platformRole
          )
        ) {
          return json(route, 400, {
            code: 'INVALID_PLATFORM_ROLE',
            messages: [`El rol de plataforma ${platformRole} no existe`]
          });
        }

        // La función sin la categoría no se puede resolver: el backend no sabría de qué
        // categoría es esa función.
        if (platformSubrole && !platformRole) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: [
              'platform_subrole exige platform_role: indique la categoría'
            ]
          });
        }

        const ordenMal = errorDeOrden(body.permissions);

        if (ordenMal) {
          return json(route, 400, ordenMal);
        }

        const tomado = state.roles.find(
          (role) =>
            role.platform_role &&
            role.platform_role === platformRole &&
            (role.platform_subrole ?? null) === (platformSubrole ?? null) &&
            role.event_id === body.event_id
        );

        if (tomado) {
          return json(route, 409, {
            code: 'PLATFORM_ROLE_TAKEN',
            messages: [
              platformSubrole
                ? `La función '${platformSubrole}' de '${platformRole}' ya está asignada al tipo '${tomado.role_code}' en el evento ${body.event_id}`
                : `El evento ya tiene un tipo con ese rol de plataforma: ${tomado.role_name}`
            ]
          });
        }

        const creado = {
          code: `tipo-${state.roles.length + 1}-0000-4000-8000-000000000000`,
          id: 100 + state.roles.length,
          role_name: body.role_name,
          role_code: body.role_code,
          ...(platformRole ? { platform_role: platformRole } : {}),
          ...(platformSubrole ? { platform_subrole: platformSubrole } : {}),
          event_id: body.event_id,
          is_active: true,
          access_deadline: body.access_deadline ?? null,
          permissions: (body.permissions ?? []).map((permission) => ({
            permission_id: permission.permission_id,
            permission_name:
              state.accessPermissions.find(
                (item) => item.id === permission.permission_id
              )?.name ?? `Permiso ${permission.permission_id}`,
            has_limit: permission.max_uses_per_person !== null,
            max_uses_per_person: permission.max_uses_per_person ?? null,
            order: permission.order
          }))
        };

        state.roles.push(creado);
        // Se guarda lo que el POST llevaba, para poder afirmar el `role_code` que se manda.
        state.roleCreates.push({ ...body });

        return json(route, 201, creado);
      }
    ],

    // El PUT reemplaza el rol completo. Acá es la vía para ponerle el `platform_role` a un tipo
    // que se creó sin él, que en staging son todos.
    [
      'PUT',
      /^\/v1\/accreditation\/roles\/[^/]+$/,
      ({ route, path }) => {
        const code = path.split('/')[4];
        const body = route.request().postDataJSON() ?? {};
        const role = state.roles.find((item) => item.code === code);

        if (!role) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: [`No se encontró el tipo ${code}`]
          });
        }

        const ordenMal = errorDeOrden(body.permissions);

        // Antes que la captura: un PUT que el backend rechaza no llegó a guardar nada, así
        // que tampoco puede contar como enviado en `roleUpdates`.
        if (ordenMal) {
          return json(route, 400, ordenMal);
        }

        state.roleUpdates.push({ code, ...body });

        Object.assign(role, {
          role_name: body.role_name,
          ...(body.platform_role ? { platform_role: body.platform_role } : {}),
          ...(body.platform_subrole
            ? { platform_subrole: body.platform_subrole }
            : {}),
          access_deadline: body.access_deadline ?? role.access_deadline,
          // El PUT REEMPLAZA la asignación de permisos, no la suma: el rol queda con la lista
          // que llegó, y cada uno con el tope que traiga.
          permissions: (body.permissions ?? []).map((permiso) => {
            const catalogo = state.accessPermissions.find(
              (item) => item.id === permiso.permission_id
            );

            return {
              permission_id: permiso.permission_id,
              permission_name:
                catalogo?.name ?? `Permiso ${permiso.permission_id}`,
              has_limit: !!catalogo?.has_limit,
              max_uses_per_person: permiso.max_uses_per_person ?? null,
              order: permiso.order
            };
          })
        });

        return json(route, 200, role);
      }
    ],

    // Como el gateway DE VERDAD: filtra por event_id y por search, y descarta
    // `role_code` y `status` si se los mandan.
    [
      'GET',
      /^\/v1\/accreditation\/accreditations$/,
      ({ route, url }) => {
        const eventId = url.searchParams.get('event_id');
        const search = url.searchParams.get('search');

        // Los transversales, como el gateway de verdad: en CSV y recortando ANTES de
        // paginar, así que el `total` baja. Medido contra staging el 2026-09-10; es al revés
        // que en el listado de acreditables, donde se aplican sobre la página ya traída.
        //
        // `municipality_codes` y `role_code` NO están a propósito: el backend los acepta y
        // los ignora, y la pantalla no los ofrece por eso. Si algún día los honra, esto se
        // suma y el check de abajo deja de valer.
        const codigos = (nombre) =>
          (url.searchParams.get(nombre) ?? '')
            .split(',')
            .map((uno) => uno.trim())
            .filter(Boolean);

        const departamentos = codigos('department_codes');
        const municipios = codigos('municipality_codes');
        const deportes = codigos('sport_codes');
        const categorias = codigos('category_codes');
        const sexos = codigos('sex_codes');
        // En singular, que es el alias que dejó backend; y sin distinguir mayúsculas.
        const roles = codigos('role_code')
          .concat(codigos('role_codes'))
          .map((uno) => uno.toUpperCase());

        const rows = state.accreditations
          .filter((row) => !eventId || String(row.event_id) === eventId)
          .filter(
            (row) =>
              !search ||
              row.full_name.toLowerCase().includes(search.toLowerCase()) ||
              row.document_number.includes(search)
          )
          .filter(
            (row) =>
              !departamentos.length ||
              departamentos.includes(row.department_code)
          )
          .filter(
            (row) =>
              !deportes.length ||
              (row.sport_codes ?? []).some((uno) => deportes.includes(uno))
          )
          .filter(
            (row) => !municipios.length || municipios.includes(row.municipality_code)
          )
          .filter(
            (row) => !categorias.length || categorias.includes(row.category_code)
          )
          .filter((row) => !sexos.length || sexos.includes(row.sex_code))
          // El de rol NO pasa por orc: es el único que alcanza al personal de misión, y por
          // eso es la salida que ofrecen los avisos de la pantalla.
          .filter(
            (row) =>
              !roles.length || roles.includes((row.role_code ?? '').toUpperCase())
          )
          // El LISTADO manda `delivery_status` y NO manda `delivered_at`; el detalle hace
          // exactamente lo contrario. Medido en staging el 2026-09-08, y no es un detalle:
          // el arnés mandaba las dos cosas por el mismo camino y por eso no cazó que la
          // pantalla derivaba la entrega de una fecha que ya no llega.
          .map(({ delivered, orphan: _huerfana, ...fila }) => ({
            ...fila,
            delivery_status: delivered ? 'DELIVERED' : 'PENDING'
          }));

        return json(route, 200, {
          ...paginado(rows, url),
          // El summary solo aparece cuando se pide con event_id.
          ...(eventId
            ? {
                summary: {
                  total: rows.length,
                  by_status: { ACTIVE: rows.length }
                }
              }
            : {})
        });
      }
    ],

    // ── Emisión individual ───────────────────────────────────────────────────
    // No existía en el arnés, y por eso el camino de UNA persona nunca se probó acá: solo
    // estaba el masivo. Ahora hace falta de verdad, porque es el ÚNICO que acepta al personal
    // de misión.
    //
    // Las tres validaciones son las que backend verificó en staging el 2026-09-09.
    [
      'POST',
      /^\/v1\/accreditation\/accreditations$/,
      ({ route }) => {
        const body = route.request().postDataJSON() ?? {};
        const tieneUsuario = !!body.user_code;
        const tieneMision = !!body.mission_staff_code;

        // Exactamente una identidad. Las dos —o ninguna— dan el mismo 400: con las dos, el
        // servicio tendría que elegir cuál manda; sin ninguna, la acreditación nacería sin
        // persona.
        if (tieneUsuario === tieneMision) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: [
              'Envíe user_code o mission_staff_code, exactamente uno de los dos'
            ]
          });
        }

        const identidad = body.user_code ?? body.mission_staff_code;
        const persona = state.readyParticipants.find(
          (item) => item.user_code === identidad
        );

        if (tieneMision && !persona) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: [
              `No se encontró personal de misión ${identidad} en el evento y la fase indicados`
            ]
          });
        }

        state.singleCreates.push({ ...body });

        const creada = {
          code: `acr-${state.accreditations.length + 1}-0000-4000-8000-000000000000`,
          event_id: body.event_id,
          user_code: body.user_code ?? null,
          role_code: body.role_code,
          role_name:
            state.roles.find((role) => role.role_code === body.role_code)
              ?.role_name ?? body.role_code,
          status: 'ACTIVE',
          qr_public_token: `qr-${identidad}`,
          permissions: [],
          created_at: new Date().toISOString()
        };

        return json(route, 201, creada);
      }
    ],

    // ── Emisión masiva ───────────────────────────────────────────────────────
    // El endpoint que reemplaza al bucle de un POST por persona. Como el de verdad: resuelve
    // la persona por su `user_code` —el front ya no manda nombre ni documento—, es atómico y
    // es idempotente: quien ya tenga una acreditación activa sale por `skipped` con su motivo
    // en español, no por error.
    [
      'POST',
      /^\/v1\/accreditation\/accreditations\/bulk$/,
      emitirEnLote(false)
    ],

    // Acreditar Y encolar el carnet en una sola llamada (SUV2-2382). Mismas validaciones que
    // arriba, por construcción: es el mismo manejador.
    [
      'POST',
      /^\/v1\/accreditation\/accreditations\/emit-with-card$/,
      emitirEnLote(true)
    ],

    // ── El reporte de acreditados ────────────────────────────────────────────
    // Pedirlo devuelve 202 y un código; el archivo no existe todavía.
    [
      'POST',
      /^\/v1\/accreditation\/reports$/,
      ({ route }) => {
        const body = route.request().postDataJSON() ?? {};
        const code = `rep-${Object.keys(state.reports).length + 1}-0000-4000-8000-000000000000`;

        // El cuerpo ENTERO, para poder afirmar qué lleva y qué no: la URL no sirve —esto es
        // un POST y los filtros irían en el payload—.
        state.reportPayloads.push({ ...body });

        state.reports[code] = {
          consultas: 0,
          search: body.search ?? null,
          // Igual que los lotes de carnets: la primera consulta lo da en curso y la segunda
          // terminado, para que la pantalla enseñe su espera sin que la prueba dependa de un
          // reloj.
          settleAfter: state.reportSettleAfter ?? 1,
          fail: !!state.reportFails
        };

        return json(route, 202, { report_code: code, status: 'PENDING' });
      }
    ],

    // El estado. Los cuatro punteros viajan SIEMPRE, en null mientras procesa: null es
    // «todavía no», no «el campo se fue». El contrato lo declara así citando lo que nos pasó
    // con `delivered_at`.
    [
      'GET',
      /^\/v1\/accreditation\/reports\/[^/]+$/,
      ({ path, route }) => {
        const code = path.split('/').pop();
        const reporte = state.reports[code];

        if (!reporte) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: ['No se encontró el reporte']
          });
        }

        reporte.consultas += 1;

        const terminado = reporte.consultas > reporte.settleAfter;
        const fallo = terminado && reporte.fail;

        return json(route, 200, {
          report_code: code,
          event_id: SESSION.eventId,
          event_code: SESSION.eventCode,
          status: fallo
            ? 'FAILED'
            : terminado
              ? 'COMPLETED'
              : reporte.consultas === 1
                ? 'PENDING'
                : 'PROCESSING',
          total_rows: terminado && !fallo ? state.accreditations.length : null,
          upload_id: terminado && !fallo ? 'upload-reporte-0001' : null,
          file_name:
            terminado && !fallo
              ? 'reporte-de-acreditacion-qa-0709.xlsx'
              : null,
          error_detail: fallo
            ? 'El reporte no se pudo generar: el evento no tiene acreditaciones.'
            : null,
          created_at: '2026-09-08T10:00:00',
          updated_at: '2026-09-08T10:00:05'
        });
      }
    ],

    // Certificados de participación: la configuración del evento y los deportes que tiene.
    //
    // Faltaban las dos, así que «Configuración de certificados» no llegaba a pintar sus
    // campos de fecha y el arnés no podía verla. Contrato en commons/data/models/
    // certificate.model.ts, medido contra stg el 2026-09-07.
    //
    // `sport_code: null` es la fecha general del evento; las demás son por deporte.
    // Guardar la configuración. Devuelve lo guardado, como el gateway de verdad.
    [
      'PUT',
      /^\/v1\/accreditation\/events\/[^/]+\/certificates\/config$/,
      ({ route }) => {
        const body = route.request().postDataJSON() ?? {};

        return json(route, 200, {
          code: 'cfg-0001',
          event_code: SESSION.eventCode,
          phase_code: body.phase_code ?? SESSION.phaseCode,
          template_code: body.template_code ?? 'default',
          enabled: body.enabled ?? true,
          sports: body.sports ?? []
        });
      }
    ],

    [
      'GET',
      /^\/v1\/accreditation\/events\/[^/]+\/certificates\/config$/,
      ({ route }) =>
        json(route, 200, {
          code: 'cfg-0001',
          event_code: SESSION.eventCode,
          phase_code: SESSION.phaseCode,
          template_code: 'DEFAULT',
          enabled: true,
          sports: [{ sport_code: null, delivery_date: '', enabled: true }]
        })
    ],

    [
      'GET',
      // Ojo: los deportes del evento NO cuelgan del prefijo de acreditación —salen de
      // event-rules—, igual que `ready-for-accreditation` sale de documentation-ms.
      /^\/v1\/event-rules\/[^/]+\/sports$/,
      ({ route }) =>
        json(route, 200, [
          { sport_code: 'ATL', sport_name: 'Atletismo', sport_type: 'INDIVIDUAL' },
          { sport_code: 'BAL3', sport_name: 'Baloncesto 3x3', sport_type: 'CONJUNTO' }
        ])
    ],

    // El diccionario de roles del evento. Con la forma medida contra staging el 2026-09-08:
    // un array PELADO de `{code, name}`, no el sobre `{data, meta}` del resto del módulo.
    //
    // Ojo con la ruta: es `/catalogs/:type` en PLURAL, el diccionario transversal. El grupo
    // protegido `/catalog/*` en singular responde 404 en staging entero —comprobado también
    // con `genders`—, así que el que sirve es este.
    [
      'GET',
      /^\/v1\/catalogs\/event-role$/,
      ({ route }) =>
        json(route, 200, [
          { code: 'VOLUNTEER', name: 'Voluntario' },
          { code: 'SPECIAL_GUEST', name: 'Invitado Especial' },
          { code: 'LOGISTICS_COORDINATOR', name: 'Coordinador de Logística' },
          { code: 'MED', name: 'Médico' },
          { code: 'PER', name: 'Periodista' },
          { code: 'JMI', name: 'Jefe de Misión' },
          { code: 'AJM', name: 'Apoyo de Jefe de Misión' },
          { code: 'FIS', name: 'Fisioterapeuta' },
          // Los DOS que este diccionario trae y NO son de misión. Backend comparó los 30 de
          // `EVENT_ROLE` contra la tabla `mission_staff_role` de orc el 2026-09-09: coinciden
          // en 28 y sobran estos. Están acá para que se pueda comprobar que se filtran; sin
          // ellos, el check pasaría sin haber filtrado nada.
          { code: 'AREA_COORDINATOR', name: 'Coordinador de Área' },
          { code: 'DIGITIZER', name: 'Digitador' }
        ])
    ],

    // Las categorías deportivas, para el filtro del listado de acreditados. Las seis de
    // staging tal cual, medidas el 2026-09-10.
    [
      'GET',
      /^\/v1\/catalogs\/sport-category$/,
      ({ route }) =>
        json(route, 200, [
          { code: 'INI', name: 'Iniciación' },
          { code: 'PRE_INF', name: 'Pre Infantil' },
          { code: 'INF', name: 'Infantil' },
          { code: 'PRE_JUV', name: 'Pre Juvenil' },
          { code: 'JUV', name: 'Juvenil' },
          { code: 'UNICA', name: 'Única' }
        ])
    ],

    // La taxonomía de roles, sembrada con la captura real de staging del 2026-09-23. El
    // `configured_type` sale del ESTADO: crear un tipo con una función la saca del
    // desplegable en la siguiente apertura, que es lo que evita el 409.
    [
      'GET',
      /^\/v1\/accreditation\/role-catalog/,
      ({ route, url }) => {
        if (state.fallaElCatalogoDeRoles || state.fallosDelCatalogoDeRoles > 0) {
          state.fallosDelCatalogoDeRoles = Math.max(
            0,
            state.fallosDelCatalogoDeRoles - 1
          );

          return json(route, 500, {
            code: 'INTERNAL_ERROR',
            messages: ['No se pudo resolver la taxonomía de roles']
          });
        }

        const eventId = Number(url.searchParams.get('event_id')) || null;

        // El tipo del evento que ocupa esa función, con la forma exacta del contrato.
        const ocupante = (subrol) => {
          const tipo = state.roles.find(
            (rol) => rol.platform_subrole === subrol && rol.event_id === eventId
          );

          return tipo
            ? {
                code: tipo.code,
                role_code: tipo.role_code,
                role_name: tipo.role_name,
                is_active: tipo.is_active !== false
              }
            : null;
        };

        const funcion = (code, name, enrolled = null) => ({
          code,
          name,
          event_role_codes: [code],
          accredit_role_code: code,
          enrolled_count: enrolled,
          configured_type: ocupante(code)
        });

        // Medido: el tipo por defecto de la familia llega null en las cuatro, porque la
        // pantalla no sabía crearlo. Se deriva del estado para que deje de ser null cuando
        // el arnés cree uno sin función.
        const porDefecto = (familia) => {
          const tipo = state.roles.find(
            (rol) =>
              rol.platform_role === familia &&
              !rol.platform_subrole &&
              rol.event_id === eventId
          );

          return tipo
            ? {
                code: tipo.code,
                role_code: tipo.role_code,
                role_name: tipo.role_name,
                is_active: tipo.is_active !== false
              }
            : null;
        };

        return json(route, 200, {
          event_id: eventId,
          families: [
            {
              code: 'ATHLETE',
              name: 'Deportista',
              identity_type: 'PLATFORM_USER',
              allows_functions: false,
              functions_source: 'NONE',
              default_type: porDefecto('ATHLETE'),
              functions: []
            },
            {
              code: 'SUPPORT_PERSONNEL',
              name: 'Personal de apoyo',
              identity_type: 'PLATFORM_USER',
              allows_functions: true,
              functions_source: 'CATALOG',
              default_type: porDefecto('SUPPORT_PERSONNEL'),
              functions: [
                funcion('ADI', 'Auxiliar Discapacidad'),
                funcion('DAS', 'Docente/Asistente'),
                funcion('ENT', 'Docente/Entrenador')
              ]
            },
            {
              // Del catálogo de orc y COMPLETO: un evento se parametriza antes de que se
              // inscriba nadie, y `enrolled_count` distingue sin recortar la lista. NO del
              // diccionario `event-role`, que trae dos que no son de misión.
              code: 'MISSION_STAFF',
              name: 'Personal de misión',
              identity_type: 'MISSION_STAFF',
              allows_functions: true,
              functions_source: 'EVENT_ENROLLMENT',
              default_type: porDefecto('MISSION_STAFF'),
              functions: [
                funcion('VOLUNTEER', 'Voluntario', 0),
                funcion('SPECIAL_GUEST', 'Invitado Especial', 0),
                funcion('LOGISTICS_COORDINATOR', 'Coordinador de Logística', 0),
                funcion('MED', 'Médico', 1),
                funcion('PER', 'Periodista', 1),
                funcion('JMI', 'Jefe de Misión', 4),
                funcion('AJM', 'Apoyo de Jefe de Misión', 0),
                funcion('FIS', 'Fisioterapeuta', 0),
                funcion('PER_SEDE', 'Periodista de Sede', 1)
              ]
            },
            {
              code: 'NAOWEE_STAFF',
              name: 'Personal Naowee',
              identity_type: 'PLATFORM_USER',
              allows_functions: true,
              functions_source: 'FIXED',
              default_type: porDefecto('NAOWEE_STAFF'),
              functions: [
                funcion('NAOWEE_COORDINATOR', 'Coordinador Naowee'),
                funcion('NAOWEE_SUPPORT', 'Personal de apoyo Naowee')
              ]
            }
          ]
        });
      }
    ],

    // Las funciones de MISIÓN del evento. Solo las de misión: las del apoyo son catálogo y
    // salen por `/catalogs/support-personnel-role`, no por acá —lo dice el contrato del
    // gateway y lo confirmó backend—.
    //
    // `configured` sale del estado y no de una lista fija: así, crear un tipo con una función
    // la saca del desplegable en la siguiente apertura, que es justo lo que evita el 409.
    [
      'GET',
      /^\/v1\/accreditation\/roles\/functions/,
      ({ route, url }) => {
        const eventId = Number(url.searchParams.get('event_id'));

        if (!eventId) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: ['event_id debe ser un entero positivo']
          });
        }

        const funciones = [
          { code: 'JMI', name: 'Jefe de Misión' },
          { code: 'AJM', name: 'Apoyo de Jefe de Misión' },
          { code: 'FIS', name: 'Fisioterapeuta' }
        ];

        return json(route, 200, {
          event_id: eventId,
          functions: funciones.map((funcion) => {
            const dueno = state.roles.find(
              (role) =>
                role.event_id === eventId &&
                role.platform_subrole === funcion.code
            );

            return {
              platform_role: 'MISSION_STAFF',
              code: funcion.code,
              name: funcion.name,
              configured: !!dueno,
              ...(dueno ? { role_code: dueno.role_code } : {})
            };
          })
        });
      }
    ],

    // El OTRO medio del desplegable de tipos: el personal de apoyo de las delegaciones, que
    // no sale en `event-role`. Estos tres son los de staging tal cual —el diccionario entero,
    // que es corto—, medidos el 2026-09-08. Ninguno de sus códigos choca con los de arriba.
    [
      'GET',
      /^\/v1\/catalogs\/support-personnel-role$/,
      ({ route }) =>
        json(route, 200, [
          { code: 'ADI', name: 'Auxiliar Discapacidad' },
          { code: 'DAS', name: 'Docente/Asistente' },
          { code: 'ENT', name: 'Docente/Entrenador' }
        ])
    ],

    // Las ZONAS del país y el cruce zona→departamento, los dos del grupo de localización.
    //
    // Las ocho de staging tal cual, medidas el 2026-09-15. Ojo con la clave del departamento,
    // que acá estuvo MAL y por eso el arnés no cazó nada: esto devolvía `regionCode` en
    // camelCase «como staging», y staging no lo hace. Medido el 2026-09-16:
    //
    //   [{"code":"05","name":"ANTIOQUIA","region_code":"3"}, …]
    //
    // O sea `region_code`, en snake_case como el resto del gateway. Con el camelCase de antes,
    // un front que leyera la clave de verdad se quedaba sin cruce —y al revés: el front leía
    // `regionCode`, el mock se lo daba y la cascada pasaba en verde mientras en staging el
    // desplegable de delegación se vaciaba al elegir zona. Un mock más generoso que el backend
    // da por bueno lo que en producción no funciona, que es justo lo que pasó acá.
    [
      'GET',
      /^\/v1\/locations\/regions$/,
      ({ route }) =>
        json(
          route,
          200,
          Object.entries(REGION_NAMES).map(([code, name]) => ({ code, name }))
        )
    ],

    [
      'GET',
      /^\/v1\/locations\/departments$/,
      ({ route }) =>
        json(
          route,
          200,
          Object.entries(REGION_DEPARTMENTS).flatMap(([region_code, deptos]) =>
            deptos.map((code) => ({
              code,
              name: DEPARTMENT_NAMES[code] ?? code,
              region_code
            }))
          )
        )
    ],

    // Las facetas del evento: los valores que de verdad hay para filtrar, con su conteo.
    //
    // La pantalla de acreditables las pide para llenar sus desplegables en vez de deducirlos
    // de la primera página del listado. Faltaba en el mock, así que la comprobación «no pidió
    // nada fuera del contrato» salía en rojo en tres bloques —y la que salía en rojo era la
    // aplicación, que estaba haciendo lo correcto—.
    //
    // Se derivan de `readyParticipants`, que es lo que el fixture tiene. Ojo con el alcance,
    // que es el del endpoint de verdad: las facetas salen de los INSCRITOS del evento, no de
    // quiénes están listos, así que un valor puede no devolver filas en la pestaña activa.
    // Deporte y municipio van VACÍOS porque ninguna fila del fixture los lleva; inventarlos
    // llenaría un desplegable con opciones que no casan con nadie.
    [
      'GET',
      /^\/v1\/event\/[^/]+\/participants\/facets$/,
      ({ route }) => {
        // Las tres facetas se cuentan igual: el valor que de verdad aparece en las filas, con
        // cuántas lo tienen. Deportes y municipios devolvían `[]`, así que sus desplegables
        // salían vacíos y no se podía comprobar que filtran —el de deporte se quedó sin
        // opciones justo cuando hizo falta—.
        const contar = (codigo, nombre) => {
          const porCodigo = new Map();

          for (const fila of state.readyParticipants) {
            for (const valor of codigo(fila)) {
              if (!valor) {
                continue;
              }

              const previo = porCodigo.get(valor);

              porCodigo.set(valor, {
                code: valor,
                name: previo?.name ?? nombre(fila, valor),
                total: (previo?.total ?? 0) + 1
              });
            }
          }

          return [...porCodigo.values()].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        };

        return json(route, 200, {
          event_code: SESSION.eventCode,
          sports: contar(
            (fila) => fila.sport_codes ?? [],
            (fila, valor) =>
              fila.sport_names?.[(fila.sport_codes ?? []).indexOf(valor)] ??
              valor
          ),
          departments: contar(
            (fila) => [fila.department_code],
            (fila) => fila.department_name ?? fila.department_code
          ),
          municipalities: contar(
            (fila) => [fila.municipality_code],
            (fila) => fila.municipality_name ?? fila.municipality_code
          )
        });
      }
    ],

    // El mostrador. Ojo con dos cosas del contrato, las dos medidas por backend: el sobre
    // NO es el {data, meta} del módulo —los totales van sueltos y el tamaño se llama
    // `size`— y `exclude_accredited` filtra DENTRO de la página, así que la página puede
    // venir corta sin que `total` baje.
    [
      'GET',
      /\/participants\/ready-for-accreditation$/,
      ({ route, url }) => {
        const params = url.searchParams;
        const exclude = params.get('exclude_accredited') === 'true';
        // La vista INVERSA, que llegó el 2026-09-16: solo los que ya están acreditados. Es la
        // mitad que faltaba para que «Gestión de acreditables» pudiera contarlo todo.
        const only = params.get('only_accredited') === 'true';
        const search = params.get('search');
        const userRole = params.get('user_role');
        // El plural, que reemplaza al singular y es el único que sabe nombrar al personal de
        // misión. CSV. El singular sigue aceptándose porque el modal de acreditar lo usa.
        const roles = params.get('roles');
        const subroles = params.get('subrole_codes');
        const readiness = params.get('readiness') ?? 'READY';
        const size = Number(params.get('limit') ?? 10);
        const pageNumber = Number(params.get('page') ?? 1);

        // Como el gateway de verdad: un valor que no sea uno de los dos es 400, no un READY
        // silencioso. Medido en dev, con este mismo mensaje.
        if (!['READY', 'PENDING'].includes(readiness)) {
          return json(route, 400, {
            code: 'VALIDATION_ERROR',
            messages: ['readiness must be one of: READY, PENDING']
          });
        }

        // Los dos a la vez son un 400 y con razón: no dejarían a nadie. La pantalla manda uno
        // o ninguno —su desplegable tiene un valor a la vez—, así que este 400 no se puede
        // provocar desde la UI: está para que, si alguien cablea los dos, salga rojo acá en
        // vez de devolver una lista vacía que se leería como «no hay nadie».
        if (exclude && only) {
          return json(route, 400, {
            code: 'VALIDATION_ERROR',
            messages: [
              'exclude_accredited y only_accredited no se pueden enviar juntos'
            ]
          });
        }

        // Quién está acreditado y con qué. Se DERIVA de `state.accreditations` en vez de
        // sembrarse en las filas: los bloques acreditan gente durante la corrida, y con un
        // fixture fijo una recarga después de acreditar seguiría diciendo «Sin acreditar».
        //
        // La regla es la que backend garantiza y que está medida: una sola por identidad, la
        // ACTIVE si existe y, si no, la INACTIVE más reciente.
        const suyas = (row) =>
          state.accreditations.filter(
            (one) =>
              one.user_code === row.user_code ||
              (!!one.document_number &&
                one.document_number === row.document_number)
          );

        const laQueMandaDe = (row) => {
          const candidatas = suyas(row);

          return (
            candidatas.find((one) => one.status === 'ACTIVE') ??
            [...candidatas].sort((a, b) =>
              String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
            )[0]
          );
        };

        // Los dos conteos con los MISMOS filtros que la lista, sea cual sea la `readiness` pedida:
        // es lo que devuelve el gateway desde el 2026-10-21 y lo que borró la sonda `limit=1`.
        const conjuntoDe = (nivel) => {
        // `readiness` y `user_role` sí recortan el conjunto entero: son del propio
        // documentation-ms.
        const all = state.readyParticipants
          .filter((row) =>
            nivel === 'PENDING'
              ? row.overall_status !== 'APPROVED'
              : row.overall_status === 'APPROVED'
          )
          .filter((row) => !userRole || row.user_role === userRole)
          // `roles` es la CATEGORÍA, no el rol crudo: una fila de misión llega con su función
          // (JMI, MED…) en `user_role`, no con «MISSION_STAFF». Por eso el personal de misión
          // se reconoce por `identity_type` y el resto por `user_role`.
          .filter((row) => {
            if (!roles) {
              return true;
            }

            const pedidos = roles.split(',');
            const categoria =
              row.identity_type === 'MISSION_STAFF'
                ? 'MISSION_STAFF'
                : row.user_role;

            return pedidos.includes(categoria);
          })
          // La FUNCIÓN concreta. Del apoyo sale de `support_role_codes`; la del personal de
          // misión ES su `user_role`. Un deportista no tiene ninguna, así que este filtro lo
          // deja fuera por construcción, igual que el de verdad.
          .filter((row) => {
            if (!subroles) {
              return true;
            }

            const pedidos = subroles.split(',');
            const suyas =
              row.identity_type === 'MISSION_STAFF'
                ? [row.user_role]
                : (row.support_role_codes ?? []);

            return suyas.some((one) => pedidos.includes(one));
          })
          .filter(
            (row) =>
              !search ||
              plain(
                `${row.user_first_name} ${row.user_first_lastname}`
              ).includes(plain(search)) ||
              (row.document_number ?? '').includes(search)
          );

        // Los transversales recortan el CONJUNTO ENTERO y el total baja con ellos.
        //
        // Antes esto imitaba el camino viejo —recorte sobre la página ya traída, total
        // intacto—, que es lo que estaba medido en dev en su momento. Ya no: medido contra
        // staging el 2026-09-15, `limit=10&department_codes=76` sobre una fase de 62 devuelve
        // `total=14` con 10 filas. El gateway recorta antes de paginar.
        //
        // La función es la MISMA que usa `card-batches/members`: ver `recorteTransversal`.
        let todos = recorteTransversal(all, params);

        // `exclude_accredited` resta SOLO las ACTIVE: las INACTIVE se quedan, y marcadas. Va
        // sobre el conjunto entero, no sobre la página, por lo mismo que los transversales.
        if (exclude) {
          todos = todos.filter(
            (row) => laQueMandaDe(row)?.status !== 'ACTIVE'
          );
        }

        // Y su reverso exacto: los que SÍ tienen una activa. Los dos parten el conjunto sin
        // solaparse —medido en staging sobre la fase Regionales: 23 en la unión, 15 con
        // `only_accredited` y 8 con `exclude_accredited`—, así que la regla es la misma mirada
        // del revés y no otra lista.
        if (only) {
          todos = todos.filter(
            (row) => laQueMandaDe(row)?.status === 'ACTIVE'
          );
        }

          return todos;
        };

        const todos = conjuntoDe(readiness);
        const counts = {
          READY: conjuntoDe('READY').length,
          PENDING: conjuntoDe('PENDING').length
        };

        const desde = (pageNumber - 1) * size;

        const page = todos.slice(desde, desde + size).map((row) => {
          const acreditacion = laQueMandaDe(row);

          // Sin acreditación las tres claves NO van: llegan ausentes, no en null. Es lo que
          // está medido y lo que ejercita los `??` de la factory.
          if (!acreditacion) {
            return row;
          }

          return {
            ...row,
            accreditation_code: acreditacion.code,
            accreditation_status: acreditacion.status,
            // El estado interno del fixture es `delivered` (booleano), el mismo que el
            // listado traduce a `delivery_status`. Y lo mueve «Entrega masiva» durante la
            // corrida, así que entregar y volver acá enseña la fila ya entregada.
            delivery_status: acreditacion.delivered ? 'DELIVERED' : 'PENDING'
          };
        });

        return json(route, 200, {
          event_code: SESSION.eventCode,
          phase_code: SESSION.phaseCode,
          phase_name: SESSION.phaseName,
          participants: page,
          // El total cuenta el conjunto YA recortado por los filtros, que es lo que hace el
          // gateway de verdad.
          total: todos.length,
          counts,
          page: pageNumber,
          size
        });
      }
    ],

    // La auditoría, antes del detalle: las rutas se prueban en orden y `{code}` a secas se
    // ancla con `$`, así que no se traga este sufijo, pero el orden lo deja explícito.
    /**
     * La auditoría TRANSVERSAL del evento. Exige `event_code` Y `phase_code`, los dos uuid y
     * los dos obligatorios, y responde 400 si falta cualquiera —o si le mandan el viejo
     * `event_id`—. Copiado de staging, medido el 2026-09-15.
     *
     * La validación no es decorado: el `event_id` del resto del módulo identifica el par
     * evento+fase, así que era fácil llamar a este endpoint con él y llevarse la auditoría de
     * una sola fase sin enterarse. Si el front vuelve a mandarlo, acá revienta.
     */
    [
      'GET',
      /^\/v1\/accreditation\/accreditations\/audit$/,
      ({ route, url }) => {
        const eventCode = url.searchParams.get('event_code');
        const phaseCode = url.searchParams.get('phase_code');

        if (!eventCode) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: [
              'El parámetro event_code es obligatorio y debe ser un UUID válido'
            ]
          });
        }

        if (!phaseCode) {
          return json(route, 400, {
            code: 'BAD_REQUEST',
            messages: [
              'El parámetro phase_code es obligatorio y debe ser un UUID válido'
            ]
          });
        }

        if (eventCode !== SESSION.eventCode) {
          return json(route, 200, paginado([], url));
        }

        const rows = [...state.eventAudit].sort((a, b) =>
          b.changed_at.localeCompare(a.changed_at)
        );

        return json(route, 200, paginado(rows, url));
      }
    ],
    [
      'GET',
      /^\/v1\/accreditation\/accreditations\/[^/]+\/history$/,
      ({ route, path }) => {
        const code = path.split('/')[4];

        return json(route, 200, { data: state.audits[code] ?? [] });
      }
    ],

    // El detalle de una acreditación, como lo devuelve el gateway de verdad:
    //
    // - SIN `permissions_total` ni `uses_consumed`: son agregados del listado, y la pantalla
    //   los deriva de los permisos.
    // - `delivered_at` viene AUSENTE mientras no se haya entregado, no en null.
    // - los nombres siguen aplanados en `full_name`: los separados son de /persons.
    [
      'GET',
      /^\/v1\/accreditation\/accreditations\/[^/]+$/,
      ({ route, path }) => {
        const code = path.split('/')[4];
        const row = state.accreditations.find((item) => item.code === code);

        if (!row) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: [`No se encontró la acreditación ${code}`]
          });
        }

        const {
          permissions_total: _total,
          uses_consumed: _usos,
          delivered,
          orphan: _huerfana,
          ...detail
        } = row;

        const carnet = state.carnetDelDetalle[row.code];

        return json(route, 200, {
          ...detail,
          qr_public_token: `qr-${code.slice(0, 8)}`,
          // Las veces que se abrió el QR PÚBLICO, que es otro eje que las validaciones en
          // puerta. Backend lo añadió el 2026-09-17.
          //
          // Se siembra DISTINTO del total de `validation-logs` —que para esta acreditación
          // son 2— a propósito: con los dos en el mismo número, un check que confundiera los
          // campos pasaría igual y el defecto que originó todo esto seguiría vivo.
          public_views_count: 7,
          updated_at: row.created_at,
          permissions: state.detailPermissions[code] ?? [],
          // Los tres llevaban meses en null y empezaron a traer dato el 2026-09-07, medido
          // en staging. Se siembran con la forma real:
          //
          // - `sports_info` solo existe para deportistas a título individual: el de apoyo y
          //   los de conjunto llegan en null SIN error, así que el OTRO acreditado los trae
          //   vacíos a propósito —la raya de la ficha significa «no aplica»—;
          // - `certificate_url` viene FIRMADO y de vida corta (diez minutos), regenerado en
          //   cada carga; acá basta con que parezca una firma para que la pantalla la use.
          ...(row.code === 'aaaa1111-0000-4000-8000-000000000002'
            ? {
                sports_info: { sport_name: 'Fútbol', disciplines: [] },
                sports_info_error: null,
                photo_url:
                  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23c7d2fe%22/%3E%3C/svg%3E',
                certificate_url:
                  'https://bucket.pruebas.test/generated/certificado.pdf?X-Amz-Signature=firma'
              }
            : {
                sports_info: null,
                sports_info_error: null,
                photo_url: null,
                certificate_url: null
              }),
          // ── El carnet vigente (SUV2-2278) ──────────────────────────────────
          // Las tres claves viajan SIEMPRE, con null explícito: backend las puso sin
          // `omitempty` a propósito para que los tres casos se distingan por presencia.
          //
          // Lo que dicen sale de `carnetDelDetalle` —y no de una cadena de ifs acá— porque la
          // pantalla ya no lee el detalle una sola vez: sigue el lote, así que esta respuesta
          // tiene que poder cambiar entre dos lecturas.
          //
          // Ojo: `batch_number` y `printed_at` sí llevan `omitempty` y desaparecen cuando no
          // hay lote, así que NO sirven para preguntar por presencia. Estos tres sí.
          batch_code: carnet?.batchCode ?? null,
          batch_status: carnet?.batchStatus ?? null,
          card_url: carnet?.cardUrl ?? null,
          ...(delivered
            ? {
                delivered_at: '2026-08-18T11:00:00.000Z',
                delivered_by_code: SESSION.user_code
              }
            : {})
        });
      }
    ],

    // Las lecturas registradas. El gateway filtra por `event_id`, por `accreditation_code` y
    // por `validator_user_code`; acá se atienden los dos primeros, que son los que usa el
    // módulo. Devuelve el sobre paginado del módulo.
    //
    // Pagina de VERDAD (`paginado`, no `page1`): la auditoría del evento recorre las lecturas
    // con un bucle acotado, y un mock que devuelva siempre todas las filas esconde justo el
    // error de un bucle que no sabe cuándo parar. Ya pasó con el reporte de acreditados.
    //
    // Y respeta el `event_id`: sin eso, entrar con otro evento enseñaría estas mismas lecturas
    // y nadie se enteraría. Las filas no llevan la clave —el backend filtra del lado del
    // servidor y su respuesta no la devuelve—, así que se compara contra el de la sesión.
    [
      'GET',
      /^\/v1\/accreditation\/validation-logs$/,
      ({ route, url }) => {
        const code = url.searchParams.get('accreditation_code');
        const eventId = url.searchParams.get('event_id');

        if (eventId && String(eventId) !== String(SESSION.eventId)) {
          return json(route, 200, paginado([], url));
        }

        const rows = [...state.validationLogs, ...state.validationLogsExtra]
          .filter((log) => !code || log.accreditation_code === code)
          // Lo más reciente primero, como el resto de los listados del módulo.
          .sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));

        return json(route, 200, paginado(rows, url));
      }
    ],


    // Las personas. Responde `{data: []}` sin `meta` —así es el contrato— y por eso sirve
    // además para saber si alguien ya está registrado sin provocar el 409 del POST.
    [
      'GET',
      /^\/v1\/accreditation\/persons$/,
      ({ route, url }) => {
        const document = url.searchParams.get('document_number');

        return json(route, 200, {
          data: state.persons.filter(
            (person) => !document || person.document_number === document
          )
        });
      }
    ],

    // ── Las acciones INDIVIDUALES ────────────────────────────────────────────
    //
    // La primera ruta PATCH del arnés. Hasta el 2026-09-16 no había ninguna, y no por olvido:
    // la pantalla mandaba entregar e inactivar SIEMPRE por el masivo —el individual de entrega
    // no acepta observación y responde 500 si ya estaba entregada—, así que solo faltaba
    // `undo-delivery`, y ningún bloque llegaba a pulsarla.
    //
    // Se siembra el patrón con el VERBO CAPTURADO y no solo `undo-delivery`: las tres acciones
    // comparten forma —`accreditationActionUrl(code, action)` con `HttpMethod.Patch`—, así que
    // esto cubre las tres y no hay que volver acá cuando alguna se use.
    //
    // ⚠️ `status: 'REVOKED'` NO ESTÁ MEDIDO CONTRA STAGING. Es lo que asumen los dos mocks del
    // propio repositorio (`accredited-record.repository.ts`), y el modelo avisa de que hoy del
    // backend «solo llega ACTIVE; SUSPENDED y REVOKED están diseñados sin implementar». O sea
    // que es una suposición razonada, no una medición.
    //
    // Y ojo con la tentación de sembrar `INACTIVE` porque es lo que se LEE en la tabla: la fila
    // dice «Inactiva» porque `active` es `statusCode === 'ACTIVE'` y cualquier otro valor se
    // pinta igual. Deducir el contrato de lo que enseña la pantalla es exactamente como se
    // coló el «VALLE» de esta mañana.
    [
      'PATCH',
      /^\/v1\/accreditation\/accreditations\/([^/]+)\/(deliver|undo-delivery|deactivate)$/,
      ({ route, path }) => {
        const [, code, action] = path.match(
          /accreditations\/([^/]+)\/(deliver|undo-delivery|deactivate)$/
        );
        const body = route.request().postDataJSON() ?? {};

        state.actionRequests.push({ action, code, ...body });

        const row = state.accreditations.find((uno) => uno.code === code);

        if (!row) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: ['La acreditación no existe']
          });
        }

        // Revertir es TERMINAL: deshace la entrega Y deja la acreditación fuera de servicio.
        // Las dos cosas, no una. Un fixture que solo bajara `delivered` dejaría pasar en verde
        // a media implementación.
        if (action === 'undo-delivery') {
          row.delivered = false;
          row.status = 'REVOKED';
        } else if (action === 'deactivate') {
          row.status = 'REVOKED';
        } else {
          row.delivered = true;
        }

        return json(route, 200, {
          code: row.code,
          status: row.status,
          delivered_at: row.delivered ? '2026-08-18T11:00:00.000Z' : null,
          delivered_by_code: row.delivered ? SESSION.user_code : null
        });
      }
    ],

    // Las acciones masivas. Acá lo interesante no es el 200: es lo que le pasa al LOTE.
    [
      'POST',
      /^\/v1\/accreditation\/accreditations\/bulk-(deliver|deactivate)$/,
      ({ route, path }) => {
        const body = route.request().postDataJSON() ?? {};
        const action = path.endsWith('deactivate') ? 'deactivate' : 'deliver';

        state.bulkRequests.push({ action, ...body });

        const fromBatch = body.batch_code
          ? (state.cardBatches
              .find((batch) => batch.batch_code === body.batch_code)
              ?.members.map((member) => member.accreditation_code) ?? [])
          : [];

        const codes = body.codes ?? fromBatch;
        const targets = state.accreditations.filter((row) =>
          codes.includes(row.code)
        );

        targets.forEach((row) => {
          row.status = action === 'deactivate' ? 'REVOKED' : row.status;
          row.delivered = action === 'deliver' ? true : row.delivered;
        });

        if (action === 'deactivate') {
          // Los lotes que perdieron gente: el backend rehace su PDF sin esas hojas —el
          // resto conserva su QR— y retira el lote que se queda sin nadie.
          //
          // Lo que pierde el lote es la HOJA, no la fila: la pertenencia se queda y el
          // integrante pasa a contar como inactivo (ver `impresos`). Así el listado
          // aplanado sigue enseñando a la persona, marcada «Inactiva», que es justo lo que
          // esa pantalla tiene que saber pintar.
          state.cardBatches.forEach((batch) => {
            const perdidas = batch.members.filter((member) =>
              codes.includes(member.accreditation_code)
            );

            if (!perdidas.length) {
              return;
            }

            batch.total_cards = impresos(batch).length;
            batch.status = 'PROCESSING';
            // Un PDF nuevo, para poder afirmar que el visor pide OTRO archivo.
            batch.uploads = batch.uploads.map((upload) => `${upload}-re`);
            // Termina en la siguiente consulta por code.
            batch.settleAfter = (state.polls[batch.batch_code] ?? 0) + 1;
          });

          // El lote que se queda sin NADIE activo sale de los listados: su PDF nuevo no
          // tendría ninguna hoja.
          state.cardBatches = state.cardBatches.filter(
            (batch) => impresos(batch).length
          );
        }

        return json(route, 200, {
          processed: targets.map((row) => ({
            code: row.code,
            status: row.status,
            delivered_at: row.delivered ? '2026-08-18T11:00:00.000Z' : null
          })),
          skipped: [],
          total_requested: codes.length,
          total_processed: targets.length
        });
      }
    ],

    // ── Carnets en lote ──────────────────────────────────────────────────────
    // Medido contra dev: el 202 no trae estado ni chunks, la selección vacía es 422 y
    // un tipo sin acreditados también.
    [
      'POST',
      /^\/v1\/accreditation\/events\/[^/]+\/cards$/,
      ({ route }) => {
        const body = route.request().postDataJSON() ?? {};

        state.cardRequests.push(body);

        // El evento con VARIAS FASES. El ms pide `phase_code` y el endpoint no lo acepta de
        // ninguna forma: medido contra staging el 2026-09-09, mandarlo en el cuerpo, en la
        // query o con una selección explícita responde este mismo 422, porque el contrato del
        // gateway no tiene el campo. Así que la pantalla no puede resolverlo: lo único que le
        // toca es explicarlo sin soltar el nombre del parámetro.
        if (state.forzarFaseRequerida) {
          return json(route, 422, {
            code: 'PHASE_REQUIRED',
            messages: [
              'El evento tiene 2 fases (Regional 0209, Nacional 0209); indique phase_code para saber a cuál generarle los carnets'
            ]
          });
        }

        if (
          Array.isArray(body.accreditation_codes) &&
          !body.accreditation_codes.length
        ) {
          return json(route, 422, {
            code: 'EMPTY_SELECTION',
            messages: [
              'accreditation_codes no puede ser una lista vacía: omite el campo para generar todo el evento'
            ]
          });
        }

        // Por códigos se contesta uno por uno: los que no reconoce salen en `skipped` y
        // el lote se genera con el resto. Por evento o por tipo no hay nada que omitir,
        // porque los códigos los elige el propio backend.
        const requested = body.accreditation_codes
          ? body.accreditation_codes.map((code) => ({
              code,
              row: state.accreditations.find((item) => item.code === code)
            }))
          : state.accreditations
              .filter((row) => !row.orphan)
              // Las INACTIVAS no entran a un lote por evento: un carnet de una acreditación
              // anulada no sirve para nada, y el backend las rechaza —es el 422 de SUV2-2351
              // al pedir el carnet de una inactiva—. Cuando el fixture estrenó su primera
              // inactiva, el lote pasó de 4 carnets a 6 sin que nadie lo hubiera pedido.
              .filter((row) => row.status !== 'INACTIVE')
              .filter(
                (row) => !body.role_code || row.role_code === body.role_code
              )
              .map((row) => ({ code: row.code, row }));

        const cards = requested
          .filter((item) => item.row && !item.row.orphan)
          .map((item) => item.row);

        const skipped = requested
          .filter((item) => !item.row || item.row.orphan)
          .map((item) => ({
            code: item.code,
            reason: 'La acreditación no existe en el evento'
          }));

        if (!cards.length) {
          return json(route, 422, {
            code: 'NO_ACCREDITATIONS',
            messages: [
              'El evento no tiene acreditaciones que coincidan con los filtros'
            ]
          });
        }

        state.batchSequence += 1;

        const number = state.batchSequence;
        const batchCode = `lote000${number}-0000-4000-8000-000000000000`;

        state.cardBatches.unshift({
          batch_code: batchCode,
          // El consecutivo del lote dentro del evento.
          batch_number: number,
          event_code: SESSION.eventCode,
          kind: body.accreditation_codes ? 'SELECTION' : 'BULK',
          status: 'PROCESSING',
          total_cards: cards.length,
          total_chunks: 1,
          // En el LISTADO es un conteo; en el detalle por code es la lista de uuids.
          cards_without_photo: cards.length,
          requested_by: SESSION.user_code,
          created_at: '2026-08-18T10:00:00.000Z',
          members: cards.map((row) => ({
            accreditation_code: row.code,
            full_name: row.full_name
          })),
          skipped,
          uploads: [`pdf-${batchCode}-0`],
          // Termina en la segunda consulta por code.
          settleAfter: 1
        });

        return json(route, 202, {
          batch_code: batchCode,
          batch_number: number,
          total_cards: cards.length,
          total_chunks: 1,
          cards_without_photo: cards.map((row) => row.code),
          // Los omitidos llegan ya en el 202, antes de que exista ningún PDF.
          skipped
        });
      }
    ],

    // El listado APLANADO: una fila por acreditado con carnet, con su lote. Se deriva de los
    // lotes en lugar de mantenerse a mano, para que inactivar o matar un lote se refleje acá
    // —que es justo lo que hace el backend—.
    [
      'GET',
      /^\/v1\/accreditation\/card-batches\/members$/,
      ({ route, url }) => {
        const params = url.searchParams;
        const eventCode = params.get('event_code');
        const search = params.get('search');
        const estados = csv(params, 'statuses').map((uno) => uno.toUpperCase());
        const roles = csv(params, 'role_codes').map((uno) => uno.toUpperCase());
        const entrega = params.get('delivered');

        // `delivered` es un BOOLEANO DE VERDAD, no un estado. Desde el 2026-09-16 el backend
        // solo acepta `true`/`false` y cualquier otra cosa es un 400; antes leía «distinto de
        // true» como «no filtres», así que mandarle la cadena del desplegable —«DELIVERED»— lo
        // apagaba en silencio y la tabla se quedaba igual.
        //
        // El 400 está acá para que ese error no pueda volver a pasar desapercibido: una
        // pantalla que mande la cadena rompe la lista, que es lo que se ve.
        if (entrega !== null && !['true', 'false'].includes(entrega)) {
          return json(route, 400, {
            code: 'VALIDATION_ERROR',
            messages: ['delivered debe ser true o false']
          });
        }

        // UNA fila por acreditado, no por par persona+lote: backend lo describió como «tus 11
        // personas», y una persona puede tener varias acreditaciones generadas. Gana el lote
        // más reciente, y la lista viene de más nuevo a más viejo.
        //
        // Sigue siendo una interpretación y no una medición: en dev no hay ninguna persona con
        // dos generaciones, así que el caso no se puede observar. Con `membersOnePerBatch` se
        // prueba la otra forma —una fila por par— y se afirma que la tabla la aguanta.
        const seen = new Set();

        const filas = state.cardBatches
          .filter((batch) => !eventCode || batch.event_code === eventCode)
          .flatMap((batch) =>
            batch.members.map((member) => {
              const row = state.accreditations.find(
                (item) => item.code === member.accreditation_code
              );

              return {
                accreditation_code: member.accreditation_code,
                full_name: member.full_name,
                document_number: row?.document_number ?? null,
                role_code: row?.role_code ?? null,
                role_name: row?.role_name ?? null,
                status: row?.status ?? 'ACTIVE',
                delivered: row?.delivered ?? false,
                // Viaja siempre, como el backend.
                card_outdated: row?.card_outdated ?? false,
                // El territorio de la DELEGACIÓN, que este endpoint devuelve desde el
                // 2026-09-16 y que es lo que dejó pintar la columna «Territorio».
                //
                // Van solo si la acreditación los tiene, y AUSENTES si no: el personal de
                // misión no se inscribe por delegación, así que su fila no los trae. Es el
                // caso que ejercita los respaldos de la columna —«—» y «Sin delegación»— y
                // el que un `?? null` de más taparía.
                ...(row?.department_name === undefined
                  ? {}
                  : { department_name: row.department_name }),
                ...(row?.municipality_name === undefined
                  ? {}
                  : { municipality_name: row.municipality_name }),
                batch_code: batch.batch_code,
                batch_number: batch.batch_number,
                batch_kind: batch.kind,
                // Los códigos contra los que recortan los desplegables. NO salen en la
                // respuesta —el contrato no los trae— pero tienen que viajar hasta el filtro,
                // así que se cuelgan acá y se quitan al final.
                department_code: row?.department_code,
                municipality_code: row?.municipality_code,
                sport_codes: row?.sport_codes,
                category_code: row?.category_code,
                sex_code: row?.sex_code
              };
            })
          )
          .filter((row) => {
            if (state.membersOnePerBatch) {
              return true;
            }

            if (seen.has(row.accreditation_code)) {
              return false;
            }

            seen.add(row.accreditation_code);

            return true;
          })
          .filter(
            (row) =>
              !search ||
              plain(row.full_name).includes(plain(search)) ||
              (row.document_number ?? '').includes(search)
          )
          .filter((row) => !estados.length || estados.includes(row.status))
          .filter(
            (row) =>
              !roles.length ||
              roles.includes((row.role_code ?? '').toUpperCase())
          )
          .filter(
            (row) => entrega === null || row.delivered === (entrega === 'true')
          );

        // Y los seis de siempre, con la MISMA función que `ready-for-accreditation`: son los
        // mismos filtros de las mismas personas vistas por el otro lado.
        const rows = recorteTransversal(filas, params).map(
          ({
            department_code: _departamento,
            municipality_code: _municipio,
            sport_codes: _deportes,
            category_code: _categoria,
            sex_code: _sexo,
            ...fila
          }) => fila
        );

        return json(route, 200, page1(rows));
      }
    ],

    // El listado de lotes, los más recientes primero. Se recorta a mano en lugar de
    // devolver la fila entera: el listado NO trae integrantes ni omitidos, y un mock que
    // los filtrara de más daría por buena una pantalla que en dev se quedaría sin datos.
    [
      'GET',
      /^\/v1\/accreditation\/card-batches$/,
      ({ route }) => {
        const trace = state.failCardBatchesWithTrace;

        if (trace) {
          state.failCardBatchesWithTrace = null;

          // El gateway manda el trace en un cabecero, no en el cuerpo: es justo lo que el
          // interceptor del SDK tiene que recoger.
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            headers: { 'x-trace-id': trace },
            body: JSON.stringify({
              code: 'INTERNAL',
              messages: ['Error interno del servidor']
            })
          });
        }

        return json(
          route,
          200,
          page1(
            state.cardBatches.map((batch) => ({
              batch_code: batch.batch_code,
              batch_number: batch.batch_number,
              event_code: batch.event_code,
              kind: batch.kind,
              status: batch.status,
              total_cards: batch.total_cards,
              total_chunks: batch.total_chunks,
              cards_without_photo: batch.cards_without_photo,
              requested_by: batch.requested_by,
              created_at: batch.created_at
            }))
          )
        );
      }
    ],

    // El detalle del lote. La primera consulta lo da en curso y la segunda terminado:
    // así la pantalla muestra su espera sin que la prueba dependa de un reloj.
    [
      'GET',
      /^\/v1\/accreditation\/card-batches\/[^/]+$/,
      ({ route, path }) => {
        const code = path.split('/').pop();
        const listed = state.cardBatches.find(
          (batch) => batch.batch_code === code
        );

        if (!listed) {
          return json(route, 404, {
            code: 'NOT_FOUND',
            messages: ['No se encontró el lote']
          });
        }

        state.polls[code] = (state.polls[code] ?? 0) + 1;

        const done = state.polls[code] > listed.settleAfter;

        if (done) {
          // El GET por code es el que reconcilia contra file-storage, así que de acá
          // sale el estado que el listado repinta.
          //
          // `fallaAl` manda el lote a FAILED en vez de a COMPLETED. Es el camino que backend
          // garantizó en SUV2-2278: un lote que no responde pasa a FAILED a los quince
          // minutos con su motivo en español. No se podía provocar desde la UI —y por eso no
          // estaba probado— aunque es el estado que decide si la pantalla explica algo o se
          // queda girando.
          // Un lote inactivado se queda inactivado: la reconciliación no lo resucita.
          if (listed.status !== 'DELETED') {
            listed.status = state.fallaElLote ? 'FAILED' : 'COMPLETED';
          }

          // Y el DETALLE de las acreditaciones de ese lote se entera. Va POR DETRÁS del lote
          // —medido en staging: el lote ya decía COMPLETED a las 15:25 y el detalle no lo
          // dijo hasta las 15:27—, pero termina enterándose, y es de donde sale `card_url`.
          //
          // Con `retrasado` se queda como estaba: es esa ventana de dos minutos, en la que el
          // PDF existe y el detalle todavía dice PROCESSING sin carnet.
          Object.values(state.carnetDelDetalle)
            .filter(
              (uno) =>
                uno.batchCode === code && !uno.cardUrl && !uno.retrasado
            )
            .forEach((uno) => {
              uno.batchStatus = listed.status;
              uno.cardUrl =
                listed.status === 'COMPLETED'
                  ? `https://bucket.pruebas.test/generated/carnet_${listed.uploads[0]}.pdf?X-Amz-Signature=firma`
                  : null;
            });
        }

        return json(route, 200, {
          batch_code: listed.batch_code,
          batch_number: listed.batch_number,
          event_code: listed.event_code,
          kind: listed.kind,
          status: listed.status,
          // El motivo va en el LOTE y no en un chunk: es lo que cambió. Un lote que se cayó
          // por no responder puede no tener ningún chunk con error, así que si la pantalla
          // solo mirara el chunk perdería este texto.
          error_detail:
            listed.status === 'FAILED'
              ? 'La generación de los carnets no respondió en el tiempo esperado. Vuelve a emitir el lote.'
              : null,
          total_cards: listed.total_cards,
          total_chunks: listed.total_chunks,
          // En el detalle es la LISTA de uuids, no el conteo del listado. Y hoy salen
          // todos sin foto, porque el paquete documental no entrega la del acreditado.
          cards_without_photo: impresos(listed).map(
            (member) => member.accreditation_code
          ),
          // La regla que obliga a la pantalla a seguir consultando: los integrantes solo
          // viajan cuando el lote está en un estado final.
          //
          // Y son los que salen IMPRESOS: el detalle es la foto del PDF, así que una
          // inactivada ya no está aunque su pertenencia al lote siga registrada.
          accreditations: done ? impresos(listed) : [],
          // Los omitidos, en cambio, persisten desde el 202.
          skipped: listed.skipped,
          chunks: listed.uploads.map((upload, index) => ({
            chunk_index: index,
            // El lote se reparte entre sus PDFs; con uno solo van todos ahí.
            card_count: Math.ceil(listed.total_cards / listed.uploads.length),
            // El upload_id existe desde que está en cola: descargar por tenerlo da
            // NoSuchKey, así que la pantalla debe esperar el COMPLETED del chunk.
            status: done ? 'COMPLETED' : 'ENQUEUED',
            upload_id: upload
          })),
          created_at: listed.created_at
        });
      }
    ],

    [
      'GET',
      /^\/v1\/files\/[^/]+\/download-url$/,
      ({ route, path }) => {
        const uploadId = path.split('/')[3];

        // Los iconos de permiso se devuelven como un SVG incrustado, y no como una URL de un
        // bucket que no existe: así el navegador lo PINTA de verdad y se puede comprobar la
        // diferencia entre un icono que carga y un hueco vacío. Con la URL falsa, el `onError`
        // del componente los dejaba a los dos en hueco y el caso mixto no se podía observar.
        if (uploadId.startsWith('upload-icono')) {
          return json(route, 200, {
            download_url:
              'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%23228bff%22/%3E%3C/svg%3E',
            file_name: `${uploadId}.svg`,
            size_bytes: 220,
            // El contrato lo trae y el componente lo lee para cachear la firma: sin él, la
            // caché guardaba un vencimiento NaN.
            expires_at: new Date(Date.now() + 3600_000).toISOString()
          });
        }

        return json(route, 200, {
          download_url: `https://bucket.pruebas.test/generated/carnets_${uploadId}.pdf?X-Amz-Signature=firma`,
          file_name: `carnets_${uploadId}.pdf`,
          size_bytes: 51450,
          expires_at: new Date(Date.now() + 3600_000).toISOString()
        });
      }
    ]
  ];

  await page.route('**/public-gateway/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split('/public-gateway')[1] ?? url.pathname;

    state.requests.push(`${request.method()} ${path}${url.search}`);

    const handler = routes.find(
      ([method, pattern]) => method === request.method() && pattern.test(path)
    );

    if (!handler) {
      state.unexpected.push(`${request.method()} ${path}`);

      return json(route, 501, {
        code: 'SIN_CONTRATO',
        messages: [`La verificación no tiene contrato para ${path}`]
      });
    }

    return handler[2]({ route, url, path });
  });

  // El bucket falso. Va en el CONTEXTO y no en la página: el PDF se abre con
  // window.open, y esa pestaña es otra Page que no heredaría una ruta de ésta.
  await page.context().route('https://bucket.pruebas.test/**', (route) => {
    state.bucket.push(route.request().url().split('/').pop().split('?')[0]);

    return route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
    });
  });

  return state;
}
