export const ADMIN_PAGE_SIZE = 10;

type AdminPaginationProps = {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label: string;
};

export function AdminPagination({
  page,
  totalItems,
  onPageChange,
  label,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <nav className="admin-pagination" aria-label={label}>
      <button
        className="btn btn-sm btn-outline-secondary"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <i className="bi bi-chevron-left" aria-hidden="true" />
        <span>Anterior</span>
      </button>
      <span className="admin-pagination-status">
        Página {page} de {totalPages}
      </span>
      <button
        className="btn btn-sm btn-outline-secondary"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <span>Siguiente</span>
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
    </nav>
  );
}
