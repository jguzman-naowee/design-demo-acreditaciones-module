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
// Qué es: «Lotes generados», el lote de ACREDITACIONES del diseño. Sus datos viven en
// memoria y se pierden al recargar. Su hermana conectada es «Lotes de acreditaciones»,
// que sí tiene los lotes de PDF del backend.
// ═══════════════════════════════════════════════════════════════════════════════

import './DeliveryPages.scss';

import { AccreditationBatchRepository } from '@mf-accreditations/data';
import type { AccreditationBatch } from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  NwsLoading,
  NwsRowActionsMenu,
  useCatalogPage
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtCard,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';
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

const repository = invertly(AccreditationBatchRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

const TYPE_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Tipo', value: 'all' },
  ...TIPOS_DEL_MOCK.map((type) => ({
    key: type,
    label: type,
    value: type
  }))
];

interface BatchRowProps {
  batch: AccreditationBatch;
  onView: (batch: AccreditationBatch) => void;
}

const BatchRow = memo(function BatchRow({ batch, onView }: BatchRowProps) {
  return (
    <NwtDatatableRecord>
      <NwtDatatableCell className="nwt-width-xs-30">
        <span className="nwt-text-font-medium">{batch.label}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-35">
        <span>{batch.typeLabel}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-35">
        <span>{formatCatalogDate(batch.createdAt)}</span>
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones del ${batch.label.toLowerCase()}`}
          actions={[
            {
              key: 'view',
              icon: 'package',
              label: 'Ver lote',
              onClick: () => onView(batch)
            }
          ]}
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function GeneratedBatchesPage() {
  const controller = useRepository(repository);
  const navigate = useNavigate();

  const search = useInputControl<string>('');
  const typeFilter = useFormControl<string | undefined>('all');

  const batches = useMemo(
    () => (controller.state.is('success') ? controller.state.entities : []),
    [controller.state]
  );

  const batchesFiltered = useMemo(() => {
    const query = search.value.trim().toLowerCase();

    return batches.filter((batch) => {
      if (typeFilter.value !== 'all' && batch.typeLabel !== typeFilter.value) {
        return false;
      }

      return query ? batch.label.toLowerCase().includes(query) : true;
    });
  }, [batches, search.value, typeFilter.value]);

  const { page, pageItems, setPage, totalPages } =
    useCatalogPage(batchesFiltered);

  const onView = useCallback(
    (batch: AccreditationBatch) => {
      navigate(`/delivery/batches/${batch.id}`);
    },
    [navigate]
  );

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando lotes, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('success') || controller.state.is('empty')) {
      return (
        <NwtCard className="nws-generated-batches__catalog">
          <div className="nws-delivery__filters">
            <div className="nws-delivery__search">
              <NwtSearchbox formControl={search} placeholder="Buscar lote" />

              <NwtDropdown
                formControl={typeFilter}
                options={TYPE_FILTER_OPTIONS}
              />
            </div>

            <NwtPagination
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
              nwtSize="small"
            />
          </div>

          {batchesFiltered.length ? (
            <NwtDatatable
              header={
                <NwtDatatableHeader>
                  <NwtDatatableTitle className="nwt-width-xs-30">
                    Número de lote
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-35">
                    Tipo
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-35">
                    Fecha de creación
                  </NwtDatatableTitle>
                  <NwtDatatableTitle
                    className="nwt-align-right"
                    actions={true}
                  />
                </NwtDatatableHeader>
              }
            >
              {pageItems.map((batch) => (
                <BatchRow key={batch.id} batch={batch} onView={onView} />
              ))}
            </NwtDatatable>
          ) : (
            <NwtEmptyState
              illustrationUrl={illustrationUrl}
              title={batches.length ? 'Sin resultados' : 'Aún no hay lotes'}
              description={
                batches.length
                  ? 'Ningún lote coincide con la búsqueda.'
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
    <section className="nws-delivery nws-generated-batches">
      <DeliveryCounters />

      <div className="nws-delivery__content">
        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Lotes generados</span>

            <small className="nwt-smalltext-font-regular">
              Gestiona los lotes generados
            </small>
          </div>
        </div>

        {renderCatalog()}
      </div>
    </section>
  );
}
