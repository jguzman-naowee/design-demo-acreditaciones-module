import { CertificateRepository } from '@mf-accreditations/data';
import type {
  CertificateBatch,
  CertificateBatchRequested
} from '@mf-accreditations/domain';
import { invertly } from '@rolster/invertly';
import { useCallback, useEffect, useRef, useState } from 'react';

const repository = invertly(CertificateRepository);

// Medido en stg (2026-09-07): un certificado tarda ~12-15 s. El polling solo
// observa: perderlo de vista no cancela nada (mismo comportamiento que los
// lotes de carnets).
const POLL_DELAY = 2500;
const POLL_ATTEMPTS = 48; // ~2 minutos

export type CertificateGenerationStatus =
  | 'idle'
  | 'requesting'
  | 'generating'
  | 'ready'
  | 'timeout'
  | 'failure';

export interface CertificateGenerationState {
  requested?: CertificateBatchRequested;
  batch?: CertificateBatch;
  error?: unknown;
  status: CertificateGenerationStatus;
}

// El ciclo del lote de certificados: pedirlo (202) y esperar a que el estado
// sea terminal. Calcado de useCardBatch: el `request` va por referencia para
// que los llamadores puedan pasar funciones anónimas sin reiniciar la espera.
export function useCertificateGeneration(resetKey?: unknown) {
  const [state, setState] = useState<CertificateGenerationState>({
    status: 'idle'
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resetKey !== undefined) {
      setState({ status: 'idle' });
    }
  }, [resetKey]);

  const generate = useCallback(
    async (request: () => Promise<CertificateBatchRequested>) => {
      setState({ status: 'requesting' });

      try {
        const requested = await request();

        if (!mountedRef.current) {
          return;
        }

        setState({ status: 'generating', requested });

        for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, POLL_DELAY));

          if (!mountedRef.current) {
            return;
          }

          const batch = await repository.requestBatch(requested.batchCode);

          if (!mountedRef.current) {
            return;
          }

          if (batch.finished) {
            setState({ status: 'ready', requested, batch });

            return;
          }

          setState({ status: 'generating', requested, batch });
        }

        setState((current) => ({ ...current, status: 'timeout' }));
      } catch (error) {
        if (mountedRef.current) {
          setState({ status: 'failure', error });
        }
      }
    },
    []
  );

  return { ...state, generate };
}
