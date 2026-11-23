import './DeliveryPages.scss';

import {
  ACCREDITATION_MANAGE,
  AccreditedRecordRepository,
  CardBatchMemberRepository,
  CardBatchRepository
} from '@mf-accreditations/data';
import type { CardBatchChunk } from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  formatDocumentNumber,
  getApiErrorMessage,
  isNotFoundError,
  normalizeText,
  NwsLoading,
  NwsRequestError,
  NwsStackedCell,
  NwsSuccessModal,
  openUploadedFile,
  resolveUploadedFileUrl,
  useCardBatchDetail,
  useCatalogPage
} from '@mf-accreditations/presentation';
import { useSession } from '@naowee-tech/sdk-frontend-react';
import type { NwtTabItem } from '@naowee-tech/sdk-react-components';
import {
  NwtAlert,
  NwtBadge,
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
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { NwtTabs } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import {
  CARD_BATCH_STATUS_LABELS,
  CARD_BATCH_STATUS_THEMES,
  cardSkipReasonLabel
} from './card-batch.status';
import {
  BATCH_DEACTIVATION_SUCCESS_COPY,
  deactivateBatchCopy
} from './delivery.copy';
import {
  type DeliveryConfirmCopy,
  DeliveryConfirmModal
} from './DeliveryConfirmModal';

const recordRepository = invertly(AccreditedRecordRepository);
const batchRepository = invertly(CardBatchRepository);
// El de «Lista de acreditados». Se necesita acá solo para invalidarlo al matar el lote: ver
// `onDeactivateBatch`.
const memberRepository = invertly(CardBatchMemberRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

const BATCHES_ROUTE = '/delivery/card-batches';

const BATCHES_LABEL = 'Lotes de acreditaciones';

// Qué hay dentro de un lote de acreditaciones: quiénes van y cómo quedó su PDF.
//
// Es el equivalente real de «Detalle del lote» del diseño, con dos diferencias que vienen
// del backend y no se pueden tapar:
//
// - La tabla lleva el NOMBRE y nada más. QA retiró la columna del código —era el uuid de la
//   acreditación, que no le dice nada a quien reparte carnets— y pidió el documento en su
//   sitio, que es como se identifica a alguien en el mostrador. El documento NO viaja en este
//   endpoint: ver el `TODO(api)` de `CardBatchAccreditationResponse`. La celda ya está
//   preparada para recibirlo, así que el día que llegue es una línea.
//   El código sigue existiendo en el objeto y el buscador lo sigue mirando: no se pinta, pero
//   pegar un uuid y encontrar su fila es lo que hace soporte.
// - Los integrantes NO existen hasta que el lote termina de generarse. Mientras está en
//   curso llegan vacíos, así que la pantalla sigue consultando y lo dice, en lugar de
//   pintar una tabla vacía que parecería un lote sin nadie.
export function CardBatchDetailPage() {
  const { batchCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useContext(NwtContext);
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const { batch, error, reload, status } = useCardBatchDetail(batchCode);

  // A dónde se vuelve, y es el punto 12 de QA.
  //
  // A este lote se entra por DOS puertas —«Lotes de acreditaciones» y el «Ver el lote
  // completo» de «Lista de acreditados»— y la vuelta iba fija a la primera. Quien entraba
  // desde la lista, inactivaba el lote y acababa en una tercera pantalla, sin sus filtros ni
  // su página.
  //
  // Quedarse donde se está NO es opción: al morir el lote su detalle devuelve 404 a propósito
  // —el backend retira los lotes que se quedan sin nadie— y la pantalla lo pinta como estado
  // vacío. Lo que faltaba es volver por donde se vino.
  //
  // Es el mismo mecanismo que ya usan «Lista de acreditados» y el detalle del acreditado, y
  // por eso no se inventa nada. Sin estado manda el defecto, que es el caso de un enlace
  // guardado o de entrar por el listado de lotes.
  const origen = useLocation().state as
    | { from?: string; fromLabel?: string }
    | undefined;

  const volverA = origen?.from ?? BATCHES_ROUTE;
  const rotuloVolver = origen?.fromLabel ?? BATCHES_LABEL;

  const search = useInputControl<string>('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [preview, setPreview] = useState<string>();
  const [signing, setSigning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState<DeliveryConfirmCopy>();
  const [deactivated, setDeactivated] = useState(false);

  const members = useMemo(() => batch?.members ?? [], [batch]);

  const filtered = useMemo(() => {
    // Sin tildes en los dos lados: quien busca a «José Muñoz» escribe «jose munoz», y con un
    // `toLowerCase()` pelado no lo encontraba. En un lote de deportistas es media tabla.
    const query = normalizeText(search.value.trim());

    return query
      ? members.filter(
          (member) =>
            normalizeText(member.fullName).includes(query) ||
            normalizeText(member.code).includes(query)
        )
      : members;
  }, [members, search.value]);

  const { page, pageItems, setPage, totalPages } = useCatalogPage(filtered);

  // Cada chunk es un PDF de hasta 30 carnets, y solo se puede abrir el que terminó: el
  // `upload_id` existe desde que está en cola y bajarlo antes da NoSuchKey.
  const files = useMemo(
    () => batch?.chunks.filter((chunk) => chunk.downloadable) ?? [],
    [batch]
  );

  const selected = useMemo<CardBatchChunk | undefined>(
    () => files.find((chunk) => chunk.index === chunkIndex) ?? files[0],
    [files, chunkIndex]
  );

  const uploadId = selected?.uploadId ?? undefined;

  // La URL prefirmada se resuelve por chunk y vive unos minutos. Si el visor lleva mucho
  // abierto puede caducar; «Abrir en otra pestaña» vuelve a firmar, así que ese es el
  // camino para recuperarla en lugar de refrescar a ciegas cada tantos segundos.
  useEffect(() => {
    if (!uploadId) {
      setPreview(undefined);

      return;
    }

    let cancelled = false;

    setSigning(true);

    resolveUploadedFileUrl(uploadId)
      .then((url) => {
        if (!cancelled) {
          setPreview(url);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }

        setPreview(undefined);

        toast({
          title: 'No pudimos abrir el PDF del lote',
          message: getApiErrorMessage(
            cause,
            'El almacenamiento no entregó una URL para este archivo.'
          ),
          icon: 'caution',
          theme: 'negative'
        });
      })
      .finally(() => {
        if (!cancelled) {
          setSigning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uploadId, toast]);

  const tabs = useMemo<NwtTabItem<number>[]>(
    () =>
      files.map((chunk, position) => ({
        id: String(chunk.index),
        label: `PDF ${position + 1}`,
        count: chunk.cardCount,
        value: chunk.index
      })),
    [files]
  );

  // Matar el lote completo. Se ofrece SOLO acá y no en la fila del listado: es
  // irreversible, mata el QR de todos sus acreditaciones —los ya impresos incluidos— y en esta
  // pantalla el operador está mirando exactamente la tabla de quiénes se quedan sin
  // acreditación, mientras en la fila solo vería «Lote #3» y un conteo.
  const onDeactivateBatch = async (reason: string) => {
    setConfirmCopy(undefined);

    if (!batch) {
      return;
    }

    try {
      // El payload acepta el lote entero, así que es UNA llamada y no una por persona.
      const result = await recordRepository.bulk('deactivate', {
        batch_code: String(batch.id),
        ...(reason ? { reason } : {})
      });

      if (!result.total_processed) {
        return toast({
          title: 'No se inactivó ninguna',
          message:
            result.skipped?.[0]?.reason ??
            'No se pudo procesar ninguna acreditación de este lote.',
          icon: 'caution',
          theme: 'caution'
        });
      }

      // Matar el lote cambia DOS listas que cachean, no una. Acá solo se tiraba la primera, y
      // eso es lo que QA reportó como «no se refresca la vista automáticamente»:
      //
      //   `CardBatchRepository`        → «Lotes de acreditaciones» (`/card-batches`), de donde
      //                                  el lote desaparece.
      //   `CardBatchMemberRepository`  → «Lista de acreditados» (`/card-batches/members`),
      //                                  donde su gente pasa a «Inactiva».
      //
      // Son dos claves distintas del mismo store en memoria del SDK, así que borrar una no
      // toca la otra. Y al volver, `requestAll()` hace `this.list ?? remoteAll(1)`: con la
      // clave todavía en caché NO sale ninguna petición y la lista se repinta con la gente
      // como estaba. Desde que se vuelve a «Lista de acreditados» —el punto 12 de QA—, esa
      // segunda lista es justo la que el usuario tiene delante.
      //
      // `invalidate()` y no `refresh()`: tira la lista sin volver a pedirla, y se pide sola la
      // próxima vez que alguien la abra. Es lo mismo que ya hace acreditar en
      // `accredit-emission.hook.ts`, que invalida las dos por este mismo motivo.
      batchRepository.invalidate();
      memberRepository.invalidate();

      setDeactivated(true);
    } catch (error) {
      toast({
        title: 'No se pudo inactivar el lote',
        message: getApiErrorMessage(
          error,
          'Inténtalo de nuevo en unos minutos.'
        ),
        icon: 'caution',
        theme: 'negative'
      });
    }
  };

  const onOpenInTab = () => {
    if (!uploadId) {
      return;
    }

    setOpening(true);

    openUploadedFile(uploadId)
      .catch((cause: unknown) => {
        toast({
          title: 'No se pudo abrir el PDF',
          message: getApiErrorMessage(
            cause,
            'El lote tiene el archivo, pero el almacenamiento no lo entregó.'
          ),
          icon: 'caution',
          theme: 'negative'
        });
      })
      .finally(() => setOpening(false));
  };

  if (status === 'loading') {
    return (
      <section className="nws-delivery nws-card-batch-detail">
        <div className="nws-delivery__content">
          <NwsLoading>
            <h4>Cargando el lote, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  // Un lote que se quedó sin carnets desaparece a propósito: al inactivar el último, el
  // backend lo retira. Ofrecer «reintentar» ahí sería mentir.
  if (isNotFoundError(error)) {
    return (
      <section className="nws-delivery nws-card-batch-detail">
        <div className="nws-delivery__content">
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title="Este lote ya no existe"
            description="Si se inactivó su última acreditación, el lote se retira solo: los lotes que quedan sin nadie no se guardan."
            actionLabel={`Volver a ${rotuloVolver.toLowerCase()}`}
            showAction={true}
            onActionClick={() => navigate(volverA)}
          />
        </div>
      </section>
    );
  }

  if (status === 'failure' || !batch) {
    return (
      <section className="nws-delivery nws-card-batch-detail">
        <div className="nws-delivery__content">
          <NwsRequestError
            error={error}
            title="No pudimos cargar el lote de acreditaciones"
            onRetry={reload}
          />
        </div>
      </section>
    );
  }

  const generating = !batch.finished;

  return (
    <section className="nws-delivery nws-card-batch-detail">
      <div className="nws-delivery__content">
        <NwtBreadcrumb
          items={[
            { key: 'back', label: rotuloVolver },
            { key: 'batch', label: `Lote ${batch.label}`, active: true }
          ]}
          onBreadcrumb={(item) => item.key === 'back' && navigate(volverA)}
        />

        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Lote {batch.label}</span>

            <small className="nwt-smalltext-font-regular">
              {batch.totalCards}{' '}
              {batch.totalCards === 1 ? 'acreditación' : 'acreditaciones'} en{' '}
              {batch.totalChunks} archivo{batch.totalChunks === 1 ? '' : 's'} ·
              generado el {formatCatalogDate(batch.createdAt)} · {batch.id}
            </small>
          </div>

          <div className="nws-delivery__actions">
            <NwtBadge
              nwtVariant="quiet"
              nwtTheme={CARD_BATCH_STATUS_THEMES[batch.statusCode] ?? 'neutral'}
              vignette={true}
            >
              {CARD_BATCH_STATUS_LABELS[batch.statusCode] ?? batch.statusCode}
            </NwtBadge>

            <NwtButton
              icon="download"
              nwtVariant="loud"
              nwtSize="medium"
              disabled={!uploadId || opening}
              loading={opening}
              onClick={onOpenInTab}
            >
              Abrir el PDF
            </NwtButton>

            {/* Se pinta SIEMPRE y se apaga sin permiso, no se esconde: un botón que
                desaparece según el perfil hace dudar de si la acción existe.
                Y hasta ahora no comprobaba NADA —el listado sí condiciona «Generar» a
                accreditation:manage, y esta pantalla se llega por su URL—, así que cualquiera
                podía abrir el modal de confirmación de inactivar el lote entero. */}
            <NwtButton
              icon="delete"
              nwtVariant="quiet"
              nwtTheme="negative"
              nwtSize="medium"
              disabled={!canManage}
              onClick={() =>
                setConfirmCopy(
                  deactivateBatchCopy(batch.label, batch.totalCards)
                )
              }
            >
              Inactivar el lote
            </NwtButton>
          </div>
        </div>

        {/* El mismo estado sirve para dos cosas: el lote recién pedido, y el que el
            backend REGENERA cuando se inactiva una de sus acreditaciones. Como desde acá no se
            distinguen, el aviso cuenta las dos. */}
        {generating && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            Este lote se está generando. Si acabas de inactivar una de sus
            acreditaciones, lo que se está haciendo es rehacer el PDF sin esa
            hoja: los demás conservan su QR. Los integrantes y el archivo
            aparecen acá en cuanto termine; no hace falta recargar.
          </NwtAlert>
        )}

        {status === 'timeout' && (
          <NwtAlert nwtTheme="warning" icon="caution" visible={true}>
            Dejamos de esperar, pero el lote se sigue generando: vuelve a entrar
            en un rato.
          </NwtAlert>
        )}

        {batch.failed && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            {batch.errorDetail ?? 'El lote terminó sin generar ningún PDF.'}
          </NwtAlert>
        )}

        {/* Solo los de la SELECCIÓN: los omitidos por foto, datos del deportista o icono
            no se persisten y únicamente viajan en la respuesta de la generación, así que
            entrando después no están (SUV2-2531, «Fuera de alcance» del PR de backend). */}
        {!!batch.skipped.length && (
          <NwtAlert nwtTheme="warning" icon="caution" visible={true}>
            {batch.skipped.length === 1
              ? 'Uno de los códigos que se pidieron no entró al lote'
              : `${batch.skipped.length} de los códigos que se pidieron no entraron al lote`}
            :{' '}
            {batch.skipped
              .map((skip) => `${skip.label} (${cardSkipReasonLabel(skip.reason)})`)
              .join(' · ')}
          </NwtAlert>
        )}

        {/* El HECHO y no la consecuencia: este campo significa cosas opuestas según la época
            del lote —antes de SUV2-2531 ese carnet salía con marcador, ahora no se emite— y
            backend no marca cuál es. Decir «no se generó» acusaría en falso a los lotes viejos,
            que los tienen dentro del PDF y listados como integrantes justo debajo. */}
        {!!batch.cardsWithoutPhoto.length && (
          <NwtAlert nwtTheme="caution" icon="caution" visible={true}>
            {batch.cardsWithoutPhoto.length === 1
              ? 'Una acreditación del lote no tiene foto aprobada'
              : `${batch.cardsWithoutPhoto.length} acreditaciones del lote no tienen foto aprobada`}
            .
          </NwtAlert>
        )}

        <div className="nws-batch-detail__panels">
          <NwtCard
            className="nws-batch-detail__list"
            header={
              <span className="nwt-subtitle-font-bold">
                Integrantes del lote
              </span>
            }
          >
            <div className="nws-batch-detail__list-filters">
              {/* Dice «nombre» y no «nombre o código» desde que la columna del código se
                  retiró: ofrecer buscar por algo que la tabla no enseña es pedirle al usuario
                  que adivine qué pegar. El filtro SÍ sigue mirando el código —ver `filtered`—,
                  que es lo que hace soporte cuando le pasan un uuid por otro lado. */}
              <NwtSearchbox
                formControl={search}
                placeholder="Buscar por nombre"
              />

              <NwtPagination
                currentPage={page}
                totalPages={totalPages}
                onChange={setPage}
                nwtSize="small"
              />
            </div>

            {members.length ? (
              <NwtDatatable
                header={
                  <NwtDatatableHeader>
                    <NwtDatatableTitle className="nwt-width-xs-10">
                      No.
                    </NwtDatatableTitle>
                    {/* La persona: nombre arriba y documento debajo, como en las otras dos
                        tablas del módulo. La columna «Código» estuvo al lado con el uuid de la
                        acreditación y QA la mandó a quitar: no identifica a nadie en el
                        mostrador, que es donde se usa esta pantalla.

                        El documento todavía no llega —este endpoint da código y nombre, ver el
                        `TODO(api)` del contrato— y `NwsStackedCell` no pinta la segunda línea
                        cuando no hay dato, así que hoy se lee igual que antes de apilarla. Va
                        así y no como un `<span>` suelto para que el día que el campo exista sea
                        una línea y no rehacer la celda. */}
                    <NwtDatatableTitle className="nwt-width-xs-90">
                      Persona
                    </NwtDatatableTitle>
                  </NwtDatatableHeader>
                }
              >
                {pageItems.map((member, position) => (
                  <NwtDatatableRecord key={member.code}>
                    <NwtDatatableCell className="nwt-width-xs-10">
                      {(page - 1) * 10 + position + 1}
                    </NwtDatatableCell>
                    <NwtDatatableCell className="nwt-width-xs-90">
                      <NwsStackedCell
                        primary={
                          <span className="nwt-text-font-medium">
                            {member.fullName}
                          </span>
                        }
                        secondary={
                          member.document
                            ? formatDocumentNumber(member.document)
                            : undefined
                        }
                      />
                    </NwtDatatableCell>
                  </NwtDatatableRecord>
                ))}
              </NwtDatatable>
            ) : (
              <NwtEmptyState
                illustrationUrl={illustrationUrl}
                title={
                  generating
                    ? 'Todavía no se sabe quién va en el lote'
                    : 'El lote no informó a sus integrantes'
                }
                description={
                  generating
                    ? 'Se pueden ver cuando el lote termine de generarse.'
                    : 'El lote terminó sin informar a quién incluyó.'
                }
              />
            )}
          </NwtCard>

          <NwtCard
            className="nws-batch-detail__preview"
            header={
              <span className="nwt-subtitle-font-bold">Previsualización</span>
            }
          >
            {/* Con varios archivos hay que poder ver cualquiera, no solo el primero:
                el lote se parte en PDFs de hasta 30 carnets. */}
            {tabs.length > 1 && (
              <NwtTabs<number>
                items={tabs}
                value={selected?.index ?? 0}
                onChange={setChunkIndex}
              />
            )}

            {preview ? (
              <iframe
                className="nws-card-batch-detail__viewer"
                src={preview}
                title={`PDF del lote ${batch.label}`}
              />
            ) : (
              <div className="nws-card-batch-detail__viewer nws-card-batch-detail__viewer--empty">
                <span className="nwt-text-font-regular">
                  {signing
                    ? 'Preparando el PDF...'
                    : generating
                      ? 'El PDF aparece acá cuando el lote termine de generarse.'
                      : 'Este lote no dejó ningún PDF para mostrar.'}
                </span>
              </div>
            )}
          </NwtCard>
        </div>
      </div>

      <DeliveryConfirmModal
        copy={confirmCopy}
        onCancel={() => setConfirmCopy(undefined)}
        onConfirm={onDeactivateBatch}
      />

      {/* Al cerrar el éxito se vuelve POR DONDE SE ENTRÓ, no siempre al listado de lotes: ese
          era el punto 12 de QA. Quien viene de «Lista de acreditados» vuelve ahí, con sus
          filtros y su página; quien viene del listado de lotes vuelve al listado.

          Lo que no se puede es quedarse: el lote acaba de morir y su detalle devuelve 404.

          Sigue con `replace` para que el detalle salga del historial: pulsar «atrás» volvería
          a una pantalla que ya no existe. */}
      <NwsSuccessModal
        visible={deactivated}
        title={BATCH_DEACTIVATION_SUCCESS_COPY.title}
        caution={BATCH_DEACTIVATION_SUCCESS_COPY.caution}
        bullets={BATCH_DEACTIVATION_SUCCESS_COPY.bullets}
        onClose={() => navigate(volverA, { replace: true })}
      />
    </section>
  );
}
