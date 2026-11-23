import type { AccreditationPhase, SuiteEvent } from '@mf-accreditations/domain';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useActiveEvent } from '../../context/ActiveEvent';
import { NwsLoading } from '../loading/Loading';

export interface NwsEventScope {
  event: SuiteEvent;
  // El entero que exigen los roles y las acreditaciones: identifica el par evento+fase.
  eventId: number;
  phase?: AccreditationPhase;
}

interface NwsEventGuardProps {
  children: (scope: NwsEventScope) => ReactNode;
}

// Las pantallas del módulo no se montan sin evento resuelto: rebotan a la pantalla de
// entrada, que es la que sabe elegirlo (y la única que lee el catálogo de eventos).
//
// No es solo cosmético. El controlador de paginación del SDK pide al MONTAR, así que una
// pantalla abierta sin evento gastaba una petición con un evento imposible para tirarla
// cuando llegaba el bueno. Montando solo con el evento resuelto, esa petición no existe y
// la pantalla no tiene que explicar en un aviso que falta elegir algo.
//
// El evento llega por parámetro y no por contexto para que el hijo lo reciba ya definido:
// así no hay una comprobación de «puede ser undefined» repetida en cada pantalla.
export function NwsEventGuard({ children }: NwsEventGuardProps) {
  const { event, eventId, phase, resolving } = useActiveEvent();
  const location = useLocation();

  if (resolving) {
    return (
      <section className="nws-delivery">
        <div className="nws-delivery__content">
          <NwsLoading>
            <h4>Resolviendo el evento, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  // Sin evento, o con un evento que el módulo no reconoce, o con varias fases sin elegir:
  // los tres se deciden allá. Se recuerda de dónde venía para volver al elegir.
  if (!event || eventId === undefined) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children({ event, eventId, phase })}</>;
}
