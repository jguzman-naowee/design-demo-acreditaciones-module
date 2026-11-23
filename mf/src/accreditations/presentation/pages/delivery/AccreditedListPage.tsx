import './DeliveryPages.scss';

import {
  ACCREDITATION_MANAGE,
  AccreditationPersonRepository,
  AccreditedTypeCatalogRepository,
  CardBatchMemberRepository,
  type EventRoleCatalogItem,
  EventRoleCatalogRepository,
  LocationRepository,
  SEX_LABELS
} from '@mf-accreditations/data';
import type {
  AccreditedType,
  CardBatchMemberRecord,
  ParticipantFacet
} from '@mf-accreditations/domain';
import { AccreditedRecord } from '@mf-accreditations/domain';
import {
  CREDENTIAL_ACTION_VISIBLE,
  formatDocumentNumber,
  normalizeText,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsRequestError,
  NwsRowActionsMenu,
  NwsSelectCheckBox,
  NwsStackedCell,
  NwsSuccessModal,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_OPTIONS,
  useSearchTerm
} from '@mf-accreditations/presentation';
import {
  usePaginationRepository,
  useSession
} from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtAvatarIcon,
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
  NwtSearchbox,
  NwtTooltip
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import { useAccreditedRecordActions } from './accredited-record-actions.hook';
import { DeliveryActionsButton } from './DeliveryActionsButton';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';

const repository = invertly(CardBatchMemberRepository);
// Las opciones de los desplegables salen de donde ya salen en las otras pantallas: facetas del
// evento para delegación, municipio y deporte; diccionarios para categoría y región; y los tipos
// del propio evento para el de Tipo. Ninguna lista se inventa acá.
const personRepository = invertly(AccreditationPersonRepository);
const typeRepository = invertly(AccreditedTypeCatalogRepository);
const catalogRepository = invertly(EventRoleCatalogRepository);
const locationRepository = invertly(LocationRepository);

const SIN_DATO = '—';

const STATUS_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Estado', value: 'all' },
  { key: 'ACTIVE', label: 'Activa', value: 'ACTIVE' },
  { key: 'INACTIVE', label: 'Inactiva', value: 'INACTIVE' }
];

const DELIVERY_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Entrega', value: 'all' },
  { key: 'DELIVERED', label: 'Entregada', value: 'DELIVERED' },
  { key: 'PENDING', label: 'Sin entregar', value: 'PENDING' }
];

// H = Hombre, M = Mujer. `M` es MUJER y no «masculino»: rotularlo al revés filtraría al revés
// y nadie lo notaría, porque los dos códigos devuelven filas.
const SEX_OPTIONS: NwtSelectOption<string>[] = [
  { key: 'all', label: 'Sexo', value: 'all' },
  ...Object.entries(SEX_LABELS).map(([value, label]) => ({
    key: value,
    label,
    value
  }))
];

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

interface AccreditedRowProps {
  canManage: boolean;
  // La zona del país de una delegación, ya resuelta por la página: la fila solo trae el nombre
  // del departamento y la región hay que deducirla. Ver `regionLabelOf`.
  regionLabelOf: (departmentName: string) => string;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  onDeactivate: (record: CardBatchMemberRecord) => void;
  onDeliver: (record: CardBatchMemberRecord) => void;
  onUndoDelivery: (record: CardBatchMemberRecord) => void;
  onViewBatch: (record: CardBatchMemberRecord) => void;
  onViewDetail: (record: CardBatchMemberRecord) => void;
  onViewProfile: (record: CardBatchMemberRecord) => void;
  record: CardBatchMemberRecord;
}

