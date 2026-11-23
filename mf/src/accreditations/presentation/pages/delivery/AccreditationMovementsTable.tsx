import type {
  Accreditation,
  AccreditationEvent
} from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  formatEventDateTime,
  getAccreditationActionLabel,
  getCatalogStatusLabel,
  getCatalogStatusTheme
} from '@mf-accreditations/presentation';
import {
  NwtBadge,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtTitle
} from '@naowee-tech/sdk-react-components';
import { memo } from 'react';

export interface AccreditationMovement {
  accreditation: Accreditation;
  event?: AccreditationEvent;
}

interface AccreditationMovementsTableProps {
  movements: AccreditationMovement[];
}

const MovementRow = memo(function MovementRow({
  accreditation,
  event
}: AccreditationMovement) {
  return (
    <NwtDatatableRecord>
      <NwtDatatableCell className="nwt-width-xs-5">
        <span>{accreditation.batchLabel}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-10">
        <span>{accreditation.accreditedType}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-20">
        <span className="nwt-text-font-medium">{accreditation.fullName}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-7-5">
        <span>{accreditation.document}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-10">
        <span>{formatCatalogDate(accreditation.expiresAt)}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-10">
        {/* El usado va en el span exterior (que recibe la elipsis del SDK) y el
            tope en uno anidado, más chico y gris, como el diseño. */}
        <span className="nws-accreditation-movements__validations">
          {accreditation.validationsLabel}
          <span>{`/${accreditation.validationLimit}`}</span>
        </span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-7-5">
        <span>{event ? getAccreditationActionLabel(event.action) : '—'}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-7-5">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={getCatalogStatusTheme(accreditation.status)}
          vignette={true}
        >
          {getCatalogStatusLabel(accreditation.status)}
        </NwtBadge>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-12-5">
        {/* Sin avatar, NwtTitle deja solo las dos líneas del diseño. */}
        <NwtTitle subtitle={event?.author}>
          {event ? formatEventDateTime(event.createdAt) : '—'}
        </NwtTitle>
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function AccreditationMovementsTable({
  movements
}: AccreditationMovementsTableProps) {
  return (
    <NwtDatatable
      header={
        <NwtDatatableHeader>
          <NwtDatatableTitle className="nwt-width-xs-5">Lote</NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Tipo
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-20">
            Nombre
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-7-5">
            Documento
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Vencimiento
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-10">
            Validaciones
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-7-5">
            Acciones
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-7-5">
            Estado
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-12-5">
            Última modificación
          </NwtDatatableTitle>
        </NwtDatatableHeader>
      }
    >
      {movements.map((movement) => (
        <MovementRow
          key={movement.accreditation.id}
          accreditation={movement.accreditation}
          event={movement.event}
        />
      ))}
    </NwtDatatable>
  );
}
