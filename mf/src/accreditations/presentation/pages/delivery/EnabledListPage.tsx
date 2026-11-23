import './DeliveryPages.scss';

import {
  ACCREDITATION_MANAGE,
  AccreditationPersonRepository,
  AccreditedTypeCatalogRepository,
  type EventRoleCatalogItem,
  EventRoleCatalogRepository,
  LocationRepository,
  type ReadinessFilter,
  type ReadyTransversalFilters,
  RoleCatalogRepository,
  SEX_LABELS
} from '@mf-accreditations/data';
import type {
  AccreditedType,
  CardBatch,
  ParticipantFacet,
  ReadyParticipant,
  RoleCatalogFamily
} from '@mf-accreditations/domain';
import {
  accreditedTypeOptions,
  resolveAccreditedTypeCode
} from '@mf-accreditations/domain';
import {
  downloadCsv,
  getApiErrorMessage,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsReportLink,
  NwsRequestError,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_OPTIONS,
  useAccreditationCounters,
  useCardBatch,
  useRoleCatalogLabels,
  useSearchTerm
} from '@mf-accreditations/presentation';
import { useSession } from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtAlert,
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox,
  NwtTagGroup
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import { useAccreditEmission } from './accredit-emission.hook';
import { cardSkipReasonLabel } from './card-batch.status';
import { EnabledListTable } from './EnabledListTable';
import {
  PickSupportRoleModal,
  type SupportRoleChoice
} from './PickSupportRoleModal';

const personRepository = invertly(AccreditationPersonRepository);
const familyRepository = invertly(RoleCatalogRepository);
// El catálogo del evento, para traducir el `user_role` de cada fila al nombre que el evento le
// dio a ese tipo.
const typeRepository = invertly(AccreditedTypeCatalogRepository);
// Las regiones del país y el cruce región→departamentos, que es lo único que no sale de las facetas.
const locationRepository = invertly(LocationRepository);
// Las funciones concretas: las tres del apoyo y las de misión que el evento haya inscrito.
const roleCatalogRepository = invertly(EventRoleCatalogRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

// El tipo lo filtra el servidor con `roles` —en plural desde el despliegue del 2026-09-15—, y
// los valores son los TRES que ese filtro acepta. Es un catálogo cerrado, así que va quemado en
// vez de deducirse de la página que se esté viendo.
//
// El plural es lo que trajo al personal de MISIÓN: el `user_role` singular no sabía nombrarlo
// —ahí una fila de misión llega con su función (JMI, MED…), no con la categoría— y esa gente no
// se podía aislar desde la pantalla. `role` a secas, el más viejo, el gateway lo ignora en
// silencio y devuelve la lista entera: medido, 62 de 62.
//
// OJO, lo único de este bloque que no está verificado: `roles=MISSION_STAFF` devuelve 0 en los
// 17 pares evento+fase de staging, igual que un código inventado, porque no hay personal de
// misión sembrado en ninguno. Que el filtro esté bien es palabra de backend, no medición; está
// pedido que siembre uno.
// Las familias las publica `role-catalog`: escribirlas acá dejaba fuera a las que backend
// añadiera —pasó con Personal Naowee, que se podía crear y no filtrar—.
const TYPE_FILTER_ALL: NwtSelectOption<string> = {
  key: 'all',
  label: 'Tipo',
  value: 'all'
};

// El sexo de la PERSONA. Hasta el despliegue del 2026-09-15 este filtro miraba el sexo de la
// prueba inscrita —pedir mujeres devolvía a quienes compiten en pruebas femeninas—; ahora es el
// mismo dato que se ve en la fila. Medido: `sex_codes=M` devuelve exactamente las dos filas
// cuyo `sex_code` es M.
//
// Los rótulos salen de SEX_LABELS y no se escriben acá: `M` es MUJER, no «masculino», y
// duplicar ese mapa es cómo se vuelve a equivocar.
const SEX_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Sexo', value: 'all' },
  ...Object.entries(SEX_LABELS).map(([value, label]) => ({
    key: value,
    label,
    value
  }))
];

// Si se restan los que YA están acreditados, y quién lo decide.
//
// La pantalla pide la UNIÓN por defecto: es lo que la convierte en la única puerta de entrada
// en vez de una de dos listas que se solapan, y acreditar a alguien deja de hacerlo
// desaparecer —la fila se queda y cambia de estado, que es la confirmación—.
//
// Pero acreditando en tanda, las filas ya hechas estorban para ver a quién falta, y no había
// forma de esconderlas. Este desplegable la da, y sin inventar nada: «Por acreditar» es el
// `exclude_accredited=true` que el backend ya soporta.
//
// Ojo con qué significa exactamente: resta solo las ACTIVE. Las INACTIVE se quedan —y salen
// marcadas—, que es correcto: a esa gente SÍ se la puede volver a acreditar. Medido contra
// staging: 62 filas con `false` contra 61 con `true`.
//
// El tercer valor, «Ya acreditados», es la vista inversa con `only_accredited`. Medido contra
// staging el 2026-09-16 sobre «QA Acreditaciones Filtros 0709», con control negativo —hoy un
// parámetro inventado devuelve 400, así que el 200 significa algo—: sin filtro 15, con
// `exclude_accredited=true` 5 y con `only_accredited=true` 10. Los dos parten la lista exacta,
// que es lo que hace que el desplegable no esconda ni repita a nadie.
// Los rótulos se describen a sí mismos y no llevan el nombre de la columna: a diferencia de
// los demás desplegables, este SIEMPRE tiene un valor puesto, así que nunca actúa de marcador.
const ACCREDITATION_FILTER_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'pending', label: 'Por acreditar', value: 'pending' },
  { key: 'accredited', label: 'Ya acreditados', value: 'accredited' },
  { key: 'all', label: 'Acreditados y sin acreditar', value: 'all' }
];

// Los acreditables de la fase: quién se puede acreditar y quién todavía no.
//
// Hasta el despliegue del 2026-09-01 esta pantalla era de mentira —un repositorio en memoria,
// contadores de lotes falsos y un aviso que mandaba al usuario a otra pantalla—. Ahora sale de
// `GET /documentation/.../participants/ready-for-accreditation`, que es de donde ya salían los
// candidatos del mostrador.
//
// Dos listas, que es lo que pidió producto:
//
//   readiness=READY    los acreditables. Es el defecto: quien se acredita sale de la lista.
//   readiness=PENDING  los que tienen documentación por aprobar. No se pueden acreditar, pero
//                      hay que poder decirle a quien reclama QUÉ le falta sin salir del módulo.
export function EnabledListPage() {
  return (
    <NwsEventGuard>{(scope) => <EnabledCatalog {...scope} />}</NwsEventGuard>
  );
}

