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
// Qué es: el detalle del acreditado contra mocks. Su ruta
// (`/delivery/accredited/:accreditationId`) está MUERTA: ni el menú ni ninguna fila
// navegan a ella —«Lista de acreditados» manda sus filas a
// `/delivery/event-accredited/:code`, que es el detalle con datos reales—.
// ═══════════════════════════════════════════════════════════════════════════════

import './DeliveryPages.scss';

import {
  AccreditationRepository,
  DOCUMENT_TYPE_LABELS,
  SEX_LABELS
} from '@mf-accreditations/data';
import {
  formatCatalogDate,
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  getDeliveryStatusLabel,
  getDeliveryStatusTheme,
  NwsDetailField,
  NwsLoading,
  NwsRowActionsMenu,
  NwsSuccessModal
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtTabItem } from '@naowee-tech/sdk-react-components';
import {
  NwtBadge,
  NwtBreadcrumb,
  NwtCard,
  NwtDivider,
  NwtEmptyState,
  NwtTabs
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAccreditationActions } from './accreditation-actions.hook';
import { AccreditationHistory } from './AccreditationHistory';
import { DeliveryActionsButton } from './DeliveryActionsButton';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';
import { DeliveryCounters } from './DeliveryCounters';

const repository = invertly(AccreditationRepository);

const LIST_ROUTE = '/delivery/accredited';

type DetailTab = 'data' | 'history';

const TABS: NwtTabItem<DetailTab>[] = [
  { id: 'data', label: 'Datos', value: 'data' },
  { id: 'history', label: 'Historial', value: 'history' }
];

export function AccreditedDetailPage() {
  const controller = useRepository(repository);
  const navigate = useNavigate();
  const { accreditationId } = useParams();

  const [tab, setTab] = useState<DetailTab>('data');

  const accreditation = useMemo(() => {
    return controller.state.is('success')
      ? controller.state.entities.find(
          (item) => String(item.id) === accreditationId
        )
      : undefined;
  }, [controller.state, accreditationId]);

  const {
    askDeactivate,
    askDeliver,
    confirmCopy,
    onCancel,
    onCloseSuccess,
    onConfirm,
    successCopy
  } = useAccreditationActions();

  if (controller.state.is('loading')) {
    return (
      <section className="nws-delivery">
        <DeliveryCounters />

        <div className="nws-delivery__content">
          <NwsLoading>
            <h4>Cargando acreditado, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  if (!accreditation) {
    return (
      <section className="nws-delivery">
        <DeliveryCounters />

        <div className="nws-delivery__content">
          <NwtEmptyState
            title="No encontramos el acreditado"
            description="Es posible que su acreditación se haya generado en otra sesión."
            actionLabel="Volver a lista de acreditados"
            showAction={true}
            onActionClick={() => navigate(LIST_ROUTE)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="nws-delivery nws-accredited-detail">
      <DeliveryCounters />

      <div className="nws-delivery__content">
        <NwtBreadcrumb
          items={[
            { key: 'back', label: 'Lista de acreditados' },
            { key: 'detail', label: 'Detalle del acreditado', active: true }
          ]}
          onBreadcrumb={(item) => item.key === 'back' && navigate(LIST_ROUTE)}
        />

        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Detalle del acreditado</span>

            <small className="nwt-smalltext-font-regular">
              Gestiona la acreditación y el historial de cambios
            </small>
          </div>
        </div>

        <NwtCard
          className="nws-accredited-detail__card"
          header={
            <NwtTabs<DetailTab> items={TABS} value={tab} onChange={setTab} />
          }
        >
          {tab === 'data' ? (
            <div className="nws-accredited-detail__panel">
              <header className="nws-accredited-detail__section">
                <div className="nws-accredited-detail__section-title">
                  <span className="nwt-subtitle-font-bold">
                    Información básica
                  </span>

                  <NwtBadge
                    nwtVariant="quiet"
                    nwtTheme={getCatalogStatusTheme(accreditation.status)}
                    vignette={true}
                  >
                    {getCatalogStatusLabel(accreditation.status)}
                  </NwtBadge>
                </div>

                <NwsRowActionsMenu
                  actions={[
                    {
                      key: 'deliver',
                      icon: 'edit',
                      label: 'Entregar acreditación',
                      disabled: accreditation.deliveryStatus === 'DELIVERED',
                      onClick: () => askDeliver([accreditation])
                    },
                    {
                      key: 'deactivate',
                      icon: 'delete',
                      label: 'Inactivar acreditación',
                      disabled: accreditation.status === 'INACTIVE',
                      onClick: () => askDeactivate([accreditation])
                    }
                  ]}
                  trigger={(open) => <DeliveryActionsButton open={open} />}
                />
              </header>

              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--2">
                  <NwsDetailField label="Tipo de documento">
                    {DOCUMENT_TYPE_LABELS[accreditation.documentType] ??
                      accreditation.documentType}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Número de documento">
                    {accreditation.document}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Nombre">
                    {accreditation.firstName}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Segundo nombre">
                    {accreditation.secondName || '—'}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Apellido">
                    {accreditation.lastName}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Segundo apellido">
                    {accreditation.secondLastName || '—'}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Sexo">
                    {SEX_LABELS[accreditation.sex] ?? accreditation.sex}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Correo electrónico">
                    {accreditation.email}
                  </NwsDetailField>
                </div>
              </div>

              <NwtDivider />

              <span className="nwt-subtitle-font-bold">
                Información de acreditación
              </span>

              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--2">
                  <NwsDetailField label="Tipo de usuario">
                    {accreditation.userType}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Rol">
                    {accreditation.role}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Tipo de acreditado">
                    {accreditation.accreditedType}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="No. de lote">
                    {accreditation.batchLabel}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Fecha de generación">
                    {formatCatalogDate(accreditation.createdAt)}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Fecha de impresión">
                    {formatCatalogDate(accreditation.printedAt)}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Estado">
                    <NwtBadge
                      nwtVariant="quiet"
                      nwtTheme={getDeliveryStatusTheme(
                        accreditation.deliveryStatus
                      )}
                      vignette={true}
                    >
                      {getDeliveryStatusLabel(accreditation.deliveryStatus)}
                    </NwtBadge>
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Fecha de modificación">
                    {formatCatalogDate(accreditation.modifiedAt)}
                  </NwsDetailField>
                </div>
              </div>
            </div>
          ) : (
            <AccreditationHistory accreditation={accreditation} />
          )}
        </NwtCard>
      </div>

      <DeliveryConfirmModal
        copy={confirmCopy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />

      <NwsSuccessModal
        visible={!!successCopy}
        title={successCopy?.title ?? ''}
        caution={successCopy?.caution}
        bullets={successCopy?.bullets}
        onClose={onCloseSuccess}
      />
    </section>
  );
}
