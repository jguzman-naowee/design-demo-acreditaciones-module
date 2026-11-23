import './DateTimeCell.scss';

import { dateFormatTemplate } from '@rolster/dates';

import { formatDayLabel } from '../../helpers/format.helper';

interface NwsDateTimeCellProps {
  date: Date | null;
  empty?: string;
}

// La fecha de una celda de tabla, con su hora debajo.
//
// El rediseño la parte en dos líneas —«Ago 18, 2026» arriba, «10:15 AM» abajo— porque en estas
// tablas la hora importa: dos acreditaciones del mismo día se distinguen por ella, y puesta en
// la misma línea alarga la columna hasta partirla.
//
// Va como componente propio y NO tocando `formatCatalogDate`: ese helper lo usan diez pantallas
// del módulo, y el rediseño de momento solo llegó a dos. Cuando el resto migre, este es el sitio
// —y ahí la fecha del módulo entera pasa a este formato de una vez—.
export function NwsDateTimeCell({ date, empty = '—' }: NwsDateTimeCellProps) {
  if (!date) {
    return <span>{empty}</span>;
  }

  return (
    <span className="nws-datetime-cell">
      {/* Sin `toLowerCase`, que convertiría el AM/PM del renglón de abajo. */}
      <span className="nws-datetime-cell__date">
        {formatDayLabel(date)}
      </span>

      <span className="nws-datetime-cell__time nwt-caption-font-regular">
        {dateFormatTemplate(date, '{hz}:{ii} {zz}')}
      </span>
    </span>
  );
}
