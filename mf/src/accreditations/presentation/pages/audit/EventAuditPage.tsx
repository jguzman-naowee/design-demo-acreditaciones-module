import './EventAuditPage.scss';

import {
  AccreditedRecordRepository,
  ValidationLogRepository
} from '@mf-accreditations/data';
import type {
  AccreditationAudit,
  ValidationLog
} from '@mf-accreditations/domain';
import {
  DATE_PERIOD_OPTIONS,
  downloadCsv,
  formatCodeLabel,
  formatDateTimeInline,
  getStatusTransitionLabel,
  isWithinPeriod,
  normalizeText,
  NwsDateTimeCell,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsReportLink,
  NwsRequestError,
  useCatalogPage,
  useSearchTerm
} from '@mf-accreditations/presentation';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtBadge,
  NwtCard,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useCallback, useEffect, useMemo, useState } from 'react';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import { type AuditColumn, AuditReportModal } from './AuditReportModal';

const logRepository = invertly(ValidationLogRepository);
const recordRepository = invertly(AccreditedRecordRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

const SIN_DATO = '—';

// Las tres fuentes que la pantalla declara. Dos no tienen dato y se explican en vez de
// esconderse: ver el aviso de `SIN_FUENTE`.
type AuditSource = 'all' | 'reading' | 'operation' | 'configuration';

const SOURCE_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Fuente', value: 'all' },
  { key: 'reading', label: 'Lecturas', value: 'reading' },
  { key: 'operation', label: 'Operaciones', value: 'operation' },
  { key: 'configuration', label: 'Configuración', value: 'configuration' }
];

// Por qué las otras dos fuentes vienen vacías. Se dice en la pantalla y no en un comentario del
// código: el hueco tiene que verse para que se pida, y quien lo mire tiene que entender que no
// es un fallo suyo.
//
// Queda UNA sola: Operaciones dejó de estar vacía el 2026-09-15, cuando backend expuso la
// auditoría transversal que estaba pedida acá (`/accreditations/audit`).
//
// TODO(api): Configuración sigue abierta. No existe NADA: nadie registra los cambios de
// parametrización.
const SIN_FUENTE: Record<string, string> = {
  configuration:
    'Los cambios de parametrización —permisos, tipos de acreditado, vigencias y topes— todavía no se registran en ninguna parte. Está solicitado a backend.'
};

// Cómo se lee cada movimiento. El contrato manda el verbo en inglés y en mayúsculas, que no es
// lo que se pone en una pantalla.
//
// Un valor que no esté acá se pinta humanizado en vez de esconderse: si backend estrena una
// acción, es mejor un «Something new» raro que una fila sin decir qué pasó.
const AUDIT_ACTIONS: Record<string, string> = {
  CREATED: 'Acreditación creada',
  DELIVERED: 'Carnet entregado',
  DELIVERY_REVERTED: 'Entrega revertida',
  DEACTIVATED: 'Acreditación inactivada',
  VALIDATED: 'Acceso validado'
};

const COLUMNS: AuditColumn[] = [
  { key: 'at', label: 'Fecha y hora' },
  { key: 'source', label: 'Fuente' },
  { key: 'action', label: 'Acción' },
  { key: 'detail', label: 'Detalle' },
  // Los rótulos son los MISMOS que la tabla: el modal elige columnas de esta tabla, y
  // llamarla «Persona o entidad» acá y «Persona» en pantalla obliga a adivinar si son la
  // misma. Cuando la auditoría de configuración traiga entidades, cambian las dos juntas.
  { key: 'subject', label: 'Persona' },
  { key: 'author', label: 'Autor' }
];

// Un movimiento de la auditoría, sea de la fuente que sea. La pantalla trabaja siempre sobre
// esta forma para que sumar las otras dos fuentes sea añadir de dónde salen, no rehacer la
// tabla.
interface AuditEntry {
  id: string;
  at: Date;
  source: Exclude<AuditSource, 'all'>;
  sourceLabel: string;
  action: string;
  detail: string;
  subject: string;
  author: string;
}

