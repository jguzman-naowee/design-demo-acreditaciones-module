/**
 * Una fecha del backend, leída en la zona correcta.
 *
 * El problema: accreditation-ms guarda varias columnas como TIMESTAMP **sin** zona, con el
 * servidor en UTC, y las serializa sin sufijo. Así llega `created_at` del listado de
 * acreditados, medido contra staging el 2026-09-10:
 *
 *     "created_at": "2026-09-09T19:38:30.550699"
 *
 * `new Date()` con una fecha-hora ISO **sin** desfase la interpreta como hora LOCAL, así que
 * en Bogotá esas 19:38 UTC se pintaban como las 19:38 de la tarde cuando en realidad eran las
 * 14:38. Cinco horas de más, en la columna «Emisión» y en el detalle, sin que nada chirriara:
 * la fecha se veía verosímil.
 *
 * Por qué no basta con arreglar el sitio donde se vio: la misma forma la tienen otras
 * columnas del mismo servicio, y el fallo es invisible salvo que alguien compare contra el
 * reloj. Esto se aplica a todas y se acabó.
 *
 * Es un **no-op** cuando la cadena SÍ trae zona —`Z` o `±HH:MM`, como `delivered_at`—, así
 * que se puede usar en cualquier fecha del backend sin mirar cuál de las dos es.
 */
export function toBackendDate(value: string): Date;
export function toBackendDate(value: string | null | undefined): Date | null;
export function toBackendDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  // Ya trae zona: `Z` al final, o un `+05:00` / `-0500` después de la hora. El `T` del medio
  // es lo que separa la parte de fecha —donde un `-` es un separador y no un desfase— de la
  // hora, donde sí lo sería.
  const hora = value.split('T')[1] ?? '';
  const traeZona = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(hora);

  return new Date(traeZona ? value : `${value}Z`);
}
