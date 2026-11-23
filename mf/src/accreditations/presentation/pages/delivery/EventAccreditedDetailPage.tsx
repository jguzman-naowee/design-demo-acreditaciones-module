import './DeliveryPages.scss';

import {
  ACCREDITATION_MANAGE,
  AccreditationPersonRepository,
  AccreditedRecordRepository,
  SEX_LABELS,
  ValidationLogByAccreditationRepository
} from '@mf-accreditations/data';
import type {
  AccreditationAudit,
  AccreditationPerson,
  AccreditedRecordDetail,
  ValidationLog
} from '@mf-accreditations/domain';
import {
  CREDENTIAL_ACTION_VISIBLE,
  formatCatalogDate,
  formatDateTimeInline,
  formatDocumentNumber,
  getApiErrorMessage,
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  getDeliveryStatusLabel,
  NwsDetailField,
  NwsFileThumbnail,
  NwsLoading,
  NwsRequestError,
  NwsRowActionsMenu,
  NwsStackedCell,
  NwsSuccessModal,
  openUploadedFile,
  useAccreditationCard,
  useCardBatchDetail
} from '@mf-accreditations/presentation';
import { useSession } from '@naowee-tech/sdk-frontend-react';
import type { NwtTabItem } from '@naowee-tech/sdk-react-components';
import {
  NwtAlert,
  NwtBadge,
  NwtBreadcrumb,
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtEmptyState,
  NwtTabs
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAccreditedRecordActions } from './accredited-record-actions.hook';
import { ChangeRoleModal, type ChangeRoleResult } from './ChangeRoleModal';
import { DeliveryActionsButton } from './DeliveryActionsButton';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';
import { EventAccreditedHistory } from './EventAccreditedHistory';

const repository = invertly(AccreditedRecordRepository);
const personRepository = invertly(AccreditationPersonRepository);
const validationLogRepository = invertly(
  ValidationLogByAccreditationRepository
);

// A dónde vuelve el migajón. Era «Acreditados del evento», que ya no existe: llevaba a una
// pantalla retirada, o sea que el único camino de vuelta del detalle era el botón del
// navegador. Lo reportó Andrés.
//
// Por defecto se vuelve a «Lista de acreditados», que es la lista de esta misma gente. Pero si
// quien abrió el detalle vino de otra —«Gestión de acreditables» es la otra puerta—, se vuelve
// a ESA: mandar a alguien a una lista distinta de la que estaba mirando le borra sus filtros y
// su página sin avisar.
const LIST_ROUTE = '/delivery/accredited';

const LIST_LABEL = 'Lista de acreditados';

// Lo que el diseño pide y el contrato no da. Se pinta el campo con su raya en lugar de
// esconderlo: la pantalla queda igual al diseño y se ve de un golpe qué falta pedirle al
// backend. Medido contra dev el 2026-08-25 sobre GET /accreditations/{code} y
// GET /persons?document_number=, que entre los dos traen todo lo demás.
const SIN_DATO = '—';

// Tres pestañas y no dos: antes «Datos» metía dentro la información básica, la de
// acreditación Y la tabla de permisos, con divisores, y había que bajar mucho para llegar a los
// permisos. El rediseño reparte, y los permisos salen a su propia tarjeta.
type DetailTab = 'basic' | 'accreditation' | 'history';

const TABS: NwtTabItem<DetailTab>[] = [
  { id: 'basic', label: 'Información básica', value: 'basic' },
  {
    id: 'accreditation',
    label: 'Información de acreditación',
    value: 'accreditation'
  },
  { id: 'history', label: 'Historial', value: 'history' }
];

