import {
  AccreditedRecordRepository,
  CardBatchRepository
} from '@mf-accreditations/data';
import type { AccreditedRecord } from '@mf-accreditations/domain';
import { getApiErrorMessage } from '@mf-accreditations/presentation';
import { NwtContext } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useCallback, useContext, useRef, useState } from 'react';

import {
  deactivateAccreditationsCopy,
  DEACTIVATION_SUCCESS_COPY,
  deliverAccreditationsCopy,
  DELIVERY_SUCCESS_COPY,
  undoDeliveryCopy
} from './delivery.copy';
import type { DeliveryConfirmCopy } from './DeliveryConfirmModal';

const repository = invertly(AccreditedRecordRepository);
const batchRepository = invertly(CardBatchRepository);

export type RecordAction = 'deliver' | 'deactivate' | 'undo-delivery';

interface PendingAction {
  action: RecordAction;
  records: AccreditedRecord[];
}

export interface AccreditationSuccessCopy {
  bullets: string[];
  caution: string;
  title: string;
}

const SUCCESS: Record<RecordAction, AccreditationSuccessCopy> = {
  deliver: DELIVERY_SUCCESS_COPY,
  deactivate: DEACTIVATION_SUCCESS_COPY,
  'undo-delivery': {
    title: '¡Entrega revertida!',
    caution:
      'La acreditación quedó inactiva: para volver a acreditar a la persona hay que emitir una nueva.',
    bullets: ['Podrás ver el estado de cada acreditación en el listado.']
  }
};

const ERRORS: Record<RecordAction, string> = {
  deliver: 'No fue posible registrar la entrega. Inténtalo nuevamente.',
  deactivate: 'No fue posible inactivar. Inténtalo nuevamente.',
  'undo-delivery': 'No fue posible revertir la entrega. Inténtalo nuevamente.'
};

interface ReversionFallida {
  error: unknown;
  record: AccreditedRecord;
}

/**
 * Revertir la entrega de VARIAS acreditaciones.
 *
 * TODO(api): el backend no expone `bulk-undo-delivery`. Su constructor de URL está cerrado
 * por tipo a las otras dos —`accreditationBulkUrl(action: 'deliver' | 'deactivate')`, en
 * `api-config.ts`—, así que el masivo no es ni expresable desde acá. Mientras tanto esto
 * recorre el individual, que sí existe y sí acepta `reason`.
 *
 * Está aislado a propósito: el día que exista el masivo, esta función se cambia entera por
 * una llamada a `repository.bulk('undo-delivery', ...)` y la pantalla no se entera, porque
 * recibe la lista y devuelve el mismo recuento que se usa para contar.
 *
 * **En SERIE y no en paralelo.** No es por cortesía con el servidor: la acción es TERMINAL
 * —revertir además INACTIVA— y lanzarlas todas a la vez deja un montón de reversiones en
 * vuelo que ya no se pueden cancelar cuando la tercera falla. De a una, lo que se hizo está
 * hecho, lo que falta no se empezó, y el recuento de abajo puede decir la verdad.
 *
 * Por lo mismo no se corta al primer fallo: los 500 de este endpoint son por acreditación
 * —«ya fue revertida», «no estaba entregada»— y no significan que las siguientes vayan a
 * fallar. Parar dejaría la tanda a medias sin haberlo intentado.
 */
async function revertirVarias(
  records: AccreditedRecord[],
  reason: string
): Promise<{ fallidas: ReversionFallida[]; hechas: AccreditedRecord[] }> {
  const fallidas: ReversionFallida[] = [];
  const hechas: AccreditedRecord[] = [];

  for (const record of records) {
    try {
      await repository.undoDelivery(record, reason);
      hechas.push(record);
    } catch (error) {
      fallidas.push({ error, record });
    }
  }

  return { fallidas, hechas };
}

