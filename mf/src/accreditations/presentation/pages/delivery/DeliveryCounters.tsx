import {
  AccreditationBatchRepository,
  AccreditationRepository
} from '@mf-accreditations/data';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import { NwtSubheader } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useMemo } from 'react';

const batchRepository = invertly(AccreditationBatchRepository);
const accreditationRepository = invertly(AccreditationRepository);

export function DeliveryCounters() {
  const batchController = useRepository(batchRepository);
  const accreditationController = useRepository(accreditationRepository);

  // TODO(api): el backend calculará estos totales. Entregadas = el histórico
  // que trae cada lote más lo que se entregue en esta sesión; las semillas de
  // acreditaciones nacen sin entregar para no contarse dos veces.
  const counters = useMemo(() => {
    const batches = batchController.state.is('success')
      ? batchController.state.entities
      : [];

    const accreditations = accreditationController.state.is('success')
      ? accreditationController.state.entities
      : [];

    const totals = batches.reduce(
      (accumulated, batch) => ({
        generated: accumulated.generated + batch.total,
        delivered: accumulated.delivered + batch.delivered
      }),
      { generated: 0, delivered: 0 }
    );

    const delivered = accreditations.filter(
      (accreditation) => accreditation.deliveryStatus === 'DELIVERED'
    ).length;

    return { ...totals, delivered: totals.delivered + delivered };
  }, [batchController.state, accreditationController.state]);

  return (
    <NwtSubheader
      className="nws-delivery-counters"
      items={[
        {
          // Los dos documentos apilados del diseño.
          icon: 'copy',
          content: 'Acreditaciones generadas',
          badge: counters.generated
        },
        {
          // El check que el diseño le pone encima lo compone el SCSS.
          icon: 'user',
          content: 'Acreditaciones entregadas',
          badge: counters.delivered
        }
      ]}
    />
  );
}
