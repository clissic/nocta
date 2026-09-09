import { useEffect, useId, useRef, useState } from "react";
import { ManualSearchInput } from "../ManualSearchInput";
import { OverflowFade } from "../OverflowFade";

export type AdminSearchSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type AdminSearchSelectProps = {
  label: string;
  value: string;
  options: AdminSearchSelectOption[];
  query: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
};

export function AdminSearchSelect({
  label,
  value,
  options,
  query,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loading = false,
  onChange,
  onQueryChange,
  onSearch,
}: AdminSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="admin-search-select admin-field" ref={rootRef}>
      <span>{label}</span>
      <button
        className="admin-search-select-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? undefined : "text-secondary"}>
          {selected?.label ?? placeholder}
        </span>
        <i
          className={`bi bi-chevron-${open ? "up" : "down"}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="admin-search-select-menu">
          <ManualSearchInput
            value={query}
            onValueChange={onQueryChange}
            onSearch={onSearch}
            placeholder={searchPlaceholder}
            ariaLabel={`Buscar ${label.toLowerCase()}`}
          />
          <OverflowFade
            id={listId}
            className="admin-search-select-options"
            role="listbox"
            aria-label={label}
          >
            {loading ? (
              <p className="text-secondary small mb-0 px-2 py-3">Buscando…</p>
            ) : options.length === 0 ? (
              <p className="text-secondary small mb-0 px-2 py-3">
                {emptyMessage}
              </p>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  className={`admin-search-select-option${
                    option.value === value ? " is-selected" : ""
                  }`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {option.meta && <small>{option.meta}</small>}
                  {option.value === value && (
                    <i className="bi bi-check2" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
          </OverflowFade>
        </div>
      )}
    </div>
  );
}
