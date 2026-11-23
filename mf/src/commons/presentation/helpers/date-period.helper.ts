import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';

// El SDK no tiene un dropdown de fechas (NwtDateField abre un calendario), así
// que el filtro del diseño se arma con períodos, como ya hace el listado de
// eventos de suite-web-v2.
export type DatePeriod = 'all' | 'today' | 'week' | 'month';

const PERIOD_DAYS: Record<Exclude<DatePeriod, 'all'>, number> = {
  today: 1,
  week: 7,
  month: 30
};

export const DATE_PERIOD_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Fecha', value: 'all' },
  { key: 'today', label: 'Hoy', value: 'today' },
  { key: 'week', label: 'Últimos 7 días', value: 'week' },
  { key: 'month', label: 'Últimos 30 días', value: 'month' }
];

// Ventana móvil hacia atrás desde el comienzo del día de hoy: "Hoy" es el día
// en curso, y los demás períodos suman días completos.
export function isWithinPeriod(date: Date, period?: string): boolean {
  if (!period || period === 'all') {
    return true;
  }

  const days = PERIOD_DAYS[period as Exclude<DatePeriod, 'all'>];

  if (!days) {
    return true;
  }

  const from = new Date();

  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

  return date >= from;
}
