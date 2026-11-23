import type { ReadyParticipant } from '@mf-accreditations/domain';
import type { NwsRowAction } from '@mf-accreditations/presentation';
import {
  formatDocumentNumber,
  NwsRowActionsMenu,
  NwsSelectCheckBox,
  NwsStackedCell
} from '@mf-accreditations/presentation';
import {
  NwtBadge,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle
} from '@naowee-tech/sdk-react-components';
import { memo } from 'react';

interface EnabledListTableProps {
  // undefined = indeterminado: solo algunas filas de la página seleccionadas.
  allChecked?: boolean;
  canManage: boolean;
  people: ReadyParticipant[];
  // La lista de los que tienen documentación por aprobar: sale la columna de documentos y no
  // se puede acreditar a nadie.
  pending: boolean;
  // Respaldo para las filas que traen departamento pero no zona. Lo resuelve la página con el
  // cruce que ya pide para sus desplegables.
  regionLabelOf: (departmentCode: string) => string;
  roleLabelOf: (code: string) => string;
  selected: Set<string>;
  working: boolean;
  onAccredit: (person: ReadyParticipant) => void;
  onToggle: (person: ReadyParticipant) => void;
  onToggleAll: () => void;
}

// Lo que el rediseño pide y el contrato todavía no da. Va en raya y no en blanco: una celda
// vacía se lee como un dato que le falta a ESA persona, y es una columna que falta entera.
const SIN_DATO = '—';

interface EnabledListTableRowProps {
  canManage: boolean;
  checked: boolean;
  pending: boolean;
  person: ReadyParticipant;
  regionLabelOf: (departmentCode: string) => string;
  roleLabelOf: (code: string) => string;
  working: boolean;
  onAccredit: (person: ReadyParticipant) => void;
  onToggle: (person: ReadyParticipant) => void;
}

