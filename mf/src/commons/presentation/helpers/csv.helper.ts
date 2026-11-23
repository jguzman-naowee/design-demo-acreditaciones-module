function escapeCell(value: string | number): string {
  const text = String(value);

  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// TODO(api): el reporte lo debería generar el backend; mientras tanto se arma
// en el cliente con lo que está en pantalla. Separador ';' para que Excel en
// español lo abra en columnas sin pedir importación.
export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(';'))
    .join('\n');

  // BOM: sin él Excel abre los acentos en latin-1 y rompe "Atlántico".
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
