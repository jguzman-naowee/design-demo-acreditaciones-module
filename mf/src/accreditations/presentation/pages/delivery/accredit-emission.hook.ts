import {
  AccreditedRecordRepository,
  CardBatchMemberRepository,
  CardBatchRepository
} from '@mf-accreditations/data';
import type {
  AccreditationPerson,
  CardBatch,
  ReadyParticipant
} from '@mf-accreditations/domain';
import { getApiErrorMessage } from '@mf-accreditations/presentation';
import { NwtContext } from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useCallback, useContext, useState } from 'react';


/**
 * Lo que la pantalla le pide acreditar al hook.
 *
 * Vivía en el modal «Nuevo acreditado» de «Acreditados del evento». Esa pantalla se retiró
 * con la unificación —acreditar se hace desde «Gestión de acreditables», sobre la misma lista
 * y sin modal— y el tipo se mudó acá, que es donde está su único consumidor.
 */
export interface AccreditPersonForm {
  // Una de las dos: la persona ya registrada, o los candidatos a los que hay que
  // registrar antes de acreditar. Los candidatos vienen en lista porque se acredita de a
  // uno o en bloque con el mismo gesto.
  candidates?: ReadyParticipant[];
  person?: AccreditationPerson;
  // Con un solo sujeto se elige el tipo; en bloque, cada uno va con SU rol y esto
  // queda vacío.
  roleCode?: string;
  // El tipo del evento que le toca a CADA candidato, por su id. Lo resuelve la pantalla
  // —que es la que tiene los tipos cargados— y no el hook de emisión, que no los tiene.
  //
  // Sin esto el ítem viajaba con `candidate.roleCode`, que es el rol de PLATAFORMA
  // (SUPPORT_PERSONNEL) y no el `role_code` del tipo: un docente entrenador y un docente
  // asistente llegaban indistinguibles y se acreditaban con el mismo tipo genérico.
  roleByCandidate?: Record<string, string>;
  validFrom?: Date;
  validTo?: Date;
}

const repository = invertly(AccreditedRecordRepository);
// Las dos listas que un lote nuevo deja desactualizadas. Ver por qué se invalidan más abajo.
const batchRepository = invertly(CardBatchRepository);
const memberRepository = invertly(CardBatchMemberRepository);

// El tope del endpoint masivo, según backend: más de 500 ítems responde 422 TOO_MANY_ITEMS
// con el número que llegó. No lo declara el contrato del gateway —solo consta en el mensaje
// de Javi—, así que si algún día cambia, el 422 lo va a decir.
const BULK_MAX_ITEMS = 500;

// El backend guarda la vigencia como LocalDateTime naive en hora del evento: con `Z`
// responde 400. El calendario da un día, así que «desde» empieza a medianoche y
// «hasta» cierra al final del día.
function toNaiveDate(date: Date, endOfDay = false): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    (endOfDay ? 'T23:59:59' : 'T00:00:00')
  );
}

/**
 * Con qué `role_code` se acredita a un candidato, de lo más fiable a lo menos.
 *
 * 1. **El elegido a mano**, cuando hay un solo sujeto y el modal ofreció el desplegable.
 * 2. **El tipo del evento que le corresponde**, que la pantalla resolvió con
 *    `resolveAccreditedTypeCode` —por función, por categoría o por código—.
 * 3. **La FUNCIÓN tal cual llega en la fila.** Backend lo midió en staging el 2026-09-09:
 *    mandando `role_code: "ENT"` el propio ms resuelve el tipo DOCENTE_ENTRENADOR. O sea que
 *    no hace falta traducir nada cuando la pantalla todavía no tiene los tipos cargados.
 * 4. **El rol de plataforma**, el camino viejo. Funciona por coincidencia de nombres —el tipo
 *    «Deportista» suele tener `role_code: ATHLETE`— y es lo único que sostiene a los eventos
 *    cuyos tipos nunca recibieron `platform_role`: medidos el 2026-09-09, 7 de los 15 que hay.
 *
 * Para el personal de MISIÓN los pasos 3 y 4 son el mismo: su `roleCode` ya es la función
 * (JMI, FIS…), porque MISSION_STAFF es la categoría y no un rol.
 */
