import { AccreditationCardRepository } from '@mf-accreditations/data';
import type { CardBatch, CardBatchSkip } from '@mf-accreditations/domain';
import { invertly } from '@rolster/invertly';
import { useCallback, useEffect, useRef, useState } from 'react';

import { openUploadedFile } from './file-viewer.helper';

const repository = invertly(AccreditationCardRepository);

// Cuánto se espera a que el backend termine el lote.
//
// Eran 48 intentos de 2,5 s: **dos minutos**. Y backend garantiza desde SUV2-2278 que un lote
// que no responde pasa a FAILED a los **quince**, con su `error_detail` en español. O sea que
// el cliente cubría un séptimo de la ventana real: un lote que tardara algo más de dos
// minutos caía en `timeout` aunque fuera a terminar bien.
//
// Y eso no era solo un aviso injusto. El texto del timeout invita a reintentar, reintentar
// dispara otro POST, y ese POST **crea otro lote**: es parte de por qué en staging aparecieron
// siete lotes de la misma acreditación en cuatro minutos.
//
// El techo sube por encima de los quince minutos, pero la espera se ESCALONA en vez de pasar
// de 48 peticiones a 390: rápido al principio, que es cuando termina de verdad —~9 s medidos
// con una acreditación—, y lento después, cuando ya solo se está esperando el desenlace.
//
//     12 × 2,5 s  =  30 s        (el caso normal cae acá)
//     93 × 10 s   = 930 s
//     ──────────────────────
//     105 intentos ≈ 16 minutos, en 105 peticiones
const POLL_DELAY = 2500;
const POLL_DELAY_LARGO = 10000;
const INTENTOS_RAPIDOS = 12;
const POLL_ATTEMPTS = 105; // ~16 minutos

// `timeout` se queda como último recurso y NO se borra: con la garantía de backend debería
// ser inalcanzable, pero «debería» no es «es», y una pantalla girando para siempre es peor
// que un aviso de más. Si algún día se comprueba que no se alcanza, entonces sí se quita.
function esperaDelIntento(attempt: number): number {
  return attempt <= INTENTOS_RAPIDOS ? POLL_DELAY : POLL_DELAY_LARGO;
}

export type CardStatus =
  | 'idle'
  | 'requesting'
  | 'generating'
  | 'ready'
  | 'timeout'
  | 'failure';

export interface AccreditationCardState {
  batch?: CardBatch;
  error?: unknown;
  status: CardStatus;
  // Cuántas veces se ha preguntado por el lote; la pantalla lo usa para no dejar el
  // mensaje de espera muerto.
  attempt: number;
}

