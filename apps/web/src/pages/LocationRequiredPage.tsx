import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NoctaWordmark } from "../components/NoctaWordmark";

type Props = {
  reason: "gps" | "teleport";
  onRetry: () => void;
  busy?: boolean;
};

export function LocationRequiredPage({ reason, onRetry, busy }: Props) {
  const { user } = useAuth();
  const isPremium = Boolean(user?.premium);

  return (
    <div className="location-required-page fade-in">
      <div className="location-required-panel">
        <h1 className="display-6 auth-wordmark mb-2">
          <NoctaWordmark />
        </h1>
        {reason === "teleport" ? (
          <>
            <h2 className="h4 mb-2">Elegí una ciudad Teleport</h2>
            <p className="text-secondary mb-3">
              Tenés el modo Teleport activado, pero todavía no marcaste un
              punto en el mapa. Abrí Configuración, tocá el mapa y asignamos
              la ciudad registrada más cercana.
            </p>
            <div className="d-grid gap-2">
              <Link className="btn btn-primary btn-lg" to="/profile">
                Ir a mi perfil
              </Link>
              <button
                type="button"
                className="btn btn-outline-light"
                disabled={busy}
                onClick={onRetry}
              >
                Reintentar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="h4 mb-2">Necesitamos tu ubicación</h2>
            <p className="text-secondary mb-3">
              Para mostrarte Espacios, Nocta usa tu ubicación y te asigna la
              ciudad registrada más cercana. Sin ese permiso no podemos
              listar Espacios cerca tuyo.
            </p>
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={busy}
                onClick={onRetry}
              >
                {busy ? "Esperando…" : "Permitir ubicación"}
              </button>
              {isPremium && (
                <p className="small text-secondary mb-0 text-center">
                  ¿Preferís explorar otra ciudad? Activá{" "}
                  <strong>Modo Teleport</strong> desde Configuración en tu
                  perfil.
                </p>
              )}
              <Link className="btn btn-outline-light" to="/profile">
                Ir a mi perfil
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
