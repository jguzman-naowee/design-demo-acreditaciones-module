import type { AccreditationSuccessCopy } from './accredited-record-actions.hook';
import type { DeliveryConfirmCopy } from './DeliveryConfirmModal';

const SEE_STATUS =
  'Podrás ver el estado de cada acreditación en el listado de acreditados.';

const IRREVERSIBLE = 'Esta acción no se puede deshacer.';

const AUTO_REGISTER =
  'Se registrará automáticamente el estado y la fecha de modificación.';

const DELIVERY_SUPPORT_WARNING =
  'Después de la entrega, cualquier cambio deberá ser gestionado por el equipo de soporte.';

const DEACTIVATION_SUPPORT_WARNING =
  'Después de la inactivación, cualquier cambio deberá ser gestionado por el equipo de soporte.';

const FIELD_PLACEHOLDER = 'Escribe aquí';

// Mandar lotes a impresión. Se cuentan las tres cosas que importan antes de gastar papel:
// cuántos lotes, cuántos PDF se van a abrir y cuántas acreditaciones salen dentro.
export function printBatchesCopy(
  lotes: number,
  archivos: number,
  acreditaciones: number
): DeliveryConfirmCopy {
  const masivo = lotes > 1;

  return {
    title: masivo ? 'Enviar a impresión' : 'Enviar el lote a impresión',
    lines: [
      masivo
        ? `Estás a punto de enviar a impresión ${lotes} lotes: ${archivos} documentos PDF con ${acreditaciones} acreditaciones en total.`
        : `Estás a punto de enviar a impresión ${archivos} ${archivos === 1 ? 'documento PDF' : 'documentos PDF'} con ${acreditaciones} ${acreditaciones === 1 ? 'acreditación' : 'acreditaciones'}.`,
      'Se abre una pestaña por documento; desde ahí se manda a la impresora.'
    ],
    // No es una advertencia de soporte: es lo que hay que revisar ANTES, porque el papel no se
    // deshace.
    cautions: [
      'Revisa que las acreditaciones tengan su foto: las que salieron sin ella se imprimen igual.'
    ],
    positive:
      'Cada PDF se abre en su pestaña; el navegador puede pedir permiso para las emergentes.',
    confirmLabel: masivo ? 'Sí, enviar todo' : 'Sí, enviar'
  };
}

export function downloadBatchCopy(total: number): DeliveryConfirmCopy {
  return {
    title: 'Descargar lote',
    lines: [
      `Estás a punto de descargar ${total} acreditaciones, estas se registrarán como impresas automaticamente con la fecha de creación y su estado será activo.`,
      '¿Quieres descargarlas?'
    ],
    positive: SEE_STATUS,
    confirmLabel: 'Sí, descargar'
  };
}

// Mismo copy para la acción individual del detalle y para la masiva de la
// lista: solo cambia el conteo. Las dos exigen el texto.
export function deliverAccreditationsCopy(total: number): DeliveryConfirmCopy {
  const massive = total > 1;

  return {
    title: massive ? 'Entrega masiva' : 'Entregar acreditación',
    lines: [
      massive
        ? `¿Seguro que quieres entregar estas ${total} acreditaciones?`
        : '¿Seguro que quieres entregar esta acreditación?',
      AUTO_REGISTER
    ],
    field: {
      label: 'Observaciones de la entrega',
      placeholder: FIELD_PLACEHOLDER
    },
    cautions: [IRREVERSIBLE, DELIVERY_SUPPORT_WARNING],
    positive: SEE_STATUS,
    confirmLabel: 'Sí, entregar'
  };
}

// Matar el lote completo: no es «inactivar varias», es que las acreditaciones ya impresos de ese
// lote dejan de servir en la puerta. Por eso la copia lo dice con esas palabras.
export function deactivateBatchCopy(
  label: string,
  total: number
): DeliveryConfirmCopy {
  return {
    title: `Inactivar el lote ${label}`,
    lines: [
      `Estás a punto de inactivar las ${total} acreditaciones del lote ${label}.`,
      '¿Seguro que quieres inactivarlo?',
      AUTO_REGISTER
    ],
    field: {
      label: 'Escribe el motivo de inactivación',
      placeholder: FIELD_PLACEHOLDER
    },
    cautions: [
      'Las acreditaciones de este lote que ya estén impresas dejarán de servir: su QR no valida.',
      IRREVERSIBLE,
      DEACTIVATION_SUPPORT_WARNING
    ],
    positive:
      'Las personas quedan libres para acreditarse de nuevo, y la acreditación nueva sale con otro QR.',
    confirmLabel: 'Sí, inactivar el lote'
  };
}

