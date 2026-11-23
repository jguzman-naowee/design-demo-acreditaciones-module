import './StackedCell.scss';

import type { ReactNode } from 'react';

interface NwsStackedCellProps {
  primary: ReactNode;
  secondary?: ReactNode;
}

// Una celda de tabla con un dato principal y su matiz debajo.
//
// El rediseño lo usa en varias tablas para meter dos datos en una columna sin abrir otra: el
// tipo con su código, la persona con su documento, la fecha con quién la hizo. La sublínea va
// más pequeña y en gris, así que la fila se sigue leyendo por lo de arriba.
//
// Sin `secondary` no pinta la segunda línea, para que la fila no crezca al pedo cuando el dato
// no está: es justo el caso de todo lo que el backend todavía no manda.
export function NwsStackedCell({ primary, secondary }: NwsStackedCellProps) {
  return (
    <span className="nws-stacked-cell">
      <span className="nws-stacked-cell__primary">{primary}</span>

      {!!secondary && (
        <span className="nws-stacked-cell__secondary nwt-caption-font-regular">
          {secondary}
        </span>
      )}
    </span>
  );
}
