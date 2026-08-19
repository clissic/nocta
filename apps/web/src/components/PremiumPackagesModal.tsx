import { useEffect } from "react";
import { createPortal } from "react-dom";
import { OverflowFade } from "./OverflowFade";
import { useToast } from "./ToastProvider";

const PACKAGES = [
  {
    name: "Premium mensual",
    price: "1 mes",
    cadence: "Renovación mensual",
    description: "Probá todos los beneficios Premium sin permanencia.",
    featured: false,
  },
  {
    name: "Premium trimestral",
    price: "3 meses",
    cadence: "Renovación trimestral",
    description: "La opción más elegida para vivir más noches Nocta.",
    featured: true,
  },
  {
    name: "Premium anual",
    price: "12 meses",
    cadence: "Renovación anual",
    description: "El mejor precio para disfrutar Premium todo el año.",
    featured: false,
  },
] as const;

type Props = {
  onClose: () => void;
};

export function PremiumPackagesModal({ onClose }: Props) {
  const toast = useToast();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="premium-packages-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-packages-title"
    >
      <button
        type="button"
        className="premium-packages-backdrop"
        aria-label="Cerrar opciones Premium"
        onClick={onClose}
      />
      <div className="premium-packages-dialog">
        <OverflowFade>
          <header className="premium-packages-head">
          <div>
            <p className="premium-packages-eyebrow">Nocta Premium</p>
            <h2 id="premium-packages-title">Descubrí quién te dio like</h2>
          </div>
          <button
            type="button"
            className="premium-packages-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <p className="premium-packages-intro">
          Elegí un paquete para revelar las fotos de tus likes y acceder
          directamente a sus perfiles completos.
        </p>

        <div className="premium-packages-grid">
          {PACKAGES.map((item) => (
            <article
              key={item.name}
              className={`premium-package${item.featured ? " is-featured" : ""}`}
            >
              {item.featured && (
                <span className="premium-package-badge">Más elegido</span>
              )}
              <h3>{item.name}</h3>
              <p className="premium-package-price">{item.price}</p>
              <p className="premium-package-cadence">{item.cadence}</p>
              <p className="premium-package-description">{item.description}</p>
              <button
                type="button"
                className={`btn ${item.featured ? "btn-primary" : "btn-outline-light"}`}
                onClick={() =>
                  toast.info("La compra de Premium estará disponible próximamente")
                }
              >
                Elegir paquete
              </button>
            </article>
          ))}
        </div>
        </OverflowFade>
      </div>
    </div>,
    document.body
  );
}
