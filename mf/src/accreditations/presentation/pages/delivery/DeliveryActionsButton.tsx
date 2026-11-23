import { NwtButton, NwtIcon } from '@naowee-tech/sdk-react-components';

interface DeliveryActionsButtonProps {
  disabled?: boolean;
  open: boolean;
}

// El botón "Acciones" del diseño es partido: texto, un divisor y el chevron, que
// apunta hacia arriba con el menú abierto. Se arma con children porque el markup
// del SDK no envuelve el texto en ningún elemento, así que colgar el divisor de
// la prop `icon` obligaría a romper el alto fijo de .nwt-icon.
export function DeliveryActionsButton({
  disabled,
  open
}: DeliveryActionsButtonProps) {
  return (
    <NwtButton
      className="nws-delivery__actions-button"
      nwtVariant="loud"
      nwtSize="medium"
      disabled={disabled}
    >
      <span>Acciones</span>

      <span className="nws-delivery__actions-separator" aria-hidden={true} />

      <NwtIcon value={open ? 'chevron-up' : 'chevron-down'} />
    </NwtButton>
  );
}
