import type { AccreditedType } from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  formatCodeLabel,
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  NwsModal,
  NwsQuotaChip,
  NwsRowActionsMenu,
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
import { memo, useCallback, useState } from 'react';

interface AccreditedTypesTableProps {
  accreditedTypes: AccreditedType[];
  canManage: boolean;
  // El nombre de una función a partir de su código. Lo arma la pantalla, que es la que tiene
  // los dos diccionarios; acá solo se pinta.
  functionLabelOf: (code: string) => string;
  onEdit: (accreditedType: AccreditedType) => void;
  onToggle: (accreditedType: AccreditedType) => void;
  working: boolean;
}

// Cuántos permisos se ven en la fila antes del «+N». Dos entran de sobra en la columna; ocho
// —lo que tiene el tipo de staging— salían en una sola línea recortada donde no se distinguía
// ninguno, que es lo que se reportó.
const PERMISOS_A_LA_VISTA = 2;

interface AccreditedTypePermissionsProps {
  accreditedType: AccreditedType;
  onViewAll: (accreditedType: AccreditedType) => void;
}

// El permiso como se lee en la fila: su nombre y, si lleva tope, cuántos usos por persona
// entre paréntesis. Antes el tope era uno solo para todo el tipo y vivía en su propia columna;
// ahora es de cada permiso, así que va pegado al permiso que lo lleva.
function etiquetaDePermiso(permission: AccreditedType['permissions'][number]) {
  return permission.maxUsesPerPerson === null
    ? permission.permissionName
    : `${permission.permissionName} (${permission.maxUsesPerPerson})`;
}

// Los permisos del tipo, en la fila. Los dos primeros con su nombre y el resto detrás de un
// «+N» que abre la lista completa: en la columna no caben ocho, y unirlos con guiones dejaba
// una línea cortada —«Área de transporte - Área de prensa - Todos los esce…»— donde no se
// podía ver cuáles eran.
function AccreditedTypePermissions({
  accreditedType,
  onViewAll
}: AccreditedTypePermissionsProps) {
  const { permissions } = accreditedType;

  if (!permissions.length) {
    return <span>Sin permisos</span>;
  }

  // Los dos PRIMEROS, y desde SUV2-2330 eso significa algo: la lista llega ordenada por el
  // `order` que el usuario eligió, así que son los dos que él puso arriba. Antes eran los dos
  // que devolviera Postgres, que podían cambiar entre dos lecturas.
  const visibles = permissions.slice(0, PERMISOS_A_LA_VISTA);
  const ocultos = permissions.length - visibles.length;

  return (
    <div className="nws-accredited-types__permissions">
      {/* Texto pelado y no `NwtTag`: la etiqueta del SDK trae su propio tipo —medido, 10px y
          peso 600— y el resto de la fila va en 14px con peso 400. Con etiquetas, esta celda se
          leía distinta a todas las demás, que es la inconsistencia que QA ya había reportado.
          Lo que separa un permiso del siguiente es el punto, no un tamaño de letra. */}
      <span className="nws-accredited-types__permissions-list">
        {visibles.map(etiquetaDePermiso).join(' · ')}
      </span>

      {ocultos > 0 && (
        <button
          type="button"
          className="nws-accredited-types__permissions-more"
          aria-label={`Ver los ${permissions.length} permisos de ${accreditedType.typeName}`}
          onClick={() => onViewAll(accreditedType)}
        >
          +{ocultos}
        </button>
      )}
    </div>
  );
}

interface AccreditedTypesTableRowProps {
  accreditedType: AccreditedType;
  canManage: boolean;
  functionLabelOf: (code: string) => string;
  onEdit: (accreditedType: AccreditedType) => void;
  onToggle: (accreditedType: AccreditedType) => void;
  onViewPermissions: (accreditedType: AccreditedType) => void;
  working: boolean;
}

