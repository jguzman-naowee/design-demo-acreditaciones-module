import { NwtButton } from '@naowee-tech/sdk-react-components';

interface NwsReportLinkProps {
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}

/**
 * «Descargar reporte», en las cinco pantallas que lo llevan.
 *
 * Es un BOTÓN `mute` del SDK. Antes era un `NwtTextLink` con la caja del icono dibujada a
 * mano, y arrastraba dos problemas —los mismos que la demo ya había resuelto y nosotros no
 * habíamos traído—:
 *
 * - **se leía como enlace de navegación** cuando en realidad dispara una acción;
 * - **obligaba a un bloque de CSS propio** para fijar el tamaño. Comprobado en nuestro SDK:
 *   `.nwt-textlink` no tiene ni una regla de tamaño —solo `--disabled`—, así que el prop
 *   `nwtSize` que TypeScript acepta no hace nada. De ahí que el enlace quedara ~8px más bajo
 *   que «Nuevo acreditado» y «Acciones», que son `medium`: cuatro alturas distintas en la
 *   misma fila.
 *
 * En `medium` por eso mismo: una fila, un tamaño. Y sin `nwtTheme`, que el `mute` ya da la
 * discreción que el diseño pide sin un solo override local — por eso este componente ya no
 * tiene `.scss`.
 *
 * Se fue también el prop `boxed`, que existía para dibujar esa caja en la cabecera y dejarlo
 * suelto dentro de una tarjeta. Con un botón la distinción sobra: se ve igual de bien en los
 * dos sitios.
 *
 * La clase `nws-report-link` se conserva aunque ya no tenga estilos: es el gancho con el que
 * el arnés lo encuentra en dos bloques.
 */
export function NwsReportLink({
  disabled,
  label = 'Descargar reporte',
  onClick
}: NwsReportLinkProps) {
  return (
    <NwtButton
      className="nws-report-link"
      nwtVariant="mute"
      nwtSize="medium"
      icon="download"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </NwtButton>
  );
}
