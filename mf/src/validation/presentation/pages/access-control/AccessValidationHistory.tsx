import { ValidationLogByAccreditationRepository } from '@mf-accreditations/data';
import type {
  AccreditedRecordDetail,
  ValidationLog
} from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  type NwsHistoryRow,
  NwsHistoryTable,
  NwsLoading,
  useCatalogPage
} from '@mf-accreditations/presentation';
import type {
  NwtSelectOption,
  NwtTheme
} from '@naowee-tech/sdk-react-components';
import {
  NwtDropdown,
  NwtEmptyState,
  NwtPagination
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl } from '@rolster/react-forms';
import { useEffect, useMemo, useState } from 'react';

const repository = invertly(ValidationLogByAccreditationRepository);

// Lo que el backend registra en una lectura. Solo hay concedidas —ver el aviso de abajo— pero el
// mapa cubre las dos por si el contrato cambia: un valor nuevo saldría en crudo antes que
// esconder una lectura.
const RESULT_LABELS: Record<string, string> = {
  GRANTED: 'Escaneada con éxito',
  DENIED: 'Escaneada con error'
};

const RESULT_THEMES: Record<string, NwtTheme> = {
  GRANTED: 'positive',
  DENIED: 'negative'
};

const resultLabel = (result: string) => RESULT_LABELS[result] ?? result;

function filterOptions(logs: ValidationLog[]): NwtSelectOption<string>[] {
  const results = [...new Set(logs.map((log) => log.resultCode))];

  return [
    { key: 'all', label: 'Acción', value: 'all' },
    ...results.map((result) => ({
      key: result,
      label: resultLabel(result),
      value: result
    }))
  ];
}

interface AccessValidationHistoryProps {
  detail: AccreditedRecordDetail;
}

// El historial de validaciones de una acreditación: una fila por lectura registrada en un punto
// de acceso.
//
// Comparte la tabla con el historial de la acreditación —misma composición del diseño, cuatro
// columnas— cambiando el rótulo de la última por «Fecha de validación».
//
// TODO(api): de las tres cosas que el diseño pedía y este endpoint no daba, quedan DOS. Los
// usos consumidos y las lecturas denegadas ya llegan —medido en dev el 2026-09-03: siete de las
// catorce lecturas del evento 1 son DENIED con su motivo, y el contrato trae `used_count` y
// `max_uses_per_person` congelados en el momento de la lectura—; el comentario que decía que
// las denegadas «no se registran» era del 2026-08-13 y dejó de ser cierto sin que lo miráramos.
// Lo que sigue faltando es el NOMBRE del validador: solo viene su `validator_user_code`.
export function AccessValidationHistory({
  detail
}: AccessValidationHistoryProps) {
  const [logs, setLogs] = useState<ValidationLog[]>();
  const resultFilter = useFormControl<string | undefined>('all');

  useEffect(() => {
    let alive = true;

    repository
      .requestAll(String(detail.id))
      // Si las lecturas no cargan, la pestaña se muestra vacía en lugar de tumbar el detalle:
      // el historial de accesos no es lo crítico de esta pantalla.
      .catch(() => [])
      .then((rows) => {
        if (alive) {
          setLogs(rows);
        }
      });

    return () => {
      alive = false;
    };
  }, [detail.id]);

  const filtered = useMemo(() => {
    const rows = logs ?? [];

    return resultFilter.value === 'all'
      ? rows
      : rows.filter((log) => log.resultCode === resultFilter.value);
  }, [logs, resultFilter.value]);

  const { page, pageItems, setPage, totalPages } = useCatalogPage(filtered);

  const rows = useMemo<NwsHistoryRow[]>(
    () =>
      pageItems.map((log) => ({
        action: resultLabel(log.resultCode),
        actionTheme: RESULT_THEMES[log.resultCode] ?? 'neutral',
        at: formatCatalogDate(log.scannedAt),
        // Sin nombre: el contrato solo trae el `validator_user_code`, y las iniciales de un
        // uuid no le dicen nada a nadie.
        author: '',
        // El permiso que se consumió en la lectura. El diseño pone acá los usos («11/30») y el
        // log no los trae; el permiso leído es el dato real más útil de esa columna.
        detail: log.permissionName,
        id: String(log.id),
        note: log.observation || undefined,
        type: detail.roleName
      })),
    [pageItems, detail.roleName]
  );

  if (!logs) {
    return (
      <NwsLoading>
        <h4>Cargando validaciones, por favor espere...</h4>
      </NwsLoading>
    );
  }

  return (
    <div className="nws-access-control__panel">
      <div className="nws-access-control__filters">
        {/* El filtro solo aparece si hay más de un resultado que filtrar. */}
        {filterOptions(logs).length > 2 && (
          <NwtDropdown
            formControl={resultFilter}
            options={filterOptions(logs)}
          />
        )}

        {totalPages > 1 && (
          <NwtPagination
            currentPage={page}
            totalPages={totalPages}
            onChange={setPage}
            nwtSize="small"
          />
        )}
      </div>

      <div className="nws-access-control__history-header">
        <span className="nwt-subtitle-font-bold">
          Información de la acreditación
        </span>
      </div>

      {filtered.length ? (
        <NwsHistoryTable rows={rows} dateLabel="Fecha de validación" />
      ) : (
        <NwtEmptyState
          title="Sin validaciones"
          description={
            logs.length
              ? 'Ninguna lectura coincide con el filtro.'
              : 'Esta acreditación todavía no se ha leído en ningún punto de acceso.'
          }
          showAction={false}
        />
      )}

      {/* Acá había un aviso que decía «Acá se ven las validaciones concedidas. Un intento
          rechazado no queda registrado, así que esta lista no sirve para revisar los
          fallidos». Era falso: medido en dev el 2026-09-03, siete de las catorce lecturas del
          evento 1 son DENIED y traen su motivo. La tabla ya rotula cada lectura con su
          resultado —«Escaneada con éxito» / «Escaneada con error»—, así que no hace falta
          ningún aviso: el que había mandaba a auditar los fallos a otra parte. */}
    </div>
  );
}
