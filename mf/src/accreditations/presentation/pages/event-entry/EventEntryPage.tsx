import './EventEntryPage.scss';

import {
  EventCatalogRepository,
  SuiteEventRepository
} from '@mf-accreditations/data';
import type { AccreditationPhase, SuiteEvent } from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  getApiErrorMessage,
  NwsLoading,
  NwsRequestError,
  useActiveEvent,
  useSearchTerm
} from '@mf-accreditations/presentation';
import { usePaginationRepository } from '@naowee-tech/sdk-frontend-react';
import {
  NwtAlert,
  NwtButton,
  NwtCard,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';

const repository = invertly(EventCatalogRepository);
const eventRepository = invertly(SuiteEventRepository);

interface PhaseDetail {
  error?: unknown;
  loading?: boolean;
  phases?: AccreditationPhase[];
}

// La flechita de la fila, en SVG y no con `icon="chevron-down"`: el módulo dejó de llevar la
// tipografía de iconos del sistema de diseño —le pisaba los del anfitrión, ver mf#9— así que
// un icono de fuente no pintaría nada.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`nws-event-entry__chevron${open ? ' nws-event-entry__chevron--open' : ''}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

// A dónde se va después de elegir, cuando no se venía de ninguna pantalla.
//
// «Gestión de acreditables» es el principio del embudo —quién se PUEDE acreditar— y es la
// pantalla con la que se entra a trabajar. Apuntaba a `/delivery/event-accredited`, que se
// retiró y hoy redirige a «Lista de acreditados»: se entraba por el final.
const DEFAULT_ROUTE = '/delivery/enabled';

// La entrada del módulo: aquí se elige en qué evento se trabaja.
//
// Existe por una razón medida, no por gusto: todo el módulo se lee por evento, y mientras
// no había un sitio donde elegirlo, CADA pantalla arrancaba pidiendo el catálogo de
// eventos —cinco páginas de cien en dev— y una consulta con un evento imposible que se
// descartaba entera. Entrar a «Lotes de acreditaciones» costaba doce peticiones para mostrar
// diez lotes.
//
// Ahora el catálogo se pide solo acá, y las demás pantallas rebotan a esta si no hay
// evento elegido (NwsEventGuard). La elección se recuerda entre recargas, así que esto se
// ve una vez al día, no en cada navegación.
//
// Y desde el catálogo del módulo (`/accreditation/events/catalog`) es UNA petición: trae
// solo los eventos con acreditación configurada y busca en el servidor, en lugar de
// recorrer las cinco páginas de los 485 eventos de la suite para poder filtrar acá.
export function EventEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    enter,
    clear,
    error,
    event,
    eventId,
    phase,
    phases,
    resolving,
    selectPhase
  } = useActiveEvent();

  // Se entra siempre por la primera página. Ver `forgetPages`: la lista cacheada acumula las
  // páginas traídas y el repositorio es un singleton, así que sin esto volver con «Cambiar»
  // te dejaba donde estabas. Lo reportó QA.
  //
  // Va en un inicializador de `useState` —que corre UNA vez y durante el render— y no en un
  // efecto: los efectos corren DESPUÉS del que el propio controlador usa para pedir su
  // primera página, así que para entonces ya sería tarde.
  useState(() => repository.forgetPages());

  const controller = usePaginationRepository(repository);
  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);

  // Solo se navega cuando la elección se hizo ACÁ: si no, entrar a propósito para cambiar
  // de evento te devolvería de inmediato al sitio del que venías.
  const [chosen, setChosen] = useState(false);

  const target = useMemo(
    () => (location.state as { from?: string } | null)?.from ?? DEFAULT_ROUTE,
    [location.state]
  );

  useEffect(() => {
    if (chosen && eventId !== undefined) {
      navigate(target, { replace: true });
    }
  }, [chosen, eventId, navigate, target]);

  // La búsqueda viaja: el backend la resuelve por nombre, parcial y sin distinguir tildes
  // ni mayúsculas.
  useEffect(() => {
    controller.applyFilters({ ...(query ? { search: query } : {}) });
  }, [query]);

  const events = useMemo(
    () => (controller.state.is('success') ? controller.pageEntities : []),
    [controller.state, controller.pageEntities]
  );

  const searching = !!query;

  // Las fases de cada evento, pedidas SOLO al desplegar su fila y guardadas por código: la
  // pantalla no puede arrancar pidiendo el detalle de los diez eventos de la página —esa es
  // justo la razón por la que esta pantalla existe— y volver a desplegar no vuelve a pedir.
  const [expanded, setExpanded] = useState<string>();
  const [details, setDetails] = useState<Record<string, PhaseDetail>>({});

  function onToggle(selected: SuiteEvent) {
    if (expanded === selected.code) {
      setExpanded(undefined);

      return;
    }

    setExpanded(selected.code);

    if (details[selected.code]) {
      return;
    }

    setDetails((current) => ({
      ...current,
      [selected.code]: { loading: true }
    }));

    eventRepository
      .requestPhases(selected)
      .then((phaseList) =>
        setDetails((current) => ({
          ...current,
          [selected.code]: { phases: phaseList }
        }))
      )
      .catch((cause: unknown) =>
        setDetails((current) => ({
          ...current,
          [selected.code]: { error: cause }
        }))
      );
  }

  function onEnter(
    selected: SuiteEvent,
    selectedPhase: AccreditationPhase,
    available: AccreditationPhase[]
  ) {
    setChosen(true);
    enter(selected, selectedPhase, available);
  }

  const siblingMoments = useMemo(
    () =>
      phase?.momentCode
        ? phases.filter(
            (item) => item.code === phase.code && item.key !== phase.key
          )
        : [],
    [phase, phases]
  );

  function onChoosePhase(selected: AccreditationPhase) {
    setChosen(true);
    selectPhase(selected);
  }

  // Paso dos: el `event_id` del backend identifica el par evento+fase, así que con varias
  // fases acreditables hay que preguntar. Adivinar sería escribir en la fase equivocada.
  if (event && phases.length > 1 && eventId === undefined && !resolving) {
    return (
      <section className="nws-event-entry">
        <div className="nws-event-entry__content">
          <div className="nws-event-entry__header">
            <span className="nwt-h4-font-bold">
              ¿En qué fase o momento vas a trabajar?
            </span>

            <small className="nwt-text-font-regular">
              {event.name} tiene {phases.length} fases o momentos con proceso de
              acreditación, y cada uno lleva sus propios acreditados.
            </small>
          </div>

          {/* Sin esto, un fallo al resolver la opción —p. ej. registrar un momento sin
              permiso— devolvía a este paso sin decir nada. */}
          {!!error && (
            <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
              {getApiErrorMessage(
                error,
                'No pudimos abrir esa fase o momento en el módulo de acreditación. Inténtalo de nuevo.'
              )}
            </NwtAlert>
          )}

          <NwtCard className="nws-event-entry__card">
            <ul className="nws-event-entry__phases">
              {phases.map((item) => (
                <li key={item.key}>
                  <NwtButton
                    nwtVariant="quiet"
                    nwtSize="medium"
                    onClick={() => onChoosePhase(item)}
                  >
                    {item.label}
                  </NwtButton>
                </li>
              ))}
            </ul>
          </NwtCard>

          <NwtButton
            className="nws-event-entry__back"
            nwtVariant="mute"
            nwtSize="medium"
            onClick={() => {
              // `chosen` solo no alcanza: este paso se pinta mientras haya evento sin
              // event_id, así que hay que soltar el evento del contexto.
              setChosen(false);
              clear();
            }}
          >
            Elegir otro evento
          </NwtButton>
        </div>
      </section>
    );
  }

  return (
    <section className="nws-event-entry">
      <div className="nws-event-entry__content">
        <div className="nws-event-entry__header">
          <span className="nwt-h4-font-bold">
            ¿En qué evento vas a trabajar?
          </span>

          <small className="nwt-text-font-regular">
            Los acreditados, los tipos y las acreditaciones son de un evento: al
            elegirlo, todo el módulo trabaja sobre ese.
          </small>
        </div>

        {/* Si ya había uno elegido, no se pierde por entrar acá a mirar. */}
        {!!event && !chosen && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            <span className="nws-event-entry__current">
              <span>
                Ahora estás en <b>{event.name}</b>
                {phase ? ` · ${phase.label}` : ''}.
              </span>

              <NwtButton
                nwtVariant="mute"
                nwtSize="small"
                onClick={() => navigate(target, { replace: true })}
              >
                Seguir en este evento
              </NwtButton>

              {/* Los otros momentos de la misma fase, a un clic: cambiar de momento es lo
                  más común en una fase dividida y por la lista costaba tres. */}
              {siblingMoments.map((sibling) => (
                <NwtButton
                  key={sibling.key}
                  nwtVariant="mute"
                  nwtSize="small"
                  disabled={resolving}
                  onClick={() => onChoosePhase(sibling)}
                >
                  Cambiar a {sibling.momentName}
                </NwtButton>
              ))}
            </span>
          </NwtAlert>
        )}

        {!!error && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            {getApiErrorMessage(
              error,
              'No pudimos resolver ese evento en el módulo de acreditación. Elige otro o inténtalo de nuevo.'
            )}
          </NwtAlert>
        )}

        {resolving && (
          <NwsLoading>
            <h4>Resolviendo el evento, por favor espere...</h4>
          </NwsLoading>
        )}

        {controller.state.is('failure') ? (
          <NwsRequestError
            error={controller.state.error}
            title="No pudimos cargar la lista de eventos"
            onRetry={controller.refresh}
          />
        ) : (
          <NwtCard className="nws-event-entry__card">
            <div className="nws-event-entry__filters">
              <NwtSearchbox
                formControl={search}
                placeholder="Buscar el evento por nombre"
              />

              <NwtPagination
                currentPage={controller.currentPage}
                totalPages={controller.totalPages}
                onChange={controller.goToPage}
                nwtSize="small"
              />
            </div>

            {events.length ? (
              <NwtDatatable
                header={
                  <NwtDatatableHeader>
                    <NwtDatatableTitle className="nwt-width-xs-60">
                      Evento
                    </NwtDatatableTitle>
                    <NwtDatatableTitle className="nwt-width-xs-25">
                      Inicio
                    </NwtDatatableTitle>
                    <NwtDatatableTitle
                      className="nwt-align-right"
                      actions={true}
                    />
                  </NwtDatatableHeader>
                }
              >
                {events.map((item) => {
                  const opened = expanded === item.code;
                  const detail = details[item.code];

                  return (
                    <Fragment key={item.code}>
                      <NwtDatatableRecord>
                        <NwtDatatableCell className="nwt-width-xs-60">
                          <button
                            type="button"
                            className="nws-event-entry__toggle"
                            aria-expanded={opened}
                            onClick={() => onToggle(item)}
                          >
                            <Chevron open={opened} />
                            <span className="nwt-text-font-medium">
                              {item.name}
                            </span>
                          </button>
                        </NwtDatatableCell>
                        <NwtDatatableCell className="nwt-width-xs-25">
                          <span>{formatCatalogDate(item.startDate)}</span>
                        </NwtDatatableCell>
                        <NwtDatatableCell actions className="nwt-align-right" />
                      </NwtDatatableRecord>

                      {opened && (
                        <NwtDatatableRecord className="nws-event-entry__phases-row">
                          {/* Sin clase de ancho del SDK: llevaba `nwt-width-xs-100`, que NO
                              existe —la escala llega a 97-5— así que no hacía nada. El ancho
                              lo pone el SCSS de la fila. */}
                          <NwtDatatableCell>
                            {detail?.loading && (
                              <span className="nwt-smalltext-font-regular">
                                Buscando las fases de este evento…
                              </span>
                            )}

                            {!!detail?.error && (
                              <span className="nws-event-entry__phases-error nwt-smalltext-font-regular">
                                {getApiErrorMessage(
                                  detail.error,
                                  'No pudimos leer las fases de este evento.'
                                )}
                              </span>
                            )}

                            {!!detail?.phases?.length && (
                              <ul className="nws-event-entry__phase-list">
                                {detail.phases.map((phaseItem) => (
                                  <li key={phaseItem.key}>
                                    <span className="nwt-text-font-medium">
                                      {phaseItem.label}
                                    </span>
                                    <span className="nwt-smalltext-font-regular">
                                      Inicia{' '}
                                      {formatCatalogDate(phaseItem.startDate)}
                                    </span>
                                    <NwtButton
                                      nwtVariant="quiet"
                                      nwtSize="small"
                                      disabled={resolving}
                                      onClick={() =>
                                        onEnter(item, phaseItem, detail.phases!)
                                      }
                                    >
                                      Entrar
                                    </NwtButton>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </NwtDatatableCell>
                        </NwtDatatableRecord>
                      )}
                    </Fragment>
                  );
                })}
              </NwtDatatable>
            ) : (
              <NwtEmptyState
                illustrationUrl={illustrationUrl}
                title={
                  controller.state.is('loading')
                    ? 'Buscando los eventos...'
                    : searching
                      ? 'Ningún evento coincide'
                      : 'No hay eventos con acreditación'
                }
                description={
                  controller.state.is('loading')
                    ? 'Un momento.'
                    : searching
                      ? 'Prueba con otra parte del nombre.'
                      : // El catálogo trae solo los eventos que el módulo registró: si está
                        // vacío no es un fallo nuestro, es que nadie configuró ninguno.
                        'Este catálogo solo lista los eventos con proceso de acreditación configurado.'
                }
              />
            )}
          </NwtCard>
        )}
      </div>
    </section>
  );
}
