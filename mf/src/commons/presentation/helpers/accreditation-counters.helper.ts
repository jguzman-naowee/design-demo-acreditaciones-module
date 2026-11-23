import { AccreditedRecordRepository } from '@mf-accreditations/data';
import type { AccreditationCounters } from '@mf-accreditations/domain';
import type { NwtDetailGroupItem } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useEffect, useMemo, useState } from 'react';

const repository = invertly(AccreditedRecordRepository);

// Los contadores del evento para la banda superior: «Acreditaciones generadas» y
// «Acreditaciones entregadas».
//
// Sale de UNA consulta agregada del backend, no de contar el listado en el navegador: la
// pantalla lo pide una vez por evento y fase, no por fila ni por página.
//
// `reloadKey` es para las pantallas que cambian esos números —acreditar a alguien, entregar
// un carnet—: al moverlo, se vuelven a pedir. Sin él, no se refrescan solos.
export function useAccreditationCounters(
  eventCode?: string,
  phaseCode?: string,
  reloadKey?: unknown,
  momentCode?: string | null
): NwtDetailGroupItem[] | undefined {
  const [counters, setCounters] = useState<AccreditationCounters>();

  useEffect(() => {
    if (!eventCode) {
      return;
    }

    let alive = true;

    repository
      .requestSummary(eventCode, phaseCode, momentCode)
      .then((resultado) => {
        if (alive) {
          setCounters(resultado);
        }
      })
      // La banda es contexto, no el contenido: si los contadores no llegan, la pantalla se
      // usa igual y sale sin ellos. Un badge en cero mentiría.
      .catch(() => {
        if (alive) {
          setCounters(undefined);
        }
      });

    return () => {
      alive = false;
    };
  }, [eventCode, phaseCode, reloadKey, momentCode]);

  return useMemo(
    () =>
      counters && [
        {
          icon: 'copy',
          content: 'Acreditaciones generadas',
          badge: counters.generated
        },
        {
          icon: 'user',
          content: 'Acreditaciones entregadas',
          badge: counters.delivered
        }
      ],
    [counters]
  );
}
