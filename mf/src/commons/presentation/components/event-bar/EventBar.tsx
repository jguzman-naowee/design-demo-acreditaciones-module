import './EventBar.scss';

import type { NwtDetailGroupItem } from '@naowee-tech/sdk-react-components';
import { NwtSubheader } from '@naowee-tech/sdk-react-components';

import { NwsEventSelector } from '../event-selector/EventSelector';

interface NwsEventBarProps {
  // El retrato de la pantalla, a la derecha de la banda. Opcional: la mayoría no tiene ninguno
  // que el contrato sostenga, y una banda con «Cupo · —» es peor que una banda sin cupo.
  items?: NwtDetailGroupItem[];
}

// La banda del evento, a todo el ancho y por encima del contenido de la pantalla.
//
// Nace de una queja concreta: el evento iba metido en la fila del título, entre el subtítulo y
// los botones, y ahí no cabe —el nombre salía cortado («Juegos Nacionales 2026 · Fase Elimi…»)
// en las cinco pantallas—. El rediseño lo saca a su propia franja, que además es donde deja el
// retrato de la pantalla: los contadores de la auditoría, y el cupo cuando exista.
//
// Va como componente y no copiada en cada pantalla porque el arreglo del `box-sizing` de abajo
// hay que llevarlo a todas: copiada, ya se me quedó sin él una vez.
export function NwsEventBar({ items }: NwsEventBarProps) {
  return (
    <NwtSubheader className="nws-event-bar" items={items}>
      <NwsEventSelector />
    </NwtSubheader>
  );
}
