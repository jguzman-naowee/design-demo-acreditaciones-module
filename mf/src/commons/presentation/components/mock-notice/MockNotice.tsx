import './MockNotice.scss';

import { useAccreditationMock } from '@mf-accreditations/data';
import { NwtAlert } from '@naowee-tech/sdk-react-components';
import type { PropsWithChildren } from 'react';

interface NwsMockNoticeProps {
  // La pantalla conectada que cubre lo que el contrato sí permite hoy.
  instead: string;
}

// Marca las pantallas que todavía se resuelven contra los mocks del módulo.
//
// Fuera del modo demo sus entradas no están en el menú, pero la ruta sigue viva: es la
// referencia del diseño y la usa la suite de pruebas. Lo que no puede pasar es que
// alguien caiga por un enlace viejo y crea que está viendo datos reales, así que la
// pantalla lo dice y señala dónde está lo de verdad.
//
// En modo demo no avisa: ahí TODO el módulo son datos de ejemplo y el aviso sería ruido
// en cada pantalla.
export function NwsMockNotice({
  children,
  instead
}: PropsWithChildren<NwsMockNoticeProps>) {
  if (useAccreditationMock()) {
    return <>{children}</>;
  }

  return (
    <div className="nws-mock-notice">
      <NwtAlert nwtTheme="caution" icon="caution" visible={true}>
        Esta pantalla usa <b>datos de ejemplo</b>: todavía no está conectada,
        así que nada de lo que hagas acá se guarda. Lo que sí es real está en{' '}
        <b>{instead}</b>.
      </NwtAlert>

      {children}
    </div>
  );
}
