import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Popover from "bootstrap/js/dist/popover";

type Props = {
  followRequestCount: number;
  onOpenSettings: () => void;
  onOpenFollowRequests: () => void;
  onOpenLogout: () => void;
};

const DESKTOP_MQ = "(min-width: 992px)";

export function ProfileActionButtons({
  followRequestCount,
  onOpenSettings,
  onOpenFollowRequests,
  onOpenLogout,
}: Props) {
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    let popovers: Popover[] = [];

    function setup() {
      popovers.forEach((popover) => popover.dispose());
      popovers = [];
      if (!mq.matches) return;

      const elements =
        groupRef.current?.querySelectorAll<HTMLElement>(
          "[data-bs-toggle='popover']"
        );
      popovers = [...(elements ?? [])].map(
        (element) =>
          new Popover(element, {
            container: "body",
            placement: "top",
            trigger: "hover focus",
          })
      );
    }

    setup();
    mq.addEventListener("change", setup);
    return () => {
      mq.removeEventListener("change", setup);
      popovers.forEach((popover) => popover.dispose());
    };
  }, []);

  const popoverProps = (content: string) => ({
    "data-bs-toggle": "popover",
    "data-bs-content": content,
  });

  return (
    <div className="profile-name-actions" ref={groupRef}>
      <button
        type="button"
        className="btn btn-outline-light profile-action-btn"
        aria-label="Configuración"
        onClick={onOpenSettings}
        {...popoverProps("Configuración del perfil")}
      >
        <i className="bi bi-gear" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-outline-light profile-action-btn profile-settings-trigger"
        aria-label="Solicitudes de seguimiento"
        onClick={onOpenFollowRequests}
        {...popoverProps("Solicitudes de seguimiento")}
      >
        <i className="bi bi-person-plus" aria-hidden="true" />
        {followRequestCount > 0 && (
          <span
            className="profile-settings-alert"
            aria-label={`${followRequestCount} solicitudes pendientes`}
          >
            {followRequestCount}
          </span>
        )}
      </button>
      <Link
        className="btn btn-outline-light profile-action-btn"
        to="/onboarding?edit=1"
        aria-label="Editar perfil"
        {...popoverProps("Editar perfil")}
      >
        <i className="bi bi-pencil" aria-hidden="true" />
      </Link>
      <button
        type="button"
        className="btn profile-action-btn profile-action-logout"
        aria-label="Cerrar sesión"
        onClick={onOpenLogout}
        {...popoverProps("Cerrar sesión")}
      >
        <i className="bi bi-box-arrow-right" aria-hidden="true" />
      </button>
    </div>
  );
}
