import type { AccreditedRecord } from '@mf-accreditations/domain';
import {
  CREDENTIAL_ACTION_VISIBLE,
  formatCatalogDate,
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

interface AccessControlTableProps {
  // La última lectura de cada acreditación, por su código. Sin lecturas todavía, no hay fecha.
  lastReads: Record<string, Date>;
  // El tope de validaciones de cada tipo de acreditado, por su `role_code`.
  limits: Record<string, number | null>;
  onViewDetail: (record: AccreditedRecord) => void;
  onViewProfile: (record: AccreditedRecord) => void;
  records: AccreditedRecord[];
  // El diseño numera las filas de la página, como el detalle del lote.
  startAt: number;
}

interface AccessRowProps {
  lastRead?: Date;
  limit: number | null;
  number: number;
  onViewDetail: (record: AccreditedRecord) => void;
  onViewProfile: (record: AccreditedRecord) => void;
  record: AccreditedRecord;
}

const AccessRow = memo(function AccessRow({
  lastRead,
  limit,
  number,
  onViewDetail,
  onViewProfile,
  record
}: AccessRowProps) {
  return (
    <NwtDatatableRecord>
      <NwtDatatableCell className="nwt-width-xs-10">
        <span>{String(number).padStart(2, '0')}</span>
      </NwtDatatableCell>

      {/* TODO(api): el diseño pide un consecutivo de la validación («00000001») y el contrato
          no lo tiene: la acreditación se identifica por un uuid y las lecturas no traen id.
          Pedido a backend; hasta entonces, raya —poner el uuid acá invitaría a dictarlo por
          teléfono como si fuera un consecutivo—. */}
      <NwtDatatableCell className="nwt-width-xs-10">
        <span>—</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-22-5">
        <span className="nwt-text-font-medium">{record.fullName}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-15">
        <span>{record.document}</span>
      </NwtDatatableCell>

      {/* Los usos consumidos sobre el tope del tipo. Sin tope no hay denominador: el permiso
          se puede leer las veces que haga falta, y un «/0» diría lo contrario. */}
      <NwtDatatableCell className="nwt-width-xs-12-5">
        <span className="nws-access-control__validations">
          {record.usesConsumed}
          {limit === null ? (
            <span> · sin tope</span>
          ) : (
            <span>{`/${limit}`}</span>
          )}
        </span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-15">
        <span>{lastRead ? formatCatalogDate(lastRead) : 'Sin leer'}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-12-5">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={getCatalogStatusTheme(record.status)}
          vignette={true}
        >
          {getCatalogStatusLabel(record.status)}
        </NwtBadge>
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        <NwsRowActionsMenu
          ariaLabel={`Acciones de ${record.fullName}`}
          actions={[
            {
              key: 'detail',
              icon: 'visibility-on',
              label: 'Ver detalle',
              onClick: () => onViewDetail(record)
            },
            // OCULTO TEMPORALMENTE (Andrés, 2026-09-08): «Ver credencial» no va por
            // ahora, y esta acción es la MISMA salida con otro rótulo —«Ver perfil
            // público»— hacia `/profile/event/:code`. Se oculta por coherencia: dejarla
            // viva sería el único camino que queda a la credencial.
            //
            // Ojo: esta pantalla ya está `PRÓXIMA A BORRAR` (2026-09-03) y corre contra
            // mocks, así que hoy no la ve nadie salvo por URL. Se marca igual para que,
            // si la pantalla sobrevive, no reaparezca la salida sin querer.
            //
            // Volver = poner la constante en `true`; el detalle completo está donde
            // se declara.
            ...(CREDENTIAL_ACTION_VISIBLE
              ? [
                  {
                    key: 'profile',
                    icon: 'user',
                    label: 'Ver perfil público',
                    onClick: () => onViewProfile(record)
                  }
                ]
              : [])
          ]}
        />
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function AccessControlTable({
  lastReads,
  limits,
  onViewDetail,
  onViewProfile,
  records,
  startAt
}: AccessControlTableProps) {
  return (
    <NwtDatatable
      header={
        <NwtDatatableHeader>
          <NwtDatatableTitle className="nwt-width-xs-10">
            No. de validación
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Id de la validación
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-22-5">
            Nombre
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-15">
            Documento
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Validaciones
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-15">
            Fecha de lectura
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Estado
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-align-right" actions={true} />
        </NwtDatatableHeader>
      }
    >
      {records.map((record, index) => (
        <AccessRow
          key={record.id}
          record={record}
          lastRead={lastReads[String(record.id)]}
          limit={limits[record.roleCode] ?? null}
          number={startAt + index}
          onViewDetail={onViewDetail}
          onViewProfile={onViewProfile}
        />
      ))}
    </NwtDatatable>
  );
}
