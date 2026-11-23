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
// Qué es: el detalle de un «Lote generado». Solo se alcanza desde esa pantalla, que
// también está marcada, así que muere con ella.
// ═══════════════════════════════════════════════════════════════════════════════

import './DeliveryPages.scss';

import { AccreditationBatchRepository } from '@mf-accreditations/data';
import type { BatchPerson } from '@mf-accreditations/domain';
import {
  downloadCsv,
  NwsLoading,
  NwsSuccessModal,
  useCatalogPage
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import {
  NwtBreadcrumb,
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtEmptyState,
  NwtIconButton,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  BATCH_CREATED_BULLETS,
  BATCH_DOWNLOADED_BULLETS,
  downloadBatchCopy
} from './delivery.copy';
import {
  type DeliveryConfirmCopy,
  DeliveryConfirmModal
} from './DeliveryConfirmModal';
import { DeliveryCounters } from './DeliveryCounters';

const repository = invertly(AccreditationBatchRepository);

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;
const PREVIEW_LIMIT = 8;

export type BatchDetailOrigin = 'enabled' | 'batches';

const ORIGIN_COPY: Record<
  BatchDetailOrigin,
  { backLabel: string; backRoute: string; subtitle: string; title: string }
> = {
  enabled: {
    backLabel: 'Lista de habilitados',
    backRoute: '/delivery/enabled',
    title: 'Acreditaciones generadas',
    subtitle: 'Visualización de acreditaciones generadas'
  },
  batches: {
    backLabel: 'Lotes generados',
    backRoute: '/delivery/batches',
    title: 'Lotes generados',
    subtitle: 'Gestiona los lotes generados'
  }
};

interface CredentialCardProps {
  person: BatchPerson;
}

// Marcador visual: el documento real lo generará el backend.
function CredentialCard({ person }: CredentialCardProps) {
  return (
    <article className="nws-batch-detail__credential">
      <div className="nws-batch-detail__credential-photo" />

      <div className="nws-batch-detail__credential-body">
        <span className="nws-batch-detail__credential-name">
          {person.fullName}
        </span>
        <small className="nws-batch-detail__credential-type">
          {person.accreditedType.toUpperCase()}
        </small>
        <small className="nws-batch-detail__credential-document">
          {person.document}
        </small>
      </div>

      <div className="nws-batch-detail__credential-code" />
    </article>
  );
}

interface BatchDetailPageProps {
  origin: BatchDetailOrigin;
}

export function BatchDetailPage({ origin }: BatchDetailPageProps) {
  const controller = useRepository(repository);
  const { toast } = useContext(NwtContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { batchId } = useParams();

  const search = useInputControl<string>('');
  const [zoom, setZoom] = useState(1);
  const [confirmCopy, setConfirmCopy] = useState<DeliveryConfirmCopy>();
  const [downloadedVisible, setDownloadedVisible] = useState(false);
  const [createdVisible, setCreatedVisible] = useState(
    !!(location.state as { created?: boolean } | null)?.created
  );

  const copy = ORIGIN_COPY[origin];

  const batch = useMemo(() => {
    return controller.state.is('success')
      ? controller.state.entities.find((item) => String(item.id) === batchId)
      : undefined;
  }, [controller.state, batchId]);

  const peopleFiltered = useMemo(() => {
    const query = search.value.trim().toLowerCase();

    if (!batch) {
      return [];
    }

    return query
      ? batch.people.filter(
          (person) =>
            person.fullName.toLowerCase().includes(query) ||
            person.document.includes(query)
        )
      : batch.people;
  }, [batch, search.value]);

  const { page, pageItems, setPage, totalPages } =
    useCatalogPage(peopleFiltered);

  const onDownloadFile = useCallback(() => {
    if (!batch) {
      return false;
    }

    try {
      downloadCsv(
        `lote-${batch.number}.csv`,
        ['No.', 'Tipo', 'Nombre', 'Documento'],
        batch.people.map((person, index) => [
          index + 1,
          person.accreditedType,
          person.fullName,
          person.document
        ])
      );

      return true;
    } catch {
      toast({
        title: 'Error al descargar',
        message: 'No fue posible descargar el lote. Inténtalo nuevamente.',
        icon: 'caution',
        theme: 'negative'
      });

      return false;
    }
  }, [batch, toast]);

  // Al llegar desde la creación el documento se descarga solo (lo anuncia el
  // modal de éxito); el ref evita repetirlo en los re-render posteriores.
  const autoDownloadedRef = useRef(false);

  useEffect(() => {
    if (createdVisible && batch && !autoDownloadedRef.current) {
      autoDownloadedRef.current = true;

      onDownloadFile();
    }
  }, [createdVisible, batch, onDownloadFile]);

  const onAskDownload = useCallback(() => {
    if (batch) {
      setConfirmCopy(downloadBatchCopy(batch.total));
    }
  }, [batch]);

  const onConfirmDownload = useCallback(async () => {
    setConfirmCopy(undefined);

    if (!batch || !onDownloadFile()) {
      return;
    }

    try {
      await repository.markDownloaded(batch);

      setDownloadedVisible(true);
    } catch {
      toast({
        title: 'No se pudo actualizar el lote',
        message: 'El archivo se descargó, pero el estado no cambió.',
        icon: 'caution',
        theme: 'negative'
      });
    }
  }, [batch, onDownloadFile, toast]);

  if (controller.state.is('loading')) {
    return (
      <section className="nws-delivery">
        <DeliveryCounters />

        <div className="nws-delivery__content">
          <NwsLoading>
            <h4>Cargando lote, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  if (!batch) {
    return (
      <section className="nws-delivery">
        <DeliveryCounters />

        <div className="nws-delivery__content">
          <NwtEmptyState
            title="No encontramos el lote"
            description="Es posible que se haya generado en otra sesión."
            actionLabel={`Volver a ${copy.backLabel.toLowerCase()}`}
            showAction={true}
            onActionClick={() => navigate(copy.backRoute)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="nws-delivery nws-batch-detail">
      <DeliveryCounters />

      <div className="nws-delivery__content">
        <NwtBreadcrumb
          items={[
            { key: 'back', label: copy.backLabel },
            { key: 'batch', label: batch.label, active: true }
          ]}
          onBreadcrumb={(item) =>
            item.key === 'back' && navigate(copy.backRoute)
          }
        />

        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">{copy.title}</span>

            <small className="nwt-smalltext-font-regular">
              {copy.subtitle}
            </small>
          </div>

          <div className="nws-delivery__actions">
            <NwtButton
              icon="download"
              nwtVariant="loud"
              nwtTheme="negative"
              nwtSize="medium"
              onClick={onAskDownload}
            >
              Descargar lote
            </NwtButton>
          </div>
        </div>

        <div className="nws-batch-detail__panels">
          <NwtCard
            className="nws-batch-detail__list"
            header={
              <span className="nwt-subtitle-font-bold">{batch.label}</span>
            }
          >
            <div className="nws-batch-detail__list-filters">
              <NwtSearchbox formControl={search} placeholder="Buscar usuario" />

              <NwtPagination
                currentPage={page}
                totalPages={totalPages}
                onChange={setPage}
                nwtSize="small"
              />
            </div>

            <NwtDatatable
              header={
                <NwtDatatableHeader>
                  <NwtDatatableTitle className="nwt-width-xs-10">
                    No.
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-25">
                    Tipo
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-35">
                    Nombre
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-30">
                    Documento
                  </NwtDatatableTitle>
                </NwtDatatableHeader>
              }
            >
              {pageItems.map((person, index) => (
                <NwtDatatableRecord key={person.document}>
                  <NwtDatatableCell className="nwt-width-xs-10">
                    {(page - 1) * 10 + index + 1}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-25">
                    {person.accreditedType}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-35">
                    {person.fullName}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-30">
                    {person.document}
                  </NwtDatatableCell>
                </NwtDatatableRecord>
              ))}
            </NwtDatatable>
          </NwtCard>

          <NwtCard
            className="nws-batch-detail__preview"
            header={
              <span className="nwt-subtitle-font-bold">Previsualización</span>
            }
          >
            <div className="nws-batch-detail__sheet-wrapper">
              <div className="nws-batch-detail__sheet">
                <div className="nws-batch-detail__zoom">
                  <NwtIconButton
                    icon="zoom-out"
                    ariaLabel="Alejar"
                    nwtVariant="mute"
                    nwtSize="small"
                    disabled={zoom <= ZOOM_MIN}
                    onClick={() =>
                      setZoom((current) =>
                        Math.max(
                          ZOOM_MIN,
                          Number((current - ZOOM_STEP).toFixed(2))
                        )
                      )
                    }
                  />
                  <NwtIconButton
                    icon="zoom-in"
                    ariaLabel="Acercar"
                    nwtVariant="mute"
                    nwtSize="small"
                    disabled={zoom >= ZOOM_MAX}
                    onClick={() =>
                      setZoom((current) =>
                        Math.min(
                          ZOOM_MAX,
                          Number((current + ZOOM_STEP).toFixed(2))
                        )
                      )
                    }
                  />
                  <NwtIconButton
                    icon="download"
                    ariaLabel="Descargar lote"
                    nwtVariant="mute"
                    nwtSize="small"
                    onClick={onAskDownload}
                  />
                </div>

                <div
                  className="nws-batch-detail__credentials"
                  style={{ transform: `scale(${zoom})` }}
                >
                  {batch.people.slice(0, PREVIEW_LIMIT).map((person) => (
                    <CredentialCard key={person.document} person={person} />
                  ))}
                </div>

                {batch.people.length > PREVIEW_LIMIT && (
                  <small className="nws-batch-detail__sheet-more">
                    {`y ${batch.people.length - PREVIEW_LIMIT} más`}
                  </small>
                )}
              </div>
            </div>
          </NwtCard>
        </div>
      </div>

      <DeliveryConfirmModal
        copy={confirmCopy}
        onCancel={() => setConfirmCopy(undefined)}
        onConfirm={onConfirmDownload}
      />

      <NwsSuccessModal
        visible={createdVisible}
        title="¡Lote creado exitosamente!"
        message={`Creaste el lote ${batch.number} con ${batch.total} acreditaciones, de forma exitosa, estas se registrarán automáticamente con la fecha de creación y su estado será activo.`}
        bullets={BATCH_CREATED_BULLETS}
        onClose={() => setCreatedVisible(false)}
      />

      <NwsSuccessModal
        visible={downloadedVisible}
        title="¡Lote descargado exitosamente!"
        message={`El lote ${batch.number} fue descargado correctamente y su estado fue actualizado.`}
        bullets={BATCH_DOWNLOADED_BULLETS}
        onClose={() => setDownloadedVisible(false)}
      />
    </section>
  );
}
