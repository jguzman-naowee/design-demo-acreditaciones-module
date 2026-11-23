// Copys de certificados de participación, fuera de los componentes (mismo
// criterio que delivery.copy.ts).

export const CERTIFICATE_CONFIG_TITLE = 'Certificados de participación';
// Ya no dice «la plantilla»: la pantalla dejó de enseñarla —solo existe una y no se puede
// cambiar—, así que prometerla era mandar a buscar algo que no está.
export const CERTIFICATE_CONFIG_SUBTITLE =
  'Configura las fechas de entrega que se imprimen en el certificado. ' +
  'La fecha por deporte pisa la fecha general del evento; al generar se puede ' +
  'indicar otra fecha puntual.';

export const CERTIFICATE_GENERATION_TITLE = 'Certificados de participación';
export const CERTIFICATE_GENERATION_SUBTITLE =
  'Genera el certificado en PDF de los acreditados activos: masivo por deporte ' +
  'o individual por persona. El PDF queda disponible en el perfil público del ' +
  'acreditado.';

export const CONFIG_SAVED_TOAST = {
  title: 'Configuración guardada',
  message: 'Las fechas de entrega quedaron aplicadas para el evento.'
};

export const CONFIG_SAVE_ERROR = 'No se pudo guardar la configuración.';

// La fecha general es la ÚNICA obligatoria: el resto de deportes cae en ella cuando no
// tienen la suya. Sin ninguna, la generación responde 422 y el certificado no sale —o sea
// que guardar así deja la configuración en un estado que no sirve—.
export const CONFIG_DATE_REQUIRED =
  'Pon la fecha general del evento: es la que usan los deportes que no tengan una propia.';
export const CONFIG_LOAD_ERROR = 'No se pudo cargar la configuración.';
export const SPORTS_LOAD_ERROR =
  'No se pudieron cargar los deportes del evento.';
export const GENERATE_ERROR = 'No se pudo generar el certificado.';
export const BATCHES_LOAD_ERROR = 'No se pudieron cargar los lotes.';
export const CERTIFICATES_LOAD_ERROR =
  'No se pudieron cargar los certificados.';

export const GENERATING_ALERT =
  'Generando certificados… El PDF de cada persona tarda unos segundos.';

export function generatedAlert(total: number, deliveryDate: string): string {
  const plural = total === 1 ? 'certificado' : 'certificados';

  return `Listo: ${total} ${plural} con fecha de entrega ${deliveryDate}.`;
}

export const GENERATION_TIMEOUT_ALERT =
  'El lote sigue generándose en segundo plano; consulta su estado en la tabla.';
