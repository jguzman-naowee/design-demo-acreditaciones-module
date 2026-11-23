import { SuiteEventRepository } from '@mf-accreditations/data';
import type { AccreditationPhase } from '@mf-accreditations/domain';
import { SuiteEvent } from '@mf-accreditations/domain';
import { invertly } from '@rolster/invertly';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

const repository = invertly(SuiteEventRepository);

// La selección se guarda con el nombre además del código —es lo que se muestra en
// la etiqueta del selector antes de que carguen las listas, y lo que nombra los
// avisos— y con la fase, porque el `event_id` del backend identifica al par
// evento+fase. El event_id NO se guarda: se resuelve leyendo, porque
// POST /accreditation/events duplicaría la fila (ver suite-event.repository.ts).
const ACTIVE_EVENT_KEY = 'naowee.acreditaciones.active-event';

interface StoredEvent {
  code: string;
  name: string;
  phaseCode?: string;
  phaseName?: string;
  // Con fase dividida en momentos, cuál: sin él se restauraría el primero.
  momentCode?: string | null;
}

function readStoredEvent(): StoredEvent | undefined {
  try {
    const stored = localStorage.getItem(ACTIVE_EVENT_KEY);

    return stored ? (JSON.parse(stored) as StoredEvent) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredEvent(event: SuiteEvent, phase?: AccreditationPhase): void {
  try {
    localStorage.setItem(
      ACTIVE_EVENT_KEY,
      JSON.stringify({
        code: event.code,
        name: event.name,
        phaseCode: phase?.code,
        phaseName: phase?.name,
        momentCode: phase?.momentCode ?? null
      })
    );
  } catch {
    // Sin localStorage solo se pierde la selección al recargar.
  }
}

function clearStoredEvent(): void {
  try {
    localStorage.removeItem(ACTIVE_EVENT_KEY);
  } catch {
    // Sin localStorage no hay nada que borrar.
  }
}

interface ActiveEventValue {
  // Suelta el evento elegido: «Elegir otro evento» desde el paso de la fase.
  clear: () => void;
  // Entrar con evento Y fase de una, cuando quien llama ya tiene las fases.
  enter: (
    event: SuiteEvent,
    phase: AccreditationPhase,
    phases: AccreditationPhase[]
  ) => void;
  // Falla al pedir las fases o al resolver el event_id; el selector la muestra.
  error?: unknown;
  event?: SuiteEvent;
  // El entero que exigen POST /roles y POST /accreditations: identifica el par
  // evento+fase, así que no existe hasta que hay fase elegida.
  eventId?: number;
  phase?: AccreditationPhase;
  // Las fases del evento con proceso de acreditación. Con una sola se elige
  // automáticamente; con varias hay que preguntar.
  phases: AccreditationPhase[];
  resolving: boolean;
  select: (event: SuiteEvent) => void;
  selectPhase: (phase: AccreditationPhase) => void;
}

const ActiveEventContext = createContext<ActiveEventValue>({
  clear: () => undefined,
  enter: () => undefined,
  phases: [],
  resolving: false,
  select: () => undefined,
  selectPhase: () => undefined
});

export function useActiveEvent(): ActiveEventValue {
  return useContext(ActiveEventContext);
}

export function ActiveEventProvider({ children }: PropsWithChildren) {
  const [event, setEvent] = useState<SuiteEvent>();
  const [phases, setPhases] = useState<AccreditationPhase[]>([]);
  const [phase, setPhase] = useState<AccreditationPhase>();
  const [eventId, setEventId] = useState<number>();
  const [error, setError] = useState<unknown>();
  // Arranca resolviendo si hay selección guardada: el efecto que la restaura corre DESPUÉS
  // del primer render, y en ese hueco la guarda de las pantallas creería que no hay evento
  // y las rebotaría a la pantalla de entrada teniendo uno.
  const [resolving, setResolving] = useState(() => !!readStoredEvent());

  const resolve = useCallback(
    (selected: SuiteEvent, selectedPhase: AccreditationPhase) => {
      setPhase(selectedPhase);
      setEventId(undefined);
      setError(undefined);
      setResolving(true);

      writeStoredEvent(selected, selectedPhase);

      repository
        .resolveEventId(selected, selectedPhase)
        .then(setEventId)
        .catch(setError)
        .finally(() => setResolving(false));
    },
    []
  );

  // Al elegir evento se piden sus fases acreditables. Una sola se resuelve sola;
  // con varias se espera a que el usuario elija, porque el event_id sería
  // distinto según la fase y adivinar es corromper datos.
  const start = useCallback(
    (
      selected: SuiteEvent,
      storedPhaseCode?: string,
      storedMomentCode?: string | null
    ) => {
      setEvent(selected);
      setPhases([]);
      setPhase(undefined);
      setEventId(undefined);
      setError(undefined);
      setResolving(true);

      writeStoredEvent(selected);

      repository
        .requestPhases(selected)
        .then((available) => {
          setPhases(available);

          // Fase y momento: una fase dividida sale una vez por momento, así que el código de
          // la fase solo ya no identifica a la opción elegida.
          const restored = storedPhaseCode
            ? available.find(
                (item) =>
                  item.code === storedPhaseCode &&
                  item.momentCode === (storedMomentCode ?? null)
              )
            : undefined;
          const only = available.length === 1 ? available[0] : undefined;
          const chosen = restored ?? only;

          if (chosen) {
            resolve(selected, chosen);

            return;
          }

          setResolving(false);
        })
        .catch((cause: unknown) => {
          setError(cause);
          setResolving(false);
        });
    },
    [resolve]
  );

  const select = useCallback(
    (selected: SuiteEvent) => start(selected),
    [start]
  );

  // Entrar con la fase ya elegida, desde la lista que la desplegó.
  //
  // No pasa por `start`: esa pide las fases al detalle del evento, y quien llama acá
  // acaba de pedirlas para pintarlas. Sin esto, entrar costaría dos veces el mismo
  // GET /v1/event/{code}.
  const enter = useCallback(
    (
      selected: SuiteEvent,
      selectedPhase: AccreditationPhase,
      available: AccreditationPhase[]
    ) => {
      setEvent(selected);
      setPhases(available);
      resolve(selected, selectedPhase);
    },
    [resolve]
  );

  const clear = useCallback(() => {
    setEvent(undefined);
    setPhases([]);
    setPhase(undefined);
    setEventId(undefined);
    setError(undefined);
    setResolving(false);
    clearStoredEvent();
  }, []);

  const selectPhase = useCallback(
    (selectedPhase: AccreditationPhase) => {
      if (event) {
        resolve(event, selectedPhase);
      }
    },
    [event, resolve]
  );

  // Se restaura la última selección sin esperar las listas: con el code, el
  // nombre y la fase guardados alcanza para resolver y para pintar la etiqueta,
  // así que la pantalla no parpadea esperando /v2/events.
  useEffect(() => {
    const stored = readStoredEvent();

    if (stored) {
      start(
        new SuiteEvent(stored.code, stored.name, null),
        stored.phaseCode,
        stored.momentCode
      );
    }
  }, [start]);

  return (
    <ActiveEventContext
      value={{
        clear,
        enter,
        error,
        event,
        eventId,
        phase,
        phases,
        resolving,
        select,
        selectPhase
      }}
    >
      {children}
    </ActiveEventContext>
  );
}
