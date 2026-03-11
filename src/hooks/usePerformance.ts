import { useState, useMemo, useCallback } from "react";

/**
 * Debounce hook for search inputs
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useMemo(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Client-side pagination hook
 */
export function usePagination<T>(items: T[], pageSize: number = 50) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  
  // Reset to page 1 when items change significantly
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(safeCurrentPage + 1);
  }, [safeCurrentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(safeCurrentPage - 1);
  }, [safeCurrentPage, goToPage]);

  // Reset when items change
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [items.length]);

  return {
    paginatedItems,
    currentPage: safeCurrentPage,
    totalPages,
    totalItems: items.length,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: safeCurrentPage < totalPages,
    hasPrevPage: safeCurrentPage > 1,
    startIndex: (safeCurrentPage - 1) * pageSize + 1,
    endIndex: Math.min(safeCurrentPage * pageSize, items.length),
  };
}