// Toda la auditoría del evento: operaciones, lecturas y cambios de configuración.
//
// Hoy solo hay lecturas. De las tres fuentes que el rediseño promete, es la única con dato real
// —y es completo: `GET /validation-logs?event_id=` pagina en servidor y registra también las
// DENEGADAS, con su motivo—. Las otras dos se declaran y dicen qué les falta.
//
// El rediseño mandó las lecturas a una pantalla aparte en su segunda ronda y dejó acá solo
// operaciones y configuración. Acá se quedan, y es una desviación deliberada: esas dos fuentes
// no tienen backend, así que la pantalla nacería vacía, y el grupo de Validación salió del menú
// —así que las lecturas no tendrían dónde verse—. El subtítulo del propio rediseño las sigue
// prometiendo.
//
// Dos peticiones por carga, y ninguna por fila: las lecturas y —una sola vez— el listado de
// acreditaciones, que es de donde sale el nombre de la persona. El resto de los filtros corre
// en cliente sobre lo cargado, como en el rediseño.
export function EventAuditPage() {
  return <NwsEventGuard>{(scope) => <EventAudit {...scope} />}</NwsEventGuard>;
}

function EventAudit({ event, eventId, phase }: NwsEventScope) {
  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);
  const sourceFilter = useFormControl<string | undefined>('all');
  const dateFilter = useFormControl<string | undefined>('all');
  const authorFilter = useFormControl<string | undefined>('all');

  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [operaciones, setOperaciones] = useState<AccreditationAudit[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [reload, setReload] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setError(undefined);

    // Las tres a la vez y no una tras otra: no dependen entre sí, y en serie la pantalla
    // tardaría el triple por nada.
    Promise.all([
      logRepository.requestAllForEvent(eventId),
      // El nombre de la persona: la lectura solo trae el `accreditation_code`. Es UNA lectura
      // del listado del evento, no una por fila.
      recordRepository.requestForReport({ event_id: eventId }),
      // Las OPERACIONES. Con su propio catch: que la auditoría falle no puede llevarse por
      // delante a las lecturas, que es la fuente que ya funcionaba.
      //
      // Sin fase no se pide: los dos códigos son obligatorios y mandar uno solo es un 400
      // seguro. Es el caso del evento sin fase configurada, y entonces la fuente se queda
      // vacía en vez de romper la pantalla entera.
      phase?.code
        ? recordRepository
            .requestEventAudit({
              event_code: event.code,
              phase_code: phase.code,
              ...(phase.momentCode ? { moment_code: phase.momentCode } : {})
            })
            .catch(() => [] as AccreditationAudit[])
        : Promise.resolve([] as AccreditationAudit[])
    ])
      .then(([lecturas, acreditaciones, movimientos]) => {
        if (!alive) {
          return;
        }

        setLogs(lecturas);
        setOperaciones(movimientos);
        setNames(
          Object.fromEntries(
            acreditaciones.map((record) => [String(record.id), record.fullName])
          )
        );
        setLoading(false);
      })
      .catch((reason) => {
        if (alive) {
          setError(reason);
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [event.code, eventId, phase?.code, phase?.momentCode, reload]);

  const entries = useMemo<AuditEntry[]>(
    () =>
      [
        ...logs.map((log) => ({
          id: `reading-${log.id}`,
          at: log.scannedAt,
          source: 'reading' as const,
          sourceLabel: 'Lectura',
          action: log.granted ? 'Acceso concedido' : 'Acceso denegado',
          detail: log.detail,
          subject: names[log.accreditationCode] ?? '',
          // El nombre del validador, que llega en `validator_user_name` desde el despliegue del
          // 31 de agosto. Las lecturas anteriores no lo traen y se quedan con su raya: no es un
          // hueco que se vaya a llenar, el backend no reescribe lo ya registrado.
          author: log.validatorName ?? ''
        })),
        ...operaciones.map((movimiento, indice) => ({
          // El contrato no manda id del movimiento, así que se compone uno estable con lo que
          // identifica la fila. El índice va de desempate: la misma persona puede tener dos
          // movimientos del mismo tipo en el mismo segundo —entregar y revertir seguido— y dos
          // filas con la misma clave se pisan en React.
          id: `operation-${movimiento.accreditationCode ?? 'sin-code'}-${movimiento.action}-${movimiento.changedAt.getTime()}-${indice}`,
          at: movimiento.changedAt,
          source: 'operation' as const,
          sourceLabel: 'Operación',
          action: AUDIT_ACTIONS[movimiento.action] ?? formatCodeLabel(movimiento.action),
          // El comentario que escribió quien lo hizo —el motivo de una inactivación, por
          // ejemplo—. Sin él, el cambio de estado, que es lo que de verdad pasó.
          detail:
            movimiento.comments?.trim() ||
            // Traducido y no crudo: acá salía «ACTIVE → DELETED», que es el código del backend
            // y no un estado que nadie pueda leer. Lo reportó Andrés. Mismo helper que el
            // historial del detalle, que ya lo hacía bien.
            getStatusTransitionLabel(
              movimiento.oldStatus,
              movimiento.newStatus
            ) ||
            '',
          subject: movimiento.fullName ?? '',
          // El nombre cuando está; si no, el código, que al menos identifica a quién fue.
          // Medido contra staging: 2 de cada 20 movimientos llegan sin nombre, y son los
          // anteriores al 3 de septiembre —el backend no reescribe lo ya registrado—.
          author: movimiento.changedByName ?? movimiento.changedByCode ?? ''
        }))
      ].sort((a, b) => b.at.getTime() - a.at.getTime()),
    [logs, names, operaciones]
  );

  // Los contadores van sobre TODO lo cargado y no sobre lo filtrado: son el retrato del evento,
  // y si cambiaran con cada filtro no se podría comparar nada.
  const counters = useMemo(
    () => ({
      total: entries.length,
      // Las operaciones van aparte desde que la fuente tiene dato: sin este contador,
      // «Movimientos» dejaba de cuadrar con concedidos + denegados —que son solo de
      // lecturas— y no había forma de saber por qué.
      operations: operaciones.length,
      granted: logs.filter((log) => log.granted).length,
      denied: logs.filter((log) => !log.granted).length
    }),
    [entries, logs, operaciones]
  );

  const source = (sourceFilter.value ?? 'all') as AuditSource;

  // Los autores que de verdad aparecen, ordenados. Si ninguna fila trae nombre —lecturas
  // anteriores al despliegue del 31 de agosto— la lista se queda en la opción de cabecera y el
  // desplegable no se pinta.
  const authorOptions = useMemo<NwtSelectOption<string>[]>(() => {
    const nombres = [
      ...new Set(entries.map((entry) => entry.author).filter(Boolean))
    ].sort((uno, otro) => uno.localeCompare(otro, 'es'));

    return [
      { key: 'all', label: 'Autor', value: 'all' },
      ...nombres.map((nombre) => ({
        key: nombre,
        label: nombre,
        value: nombre
      }))
    ];
  }, [entries]);

  const author = authorFilter.value ?? 'all';

  const filtered = useMemo(() => {
    const texto = normalizeText(query);

    return entries
      .filter((entry) => source === 'all' || entry.source === source)
      .filter((entry) => isWithinPeriod(entry.at, dateFilter.value))
      .filter((entry) => author === 'all' || entry.author === author)
      .filter(
        (entry) =>
          !texto ||
          [entry.subject, entry.action, entry.detail].some((campo) =>
            normalizeText(campo).includes(texto)
          )
      );
  }, [entries, source, dateFilter.value, author, query]);

  const { page, pageItems, setPage, totalPages } = useCatalogPage(filtered);

  const filtering =
    !!query ||
    source !== 'all' ||
    author !== 'all' ||
    (dateFilter.value ?? 'all') !== 'all';

  useEffect(() => {
    setPage(1);
  }, [query, source, author, dateFilter.value, setPage]);

  const onDownload = useCallback(
    (keys: string[]) => {
      setReportVisible(false);

      const columnas = COLUMNS.filter((column) => keys.includes(column.key));

      downloadCsv(
        'auditoria-del-evento.csv',
        columnas.map((column) => column.label),
        // Lo FILTRADO, no todo: quien filtró ya dijo qué le interesa.
        filtered.map((entry) =>
          columnas.map((column) =>
            column.key === 'at'
              ? formatDateTimeInline(entry.at)
              : column.key === 'source'
                ? entry.sourceLabel
                : (entry[column.key as keyof AuditEntry] as string) || SIN_DATO
          )
        )
      );
    },
    [filtered]
  );

  function renderCatalog() {
    if (loading) {
      return (
        <NwsLoading>
          <h4>Cargando la auditoría, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (error) {
      return (
        <NwsRequestError
          error={error}
          title="No pudimos cargar la auditoría"
          onRetry={() => setReload((actual) => actual + 1)}
        />
      );
    }

    return (
      <NwtCard className="nws-audit__card">
        <div className="nws-audit__filters">
          <div className="nws-audit__search">
            <NwtSearchbox
              formControl={search}
              placeholder="Buscar por persona, acción o detalle"
            />

            <NwtDropdown formControl={sourceFilter} options={SOURCE_OPTIONS} />

            {/* El desplegable de «Autor» solo aparece si hay nombres que ofrecer. Estuvo fuera
                mientras el contrato solo traía el `validator_user_code`: un filtro de uuids es
                el mismo defecto que QA reportó con el código del rol. Ahora llega el nombre,
                pero solo en lo registrado después del 31 de agosto, así que en un evento con
                lecturas viejas la lista sale vacía y el filtro sigue sin pintarse. */}
            {authorOptions.length > 1 && (
              <NwtDropdown
                formControl={authorFilter}
                options={authorOptions}
              />
            )}

            <NwtDropdown formControl={dateFilter} options={DATE_PERIOD_OPTIONS} />
          </div>

          <NwtPagination
            currentPage={page}
            totalPages={totalPages}
            onChange={setPage}
            nwtSize="small"
          />
        </div>

        {pageItems.length ? (
          <NwtDatatable
            header={
              <NwtDatatableHeader>
                <NwtDatatableTitle className="nwt-width-xs-15">
                  Fecha y hora
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Fuente
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-20">
                  Acción
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-25">
                  Detalle
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-15">
                  Persona
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Autor
                </NwtDatatableTitle>
              </NwtDatatableHeader>
            }
          >
            {pageItems.map((entry) => (
              <NwtDatatableRecord key={entry.id}>
                <NwtDatatableCell className="nwt-width-xs-15">
                  <NwsDateTimeCell date={entry.at} />
                </NwtDatatableCell>

                <NwtDatatableCell className="nwt-width-xs-12-5">
                  <NwtBadge
                    nwtVariant="quiet"
                    nwtTheme={
                      entry.source === 'configuration' ? 'caution' : 'neutral'
                    }
                  >
                    {entry.sourceLabel}
                  </NwtBadge>
                </NwtDatatableCell>

                <NwtDatatableCell className="nwt-width-xs-20">
                  <span className="nwt-text-font-medium">{entry.action}</span>
                </NwtDatatableCell>

                <NwtDatatableCell className="nwt-width-xs-25">
                  <span>{entry.detail || SIN_DATO}</span>
                </NwtDatatableCell>

                <NwtDatatableCell className="nwt-width-xs-15">
                  <span>{entry.subject || SIN_DATO}</span>
                </NwtDatatableCell>

                <NwtDatatableCell className="nwt-width-xs-12-5">
                  <span>{entry.author || SIN_DATO}</span>
                </NwtDatatableCell>
              </NwtDatatableRecord>
            ))}
          </NwtDatatable>
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            /* Una fuente sin dato tiene su propio vacío. Decir «ningún movimiento coincide con
               los filtros» ahí sería falso —no hay NADA con lo que coincidir— y además el aviso
               de arriba se puede cerrar con su X, así que esta frase se queda sola. */
            title={
              SIN_FUENTE[source]
                ? 'Esta fuente todavía no registra nada'
                : filtering
                  ? 'Sin resultados'
                  : 'Todavía no hay movimientos'
            }
            description={
              SIN_FUENTE[source]
                ? SIN_FUENTE[source]
                : filtering
                  ? 'Ningún movimiento coincide con los filtros.'
                  : 'Acá se acumula todo lo que pasa en el evento: las lecturas de acceso, y —cuando el backend las exponga— las operaciones y los cambios de configuración.'
            }
            showAction={false}
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-audit">
      {/* La franja del contexto y los contadores: el evento a la izquierda, el retrato del
          evento a la derecha. Va FUERA del contenido, a todo el ancho. */}
      <NwsEventBar
        items={[
          { icon: 'copy', content: 'Movimientos', badge: counters.total },
          { icon: 'edit', content: 'Operaciones', badge: counters.operations },
          { icon: 'positive', content: 'Concedidos', badge: counters.granted },
          { icon: 'caution', content: 'Denegados', badge: counters.denied }
        ]}
      />

      <div className="nws-audit__content">
        <div className="nws-audit__header">
          <div className="nws-audit__description">
            <span className="nwt-h5-font-bold">Auditoría del evento</span>

            <small className="nwt-smalltext-font-regular">
              Todo lo que pasó: operaciones, lecturas y cambios de configuración
            </small>
          </div>

          {/* La única acción de la pantalla: es de solo lectura, sin selección ni acciones de
              fila. Y no baja el fichero de golpe — pregunta qué columnas lleva. */}
          <div className="nws-audit__actions">
            <NwsReportLink
              disabled={!filtered.length}
              onClick={() => setReportVisible(true)}
            />
          </div>
        </div>

        {renderCatalog()}
      </div>

      <AuditReportModal
        columns={COLUMNS}
        total={filtered.length}
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onDownload={onDownload}
      />
    </section>
  );
}
