import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';

// Cuántas filas por página, donde se puede elegir.
//
// No es solo comodidad: en «Gestión de acreditables» la selección se suelta al paginar —para
// que el botón no cuente a quien no se ve—, así que el tamaño de página ES el techo del lote.
// Con 30 se pueden acreditar 30 de una vez. El backend aguanta 100 por página y 500 ítems por
// llamada, o sea que el límite lo pone esta lista y no el contrato.
export const PAGE_SIZE_DEFAULT = 10;

// El rótulo va DENTRO de la opción para no gastar una etiqueta al lado, igual que los
// desplegables de filtro de las dos pantallas.
export const PAGE_SIZE_OPTIONS: NwtSelectOption<number>[] = [10, 20, 30].map(
  (size) => ({ key: String(size), label: `${size} por página`, value: size })
);