function roleCodeDe(
  candidate: ReadyParticipant,
  form: AccreditPersonForm
): string {
  return (
    form.roleCode ??
    form.roleByCandidate?.[String(candidate.id)] ??
    candidate.supportRoleCodes[0] ??
    candidate.roleCode
  );
}

interface UseAccreditEmissionOptions {
  eventId: number;
  // Qué hacer cuando al menos una acreditación salió: cerrar el modal, recargar la
  // tabla… Cada pantalla lo suyo.
  onEmitted: () => void;
  // El lote de carnets que quedó encolado, o el motivo de que no lo haya.
  //
  // Va como aviso a la pantalla y no como estado del hook porque seguir el lote es cosa de
  // quien lo pinta: el hook termina cuando termina la petición, y el PDF tarda.
  //
  // `batch` en null NO significa que fallara nada: puede que no se acreditara a nadie, o que
  // nadie tenga foto aprobada —y en ese caso las acreditaciones SÍ quedaron creadas—. Por eso
  // llega también el motivo, para explicarlo sin llamarlo error.
  //
  // Va también CUÁNTOS se acreditaron, porque es lo único que distingue los dos casos en que no
  // hay lote: «no se acreditó a nadie, por eso no hay carnet» y «se acreditó a todos pero
  // ninguno tiene foto». Sin ese número la pantalla tendría que adivinar cuál de los dos es.
  onCardBatch?: (
    batch: CardBatch | null,
    skippedReason: string | null,
    acreditados: number
  ) => void;
}

