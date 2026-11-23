import './RowActionsMenu.scss';

import {
  NwtIcon,
  NwtIconButton,
  NwtPopover
} from '@naowee-tech/sdk-react-components';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

export interface NwsRowAction {
  // Para acciones que todavía no tienen diseño: se ven pero no disparan.
  disabled?: boolean;
  icon?: string;
  key: string;
  label: string;
  onClick: () => void;
}

interface NwsRowActionsMenuProps {
  actions: NwsRowAction[];
  ariaLabel?: string;
  // Sin trigger propio se dibuja el kebab de la fila; con trigger sirve para el
  // botón "Acciones" de una cabecera, que abre el mismo menú. La forma función
  // recibe si el menú está abierto, para poder girar su chevron.
  trigger?: ReactNode | ((open: boolean) => ReactNode);
}

export function NwsRowActionsMenu({
  actions,
  ariaLabel = 'Más acciones',
  trigger
}: NwsRowActionsMenuProps) {
  const [open, setOpen] = useState(false);

  // El NwtPopover solo cierra por click afuera; Escape lo agregamos aquí.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const onSelect = useCallback((action: NwsRowAction) => {
    // El panel se portaliza a <body> con la misma capa que el NwtModal (`--naotech-z-dialog`):
    // si el menú sigue abierto, al abrirse el modal desempata el orden del DOM y puede quedar
    // flotando encima de él.
    setOpen(false);

    action.onClick();
  }, []);

  return (
    <NwtPopover
      triggerOn="click"
      position="bottom"
      open={open}
      onOpenChange={setOpen}
      content={
        <ul
          className={`nws-row-actions-menu nwt-dropdown__options${
            trigger ? '' : ' nws-row-actions-menu--kebab'
          }`}
          role="menu"
        >
          {actions.map((action) => (
            <li key={action.key} role="none">
              <button
                type="button"
                role="menuitem"
                className="nws-row-actions-menu__item nwt-dropdown__option"
                disabled={action.disabled}
                onClick={() => onSelect(action)}
              >
                {action.icon && <NwtIcon value={action.icon} />}
                <span>{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      }
    >
      {(typeof trigger === 'function' ? trigger(open) : trigger) ?? (
        <NwtIconButton
          className="nws-row-actions-menu__trigger"
          icon="overflow-menu-vertical"
          ariaLabel={ariaLabel}
          nwtVariant="mute"
          nwtSize="medium"
        />
      )}
    </NwtPopover>
  );
}
