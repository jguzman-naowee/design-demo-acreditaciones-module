import type {
  AccreditationAudit,
  AccreditedRecordDetail,
  ValidationLog
} from '@mf-accreditations/domain';
import {
  formatDateTimeInline,
  getStatusTransitionLabel
} from '@mf-accreditations/presentation';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import { NwtButton, NwtDropdown } from '@naowee-tech/sdk-react-components';
import { useFormControl } from '@rolster/react-forms';
import { useMemo, useState } from 'react';

// Las acciones que el backend audita, con el tono de su marca en la línea de tiempo. Se
// traducen las conocidas y cualquier valor nuevo pasa en crudo: esconder un movimiento que no
// entendemos sería peor que enseñar su código.
const AUDIT_LABELS: Record<string, string> = {
  CREATED: 'Generada',
  DELIVERED: 'Entregada',
  DELIVERY_REVERTED: 'Entrega revertida',
  DEACTIVATED: 'Inactivada',
  VALIDATED: 'Validada'
};

const AUDIT_TONES: Record<string, string> = {
  CREATED: 'informative',
  DELIVERED: 'positive',
  DELIVERY_REVERTED: 'caution',
  DEACTIVATED: 'negative',
  VALIDATED: 'positive'
};

// Cuántas entradas se pintan de una vez. Los movimientos de una acreditación son cuatro o
// cinco en toda su vida, pero las lecturas son una por puerta y por día: un evento de dos
// semanas deja decenas. Sin corte, la pestaña eran cinco pantallas de scroll.
const TANDA = 20;

