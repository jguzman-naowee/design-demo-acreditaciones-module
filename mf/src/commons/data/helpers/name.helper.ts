// Los nombres que el backend arma juntando partes.
//
// Medido en staging el 2026-09-03: `changed_by_name` de un movimiento nuevo llegó como
// «Juan  Armero » —doble espacio en medio y uno al final—, porque el backend concatena
// nombre + segundo nombre + apellido + segundo apellido con espacios aunque las partes
// intermedias vengan vacías.
//
// Se limpia acá, en la frontera de datos, y no en cada pantalla: el mismo defecto puede venir
// en cualquier campo compuesto, y un doble espacio no se nota en una revisión visual pero sí
// en un `===` de una prueba o en un CSV.
export function cleanName(value?: string | null): string | null {
  const limpio = (value ?? '').replace(/\s+/g, ' ').trim();

  return limpio || null;
}
