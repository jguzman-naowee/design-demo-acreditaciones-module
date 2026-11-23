import { getInitials } from '@naowee-tech/sdk-frontend-web';
import type { NwtTheme } from '@naowee-tech/sdk-react-components';
import {
  NwtAvatarIcon,
  NwtBadge,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtTitle,
  NwtTooltip
} from '@naowee-tech/sdk-react-components';
import { memo } from 'react';

// Una fila del historial, ya resuelta para mostrar.
//
// La tabla no habla de acreditaciones, de auditoría ni de validaciones a propósito: la usan TRES
// pantallas —el detalle con datos de demo, el detalle real que lee la auditoría, y el historial
// de accesos que lee las lecturas del punto de acceso— y sus fuentes no tienen ni los mismos
// campos ni los mismos códigos. Con una fila neutral, las tres se ven igual y no pueden
// separarse con el tiempo. Por eso vive en `commons` y no en la carpeta de una de ellas.
export interface NwsHistoryRow {
  // Qué se hizo, ya traducido, con el color de su badge.
  action: string;
  actionTheme: NwtTheme;
  // Quién lo hizo. Vacío cuando no se pudo resolver: el movimiento se muestra igual, sin
  // inventar un autor.
  author: string;
  // Cuándo, ya formateado: cada pantalla tiene su propio formato de fecha.
  at: string;
  detail: string;
  id: string;
  // La observación que alguien escribió. Es la que enciende el aviso rojo del final de la fila.
  note?: string;
  type: string;
}

interface NwsHistoryTableProps {
  // El rótulo de la última columna. El diseño la llama «Última modificación» en el historial de
  // la acreditación y «Fecha de validación» en el de accesos: es la misma columna con otro
  // nombre, así que la tabla sigue siendo una.
  dateLabel?: string;
  rows: NwsHistoryRow[];
}

const HistoryRow = memo(function HistoryRow({ row }: { row: NwsHistoryRow }) {
  return (
    <NwtDatatableRecord>
      <NwtDatatableCell className="nwt-width-xs-22-5">
        <span>{row.type}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-20">
        <NwtBadge
          nwtVariant="quiet"
          nwtTheme={row.actionTheme}
          vignette={true}
        >
          {row.action}
        </NwtBadge>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-22-5">
        <span>{row.detail}</span>
      </NwtDatatableCell>

      <NwtDatatableCell className="nwt-width-xs-35">
        {/* Con autor, el par avatar + nombre del diseño. Sin autor solo la fecha: un avatar con
            las iniciales de un uuid no le dice nada a nadie.

            NwtTitle fija el avatar en quiet sin color, así que toma el tema por defecto
            (naranja); el tema lo tiñe de azul como el diseño. */}
        {row.author ? (
          <NwtTitle
            avatar={getInitials(row.author)}
            subtitle={row.author}
            nwtTheme="informative"
          >
            {row.at}
          </NwtTitle>
        ) : (
          <span>{row.at}</span>
        )}
      </NwtDatatableCell>

      <NwtDatatableCell actions className="nwt-align-right">
        {/* Solo los movimientos con observación traen indicador. El tooltip va a la
            izquierda: no se portaliza y el datatable recorta con overflow. */}
        {!!row.note && (
          <NwtTooltip content={row.note} position="left">
            <NwtAvatarIcon
              className="nws-accreditation-history__note"
              icon="caution"
              nwtTheme="negative"
            />
          </NwtTooltip>
        )}
      </NwtDatatableCell>
    </NwtDatatableRecord>
  );
});

export function NwsHistoryTable({
  dateLabel = 'Última modificación',
  rows
}: NwsHistoryTableProps) {
  return (
    <NwtDatatable
      header={
        <NwtDatatableHeader>
          <NwtDatatableTitle className="nwt-width-xs-22-5">
            Tipo de acreditado
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-20">
            Acción
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-22-5">
            Detalle
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-width-xs-35">
            {dateLabel}
          </NwtDatatableTitle>
          <NwtDatatableTitle className="nwt-align-right" actions={true} />
        </NwtDatatableHeader>
      }
    >
      {rows.map((row) => (
        <HistoryRow key={row.id} row={row} />
      ))}
    </NwtDatatable>
  );
}
