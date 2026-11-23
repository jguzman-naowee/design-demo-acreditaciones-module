import type { AccessPermission } from '@mf-accreditations/domain';
import {
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  NwsRowActionsMenu
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

interface AccessPermissionsTableProps {
  canManage: boolean;
  onEdit: (permission: AccessPermission) => void;
  onToggle: (permission: AccessPermission) => void;
  onViewIcon: (permission: AccessPermission) => void;
  permissions: AccessPermission[];
  working: boolean;
}

interface AccessPermissionsTableRowProps {
  canManage: boolean;
  onEdit: (permission: AccessPermission) => void;
  onToggle: (permission: AccessPermission) => void;
  onViewIcon: (permission: AccessPermission) => void;
  permission: AccessPermission;
  working: boolean;
}

const AccessPermissionsTableRow = memo(function AccessPermissionsTableRow({
  canManage,
  onEdit,
  onToggle,
  onViewIcon,
  permission,
  working
}: AccessPermissionsTableRowProps) {
  return (
    <NwtDatatableRecord>
      <NwtDatatableCell className="nwt-width-xs-20">
        <span className="nwt-text-font-medium">{permission.name}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-25">
        <span>{permission.description || '—'}</span>
      </NwtDatatableCell>

      {/* Zona y sede, que el backend guarda como texto libre. Van juntas porque
          son dos textos del mismo sitio. */}
      <NwtDatatableCell className="nwt-width-xs-17-5">
        <span>{permission.place || '—'}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-10">
        <span>{permission.hasLimit ? 'Con tope' : 'Sin tope'}</span>
      </NwtDatatableCell>

      {/* El icono es un upload_id: saber si existe es gratis, pero VERLO cuesta
          una petición para cambiarlo por una URL prefirmada. Por eso la columna
          solo dice si hay, y la miniatura se resuelve desde el menú de acciones,
          bajo demanda: pintarla por fila serían N peticiones en cada carga. */}
      <NwtDatatableCell className="nwt-width-xs-10">
        <span>{permission.fileIconUploadId ? 'Cargado' : '—'}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-12-5">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={getCatalogStatusTheme(permission.status)}
          vignette={true}
        >
          {/* En masculino: es «el permiso». */}
          {getCatalogStatusLabel(permission.status, 'masculino')}
        </NwtBadge>
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones de ${permission.name}`}
          actions={[
            {
              key: 'icon',
              icon: 'visibility-on',
              label: permission.fileIconUploadId
                ? 'Ver icono'
                : 'Sin icono cargado',
              disabled: !permission.fileIconUploadId,
              onClick: () => onViewIcon(permission)
            },
            // Sin accreditation:manage las escrituras son un 403 seguro, así que
            // no se ofrecen.
            ...(canManage
              ? [
                  {
                    key: 'edit',
                    icon: 'edit',
                    label: 'Editar',
                    disabled: working,
                    onClick: () => onEdit(permission)
                  },
                  {
                    key: 'state',
                    icon: permission.isActive ? 'padlock-close' : 'padlock-open',
                    label: permission.isActive ? 'Inactivar' : 'Activar',
                    disabled: working,
                    onClick: () => onToggle(permission)
                  }
                ]
              : [])
          ]}
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function AccessPermissionsTable({
  canManage,
  onEdit,
  onToggle,
  onViewIcon,
  permissions,
  working
}: AccessPermissionsTableProps) {
  return (
    <NwtDatatable
      header={
        <NwtDatatableHeader>
          <NwtDatatableTitle className="nwt-width-xs-20">
            Nombre del permiso
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-25">
            Descripción
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-17-5">
            Zona / sede
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Tope de usos
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Ícono
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Estado
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-align-right" actions={true} />
        </NwtDatatableHeader>
      }
    >
      {permissions.map((permission) => (
        <AccessPermissionsTableRow
          key={permission.id}
          canManage={canManage}
          onEdit={onEdit}
          onToggle={onToggle}
          onViewIcon={onViewIcon}
          permission={permission}
          working={working}
        />
      ))}
    </NwtDatatable>
  );
}
