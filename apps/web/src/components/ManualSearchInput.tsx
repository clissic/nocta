import type { KeyboardEvent } from "react";

type ManualSearchInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  id?: string;
  className?: string;
  inputClassName?: string;
};

export function ManualSearchInput({
  value,
  onValueChange,
  onSearch,
  placeholder,
  ariaLabel,
  id,
  className = "",
  inputClassName = "",
}: ManualSearchInputProps) {
  function submit() {
    onSearch(value.trim());
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit();
  }

  return (
    <div
      className={`input-group nocta-manual-search${className ? ` ${className}` : ""}`}
      role="search"
    >
      <button
        type="button"
        className="btn btn-outline-secondary nocta-manual-search-submit"
        aria-label={ariaLabel}
        title="Buscar"
        onClick={submit}
      >
        <i className="bi bi-search" aria-hidden="true" />
      </button>
      <input
        id={id}
        type="search"
        className={`form-control${inputClassName ? ` ${inputClassName}` : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          className="btn btn-outline-secondary nocta-manual-search-clear"
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
          onClick={() => {
            onValueChange("");
            onSearch("");
          }}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
