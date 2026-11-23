import { AccreditationEventRepository } from '@mf-accreditations/data';
import type { Accreditation } from '@mf-accreditations/domain';
import {
  ACCREDITATION_ACTIONS,
  downloadCsv,
  formatEventDateTime,
  getAccreditationActionLabel,
  getAccreditationActionTheme,
  NwsHistoryTable,
  NwsLoading,
  NwsReportLink,
  useCatalogPage
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtContext,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl } from '@rolster/react-forms';
import { useCallback, useContext, useMemo } from 'react';


const repository = invertly(AccreditationEventRepository);

const ACTION_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Acción', value: 'all' },
  ...ACCREDITATION_ACTIONS.map((action) => ({
    key: action,
    label: getAccreditationActionLabel(action),
    value: action
  }))
];

interface AccreditationHistoryProps {
  accreditation: Accreditation;
}

export function AccreditationHistory({
  accreditation
}: AccreditationHistoryProps) {
  const controller = useRepository(repository);
  const { toast } = useContext(NwtContext);

  const actionFilter = useFormControl<string | undefined>('all');

  // El mock devuelve la colección completa; el historial de esta acreditación se
  // recorta aquí, igual que hace el detalle del lote.
  const events = useMemo(() => {
    return controller.state.is('success')
      ? repository.findByAccreditation(String(accreditation.id))
      : [];
  }, [controller.state, accreditation.id]);

  const eventsFiltered = useMemo(() => {
    return actionFilter.value === 'all'
      ? events
      : events.filter((event) => event.action === actionFilter.value);
  }, [events, actionFilter.value]);

  const { page, pageItems, setPage, totalPages } =
    useCatalogPage(eventsFiltered);

  // La tabla la comparten esta pantalla y el detalle real, así que recibe filas ya resueltas.
  const rows = useMemo(
    () =>
      pageItems.map((event) => ({
        action: getAccreditationActionLabel(event.action),
        actionTheme: getAccreditationActionTheme(event.action),
        at: formatEventDateTime(event.createdAt),
        author: event.author,
        detail: event.detail,
        id: String(event.id),
        note: event.note,
        type: event.accreditedType
      })),
    [pageItems]
  );

  const onDownloadReport = useCallback(() => {
    try {
      downloadCsv(
        `historial-${accreditation.document}.csv`,
        ['Tipo de acreditado', 'Acción', 'Detalle', 'Fecha', 'Realizado por'],
        eventsFiltered.map((event) => [
          event.accreditedType,
          getAccreditationActionLabel(event.action),
          event.detail,
          formatEventDateTime(event.createdAt),
          event.author
        ])
      );
    } catch {
      toast({
        title: 'Error al descargar',
        message: 'No fue posible generar el reporte. Inténtalo nuevamente.',
        icon: 'caution',
        theme: 'negative'
      });
    }
  }, [accreditation.document, eventsFiltered, toast]);

  if (controller.state.is('loading')) {
    return (
      <NwsLoading>
        <h4>Cargando historial, por favor espere...</h4>
      </NwsLoading>
    );
  }

  return (
    <div className="nws-accreditation-history">
      <div className="nws-delivery__filters">
        <NwtDropdown
          formControl={actionFilter}
          options={ACTION_FILTER_OPTIONS}
        />

        <NwtPagination
          currentPage={page}
          totalPages={totalPages}
          onChange={setPage}
          nwtSize="small"
        />
      </div>

      <div className="nws-accreditation-history__header">
        <span className="nwt-subtitle-font-bold">
          Información de la acreditación
        </span>

        <NwsReportLink
          disabled={!eventsFiltered.length}
          onClick={onDownloadReport}
        />
      </div>

      {eventsFiltered.length ? (
        <NwsHistoryTable rows={rows} />
      ) : (
        <NwtEmptyState
          title="Sin movimientos"
          description={
            events.length
              ? 'Ninguna acción coincide con el filtro.'
              : 'Esta acreditación todavía no tiene historial.'
          }
          showAction={false}
        />
      )}
    </div>
  );
}