// El camino de emisión, uno solo para todas las pantallas que acreditan.
//
// Vivía dentro de «Acreditados del evento» y ahora también lo usa la lista de acreditables. Se
// extrae en vez de copiarse: es el sitio donde se decide con qué identidad y con qué rol viaja
// cada persona, y tener DOS copias de esa decisión sería tener que arreglarla dos veces.
export function useAccreditEmission({
  eventId,
  onEmitted,
  onCardBatch
}: UseAccreditEmissionOptions) {
  const { toast } = useContext(NwtContext);
  const [working, setWorking] = useState(false);

  const emit = useCallback(
    async (form: AccreditPersonForm) => {
      setWorking(true);

      const dates = {
        ...(form.validFrom ? { valid_from: toNaiveDate(form.validFrom) } : {}),
        ...(form.validTo ? { valid_to: toNaiveDate(form.validTo, true) } : {})
      };

      try {
        // Una persona ya registrada: el camino del mostrador. Siempre es de la plataforma
        // —se la encontró por documento en el módulo, o sea que tiene cuenta—.
        if (form.person && form.roleCode) {
          const record = await repository.create(
            {
              event_id: eventId,
              role_code: form.roleCode,
              user_code: form.person.userCode,
              ...dates
            },
            form.person
          );

          onEmitted();

          return toast({
            title: 'Acreditación emitida',
            message: `${record.fullName} quedó acreditado como ${record.roleName}. Ya puedes generar su acreditación.`,
            icon: 'positive',
            theme: 'positive'
          });
        }

        const candidates = form.candidates ?? [];

        if (!candidates.length) {
          return;
        }

        // ── Una sola llamada, atómica ────────────────────────────────────────
        // Antes esto era un bucle con un POST por persona, y de los malos: no era atómico
        // —si fallaba el 7 de 20, los 6 primeros ya estaban creados y no hay DELETE—, eran
        // 2N peticiones porque cada uno buscaba o creaba su persona antes, y el backend
        // nunca veía la operación completa, así que no podía validar el conjunto.
        //
        // El endpoint masivo se lo lleva todo: resuelve la persona contra user-auth, es
        // atómico y es idempotente (reenviar la misma lista no duplica; quien ya esté
        // acreditado sale por `skipped`, que es lo que salva el doble clic).
        //
        // Solo viaja el `user_code`: nombre y documento los toma el backend del padrón, que
        // es la fuente de verdad —son los que se imprimen en el carnet, no pueden venir del
        // cliente—.

        // El tope del endpoint es de 500 por llamada; más da 422. NO se parte el lote: eso
        // devolvería el «lote a medias» que este endpoint viene justo a eliminar. Hoy es
        // inalcanzable —ninguna de las dos pantallas deja seleccionar fuera de su página de
        // 10—, así que basta con avisar si algún día alguien sube ese tope.
        if (candidates.length > BULK_MAX_ITEMS) {
          setWorking(false);

          return toast({
            title: 'Son demasiados de una vez',
            message: `El máximo por emisión es de ${BULK_MAX_ITEMS} y seleccionaste ${candidates.length}. Hazlo en varias tandas.`,
            icon: 'caution',
            theme: 'negative'
          });
        }

        // `emit-with-card` y no `bulkCreate`: acredita Y encola el carnet en la misma
        // llamada (SUV2-2382). Encadenarlo desde acá habría significado contar los `skipped`
        // antes de pedir el lote y, peor, un segundo POST que crea otro lote sin DELETE: un
        // doble clic dejaba lotes colgados para siempre.
        //
        // Responde 202: lo de acreditar termina acá —y los dos avisos de abajo son los de
        // siempre, porque el bloque `accreditation` es el mismo de la emisión masiva—, pero el
        // PDF se encola y lo sigue la pantalla.
        const { accreditation: result, cardBatch, cardBatchSkippedReason } =
          await repository.emitWithCard({
          event_id: eventId,
          items: candidates.map((candidate) => ({
            // EXACTAMENTE UNA identidad por ítem: el personal de misión no tiene cuenta en la
            // plataforma y va por `mission_staff_code`. Mandar las dos —o ninguna— no es un
            // descarte: es un 400 que rechaza el lote entero diciendo qué fila está mal.
            //
            // El `id` de la fila ES ese código, y cuál de los dos es lo dice `identityType`
            // (ver ready-participant.ts).
            ...(candidate.isMissionStaff
              ? { mission_staff_code: String(candidate.id) }
              : { user_code: String(candidate.id) }),
            // Cada uno con SU rol: mezclarlos en un solo tipo sería acreditar mal a alguien.
            role_code: roleCodeDe(candidate, form)
          })),
          ...dates
        });

        // Acreditar cambia DOS listas que viven en otras pantallas del menú, y sus
        // repositorios cachean: «Lista de acreditados» —que sale de los integrantes de los
        // lotes— y «Lotes de acreditaciones», donde acaba de aparecer uno nuevo.
        //
        // Sin esto, acreditar a tres y entrar a la lista enseñaba la de antes: el backend ya
        // los tenía —medido, `card-batches/members` devolvía las once filas— y la pantalla
        // servía las ocho cacheadas. Lo reportó Andrés.
        //
        // `invalidate()` tira la lista SIN volver a pedirla: quien acredita no suele estar
        // mirando esas pantallas, así que se piden solas la próxima vez que se abran, y si
        // nadie las abre no se gasta nada. Es lo mismo que ya hace inactivar con los lotes.
        if (cardBatch) {
          batchRepository.invalidate();
          memberRepository.invalidate();
        }

        // Antes que los avisos: la pantalla tiene que poder empezar a seguir el lote aunque
        // los toasts tarden en leerse.
        onCardBatch?.(
          cardBatch,
          cardBatchSkippedReason,
          result.total_processed
        );

        // `full_name` viene del padrón, así que es el nombre bueno y no el que la pantalla
        // tenía en memoria.
        const done = result.processed.map((item) => item.full_name);

        // `skipped` se identifica por `user_code` —no se creó ninguna acreditación, así que
        // no hay código— y ahí viaja la identidad CON LA QUE SE MANDÓ el ítem, sea de
        // plataforma o de misión. El motivo viene en español listo para mostrar, y los del
        // personal de misión tienen los suyos («No se encontró personal de misión con ese
        // código en el evento y la fase»). El nombre se resuelve contra los candidatos que la
        // pantalla ya tiene; si no casa, se enseña el código antes que dejar la frase coja.
        const porUserCode = new Map(
          candidates.map((candidate) => [String(candidate.id), candidate.fullName])
        );

        const failed = result.skipped.map((item) => ({
          name: porUserCode.get(item.user_code) ?? item.user_code,
          reason: item.reason
        }));

        // ── UN SOLO AVISO, y esto NO es cosmética ──────────────────────────
        //
        // El toast del SDK tiene UNA ranura y su `visible` CONMUTA:
        //
        //     setState((state) => ({ ...state, config, visible: !state.visible }))
        //
        // Dos llamadas en el mismo tick las agrupa React, `visible` conmuta dos veces y
        // vuelve a `false`, así que el efecto no se reejecuta y **no se ve ninguno de los
        // dos**. Medido sobre la pantalla real: con éxitos Y saltados solo se renderizaba uno
        // y nunca llegaba a tener la clase `--visible`; por el camino individual, que dispara
        // uno solo, sí sale.
        //
        // O sea que los dos avisos que había —éxito y saltados— ya se comían entre sí cuando
        // el lote traía de los dos. Se juntan en uno, que además se lee mejor: es UN gesto y
        // su resultado, no dos noticias.
        const partes = [];

        if (done.length) {
          partes.push(
            done.length === 1
              ? `${done[0]} quedó acreditado.`
              : `${done.slice(0, 3).join(', ')}${done.length > 3 ? ` y ${done.length - 3} más` : ''}.`
          );
        }

        // El carnet solo se cuenta acá cuando la pantalla NO lo sigue por su cuenta. Es lo
        // que distingue a las dos: «Gestión de acreditables» lo pinta en alertas en línea
        // —que se quedan— y no necesita que el aviso lo repita; el mostrador no tiene dónde,
        // así que se entera por acá.
        if (!onCardBatch) {
          if (cardBatch) {
            partes.push(
              `Su carnet se está generando en el lote ${cardBatch.label}: lo encuentras en «Lotes de acreditaciones».`
            );
          } else if (cardBatchSkippedReason && done.length) {
            // Que no haya carnet NO desacredita a nadie: las acreditaciones ya están.
            partes.push(
              `El carnet no se generó: ${cardBatchSkippedReason}.`
            );
          }
        }

        if (failed.length) {
          partes.push(
            `Sin acreditar — ${failed
              .map((item) => `${item.name}: ${item.reason}`)
              .slice(0, 3)
              .join(' · ')}.`
          );
        }

        if (done.length) {
          onEmitted();
        }

        toast({
          title: !done.length
            ? 'No se pudo acreditar'
            : failed.length
              ? `${done.length} de ${done.length + failed.length} acreditadas`
              : done.length === 1
                ? 'Acreditación emitida'
                : `${done.length} acreditaciones emitidas`,
          message: partes.join(' '),
          icon: done.length ? 'positive' : 'caution',
          theme: !done.length ? 'negative' : failed.length ? 'caution' : 'positive'
        });
      } catch (error) {
        toast({
          title: 'No se pudo acreditar',
          message: getApiErrorMessage(
            error,
            'Inténtalo de nuevo en unos minutos.'
          ),
          icon: 'caution',
          theme: 'negative'
        });
      } finally {
        setWorking(false);
      }
    },
    [eventId, onEmitted, toast]
  );

  return { emit, working };
}
