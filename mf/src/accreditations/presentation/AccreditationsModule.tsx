import './module-foundations.scss';

import { createReactMount } from '@naowee-tech/sdk-frontend-react';
import { configureHttp } from '@naowee-tech/sdk-frontend-web';

import { AccreditationsApp } from './AccreditationsApp';
import { installFloatingClamp } from './floating-clamp';
import { installIconFont } from './icon-font';

// Lo que `src/bootstrap.tsx` hace para el shell suelto, pero para el módulo montado.
//
// `createReactMount` solo renderiza: no configura nada. Y bootstrap.tsx —donde vivía esta
// llamada— es la entrada del shell de desarrollo, que no entra en el bundle expuesto. Así que
// al montarse en un anfitrión el módulo se quedaba sin configurar el cliente HTTP: sin la
// cookie de sesión (`withCredentials`) y sin la cabecera `X-Session-ID`, que es el otro camino
// por el que el gateway acepta la sesión. El anfitrión no lo cubre: su liomaze es otra
// instancia, la del bundle de Angular.
configureHttp({ sessionHeader: 'X-Session-ID', withCredentials: true });

// Los iconos del módulo, con familia propia: ver icon-font.ts.
installIconFont();

// Los paneles flotantes del SDK, dentro de la ventana: su ayudante de posicionamiento
// voltea en vertical pero no acota en horizontal, y el calendario de «Fecha de entrega» se
// salía 103px de la pantalla a cualquier ancho. Ver floating-clamp.ts.
installFloatingClamp();

// El contrato con el anfitrión, para que pueda tiparlo de su lado: además del `basename` y la
// `session` del SDK, este módulo acepta un `host` con el que se le presta el `navigate` y se
// le avisa del evento activo. Ver HostBridge.
export type { AccreditationsHost } from './HostBridge';

export const { mount, unmount } = createReactMount(AccreditationsApp);