// La clave de agrupación de las lecturas: el día local, no el UTC. Agrupar por la fecha ISO
// habría partido en dos las lecturas de una noche —Colombia va cinco horas por detrás—.
const diaDe = (fecha: Date) =>
  `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;

const actionLabel = (action: string) => AUDIT_LABELS[action] ?? action;

// Es lo único del movimiento que dice QUÉ cambió, y el backend ya lo manda. Vive en el helper
// desde que se descubrió que la auditoría pintaba lo mismo CRUDO: eran dos copias del mismo
// dato y solo esta estaba traducida.
const transition = (movement: AccreditationAudit): string | null =>
  getStatusTransitionLabel(movement.oldStatus, movement.newStatus);

// Lo que se pinta en la línea de tiempo: un movimiento de la acreditación, o el grupo de
// lecturas de un día.
type Entrada =
  | { clase: 'movimiento'; cuando: Date; movimiento: AccreditationAudit }
  | { clase: 'lecturas'; cuando: Date; lecturas: ValidationLog[] };

// Las lecturas de un día, en una entrada.
//
// Es la desviación deliberada del rediseño: la demo pinta una entrada por lectura, y con una
// credencial usada tres veces al día durante dos semanas eso son cuarenta «Escaneada con
// éxito» sepultando los cuatro movimientos que de verdad cambian algo. Agrupadas por día, la
// secuencia se sigue leyendo y el detalle sigue a un clic.
function agrupar(lecturas: ValidationLog[]): Entrada[] {
  const porDia = new Map<string, ValidationLog[]>();

  lecturas.forEach((lectura) => {
    const clave = diaDe(lectura.scannedAt);

    porDia.set(clave, [...(porDia.get(clave) ?? []), lectura]);
  });

  return [...porDia.values()].map((delDia) => ({
    clase: 'lecturas' as const,
    // La más reciente del día ordena el grupo entre los movimientos.
    cuando: delDia[0].scannedAt,
    lecturas: delDia
  }));
}

// El filtro. Sus opciones salen de lo que HAY en el historial y no de la lista completa de
// acciones: ofrecer «Entrega revertida» en una acreditación que nunca se revirtió deja al
// usuario eligiendo un filtro que siempre vacía la lista.
function filterOptions(
  history: AccreditationAudit[],
  hayLecturas: boolean
): NwtSelectOption<string>[] {
  const actions = [...new Set(history.map((movement) => movement.action))];

  return [
    { key: 'all', label: 'Acción', value: 'all' },
    ...actions.map((action) => ({
      key: action,
      label: actionLabel(action),
      value: action
    })),
    ...(hayLecturas
      ? [{ key: 'readings', label: 'Lecturas', value: 'readings' }]
      : [])
  ];
}

interface EventAccreditedHistoryProps {
  detail: AccreditedRecordDetail;
  history: AccreditationAudit[];
  // Las lecturas de la credencial con su total, o nada mientras se piden o si fallaron. El
  // total es del servidor: puede ser mayor que las cargadas, que topan en la página del
  // contrato.
  readings?: { logs: ValidationLog[]; total: number };
}

// El historial de una acreditación, como línea de tiempo.
//
// Era una tabla de cuatro columnas; el rediseño la cambió por una línea de tiempo, y tiene
// sentido: tres de esas columnas eran iguales en todas las filas —el tipo de acreditado no
// cambia entre movimientos— y lo que de verdad se lee es la secuencia.
//
// Lleva los movimientos de la acreditación Y las lecturas de su credencial, como el rediseño:
// es la única vista que cuenta la vida de UNA acreditación en orden. Las lecturas van agrupadas
// por día —ver `agrupar`— y la lista se corta de veinte en veinte.
//
// Se conserva el filtro de acción, que la demo quitó, por una razón medida: el historial NO
// viene paginado del servidor (su respuesta no trae `meta`) y cada validación en la puerta suma
// una entrada, así que una acreditación muy usada llega con decenas. Sin filtro no hay forma de
// aislar «solo las entregas».
//
// El nombre de quien hizo cada movimiento llega en `changed_by_name` desde el despliegue del
// 31 de agosto (y en `validator_user_name` para las lecturas). Solo viene en lo REGISTRADO
// después de esa fecha: el historial no se reescribe, así que los movimientos viejos se quedan
// sin autor para siempre y el gateway ni manda la clave. Por eso el nombre es opcional en la
// meta en vez de un «—»: una raya donde nunca va a haber nombre es ruido permanente.
//
// Se pinta del sobre, sin resolver nada: el plan B que había anotado —`GET /v1/user?codes=`
// repetido— es además imposible, medido el 2026-09-03 (devuelve UN usuario y se come el resto).
export function EventAccreditedHistory({
  detail,
  history,
  readings
}: EventAccreditedHistoryProps) {
  const actionFilter = useFormControl<string | undefined>('all');
  const [visibles, setVisibles] = useState(TANDA);
  const [abiertos, setAbiertos] = useState<string[]>([]);

  const lecturas = readings?.logs ?? [];

  const options = useMemo(
    () => filterOptions(history, !!lecturas.length),
    [history, lecturas.length]
  );

  // La línea de tiempo completa: movimientos y días de lecturas, lo más reciente primero.
  const entradas = useMemo<Entrada[]>(() => {
    const movimientos = history.map((movimiento) => ({
      clase: 'movimiento' as const,
      cuando: movimiento.changedAt,
      movimiento
    }));

    return [...movimientos, ...agrupar(lecturas)].sort(
      (uno, otro) => otro.cuando.getTime() - uno.cuando.getTime()
    );
  }, [history, lecturas]);

  const filtradas = useMemo(() => {
    const filtro = actionFilter.value ?? 'all';

    if (filtro === 'all') {
      return entradas;
    }

    if (filtro === 'readings') {
      return entradas.filter((entrada) => entrada.clase === 'lecturas');
    }

    return entradas.filter(
      (entrada) =>
        entrada.clase === 'movimiento' && entrada.movimiento.action === filtro
    );
  }, [entradas, actionFilter.value]);

  const mostradas = filtradas.slice(0, visibles);
  const faltan = filtradas.length - mostradas.length;

  // Lo cargado se topa en la página del contrato. Cuando el evento tiene más lecturas que
  // eso, se DICE: creer que la credencial se leyó cien veces cuando fueron cuatrocientas es
  // peor que ver el aviso.
  const recortado = !!readings && readings.total > lecturas.length;

  return (
    <div className="nws-accreditation-history">
      {/* El filtro solo aparece si hay más de una cosa que filtrar. */}
      {options.length > 2 && (
        <div className="nws-accreditation-history__filters">
          <NwtDropdown formControl={actionFilter} options={options} />
        </div>
      )}

      {mostradas.length ? (
        <>
          <ol className="nws-timeline">
            {mostradas.map((entrada) => {
              if (entrada.clase === 'movimiento') {
                const { movimiento } = entrada;
                const cambio = transition(movimiento);

                return (
                  <li
                    key={`m-${movimiento.action}-${movimiento.changedAt.getTime()}`}
                    className={`nws-timeline__item nws-timeline__item--${
                      AUDIT_TONES[movimiento.action] ?? 'neutral'
                    }`}
                  >
                    <span className="nws-timeline__mark" aria-hidden={true} />

                    <span className="nws-timeline__title nwt-text-font-medium">
                      {actionLabel(movimiento.action)}
                    </span>

                    <span className="nws-timeline__meta nwt-smalltext-font-regular">
                      {formatDateTimeInline(movimiento.changedAt)}
                      {movimiento.changedByName
                        ? ` · ${movimiento.changedByName}`
                        : ''}
                      {cambio ? ` · ${cambio}` : ''}
                    </span>

                    {!!movimiento.comments && (
                      <p className="nws-timeline__note nwt-smalltext-font-regular">
                        {movimiento.comments}
                      </p>
                    )}
                  </li>
                );
              }

              const clave = `l-${diaDe(entrada.cuando)}`;
              const abierto = abiertos.includes(clave);
              const cuantas = entrada.lecturas.length;
              // Los permisos que se leyeron ese día, sin repetir: es lo que dice de un vistazo
              // por dónde entró.
              const permisos = [
                ...new Set(entrada.lecturas.map((l) => l.permissionName))
              ];
              // Y quién las validó, cuando el backend trae el nombre. Sin repetir: en un día
              // con seis lecturas del mismo guardia, su nombre seis veces no dice más.
              const validadores = [
                ...new Set(
                  entrada.lecturas
                    .map((l) => l.validatorName)
                    .filter((nombre): nombre is string => !!nombre)
                )
              ];

              return (
                <li
                  key={clave}
                  // El modificador `--readings` distingue un grupo de lecturas de un
                  // movimiento: lo necesita el arnés para afirmar sobre unos sin tropezarse
                  // con los otros, y deja la puerta abierta a darles otro aspecto.
                  className="nws-timeline__item nws-timeline__item--positive nws-timeline__item--readings"
                >
                  <span className="nws-timeline__mark" aria-hidden={true} />

                  <button
                    type="button"
                    className="nws-timeline__toggle nwt-text-font-medium"
                    aria-expanded={abierto}
                    onClick={() =>
                      setAbiertos((actual) =>
                        actual.includes(clave)
                          ? actual.filter((uno) => uno !== clave)
                          : [...actual, clave]
                      )
                    }
                  >
                    {cuantas === 1 ? '1 lectura' : `${cuantas} lecturas`}
                    <span
                      className={`nwt-icon naotech-icon-chevron-${
                        abierto ? 'up' : 'down'
                      }`}
                      aria-hidden={true}
                    />
                  </button>

                  <span className="nws-timeline__meta nwt-smalltext-font-regular">
                    {formatDateTimeInline(entrada.cuando).split(' · ')[0]}
                    {validadores.length ? ` · ${validadores.join(', ')}` : ''}
                    {permisos.length ? ` · ${permisos.join(', ')}` : ''}
                  </span>

                  {/* Desplegado: cada lectura con su hora y su resultado. La denegada dice su
                      motivo, que es lo que se busca cuando alguien reclama en la puerta. */}
                  {abierto && (
                    <ul className="nws-timeline__readings">
                      {entrada.lecturas.map((lectura) => (
                        <li
                          key={lectura.id}
                          className="nwt-smalltext-font-regular"
                        >
                          <span
                            className={`nws-delivery-state nws-delivery-state--${
                              lectura.granted ? 'entregada' : 'pendiente'
                            }`}
                          >
                            {lectura.granted ? 'Concedido' : 'Denegado'}
                          </span>{' '}
                          {formatDateTimeInline(lectura.scannedAt).split(
                            ' · '
                          )[1] ?? ''}{' '}
                          · {lectura.permissionName}
                          {lectura.denialReason
                            ? ` · ${lectura.denialReason}`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>

          {/* El corte, con el total a la vista: sin el número, «Ver más» no dice si queda una
              entrada o cincuenta. */}
          {faltan > 0 && (
            <div className="nws-accreditation-history__more">
              <NwtButton
                nwtVariant="mute"
                nwtSize="medium"
                onClick={() => setVisibles((actual) => actual + TANDA)}
              >
                {`Ver más (${mostradas.length} de ${filtradas.length})`}
              </NwtButton>
            </div>
          )}

          {recortado && (
            <small className="nws-accreditation-history__capped nwt-smalltext-font-regular">
              {`Se muestran las últimas ${lecturas.length} lecturas de ${readings?.total}. El contrato no deja pedir más de una página por acreditación.`}
            </small>
          )}
        </>
      ) : (
        <span className="nwt-text-font-regular">
          {entradas.length
            ? 'Ninguna entrada coincide con el filtro.'
            : `Todavía no hay movimientos registrados de ${detail.fullName}. El historial se empezó a guardar el 12 de agosto, así que las acreditaciones anteriores a esa fecha no muestran ni su creación.`}
        </span>
      )}
    </div>
  );
}
