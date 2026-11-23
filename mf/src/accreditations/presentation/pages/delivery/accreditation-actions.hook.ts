import { AccreditationRepository } from '@mf-accreditations/data';
import type { Accreditation } from '@mf-accreditations/domain';
import { NwtContext } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useCallback, useContext, useRef, useState } from 'react';

import {
  deactivateAccreditationsCopy,
  DEACTIVATION_SUCCESS_COPY,
  deliverAccreditationsCopy,
  DELIVERY_SUCCESS_COPY
} from './delivery.copy';
import type { DeliveryConfirmCopy } from './DeliveryConfirmModal';

const repository = invertly(AccreditationRepository);

type AccreditationAction = 'deactivate' | 'deliver';

interface PendingAction {
  accreditations: Accreditation[];
  action: AccreditationAction;
}

export interface AccreditationSuccessCopy {
  bullets: string[];
  caution: string;
  title: string;
}

const SUCCESS: Record<AccreditationAction, AccreditationSuccessCopy> = {
  deliver: DELIVERY_SUCCESS_COPY,
  deactivate: DEACTIVATION_SUCCESS_COPY
};

const ERRORS: Record<AccreditationAction, string> = {
  deliver: 'No fue posible registrar la entrega. Inténtalo nuevamente.',
  deactivate: 'No fue posible inactivar. Inténtalo nuevamente.'
};

// Las acciones sobre acreditaciones son las mismas en la lista (masivas sobre la
// selección) y en el detalle (individuales), así que el flujo
// preguntar → ejecutar → avisar vive una sola vez.
export function useAccreditationActions(onDone?: () => void) {
  const { toast } = useContext(NwtContext);

  const [confirmCopy, setConfirmCopy] = useState<DeliveryConfirmCopy>();
  const [successCopy, setSuccessCopy] = useState<AccreditationSuccessCopy>();
  const pendingRef = useRef<PendingAction | undefined>(undefined);

  const askDeliver = useCallback((accreditations: Accreditation[]) => {
    if (!accreditations.length) {
      return;
    }

    pendingRef.current = { accreditations, action: 'deliver' };

    setConfirmCopy(deliverAccreditationsCopy(accreditations.length));
  }, []);

  const askDeactivate = useCallback((accreditations: Accreditation[]) => {
    if (!accreditations.length) {
      return;
    }

    pendingRef.current = { accreditations, action: 'deactivate' };

    setConfirmCopy(deactivateAccreditationsCopy(accreditations.length));
  }, []);

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

      const { accreditations, action } = pending;

      try {
        await (action === 'deliver'
          ? repository.deliver(accreditations, note)
          : repository.deactivate(accreditations, note));

        setSuccessCopy(SUCCESS[action]);

        onDone?.();
      } catch {
        toast({
          title: 'No se pudo completar la acción',
          message: ERRORS[action],
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
    confirmCopy,
    onCancel,
    onCloseSuccess,
    onConfirm,
    successCopy
  };
}
