import { useCallback, useMemo, useState } from 'react';

interface CatalogPage<T> {
  page: number;
  pageItems: T[];
  setPage: (page: number) => void;
  totalPages: number;
}

// Paginación en cliente para los catálogos mock. `page` se recorta al total
// para que al filtrar no quede apuntando a una página que ya no existe.
export function useCatalogPage<T>(items: T[], pageSize = 10): CatalogPage<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / pageSize);
  const page = Math.min(currentPage, totalPages || 1);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;

    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = useCallback((next: number) => {
    setCurrentPage(next);
  }, []);

  return { page, pageItems, setPage, totalPages };
}
