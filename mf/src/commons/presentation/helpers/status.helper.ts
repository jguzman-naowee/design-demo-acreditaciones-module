import type {
  AccreditationAction,
  CatalogStatus,
  DeliveryStatus
} from '@mf-accreditations/domain';
import type { NwtTheme } from '@naowee-tech/sdk-react-components';

/**
 * El estado de un elemento del catálogo, concordado con lo que nombra.
 *
 * El género va explícito porque no hay uno que sirva para todo: una ACREDITACIÓN está
 * «Activa» y un PERMISO está «Activo». Salía «Activa» en los doce sitios, así que la mitad
 * estaba mal escrita; lo reportó QA sobre la tabla de permisos.
 *
 * El femenino es el valor por defecto porque es lo que son casi todos los que lo usan
 * —acreditaciones—, y así los masculinos, que son dos, lo dicen en el sitio donde se pintan.
 */
export function getCatalogStatusLabel(
  status: CatalogStatus,
  genero: 'femenino' | 'masculino' = 'femenino'
): string {
  const activo = genero === 'masculino' ? 'Activo' : 'Activa';

  return status === 'ACTIVE' ? activo : `In${activo.toLowerCase()}`;
}

// El cambio de estado de un movimiento, o `null` si no cambió —entregar no lo toca y «Activa →
// Activa» es ruido—. Traduce, porque el backend manda `DELETED` y pintarlo crudo es lo que QA
// vio en la auditoría; todo lo que no sea ACTIVE es inactiva, como el resto de la pantalla.
export function getStatusTransitionLabel(
  oldStatus?: string | null,
  newStatus?: string | null
): string | null {
  if (!oldStatus || !newStatus || oldStatus === newStatus) {
    return null;
  }

  const label = (status: string) =>
    getCatalogStatusLabel(status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');

  return `${label(oldStatus)} → ${label(newStatus)}`;
}

export function getCatalogStatusTheme(status: CatalogStatus): NwtTheme {
  return status === 'ACTIVE' ? 'positive' : 'neutral';
}

// Etiqueta de la acción que ofrece el menú, no del estado actual.
export function getCatalogStatusAction(status: CatalogStatus): string {
  return status === 'ACTIVE' ? 'Inactivar' : 'Activar';
}

export function getCatalogStatusIcon(status: CatalogStatus): string {
  return status === 'ACTIVE' ? 'padlock-close' : 'padlock-open';
}

// Eje aparte del de CatalogStatus: una acreditación activa está generada
// mientras no se le entrega a su titular.
// «Sin entregar» y no «Generada»: el eje que este par describe es la ENTREGA, y «generada»
// hablaba de otra cosa —de que el PDF existiera—. Es el vocabulario del rediseño.
//
// TODO(api): el rediseño distingue cuatro situaciones (sin entregar · impresa · entregada ·
// anulada) y el contrato solo permite dos: `GET /accreditations` manda `delivered_at` y nada
// más. Ni `printed_at` ni un estado de anulación.
export function getDeliveryStatusLabel(status: DeliveryStatus): string {
  return status === 'DELIVERED' ? 'Entregada' : 'Sin entregar';
}

export function getDeliveryStatusTheme(status: DeliveryStatus): NwtTheme {
  return status === 'DELIVERED' ? 'positive' : 'informative';
}

const ACTION_LABELS: Record<AccreditationAction, string> = {
  GENERATED: 'Generada',
  PRINTED: 'Impresa',
  DELIVERED: 'Entregada',
  DEACTIVATED: 'Inactivada',
  SCANNED_OK: 'Escaneada con éxito',
  SCANNED_ERROR: 'Escaneada error'
};

const ACTION_THEMES: Record<AccreditationAction, NwtTheme> = {
  GENERATED: 'informative',
  PRINTED: 'neutral',
  DELIVERED: 'positive',
  DEACTIVATED: 'negative',
  SCANNED_OK: 'positive',
  SCANNED_ERROR: 'negative'
};

export function getAccreditationActionLabel(
  action: AccreditationAction
): string {
  return ACTION_LABELS[action];
}

export function getAccreditationActionTheme(
  action: AccreditationAction
): NwtTheme {
  return ACTION_THEMES[action];
}

export const ACCREDITATION_ACTIONS = Object.keys(
  ACTION_LABELS
) as AccreditationAction[];
