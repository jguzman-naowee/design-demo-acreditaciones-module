import { NwsModal } from '@mf-accreditations/presentation';
import { NwtButton, NwtCheckBox } from '@naowee-tech/sdk-react-components';
import { useCallback, useEffect, useState } from 'react';

export interface AuditColumn {
  key: string;
  label: string;
}

interface AuditReportModalProps {
  columns: AuditColumn[];
  // Cuántos movimientos se llevaría el reporte: es lo FILTRADO, no todo.
  total: number;
  visible: boolean;
  onClose: () => void;
  onDownload: (keys: string[]) => void;
}

// Elegir qué columnas lleva el reporte antes de bajarlo.
//
// Es el criterio de la HU-18, y sale de una frase de Doug en la sesión: «le doy descargar
// reporte y escojo, dame esta columna, esta y esta». En las otras pantallas el reporte tiene
// columnas fijas porque las fijó la sesión; acá la auditoría son seis columnas de las que cada
// uno mira dos o tres distintas.
export function AuditReportModal({
  columns,
  total,
  visible,
  onClose,
  onDownload
}: AuditReportModalProps) {
  const [picked, setPicked] = useState<string[]>(() =>
    columns.map((column) => column.key)
  );

  // Al reabrir se vuelve a todas marcadas: la selección de la vez pasada no dice nada de lo
  // que se quiere ahora, y salir con una sola columna marcada y no acordarse es peor.
  useEffect(() => {
    if (visible) {
      setPicked(columns.map((column) => column.key));
    }
  }, [visible, columns]);

  const onToggle = useCallback((key: string) => {
    setPicked((actual) =>
      actual.includes(key)
        ? actual.filter((item) => item !== key)
        : [...actual, key]
    );
  }, []);

  return (
    <NwsModal
      className="nws-audit-report"
      title="Descargar reporte"
      subtitle={`${total} ${total === 1 ? 'movimiento' : 'movimientos'} · elige las columnas`}
      visible={visible}
      onClose={onClose}
      autoclose={true}
    >
      <div className="nws-audit-report__body">
        {/* Dos columnas, como el rediseño: seis casillas en una sola fila vertical dejaban el
            modal más alto que ancho por nada. */}
        <div className="nws-audit-report__columns">
          {columns.map((column) => (
            <label className="nws-audit-report__column" key={column.key}>
              <NwtCheckBox
                checked={picked.includes(column.key)}
                nwtSize="medium"
                onClick={() => onToggle(column.key)}
              />

              <span className="nwt-text-font-regular">{column.label}</span>
            </label>
          ))}
        </div>

        <footer className="nws-audit-report__footer">
          {/* Sin «Cancelar»: se cierra por la X o pulsando fuera, como el rediseño. Y sin
              ninguna columna marcada no se puede bajar un CSV que solo tendría filas vacías. */}
          <NwtButton
            icon="download"
            nwtVariant="loud"
            nwtSize="medium"
            disabled={!picked.length}
            onClick={() => onDownload(picked)}
          >
            Descargar
          </NwtButton>
        </footer>
      </div>
    </NwsModal>
  );
}