// El detalle de una acreditación tal como lo devuelve el gateway.
//
// Cruza dos endpoints: `GET /accreditations/{code}` para la acreditación con sus
// permisos, usos y vigencias, y `GET /persons?document_number=` para los nombres por
// separado, que la acreditación trae aplanados en `full_name`.
export function EventAccreditedDetailPage() {
  const { accreditationCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useContext(NwtContext);

  // El PDF de la acreditación: pedirlo, esperar a que el backend lo genere y abrirlo.
  const card = useAccreditationCard(accreditationCode);

  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const [tab, setTab] = useState<DetailTab>('basic');
  const [detail, setDetail] = useState<AccreditedRecordDetail>();
  const [history, setHistory] = useState<AccreditationAudit[]>([]);
  const [person, setPerson] = useState<AccreditationPerson>();
  // Las lecturas de la credencial con su total. `undefined` mientras no se han pedido, 'error'
  // si la petición falló: así el campo dice «—» en vez de quedarse en puntos suspensivos.
  //
  // Una sola petición sirve a las dos pestañas: la de acreditación pinta el total y el
  // historial las pinta una a una.
  const [readings, setReadings] = useState<
    { logs: ValidationLog[]; total: number } | 'error'
  >();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  // `silencioso` es para la relectura de después del lote: sin él, `loading` devuelve el
  // «Cargando la acreditación…» de cuerpo entero y la ficha desaparece un instante en vez de
  // refrescarse en su sitio. Va como objeto y no como booleano suelto a propósito: a `load` lo
  // llaman un efecto y el hook de acciones, y un argumento posicional que alguno pasara por
  // casualidad silenciaría la carga sin que nadie lo notara.
  const load = useCallback((opciones?: { silencioso?: boolean }) => {
    if (!accreditationCode) {
      return;
    }

    if (!opciones?.silencioso) {
      setLoading(true);
    }

    setError(undefined);

    repository
      .requestDetail(accreditationCode)
      .then((record) => {
        setDetail(record);

        // Los nombres separados son de otro endpoint; si falla, el detalle sigue
        // sirviendo con el nombre completo.
        return personRepository
          .findByDocument(record.document)
          .then(setPerson)
          .catch(() => undefined);
      })
      .catch(setError)
      .finally(() => setLoading(false));

    // La auditoría es de otro endpoint y no es crítica para la pantalla: si falla,
    // el detalle se muestra igual y la pestaña queda vacía.
    repository
      .requestHistory(accreditationCode)
      .then(setHistory)
      .catch(() => setHistory([]));

    // Acá se bajaba el catálogo ENTERO de permisos —una petición más por pantalla— solo
    // para cruzar el icono de cada zona, porque el detalle no lo mandaba. Ya lo manda:
    // medido en staging el 2026-09-08, 156 de 156 permisos de tres eventos traen su
    // `file_icon_upload_id`. Además del viaje de más, el cruce tenía dos defectos: pedía
    // una sola página de 100, así que a partir del permiso 101 el icono desaparecía sin
    // avisar, y su `.catch` los dejaba vacíos en silencio.
  }, [accreditationCode]);

  useEffect(load, [load]);

  // Las lecturas se piden al abrir una de las DOS pestañas que las usan, no al cargar el
  // detalle: quien solo mira «Información básica» no gasta la petición. Y una sola vez,
  // aunque se salte de pestaña en pestaña.
  // Y se sueltan al cambiar de acreditación. Sin esto se quedaban pegadas: la guarda de
  // `readings !== undefined` bloquea la relectura, así que abrir otra ficha sin desmontar la
  // pantalla —el caso de navegar entre dos detalles— enseñaba las lecturas de la anterior con
  // su nombre al lado. No lo pilló nadie porque hoy se llega de una en una desde la lista.
  useEffect(() => {
    setReadings(undefined);
  }, [accreditationCode]);

  // SOLO el historial, desde que el contador de validaciones se fue de «Información de
  // acreditación». Antes las pedían las dos pestañas —de ahí el `||`— porque esa pintaba su
  // total; ahora quien solo abre la ficha de acreditación no gasta la petición.
  useEffect(() => {
    if (tab !== 'history' || !accreditationCode || readings !== undefined) {
      return;
    }

    let alive = true;

    validationLogRepository
      .requestWithTotal(accreditationCode)
      .then((resultado) => alive && setReadings(resultado))
      .catch((motivo: unknown) => {
        if (!alive) {
          return;
        }

        setReadings('error');

        // El `catch` era mudo, y eso es lo que QA reportó como «no es funcional la lectura».
        //
        // Un 400, un 403, un 404 y un fallo de red acababan los cuatro igual: sin aviso y sin
        // reintento. Desde la pantalla, «esta credencial no se ha leído nunca» y «no pude
        // preguntarlo» eran EXACTAMENTE lo mismo, y esa es la duda con la que QA se quedó.
        //
        // Ahora el sitio donde se nota es el HISTORIAL: sin lecturas se queda solo con los
        // movimientos y ni siquiera ofrece su filtro, así que parecería una credencial que
        // nadie ha validado nunca. El aviso es lo que distingue eso de un fallo.
        //
        // Va en toast y no tumbando la ficha a propósito: que las lecturas fallen no puede
        // llevarse por delante el nombre, el tipo ni los permisos. Lo que no puede es fallar
        // en silencio.
        toast({
          title: 'No pudimos traer las lecturas de la credencial',
          message: getApiErrorMessage(
            motivo,
            'El registro de validaciones no respondió. El historial de abajo enseña los movimientos, pero le faltan las validaciones en puerta: no es que no las haya, es que no se pudieron pedir.'
          ),
          icon: 'caution',
          theme: 'caution'
        });
      });

    return () => {
      alive = false;
    };
  }, [tab, accreditationCode, readings, toast]);

  // De dónde se vino, si quien navegó lo dijo. Un enlace guardado no lo trae, y entonces
  // manda el valor por defecto.
  const origen = useLocation().state as
    | { from?: string; fromLabel?: string }
    | undefined;

  const volverA = origen?.from ?? LIST_ROUTE;
  const rotuloVolver = origen?.fromLabel ?? LIST_LABEL;

  const onBack = useCallback(() => {
    navigate(volverA);
  }, [navigate, volverA]);

  // El ciclo entero lo lleva el hook y no rechaza: los fallos quedan en su estado y
  // se cuentan en el aviso de abajo, que sobrevive a un toast.
  const onGenerateCard = useCallback(() => {
    void card.generate();
  }, [card]);

  // Abrir sí es puntual: firma la URL con este clic y puede fallar sola.
  const onOpenCard = useCallback(() => {
    card.open().catch((error) => {
      toast({
        title: 'No se pudo abrir la acreditación',
        message: getApiErrorMessage(
          error,
          'El PDF se generó pero el almacenamiento no lo entregó.'
        ),
        icon: 'caution',
        theme: 'negative'
      });
    });
  }, [card, toast]);

  const generatingCard =
    card.status === 'requesting' || card.status === 'generating';

  // ── El carnet que YA existe (SUV2-2278) ────────────────────────────────────
  // El detalle dice ahora si hay carnet y dónde está, así que la pantalla dejó de tener que
  // EMITIRLO para averiguarlo. Ese era el problema: la única puerta al PDF era el botón de
  // generar, la emisión no es idempotente, y el estado del carnet se reinicia en cada
  // montaje —así que volver al detalle volvía a ofrecer «Generar»—. En staging salieron
  // siete lotes de la misma acreditación en cuatro minutos.
  //
  // Con `cardUrl` el PDF se abre de un `window.open`, igual que el certificado tres bloques
  // más abajo: sin POST, sin polling y sin firmar nada. La URL ya viene prefirmada y se
  // renueva en cada carga del detalle, así que se usa en el momento y no se guarda.
  //
  // Si en esta visita ya se generó uno, manda el del hook: es más nuevo que el del detalle,
  // que se leyó antes de generarlo.
  const cardUrl = card.status === 'ready' ? null : (detail?.cardUrl ?? null);

  // Hay lote pero todavía no hay PDF. Es el tercer caso, y sin él la pantalla ofrecería
  // «Generar» a alguien cuyo carnet se está generando ya: otro lote de más.
  const loteSinPdf =
    !!detail?.batchCode &&
    !detail?.cardUrl &&
    detail?.batchStatus !== 'FAILED' &&
    detail?.batchStatus !== 'COMPLETED_WITH_ERRORS';

  // Y se SIGUE, en vez de creerle al detalle una sola vez.
  //
  // El detalle se lee al abrir la pantalla y no se vuelve a mirar, así que un carnet que
  // termine de generarse con la pantalla abierta no se entera nadie: el botón se queda
  // girando en «Generando Acreditación…» hasta que alguien recargue a mano. Reportado por
  // Andrés, y medido contra staging con esa misma acreditación:
  //
  //   15:22:34  se crea el lote
  //   ~15:25    GET /card-batches/{code} → COMPLETED, 1 carnet, sin saltados
  //             GET /accreditations/{code} → batch_status PROCESSING, card_url null
  //   15:27:29  el detalle ya dice COMPLETED y trae su card_url
  //
  // O sea que la espera es real y corta —y el detalle va un rato por detrás del lote—, y lo
  // único que faltaba era volver a mirar. Se sigue el LOTE, que es quien sabe, y no se
  // repregunta el detalle en bucle.
  const seguimiento = useCardBatchDetail(
    loteSinPdf ? detail?.batchCode : undefined
  );

  const cardEnCurso =
    loteSinPdf &&
    (seguimiento.status === 'loading' || seguimiento.status === 'watching');

  // El seguimiento se perdió —un 404, la red, o quince minutos sin desenlace— con el lote
  // todavía sin PDF.
  //
  // Lo que NO se puede hacer acá es ofrecer «Generar». `cardEnCurso` mira solo `loading` y
  // `watching`, así que sin esta rama el botón caía en generar sobre alguien que YA tiene un
  // lote en marcha: exactamente el lote de más que este seguimiento viene a evitar, y encima
  // provocado por un fallo pasajero de red. Lo destapó el arnés, con la semilla que apuntaba a
  // un lote inexistente: 404 → «Generar».
  //
  // Lo que sí se puede es volver a mirar el MISMO lote, que es lo que hace `reload` del hook.
  const seguimientoPerdido =
    loteSinPdf &&
    (seguimiento.status === 'failure' || seguimiento.status === 'timeout');

  // El PDF del lote que se acaba de seguir. Existe para la ventana en la que el lote ya
  // terminó y el detalle todavía no se ha enterado: sin esto el botón volvería a ofrecer
  // «Generar», y generar **crea otro lote** —de ahí salieron siete lotes de la misma
  // acreditación en cuatro minutos—. Es el MISMO fichero, abierto sin pedir nada nuevo.
  const pdfDelLote =
    seguimiento.status === 'settled'
      ? (seguimiento.batch?.file?.uploadId ?? null)
      : null;

  // Al terminar el lote se relee el detalle, que es de donde salen `card_url` y el estado
  // que pinta el resto de la pantalla. No hace bucle: con el detalle al día `loteSinPdf` se
  // apaga, el seguimiento se suelta, y esta condición no vuelve a cumplirse.
  useEffect(() => {
    if (seguimiento.status === 'settled') {
      load({ silencioso: true });
    }
  }, [seguimiento.status, load]);

  const onOpenWatchedCard = useCallback(() => {
    if (!pdfDelLote) {
      return;
    }

    openUploadedFile(pdfDelLote).catch((error) => {
      toast({
        title: 'No se pudo abrir la acreditación',
        message: getApiErrorMessage(
          error,
          'El PDF se generó pero el almacenamiento no lo entregó.'
        ),
        icon: 'caution',
        theme: 'negative'
      });
    });
  }, [pdfDelLote, toast]);

  const onOpenExistingCard = useCallback(() => {
    if (detail?.cardUrl) {
      window.open(detail.cardUrl, '_blank', 'noopener');
    }
  }, [detail]);

  // Tras entregar o inactivar hay que releer: el detalle no vive en el store de la
  // lista, así que no se repinta solo.
  const {
    askDeactivate,
    askDeliver,
    askUndoDelivery,
    confirmCopy,
    onCancel,
    onCloseSuccess,
    onConfirm,
    successCopy
  } = useAccreditedRecordActions(load);

  // Cambiar el tipo deja a la persona con una acreditación NUEVA: se abre esa, que es la que
  // vale, conservando de dónde se vino para que el migajón siga llevando a la misma lista.
  const [changingRole, setChangingRole] = useState(false);

  const onRoleChanged = useCallback(
    ({ newCode, cardBatchSkippedReason }: ChangeRoleResult) => {
      setChangingRole(false);

      toast({
        title: 'Tipo de acreditado cambiado',
        message:
          cardBatchSkippedReason ??
          'La acreditación anterior quedó inactiva y el carnet nuevo se está generando.',
        icon: cardBatchSkippedReason ? 'caution' : 'positive',
        theme: cardBatchSkippedReason ? 'caution' : 'positive'
      });

      navigate(`/delivery/event-accredited/${newCode}`, { state: origen });
    },
    [navigate, origen, toast]
  );

  if (loading) {
    return (
      <section className="nws-delivery nws-event-accredited-detail">
        <div className="nws-delivery__content">
          <NwsLoading>
            <h4>Cargando la acreditación, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="nws-delivery nws-event-accredited-detail">
        <div className="nws-delivery__content">
          <NwsRequestError
            error={error}
            title="No pudimos cargar la acreditación"
            onRetry={load}
          />
        </div>
      </section>
    );
  }

  // El tercer estado, que antes se colapsaba dentro del error: una respuesta correcta SIN
  // registro no es un fallo de red, y presentarla como tal manda a reintentar algo que va a
  // volver vacío. Pasa con un código de otro evento o con una acreditación borrada.
  if (!detail) {
    return (
      <section className="nws-delivery nws-event-accredited-detail">
        <div className="nws-delivery__content">
          <NwtEmptyState
            title="No encontramos esta acreditación"
            description="El código no corresponde a ninguna acreditación de este evento. Puede que se haya borrado o que pertenezca a otro evento."
            actionLabel="Volver a los acreditados"
            showAction={true}
            onActionClick={onBack}
          />
        </div>
      </section>
    );
  }

  // La entrega es un eje aparte del estado: una acreditación entregada sigue ACTIVE.
  // El diseño llama «Estado» a este eje y pone el otro junto al título.
  const deliveryStatus = detail.delivered ? 'DELIVERED' : 'PENDING';

  // ¿Alguno de los permisos trae icono? Si ninguno, la columna no se pinta: una columna
  // entera de cuadritos vacíos ocupa sitio y no dice nada.
  const hayIconos = !!detail?.permissions.some(
    (permission) => permission.fileIconUploadId
  );

  return (
    <section className="nws-delivery nws-event-accredited-detail">
      <div className="nws-delivery__content">
        <NwtBreadcrumb
          items={[
            { key: 'back', label: rotuloVolver },
            { key: 'detail', label: detail.document, active: true }
          ]}
          onBreadcrumb={(item) => item.key === 'back' && onBack()}
        />

        <div className="nws-delivery__header">
          {/* El título es la persona y el subtítulo su tipo. Antes decía «Detalle del
              acreditado» con un subtítulo genérico, y para saber de quién era el detalle había
              que buscar el nombre entre veinte campos. */}
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">{detail.fullName}</span>

            <small className="nwt-smalltext-font-regular">
              {detail.roleName}
            </small>
          </div>

          <div className="nws-delivery__actions">
            {/* El estado sale de dentro de la tarjeta a la cabecera de la página: es lo
                primero que hay que saber al abrir el detalle. */}
            <NwtBadge
              nwtVariant="quiet"
              nwtTheme={getCatalogStatusTheme(detail.status)}
              vignette={true}
            >
              {getCatalogStatusLabel(detail.status)}
            </NwtBadge>

            {/* Y con él las acciones, que estaban al lado del rótulo «Información básica»
                —dentro de una sección— cuando actúan sobre la acreditación entera. */}
            {canManage && (
              <NwsRowActionsMenu
                ariaLabel={`Acciones de ${detail.fullName}`}
                actions={[
                  // Se pinta SOLO la acción que se puede hacer, igual que en la tabla de
                  // «Lista de acreditados» —cambiar una y no la otra deja a la misma
                  // acreditación con dos menús distintos según por dónde se llegue—.
                  ...(detail.deliverable
                    ? [
                        {
                          key: 'deliver',
                          icon: 'edit',
                          label: 'Entregar',
                          onClick: () => askDeliver([detail])
                        }
                      ]
                    : []),
                  ...(detail.delivered && detail.active
                    ? [
                        {
                          key: 'undo',
                          icon: 'padlock-open',
                          label: 'Revertir la entrega',
                          onClick: () => askUndoDelivery(detail)
                        }
                      ]
                    : []),
                  // Cambiar el tipo inactiva esta acreditación y emite otra: solo sobre una
                  // activa y solo para el personal de apoyo (docente entrenador ↔ asistente).
                  // A deportistas, misión y Naowee no se les ofrece.
                  ...(detail.canChangeRole
                    ? [
                        {
                          key: 'change-role',
                          icon: 'user',
                          label: 'Cambiar tipo de acreditado',
                          onClick: () => setChangingRole(true)
                        }
                      ]
                    : []),
                  ...(detail.active
                    ? [
                        {
                          key: 'deactivate',
                          icon: 'delete',
                          label: 'Inactivar',
                          onClick: () => askDeactivate([detail])
                        }
                      ]
                    : []),
                  // La salida a la credencial pública, que faltaba: el detalle pintaba el
                  // token del QR como campo pero no dejaba ver la credencial que abre.
                  //
                  // OCULTO TEMPORALMENTE (Andrés, 2026-09-08): «Ver credencial» no va por
                  // ahora. La credencial sigue viva en `/profile/event/:code` —el campo
                  // con el token del QR sigue pintándose más abajo—; lo que se quita es
                  // esta salida. Volver = poner la constante en `true`; el detalle
                  // completo está donde se declara.
                  ...(CREDENTIAL_ACTION_VISIBLE
                    ? [
                        {
                          key: 'profile',
                          icon: 'user',
                          label: 'Ver credencial',
                          onClick: () =>
                            navigate(`/profile/event/${accreditationCode}`)
                        }
                      ]
                    : []),
                  // El certificado de participación, que el backend empezó a emitir el
                  // 2026-09-07. La URL viene FIRMADA y de vida corta —diez minutos— y se
                  // regenera en cada carga del detalle, así que se abre y no se guarda.
                  //
                  // La acción se pinta siempre y dice por qué no se puede cuando no hay
                  // certificado: escondida, nadie sabría que existe la posibilidad.
                  {
                    key: 'certificate',
                    icon: 'download',
                    label: detail.certificateUrl
                      ? 'Descargar certificado'
                      : 'Sin certificado emitido',
                    disabled: !detail.certificateUrl,
                    onClick: () =>
                      detail.certificateUrl &&
                      window.open(detail.certificateUrl, '_blank', 'noopener')
                  }
                ]}
                trigger={(open) => <DeliveryActionsButton open={open} />}
              />
            )}

            {/* La acreditación se genera en dos tiempos, así que el botón tiene dos
                caras: pedirlo y —cuando el PDF ya existe— abrirlo.

                Desde SUV2-2278 el detalle dice si YA hay carnet (`cardUrl`) y si hay uno
                generándose (`batchCode` sin `cardUrl`), así que hay una tercera: abrir el
                que ya existía sin haberlo pedido en esta visita, y no ofrecer «Generar» a
                quien tiene uno en curso. Cada «Generar» de más era un lote de más. */}
            {card.status === 'ready' ? (
              <NwtButton
                icon="visibility-on"
                nwtVariant="loud"
                nwtSize="medium"
                onClick={onOpenCard}
              >
                Abrir acreditación (PDF)
              </NwtButton>
            ) : cardUrl ? (
              // El carnet ya existía al abrir la pantalla: se abre y punto. Este es el
              // camino que evita el lote de más — antes había que pulsar «Generar» para
              // llegar al mismo PDF.
              <NwtButton
                icon="visibility-on"
                nwtVariant="loud"
                nwtSize="medium"
                onClick={onOpenExistingCard}
              >
                Abrir acreditación (PDF)
              </NwtButton>
            ) : pdfDelLote ? (
              // El lote terminó mientras la pantalla estaba abierta y el detalle todavía no
              // lo sabe. El PDF es el mismo: se abre desde el lote.
              <NwtButton
                icon="visibility-on"
                nwtVariant="loud"
                nwtSize="medium"
                onClick={onOpenWatchedCard}
              >
                Abrir acreditación (PDF)
              </NwtButton>
            ) : seguimientoPerdido ? (
              // Se perdió de vista el lote. Se vuelve a mirar EL MISMO —`reload` del hook—, no
              // se emite otro: ver `seguimientoPerdido`.
              <NwtButton
                icon="refresh"
                nwtVariant="loud"
                nwtSize="medium"
                onClick={seguimiento.reload}
              >
                Volver a consultar el carnet
              </NwtButton>
            ) : (
              <NwtButton
                icon="download"
                nwtVariant="loud"
                nwtSize="medium"
                loading={generatingCard || cardEnCurso}
                disabled={generatingCard || cardEnCurso}
                onClick={onGenerateCard}
              >
                {generatingCard || cardEnCurso
                  ? 'Generando Acreditación...'
                  : card.status === 'idle'
                    ? 'Generar Acreditación'
                    : 'Reintentar la acreditación'}
              </NwtButton>
            )}
          </div>
        </div>

        {/* Que una acreditación esté inactiva no es cosmético: su QR deja de abrir la
            puerta. El badge de la cabecera lo dice de pasada; esto lo dice entero. */}
        {!detail.active && (
          <NwtAlert nwtTheme="caution" icon="caution" visible={true}>
            Esta acreditación está inactiva: su QR ya no valida en la puerta.
          </NwtAlert>
        )}

        {/* La espera no es instantánea —lo medido en dev fue ~9 s con una acreditación— así
            que se cuenta en lugar de dejar un botón girando sin explicación. */}
        {generatingCard && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            Estamos generando el PDF de la acreditación, y tarda unos segundos.
            Si sales de la pantalla, el PDF se sigue generando, pero hay que
            volver a pedirlo.
          </NwtAlert>
        )}

        {card.status === 'timeout' && (
          <NwtAlert nwtTheme="warning" icon="caution" visible={true}>
            La acreditación sigue generándose y dejamos de esperar. Si la
            vuelves a pedir, retoma la misma: no se genera otra de más.
          </NwtAlert>
        )}

        {card.status === 'failure' && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            {getApiErrorMessage(
              card.error,
              'No pudimos generar la acreditación de esta acreditación.'
            )}
            {card.batch ? ` (lote ${card.batch.label})` : ''}
          </NwtAlert>
        )}

        {/* Acá NO hay lista de omitidos, a propósito: el carnet individual es de UNA
            persona, así que o sale o el lote queda sin ninguno y backend responde 422. Ese
            motivo lo pinta el bloque de `failure` de arriba, que ya lee el mensaje del API. */}

        <NwtCard
          className="nws-event-accredited-detail__card"
          header={
            <NwtTabs<DetailTab> items={TABS} value={tab} onChange={setTab} />
          }
        >
          {/* Cada pestaña es una sección propia. El rótulo lo pone la pestaña, así que
              dentro ya no hace falta repetirlo ni separar con divisores. */}
          <section hidden={tab !== 'basic'}>
            <div className="nws-event-accredited-detail__panel">
              <div className="naotech-grid naotech-grid--4">
                {/* Sin «Tipo de documento»: el contrato solo trae el número y el campo era
                    una raya fija. Lo que falta ya está anotado en el hilo de backend, no hace
                    falta un hueco en pantalla para recordarlo. */}
                <div className="naotech-col--1">
                  <NwsDetailField label="Documento">
                    {formatDocumentNumber(detail.document)}
                  </NwsDetailField>
                </div>

                {/* Los nombres separados vienen de /persons; si esa consulta no
                    encuentra a la persona, se muestra el nombre completo tal cual. */}
                <div className="naotech-col--1">
                  <NwsDetailField label="Nombre">
                    {person?.firstName || detail.fullName}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--1">
                  <NwsDetailField label="Segundo nombre">
                    {person?.secondName || SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--1">
                  <NwsDetailField label="Apellido">
                    {person?.lastName || SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--1">
                  <NwsDetailField label="Segundo apellido">
                    {person?.secondLastName || SIN_DATO}
                  </NwsDetailField>
                </div>

                {/* Sexo y correo los llena el backend desde user-auth al CREAR la
                    persona, así que las anteriores al despliegue llegan sin ellos —y
                    llegan ausentes, no en null—. No hay PATCH: el backfill es de ellos. */}
                <div className="naotech-col--1">
                  <NwsDetailField label="Sexo">
                    {person?.sex
                      ? (SEX_LABELS[person.sex] ?? person.sex)
                      : SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Correo electrónico">
                    {person?.email || SIN_DATO}
                  </NwsDetailField>
                </div>

                {/* No está en el diseño, pero es dato real del contrato y ya llega
                    poblado: quitarlo sería perder la delegación de la que responde
                    cada acreditado. */}
                <div className="naotech-col--1">
                  <NwsDetailField label="Delegación">
                    {detail.departmentName ||
                      person?.departmentName ||
                      SIN_DATO}
                  </NwsDetailField>
                </div>

                {/* El deporte. Llegó el 2026-09-07 y llevaba meses en null: la ficha de un
                    deportista no decía de qué deporte era.
                    `sports_info` se resuelve EN VIVO contra orc y solo existe para deportistas
                    a título individual —el apoyo y los deportes de conjunto llegan en null SIN
                    error—, así que la raya acá significa «no aplica», no «se perdió el dato».
                    Cuando orc no responde, el motivo viene redactado en `sports_info_error` y
                    se pinta tal cual: es la diferencia entre «no aplica» y «no se pudo saber». */}
                <div className="naotech-col--1">
                  <NwsDetailField label="Deporte">
                    {detail.sportsInfo?.sportName ||
                      detail.sportsInfoError ||
                      SIN_DATO}
                  </NwsDetailField>
                </div>
              </div>
            </div>
          </section>

          <section hidden={tab !== 'accreditation'}>
            <div className="nws-event-accredited-detail__panel">
              {/* Tres rejillas y no una: así las filas son las del rediseño en vez de las que
                  salgan del flujo automático, y «Estado de entrega» se queda solo en la suya
                  —lleva dos líneas y en medio de la fila descuadraba las de al lado—. Las tres
                  declaran las mismas cuatro columnas, así que siguen alineadas entre sí. */}
              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--1">
                  <NwsDetailField label="Tipo de acreditado">
                    {detail.roleName}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--1">
                  <NwsDetailField label="Fecha de emisión">
                    {formatCatalogDate(detail.createdAt)}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--1">
                  <NwsDetailField label="Última modificación">
                    {formatCatalogDate(detail.updatedAt)}
                  </NwsDetailField>
                </div>
              </div>

              {/* Sin «Código del rol», que la demo pone acá: ese dato es el rol de PLATAFORMA y
                  no viaja con la acreditación —`platform_role` solo existe en el tipo—. Lo que
                  sí llega es `role_code`, en crudo (ATHLETE, DELEGADO), que es el defecto que
                  QA reportó y además repite lo que ya dice «Tipo de acreditado». */}
              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--2">
                  {/* El token del QR: es lo que debería resolver el perfil público, y
                      hoy no hay endpoint sin sesión que lo haga. */}
                  <NwsDetailField label="Token público del QR">
                    {detail.qrPublicToken ?? SIN_DATO}
                  </NwsDetailField>
                </div>

                {/* UN contador, y el que la gente busca.

                    El carnet lleva DOS códigos QR y cada uno cuenta en su sitio:

                      anverso → `qr_validation_token` → POST /validate → validation-logs
                      reverso → `qr_public_token`     → credencial pública → public_views_count

                    Acá hubo un campo llamado «Lecturas de la credencial» que pintaba las
                    VALIDACIONES en puerta —el primero—, y el nombre prometía lo que el número
                    no medía: QA escaneó con la cámara del móvil, que abre el del REVERSO, vio
                    cero y lo reportó como roto. El número era correcto.

                    Se separaron en dos campos con su nombre y Andrés se llevó el de
                    validaciones: en esta ficha lo que se pregunta es cuántas veces se abrió la
                    credencial, y quién la revisó en una puerta se lee en el HISTORIAL, que
                    pinta cada lectura con su hora, su puerta y si se concedió o se denegó. Un
                    total suelto al lado no añadía nada que el historial no diga mejor.

                    Por eso las lecturas se SIGUEN pidiendo: son las del historial. Lo que se
                    fue es el número de esta pestaña, no la petición. */}
                <div className="naotech-col--2">
                  <NwsDetailField label="Lecturas de la credencial">
                    {String(detail.publicViews)}
                  </NwsDetailField>
                </div>
              </div>

              {/* La entrega, en UN campo. Estaba partida en dos —un badge «Estado» y una
                  «Fecha de entrega» aparte— y había que juntarlas con la vista para saber si
                  se entregó y cuándo. Va como texto de color y no en badge: ese ya está
                  medido, no envuelve ni recorta y salía partido al estrechar. */}
              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--1">
                  <NwsDetailField label="Estado de entrega">
                    <NwsStackedCell
                      primary={
                        <span
                          className={`nws-delivery-state nws-delivery-state--${
                            detail.delivered ? 'entregada' : 'pendiente'
                          }`}
                        >
                          {getDeliveryStatusLabel(deliveryStatus)}
                        </span>
                      }
                      secondary={
                        detail.deliveredAt
                          ? formatDateTimeInline(detail.deliveredAt)
                          : undefined
                      }
                    />
                  </NwsDetailField>
                </div>
              </div>
            </div>
          </section>

          <section hidden={tab !== 'history'}>
            <div className="nws-event-accredited-detail__panel">
              <EventAccreditedHistory
                detail={detail}
                history={history}
                readings={readings === 'error' ? undefined : readings}
              />
            </div>
          </section>
        </NwtCard>

        {/* Los permisos salen a su propia tarjeta, como en el rediseño: son de la
            acreditación entera y no de una de sus pestañas, y enterrados al final de «Datos»
            había que bajar veinte campos para verlos. */}
        <NwtCard
          className="nws-event-accredited-detail__permissions"
          header={
            <span className="nwt-subtitle-font-bold">Permisos concedidos</span>
          }
        >
          {detail.permissions.length ? (
            <NwtDatatable
              header={
                <NwtDatatableHeader>
                  {/* La columna del icono solo aparece si alguna fila lo tiene. Sin esto se
                      pintaba una cabecera en blanco y una fila de cajas grises vacías: el
                      icono lo trae el catálogo de permisos, y hoy casi ninguno tiene. */}
                  {hayIconos && (
                    <NwtDatatableTitle className="nwt-width-xs-10" />
                  )}
                  <NwtDatatableTitle className="nwt-width-xs-45">
                    Permiso
                  </NwtDatatableTitle>
                  {/* La zona y la sede del permiso, que llevábamos sin pintar teniéndolas:
                      `zone_name` y `venue_name` llegan desde el paquete del 2026-08-13 y la
                      entidad ya las junta en `place`. Sin esto, «Área V.I.P» no dice de qué
                      escenario. */}
                  <NwtDatatableTitle className="nwt-width-xs-45">
                    Zona / Sede
                  </NwtDatatableTitle>
                  {/* «Usos», «Válido desde» y «Válido hasta» estuvieron acá y QA las mandó a
                      quitar.

                      Los tres campos existen en el contrato del permiso —`has_limit`,
                      `max_uses_per_person`, `used_count`, `valid_from`, `valid_to`— pero hoy
                      NINGUNO trae dato: la tabla entera salía «Sin tope / — / —» en todas sus
                      filas. Tres columnas que solo saben decir que no saben ocupaban más de la
                      mitad del ancho y empujaban a «Permiso» y «Zona / Sede», que son las dos
                      que el operador viene a leer.

                      Cuando el backend empiece a mandarlos se vuelven a poner: el mapeo sigue
                      vivo (`usesLabel`, `validFrom`, `validTo` en la entidad) y no hay que
                      rehacerlo, solo devolver las celdas. */}
                </NwtDatatableHeader>
              }
            >
              {detail.permissions.map((permission) => (
                <NwtDatatableRecord key={permission.permissionId}>
                  {/* El icono es nuestro y la demo no lo tiene: en la puerta se reconoce la
                      zona por su símbolo antes que por su nombre. Se queda —cuando existe. */}
                  {hayIconos && (
                    <NwtDatatableCell className="nwt-width-xs-10">
                      <NwsFileThumbnail
                        label={permission.permissionName}
                        uploadId={permission.fileIconUploadId}
                      />
                    </NwtDatatableCell>
                  )}

                  <NwtDatatableCell className="nwt-width-xs-45">
                    <span className="nwt-text-font-medium">
                      {permission.permissionName}
                    </span>
                  </NwtDatatableCell>

                  <NwtDatatableCell className="nwt-width-xs-45">
                    <span>{permission.place || SIN_DATO}</span>
                  </NwtDatatableCell>
                </NwtDatatableRecord>
              ))}
            </NwtDatatable>
          ) : (
            /* Sin permisos no se pinta una tabla con cabecera y cero filas, que no dice
               nada: se dice. */
            <span className="nwt-text-font-regular">
              Esta acreditación no concede ningún permiso de acceso.
            </span>
          )}
        </NwtCard>
      </div>

      <DeliveryConfirmModal
        copy={confirmCopy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />

      <ChangeRoleModal
        detail={changingRole ? detail : undefined}
        onCancel={() => setChangingRole(false)}
        onChanged={onRoleChanged}
      />

      <NwsSuccessModal
        visible={!!successCopy}
        title={successCopy?.title ?? ''}
        caution={successCopy?.caution}
        bullets={successCopy?.bullets}
        onClose={onCloseSuccess}
      />
    </section>
  );
}