// El mismo flujo —preguntar, exigir el texto, ejecutar y avisar— para las acciones de
// la lista (sobre la selección) y del detalle (sobre una), contra el contrato real.
//
// Dos decisiones que valen la pena:
//
// - **Entregar e inactivar van SIEMPRE por el endpoint masivo**, incluso con una sola
//   fila. No es capricho: el individual de entrega no acepta observación (el masivo sí
//   acepta `reason`, y el diseño la exige) y encima responde 500 si la acreditación ya
//   estaba entregada, mientras el masivo devuelve un `skipped` con el motivo en
//   español. Un solo camino, con la observación viajando y con mejores errores.
// - **`skipped` no es un fallo**: son las que el backend decidió no tocar, con su
//   motivo. Se cuentan tal cual en lugar de decir «algunas fallaron».
export function useAccreditedRecordActions(onDone?: () => void) {
  const { toast } = useContext(NwtContext);

  const [confirmCopy, setConfirmCopy] = useState<DeliveryConfirmCopy>();
  const [successCopy, setSuccessCopy] = useState<AccreditationSuccessCopy>();
  const pendingRef = useRef<PendingAction | undefined>(undefined);

  const ask = useCallback((action: RecordAction, records: AccreditedRecord[]) => {
    if (!records.length) {
      return;
    }

    pendingRef.current = { action, records };

    setConfirmCopy(
      action === 'deliver'
        ? deliverAccreditationsCopy(records.length)
        : action === 'deactivate'
          ? deactivateAccreditationsCopy(records.length)
          : undoDeliveryCopy(records.length)
    );
  }, []);

  const askDeliver = useCallback(
    (records: AccreditedRecord[]) => ask('deliver', records),
    [ask]
  );

  const askDeactivate = useCallback(
    (records: AccreditedRecord[]) => ask('deactivate', records),
    [ask]
  );

  const askUndoDelivery = useCallback(
    (record: AccreditedRecord) => ask('undo-delivery', [record]),
    [ask]
  );

  // La misma acción sobre la SELECCIÓN. Va aparte de `askUndoDelivery` y no la reemplaza
  // —aunque por dentro llamen a lo mismo— porque la de una fila recibe el registro que el
  // usuario tocó y esta recibe una lista que él nunca miró de una en una. Que se llamen
  // distinto obliga a elegir, y quien lea la pantalla ve cuál de las dos está usando.
  //
  // Quién puede llamarla es cosa de la pantalla: acá NO se filtra por `delivered`. Filtrarlo
  // en silencio sería revertir menos de lo que la confirmación acaba de prometer, y el
  // contador del modal —que es lo último que se lee antes de una acción sin vuelta atrás—
  // dejaría de coincidir con lo que pasa. La pantalla no ofrece la acción si la selección no
  // está entera; ver `revertible` en AccreditedListPage.
  const askUndoDeliveryMany = useCallback(
    (records: AccreditedRecord[]) => ask('undo-delivery', records),
    [ask]
  );

  const onCancel = useCallback(() => {
    pendingRef.current = undefined;

    setConfirmCopy(undefined);
  }, []);

  const onCloseSuccess = useCallback(() => {
    setSuccessCopy(undefined);
  }, []);

  const onConfirm = useCallback(
    async (note: string) => {
      const pending = pendingRef.current;

      pendingRef.current = undefined;

      setConfirmCopy(undefined);

      if (!pending) {
        return;
      }

      const { action, records } = pending;

      try {
        // Revertir la entrega no tiene versión masiva en el backend: se recorre el
        // individual. Ver `revertirVarias`.
        if (action === 'undo-delivery') {
          const { fallidas, hechas } = await revertirVarias(records, note);

          // Ninguna pasó: no hay éxito que celebrar. Se dice con el mismo lenguaje que los
          // masivos de verdad —ver el bloque de `total_processed` más abajo— para que el
          // operador no tenga que aprender dos formas de leer lo mismo.
          if (!hechas.length) {
            toast({
              title: 'No se revirtió ninguna',
              message: getApiErrorMessage(fallidas[0]?.error, ERRORS[action]),
              icon: 'caution',
              theme: 'caution'
            });

            onDone?.();

            return;
          }

          setSuccessCopy(SUCCESS[action]);

          // Parcial. Acá SÍ hay que nombrar a quién le tocó y a quién no, y es la diferencia
          // con `skipped`: el backend salta filas por una regla suya y el motivo se repite,
          // pero esto son peticiones sueltas que se cayeron a media tanda. Las que pasaron ya
          // están inactivas y no se deshacen, así que quien mira la pantalla necesita saber
          // exactamente sobre cuáles hay que volver.
          if (fallidas.length) {
            toast({
              title: `${fallidas.length} de ${records.length} quedaron sin revertir`,
              message: `Siguen entregadas: ${fallidas
                .map(({ record }) => record.fullName)
                .join(' · ')}`,
              icon: 'caution',
              theme: 'caution'
            });
          }

          onDone?.();

          return;
        }

        const result = await repository.bulk(
          action,
          {
            codes: records.map((record) => String(record.id)),
            ...(note ? { reason: note } : {})
          },
          records
        );

        // Si el backend no tocó ninguna, no hubo éxito que celebrar: se cuenta su
        // motivo, que explica mejor que nosotros por qué no se pudo.
        if (!result.total_processed) {
          toast({
            title:
              action === 'deliver'
                ? 'No se entregó ninguna'
                : 'No se inactivó ninguna',
            message:
              result.skipped?.[0]?.reason ??
              'No se pudo procesar ninguna de las acreditaciones seleccionadas.',
            icon: 'caution',
            theme: 'caution'
          });

          onDone?.();

          return;
        }

        // Inactivar cambia los lotes: el backend REGENERA el PDF del lote sin esa hoja
        // —los demás carnets conservan su QR— y si era el último, retira el lote. La
        // lista cacheada de lotes deja de ser cierta justo acá, aunque quien inactiva
        // esté en otra pantalla.
        if (action === 'deactivate') {
          batchRepository.invalidate();
        }

        setSuccessCopy(SUCCESS[action]);

        // Éxito parcial: unas sí y otras no. Se dice cuántas y por qué.
        if (result.skipped?.length) {
          toast({
            title: `${result.skipped.length} de ${result.total_requested} quedaron sin cambio`,
            message: result.skipped
              .map((item) => item.reason)
              .filter((reason, index, all) => all.indexOf(reason) === index)
              .join(' · '),
            icon: 'caution',
            theme: 'caution'
          });
        }

        onDone?.();
      } catch (error) {
        toast({
          title: 'No se pudo completar la acción',
          message: getApiErrorMessage(error, ERRORS[action]),
          icon: 'caution',
          theme: 'negative'
        });
      }
    },
    [toast, onDone]
  );

  return {
    askDeactivate,
    askDeliver,
    askUndoDelivery,
    askUndoDeliveryMany,
    confirmCopy,
    onCancel,
    onCloseSuccess,
    onConfirm,
    successCopy
  };
}
