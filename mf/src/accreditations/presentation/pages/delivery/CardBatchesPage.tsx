import './DeliveryPages.scss';

import {
  AccreditationCardRepository,
  CardBatchRepository
} from '@mf-accreditations/data';
import type { CardBatchListed } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsDateTimeCell,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsRequestError,
  NwsRowActionsMenu,
  NwsSelectCheckBox,
  openUploadedFiles
} from '@mf-accreditations/presentation';
import { usePaginationRepository } from '@naowee-tech/sdk-frontend-react';
import {
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
  NwtPagination,
  NwtTooltip
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useNavigate } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import {
  CARD_BATCH_STATUS_LABELS,
  CARD_BATCH_STATUS_THEMES
} from './card-batch.status';
import { CardBatchPreviewModal } from './CardBatchPreviewModal';
import { printBatchesCopy } from './delivery.copy';
import type { DeliveryConfirmCopy } from './DeliveryConfirmModal';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';

const repository = invertly(CardBatchRepository);
const cardRepository = invertly(AccreditationCardRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

interface CardBatchRowProps {
  batch: CardBatchListed;
  checked: boolean;
  onDownload: (batch: CardBatchListed) => void;
  onOpen: (batch: CardBatchListed) => void;
  onPreview: (batch: CardBatchListed) => void;
  onToggle: (batch: CardBatchListed) => void;
  working: boolean;
}

const CardBatchRow = memo(function CardBatchRow({
  batch,
  checked,
  onDownload,
  onOpen,
  onPreview,
  onToggle,
  working
}: CardBatchRowProps) {
  // Solo se marcan los que tienen PDF: mandar a imprimir un lote que falló o que sigue
  // generándose no lleva a ninguna parte. Y la casilla se APAGA con su motivo al lado, no se
  // esconde: si desaparece, no se entiende por qué esa fila no se puede marcar.
  const motivo = batch.downloadable
    ? ''
    : batch.statusCode === 'FAILED'
      ? 'El lote falló: no dejó ningún PDF'
      : 'Todavía se está generando';

  return (
    <NwtDatatableRecord>
      <NwtDatatableCell control={true}>
        {/* El tooltip solo se monta cuando hay algo que decir: NwtTooltip no tiene prop para
            apagarse, y con `content` vacío deja una burbuja en blanco al pasar por encima. */}
        {motivo ? (
          <NwtTooltip content={motivo} position="right" wrap={false}>
            <NwsSelectCheckBox
              ariaLabel={motivo}
              checked={false}
              disabled={true}
              onToggle={() => undefined}
            />
          </NwtTooltip>
        ) : (
          <NwsSelectCheckBox
            ariaLabel={`Seleccionar el lote ${batch.label}`}
            checked={checked}
            onToggle={() => onToggle(batch)}
          />
        )}
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-20 nws-datatable-fill">
        <div className="nws-card-batches__label">
          <span className="nwt-text-font-medium">Lote {batch.label}</span>

          {/* El uuid es lo que hay que pegarle a backend cuando algo falla, así que
              acompaña al número en lugar de desaparecer con él. */}
          {batch.batchNumber !== null && (
            <small className="nwt-smalltext-font-regular">
              {batch.shortCode}
            </small>
          )}
        </div>
      </NwtDatatableCell>

      {/* «Tipo» y «Archivos» estuvieron acá y QA las mandó a quitar.

          «Tipo» decía «Individual» o «Del evento», que es de dónde salió el lote y no algo
          que se use para decidir nada en esta pantalla. «Archivos» contaba en cuántos PDF se
          partió, que es un detalle de cómo se guardó y no de qué hay dentro.

          Ojo: `totalChunks` NO es código muerto. Lo siguen usando los rótulos del menú de la
          fila —«Ver los 3 PDF»—, el conteo de la confirmación de impresión y el subtítulo del
          detalle. Lo que se fue es la columna. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span>{batch.totalCards}</span>
      </NwtDatatableCell>

      {/* «Sin foto» y no «sin carnet»: backend solo llena este campo con los de PHOTO_MISSING,
          así que un deportista omitido por falta de categoría NO entra acá y la columna diría
          cero habiéndose quedado gente fuera. */}
      <NwtDatatableCell className="nwt-width-xs-7-5">
        <span>{batch.cardsWithoutPhoto}</span>
      </NwtDatatableCell>

      {/* Con la HORA, que es lo que pidió QA: en un día de evento se generan varios lotes y
          con la fecha sola no hay cómo distinguir el de la mañana del de la tarde.

          `NwsDateTimeCell` y no un formato nuevo: es el componente del rediseño para esto
          —fecha arriba, hora debajo—, ya trae su raya para el nulo y ya lo usa la auditoría. */}
      <NwtDatatableCell className="nwt-width-xs-15">
        <NwsDateTimeCell date={batch.createdAt} />
      </NwtDatatableCell>

      {/* El 12,5% se ve holgado en pantalla ancha y es el mínimo: el badge no lleva puntos
          suspensivos, así que tiene que caber ENTERO también con la tabla en su ancho mínimo.
          Con 10% se recorta «Generando» —lo pilló la prueba— y un estado partido es peor que
          una columna con aire. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={CARD_BATCH_STATUS_THEMES[batch.statusCode] ?? 'neutral'}
          vignette={true}
        >
          {CARD_BATCH_STATUS_LABELS[batch.statusCode] ?? batch.statusCode}
        </NwtBadge>
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones del lote ${batch.label}`}
          actions={[
            // Revisar antes de imprimir: es lo que evita gastar 200 hojas en carnets sin foto.
            {
              key: 'preview',
              icon: 'visibility-on',
              // «PDF» y no «carnet»: el módulo llama a esto «la acreditación» en todas partes
              // —«Generar Acreditación», «Abrir el PDF»— y mezclar las dos palabras para el
              // mismo objeto obliga a adivinar si son cosas distintas. Y en paralelo con la
              // acción de descargar, justo debajo, que ya dice «Descargar el PDF».
              label: batch.downloadable
                ? batch.totalChunks > 1
                  ? `Ver los ${batch.totalChunks} PDF`
                  : 'Ver el PDF'
                : 'Todavía no hay PDF que ver',
              disabled: !batch.downloadable,
              onClick: () => onPreview(batch)
            },
            {
              key: 'detail',
              icon: 'user',
              label: 'Ver el detalle del lote',
              onClick: () => onOpen(batch)
            },
            {
              key: 'download',
              icon: 'download',
              // Con varios archivos el rótulo lo dice: antes prometía «el PDF» y abría uno de
              // cinco.
              label: batch.downloadable
                ? batch.totalChunks > 1
                  ? `Descargar los ${batch.totalChunks} PDF`
                  : 'Descargar el PDF'
                : batch.statusCode === 'FAILED'
                  ? 'El lote falló'
                  : 'Todavía se está generando',
              disabled: !batch.downloadable || working,
              onClick: () => onDownload(batch)
            }
          ]}
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

// Los lotes de acreditaciones que el backend ya generó para el evento.
//
// Es una pantalla aparte de «Lotes generados» a propósito: esa es el lote de
// ACREDITACIONES del diseño —con su número, cuántas se entregaron y su detalle con
// previsualización— y de eso el backend no tiene nada. Esto es el lote de PDFs, que
// sí existe. Se fusionan cuando se decida lo del lote (SUV2-1632).
export function CardBatchesPage() {
  return (
    <NwsEventGuard>
      {(scope) => <CardBatchesCatalog {...scope} />}
    </NwsEventGuard>
  );
}

function CardBatchesCatalog({ event, phase }: NwsEventScope) {
  // El evento se deja puesto ANTES de montar los controladores: así su primera petición
  // ya nace filtrada. Antes salía con un evento imposible y se descartaba al llegar la
  // buena, o sea dos peticiones por pantalla para pintar una lista.
  //
  // Los carnets son del evento y los tipos del par evento+fase: por eso uno va por
  // `event_code` y el otro por `event_id`.
  repository.applyEventScope({
    event_code: event.code,
    ...(phase?.momentScope ?? {})
  });

  const controller = usePaginationRepository(repository);
  const { toast } = useContext(NwtContext);
  const navigate = useNavigate();

  const [downloading, setDownloading] = useState(false);
  // Los lotes marcados, por su code. Lo que se marca es lo que se manda a imprimir.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Los que se están revisando en el visor: uno desde su fila, o todos los marcados.
  const [reviewing, setReviewing] = useState<CardBatchListed[]>([]);
  const [printCopy, setPrintCopy] = useState<DeliveryConfirmCopy>();

  const batches = useMemo(
    () => (controller.state.is('success') ? controller.pageEntities : []),
    [controller.state, controller.pageEntities]
  );

  // GENERAR SE FUE DE ESTA PANTALLA (QA, 2026-09-16).
  //
  // Acá vivían el desplegable «Tipo del nuevo lote» y el botón «Generar Acreditaciones», con
  // su hook `useCardBatch`, sus tres avisos de progreso y el catálogo de tipos que alimentaba
  // el desplegable. Esta pantalla es para MIRAR lotes: se generan desde donde se acredita, y
  // el detalle de cada acreditación emite el suyo.
  //
  // Se retiró el bloque entero y no solo los dos controles: dejar el hook colgando habría
  // seguido pidiendo el catálogo de tipos al entrar —una petición por nada— y habría dejado
  // tres avisos que ya no puede disparar nadie.
  //
  // Lo que NO se fue: `cardRepository`, que lo siguen usando `onFetchBatch`, `onConfirmPrint`
  // y `onDownload` para abrir y descargar los PDF.

  const onOpen = useCallback(
    (batch: CardBatchListed) => {
      navigate(`/delivery/card-batches/${batch.id}`);
    },
    [navigate]
  );

  const onToggle = useCallback((batch: CardBatchListed) => {
    setSelected((actual) => {
      const siguiente = new Set(actual);
      const id = String(batch.id);

      if (siguiente.has(id)) {
        siguiente.delete(id);
      } else {
        siguiente.add(id);
      }

      return siguiente;
    });
  }, []);

  // Solo los que tienen PDF: es lo único que se puede marcar y lo único que se puede imprimir.
  const descargables = useMemo(
    () => batches.filter((batch) => batch.downloadable),
    [batches]
  );

  const marcados = useMemo(
    () => descargables.filter((batch) => selected.has(String(batch.id))),
    [descargables, selected]
  );

  const todosMarcados =
    descargables.length > 0 && marcados.length === descargables.length
      ? true
      : marcados.length > 0
        ? undefined
        : false;

  const onToggleAll = useCallback(() => {
    setSelected((actual) =>
      descargables.every((batch) => actual.has(String(batch.id)))
        ? new Set<string>()
        : new Set(descargables.map((batch) => String(batch.id)))
    );
  }, [descargables]);

  // Al cambiar de página se suelta la selección: mandar a imprimir lotes que ya no se ven es
  // justo lo que nadie puede auditar.
  useEffect(() => {
    setSelected(new Set());
  }, [controller.currentPage]);

  // El visor pide el lote COMPLETO: el listado no trae los chunks, y sin ellos no hay
  // `upload_id` que firmar.
  const onFetchBatch = useCallback(
    (batch: CardBatchListed) => cardRepository.requestBatch(String(batch.id)),
    []
  );

  const onPreview = useCallback((batch: CardBatchListed) => {
    setReviewing([batch]);
  }, []);

  const onReviewSelected = useCallback(() => {
    setReviewing(marcados);
  }, [marcados]);

  // Mandar a impresión es abrir sus PDF: no hay endpoint de impresión, y no lo hay en ninguna
  // parte —la demo hace lo mismo—. Se confirma antes porque el papel no se deshace.
  const onAskPrint = useCallback((lotes: CardBatchListed[]) => {
    const archivos = lotes.reduce((suma, lote) => suma + lote.totalChunks, 0);
    const acreditaciones = lotes.reduce(
      (suma, lote) => suma + lote.totalCards,
      0
    );

    setPrintCopy(printBatchesCopy(lotes.length, archivos, acreditaciones));
  }, []);

  const onConfirmPrint = useCallback(async () => {
    setPrintCopy(undefined);

    const lotes = reviewing.length ? reviewing : marcados;

    if (!lotes.length) {
      return;
    }

    setDownloading(true);

    try {
      // Se resuelven TODOS los archivos de TODOS los lotes y después se abren de una: con un
      // `await` entre apertura y apertura el bloqueador se come todas menos la primera.
      const completos = await Promise.all(
        lotes.map((lote) => cardRepository.requestBatch(String(lote.id)))
      );

      const archivos = completos.flatMap((lote) =>
        lote.chunks
          .filter((chunk) => chunk.downloadable)
          .map((chunk) => chunk.uploadId as string)
      );

      if (!archivos.length) {
        return toast({
          title: 'No hay PDF que imprimir',
          message:
            'Los lotes seleccionados quedaron terminados pero sin ningún archivo generado.',
          icon: 'caution',
          theme: 'negative'
        });
      }

      const { abiertas, total } = await openUploadedFiles(archivos);

      toast({
        title:
          abiertas === total
            ? `${total} ${total === 1 ? 'PDF abierto' : 'PDF abiertos'}`
            : 'El navegador bloqueó algunas pestañas',
        message:
          abiertas === total
            ? 'Desde cada pestaña se manda a la impresora.'
            : `Se abrieron ${abiertas} de ${total}. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.`,
        icon: abiertas === total ? 'positive' : 'caution',
        theme: abiertas === total ? 'positive' : 'caution'
      });

      setSelected(new Set());
      setReviewing([]);
    } catch (error) {
      toast({
        title: 'No pudimos abrir los PDF',
        message: getApiErrorMessage(
          error,
          'Alguno de los lotes no entregó su archivo.'
        ),
        icon: 'caution',
        theme: 'negative'
      });
    } finally {
      setDownloading(false);
    }
  }, [marcados, reviewing, toast]);

  const onDownload = useCallback(
    async (batch: CardBatchListed) => {
      setDownloading(true);

      try {
        // Se vuelve a pedir el lote por code: es lo único que refresca su estado
        // contra file-storage, así que de paso corrige la fila si el listado venía
        // rezagado.
        const fresh = await cardRepository.requestBatch(String(batch.id));

        repository.syncStatus(batch, fresh.statusCode);

        const file = fresh.file;

        if (!file?.uploadId) {
          return toast({
            title: 'El lote no tiene PDF para descargar',
            message:
              fresh.errorDetail ??
              'El lote quedó terminado pero sin ningún archivo generado.',
            icon: 'caution',
            theme: 'negative'
          });
        }

        // TODOS los archivos del lote, no solo el primero. Antes se abría uno de cinco y se
        // avisaba de que los demás «todavía no se pueden bajar desde acá», que era falso:
        // estaban firmables igual, solo que nadie los pedía.
        const archivos = fresh.chunks
          .filter((chunk) => chunk.downloadable)
          .map((chunk) => chunk.uploadId as string);

        const { abiertas, total } = await openUploadedFiles(
          archivos.length ? archivos : [file.uploadId]
        );

        // El bloqueador de ventanas se puede comer alguna, y quien está imprimiendo tiene que
        // saber cuántas salieron en vez de dar por hecho que están todas.
        if (abiertas < total) {
          toast({
            title: 'El navegador bloqueó algunas pestañas',
            message: `Se abrieron ${abiertas} de ${total} PDF. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.`,
            icon: 'caution',
            theme: 'caution'
          });
        }
      } catch (error) {
        toast({
          title: 'No pudimos abrir la acreditación',
          message: getApiErrorMessage(
            error,
            `El lote ${batch.label} no entregó su archivo.`
          ),
          icon: 'caution',
          theme: 'negative'
        });
      } finally {
        setDownloading(false);
      }
    },
    [toast]
  );

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando los lotes, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('failure')) {
      return (
        <NwsRequestError
          error={controller.state.error}
          title="No pudimos cargar los lotes de acreditaciones"
          onRetry={controller.refresh}
        />
      );
    }

    return (
      <NwtCard className="nws-card-batches__catalog">
        <div className="nws-delivery__filters">
          <span className="nwt-smalltext-font-regular">
            Los más recientes primero
          </span>

          <NwtPagination
            currentPage={controller.currentPage}
            totalPages={controller.totalPages}
            onChange={controller.goToPage}
            nwtSize="small"
          />
        </div>

        {/* La barra de la selección. Revisar e imprimir son LECTURA —quien solo consulta el
            evento también las necesita—, así que no dependen de `canManage`. */}
        {!!marcados.length && (
          <div className="nws-card-batches__selection">
            <span className="nwt-smalltext-font-medium">
              {marcados.length === 1
                ? '1 lote seleccionado'
                : `${marcados.length} lotes seleccionados`}
            </span>

            <NwtButton
              className="nws-card-batches__review"
              icon="visibility-on"
              nwtVariant="quiet"
              nwtSize="medium"
              onClick={onReviewSelected}
            >
              Revisar
            </NwtButton>

            <NwtButton
              icon="print"
              nwtVariant="loud"
              nwtSize="medium"
              disabled={downloading}
              loading={downloading}
              onClick={() => onAskPrint(marcados)}
            >
              Enviar a impresión
            </NwtButton>
          </div>
        )}

        {batches.length ? (
          <NwtDatatable
            header={
              <NwtDatatableHeader>
                <NwtDatatableTitle control={true}>
                  <NwsSelectCheckBox
                    ariaLabel="Seleccionar todos los lotes con PDF"
                    checked={todosMarcados}
                    disabled={!descargables.length}
                    onToggle={onToggleAll}
                  />
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-20 nws-datatable-fill">
                  Lote
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Acreditaciones
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-7-5">
                  Sin foto
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-15">
                  Generado
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Estado
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-align-right" actions={true} />
              </NwtDatatableHeader>
            }
          >
            {batches.map((batch) => (
              <CardBatchRow
                key={batch.id}
                batch={batch}
                checked={selected.has(String(batch.id))}
                onDownload={onDownload}
                onOpen={onOpen}
                onPreview={onPreview}
                onToggle={onToggle}
                working={downloading}
              />
            ))}
          </NwtDatatable>
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title="Aún no hay lotes de acreditaciones"
            description="Los lotes aparecen acá cuando se genera el PDF de una acreditación."
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-delivery nws-card-batches">
      {/* El evento, en su franja y a todo el ancho: en la fila del título no cabía y el
          nombre salía cortado. */}
      <NwsEventBar />

      <div className="nws-delivery__content">
        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Lotes de acreditaciones</span>

            <small className="nwt-smalltext-font-regular">
              Los PDFs de acreditaciones que se han generado para el evento
            </small>
          </div>

          {/* La cabecera se queda SIN acciones: generar se fue de esta pantalla (ver el bloque
              de arriba). Los avisos de progreso del lote se fueron con ella —no había quien
              los disparara— y con ellos el de solo-consulta, que hablaba de generar.

              Lo que esta pantalla ofrece sigue estando donde estaba: revisar el PDF, ver el
              detalle y descargar, en el menú de cada fila; y mandar a imprimir los marcados,
              en la barra de selección. Nada de eso pide permiso de gestión, es lectura. */}
        </div>

        {renderCatalog()}
      </div>

      {/* El visor se esconde mientras se confirma la impresión, pero NO se olvida: si se
          cancela, se vuelve a él. Sin esto el modal de confirmación salía DETRÁS de su
          backdrop y no se podía pulsar — lo cazó la prueba, que se quedó esperando el botón. */}
      <CardBatchPreviewModal
        batches={reviewing}
        visible={!!reviewing.length && !printCopy}
        onClose={() => setReviewing([])}
        onFetch={onFetchBatch}
      />

      <DeliveryConfirmModal
        copy={printCopy}

        onCancel={() => setPrintCopy(undefined)}

        onConfirm={onConfirmPrint}
      />
    </section>
  );
}