const AccreditedTypesTableRow = memo(function AccreditedTypesTableRow({
  accreditedType,
  canManage,
  functionLabelOf,
  onEdit,
  onToggle,
  onViewPermissions,
  working
}: AccreditedTypesTableRowProps) {
  return (
    <NwtDatatableRecord>
      {/* El código NO vuelve a su columna: es la identidad del rol de cara al servidor —en
          inglés y en mayúsculas— y a quien usa la pantalla no le dice nada. Lo que el rediseño
          pide es distinto y es lo que se hace acá: va de sublínea, en pequeño y en gris, para
          quien lo necesite al reportar un problema. Lo que QA reportó era el código PEGADO
          dentro del nombre —«Deportista (ATHLETE)»—, y de eso sigue encargándose toRoleLabel.
          Y va HUMANIZADO —«ATHLETE» → «Athlete»—: en mayúsculas y con guiones bajos se lee
          como un error de la pantalla. Solo para mostrar; `roleCode` sigue intacto en todo lo
          que viaja al servidor. Es el único sitio del módulo que enseña un código crudo:
          barridas las once pantallas sobre el DOM, no había ningún otro.

          Y desde SUV2-2228 la sublínea enseña la FUNCIÓN cuando el tipo la tiene, que es lo
          que de verdad distingue dos tipos de apoyo —entrenador o asistente—; el código no lo
          dice. Antes salía siempre el código, así que cambiar la función de un tipo no movía
          NADA en la tabla y parecía que no se había guardado. Lo reportó QA.

          El nombre NO sigue a la función a propósito: el `role_code` es la identidad con la
          que el backend encuentra el tipo al acreditar, y las acreditaciones ya emitidas
          apuntan ahí. Se cambia lo que se ve, no lo que las sostiene. */}
      <NwtDatatableCell className="nwt-width-xs-25">
        <NwsStackedCell
          primary={
            <span className="nwt-text-font-medium">
              {accreditedType.typeName}
            </span>
          }
          secondary={
            accreditedType.platformSubrole
              ? functionLabelOf(accreditedType.platformSubrole)
              : formatCodeLabel(accreditedType.roleCode)
          }
        />
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-37-5">
        <AccreditedTypePermissions
          accreditedType={accreditedType}
          onViewAll={onViewPermissions}
        />
      </NwtDatatableCell>

      {/* Sin la columna «No. de validaciones»: era el mayor de los topes del tipo, un número
          que no correspondía a ningún permiso en concreto. Ahora cada permiso enseña el suyo
          en la columna de al lado, que es donde significa algo. */}

      {/* La fecha límite de acceso del rol, que el backend ya guarda. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span>
          {accreditedType.accessDeadline
            ? formatCatalogDate(accreditedType.accessDeadline)
            : 'Sin fecha'}
        </span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-10">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={getCatalogStatusTheme(accreditedType.status)}
          vignette={true}
        >
          {/* En masculino: es «el tipo». */}
          {getCatalogStatusLabel(accreditedType.status, 'masculino')}
        </NwtBadge>
      </NwtDatatableCell>

      {/* El cupo se enseña DONDE SE CONFIGURA el tipo: acá se decide qué permisos lleva, y el
          cupo dice cuánta gente cabe en él. Hoy va en raya —ver NwsQuotaChip—. */}
      <NwtDatatableCell className="nwt-width-xs-15">
        <NwsQuotaChip />
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones de ${accreditedType.typeName}`}
          actions={
            // Sin accreditation:manage las escrituras son un 403 seguro.
            canManage
              ? [
                  {
                    key: 'edit',
                    icon: 'edit',
                    label: 'Editar',
                    disabled: working,
                    onClick: () => onEdit(accreditedType)
                  },
                  {
                    key: 'status',
                    icon: accreditedType.isActive
                      ? 'padlock-close'
                      : 'padlock-open',
                    label: accreditedType.isActive ? 'Inactivar' : 'Activar',
                    disabled: working,
                    onClick: () => onToggle(accreditedType)
                  }
                ]
              : []
          }
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function AccreditedTypesTable({
  accreditedTypes,
  canManage,
  functionLabelOf,
  onEdit,
  onToggle,
  working
}: AccreditedTypesTableProps) {
  // UN solo modal para toda la tabla, y no uno por fila: el NwtModal renderiza sus children
  // siempre, así que una modal por fila serían cuatro listas montadas para ver una.
  const [viendo, setViendo] = useState<AccreditedType>();

  const onCloseViendo = useCallback(() => setViendo(undefined), []);

  return (
    <>
      <NwtDatatable
        header={
          <NwtDatatableHeader>
            <NwtDatatableTitle className="nwt-width-xs-25">
              Tipo de acreditado
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-37-5">
              Permisos
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-12-5">
              Vence
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-10">
              Estado
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-15">
              Cupo
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-align-right" actions={true} />
          </NwtDatatableHeader>
        }
      >
        {accreditedTypes.map((accreditedType) => (
          <AccreditedTypesTableRow
            functionLabelOf={functionLabelOf}
            key={accreditedType.id}
            canManage={canManage}
            onEdit={onEdit}
            onToggle={onToggle}
            onViewPermissions={setViendo}
            working={working}
            accreditedType={accreditedType}
          />
        ))}
      </NwtDatatable>

      <NwsModal
        className="nws-type-permissions-modal"
        title={viendo ? `Permisos de ${viendo.typeName}` : ''}
        visible={!!viendo}
        onClose={onCloseViendo}
        autoclose={true}
      >
        {/* El NwtModal renderiza sus children aunque esté cerrado, así que la lista solo se
          arma cuando hay un tipo elegido. */}
        {viendo && (
          <div className="nws-type-permissions-modal__body">
            <span className="nwt-smalltext-font-regular">
              {viendo.permissions.length}{' '}
              {viendo.permissions.length === 1
                ? 'permiso concedido'
                : 'permisos concedidos'}{' '}
              a este tipo de acreditado.
            </span>

            <ul className="nws-type-permissions-modal__list">
              {viendo.permissions.map((permission) => (
                <li key={permission.permissionId}>
                  <span className="nwt-text-font-medium">
                    {permission.permissionName}
                  </span>

                  {/* El tope es del permiso, no del tipo: acá se ve cuál lo lleva. */}
                  <small className="nwt-smalltext-font-regular">
                    {permission.hasLimit
                      ? `Hasta ${permission.maxUsesPerPerson ?? '—'} validaciones por persona`
                      : 'Sin tope de validaciones'}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </NwsModal>
    </>
  );
}
