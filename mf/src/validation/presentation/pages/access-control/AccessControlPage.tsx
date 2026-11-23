// ═══════════════════════════════════════════════════════════════════════════════
// PRÓXIMA A BORRAR — decisión de producto, 2026-09-03
//
// A esta pantalla solo se llega escribiendo su URL: no está en el menú y nada del
// módulo la enlaza. Andrés decidió que las que están así no se van a usar.
//
// Se marca en vez de borrarse ya para que la eliminación sea un cambio propio y
// revisable, no un arrastre. La lista completa está en el README, sección
// «Pantallas próximas a borrar».
//
// Qué es: «Control de accesos», una fila por acreditación con sus validaciones. Contra
// mocks, y ADEMÁS su grupo del menú está oculto por decisión de producto. Es la única de
// las marcadas que no avisa de que sus datos son de ejemplo.
// ═══════════════════════════════════════════════════════════════════════════════

import './AccessControlPages.scss';

import {
  AccreditedRecordRepository,
  AccreditedTypeRepository,
  ValidationLogRepository
} from '@mf-accreditations/data';
import type { AccreditedRecord } from '@mf-accreditations/domain';
import {
  NwsEventGuard,
  type NwsEventScope,
  NwsEventSelector,
  NwsLoading,
  NwsRequestError,
  useSearchTerm
} from '@mf-accreditations/presentation';
import { usePaginationRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtButton,
  NwtCard,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AccessControlTable } from './AccessControlTable';

const repository = invertly(AccreditedRecordRepository);
const logRepository = invertly(ValidationLogRepository);
const typeRepository = invertly(AccreditedTypeRepository);

const VALIDATE_ROUTE = '/validation/validate';

// El estado se filtra en pantalla y no en el servidor: medido contra dev, el gateway DESCARTA
// `status` —su AccreditationMsListAccreditationsParams solo lleva event_id, search, page y
// limit—, así que mandarlo daría las mismas filas y el filtro parecería roto. Sobre la página
// que llegó sí recorta de verdad.
const STATUS_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Estados', value: 'all' },
  { key: 'ACTIVE', label: 'Activa', value: 'ACTIVE' },
  { key: 'INACTIVE', label: 'Inactiva', value: 'INACTIVE' }
];

// La lista de accesos al evento: una fila por acreditación, con sus validaciones y la última vez
// que se leyó en un punto de acceso.
//
// Cruza tres endpoints reales, y cada uno aporta una parte de la fila del diseño:
//
//   GET /accreditations?event_id=   la persona, su estado y los usos consumidos
//   GET /validation-logs?event_id=  la fecha de la última lectura de cada acreditación
//   GET /roles?event_id=            el tope de validaciones del tipo, que es el denominador
//
// El tope vive en el TIPO y no en la acreditación: el backend lo guarda por permiso
// (`max_uses_per_person`), y el diseño muestra uno solo por acreditado.
export function AccessControlPage() {
  return (
    <NwsEventGuard>{(scope) => <AccessControlCatalog {...scope} />}</NwsEventGuard>
  );
}

