import { ApiError } from '@naowee-tech/sdk-frontend-web';

interface GatewayErrorBody {
  code?: string;
  messages?: string[];
}

// El trace se muestra SOLO en fallos del servidor: en un 409 con su mensaje —«la acreditación ya
// fue entregado»— sería ruido que nadie va a usar, pero en un 500 genérico es lo único con lo
// que backend puede encontrar ESE fallo sin reproducirlo.
//
// El campo lo conserva el SDK desde la 2.11.0, con un interceptor propio: el `HttpError` de
// liomaze no trae los cabeceros de la respuesta, y registrar el interceptor desde acá no sirve
// porque el SDK federado carga su propia copia de liomaze. Por eso esto vive en el SDK y acá
// solo se lee.
function withTrace(message: string, error: ApiError): string {
  return error.errorIsServer() && error.traceId
    ? `${message} (código para soporte: ${error.traceId})`
    : message;
}

// Un 404 no siempre es un fallo que haya que reintentar: un lote de acreditaciones que se quedó
// sin nadie desaparece a propósito, y la pantalla lo cuenta en lugar de ofrecer «reintentar».
// El SDK trae `statusIsUnauthorized` y `statusIsForbidden` pero no este.
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

/**
 * El evento tiene varias fases y el backend no sabe a cuál generarle los carnets.
 *
 * Se distingue por el `code` y no por el texto, que trae los nombres de las fases dentro y
 * cambia con cada evento.
 *
 * Merece su propio caso porque el mensaje del backend —«indique phase_code»— suena a que
 * falta llenar algo, y no falta: no hay dónde. Medido contra staging el 2026-09-09, el
 * endpoint NO acepta la fase de ninguna forma —cuerpo, query y selección explícita dan el
 * mismo 422— porque el contrato del gateway
 * (`AccreditationMsGenerateEventCardsRequest`) no tiene el campo. Está reportado.
 */
export function esFaltaDeFase(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.details as GatewayErrorBody | undefined)?.code === 'PHASE_REQUIRED'
  );
}

// El gateway responde {code, messages[]}, pero ApiError.fromHttpError busca un
// campo `message` que ese cuerpo no tiene: el texto útil queda en `details`.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const body = error.details as GatewayErrorBody | undefined;
  const message = body?.messages?.[0];

  if (message) {
    return withTrace(message, error);
  }

  // El accreditation-ms no está desplegado en dev, así que este es el caso
  // habitual hoy: el gateway responde 503 SERVICE_UNAVAILABLE.
  if (error.statusCode === 503) {
    return withTrace(
      'El servicio de acreditaciones no está disponible en este momento.',
      error
    );
  }

  if (error.statusIsForbidden()) {
    return 'Tu usuario no tiene permisos para consultar esta información.';
  }

  // Sin `messages[]` lo único que queda en `message` es el statusText de HTTP
  // («Not Found», o vacío en HTTP/2), que no le dice nada a quien lee: el texto
  // del llamador siempre es mejor.
  return withTrace(fallback, error);
}
