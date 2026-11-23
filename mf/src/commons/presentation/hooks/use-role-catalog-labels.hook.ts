import { RoleCatalogRepository } from '@mf-accreditations/data';
import type { RoleCatalogFamily } from '@mf-accreditations/domain';
import { invertly } from '@rolster/invertly';
import { useCallback, useEffect, useState } from 'react';

import { formatCodeLabel } from '../helpers/format.helper';

const familyRepository = invertly(RoleCatalogRepository);

/**
 * Cómo se llama un rol de acreditado en pantalla, según el diccionario del backend.
 *
 * Existe porque `formatCodeLabel` es un ÚLTIMO RESPALDO y no un traductor: con un código que no
 * reconoce devuelve el código escrito para leerse, y los de este módulo están en inglés. Así
 * salían en la tabla de acreditables —lo reportó QA—: `PER` como «Per», `JMI` como «Jmi»,
 * `SPECIAL_GUEST` como «Special guest» y `FEDERATION_PRESIDENT` como «Federation president».
 *
 * No se resuelve con un mapa escrito a mano: el backend ya publica estos nombres en
 * `/catalogs/event-role` (30 funciones del personal del evento) y `/catalogs/support-personnel-role`
 * (las tres del personal de apoyo de las delegaciones). Duplicarlos acá es como se desincronizan
 * dos sitios que dicen lo mismo, que es la razón por la que `formatCodeLabel` consulta
 * `PLATFORM_ROLE_LABELS` en vez de traer su propia copia.
 *
 * Va en un hook y no en cada pantalla porque el mismo código se pinta en dos sitios —la tabla de
 * acreditables y el modal de acreditación—, montados por páginas distintas.
 *
 * Sale de `role-catalog`, que trae familias Y funciones con su nombre: antes eran dos
 * diccionarios más una lista de categorías escrita a mano, y los códigos que no estaban en
 * ninguno —los de Naowee— se pintaban «Naowee coordinator».
 *
 * Ojo: `PLATFORM_ROLE_LABELS` repite dos de esas cuatro entradas con el mismo texto. No se unifica
 * acá para no arrastrar a `formatCodeLabel`, que lo consumen otras pantallas; queda anotado.
 */
export function useRoleCatalogLabels(): {
  labelOf: (code: string) => string;
} {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;

    // Un reintento, porque el respaldo es `formatCodeLabel` y con él las categorías se leen en
    // inglés —«Athlete» por «Deportista»—. Lo pidió Juan Ma en la revisión. No hay tercero: si
    // el catálogo sigue caído, insistir no lo arregla y sí retrasa la tabla.
    const pedir = (): Promise<RoleCatalogFamily[]> =>
      familyRepository
        .requestFamilies()
        .catch(() => familyRepository.requestFamilies());

    // SIN `event_id`: para rotular da igual quién esté inscrito, y así el hook no depende de
    // que la pantalla que lo usa tenga evento puesto.
    pedir()
      .then((familias) => {
        if (!alive) {
          return;
        }

        // Familias y funciones en el mismo mapa: los dos códigos se pintan en las tablas y el
        // backend garantiza que no chocan —una familia y una función no comparten código—.
        setNames(
          Object.fromEntries(
            familias.flatMap((familia) => [
              [familia.code, familia.name],
              ...familia.functions.map((funcion) => [funcion.code, funcion.name])
            ])
          )
        );
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const labelOf = useCallback(
    (code: string) => names[code] ?? formatCodeLabel(code),
    [names]
  );

  return { labelOf };
}