export const BATCH_DEACTIVATION_SUCCESS_COPY: AccreditationSuccessCopy = {
  title: '¡Lote inactivado!',
  caution:
    'El lote sale de los listados y sus acreditaciones impresos ya no validan en la puerta.',
  bullets: [
    'Las personas del lote pueden volver a acreditarse; su acreditación nuevo llevará otro QR.'
  ]
};

export function deactivateAccreditationsCopy(
  total: number
): DeliveryConfirmCopy {
  const massive = total > 1;

  return {
    title: massive ? 'Inactivar masivo' : 'Inactivar acreditación',
    lines: [
      massive
        ? `¿Seguro que quieres inactivar estas ${total} acreditaciones?`
        : '¿Seguro que quieres inactivar esta acreditación?',
      AUTO_REGISTER
    ],
    field: {
      label: 'Escribe el motivo de inactivación',
      placeholder: FIELD_PLACEHOLDER
    },
    cautions: [IRREVERSIBLE, DEACTIVATION_SUPPORT_WARNING],
    positive: SEE_STATUS,
    confirmLabel: 'Sí, inactivar'
  };
}

// Revertir la entrega es lo más destructivo de la sección: además de deshacer la
// entrega, INACTIVA la acreditación y no hay vuelta atrás. Por eso el copy lo dice
// con todas las letras en lugar de hablar solo de la entrega.
//
// `total` lleva la cuenta a la confirmación cuando son varias. El número va DELANTE, en la
// primera línea y en el botón: es la única pantalla que se interpone entre un clic y dejar a
// N personas sin acreditación, y «¿seguro que quieres revertir?» a secas no dice a cuántas.
// De ahí también que el botón repita la cifra —«Sí, revertir e inactivar 12»— en vez de
// quedarse en el verbo.
export function undoDeliveryCopy(total = 1): DeliveryConfirmCopy {
  const varias = total > 1;

  return {
    title: varias ? `Revertir ${total} entregas` : 'Revertir la entrega',
    lines: [
      varias
        ? `¿Seguro que quieres revertir la entrega de ${total} acreditaciones?`
        : '¿Seguro que quieres revertir la entrega de esta acreditación?',
      varias
        ? `Además de deshacer la entrega, las ${total} acreditaciones quedan INACTIVAS y sus QR dejan de validar. Para volver a acreditar a esas personas hay que emitir una acreditación nueva a cada una.`
        : 'Además de deshacer la entrega, la acreditación queda INACTIVA y su QR deja de validar. Para volver a acreditar a la persona hay que emitir una acreditación nueva.',
      AUTO_REGISTER
    ],
    field: {
      label: 'Escribe el motivo de la reversión',
      placeholder: FIELD_PLACEHOLDER
    },
    cautions: [IRREVERSIBLE, DELIVERY_SUPPORT_WARNING],
    positive: SEE_STATUS,
    confirmLabel: varias
      ? `Sí, revertir e inactivar ${total}`
      : 'Sí, revertir e inactivar'
  };
}

export const BATCH_CREATED_BULLETS = [
  SEE_STATUS,
  'El documento se descargará automáticamente. Si no sucede, selecciona el boton de descargar.'
];

export const BATCH_DOWNLOADED_BULLETS = [SEE_STATUS];

// Modales de éxito de las dos acciones: el aviso de soporte va en la alerta
// ámbar y el de seguimiento como viñeta.
export const DELIVERY_SUCCESS_COPY = {
  title: '¡Entrega exitosa!',
  caution: DELIVERY_SUPPORT_WARNING,
  bullets: [SEE_STATUS]
};

export const DEACTIVATION_SUCCESS_COPY = {
  title: '¡Inactivación exitosa!',
  caution: DEACTIVATION_SUPPORT_WARNING,
  bullets: [SEE_STATUS]
};