// El ciclo completo de la acreditación: pedirlo, esperar a que exista y abrirlo. Quien llama
// decide QUÉ pide —el PDF de una acreditación o el de un lote de varias—; la espera, los
// estados y la apertura del PDF son los mismos.
//
// Tres decisiones que valen la pena:
//
// - **No se abre solo.** Entre el clic y el PDF pasan varios segundos, así que el
//   gesto del usuario ya se perdió y Chrome bloquearía el window.open. En lugar de
//   pelear con el bloqueador, la pantalla queda con «Abrir acreditación» y ese clic sí
//   abre.
// - **La URL se firma en ese segundo clic**, no al terminar la generación: la
//   prefirmada vive 10 minutos y así nunca se entrega una vencida.
// - **El `request` va por referencia**, no en las dependencias: los llamadores lo pasan
//   como función anónima y meterlo en deps reiniciaría la espera en cada render.
export function useCardBatch(
  request: (() => Promise<CardBatch>) | undefined,
  resetKey?: unknown
) {
  const [state, setState] = useState<AccreditationCardState>({
    status: 'idle',
    attempt: 0
  });

  // Los carnets que NO salieron, en una referencia y fuera del estado: solo viajan en el 202
  // y el sondeo reemplaza el lote entero con el del GET, que ya no los trae —backend no los
  // persiste (SUV2-2531)—. Leerlos de `batch.skipped` los perdía a los 2,5 s.
  const omitidosRef = useRef<CardBatchSkip[]>([]);
  // Qué generación es la vigente. Sin esto, dos emisiones seguidas dejaban DOS bucles vivos:
  // el viejo terminaba después y pintaba su lote junto a los omitidos del nuevo, atribuyendo
  // a un lote gente que no era suya.
  const generacionRef = useRef(0);

  const requestRef = useRef(request);

  requestRef.current = request;

  // Para no seguir pidiendo —ni tocar estado— si la pantalla ya se cerró.
  const activeRef = useRef(true);
  // El batch_code sobrevive a un timeout: reintentar debe seguir esperando el MISMO lote, no
  // encolar otro que quede colgado en el backend para siempre.
  //
  // Pero solo a un timeout. Si sobrevive también al lote TERMINADO, «Generar otro lote» deja
  // de generar nada: encuentra el código puesto, se salta el POST y se pone a mirar otra vez
  // el lote de antes, que ya está listo. La pantalla enseña «El lote #4 quedó listo» y parece
  // que funcionó. Se limpia al llegar a `ready` —ver abajo—, que es donde el ciclo se acaba.
  const batchRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    batchRef.current = undefined;
    omitidosRef.current = [];
    setState({ status: 'idle', attempt: 0 });
  }, [resetKey]);

  const generate = useCallback(async () => {
    const requestBatch = requestRef.current;

    if (!requestBatch) {
      return;
    }

    generacionRef.current += 1;

    const generacion = generacionRef.current;
    // Vale por `activeRef` Y por no haber sido reemplazada: la pantalla puede seguir montada
    // y aun así este bucle haber dejado de ser el que importa.
    const vigente = () =>
      activeRef.current && generacionRef.current === generacion;

    setState({ status: batchRef.current ? 'generating' : 'requesting', attempt: 0 });

    try {
      if (!batchRef.current) {
        // Se limpia acá y no al entrar: reintentar tras un timeout NO pide lote nuevo, y
        // borrarlos ahí habría perdido los omitidos del 202 que lo encoló.
        omitidosRef.current = [];

        const accepted = await requestBatch();

        batchRef.current = String(accepted.id);
        omitidosRef.current = accepted.skipped;

        if (!vigente()) {
          return;
        }

        setState({ status: 'generating', batch: accepted, attempt: 0 });
      }

      const batchCode = batchRef.current;

      for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
        const batch = await repository.requestBatch(batchCode);

        if (!vigente()) {
          return;
        }

        if (batch.finished) {
          // FAILED, o terminado pero sin ningún PDF descargable: en los dos casos no
          // hay nada que abrir, y el motivo lo redacta el backend.
          if (batch.failed || !batch.file) {
            // El ciclo se acabó, aunque haya acabado mal: el siguiente `generate()` tiene
            // que pedir un lote NUEVO. Sin esto se saltaba el POST y volvía a mirar el lote
            // ya fallido, así que «reintentar» no reintentaba nada —y el propio mensaje del
            // backend dice «Vuelve a emitir el lote»—. Lo cazó el check del lote fallido.
            batchRef.current = undefined;

            setState({
              status: 'failure',
              batch,
              attempt,
              error: new Error(
                batch.errorDetail ??
                  'El lote terminó sin generar el PDF de la acreditación.'
              )
            });

            return;
          }

          // El ciclo se acabó: el siguiente `generate()` tiene que pedir un lote NUEVO, no
          // volver a mirar este. Sin esto, «Generar otro lote» no generaba ninguno.
          batchRef.current = undefined;

          setState({ status: 'ready', batch, attempt });

          return;
        }

        setState({ status: 'generating', batch, attempt });

        await wait(esperaDelIntento(attempt));

        if (!vigente()) {
          return;
        }
      }

      if (vigente()) {
        setState((current) => ({ ...current, status: 'timeout' }));
      }
    } catch (error) {
      if (vigente()) {
        setState((current) => ({ ...current, status: 'failure', error }));
      }
    }
  }, []);

  // Se firma acá dentro para que la URL nazca con el clic. Lanza si el archivo no
  // tiene URL, y la pantalla lo cuenta con un toast.
  const open = useCallback(async () => {
    const uploadId = state.batch?.file?.uploadId;

    if (!uploadId) {
      return;
    }

    await openUploadedFile(uploadId);
  }, [state.batch]);

  return { ...state, omitidos: omitidosRef.current, generate, open };
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

// La acreditación de UNA acreditación, que es el caso del detalle del acreditado.
export function useAccreditationCard(accreditationCode: string | undefined) {
  return useCardBatch(
    accreditationCode
      ? () => repository.requestCard(accreditationCode)
      : undefined,
    accreditationCode
  );
}

export type CardBatchWatchStatus =
  | 'loading'
  | 'watching'
  // El backend ya no lo va a mover; si terminó bien o mal lo dice el propio lote.
  | 'settled'
  | 'timeout'
  | 'failure';

export interface CardBatchWatchState {
  attempt: number;
  batch?: CardBatch;
  error?: unknown;
  status: CardBatchWatchStatus;
}

// Un lote que YA existe: se lee y, mientras se esté generando, se vuelve a leer.
//
// No es lo mismo que `useCardBatch`: ese pide un lote nuevo y espera su PDF. Este solo
// observa uno que le dan, y sigue preguntando por una razón que va más allá del estado:
// los integrantes del lote solo viajan cuando termina, así que preguntar una sola vez
// dejaría la tabla vacía diciendo que el lote no lleva a nadie.
export function useCardBatchDetail(batchCode: string | undefined) {
  const [state, setState] = useState<CardBatchWatchState>({
    status: 'loading',
    attempt: 0
  });

  // Reintentar es volver a entrar al efecto, no duplicar su lógica acá.
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!batchCode) {
      return;
    }

    // Cubre las dos salidas: la pantalla se cerró, o cambió el lote que se observa.
    let cancelled = false;

    setState({ status: 'loading', attempt: 0 });

    void (async () => {
      for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
        try {
          const batch = await repository.requestBatch(batchCode);

          if (cancelled) {
            return;
          }

          if (batch.finished) {
            setState({ status: 'settled', batch, attempt });

            return;
          }

          setState({ status: 'watching', batch, attempt });
        } catch (error) {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              status: 'failure',
              error,
              attempt
            }));
          }

          return;
        }

        await wait(esperaDelIntento(attempt));

        if (cancelled) {
          return;
        }
      }

      setState((current) => ({ ...current, status: 'timeout' }));
    })();

    return () => {
      cancelled = true;
    };
  }, [batchCode, reloadKey]);

  return { ...state, reload };
}
