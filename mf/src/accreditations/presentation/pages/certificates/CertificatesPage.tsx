import './CertificatesPages.scss';

import {
  ACCREDITATION_MANAGE,
  CertificateRepository,
  type GenerateCertificatesPayload
} from '@mf-accreditations/data';
import type {
  CertificateBatch,
  CertificateItem,
  EventSport
} from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsRequestError,
  openUploadedFile,
  useAccreditationCounters,
  useSearchTerm
} from '@mf-accreditations/presentation';
import { useSession } from '@naowee-tech/sdk-frontend-react';
import {
  NwtAlert,
  NwtBadge,
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtEmptyState,
  NwtSearchbox,
  NwtTextLink
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useEffect, useState } from 'react';

import {
  CARD_BATCH_STATUS_LABELS,
  CARD_BATCH_STATUS_THEMES
} from '../delivery/card-batch.status';
import {
  BATCHES_LOAD_ERROR,
  CERTIFICATE_GENERATION_SUBTITLE,
  CERTIFICATE_GENERATION_TITLE,
  GENERATE_ERROR,
  generatedAlert,
  GENERATING_ALERT,
  GENERATION_TIMEOUT_ALERT
} from './certificate.copy';
import { useCertificateGeneration } from './certificate-batch.helper';
import {
  GenerateCertificatesModal,
  type GenerationMode
} from './GenerateCertificatesModal';

const repository = invertly(CertificateRepository);

export function CertificatesPage() {
  return (
    <NwsEventGuard>
      {(scope) => <CertificatesScreen {...scope} />}
    </NwsEventGuard>
  );
}

