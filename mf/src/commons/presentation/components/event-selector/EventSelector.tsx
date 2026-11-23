import './EventSelector.scss';

import { NwtButton } from '@naowee-tech/sdk-react-components';
import { useLocation, useNavigate } from 'react-router-dom';

import { useActiveEvent } from '../../context/ActiveEvent';

// El evento en el que se está trabajando, y la puerta para cambiarlo.
//
// Antes esto era un desplegable, y ahí estaba el problema: para pintar el nombre de un
// evento que ya estaba guardado, cada pantalla del módulo se traía el catálogo entero
// —cinco páginas de cien en dev, porque `GET /v2/events` no acepta `search`—. Medido:
// entrar a «Lotes de acreditaciones» costaba doce peticiones.
//
// Elegir es cosa de la pantalla de entrada, que es la única que lee el catálogo. Acá solo
// se muestra la selección, que ya está en memoria, y se ofrece volver allá.
export function NwsEventSelector() {
  const { event, phase } = useActiveEvent();
  const navigate = useNavigate();
  const location = useLocation();

  // Sin evento no hay nada que mostrar: la guarda ya rebota a la pantalla de entrada.
  if (!event) {
    return <></>;
  }

  return (
    <div className="nws-event-selector">
      <div className="nws-event-selector__event">
        {/* La fase va ACÁ, con el rótulo, y no pegada al nombre: junta salían «Juegos
            Nacionales 2026 · Fase Eliminatoria» en una sola línea que se cortaba siempre. El
            nombre solo, que es lo que se lee, cabe entero. */}
        <small className="nwt-smalltext-font-regular">
          Evento{phase ? ` · ${phase.label}` : ''}
        </small>

        <span className="nwt-h6-font-bold">{event.name}</span>
      </div>

      <NwtButton
        icon="edit"
        nwtVariant="mute"
        nwtSize="small"
        onClick={() =>
          navigate('/', {
            state: { from: `${location.pathname}${location.search}` }
          })
        }
      >
        Cambiar
      </NwtButton>
    </div>
  );
}
