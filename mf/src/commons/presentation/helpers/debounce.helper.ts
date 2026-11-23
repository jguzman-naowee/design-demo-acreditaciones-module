import { useEffect, useState } from 'react';

export const SEARCH_MIN_LENGTH = 3;

// Los filtros del gateway se aplican con una petición, así que el texto del
// buscador no puede disparar una por tecla.
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// El término que viaja al servidor: con debounce y solo desde el mínimo de caracteres.
// Por debajo queda vacío, o sea «sin búsqueda», igual que con el campo limpio.
export function useSearchTerm(
  text: string,
  minLength = SEARCH_MIN_LENGTH
): string {
  const term = useDebounced(text.trim());

  return term.length >= minLength ? term : '';
}
