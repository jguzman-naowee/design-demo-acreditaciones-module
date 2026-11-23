import { NwtModal } from '@naowee-tech/sdk-react-components';
import type { ComponentProps } from 'react';

/**
 * El NwtModal del SDK, marcado como nuestro.
 *
 * El SDK saca el modal por portal a `document.body`, así que su marcado queda FUERA del
 * árbol de la aplicación —y fuera, por tanto, del ámbito donde el módulo repara los tokens
 * tipográficos que el anfitrión usa y no define—. Sin la marca, dentro de la suite el texto
 * de todos los modales se aplasta a 16px. El diagnóstico completo está en
 * `commons/presentation/styles/_host-typography.scss`.
 *
 * Existe para que eso no dependa de acordarse: los modales del módulo usan este y no
 * `NwtModal` directamente. Es lo único que hace; el resto lo pasa tal cual.
 */
export function NwsModal({
  className,
  ...props
}: ComponentProps<typeof NwtModal>) {
  return (
    <NwtModal
      {...props}
      className={['nws-accreditations-module', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
