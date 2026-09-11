import { useState, type ReactNode } from "react";

type AdminFiltersAccordionProps = {
  children: ReactNode;
  /** Cantidad de filtros activos (badge en el toggle). */
  activeCount?: number;
  defaultOpen?: boolean;
  title?: string;
  className?: string;
};

export function AdminFiltersAccordion({
  children,
  activeCount = 0,
  defaultOpen,
  title = "Filtros",
  className = "",
}: AdminFiltersAccordionProps) {
  const [open, setOpen] = useState(
    () => defaultOpen ?? activeCount > 0
  );

  return (
    <div
      className={`admin-filters-accordion${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`admin-filters-accordion-toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="admin-filters-accordion-title">
          <i className="bi bi-funnel" aria-hidden="true" />
          {title}
          {activeCount > 0 ? (
            <span className="admin-filters-accordion-badge">{activeCount}</span>
          ) : null}
        </span>
        <i
          className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="admin-filters-accordion-panel">{children}</div>
      ) : null}
    </div>
  );
}