function CertificatesScreen({ event, eventId, phase }: NwsEventScope) {
  const { toast } = useContext(NwtContext);
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [batches, setBatches] = useState<CertificateBatch[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [sports, setSports] = useState<EventSport[]>([]);

  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);

  const [modalMode, setModalMode] = useState<GenerationMode>();

  const generation = useCertificateGeneration(event.code);

  // Los mismos contadores que la pantalla de configuración; al terminar un lote se piden de
  // nuevo, porque generar certificados no cambia estos números pero entregar sí, y desde
  // aquí se sale a entregar.
  const counters = useAccreditationCounters(
    event.code,
    phase?.code,
    generation.status,
    phase?.momentCode
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);

    try {
      const [loadedBatches, loadedCertificates, loadedSports] =
        await Promise.all([
          repository.listBatches(event.code, phase?.momentScope),
          repository.listCertificates(
            event.code,
            query || undefined,
            phase?.momentScope
          ),
          repository.listEventSports(event.code, phase?.code)
        ]);

      setBatches(loadedBatches);
      setCertificates(loadedCertificates);
      setSports(phase ? phase.keepMomentSports(loadedSports) : loadedSports);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [event.code, phase?.code, phase?.momentCode, query]);

  useEffect(() => {
    void load();
  }, [load]);

  // Con el lote terminado se refrescan las dos tablas: el lote cambia de estado
  // y los certificados nuevos entran al listado de vigentes.
  useEffect(() => {
    if (generation.status === 'ready') {
      void load();
    }
  }, [generation.status, load]);

  const generate = useCallback(
    (payload: GenerateCertificatesPayload) => {
      setModalMode(undefined);

      void generation.generate(() => repository.generate(event.code, payload));
    },
    [event.code, generation]
  );

  useEffect(() => {
    if (generation.status === 'failure') {
      toast({
        title: 'Error',
        message: getApiErrorMessage(generation.error, GENERATE_ERROR),
        icon: 'caution',
        theme: 'negative'
      });
    }
  }, [generation.status, generation.error, toast]);

  if (loading && !batches.length && !certificates.length) {
    return <NwsLoading />;
  }

  if (loadError) {
    return (
      <NwsRequestError
        error={loadError}
        title={BATCHES_LOAD_ERROR}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <section className="nws-certificates">
      <NwsEventBar items={counters} />

      <div className="nws-certificates__content">
        <div className="nws-certificates__header">
          <div className="nws-certificates__description">
            <span className="nwt-h5-font-extrabold">
              {CERTIFICATE_GENERATION_TITLE}
            </span>

            <small className="nwt-smalltext-font-regular nws-certificates__subtitle">
              {CERTIFICATE_GENERATION_SUBTITLE}
            </small>
          </div>

          <div className="nws-certificates__actions">
            <NwtButton
              nwtVariant="mute"
              disabled={!canManage || generation.status === 'generating'}
              onClick={() => setModalMode('individual')}
            >
              Generar individual
            </NwtButton>

            <NwtButton
              nwtVariant="loud"
              disabled={!canManage || generation.status === 'generating'}
              loading={generation.status === 'requesting'}
              onClick={() => setModalMode('sport')}
            >
              Generar por deporte
            </NwtButton>
          </div>
        </div>

        {generation.status === 'generating' && (
          <NwtAlert nwtTheme="informative" visible={true}>
            {GENERATING_ALERT}
          </NwtAlert>
        )}

        {generation.status === 'timeout' && (
          <NwtAlert nwtTheme="caution" visible={true}>
            {GENERATION_TIMEOUT_ALERT}
          </NwtAlert>
        )}

        {generation.status === 'ready' && generation.requested && (
          <NwtAlert nwtTheme="positive" visible={true}>
            {generatedAlert(
              generation.requested.totalCertificates,
              generation.requested.deliveryDate
            )}
          </NwtAlert>
        )}

        <NwtCard>
          <h3 className="nwt-text-font-medium nws-certificates__section-title">
            Lotes de generación
          </h3>

          {batches.length ? (
            <NwtDatatable
              header={
                <NwtDatatableHeader>
                  <NwtDatatableTitle className="nwt-width-xs-20">
                    Lote
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-12-5">
                    Tipo
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-17-5">
                    Fecha de entrega
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-12-5">
                    Certificados
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-17-5">
                    Estado
                  </NwtDatatableTitle>
                </NwtDatatableHeader>
              }
            >
              {batches.map((batch) => (
                <NwtDatatableRecord key={batch.batchCode}>
                  <NwtDatatableCell className="nwt-width-xs-20">
                    {batch.sportCode ?? 'Individual'}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-12-5">
                    {batch.kind === 'BULK' ? 'Por deporte' : 'Individual'}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-17-5">
                    {batch.deliveryDate}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-12-5">
                    {batch.totalCertificates}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-17-5">
                    <NwtBadge
                      nwtVariant="quiet"
                      nwtTheme={
                        CARD_BATCH_STATUS_THEMES[batch.status] ?? 'neutral'
                      }
                      vignette={true}
                    >
                      {CARD_BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </NwtBadge>
                  </NwtDatatableCell>
                </NwtDatatableRecord>
              ))}
            </NwtDatatable>
          ) : (
            <NwtEmptyState
              title="Sin lotes"
              description="Aún no se han generado certificados para este evento."
            />
          )}
        </NwtCard>

        <NwtCard>
          <div className="nws-certificates__list-header">
            <h3 className="nwt-text-font-medium nws-certificates__section-title">
              Certificados vigentes
            </h3>

            <NwtSearchbox
              formControl={search}
              placeholder="Buscar por nombre o documento"
            />
          </div>

          {certificates.length ? (
            <NwtDatatable
              header={
                <NwtDatatableHeader>
                  <NwtDatatableTitle className="nwt-width-xs-25">
                    Nombre
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-15">
                    Documento
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-15">
                    Rol
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-15">
                    Fecha de entrega
                  </NwtDatatableTitle>
                  <NwtDatatableTitle className="nwt-width-xs-12-5">
                    Estado
                  </NwtDatatableTitle>
                  <NwtDatatableTitle
                    className="nwt-align-right"
                    actions={true}
                  />
                </NwtDatatableHeader>
              }
            >
              {certificates.map((certificate) => (
                <NwtDatatableRecord key={certificate.code}>
                  <NwtDatatableCell className="nwt-width-xs-25">
                    {certificate.fullName}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-15">
                    {certificate.documentNumber}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-15">
                    {certificate.roleName}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-15">
                    {certificate.deliveryDate}
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-width-xs-12-5">
                    <NwtBadge
                      nwtVariant="quiet"
                      nwtTheme={
                        CARD_BATCH_STATUS_THEMES[certificate.status] ??
                        'neutral'
                      }
                      vignette={true}
                    >
                      {CARD_BATCH_STATUS_LABELS[certificate.status] ??
                        certificate.status}
                    </NwtBadge>
                  </NwtDatatableCell>
                  <NwtDatatableCell className="nwt-align-right">
                    {certificate.status === 'COMPLETED' &&
                      certificate.uploadId && (
                        <NwtTextLink
                          onClick={() =>
                            void openUploadedFile(
                              certificate.uploadId as string
                            )
                          }
                        >
                          Ver PDF
                        </NwtTextLink>
                      )}
                  </NwtDatatableCell>
                </NwtDatatableRecord>
              ))}
            </NwtDatatable>
          ) : (
            <NwtEmptyState
              title="Sin certificados"
              description="Genera el primero por deporte o de forma individual."
            />
          )}
        </NwtCard>

        <GenerateCertificatesModal
          mode={modalMode ?? 'sport'}
          visible={!!modalMode}
          eventId={eventId}
          phaseCode={phase?.code}
          momentCode={phase?.momentCode ?? undefined}
          sports={sports}
          generating={generation.status === 'requesting'}
          onClose={() => setModalMode(undefined)}
          onGenerate={generate}
        />
      </div>
    </section>
  );
}
