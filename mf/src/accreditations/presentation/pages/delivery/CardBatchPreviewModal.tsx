import type { CardBatch, CardBatchListed } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsModal,
  openUploadedFile,
  resolveUploadedFileUrl
} from '@mf-accreditations/presentation';
import {
  NwtAlert,
  NwtButton,
  NwtIconButton,
  NwtTabs
} from '@naowee-tech/sdk-react-components';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface CardBatchPreviewModalProps {
  // Los lotes que se están revisando: uno desde el menú de su fila, o los marcados.
  batches: CardBatchListed[];
  // Cómo se trae el lote completo con sus chunks: el listado NO los incluye.
  onFetch: (batch: CardBatchListed) => Promise<CardBatch>;
  onClose: () => void;
  visible: boolean;
}

// Revisar los carnets antes de mandarlos a imprimir.
//
// El caso es el del mostrador: imprimir un lote de 200 carnets con el nombre mal o sin la foto
// cuesta el papel y la tarde. Hasta ahora, para ver el PDF había que entrar al detalle del
// lote, volver, entrar al siguiente… y con varios lotes marcados eso son N viajes.
//
// Dos ejes de navegación, y no se mezclan: se pasa de LOTE en lote con las flechas de la
// cabecera, y entre los PDF de un mismo lote con las pestañas —un lote de muchos carnets se
// parte en varios archivos—.
export function CardBatchPreviewModal({
  batches,
  onFetch,
  onClose,
  visible
}: CardBatchPreviewModalProps) {
  const [index, setIndex] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [batch, setBatch] = useState<CardBatch>();
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  const current = batches[index];

  // Al cambiar de lote se vuelve al primer PDF: el índice del anterior no significa nada en el
  // siguiente, y dejarlo puesto pintaba «PDF 3» en un lote que solo tiene uno.
  useEffect(() => {
    setChunkIndex(0);
  }, [index]);

  // Y al reabrir el modal se empieza por el primero, no donde se quedó la vez pasada.
  useEffect(() => {
    if (visible) {
      setIndex(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !current) {
      return;
    }

    let alive = true;

    setLoading(true);
    setError(undefined);
    setBatch(undefined);

    onFetch(current)
      .then((fresh) => {
        if (alive) {
          setBatch(fresh);
        }
      })
      .catch((reason) => {
        if (alive) {
          setError(
            getApiErrorMessage(reason, 'No pudimos traer el PDF del lote.')
          );
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [visible, current, onFetch]);

  const files = useMemo(
    () => (batch?.chunks ?? []).filter((chunk) => chunk.downloadable),
    [batch]
  );

  const file = useMemo(
    () => files.find((chunk) => chunk.index === chunkIndex) ?? files[0],
    [files, chunkIndex]
  );

  useEffect(() => {
    if (!file?.uploadId) {
      setUrl(undefined);
      setLoading(false);

      return;
    }

    let alive = true;

    setLoading(true);

    // La firma va cacheada por `upload_id` mientras siga valiendo, así que volver a una
    // pestaña ya vista no cuesta otra petición.
    resolveUploadedFileUrl(file.uploadId)
      .then((firmada) => {
        if (alive) {
          setUrl(firmada);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (alive) {
          setError(getApiErrorMessage(reason, 'No pudimos firmar el PDF.'));
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [file?.uploadId]);

  // Abrir en otra pestaña el PDF que se está mirando. Mismo camino que el detalle del lote:
  // `openUploadedFile` firma y abre, y el fallo se cuenta en el sitio donde ya se cuentan los
  // de este modal —su alerta— en vez de en un toast que aparecería detrás del propio modal.
  const onOpenInTab = useCallback(() => {
    if (!file?.uploadId) {
      return;
    }

    setOpening(true);
    setError(undefined);

    openUploadedFile(file.uploadId)
      .catch((reason: unknown) => {
        setError(getApiErrorMessage(reason, 'No se pudo abrir el PDF.'));
      })
      .finally(() => setOpening(false));
  }, [file?.uploadId]);

  const onPrev = useCallback(
    () => setIndex((actual) => Math.max(0, actual - 1)),
    []
  );

  const onNext = useCallback(
    () => setIndex((actual) => Math.min(batches.length - 1, actual + 1)),
    [batches.length]
  );

  if (!current) {
    return null;
  }

  return (
    <NwsModal
      className="nws-card-preview"
      title={
        batches.length === 1 ? 'Vista previa del lote' : 'Revisar los lotes'
      }
      subtitle={`Lote ${current.label}`}
      visible={visible}
      onClose={onClose}
      autoclose={true}
    >
      <div className="nws-card-preview__body">
        {/* De lote en lote. Con uno solo no se pinta: dos flechas apagadas son ruido. */}
        {batches.length > 1 && (
          <div className="nws-card-preview__nav">
            <NwtIconButton
              icon="chevron-left"
              ariaLabel="Lote anterior"
              nwtVariant="mute"
              nwtSize="medium"
              disabled={index === 0}
              onClick={onPrev}
            />

            <span className="nwt-smalltext-font-regular">
              {`Lote ${current.label} · ${index + 1} de ${batches.length}`}
            </span>

            <NwtIconButton
              icon="chevron-right"
              ariaLabel="Lote siguiente"
              nwtVariant="mute"
              nwtSize="medium"
              disabled={index === batches.length - 1}
              onClick={onNext}
            />
          </div>
        )}

        {/* Y entre los PDF del lote que se está mirando. El conteo va DENTRO del rótulo: el
            `count` de NwtTabs lo pinta como una pastilla que se lee como un aviso. */}
        {files.length > 1 && (
          <NwtTabs<number>
            items={files.map((chunk) => ({
              id: String(chunk.index),
              label: `PDF ${chunk.index + 1} (${chunk.cardCount})`,
              value: chunk.index
            }))}
            value={file?.index ?? 0}
            onChange={setChunkIndex}
          />
        )}

        {!!error && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            {error}
          </NwtAlert>
        )}

        {/* Sin afirmar si entraron al PDF o no: en un lote anterior a SUV2-2531 SÍ están
            —con marcador—, y decir lo contrario acá haría dejar de imprimir carnets hechos.
            `cardsWithoutPhoto` es la LISTA de códigos, no un conteo. */}
        {!!batch?.cardsWithoutPhoto.length && (
          <NwtAlert nwtTheme="caution" icon="caution" visible={true}>
            {batch.cardsWithoutPhoto.length === 1
              ? 'Una acreditación de este lote no tiene foto aprobada.'
              : `${batch.cardsWithoutPhoto.length} acreditaciones de este lote no tienen foto aprobada.`}
          </NwtAlert>
        )}

        {url ? (
          <iframe
            className="nws-card-preview__viewer"
            src={url}
            title={`PDF ${(file?.index ?? 0) + 1} del lote ${current.label}`}
          />
        ) : (
          <div className="nws-card-preview__viewer nws-card-preview__viewer--empty">
            <span className="nwt-text-font-regular">
              {loading
                ? 'Preparando el PDF...'
                : 'Este lote no dejó ningún PDF para mostrar.'}
            </span>
          </div>
        )}
      </div>

      {/* «Abrir el PDF», igual que en el detalle del lote (QA, 2026-09-16).

          Antes decía «Enviar a impresión» y NO imprimía: no hay `window.print` en el módulo ni
          endpoint de impresión. Abría una confirmación y luego los PDF en pestañas, que es lo
          mismo que hace este botón pero con un paso de por medio y un nombre que prometía otra
          cosa. Un botón que dice una cosa y hace otra es el defecto, no el paso de más.

          Abre directo y sin confirmar, como el del detalle: el visor ya tiene delante el
          archivo que va a abrir —es el que se está mirando—, así que no hay nada que
          confirmarle a quien acaba de verlo.

          Se vuelve a firmar en vez de reusar `url`: la prefirmada dura unos minutos y el visor
          puede llevar rato abierto. La firma va cacheada mientras siga valiendo, así que no
          cuesta una petición de más. Es el mismo motivo que ya está escrito en el detalle.

          Ojo: el «Enviar a impresión» de la BARRA DE SELECCIÓN es otro botón y sigue igual.
          Ese sí manda varios lotes de golpe sin haberlos mirado uno a uno, y ahí la
          confirmación —que dice cuántos archivos y cuántas acreditaciones— gana su sitio. */}
      <footer className="nws-card-preview__footer">
        <NwtButton
          icon="download"
          nwtVariant="loud"
          nwtSize="medium"
          disabled={!file?.uploadId || opening}
          loading={opening}
          onClick={onOpenInTab}
        >
          Abrir el PDF
        </NwtButton>
      </footer>
    </NwsModal>
  );
}
