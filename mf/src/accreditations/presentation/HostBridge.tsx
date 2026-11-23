import { useActiveEvent } from '@mf-accreditations/presentation';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Lo que el módulo necesita del anfitrión —y le da— para que su menú pueda vivir en el
// sidebar de la aplicación que lo monta.
//
// El SDK no trae puente: `mount(element, props)` y nada más. Sin esto, un anfitrión que
// declare las pantallas del módulo en su menú se encuentra con dos problemas medidos en
// Sports: su `pushState` no le llega al router de React (la vista no cambia hasta recargar),
// y no tiene forma de saber si ya se eligió un evento (sin evento no hay a dónde ir).
export interface AccreditationsHost {
  // El módulo escribe acá su `navigate` al montarse; el anfitrión lo llama con una ruta
  // interna («/delivery/card-batches») y el módulo se mueve SIN remontarse.
  navigate?: (path: string) => void;
  // Avisa del evento activo, o de que no hay: es lo que decide si el menú del módulo tiene
  // sentido.
  onEventChange?: (event: { code: string; name: string } | null) => void;
  // Y de por dónde va el módulo cuando navega por dentro (una fila, un detalle), para que el
  // anfitrión pueda marcar la entrada que corresponde.
  onNavigate?: (path: string) => void;
}

interface HostBridgeProps {
  host?: AccreditationsHost;
}

export function HostBridge({ host }: HostBridgeProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { event } = useActiveEvent();

  // El navegador se presta mientras el módulo está montado y se retira al desmontarse, para
  // que el anfitrión no llame a un router que ya no existe.
  useEffect(() => {
    if (!host) {
      return;
    }

    host.navigate = (path: string) => navigate(path);

    return () => {
      host.navigate = undefined;
    };
  }, [host, navigate]);

  useEffect(() => {
    host?.onNavigate?.(pathname);
  }, [host, pathname]);

  useEffect(() => {
    host?.onEventChange?.(
      event ? { code: event.code, name: event.name } : null
    );
  }, [host, event]);

  return <></>;
}