const AccreditedRow = memo(function AccreditedRow({
  canManage,
  regionLabelOf,
  selected,
  onToggleSelected,
  onDeactivate,
  onDeliver,
  onUndoDelivery,
  onViewBatch,
  onViewDetail,
  onViewProfile,
  record
}: AccreditedRowProps) {
  return (
    <NwtDatatableRecord>
      {/* Se puede marcar a quien esté ACTIVO, y a nadie más.
 
          La línea está puesta donde de verdad va, y no en cada acción. Una acreditación ya
          entregada sí se puede marcar: «Entrega masiva» no le aplica pero «Inactivar masivo»
          sí, y que el backend la descarte con su `skipped` es lo correcto —replicar esa regla
          acá sería tener dos reglas que acaban discrepando—.
 
          Una INACTIVA es otra cosa: no le aplica NINGUNA de las dos. Su casilla sería un
          control muerto —se marca, se pulsa, no pasa nada— y el contador del botón contaría
          gente sobre la que no va a actuar. Eso no es delegar la regla en el backend, es dejar
          un botón que miente. */}
      <NwtDatatableCell control={true}>
        <NwsSelectCheckBox
          ariaLabel={
            record.active
              ? `Seleccionar ${record.fullName}`
              : `${record.fullName}: su acreditación está inactiva, no hay nada que hacerle en bloque`
          }
          checked={selected}
          disabled={!record.active}
          onToggle={() => onToggleSelected(String(record.id))}
        />
      </NwtDatatableCell>

      {/* Las mismas columnas y la misma forma que «Gestión de acreditables», en el mismo orden:
          son dos vistas del mismo evento y leerlas distinto obliga a reaprender la tabla.

          «Tipo» va sin su sublínea de deporte, que es la única diferencia que queda: la
          inscripción deportiva no viaja en este endpoint. Poner ahí una raya fija enseñaría a
          ignorar la línea de abajo en las dos pantallas. */}
      <NwtDatatableCell className="nwt-width-xs-20">
        <NwsStackedCell
          primary={
            <span className="nwt-text-font-medium">{record.fullName}</span>
          }
          secondary={formatDocumentNumber(record.document)}
        />
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span>{record.roleName}</span>
      </NwtDatatableCell>

      {/* La ZONA, delante del territorio: se lee de lo ancho a lo estrecho —región, luego
          municipio y delegación—, igual que en «Gestión de acreditables» y en el mismo orden en
          que están los desplegables de arriba.

          Se deduce del NOMBRE de la delegación porque es lo único que trae la fila: este
          endpoint no devuelve el código del departamento. Ver `regionLabelOf`. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span>{regionLabelOf(record.departmentName) || SIN_DATO}</span>
      </NwtDatatableCell>

      {/* Territorio. Llega desde el 2026-09-16: hasta entonces `card-batches/members` no
          devolvía ni departamento ni municipio y la columna no existía en esta pantalla.

          Es el de la DELEGACIÓN con la que la persona está inscrita —el mismo dato contra el
          que filtran los dos desplegables de al lado—, y se lee igual que en acreditables: el
          municipio arriba, que es el que ubica, y la delegación debajo. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <NwsStackedCell
          primary={record.municipalityName || SIN_DATO}
          secondary={record.departmentName || 'Sin delegación'}
        />
      </NwtDatatableCell>

      {/* «Estado», el mismo rótulo en las dos pantallas: el mismo dato con dos nombres son
          dos datos para quien lee. */}
      <NwtDatatableCell className="nwt-width-xs-10">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={record.active ? 'positive' : 'neutral'}
        >
          {record.active ? 'Activa' : 'Inactiva'}
        </NwtBadge>
      </NwtDatatableCell>

      {/* La entrega es otro eje que el estado: una entregada sigue activa. Va como texto de
          color y NO en badge —el badge no envuelve ni recorta y salía partido al estrechar la
          tabla, que ya está medido—. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <div className="nws-accredited-row__delivery">
          <span
            className={`nws-delivery-state nws-delivery-state--${
              record.delivered ? 'entregada' : 'pendiente'
            }`}
          >
            {record.delivered ? 'Entregada' : 'Sin entregar'}
          </span>

          {/* Solo acá: la ficha y «Gestión de acreditables» no lo pintan por ahora (SUV2-2317).
              El tooltip va a la izquierda porque el datatable recorta con overflow. */}
          {record.cardOutdated && (
            <NwtTooltip
              content="Carnet desactualizado – reimprimir"
              position="left"
            >
              <NwtAvatarIcon
                className="nws-accredited-row__outdated"
                icon="caution"
                nwtTheme="caution"
              />
            </NwtTooltip>
          )}
        </div>
      </NwtDatatableCell>

      {/* El lote va al final: es lo único que esta pantalla da y la otra no, así que no puede
          ocupar el sitio de la persona. */}
      <NwtDatatableCell className="nwt-width-xs-10">
        {record.individual ? (
          <span>Individual</span>
        ) : (
          <span className="nwt-text-font-medium">Lote {record.batchLabel}</span>
        )}
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones de ${record.fullName}`}
          actions={[
            {
              key: 'detail',
              // `document` NO está en la fuente de iconos del módulo —comprobado contra
              // icons.css: existe `file`, no `document`— y un nombre inexistente no rompe,
              // simplemente no dibuja nada. Esta acción salía sin glifo.
              icon: 'file',
              label: 'Ver el detalle',
              onClick: () => onViewDetail(record)
            },
            // OCULTO TEMPORALMENTE (Andrés, 2026-09-08): «Ver credencial» no va por
            // ahora. La credencial sigue viva en `/profile/event/:code`; lo que se
            // quita es esta forma de llegar. Volver = poner la constante en `true`;
            // el detalle completo está donde se declara.
            ...(CREDENTIAL_ACTION_VISIBLE
              ? [
                  {
                    key: 'profile',
                    icon: 'user',
                    label: 'Ver credencial',
                    onClick: () => onViewProfile(record)
                  }
                ]
              : []),
            {
              key: 'batch',
              icon: 'download',
              label: record.individual
                ? 'Ver su acreditación'
                : 'Ver el lote completo',
              onClick: () => onViewBatch(record)
            },
            // Las tres del ciclo de entrega. Se ESCONDEN cuando no aplican, que es lo que
            // pidió QA: ofrecer «Entregar» sobre algo ya entregado es ofrecer un error.
            //
            // Son las mismas reglas que en la lista de acreditaciones del evento, y salen del
            // mismo sitio —`useAccreditedRecordActions`— para que no puedan divergir.
            ...(canManage && record.deliverable
              ? [
                  {
                    key: 'deliver',
                    // `checkmark` NO existe en la fuente de iconos del módulo —comprobado
                    // contra icons.css— y un nombre inexistente no rompe: la acción salía sin
                    // glifo. La pantalla hermana usa `edit` para esta misma acción.
                    icon: 'edit',
                    label: 'Entregar',
                    onClick: () => onDeliver(record)
                  }
                ]
              : []),
            ...(canManage && record.delivered && record.active
              ? [
                  {
                    key: 'undo',
                    icon: 'padlock-open',
                    // «Revertir la entrega» y no «revertir» a secas: además de revertir,
                    // INACTIVA la acreditación, y así lo nombra el modal que lo confirma.
                    label: 'Revertir la entrega',
                    onClick: () => onUndoDelivery(record)
                  }
                ]
              : []),
            ...(canManage && record.active
              ? [
                  {
                    key: 'deactivate',
                    icon: 'delete',
                    label: 'Inactivar',
                    onClick: () => onDeactivate(record)
                  }
                ]
              : [])
          ]}
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

// Los acreditados que ya tienen su acreditación, uno por fila, con el lote al que pertenecen.
//
// Es el mismo dato que «Lotes de acreditaciones» visto por el otro lado: allá se pregunta quién va
// en un lote, y acá en qué lote está una persona. Eso es lo que pide la tabla del diseño, y
// es lo que responde `GET /card-batches/members`.
//
// Dos columnas del diseño no están: la fecha de emisión y el vencimiento. El endpoint no las
// da y están pedidas a backend; inventarlas sería peor que no mostrarlas.
export function AccreditedListPage() {
  return (
    <NwsEventGuard>{(scope) => <AccreditedCatalog {...scope} />}</NwsEventGuard>
  );
}

function AccreditedCatalog({ event, eventId, phase }: NwsEventScope) {
  // Los carnets son del evento, no de la fase, así que se filtra por su código. Va puesto
  // antes de montar el controlador para que su primera petición ya nazca filtrada.
  repository.applyEventScope({
    event_code: event.code,
    ...(phase?.momentScope ?? {})
  });

  const controller = usePaginationRepository(repository);
  const navigate = useNavigate();

  // Arriba del todo porque el `limit` viaja con los filtros, y ese efecto está más abajo.
  // Con `formControl` y no con `value`: la prop suelta fija el valor pero deja el campo EN
  // BLANCO, así que el control no decía qué tamaño estaba puesto.
  const pageSizeControl = useFormControl<number | undefined>(PAGE_SIZE_DEFAULT);
  const pageSize = pageSizeControl.value ?? PAGE_SIZE_DEFAULT;

  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);

  // Los mismos filtros que «Gestión de acreditables», porque son dos vistas del mismo evento.
  //
  // Hasta el 2026-09-16 esta pantalla SOLO sabía buscar: medido, los doce candidatos
  // —`status`, `delivered`, `role_code`, los transversales…— devolvían lo mismo que un
  // parámetro inventado, o sea que el gateway los descartaba en silencio. Ahora los resuelve
  // él, que es lo único que sirve: filtrar en el navegador sobre una página de diez haría que
  // el contador, la paginación y el buscador dijeran cosas distintas.
  //
  // Los nueve están MEDIDOS contra staging el 2026-09-16 sobre «Event 0209» (23 filas), y con
  // control negativo: hoy un parámetro inventado responde **400**, así que un 200 ya prueba
  // que el nombre está en la lista blanca. Y con control positivo, que es lo que distingue
  // «filtra» de «devuelve cero siempre»:
  //
  //   statuses=INACTIVE 0 · delivered=true 7 / false 16 · role_codes 4 · sport_codes=ATL 11
  //   sex_codes H 18 / M 4 · department_codes=05 19 y =91 0 · region_codes=3 19
  //   category_codes=PRE_JUV 15 y las otras tres 0
  const statusFilter = useFormControl<string | undefined>('all');
  const deliveryFilter = useFormControl<string | undefined>('all');
  const typeFilter = useFormControl<string | undefined>('all');
  const regionFilter = useFormControl<string | undefined>('all');
  const departmentFilter = useFormControl<string | undefined>('all');
  const municipalityFilter = useFormControl<string | undefined>('all');
  const sportFilter = useFormControl<string | undefined>('all');
  const categoryFilter = useFormControl<string | undefined>('all');
  const sexFilter = useFormControl<string | undefined>('all');

  // «all» es el centinela de «sin filtro» de los desplegables, igual que en la otra pantalla.
  // Devuelve el par ya armado para poder esparcirlo: así el tipo queda en `string` y no en
  // `string | undefined`, que es lo que el cliente HTTP no acepta.
  const si = (clave: string, valor: string | undefined) =>
    valor && valor !== 'all' ? { [clave]: valor } : {};

  const phaseCode = phase?.code ?? '';

  // Las opciones de los desplegables. Mismas fuentes que «Gestión de acreditables», que es
  // deliberado: son dos vistas del mismo evento y ofrecer listas distintas haría que el mismo
  // filtro tuviera opciones diferentes según por dónde se entre.
  const [departments, setDepartments] = useState<[string, string][]>([]);
  const [municipalities, setMunicipalities] = useState<[string, string][]>([]);
  const [sports, setSports] = useState<[string, string][]>([]);
  const [categories, setCategories] = useState<EventRoleCatalogItem[]>([]);
  const [regions, setRegions] = useState<EventRoleCatalogItem[]>([]);
  // Departamento → región, para poder recortar el desplegable de delegación sin otra petición.
  const [regionOf, setRegionOf] = useState<Record<string, string>>({});
  // Lo mismo que `regionOf`, pero tecleado por NOMBRE de departamento: es el RESPALDO de la
  // columna «Región», porque la fila de esta tabla no trae el código. Ver `regionByDepartmentName`,
  // que es donde se compone con las facetas y donde está el porqué del orden.
  //
  // La clave va por `normalizeText` —minúsculas y sin tildes— para que el cruce no dependa de
  // cómo venga escrito: hoy los dos lados mandan «ATLÁNTICO» igual, pero basta una tilde o una
  // mayúscula de diferencia para que la columna se lea vacía sin que nada falle, y eso no se
  // nota en una revisión.
  const [regionOfName, setRegionOfName] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<AccreditedType[]>([]);

  useEffect(() => {
    let alive = true;

    // Cada uno con su `catch`: si falla el de regiones, el de al lado no tiene por qué quedarse
    // vacío. Sin opciones la pantalla se sigue usando —el buscador y la tabla no dependen de
    // esto—, así que un fallo acá no puede tumbar nada.
    typeRepository
      .requestAll({ event_id: eventId, limit: 100 })
      .then((list) => alive && setTypes(list.items))
      .catch(() => undefined);

    catalogRepository
      .requestSportCategories()
      .then((list) => alive && setCategories(list))
      .catch(() => undefined);

    locationRepository
      .requestRegions()
      .then((list) => alive && setRegions(list))
      .catch(() => undefined);

    locationRepository
      .requestDepartments()
      .then((list) => {
        if (!alive) {
          return;
        }

        setRegionOf(
          Object.fromEntries(list.map((one) => [one.code, one.regionCode]))
        );
        setRegionOfName(
          Object.fromEntries(
            list.map((one) => [normalizeText(one.name), one.regionCode])
          )
        );
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [eventId]);

  // Delegación, municipio y deporte salen de las FACETAS de la fase, igual que en la otra
  // pantalla: son los valores que de verdad existen, en vez de los 33 departamentos del país
  // de los que la mitad devolvería cero.
  //
  // La faceta es de la FASE y esta lista es del EVENTO, así que en un evento con varias fases
  // podría faltar una opción de otra fase. Se asume a sabiendas: es el mismo juego de opciones
  // que ve quien acredita, y una lista de 33 delegaciones vacías se equivoca más seguido.
  useEffect(() => {
    if (!event.code || !phaseCode) {
      return;
    }

    let alive = true;

    personRepository
      .requestFacets(event.code, phaseCode)
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
  }, [event.code, phaseCode, phase]);

  // El TIPO se ofrece con los del evento —no con los tres de plataforma—, porque `role_codes`
  // filtra por el rol de la acreditación y es el que la columna «Tipo» ya muestra. Solo los
  // activos, y uno por `roleCode`: el evento puede tener dos tipos con el mismo rol y el
  // desplegable repetiría la opción.
  const typeOptions = useMemo<NwtSelectOption<string>[]>(() => {
    const vistos = new Set<string>();

    return [
      { key: 'all', label: 'Tipo', value: 'all' },
      ...types
        .filter((one) => one.isActive && !vistos.has(one.roleCode) && vistos.add(one.roleCode))
        .map((one) => ({
          key: one.roleCode,
          label: one.typeName,
          value: one.roleCode
        }))
    ];
  }, [types]);

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

  // Delegación (por su NOMBRE) → nombre de su zona. Es lo que pinta la columna «Región».
  //
  // La región no viaja en la fila ni se puede pedir: el backend la traduce a departamentos al
  // filtrar y nunca la devuelve. Y acá, a diferencia de «Gestión de acreditables», tampoco hay
  // código con el que cruzarla: `card-batches/members` manda `department_name` y nada más (ver
  // `CardBatchMemberResponse`). Así que el nombre ES la clave, y de ahí sale todo lo demás.
  //
  // DOS fuentes, y las dos hacen falta:
  //
  //   1. las FACETAS de la fase, que mandan. Su rótulo y el `department_name` de esta tabla
  //      COINCIDEN hoy —medido contra staging el 2026-09-17: la faceta devuelve
  //      `{"code":"05","name":"ANTIOQUIA"}` y la fila dice `ANTIOQUIA`—. Que coincidan es
  //      observación, no garantía: son dos endpoints distintos (`participants/facets` y
  //      `card-batches/members`) y nadie promete que el nombre se calcule igual en los dos.
  //      Mandan porque, SI divergen, la faceta es la que pertenece a la misma fase que se
  //      está pintando; no porque no puedan divergir.
  //   2. el catálogo del país, de respaldo. Cubre lo que la faceta no puede: la faceta es de la
  //      FASE y esta lista es del EVENTO, así que una delegación que solo tenga gente en otra
  //      fase no sale en la faceta y sin el catálogo se quedaría sin zona.
  //
  // El respaldo va PRIMERO en el mapa para que las facetas lo pisen. Hoy el orden da igual: las
  // tres fuentes coinciden letra por letra —medido contra staging el 2026-09-17 en los tres
  // departamentos con participantes: ANTIOQUIA, ATLÁNTICO y VALLE DEL CAUCA—, así que esto NO
  // arregla ningún desajuste observado. Es solo el desempate para si alguna vez divergen.
  //
  // Ojo con una trampa que estuvo escrita acá y era falsa: durante un rato las semillas del
  // arnés mandaban «VALLE» en la fila y «VALLE DEL CAUCA» en el catálogo, y de ahí salió la
  // idea de que el backend desalineaba los nombres. Era el fixture, no el backend; está
  // corregido en b55feb1. Si vuelves a ver esa discrepancia, sospecha de la semilla antes que
  // del contrato.
  //
  // Las facetas no se recortan con los filtros (su efecto depende solo de evento y fase), así
  // que el mapa no cambia cuando el usuario filtra.
  const regionByDepartmentName = useMemo(() => {
    const nombreDeZona: Record<string, string> = Object.fromEntries(
      regions.map((one) => [one.code, one.name])
    );
    const mapa: Record<string, string> = {};

    for (const [clave, regionCode] of Object.entries(regionOfName)) {
      if (nombreDeZona[regionCode]) {
        mapa[clave] = nombreDeZona[regionCode];
      }
    }

    for (const [code, label] of departments) {
      if (nombreDeZona[regionOf[code]]) {
        mapa[normalizeText(label)] = nombreDeZona[regionOf[code]];
      }
    }

    return mapa;
  }, [departments, regionOf, regionOfName, regions]);

  // Cadena vacía y no una raya cuando no hay cruce: quien pinta decide cómo se lee un hueco, y
  // en esta tabla los huecos van con el mismo `SIN_DATO` que el resto. Pasa mientras los
  // diccionarios están en vuelo, con una fila sin delegación —hoy las hay— y con una delegación
  // que no está ni en las facetas ni en el catálogo.
  const regionLabelOf = useCallback(
    (departmentName: string) =>
      departmentName
        ? (regionByDepartmentName[normalizeText(departmentName)] ?? '')
        : '',
    [regionByDepartmentName]
  );

  // La delegación, RECORTADA a la región elegida: es la mitad visible de la cascada. La otra es
  // que solo viaja una de las dos, porque el backend las UNE en vez de cruzarlas.
  const departmentOptions = useMemo<NwtSelectOption<string>[]>(() => {
    const region = regionFilter.value;
    const dentro =
      region && region !== 'all'
        ? departments.filter(([code]) => regionOf[code] === region)
        : departments;

    return [
      { key: 'all', label: 'Delegación', value: 'all' },
      ...dentro.map(([code, name]) => ({ key: code, label: name, value: code }))
    ];
  }, [departments, regionFilter.value, regionOf]);

  // Y si la elegida se queda fuera de la región nueva, se suelta: dejarla marcada enseñaría un
  // desplegable que dice una cosa y una tabla que trae otra.
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

  useEffect(() => {
    controller.applyFilters({
      event_code: event.code,
      ...(phase?.momentScope ?? {}),
      limit: pageSize,
      ...(query ? { search: query } : {}),
      ...si('statuses', statusFilter.value),
      // Booleano de verdad y no la cadena: desde el 2026-09-16 el backend solo acepta
      // `true`/`false` y cualquier otra cosa es un 400. Antes leía «distinto de true» como
      // «no filtres», así que un valor raro lo desactivaba en silencio.
      ...(deliveryFilter.value && deliveryFilter.value !== 'all'
        ? { delivered: deliveryFilter.value === 'DELIVERED' }
        : {}),
      ...si('role_codes', typeFilter.value),
      // Región y delegación NO viajan juntas: el backend las UNE en vez de cruzarlas, así que
      // pedir las dos enseñaría MÁS gente, no menos. Medido acá mismo el 2026-09-16:
      // `region_codes=8&department_codes=05` —una región a la que Antioquia NO pertenece—
      // devuelve 19, que son justo los de Antioquia; cruzándose serían 0.
      //
      // El desplegable de delegación ya está recortado a la región, así que mandar solo el
      // departamento dice lo mismo sin mentir.
      ...(departmentFilter.value && departmentFilter.value !== 'all'
        ? si('department_codes', departmentFilter.value)
        : si('region_codes', regionFilter.value)),
      ...si('municipality_codes', municipalityFilter.value),
      ...si('sport_codes', sportFilter.value),
      ...si('category_codes', categoryFilter.value),
      ...si('sex_codes', sexFilter.value)
    });
  }, [
    event.code,
    phase,
    pageSize,
    query,
    statusFilter.value,
    deliveryFilter.value,
    typeFilter.value,
    regionFilter.value,
    departmentFilter.value,
    municipalityFilter.value,
    sportFilter.value,
    sexFilter.value,
    categoryFilter.value
  ]);

  const records = useMemo(
    () => (controller.state.is('success') ? controller.pageEntities : []),
    [controller.state, controller.pageEntities]
  );

  // Los nueve desplegables en una sola cadena. Sirve de dependencia para los efectos que
  // tienen que reaccionar a CUALQUIER cambio de filtro sin listar los nueve cada vez.
  const filtros = [
    statusFilter.value,
    deliveryFilter.value,
    typeFilter.value,
    regionFilter.value,
    departmentFilter.value,
    municipalityFilter.value,
    sportFilter.value,
    categoryFilter.value,
    sexFilter.value
  ];

  const filtrosPuestos = filtros.join('|');

  // Si la pantalla está enseñando MENOS de lo que hay. Con nueve desplegables, la lista vacía
  // deja de significar una sola cosa: «este evento no tiene acreditaciones» y «no hay ninguna
  // de Caribe 1» se ven igual, y el primer texto manda a generar carnets que ya existen.
  const hayRecorte =
    !!query || filtros.some((valor) => valor && valor !== 'all');

  const onViewBatch = useCallback(
    (record: CardBatchMemberRecord) => {
      navigate(`/delivery/card-batches/${record.batchCode}`, {
        // Para que el detalle del lote devuelva ACÁ —migajón y cierre del éxito— y no al
        // listado de lotes. Sin esto, inactivar el lote soltaba al operador en una tercera
        // pantalla, sin sus filtros ni su página: es el punto 12 de QA.
        state: { from: '/delivery/accredited', fromLabel: 'Lista de acreditados' }
      });
    },
    [navigate]
  );

  const onViewDetail = useCallback(
    (record: CardBatchMemberRecord) => {
      navigate(`/delivery/event-accredited/${record.accreditationCode}`, {
        // Para que el migajón del detalle devuelva ACÁ y no a la otra lista.
        state: { from: '/delivery/accredited', fromLabel: 'Lista de acreditados' }
      });
    },
    [navigate]
  );

  // Hoy no la dispara nadie: la acción que la llamaba está OCULTA TEMPORALMENTE (ver
  // `CREDENTIAL_ACTION_VISIBLE`). Se deja cableada para que devolverla sea solo poner
  // esa constante en `true`.
  const onViewProfile = useCallback(
    (record: CardBatchMemberRecord) => {
      navigate(`/profile/event/${record.accreditationCode}`);
    },
    [navigate]
  );

  /**
   * La fila de esta tabla, vista como la ACREDITACIÓN que es, para poder entregarla,
   * revertirla o inactivarla.
   *
   * Existe por una trampa que de otra forma se paga cara: el `id` de `CardBatchMemberRecord`
   * es COMPUESTO —acreditación + lote— y no el código de la acreditación; lo es a propósito,
   * porque una persona puede salir en dos lotes y con el código a secas la tabla se rompía.
   * Pero las acciones mandan `String(record.id)` como código al backend, así que pasarles la
   * fila tal cual haría un PATCH contra un código que no existe. Acá se cruza a
   * `accreditationCode`, que es el de verdad.
   *
   * Solo se rellena lo que las acciones miran —el código, el estado, la entrega y el nombre,
   * que es el que sale en el modal—. El resto no viaja a ninguna parte: esta pantalla no lo
   * tiene porque el endpoint de miembros no lo da, y ponerlo en cero es más honesto que
   * inventarlo.
   */
  const comoAcreditacion = useCallback(
    (record: CardBatchMemberRecord) =>
      new AccreditedRecord(
        record.accreditationCode,
        eventId,
        record.document,
        record.fullName,
        record.roleCode,
        record.roleName,
        record.statusCode,
        0,
        0,
        new Date(0),
        '',
        null,
        null,
        record.delivered ? 'DELIVERED' : 'PENDING'
      ),
    [eventId]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // La selección se suelta al paginar, al buscar Y al filtrar: dejar marcados a los que ya no
  // se ven daría un «Acciones» que actúa sobre gente que nadie puede auditar antes de pulsar.
  //
  // Los desplegables entraron acá tarde y el fallo era mudo: el botón SÍ se apagaba al filtrar
  // —`selectedRecords` se cruza contra lo que está en pantalla, así que a quien se esconde no
  // lo cuenta— pero la marca no se soltaba, solo se escondía con su fila. Al quitar el filtro
  // la gente volvía marcada sin que nadie la hubiera marcado, y la siguiente masiva salía con
  // ella dentro.
  useEffect(() => {
    setSelected(new Set());
  }, [controller.currentPage, query, filtrosPuestos, pageSize]);

  const onToggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  // Las de esta página que SE PUEDEN marcar, que no son todas: sobre una inactiva no hay
  // ninguna acción masiva que ejecutar.
  //
  // Va por el id COMPUESTO de la fila, que es lo único único acá: una persona puede salir en
  // dos lotes, y con el código de la acreditación dos filas compartirían marca.
  //
  // Y tiene que ser esta lista y no `records` entera, o el checkbox de cabecera se queda en
  // indeterminado para siempre en cuanto haya una inactiva: `selectedOnPage === pageIds.length`
  // sería inalcanzable.
  const selectableIds = useMemo(
    () =>
      records
        .filter((record) => record.active)
        .map((record) => String(record.id)),
    [records]
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

  // El `controller` se rehace en cada render, así que meterlo en las dependencias rearmaría
  // esta función constantemente y con ella toda la tabla memoizada. Pero dejarlo fuera SIN más
  // congelaba el del primer render, y ese `refresh` arranca con `if (request.is('loading'))
  // return`: el congelado no disparaba la petición NUNCA. Medido: tras el POST de entrega
  // masiva no salía ningún GET de la lista, y el cambio solo se veía recargando a mano.
  //
  // Por referencia, que es el mismo patrón que usa `useCardBatch` con su `request`: la función
  // se queda estable y aun así llama al `refresh` de ahora.
  const refreshRef = useRef(controller.refresh);

  refreshRef.current = controller.refresh;

  const onActionsDone = useCallback(() => {
    setSelected(new Set());
    refreshRef.current();
  }, []);

  const {
    askDeactivate,
    askDeliver,
    askUndoDelivery,
    askUndoDeliveryMany,
    confirmCopy,
    onCancel,
    onCloseSuccess,
    onConfirm,
    successCopy
  } = useAccreditedRecordActions(onActionsDone);

  // Lo seleccionado, ya cruzado a su acreditación de verdad. Es el mismo cruce que las
  // acciones de fila y por el mismo motivo: el id de la fila lleva el lote pegado.
  const selectedRecords = useMemo(
    () =>
      records
        .filter((record) => selected.has(String(record.id)) && record.active)
        .map(comoAcreditacion),
    [records, selected, comoAcreditacion]
  );

  // Si la selección entera se puede revertir, y cuántas estorban si no.
  //
  // La regla es de QA y es una barandilla, no un detalle de interfaz: revertir NO es
  // deshacer, además INACTIVA —«para volver a acreditar hay que emitir una nueva»— y no
  // tiene vuelta atrás. Exigir que TODAS estén entregadas es lo que impide que un clic
  // deje sin acreditación a gente que ni siquiera había pasado a recoger su carnet.
  //
  // Por eso el filtro es «todas o ninguna» y NO «revierte las que puedas»: con las otras dos
  // masivas el backend descarta lo que no aplica y lo cuenta en `skipped`, que ahí es
  // correcto porque son reversibles. Acá una de más no se arregla.
  const revertible = useMemo(() => {
    const sinEntregar = selectedRecords.filter((record) => !record.delivered);

    return {
      puede: !!selectedRecords.length && !sinEntregar.length,
      sinEntregar: sinEntregar.length,
      total: selectedRecords.length
    };
  }, [selectedRecords]);

  const onDeliver = useCallback(
    (record: CardBatchMemberRecord) => askDeliver([comoAcreditacion(record)]),
    [askDeliver, comoAcreditacion]
  );

  const onUndoDelivery = useCallback(
    (record: CardBatchMemberRecord) =>
      askUndoDelivery(comoAcreditacion(record)),
    [askUndoDelivery, comoAcreditacion]
  );

  const onDeactivate = useCallback(
    (record: CardBatchMemberRecord) =>
      askDeactivate([comoAcreditacion(record)]),
    [askDeactivate, comoAcreditacion]
  );

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando acreditados, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('failure')) {
      return (
        <NwsRequestError
          error={controller.state.error}
          title="No pudimos cargar los acreditados"
          onRetry={controller.refresh}
        />
      );
    }

    return (
      <NwtCard className="nws-accredited-list__catalog">
        <div className="nws-delivery__filters">
          <div className="nws-delivery__search">
            <NwtSearchbox
              formControl={search}
              placeholder="Buscar por nombre o documento"
            />

            <NwtDropdown formControl={typeFilter} options={typeOptions} />

            <NwtDropdown formControl={statusFilter} options={STATUS_OPTIONS} />

            <NwtDropdown
              formControl={deliveryFilter}
              options={DELIVERY_OPTIONS}
            />

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

            <NwtDropdown formControl={sexFilter} options={SEX_OPTIONS} />
          </div>

          {/* Paginación del servidor: cada página es una petición. */}
          <div className="nws-page-size">
            <NwtDropdown
              formControl={pageSizeControl}
              nwtSize="small"
              options={PAGE_SIZE_OPTIONS}
            />

            <NwtPagination
              currentPage={controller.currentPage}
              totalPages={controller.totalPages}
              onChange={controller.goToPage}
              nwtSize="small"
            />
          </div>
        </div>

        {records.length ? (
          <NwtDatatable
            header={
              <NwtDatatableHeader>
                <NwtDatatableTitle control={true}>
                  <NwsSelectCheckBox
                    ariaLabel="Seleccionar todos"
                    checked={allChecked}
                    disabled={!selectableIds.length}
                    onToggle={onToggleAll}
                  />
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-20">
                  Persona
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Tipo
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Región
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Territorio
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-10">
                  Estado
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-12-5">
                  Entrega
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-width-xs-10">
                  Lote
                </NwtDatatableTitle>
                <NwtDatatableTitle className="nwt-align-right" actions={true} />
              </NwtDatatableHeader>
            }
          >
            {records.map((record) => (
              <AccreditedRow
                key={record.id}
                canManage={canManage}
                regionLabelOf={regionLabelOf}
                selected={selected.has(String(record.id))}
                onToggleSelected={onToggleSelected}
                onDeactivate={onDeactivate}
                onDeliver={onDeliver}
                onUndoDelivery={onUndoDelivery}
                onViewBatch={onViewBatch}
                onViewDetail={onViewDetail}
                onViewProfile={onViewProfile}
                record={record}
              />
            ))}
          </NwtDatatable>
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title={hayRecorte ? 'Sin resultados' : 'Aún no hay acreditaciones generadas'}
            description={
              hayRecorte
                ? 'Ningún acreditado coincide con lo que está filtrado. Quita algún filtro para ver el resto.'
                : 'Acá aparecen los acreditados que ya tienen su acreditación: genéralas desde «Gestión de acreditables» o desde «Lotes de acreditaciones».'
            }
            showAction={false}
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-delivery nws-accredited-list">
      <div className="nws-delivery__content">
        <div className="nws-delivery__header">
          <div className="nws-delivery__description">
            <span className="nwt-h5-font-bold">Lista de acreditados</span>

            <small className="nwt-smalltext-font-regular">
              Los acreditados con su acreditación generada, con el lote al que
              pertenecen
            </small>
          </div>

          <div className="nws-delivery__actions">
            {canManage ? (
              /* Las masivas van sobre la selección de la página, y el botón se queda apagado
                 mientras no haya nadie marcado: un «Acciones» que se abre para no poder hacer
                 nada es peor que uno que dice que todavía no. */
              <NwsRowActionsMenu
                actions={[
                  {
                    key: 'deliver',
                    icon: 'edit',
                    label: 'Entrega masiva',
                    onClick: () => askDeliver(selectedRecords)
                  },
                  /* «Revertir entrega» se DIBUJA SIEMPRE y se apaga cuando la selección no
                     da, con el motivo en la etiqueta. No se esconde, y es una decisión:
                     escondida es como estaba —o sea, como no estaba—, y QA la reportó
                     justamente porque no aparecía. Un ítem que falta no distingue «esto no
                     existe» de «tu selección no vale»; uno apagado que dice por qué, sí.
                     Es el mismo patrón que «Acreditar» en la pantalla hermana.

                     La etiqueta apagada además dice el camino, no solo el problema. Bloquear
                     las filas no entregadas en la tabla no se puede —las casillas se marcan
                     ANTES de elegir la acción y las mismas alimentan a las tres; apagar las
                     sin entregar mataría «Entrega masiva», que necesita justo esas—, pero el
                     filtro «Entrega» ya existe y puesto en «Entregada» deja la tabla con
                     solo lo revertible. El bloqueo sale por construcción y el contador no
                     puede mentir. */
                  {
                    key: 'undo',
                    icon: 'padlock-open',
                    label: revertible.puede
                      ? `Revertir entrega (${revertible.total})`
                      : `No se puede revertir: ${revertible.sinEntregar} de ${revertible.total} no están entregadas — filtra por «Entregada»`,
                    disabled: !revertible.puede,
                    onClick: () => askUndoDeliveryMany(selectedRecords)
                  },
                  {
                    key: 'deactivate',
                    icon: 'delete',
                    label: 'Inactivar masivo',
                    onClick: () => askDeactivate(selectedRecords)
                  }
                ]}
                trigger={(open) => (
                  <DeliveryActionsButton
                    open={open}
                    disabled={!selectedRecords.length}
                  />
                )}
              />
            ) : (
              <small className="nwt-smalltext-font-regular">
                Solo consulta: tu usuario no puede generar ni entregar
                acreditaciones.
              </small>
            )}
          </div>
        </div>

        {renderCatalog()}
      </div>

      <DeliveryConfirmModal
        copy={confirmCopy}
        onCancel={onCancel}
        onConfirm={onConfirm}
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