function EnabledCatalog({ event, eventId, phase }: NwsEventScope) {
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);
  const { toast } = useContext(NwtContext);

  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);
  const typeFilter = useFormControl<string | undefined>('all');
  // Si esconder a los que ya tienen su acreditación activa. Ver ACCREDITATION_FILTER_OPTIONS.
  //
  // Arranca en «Por acreditar», que es la pregunta con la que se entra a esta pantalla: a quién
  // me falta. Se probó al revés —abrir con todos— y estorbaba: acreditando en tanda, las filas
  // ya hechas se acumulan delante de las que quedan. Ver a los acreditados es un clic, y la
  // lista sigue siendo una sola: es lo que la separa de tener dos pantallas.
  const accreditationFilter = useFormControl<string | undefined>('pending');
  // La función concreta dentro del tipo: ENT, DAS del apoyo; JMI, MED del personal de misión.
  const functionFilter = useFormControl<string | undefined>('all');
  // La región. Va ANTES de la delegación a propósito: la encadena.
  const regionFilter = useFormControl<string | undefined>('all');
  const departmentFilter = useFormControl<string | undefined>('all');
  const municipalityFilter = useFormControl<string | undefined>('all');
  const sportFilter = useFormControl<string | undefined>('all');
  const categoryFilter = useFormControl<string | undefined>('all');
  const sexFilter = useFormControl<string | undefined>('all');

  const [readiness, setReadiness] = useState<ReadinessFilter>('READY');
  // Con `formControl` y no con `value`: la prop suelta fija el valor pero deja el campo EN
  // BLANCO, así que el control no decía qué tamaño estaba puesto.
  const pageSizeControl = useFormControl<number | undefined>(PAGE_SIZE_DEFAULT);
  const pageSize = pageSizeControl.value ?? PAGE_SIZE_DEFAULT;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const [people, setPeople] = useState<ReadyParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Si ya se pintó la pantalla alguna vez. Con esto se separa la PRIMERA carga —que no
  // tiene nada que enseñar y merece su bloque de espera— de las recargas por filtro, que sí
  // lo tienen. Ver renderCatalog.
  const yaCargo = useRef(false);
  const [error, setError] = useState<unknown>();
  const [reload, setReload] = useState(0);

  // Las delegaciones que de verdad hay en la fase, para no ofrecer un filtro vacío. Sale de UNA
  // petición de la página grande —el tope del contrato son 100— y no de la página que se está
  // viendo, que daría un desplegable distinto en cada página.
  //
  // Por encima de 100 acreditables la lista queda incompleta. Es el precio de no tener un
  // endpoint de facetas; se prefiere eso a deducirla de diez filas.
  const [departments, setDepartments] = useState<[string, string][]>([]);
  const [municipalities, setMunicipalities] = useState<[string, string][]>([]);
  const [sports, setSports] = useState<[string, string][]>([]);
  const [categories, setCategories] = useState<EventRoleCatalogItem[]>([]);
  const [regions, setRegions] = useState<EventRoleCatalogItem[]>([]);
  // Qué departamentos caen en cada región. Es el cruce que permite encadenar los dos
  // desplegables; no puebla ninguno de los dos.
  const [regionOf, setRegionOf] = useState<Record<string, string>>({});

  // Cuántos hay en cada pestaña CON LOS FILTROS PUESTOS.
  //
  // Antes se pedían sin ellos, para que la pestaña siguiera diciendo cuántos acreditables hay
  // aunque el filtro de turno dejara la tabla en cero. Pero al llegar el filtro de
  // «Acreditación» —que sí movía el número, porque la sonda tiene que ir con el mismo
  // `exclude_accredited` que la tabla o dirían cosas distintas— el número pasó a cambiar con
  // UN filtro y con los otros siete no, y así no se puede saber qué está contando. Lo reportó
  // Andrés.
  //
  // Ahora cuenta lo que se está viendo, siempre, y los dos números vienen en el `counts` del
  // propio listado: sin sonda.
  const [tabCounts, setTabCounts] = useState<Record<ReadinessFilter, number>>({
    READY: 0,
    PENDING: 0
  });

  // Cómo se llama cada rol EN ESTE EVENTO. El código crudo —ATHLETE, DELEGADO— es la identidad
  // de cara al servidor y a quien usa la pantalla no le dice nada; ya lo reportó QA.
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  // Los tipos del evento enteros. El mapa de nombres de arriba se queda porque es lo que usa
  // la tabla y el CSV, pero para elegir el tipo de una fila hacen falta `platformRole`,
  // `platformSubrole` e `isActive`, que ahí no caben.
  const [types, setTypes] = useState<AccreditedType[]>([]);
  // Distingue «todavía no cargaron» de «no hay ninguno»: la fila de un momento nuevo nace sin
  // tipos, y acreditar ahí fallaba con el mensaje crudo del backend.
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [typesFailed, setTypesFailed] = useState(false);
  // Sube con «Reintentar»: vuelve a pedir el catálogo sin recargar la página.
  const [typesReload, setTypesReload] = useState(0);
  const navigate = useNavigate();

  // Los nombres en español de los roles que el evento no tiene configurados como tipo.
  const { labelOf: labelOfCatalogo } = useRoleCatalogLabels();

  // Las familias, para el filtro «Tipo». Sin `event_id`: las cuatro son las mismas en todos
  // los eventos y así el desplegable está listo sin esperar a que se elija uno.
  const [familias, setFamilias] = useState<RoleCatalogFamily[]>([]);
  const [sinCatalogo, setSinCatalogo] = useState(false);

  // El fallo NO se traga: de este catálogo dependen «Tipo» y «Función», así que caer en
  // silencio dejaría dos desplegables vacíos sin decir por qué. Lo reportó Juan Ma.
  useEffect(() => {
    let vivo = true;

    familyRepository
      .requestFamilies()
      .then((lista: RoleCatalogFamily[]) => {
        if (vivo) {
          setFamilias(lista);
          setSinCatalogo(!lista.length);
        }
      })
      .catch((reason) => {
        if (vivo) {
          setSinCatalogo(true);
          toast({
            theme: 'warning',
            title: 'No pudimos cargar los tipos de acreditado',
            message: getApiErrorMessage(
              reason,
              'Los filtros de tipo y función quedan sin opciones. Recarga la página.'
            )
          });
        }
      });

    return () => {
      vivo = false;
    };
  }, [toast]);

  // El rótulo lo dice, además del toast: ese se va solo y quien llegue después vería un
  // desplegable vacío sin explicación.
  const typeFilterOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      sinCatalogo
        ? { ...TYPE_FILTER_ALL, label: 'Tipo (no se pudo cargar)' }
        : TYPE_FILTER_ALL,
      ...familias.map((familia) => ({
        key: familia.code,
        label: familia.name,
        value: familia.code
      }))
    ],
    [familias, sinCatalogo]
  );

  const phaseCode = phase?.code ?? '';

  // Va DESPUÉS de `phaseCode`: arriba, la constante todavía está en su región muerta y el
  // componente reventaba con «Cannot access 'phaseCode' before initialization».
  //
  // Acreditar desde esta pantalla mueve el contador de generadas, así que comparte el mismo
  // `reload` que recarga la tabla.
  const counters = useAccreditationCounters(
    event.code,
    phaseCode,
    reload,
    phase?.momentCode
  );

  useEffect(() => {
    let alive = true;

    // Sin los tipos del momento anterior: hasta que cargue el catálogo nuevo no se acredita
    // con tipos de otra fila.
    setTypes([]);
    setTypesLoaded(false);
    setTypesFailed(false);
    setRoleNames({});

    // Si el catálogo no carga, la fila enseña la traducción del rol de plataforma y, en último
    // caso, el código: es preferible a dejar la columna vacía.
    typeRepository
      .requestAll({ event_id: eventId, limit: 100 })
      .then((list) => {
        if (alive) {
          setTypes(list.items);
          setTypesLoaded(true);
          setRoleNames(
            Object.fromEntries(
              list.items.map((type) => [type.roleCode, type.typeName])
            )
          );
        }
      })
      // Sin catálogo no se sabe si faltan tipos: se avisa y se bloquea acreditar en vez de
      // dejar que el backend responda con su error crudo.
      .catch(() => {
        if (alive) {
          setTypesFailed(true);
        }
      });

    // Los cuatro diccionarios que las facetas no dan. Cada uno con su `catch`: si falla el de
    // regiones no se puede quedar sin funciones el desplegable de al lado.
    //
    // Categorías y funciones de apoyo son diccionarios generales; las funciones de misión son
    // POR EVENTO —cada evento inscribe las suyas— y por eso van con `eventId`.
    roleCatalogRepository
      .requestSportCategories()
      .then((list) => alive && setCategories(list))
      .catch(() => undefined);

    locationRepository
      .requestRegions()
      .then((list) => alive && setRegions(list))
      .catch(() => undefined);

    // El cruce departamento→región. Se pide una vez y no por región elegida: son 33 filas y así el
    // desplegable de delegación puede recortarse sin otra ida al servidor.
    locationRepository
      .requestDepartments()
      .then(
        (list) =>
          alive &&
          setRegionOf(
            Object.fromEntries(list.map((one) => [one.code, one.regionCode]))
          )
      )
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [eventId, typesReload]);

  /**
   * Cómo se llama un rol en pantalla, en orden de preferencia:
   *
   * 1. el nombre que **este evento** le puso a su tipo, que es el que manda si alguien lo
   *    renombró a propósito;
   * 2. el del **diccionario del backend** (`Voluntario`, `Periodista`, `Jefe de Misión`…);
   * 3. `formatCodeLabel`, que traduce los roles de plataforma y, si no conoce el código, lo
   *    escribe para que se lea.
   *
   * El tercer paso es un último respaldo y NO un traductor: con un código en inglés devuelve el
   * código en inglés partido por sus guiones —«Special guest», «Federation president»—, que es
   * justo lo que reportó QA. Ese paso solo debería verse con un código que no esté en ningún
   * catálogo; si eso pasa, falta la entrada en el backend, no un mapa acá.
   */
  const roleLabelOf = useCallback(
    (code: string) => roleNames[code] ?? labelOfCatalogo(code),
    [roleNames, labelOfCatalogo]
  );

  // Los transversales que ofrece la pantalla. Van juntos porque el gateway los resuelve en una
  // sola consulta a orc: la delegación (región, departamento y municipio), el deporte y la
  // categoría de la inscripción, y el sexo de la persona.
  //
  // LA REGIÓN SOLO VIAJA SI NO HAY DELEGACIÓN ELEGIDA, y no es un detalle: mandar las dos es una
  // UNIÓN, no una intersección. Medido contra staging —`region_codes=6&department_codes=76`
  // devolvió 29 filas, las de las dos regiones juntas, no 0—, así que quien elige «Caribe 1» y
  // luego «Valle del Cauca» vería MÁS gente, no menos. Como el desplegable de delegación ya
  // está recortado a la región, mandar solo el departamento dice lo mismo y no miente.
  const transversal = useMemo(() => {
    const region = regionFilter.value && regionFilter.value !== 'all';
    const delegacion = departmentFilter.value && departmentFilter.value !== 'all';

    const activos: ReadyTransversalFilters = {
      ...(delegacion
        ? { department_codes: departmentFilter.value }
        : region
          ? { region_codes: regionFilter.value }
          : {}),
      ...(municipalityFilter.value && municipalityFilter.value !== 'all'
        ? { municipality_codes: municipalityFilter.value }
        : {}),
      ...(sportFilter.value && sportFilter.value !== 'all'
        ? { sport_codes: sportFilter.value }
        : {}),
      ...(categoryFilter.value && categoryFilter.value !== 'all'
        ? { category_codes: categoryFilter.value }
        : {}),
      ...(sexFilter.value && sexFilter.value !== 'all'
        ? { sex_codes: sexFilter.value }
        : {})
    };

    return Object.keys(activos).length ? activos : undefined;
  }, [
    regionFilter.value,
    departmentFilter.value,
    municipalityFilter.value,
    sportFilter.value,
    categoryFilter.value,
    sexFilter.value
  ]);

  const excludeAccredited = accreditationFilter.value === 'pending';
  // La vista inversa. Nunca junto con la de arriba: el desplegable tiene un valor a la vez, y
  // mandar los dos sería el 400 del backend —no dejan a nadie—.
  const onlyAccredited = accreditationFilter.value === 'accredited';

  const filters = useMemo(
    () => ({
      readiness,
      // La UNIÓN por defecto; «Por acreditar» resta los acreditados y «Ya acreditados» deja
      // solo a esos. Ver ACCREDITATION_FILTER_OPTIONS.
      excludeAccredited,
      ...(onlyAccredited ? { onlyAccredited } : {}),
      ...(query ? { search: query } : {}),
      // `roles` y NO `user_role`: los dos funcionan hoy —medido—, pero solo el plural sabe
      // nombrar al personal de misión. Se manda UNO de los dos, nunca los dos: si algún día
      // discreparan, el resultado sería indefinido y el gateway no se quejaría.
      ...(typeFilter.value && typeFilter.value !== 'all'
        ? { roles: typeFilter.value }
        : {}),
      ...(functionFilter.value && functionFilter.value !== 'all'
        ? { subroleCodes: functionFilter.value }
        : {}),
      ...(transversal ? { transversal } : {}),
      // Con fase dividida en momentos, la lista es la del momento: deportistas y apoyo de
      // sus deportes, su personal de misión y todo el personal Naowee.
      ...(phase?.momentCode ? { momentCode: phase.momentCode } : {})
    }),
    [
      readiness,
      excludeAccredited,
      onlyAccredited,
      query,
      typeFilter.value,
      functionFilter.value,
      transversal,
      phase?.momentCode
    ]
  );

  // La página vale solo para los filtros con que se eligió; con otros es la 1 en ese mismo
  // render. Un efecto que la reseteara pedía antes la página vieja con los filtros nuevos.
  const [paging, setPaging] = useState({ page: 1, filters, pageSize });
  const page =
    paging.filters === filters && paging.pageSize === pageSize
      ? paging.page
      : 1;
  const setPage = useCallback(
    (next: number) => setPaging({ page: next, filters, pageSize }),
    [filters, pageSize]
  );

  // Al cambiar cualquier filtro se vuelve a la página 1 y se suelta la selección: mantener
  // marcados a los que ya no se ven daría un «Acreditar (N)» que nadie puede auditar.
  useEffect(() => {
    setSelected(new Set());
  }, [filters, pageSize]);

  // Y PAGINAR también la suelta, por el mismo motivo. Faltaba, y el hueco se veía: el botón
  // cuenta `selected.size` —todas las páginas— pero `onAccreditSelected` emite
  // `selectedPeople`, que filtra contra `people`, o sea solo la página actual. Con marcados
  // arrastrados de otra página el botón decía «Acreditar (11)» y la petición llevaba 10, sin
  // avisar de que uno se quedaba fuera.
  //
  // Se suelta en vez de acumular a propósito, que es la misma decisión que ya tomaba el modal
  // del mostrador: acreditar en bloque a gente que no estás viendo es una acción que nadie
  // puede auditar antes de pulsar. Si algún día se quiere acumular entre páginas, hay que
  // guardar a las PERSONAS y no solo sus ids, y enseñar en algún sitio a quién se va a
  // acreditar.
  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    if (!event.code || !phaseCode) {
      return;
    }

    let alive = true;

    setLoading(true);
    setError(undefined);

    personRepository
      .requestReady(event.code, phaseCode, {
        ...filters,
        limit: pageSize,
        page
      })
      .then((result) => {
        if (alive) {
          setPeople(result.items);
          setTotal(result.total);
          // El backend trae los dos conteos con los mismos filtros; sin ellos, solo el total.
          setTabCounts((current) =>
            result.counts
              ? result.counts
              : { ...current, [readiness]: result.total }
          );
          setLoading(false);
          yaCargo.current = true;
        }
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
  }, [event.code, phaseCode, filters, page, pageSize, reload]);

  useEffect(() => {
    if (!event.code || !phaseCode) {
      return;
    }

    let alive = true;

    const rol =
      typeFilter.value && typeFilter.value !== 'all'
        ? typeFilter.value
        : undefined;

    // Las opciones de los desplegables salen del endpoint de facetas: UNA consulta agregada
    // en orc. Antes se deducían de la primera página de 100 filas, y con más de 100
    // acreditables el desplegable omitía valores —además de obligar a documentation-ms a
    // cargar todos los candidatos en memoria para responder esa página—.
    //
    // Si falla, la pantalla se usa igual: los desplegables se quedan sin opciones.
    personRepository
      .requestFacets(event.code, phaseCode, rol)
      .then((facetas) => {
        if (!alive) {
          return;
        }

        const opciones = (lista: ParticipantFacet[]): [string, string][] =>
          lista.map((facet) => [facet.code, facet.label]);

        setDepartments(opciones(facetas.departments));
        setMunicipalities(opciones(facetas.municipalities));
        setSports(
          opciones(phase ? phase.keepMomentSports(facetas.sports) : facetas.sports)
        );
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
    // `typeFilter.value` entra acá porque las facetas se piden acotadas al rol: al cambiar
    // de tipo, los desplegables tienen que volver a pedirse.
  }, [event.code, phaseCode, phase, typeFilter.value]);

  const regionOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      { key: 'all', label: 'Región', value: 'all' },
      ...regions.map((one) => ({
        key: one.code,
        label: one.name,
        value: one.code
      }))
    ],
    [regions]
  );

  // Cómo se llama en pantalla la ZONA de una delegación.
  //
  // La región no es una columna de la fila y no se puede pedir: el backend la traduce a
  // departamentos al filtrar y nunca la devuelve. Sale de componer los dos diccionarios que la
  // cascada de los desplegables ya trae —`regionOf` da departamento→código de zona, `regions`
  // da código→nombre—, así que la columna no cuesta ni una petición más.
  //
  // Devuelve cadena vacía y no una raya cuando no hay cruce: quien pinta decide cómo se lee un
  // hueco, y en esta tabla los huecos van con el mismo `SIN_DATO` que el resto. Pasa mientras
  // los dos diccionarios están en vuelo, y también con una delegación sin zona en el catálogo.
  const regionLabelOf = useCallback(
    (departmentCode: string) =>
      regions.find((one) => one.code === regionOf[departmentCode])?.name ?? '',
    [regions, regionOf]
  );

  // La delegación, RECORTADA A LA REGIÓN elegida. Es la mitad visible de la cascada: la otra es
  // que el transversal manda una sola de las dos (ver `transversal`).
  //
  // Se recorta sobre las facetas y no sobre el catálogo del país: las facetas son lo que de
  // verdad hay en la fase, y ofrecer un departamento vacío es peor que no ofrecerlo.
  const departmentOptions = useMemo<NwtSelectOption<string>[]>(() => {
    const region = regionFilter.value;
    const dentro =
      region && region !== 'all'
        ? departments.filter(([code]) => regionOf[code] === region)
        : departments;

    return [
      { key: 'all', label: 'Delegación', value: 'all' },
      ...dentro.map(([code, name]) => ({
        key: code,
        label: name,
        value: code
      }))
    ];
  }, [departments, regionFilter.value, regionOf]);

  // Y si la delegación elegida se queda fuera de la región nueva, se suelta: dejarla marcada
  // enseñaría un desplegable que dice una cosa y una tabla que trae otra.
  useEffect(() => {
    const region = regionFilter.value;
    const elegida = departmentFilter.value;

    if (
      region &&
      region !== 'all' &&
      elegida &&
      elegida !== 'all' &&
      regionOf[elegida] !== region
    ) {
      departmentFilter.setValue('all');
    }
    // `departmentFilter` es estable entre renders y no entra en las dependencias.
  }, [regionFilter.value, departmentFilter.value, regionOf]);

  // La FUNCIÓN, y solo cuando puede recortar algo: un deportista no tiene función, así que con
  // «Tipo: todos» o «Deportista» el filtro devolvería siempre cero. Un desplegable que no
  // recorta nada es peor que no tenerlo.
  // Las de la familia elegida, y el catálogo dice cuáles son: antes eran dos peticiones más y
  // un ternario con las dos únicas familias que existían entonces.
  const functionOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      { key: 'all', label: 'Función', value: 'all' },
      ...(
        familias.find((familia) => familia.code === typeFilter.value)
          ?.functions ?? []
      ).map((funcion) => ({
        key: funcion.code,
        label: funcion.name,
        value: funcion.code
      }))
    ],
    [typeFilter.value, familias]
  );

  const hayFuncion = functionOptions.length > 1;

  // Al cambiar de tipo, la función elegida deja de tener sentido: se suelta.
  useEffect(() => {
    functionFilter.setValue('all');
    // `functionFilter` es estable entre renders y no entra en las dependencias.
  }, [typeFilter.value]);

  const categoryOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      { key: 'all', label: 'Categoría', value: 'all' },
      ...categories.map((one) => ({
        key: one.code,
        label: one.name,
        value: one.code
      }))
    ],
    [categories]
  );

  // Municipio y deporte se ofrecen igual que la delegación: solo lo que de verdad hay en la
  // fase, para no dejar filtrar por algo que devolvería siempre vacío.
  const municipalityOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      { key: 'all', label: 'Municipio', value: 'all' },
      ...municipalities.map(([code, name]) => ({
        key: code,
        label: name,
        value: code
      }))
    ],
    [municipalities]
  );

  const sportOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      { key: 'all', label: 'Deporte', value: 'all' },
      ...sports.map(([code, name]) => ({ key: code, label: name, value: code }))
    ],
    [sports]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Los dos avisos de quién queda FUERA con los filtros de la pantalla. No son cosmética: es
  // la única señal de que la lista está escondiendo gente por cómo está hecho el cruce en orc,
  // y sin ellos parece que esa gente no existe.
  //
  // El de competencia está MEDIDO en este endpoint, no heredado de oídas: sobre una fase con 4
  // de apoyo, `sport_codes=ATL` devolvió 4 filas y las cuatro deportistas —el apoyo desapareció
  // aunque uno de ellos tiene ATL entre sus deportes—. Deporte y categoría salen de la
  // inscripción deportiva, que solo tienen los deportistas.
  const filtroDeCompetencia =
    (!!sportFilter.value && sportFilter.value !== 'all') ||
    (!!categoryFilter.value && categoryFilter.value !== 'all');

  // El de territorio NO está medido acá: en staging no hay personal de misión en ningún evento,
  // así que no hay con qué comprobarlo. Se conserva porque el mecanismo es el mismo que ya está
  // medido en el listado de acreditaciones —el personal de misión no tiene delegación
  // registrada— y avisar de más es más barato que esconder gente en silencio.
  const filtroDeTerritorio =
    (!!regionFilter.value && regionFilter.value !== 'all') ||
    (!!departmentFilter.value && departmentFilter.value !== 'all') ||
    (!!municipalityFilter.value && municipalityFilter.value !== 'all');

  const onToggle = useCallback((person: ReadyParticipant) => {
    setSelected((current) => {
      const next = new Set(current);
      const id = String(person.id);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  // Los de ESTA página a los que se puede acreditar, que ya no son todos: con la unión, la
  // lista trae también a quien ya tiene su acreditación activa.
  //
  // Tiene que ser esta lista y no `people` entera, o el checkbox de cabecera se queda en
  // indeterminado para siempre: `selectedOnPage === pageIds.length` sería inalcanzable en
  // cuanto una fila no se pueda marcar.
  const selectableIds = useMemo(
    () =>
      people
        .filter((person) => person.accreditable)
        .map((person) => String(person.id)),
    [people]
  );

  const selectedOnPage = selectableIds.filter((id) => selected.has(id)).length;

  const allChecked =
    selectableIds.length > 0 && selectedOnPage === selectableIds.length
      ? true
      : selectedOnPage > 0
        ? undefined
        : false;

  const onToggleAll = useCallback(() => {
    setSelected((current) =>
      selectableIds.length > 0 && selectableIds.every((id) => current.has(id))
        ? new Set<string>()
        : new Set(selectableIds)
    );
  }, [selectableIds]);

  const onEmitted = useCallback(() => {
    setSelected(new Set());
    setReload((current) => current + 1);
  }, []);

  // ── El carnet que quedó encolado al acreditar ──────────────────────────────────────────
  //
  // Acreditar responde 202: las acreditaciones ya están y el PDF se encola. Acá se sigue hasta
  // que salga, en vez de mandar al operador a otra pantalla a ver si apareció.
  const [loteEncolado, setLoteEncolado] = useState<CardBatch | null>(null);
  // Por qué NO hay lote, cuando no lo hay. No es un error: o no se acreditó a nadie, o nadie
  // tiene foto aprobada —y en ese caso las acreditaciones sí quedaron creadas—.
  const [sinLote, setSinLote] = useState<string | null>(null);
  // Cuántos se acreditaron en la última emisión. Distingue «no se acreditó a nadie» de «se
  // acreditó a todos pero ninguno tiene foto»: los dos llegan sin lote y no significan lo mismo.
  const [acreditados, setAcreditados] = useState(0);

  const onCardBatch = useCallback(
    (batch: CardBatch | null, motivo: string | null, cuantos: number) => {
      setLoteEncolado(batch);
      setSinLote(motivo);
      setAcreditados(cuantos);
    },
    []
  );

  const { emit, working } = useAccreditEmission({
    eventId,
    onEmitted,
    onCardBatch
  });

  // El POST del lote YA ocurrió —vino dentro del 202 de acreditar—, así que se le da a
  // `useCardBatch` el lote ya resuelto: se salta su petición y entra directo al ciclo de
  // espera. Con eso se reutilizan enteros los estados, la cadencia (12 intentos de 2,5 s y
  // luego de 10 s, ~16 min), que el PDF no se abra solo —el gesto ya se perdió y Chrome lo
  // bloquearía— y que la URL prefirmada se firme en el clic que sí lo abre.
  const cards = useCardBatch(
    loteEncolado ? () => Promise.resolve(loteEncolado) : undefined,
    loteEncolado ? String(loteEncolado.id) : undefined
  );

  // `generate` por referencia: entra en el efecto sin rearmarlo en cada render.
  const generarRef = useRef(cards.generate);

  generarRef.current = cards.generate;

  useEffect(() => {
    if (loteEncolado) {
      generarRef.current();
    }
  }, [loteEncolado]);

  const generandoCarnets =
    cards.status === 'requesting' || cards.status === 'generating';

  const onAbrirCarnets = useCallback(() => {
    cards.open().catch(() =>
      toast({
        title: 'No se pudo abrir el lote',
        message: 'El PDF se generó pero el almacenamiento no lo entregó.',
        icon: 'caution',
        theme: 'negative'
      })
    );
  }, [cards, toast]);

  // Y al emitir se vuelve a filtrar por `accreditable`: la fila deshabilitada ya lo impide,
  // pero una selección puede sobrevivir a una recarga de fondo que cambie el estado de alguien.
  // Es defensa en profundidad contra el 409, no una segunda regla.
  const selectedPeople = useMemo(
    () =>
      people.filter(
        (person) => selected.has(String(person.id)) && person.accreditable
      ),
    [people, selected]
  );

  // El tipo del evento que le toca a cada candidato, resuelto acá porque es esta pantalla la
  // que tiene los tipos cargados. Sin esto el ítem viajaba con el rol de PLATAFORMA y todo el
  // personal de apoyo se acreditaba con el mismo tipo genérico, fuera entrenador o asistente.
  const roleByCandidate = useCallback(
    (people: ReadyParticipant[]) =>
      Object.fromEntries(
        people.flatMap((one) => {
          // `types` va SIN filtrar a propósito: `resolveAccreditedTypeCode` descarta los
          // inactivos en su primera línea y sus tres ramas buscan sobre esa lista, así que
          // nunca puede devolver el código de uno inactivo. Se deja dicho porque se ha
          // leído como un hueco más de una vez.
          const code = resolveAccreditedTypeCode(one, types);

          return code ? [[String(one.id), code]] : [];
        })
      ),
    [types]
  );

  // Quien tiene más de una función que el evento acredite (entrenador en un deporte y
  // asistente en otro) no se acredita con la primera que casa: se le pregunta el tipo a quien
  // acredita. Mientras el modal está abierto, `pendingAccredit` guarda a quiénes se iba a
  // acreditar para emitirlos todos juntos al confirmar.
  const [pendingAccredit, setPendingAccredit] = useState<{
    candidates: ReadyParticipant[];
    choices: SupportRoleChoice[];
  }>();

  const withoutTypes = typesLoaded && types.length === 0;

  const accredit = useCallback(
    (candidates: ReadyParticipant[]) => {
      if (typesFailed) {
        toast({
          title: 'No se pudieron cargar los tipos de acreditado',
          message: 'Usa «Reintentar» en el aviso de la lista.',
          icon: 'caution',
          theme: 'negative'
        });

        return;
      }

      if (withoutTypes) {
        toast({
          title: 'Faltan los tipos de acreditado',
          message:
            'Configura los tipos de acreditado de esta fase o momento antes de acreditar.',
          icon: 'caution',
          theme: 'negative'
        });

        return;
      }

      const automaticos = roleByCandidate(candidates);

      // Una fila por persona: con selector quien tiene varios tipos posibles, y con su tipo
      // en texto el resto, para que quien acredita vea con qué va cada uno antes de confirmar.
      const choices: SupportRoleChoice[] = candidates.map((person) => {
        const code = automaticos[String(person.id)] ?? person.roleCode;

        return {
          person,
          options: accreditedTypeOptions(person, types),
          roleName: roleLabelOf(code)
        };
      });

      if (choices.some((choice) => choice.options.length > 1)) {
        setPendingAccredit({ candidates, choices });

        return;
      }

      emit({ candidates, roleByCandidate: automaticos });
    },
    [
      emit,
      roleByCandidate,
      roleLabelOf,
      toast,
      types,
      typesFailed,
      withoutTypes
    ]
  );

  const onAccreditOne = useCallback(
    (person: ReadyParticipant) => accredit([person]),
    [accredit]
  );

  const onAccreditSelected = useCallback(
    () => accredit(selectedPeople),
    [accredit, selectedPeople]
  );

  const onCancelPick = useCallback(() => setPendingAccredit(undefined), []);

  // Lo elegido a mano gana sobre lo que resolvió la pantalla.
  const onConfirmPick = useCallback(
    (roles: Record<string, string>) => {
      if (!pendingAccredit) {
        return;
      }

      setPendingAccredit(undefined);

      // Mientras el modal estuvo abierto la lista pudo recargarse: se vuelve a filtrar por
      // `accreditable` contra el estado ACTUAL de las filas, igual que `selectedPeople`, para
      // no emitir a alguien que otro ya acreditó en ese rato. Quien ya no está en la página se
      // deja pasar: su estado no se conoce acá y el backend lo descarta si ya está acreditado.
      const vigentes = new Map(people.map((one) => [String(one.id), one]));

      const candidates = pendingAccredit.candidates.filter(
        (one) => vigentes.get(String(one.id))?.accreditable ?? true
      );

      const fuera = pendingAccredit.candidates.length - candidates.length;

      if (fuera) {
        toast({
          title: candidates.length
            ? 'Algunas personas ya no se pueden acreditar'
            : 'Ya no hay a quién acreditar',
          message:
            fuera === 1
              ? 'Una de las personas cambió de estado mientras elegías el tipo y se dejó fuera.'
              : `${fuera} personas cambiaron de estado mientras elegías el tipo y se dejaron fuera.`,
          icon: 'caution',
          theme: 'warning'
        });
      }

      if (!candidates.length) {
        return;
      }

      emit({
        candidates,
        roleByCandidate: { ...roleByCandidate(candidates), ...roles }
      });
    },
    [emit, pendingAccredit, people, roleByCandidate, toast]
  );

  const onDownloadReport = useCallback(async () => {
    setDownloading(true);

    try {
      const rows = await personRepository.requestAllReady(
        event.code,
        phaseCode,
        filters
      );

      downloadCsv(
        'lista-de-acreditables.csv',
        ['Tipo', 'Nombre', 'Documento', 'Delegación', 'Documentación'],
        // La misma etiqueta que la tabla, y no solo por coherencia: el CSV se usa para reclamar
        // acreditaciones, y decir «Personal de apoyo» donde la pantalla dice «Docente/Entrenador»
        // convierte los dos en sospechosos.
        rows.map((person) => [
          person.supportRoleLabel || roleLabelOf(person.roleCode),
          person.fullName,
          person.document,
          person.departmentName,
          person.requirementsLabel
        ])
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setDownloading(false);
    }
  }, [event.code, phaseCode, filters, roleLabelOf]);

  function renderCatalog() {
    // El bloque de espera SOLO en la primera carga.
    //
    // Antes salía en cualquier carga, y como reemplaza la tarjeta entera —pestañas,
    // buscador, los cuatro desplegables y la tabla— cada búsqueda desmontaba el campo en el
    // que estabas escribiendo. Medido: al teclear cinco letras el buscador se desmonta y el
    // foco cae a `<body>`, así que lo que sigas escribiendo no llega a ninguna parte. Lo
    // reportó Andrés como «se refresca mucho», y era eso.
    //
    // Con la pantalla ya pintada, refiltrar solo cambia la TABLA: lo demás se queda quieto
    // y el cursor donde estaba.
    if (loading && !yaCargo.current) {
      return (
        <NwsLoading>
          <h4>Cargando acreditables, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (error) {
      return (
        <NwsRequestError
          error={error}
          title="No pudimos cargar los acreditables"
          onRetry={() => setReload((current) => current + 1)}
        />
      );
    }

    return (
      <NwtCard className="nws-enabled-list__catalog">
        {/* Un toggle centrado y no un enlace: son dos vistas del mismo listado, y cada lado
            dice cuántos hay —que es lo que se pregunta antes de cambiar de vista—. */}
        <NwtTagGroup<ReadinessFilter>
          className="nws-enabled-list__scope"
          items={[
            {
              // Decía «Acreditables (N)» y con la unión eso ya no es verdad: en esta lista
              // entran también los que YA están acreditados, que no se pueden acreditar otra
              // vez. El eje de la pestaña siempre fue la DOCUMENTACIÓN; ahora lo dice.
              id: 'acreditables',
              label: `Documentación aprobada (${tabCounts.READY})`,
              value: 'READY'
            },
            {
              id: 'incompletos',
              label: `Documentación incompleta (${tabCounts.PENDING})`,
              value: 'PENDING'
            }
          ]}
          value={readiness}
          onChange={(value) => {
            setReadiness(value);
            setPage(1);
            setSelected(new Set());
          }}
        />

        {typesFailed && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            <span className="nws-delivery__types-missing">
              <span>
                No se pudieron cargar los tipos de acreditado de{' '}
                {phase?.momentCode ? 'este momento' : 'esta fase'}, así que no
                se puede acreditar.
              </span>
              <NwtButton
                nwtVariant="mute"
                nwtSize="small"
                onClick={() => setTypesReload((value) => value + 1)}
              >
                Reintentar
              </NwtButton>
            </span>
          </NwtAlert>
        )}

        {withoutTypes && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            <span className="nws-delivery__types-missing">
              <span>
                {phase?.momentCode ? 'Este momento' : 'Esta fase'} todavía no
                tiene tipos de acreditado configurados, así que no se puede
                acreditar a nadie. Cada momento lleva los suyos.
              </span>
              <NwtButton
                nwtVariant="mute"
                nwtSize="small"
                onClick={() => navigate('/parametrization/accredited-types')}
              >
                Configurar tipos de acreditado
              </NwtButton>
            </span>
          </NwtAlert>
        )}

        {readiness === 'PENDING' && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            A estos les falta documentación por aprobar, así que no se les puede
            acreditar todavía. La columna «Documentos» dice cuánta lleva
            aprobada cada uno, y la de «Estado», si ya tuvo una antes.
          </NwtAlert>
        )}

        <div className="nws-delivery__filters">
          <div className="nws-delivery__search">
            <NwtSearchbox
              formControl={search}
              placeholder="Buscar por nombre o documento"
            />

            <NwtDropdown
              formControl={typeFilter}
              options={typeFilterOptions}
            />

            <NwtDropdown
              formControl={accreditationFilter}
              options={ACCREDITATION_FILTER_OPTIONS}
            />

            {/* La función solo cuando el tipo elegido tiene funciones. Ver `functionOptions`. */}
            {hayFuncion && (
              <NwtDropdown
                formControl={functionFilter}
                options={functionOptions}
              />
            )}

            <NwtDropdown formControl={regionFilter} options={regionOptions} />

            <NwtDropdown
              formControl={departmentFilter}
              options={departmentOptions}
            />

            <NwtDropdown
              formControl={municipalityFilter}
              options={municipalityOptions}
            />

            <NwtDropdown formControl={sportFilter} options={sportOptions} />

            <NwtDropdown
              formControl={categoryFilter}
              options={categoryOptions}
            />

            <NwtDropdown formControl={sexFilter} options={SEX_FILTER_OPTIONS} />
          </div>

          <div className="nws-page-size">
            {/* Cuántas se pueden acreditar de una vez: la selección se suelta al paginar, así
                que el tamaño de página es el techo del lote. */}
            {/* La página vuelve a 1 ACÁ y no en un efecto: los dos efectos corren en el
                mismo commit, y el del efecto llegaba tarde —salía una petición de más. */}
            <NwtDropdown
              formControl={pageSizeControl}
              nwtSize="small"
              options={PAGE_SIZE_OPTIONS}
              onChange={() => setPage(1)}
            />

            <NwtPagination
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
              nwtSize="small"
            />
          </div>
        </div>

        {/* Quién queda fuera con los filtros puestos. Excluyentes a propósito: con los dos a la
            vez son dos alertas seguidas que dicen casi lo mismo, y la de competencia es la que
            esconde a más gente. */}
        {filtroDeCompetencia ? (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            Deporte y categoría vienen de la inscripción deportiva, que solo
            tienen los deportistas: con estos filtros no vas a ver al personal
            de apoyo ni al de misión. Para verlos, filtra por Tipo.
          </NwtAlert>
        ) : (
          filtroDeTerritorio && (
            <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
              El personal de misión no tiene delegación registrada, así que con
              región, departamento o municipio no vas a verlo. Para verlo, filtra
              por Tipo.
            </NwtAlert>
          )
        )}

        {/* Recargando con la pantalla ya puesta: se avisa ACÁ y no reemplazando la tarjeta,
            que es lo que desmontaba el buscador. `aria-busy` es lo que lo anuncia a un lector
            de pantalla; el arnés también lo usa para esperar a que la tabla esté quieta. */}
        {loading ? (
          <div className="nws-enabled-list__reloading" aria-busy="true">
            <NwsLoading>
              <small className="nwt-smalltext-font-regular">Filtrando…</small>
            </NwsLoading>
          </div>
        ) : people.length ? (
          <EnabledListTable
            allChecked={allChecked}
            canManage={canManage}
            people={people}
            regionLabelOf={regionLabelOf}
            roleLabelOf={roleLabelOf}
            pending={readiness === 'PENDING'}
            selected={selected}
            working={working}
            onAccredit={onAccreditOne}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
          />
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title="Sin resultados"
            description={
              readiness === 'PENDING'
                ? 'Nadie de esta fase o momento tiene documentación pendiente.'
                : 'Ningún participante de esta fase o momento tiene la documentación aprobada.'
            }
            showAction={false}
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-delivery nws-enabled-list">
      {/* El evento, en su franja y a todo el ancho: en la fila del título no cabía y el
          nombre salía cortado. */}
      <NwsEventBar items={counters} />

      <div className="nws-delivery__content">
        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-extrabold">
              Gestión de acreditables
            </span>

            <small className="nwt-smalltext-font-regular">
              Los participantes de la fase, con su documentación y su
              acreditación
            </small>
          </div>

          <div className="nws-delivery__actions">
            <NwsReportLink
              disabled={downloading || !people.length}
              label={downloading ? 'Preparando...' : 'Descargar reporte'}
              onClick={onDownloadReport}
            />

            {/* Acreditar en bloque solo tiene sentido en la lista de acreditables. */}
            {canManage && readiness === 'READY' && (
              <NwtButton
                icon="add"
                nwtVariant="loud"
                nwtSize="medium"
                disabled={!selectedPeople.length || working}
                onClick={onAccreditSelected}
              >
                {/* Cuenta `selectedPeople`, que es EXACTAMENTE lo que viaja en la petición, y
                    no `selected.size`. Es la regresión que esta pantalla ya cerró una vez
                    —decía «Acreditar (11)» y mandaba 10—, y con la unión vuelve a ser posible:
                    una recarga de fondo puede dejar acreditado a alguien que estaba marcado. */}
                {selectedPeople.length
                  ? `Acreditar (${selectedPeople.length})`
                  : 'Acreditar'}
              </NwtButton>
            )}
          </div>
        </div>

        {/* Crear un acreditable desde acá no existe y nunca existió: la persona se registra en
            gestión de usuarios, con su foto y su documentación, y de ahí sale esta lista. El
            botón «Nuevo acreditado» que había antes escribía en un repositorio en memoria. */}
        {canManage && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            Esta lista sale de gestión de usuarios y del módulo de
            documentación: desde acreditaciones no se registra a nadie, solo se
            acredita.
          </NwtAlert>
        )}

        {/* ── El carnet que se encoló al acreditar ──────────────────────────────────────
            Acreditar responde 202: lo de acreditar ya terminó —eso lo dicen los avisos
            emergentes— y esto cuenta lo OTRO, que es el PDF. */}
        {generandoCarnets && (
          <NwtAlert nwtTheme="informative" icon="caution" visible={true}>
            Estamos generando{' '}
            {cards.batch?.totalCards ?? loteEncolado?.totalCards ?? 0}{' '}
            {(cards.batch?.totalCards ?? 0) === 1
              ? 'acreditación'
              : 'acreditaciones'}{' '}
            en un solo PDF. Tarda unos segundos; si sales, el PDF se sigue
            generando y lo encuentras en «Lotes de acreditaciones».
          </NwtAlert>
        )}

        {cards.status === 'ready' && !!cards.batch && (
          <NwtAlert nwtTheme="positive" icon="positive" visible={true}>
            El lote {cards.batch.label} está listo con{' '}
            {cards.batch.totalCards}{' '}
            {cards.batch.totalCards === 1
              ? 'acreditación'
              : 'acreditaciones'}
            .{' '}
            <NwtButton nwtVariant="quiet" nwtSize="small" onClick={onAbrirCarnets}>
              Abrir el PDF
            </NwtButton>
          </NwtAlert>
        )}

        {/* Quién se quedó SIN carnet, con su nombre y su motivo. Va acá y no en el detalle
            del lote porque solo viaja en el 202 de la generación: backend no lo persiste
            (SUV2-2531). Sustituye al aviso de «se generó sin foto», que ya no puede pasar. */}
        {!!cards.omitidos.length && (
          <NwtAlert nwtTheme="warning" icon="caution" visible={true}>
            {cards.omitidos.length === 1
              ? 'Un carnet del lote no se generó'
              : `${cards.omitidos.length} carnets del lote no se generaron`}
            :{' '}
            {cards.omitidos
              .map((omitido) =>
                `${omitido.label} (${cardSkipReasonLabel(omitido.reason)})`
              )
              .join(' · ')}
          </NwtAlert>
        )}

        {/* SIN lote no es un fallo, y por eso el backend responde 202 igual. Los dos casos se
            dicen distinto porque significan cosas opuestas: en uno no se acreditó a nadie, en
            el otro se acreditó a todos y lo único que falta es el PDF. Confundirlos diría que
            no se acreditó nadie justo cuando sí. */}
        {!!sinLote && !loteEncolado && (
          <NwtAlert
            nwtTheme={acreditados ? 'warning' : 'negative'}
            icon="caution"
            visible={true}
          >
            {acreditados
              ? `Se acreditó a ${acreditados}, pero el carnet no se generó: ${sinLote}`
              : `No se generó ningún carnet: ${sinLote}`}
          </NwtAlert>
        )}

        {cards.status === 'timeout' && (
          <NwtAlert nwtTheme="warning" icon="caution" visible={true}>
            El lote sigue generándose y dejamos de esperar. Lo encuentras en
            «Lotes de acreditaciones».
          </NwtAlert>
        )}

        {cards.status === 'failure' && (
          <NwtAlert nwtTheme="negative" icon="caution" visible={true}>
            {/* El motivo lo redacta el backend: «Ninguna acreditación del lote tiene foto
                aprobada», por ejemplo. */}
            {getApiErrorMessage(
              cards.error,
              'No pudimos generar el lote de acreditaciones.'
            )}
          </NwtAlert>
        )}

        {renderCatalog()}
      </div>

      <PickSupportRoleModal
        choices={pendingAccredit?.choices}
        onCancel={onCancelPick}
        onConfirm={onConfirmPick}
      />
    </section>
  );
}
