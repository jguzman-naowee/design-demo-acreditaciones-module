// ═══════════════════════════════════════════════════════════════════════════════
// PRÓXIMA A BORRAR — decisión de producto, 2026-09-03
//
// A esta pantalla solo se llega escribiendo su URL: no está en el menú y nada del
// módulo la enlaza. Andrés decidió que las que están así no se van a usar.
//
// Se marca en vez de borrarse ya para que la eliminación sea un cambio propio y
// revisable, no un arrastre. La lista completa está en el README, sección
// «Pantallas próximas a borrar».
//
// Qué es: «Historial», una fila por acreditación con su último movimiento. Contra mocks.
// Lo que hacía lo cubren hoy la pestaña «Historial» del detalle (por acreditación) y
// «Auditoría del evento» (transversal, con las lecturas). Cuando exista el endpoint
// transversal de auditoría, esta vista sale gratis dentro de la auditoría.
// ═══════════════════════════════════════════════════════════════════════════════

import './DeliveryPages.scss';

import {
  AccreditationEventRepository,
  AccreditationRepository
} from '@mf-accreditations/data';
import {
  DATE_PERIOD_OPTIONS,
  downloadCsv,
  formatCatalogDate,
  formatEventDateTime,
  getAccreditationActionLabel,
  getCatalogStatusLabel,
  isWithinPeriod,
  NwsLoading,
  NwsReportLink,
  useCatalogPage
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtCard,
  NwtContext,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useMemo } from 'react';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import type { AccreditationMovement } from './AccreditationMovementsTable';
import { AccreditationMovementsTable } from './AccreditationMovementsTable';
import { DeliveryCounters } from './DeliveryCounters';

// Los cinco nombres de la lista vieja, ahora locales.
//
// Esta pantalla está PRÓXIMA A BORRAR y corre contra mocks (ver el README): su filtro se
// queda con la lista de siempre en vez de arrastrar el catálogo del gateway a una vista que
// no se va a usar. El catálogo real vive en EventRoleCatalogRepository.
const TIPOS_DEL_MOCK = [
  'Delegado',
  'Voluntario',
  'Deportista',
  'Coordinador logístico',
  'Invitado especial'
];

const repository = invertly(AccreditationRepository);
const eventRepository = invertly(AccreditationEventRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

const TYPE_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Tipo', value: 'all' },
  ...TIPOS_DEL_MOCK.map((type) => ({
    key: type,
    label: type,
    value: type
  }))
];

const STATUS_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Estado', value: 'all' },
  { key: 'ACTIVE', label: 'Activa', value: 'ACTIVE' },
  { key: 'INACTIVE', label: 'Inactiva', value: 'INACTIVE' }
];

export function AccreditationMovementsPage() {
  const controller = useRepository(repository);
  const eventController = useRepository(eventRepository);
  const { toast } = useContext(NwtContext);

  const search = useInputControl<string>('');
  const typeFilter = useFormControl<string | undefined>('all');
  const dateFilter = useFormControl<string | undefined>('all');
  const statusFilter = useFormControl<string | undefined>('all');

  // Una fila por acreditación, con su último movimiento: las columnas Acciones y
  // Última modificación salen del historial que ya registra cada operación.
  const movements = useMemo<AccreditationMovement[]>(() => {
    if (!controller.state.is('success')) {
      return [];
    }

    const latest = eventController.state.is('success')
      ? eventRepository.latestByAccreditation()
      : new Map();

    return controller.state.entities.map((accreditation) => ({
      accreditation,
      event: latest.get(String(accreditation.id))
    }));
  }, [controller.state, eventController.state]);

  const movementsFiltered = useMemo(() => {
    const query = search.value.trim().toLowerCase();

    return movements.filter(({ accreditation, event }) => {
      if (
        typeFilter.value !== 'all' &&
        accreditation.accreditedType !== typeFilter.value
      ) {
        return false;
      }

      if (
        statusFilter.value !== 'all' &&
        accreditation.status !== statusFilter.value
      ) {
        return false;
      }

      if (
        dateFilter.value !== 'all' &&
        !(event && isWithinPeriod(event.createdAt, dateFilter.value))
      ) {
        return false;
      }

      if (query) {
        return (
          accreditation.fullName.toLowerCase().includes(query) ||
          accreditation.document.includes(query)
        );
      }

      return true;
    });
  }, [
    movements,
    search.value,
    typeFilter.value,
    dateFilter.value,
    statusFilter.value
  ]);

  const { page, pageItems, setPage, totalPages } =
    useCatalogPage(movementsFiltered);

  const onSearch = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const onDownloadReport = useCallback(() => {
    try {
      downloadCsv(
        'historial-de-movimientos.csv',
        [
          'Lote',
          'Tipo',
          'Nombre',
          'Documento',
          'Vencimiento',
          'Validaciones',
          'Acciones',
          'Estado',
          'Última modificación',
          'Realizado por'
        ],
        movementsFiltered.map(({ accreditation, event }) => [
          accreditation.batchLabel,
          accreditation.accreditedType,
          accreditation.fullName,
          accreditation.document,
          formatCatalogDate(accreditation.expiresAt),
          `${accreditation.validationsLabel}/${accreditation.validationLimit}`,
          event ? getAccreditationActionLabel(event.action) : '',
          getCatalogStatusLabel(accreditation.status),
          event ? formatEventDateTime(event.createdAt) : '',
          event?.author ?? ''
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
  }, [movementsFiltered, toast]);

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando movimientos, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('success') || controller.state.is('empty')) {
      return (
        <NwtCard className="nws-accreditation-movements__catalog">
          <div className="nws-delivery__filters">
            <div className="nws-delivery__search">
              <NwtSearchbox
                formControl={search}
                placeholder="Buscar por nombre o documento"
                onChange={onSearch}
              />

              <NwtDropdown
                formControl={typeFilter}
                options={TYPE_FILTER_OPTIONS}
              />

              <NwtDropdown
                formControl={dateFilter}
                options={DATE_PERIOD_OPTIONS}
              />

              <NwtDropdown
                formControl={statusFilter}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>

            <NwtPagination
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
              nwtSize="small"
            />
          </div>

          {movementsFiltered.length ? (
            <AccreditationMovementsTable movements={pageItems} />
          ) : (
            <NwtEmptyState
              illustrationUrl={illustrationUrl}
              title={
                movements.length ? 'Sin resultados' : 'Aún no hay movimientos'
              }
              description={
                movements.length
                  ? 'Ninguna acreditación coincide con los filtros.'
                  : 'Genera acreditaciones desde la lista de habilitados para verlas aquí.'
              }
              showAction={false}
            />
          )}
        </NwtCard>
      );
    }

    return <></>;
  }

  return (
    <section className="nws-delivery nws-accreditation-movements">
      <DeliveryCounters />

      <div className="nws-delivery__content">
        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Lista de acreditados</span>

            <small className="nwt-smalltext-font-regular">
              Historial de movimientos por acreditación
            </small>
          </div>

          <div className="nws-delivery__actions">
            <NwsReportLink
              disabled={!movementsFiltered.length}
              onClick={onDownloadReport}
            />
          </div>
        </div>

        {renderCatalog()}
      </div>
    </section>
  );
}