function AccessControlCatalog({ eventId }: NwsEventScope) {
  // El evento se deja puesto antes de montar el controlador: su primera petición ya sale
  // filtrada, en lugar de gastarse con un event_id imposible y repetirse después.
  repository.applyEventScope({ event_id: eventId });

  const controller = usePaginationRepository(repository);
  const navigate = useNavigate();

  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);
  const statusFilter = useFormControl<string | undefined>('all');

  // La última lectura de cada acreditación, por su código. Se pide una vez por evento: el
  // listado de lecturas no permite pedir «la última de cada una», así que se agrupa acá.
  const [lastReads, setLastReads] = useState<Record<string, Date>>({});
  // El tope de validaciones por tipo de acreditado, indexado por `role_code`.
  const [limits, setLimits] = useState<Record<string, number | null>>({});

  useEffect(() => {
    controller.applyFilters({
      event_id: eventId,
      ...(query ? { search: query } : {})
    });
  }, [eventId, query]);

  useEffect(() => {
    let alive = true;

    // Ninguna de las dos es crítica para la tabla: sin ellas la fila se pinta igual, con la
    // fecha de lectura y el tope en raya, en lugar de dejar la pantalla en error.
    logRepository
      .requestAll({ event_id: eventId, limit: 100 })
      .then((list) => {
        if (!alive) {
          return;
        }

        const latest: Record<string, Date> = {};

        list.items.forEach((log) => {
          const current = latest[log.accreditationCode];

          if (!current || log.scannedAt > current) {
            latest[log.accreditationCode] = log.scannedAt;
          }
        });

        setLastReads(latest);
      })
      .catch(() => undefined);

    typeRepository
      .requestAll({ event_id: eventId, limit: 100 })
      .then((list) => {
        if (alive) {
          setLimits(
            Object.fromEntries(
              list.items.map((type) => [type.roleCode, type.validationLimit])
            )
          );
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [eventId]);

  const records = useMemo(
    () => (controller.state.is('success') ? controller.pageEntities : []),
    [controller.state, controller.pageEntities]
  );

  const filtered = useMemo(
    () =>
      statusFilter.value === 'all'
        ? records
        : records.filter((record) => record.status === statusFilter.value),
    [records, statusFilter.value]
  );

  const onViewDetail = useCallback(
    (record: AccreditedRecord) => {
      navigate(`/validation/access-control/${record.id}`);
    },
    [navigate]
  );

  // La credencial pública vive en el módulo de acreditaciones y el shell ya la pinta sin marco;
  // al compartir router, el salto no recarga la aplicación.
  //
  // Hoy no la dispara nadie: la acción que la llamaba está OCULTA TEMPORALMENTE (ver
  // `CREDENTIAL_ACTION_VISIBLE` y la marca en `AccessControlTable`). Se deja cableada para
  // que devolverla sea solo poner esa constante en `true`.
  const onViewProfile = useCallback(
    (record: AccreditedRecord) => {
      navigate(`/profile/event/${record.id}`);
    },
    [navigate]
  );

  // Validar exige el `qr_validation_token`, que solo existe IMPRESO en el carnet: ningún GET lo
  // expone. Así que desde acá no se puede validar a nadie, y el botón lleva a la pantalla donde
  // ese token se escanea o se pega.
  const onValidate = useCallback(() => {
    navigate(VALIDATE_ROUTE);
  }, [navigate]);

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando accesos, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('failure')) {
      return (
        <NwsRequestError
          error={controller.state.error}
          title="No pudimos cargar los accesos"
          onRetry={controller.refresh}
        />
      );
    }

    return (
      <NwtCard>
        <div className="nws-access-control__filters">
          <div className="nws-access-control__search">
            <NwtSearchbox formControl={search} placeholder="Buscar" />

            <NwtDropdown
              formControl={statusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>

          {/* Paginación del servidor: cada página es una petición. */}
          <NwtPagination
            currentPage={controller.currentPage}
            totalPages={controller.totalPages}
            onChange={controller.goToPage}
            nwtSize="small"
          />
        </div>

        {filtered.length ? (
          <AccessControlTable
            startAt={(controller.currentPage - 1) * 10 + 1}
            records={filtered}
            lastReads={lastReads}
            limits={limits}
            onViewDetail={onViewDetail}
            onViewProfile={onViewProfile}
          />
        ) : (
          <NwtEmptyState
            title={records.length ? 'Sin resultados' : 'Aún no hay accesos'}
            description={
              records.length
                ? 'Ninguna acreditación coincide con los filtros.'
                : 'Cuando se generen acreditaciones aparecerán aquí para validarlas.'
            }
            showAction={false}
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-access-control">
      <div className="nws-access-control__content">
        <div className="nws-access-control__header">
          <div className="nws-access-control__description">
            <span className="nwt-h5-font-bold">Lista de accesos al evento</span>

            <small className="nwt-smalltext-font-regular">
              Gestiona las validaciones de los participantes al evento.
            </small>
          </div>

          <div className="nws-access-control__actions">
            <NwsEventSelector />

            <NwtButton
              icon="add"
              nwtVariant="loud"
              nwtTheme="negative"
              nwtSize="medium"
              onClick={onValidate}
            >
              Validar un participante
            </NwtButton>
          </div>
        </div>

        {renderCatalog()}
      </div>
    </section>
  );
}
