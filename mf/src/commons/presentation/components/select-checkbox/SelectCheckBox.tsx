import './SelectCheckBox.scss';

import { NwtCheckBox } from '@naowee-tech/sdk-react-components';

interface NwsSelectCheckBoxProps {
  ariaLabel?: string;
  // undefined = indeterminado (algunas filas de la página seleccionadas).
  checked?: boolean;
  // Para las filas sobre las que la acción en bloque no aplica: marcarlas no llevaría a
  // ninguna parte, así que la casilla se ve apagada en vez de esconderse.
  disabled?: boolean;
  onToggle: () => void;
}

export function NwsSelectCheckBox({
  ariaLabel,
  checked,
  disabled,
  onToggle
}: NwsSelectCheckBoxProps) {
  return (
    <span className="nws-select-checkbox" aria-label={ariaLabel}>
      <NwtCheckBox
        checked={checked}
        disabled={disabled}
        nwtSize="medium"
        onClick={onToggle}
      />
    </span>
  );
}
