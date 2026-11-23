import './SuccessModal.scss';

import {
  NwtAlert,
  NwtButton,
  NwtIcon
} from '@naowee-tech/sdk-react-components';

import { NwsModal } from '../modal/NwsModal';

interface NwsSuccessModalProps {
  actionLabel?: string;
  bullets?: string[];
  // Aviso ámbar opcional: los éxitos de entrega e inactivación lo llevan.
  caution?: string;
  // Opcional: hay éxitos que van directo del título a los avisos.
  message?: string;
  onClose: () => void;
  title: string;
  visible: boolean;
}

// El NwtConfirmation del SDK pinta este mismo círculo verde, pero su message es
// un string y no acepta children, así que no admite las viñetas del diseño.
export function NwsSuccessModal({
  actionLabel = 'Cerrar',
  bullets = [],
  caution,
  message,
  onClose,
  title,
  visible
}: NwsSuccessModalProps) {
  return (
    <NwsModal
      className="nws-success-modal"
      visible={visible}
      onClose={onClose}
      autoclose={false}
    >
      <div className="nws-success-modal__body">
        <div className="nws-success-modal__icon">
          <NwtIcon value="positive" />
        </div>

        <h2 className="nws-success-modal__title">{title}</h2>

        {message && <p className="nws-success-modal__message">{message}</p>}

        {caution && (
          <NwtAlert
            className="nws-success-modal__caution"
            nwtTheme="caution"
            icon="caution"
            visible={true}
            closabled={false}
          >
            {caution}
          </NwtAlert>
        )}

        {bullets.length > 0 && (
          <ul className="nws-success-modal__bullets">
            {bullets.map((bullet) => (
              <li key={bullet} className="nws-success-modal__bullet">
                <NwtIcon value="positive" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <footer className="nws-success-modal__footer">
          <NwtButton nwtVariant="loud" nwtTheme="negative" onClick={onClose}>
            {actionLabel}
          </NwtButton>
        </footer>
      </div>
    </NwsModal>
  );
}
