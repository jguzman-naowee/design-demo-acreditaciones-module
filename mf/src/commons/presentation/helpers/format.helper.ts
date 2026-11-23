import { PLATFORM_ROLE_LABELS } from '@mf-accreditations/data';
import { dateFormatTemplate } from '@rolster/dates';

// El SDK expone formatDate, pero con la plantilla '{dd} {mx} {yy}' ("12 Dic
// 2025") y sin admitir fechas nulas. El diseño pide "12 de dic, 2025", así que
// se arma con la misma utilidad de @rolster/dates en vez de rehacer el
// calendario a mano. El template devuelve el mes capitalizado.
export function formatCatalogDate(date: Date | null, empty = '—'): string {
  return date
    ? dateFormatTemplate(date, '{dd} de {mx}, {yy}').toLowerCase()
    : empty;
}

// El historial pide fecha con hora ("Mar, 02 2026. 10:01 AM"). Sin toLowerCase,
// que convertiría el AM/PM en minúsculas.
export function formatEventDateTime(date: Date, empty = '—'): string {
  return date
    ? dateFormatTemplate(date, '{mx}, {dd} {yy}. {hz}:{ii} {zz}')
    : empty;
}

// Un texto listo para comparar: en minúsculas y sin tildes.
//
// Los buscadores de esta clase filtran nombres de personas, y quien busca escribe «jose» o
// «munoz». Con un `toLowerCase()` pelado, «José» y «Muñoz» no aparecían — en un lote de
// deportistas colombianos eso es media tabla que no se encuentra.
//
// El de acreditaciones lo tolera desde el backend (`toRoleCode` hace lo mismo para derivar el
// código del rol); esto es lo equivalente para comparar en pantalla.
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// La misma fecha que pinta NwsDateTimeCell, pero en UNA línea unida por «·».
//
// Va aparte del componente porque acá el dato no es una celda de tabla: es la meta de un
// movimiento en la línea de tiempo, donde tiene que caber en el mismo renglón que el autor.
// El día del rediseño: «Sep 2, 2026», SIN cero delante.
//
// `dateFormatTemplate` solo trae `{dd}`, que rellena a dos cifras, así que el cero se quita
// acá. Medido en la demo, en su línea de tiempo y en su auditoría: pinta «Sep 2, 2026» y
// «Sep 1, 2026», nunca «Sep 02». La hora SÍ va rellena —«01:14 PM»—, también como la demo.
//
// No toca `formatCatalogDate` («28 de jul, 2026»), que es el formato viejo de las otras diez
// pantallas del módulo: de ese no hay evidencia de cómo lo escribe el rediseño.
export function formatDayLabel(date: Date): string {
  return dateFormatTemplate(date, '{mx} {dd}, {yy}').replace(/ 0(\d,)/, ' $1');
}

export function formatDateTimeInline(date: Date | null, empty = '—'): string {
  return date
    ? `${formatDayLabel(date)} · ${dateFormatTemplate(date, '{hz}:{ii} {zz}')}`
    : empty;
}

// El número de documento TAL CUAL, sin puntos de mil: "1121861931", no "1.121.861.931".
//
// Llegó a ponerlos, argumentando que diez dígitos seguidos no se leen de un vistazo. Lo tumbó
// QA y con razón: el resto del producto los escribe sin puntos, así que el mismo documento se
// veía de dos formas según la pantalla; y los puntos estorban justo en lo que más se hace con
// este dato, que es copiarlo de acá y pegarlo en un buscador —el de arriba incluido, que
// busca contra lo que guarda el backend, o sea sin puntos—.
//
// Queda la función, y no una lectura pelada en cada pantalla, por dos motivos: el respaldo de
// `empty` —hay sitios que le pasan documentos vacíos y cuentan con el guion— y tener un solo
// lugar donde cambiar la regla el día que vuelva a cambiar.
export function formatDocumentNumber(document: string, empty = '—'): string {
  return document || empty;
}

// Un código del contrato, escrito para que se lea: "COORDINADOR_LOGISTICO" → "Coordinador
// logistico", "ATHLETE" → "Deportista".
//
// Los códigos del backend son la IDENTIDAD de la cosa —van en las peticiones y no se tocan—,
// pero en pantalla salían a gritos y en mayúsculas, que es como se lee un error. Esto es solo
// para mostrar: nunca se guarda ni se manda formateado.
//
// Dos cosas que no son obvias y por las que no vale un `toLowerCase()` a secas:
//
// - LAS TILDES NO VUELVEN. El código es ASCII, así que "COORDINADOR_LOGISTICO" da
//   "Coordinador logistico", sin la í. No hay de dónde sacarla: adivinarla con un diccionario
//   de acentos acertaría en los casos de hoy y fallaría en el primero que no esté.
// - LAS PALABRAS CON DÍGITO SE QUEDAN EN MAYÚSCULA. "PRUEBA_CONTRATO_PR620" da "Prueba
//   contrato PR620" y no "…pr620": eso es un identificador —un ticket, una versión— y en
//   minúscula deja de reconocerse.
export function formatCodeLabel(code: string | null | undefined): string {
  const raw = (code ?? '').trim();

  if (!raw) {
    return '';
  }

  // Los códigos en inglés tienen su nombre en español, y sale de PLATFORM_ROLE_LABELS —el
  // mapa que ya usa el resto del módulo—. Es a propósito una sola fuente: llegué a escribir
  // aquí un segundo mapa con los mismos dos códigos y otra traducción («Atleta» contra
  // «Deportista»), que es exactamente como se desincronizan dos sitios que dicen lo mismo.
  const traducido = PLATFORM_ROLE_LABELS[raw.toUpperCase()];

  if (traducido) {
    return traducido;
  }

  const words = raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    // Con dígito es un identificador y va tal cual; sin dígito, es una palabra.
    .map((word) => (/\d/.test(word) ? word : word.toLowerCase()));

  if (!words.length) {
    return raw;
  }

  const [first, ...rest] = words;

  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
