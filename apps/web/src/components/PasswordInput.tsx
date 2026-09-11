import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputClassName?: string;
};

export function PasswordInput({
  className = "",
  inputClassName = "form-control form-control-lg bg-transparent border-secondary",
  ...inputProps
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input${className ? ` ${className}` : ""}`}>
      <input
        {...inputProps}
        className={inputClassName}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-input-toggle"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
      >
        <i
          className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
