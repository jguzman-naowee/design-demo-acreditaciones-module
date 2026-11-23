import {
  NwsModal,
  REQUIRED_FIELD_MESSAGE
} from '@mf-accreditations/presentation';
import {
  NwtAlert,
  NwtButton,
  NwtTextArea
} from '@naowee-tech/sdk-react-components';
import { useAreaControl } from '@rolster/react-forms';
import { required } from '@rolster/validators/helpers';
import { useCallback, useState } from 'react';

export interface DeliveryConfirmCopy {
  // Avisos ámbar apilados: el flujo de descarga no lleva ninguno.
  cautions?: string[];
  confirmLabel: string;
  // Texto obligatorio que acompaña la acción (observaciones o motivo).
  field?: { label: string; placeholder: string };
  lines: string[];
  positive: string;
  title: string;
}

interface DeliveryConfirmModalProps {
  copy?: DeliveryConfirmCopy;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

interface DeliveryConfirmBodyProps {
  copy: DeliveryConfirmCopy;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

// El cuerpo se monta con cada apertura (ver el comentario del modal) para que el
// control de react-forms no arrastre lo escrito la vez anterior.
function DeliveryConfirmBody({
  copy,
  onCancel,
  onConfirm
}: DeliveryConfirmBodyProps) {
  // Una acción masiva tarda: sin la guarda, dos clics la disparan dos veces.
  const [confirming, setConfirming] = useState(false);

  const note = useAreaControl('', [required]);

  const onConfirmOnce = useCallback(() => {
    const value = note.value.trim();

    // El diseño deja el botón activo y muestra el error debajo del campo, así
    // que se valida aquí: touch() vuelve `wrong` al control y lo pinta en rojo.
    if (copy.field && !value) {
      note.touch();

      return;
    }

    setConfirming(true);

    onConfirm(value);
  }, [copy.field, note, onConfirm]);

  return (
    <div className="nws-delivery-confirm-modal__body">
      <div className="nws-delivery-confirm-modal__question">
        {copy.lines.map((line) => (
          <p key={line} className="nwt-text-font-regular">
            {line}
          </p>
        ))}
      </div>

      {/* Las advertencias van ANTES del campo, y todas dentro de UN solo mensaje.

          Dos mensajes caution seguidos pelean: dos bloques naranja idénticos se leen como un
          error del sistema y, al pesar lo mismo, ninguno destaca. Como viñetas de un mismo
          aviso se leen como lo que son, la lista de consecuencias de una misma acción.

          Y el orden importa: con el campo primero uno escribía el motivo y solo DESPUÉS se
          enteraba de que la acción no se puede deshacer. Ahora se lee la consecuencia, se
          decide, y recién entonces se justifica. */}
      {!!copy.cautions?.length && (
        <NwtAlert
          nwtTheme="caution"
          icon="caution"
          visible={true}
          closabled={false}
        >
          {copy.cautions.length === 1 ? (
            copy.cautions[0]
          ) : (
            <ul className="nws-delivery-confirm-modal__cautions">
              {copy.cautions.map((caution) => (
                <li key={caution}>{caution}</li>
              ))}
            </ul>
          )}
        </NwtAlert>
      )}

      {copy.field && (
        <NwtTextArea
          className="nws-delivery-confirm-modal__field"
          formControl={note}
          label={copy.field.label}
          placeholder={copy.field.placeholder}
          required={true}
          message={note.wrong ? REQUIRED_FIELD_MESSAGE : undefined}
        />
      )}

      {/* Éste NO es una advertencia más: dice qué pasa DESPUÉS y dónde mirarlo. Va en mute
          para que no compita con el aviso de arriba: es el cierre tranquilo del modal, no un
          tercer bloque de alarma. */}
      <NwtAlert
        className="nws-delivery-confirm-modal__outcome"
        nwtTheme="positive"
        nwtVariant="mute"
        icon="positive"
        visible={true}
        closabled={false}
      >
        {copy.positive}
      </NwtAlert>

      <footer className="nws-delivery-confirm-modal__footer">
        <NwtButton nwtVariant="mute" onClick={onCancel}>
          Cancelar
        </NwtButton>

        <NwtButton
          nwtTheme="negative"
          nwtVariant="loud"
          disabled={confirming}
          onClick={onConfirmOnce}
        >
          {copy.confirmLabel}
        </NwtButton>
      </footer>
    </div>
  );
}

// Un solo modal de confirmación para todos los flujos de la sección: acreditar
// individual, generar lote, descargar lote, entregar e inactivar.
export function DeliveryConfirmModal({
  copy,
  onCancel,
  onConfirm
}: DeliveryConfirmModalProps) {
  return (
    <NwsModal
      className="nws-delivery-confirm-modal"
      title={copy?.title}
      visible={!!copy}
      onClose={onCancel}
      autoclose={true}
    >
      {/* El NwtModal siempre renderiza sus children: montar el cuerpo solo
          cuando hay copy reinicia el formulario en cada apertura. */}
      {copy && (
        <DeliveryConfirmBody
          copy={copy}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </NwsModal>
  );
}