const EnabledListTableRow = memo(function EnabledListTableRow({
  canManage,
  checked,
  pending,
  person,
  regionLabelOf,
  roleLabelOf,
  working,
  onAccredit,
  onToggle
}: EnabledListTableRowProps) {
  const estado = person.accreditationState;

  // El motivo va EN LA ETIQUETA del ítem, que se queda apagado en vez de desaparecer: quien
  // llega a reclamar su acreditación tiene que poder ver POR QUÉ no se le puede dar. Es la
  // decisión de esta pantalla y sobrevive al cambio a menú —el menú permite ítems
  // deshabilitados, así que no hay que elegir entre las dos cosas—.
  //
  // El segundo motivo es el que trae la unificación: antes esta gente no salía en la lista
  // —el `exclude_accredited` la restaba— y ahora sale, así que hay que explicar por qué no se
  // le puede acreditar otra vez. Es el 409 «una acreditación por persona y evento».
  const motivo = pending
    ? `No se puede acreditar: le faltan requisitos (${person.requirementsLabel})`
    : !person.accreditable
      ? 'No se puede acreditar: ya tiene una activa'
      : working
        ? 'Acreditando...'
        : 'Acreditar';

  // Se deja marcar a quien se pueda acreditar. Deshabilitado y no escondido, por lo mismo de
  // arriba; y deshabilitado en vez de filtrarlo al enviar, porque el botón cuenta
  // `selected.size` y cualquier diferencia entre lo que cuenta y lo que manda es el agujero
  // que esta pantalla ya cerró una vez: decía «Acreditar (11)» y mandaba 10.
  const seleccionable = !pending && person.accreditable;

  // Los tres puntitos, como en las otras listas del módulo. UNA sola acción: acreditar.
  //
  // «Ver detalle» estuvo acá y QA lo mandó a quitar. El motivo es que esta pantalla es la de
  // acreditar, y el detalle de la acreditación ya tiene su propia puerta en «Lista de
  // acreditados», que es donde se va a mirar una acreditación que ya existe. Tenerlo en las
  // dos repartía el mismo destino en dos sitios y hacía que el menú de acá ofreciera algo que
  // no es lo que se viene a hacer.
  //
  // El ítem se queda APAGADO en vez de desaparecer cuando no se puede acreditar: el motivo va
  // en su etiqueta y es la respuesta que el operador busca. Ver `motivo`.
  const acciones: NwsRowAction[] = canManage
    ? [
        {
          key: 'accredit',
          icon: 'positive',
          label: motivo,
          disabled: !seleccionable || working,
          onClick: () => onAccredit(person)
        }
      ]
    : [];

  return (
    <NwtDatatableRecord>
      <NwtDatatableCell control={true}>
        <NwsSelectCheckBox
          ariaLabel={
            seleccionable
              ? `Seleccionar a ${person.fullName}`
              : `${person.fullName}: ${motivo}`
          }
          checked={checked}
          disabled={!seleccionable}
          onToggle={() => onToggle(person)}
        />
      </NwtDatatableCell>

      {/* Cuatro columnas agrupadas, como fijó la sesión: «el tipo con el deporte, municipio
          con departamento». Con un dato por columna la tabla no cabía. */}
      <NwtDatatableCell className="nwt-width-xs-22-5">
        <NwsStackedCell
          primary={
            <span className="nwt-text-font-medium">
              {person.fullName || SIN_DATO}
            </span>
          }
          secondary={`${person.documentType} ${formatDocumentNumber(person.document)}`}
        />
      </NwtDatatableCell>

      {/* La FUNCIÓN cuando la hay, y la categoría cuando no.

          El personal de apoyo llega con `user_role: SUPPORT_PERSONNEL` para todos, así que la
          columna decía «Personal de apoyo» a un Docente/Entrenador y a un Auxiliar Discapacidad
          por igual, sin forma de distinguirlos. Su función viaja aparte, en `supportRoleNames`,
          ya resuelta en español por el backend —`supportRoleLabel` la arma y cae al código si el
          catálogo no la conoce—.

          Y así la columna significa lo mismo para todos: el personal de misión ya enseñaba su
          función y no su categoría, porque su `roleCode` YA ES la función (JMI, FIS, MED…). El
          apoyo era el único que se quedaba en la categoría.

          Son VARIAS a propósito: la función se asigna por deporte, y el mismo apoyo puede ser
          entrenador en uno y asistente en otro. Se enseñan todas —el getter las une— porque
          quedarse con una escondería la otra sin decirlo. */}
      <NwtDatatableCell className="nwt-width-xs-15">
        <NwsStackedCell
          primary={person.supportRoleLabel || roleLabelOf(person.roleCode)}
          secondary={person.sportLabel || SIN_DATO}
        />
      </NwtDatatableCell>

      {/* Manda la que el backend manda en la fila; el cruce por departamento es respaldo.
          El Comité Organizador Sede no tiene delegación y aun así tiene zona. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span>
          {person.regionName || regionLabelOf(person.departmentCode) || SIN_DATO}
        </span>
      </NwtDatatableCell>

      {/* Municipio y departamento salen de la DELEGACIÓN con la que el participante está
          inscrito, que es contra lo que filtra la pantalla. */}
      <NwtDatatableCell className="nwt-width-xs-15">
        <NwsStackedCell
          primary={person.municipalityLabel || SIN_DATO}
          secondary={person.departmentName || 'Sin delegación'}
        />
      </NwtDatatableCell>

      {/* Si la persona ya está acreditada, que es lo único que esta pantalla necesita saber de
          su acreditación.

          La ENTREGA estuvo al lado y QA la mandó a quitar de acá. No se perdió: sigue en
          «Lista de acreditados», que es la pantalla del mostrador —la que responde «¿a quién le
          falta entregarle?»—. En esta, donde se acredita, la columna se llenaba de rayas: quien
          todavía no está acreditado no tiene entrega que enseñar, y es justo la gente que esta
          lista viene a mostrar.

          Va en badge, igual que en la lista de acreditados: el mismo dato con dos formas son
          dos datos para quien lee. «Sin acreditar» no lo lleva porque no es un estado de una
          acreditación, es la ausencia de una. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        {estado === 'NONE' ? (
          <span className="nws-delivery-state nws-delivery-state--pendiente">
            Sin acreditar
          </span>
        ) : (
          <NwtBadge
            nwtVariant="quiet"
            nwtTheme={estado === 'INACTIVE' ? 'neutral' : 'positive'}
          >
            {estado === 'INACTIVE' ? 'Inactiva' : 'Activa'}
          </NwtBadge>
        )}
      </NwtDatatableCell>

      {pending && (
        <NwtDatatableCell className="nwt-width-xs-12-5">
          {/* «3 de 5» y no un sí/no: el caso que hay que resolver es poder decirle a quien
              reclama cuánto le falta, sin salir del módulo. */}
          <NwsStackedCell
            primary={`${person.requirementsLabel} aprobados`}
            secondary={
              person.requirementsLoaded
                ? `${person.requirementsLoaded} cargados`
                : 'Sin cargar'
            }
          />
        </NwtDatatableCell>
      )}

      <NwtDatatableCell actions className="nwt-align-right">
        {!!acciones.length && (
          <NwsRowActionsMenu
            ariaLabel={`Acciones de ${person.fullName}`}
            actions={acciones}
          />
        )}
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function EnabledListTable({
  allChecked,
  canManage,
  people,
  pending,
  regionLabelOf,
  roleLabelOf,
  selected,
  working,
  onAccredit,
  onToggle,
  onToggleAll
}: EnabledListTableProps) {
  // Si en esta página hay alguien a quien marcar. Sin esto, en una página entera de gente ya
  // acreditada el checkbox de cabecera seguiría vivo y no marcaría nada.
  const haySeleccionables =
    !pending && people.some((person) => person.accreditable);

  return (
    <NwtDatatable
      className="nws-enabled-list__table"
      header={
        <NwtDatatableHeader>
          <NwtDatatableTitle control={true}>
            <NwsSelectCheckBox
              ariaLabel="Seleccionar todos"
              checked={allChecked}
              disabled={!haySeleccionables}
              onToggle={onToggleAll}
            />
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-22-5">
            Persona
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-15">
            Tipo
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Región
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-15">
            Territorio
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Estado
          </NwtDatatableTitle>
          {pending && (
            <NwtDatatableTitle className="nwt-width-xs-12-5">
              Documentos
            </NwtDatatableTitle>
          )}
          <NwtDatatableTitle className="nwt-align-right" actions={true} />
        </NwtDatatableHeader>
      }
    >
      {people.map((person) => (
        <EnabledListTableRow
          key={person.id}
          canManage={canManage}
          checked={selected.has(String(person.id))}
          pending={pending}
          person={person}
          regionLabelOf={regionLabelOf}
          roleLabelOf={roleLabelOf}
          working={working}
          onAccredit={onAccredit}
          onToggle={onToggle}
        />
      ))}
    </NwtDatatable>
  );
}
