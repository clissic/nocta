import { useEffect, useState } from "react";
import type {
  AuthUser,
  FollowRequestItem,
  FollowRequestProfile,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { FollowRequestProfileModal } from "./FollowRequestProfileModal";
import { useToast } from "./ToastProvider";

type Props = {
  user: AuthUser;
  followRequests: FollowRequestItem[];
  requestBusyId: string | null;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onRespondRequest: (
    requestId: string,
    action: "accept" | "reject"
  ) => Promise<void>;
};

export function ProfileSettingsModal({
  user,
  followRequests,
  requestBusyId,
  onClose,
  onUserUpdated,
  onRespondRequest,
}: Props) {
  const toast = useToast();
  const [autoAccept, setAutoAccept] = useState(user.autoAcceptFollowRequests);
  const [hideActivity, setHideActivity] = useState(
    user.hideActivityFromFollowers
  );
  const [busyKey, setBusyKey] = useState<
    "autoAcceptFollowRequests" | "hideActivityFromFollowers" | null
  >(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [requestProfile, setRequestProfile] =
    useState<FollowRequestProfile | null>(null);
  const [requestProfileLoading, setRequestProfileLoading] = useState(false);

  useEffect(() => {
    setAutoAccept(user.autoAcceptFollowRequests);
    setHideActivity(user.hideActivityFromFollowers);
  }, [user.autoAcceptFollowRequests, user.hideActivityFromFollowers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedRequestId) {
        setSelectedRequestId(null);
        setRequestProfile(null);
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, selectedRequestId]);

  async function openRequestProfile(request: FollowRequestItem) {
    setSelectedRequestId(request.id);
    setRequestProfile(null);
    setRequestProfileLoading(true);
    try {
      const response = await api<{ profile: FollowRequestProfile }>(
        `/api/me/follow-requests/${request.id}/profile`
      );
      setRequestProfile(response.profile);
    } catch (err) {
      setSelectedRequestId(null);
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo cargar el perfil"
      );
    } finally {
      setRequestProfileLoading(false);
    }
  }

  async function patchSetting(
    key: "autoAcceptFollowRequests" | "hideActivityFromFollowers",
    value: boolean
  ) {
    setBusyKey(key);
    try {
      const response = await api<{ user: AuthUser }>("/api/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      onUserUpdated(response.user);
      toast.success("Configuración guardada");
    } catch (err) {
      if (key === "autoAcceptFollowRequests") setAutoAccept(!value);
      else setHideActivity(!value);
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar"
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      className="profile-connections-modal profile-settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="profile-connections-dialog">
        <header className="profile-connections-head">
          <h2 id="profile-settings-title">Configuración</h2>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="profile-connections-body profile-settings-body">
          <div className="form-check form-switch profile-settings-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="settings-auto-accept"
              checked={autoAccept}
              disabled={busyKey === "autoAcceptFollowRequests"}
              onChange={(event) => {
                const next = event.target.checked;
                setAutoAccept(next);
                void patchSetting("autoAcceptFollowRequests", next);
              }}
            />
            <label className="form-check-label" htmlFor="settings-auto-accept">
              Aceptar automáticamente las solicitudes de seguimiento
            </label>
          </div>

          <div className="form-check form-switch profile-settings-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="settings-hide-activity"
              checked={hideActivity}
              disabled={busyKey === "hideActivityFromFollowers"}
              onChange={(event) => {
                const next = event.target.checked;
                setHideActivity(next);
                void patchSetting("hideActivityFromFollowers", next);
              }}
            />
            <label
              className="form-check-label"
              htmlFor="settings-hide-activity"
            >
              Que quienes me siguen no vean mi actividad
            </label>
          </div>

          <section
            className="profile-settings-requests"
            aria-labelledby="profile-settings-requests-title"
          >
            <div className="profile-settings-section-head">
              <h3 id="profile-settings-requests-title">
                Solicitudes de seguimiento
              </h3>
              {followRequests.length > 0 && (
                <span className="profile-settings-count">
                  {followRequests.length}
                </span>
              )}
            </div>

            {followRequests.length === 0 ? (
              <p className="text-secondary small mb-0">
                No tenés solicitudes pendientes.
              </p>
            ) : (
              <ul className="profile-follow-request-list">
                {followRequests.map((request) => (
                  <li
                    key={request.id}
                    className="profile-follow-request-item"
                  >
                    <div className="profile-follow-request-user">
                      {request.fromUser.photo ? (
                        <img src={request.fromUser.photo} alt="" />
                      ) : (
                        <span aria-hidden="true">
                          {request.fromUser.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="profile-follow-request-name"
                          onClick={() => void openRequestProfile(request)}
                        >
                          {request.fromUser.name}
                        </button>
                        {typeof request.fromUser.age === "number" && (
                          <span className="text-secondary small">
                            {" "}
                            · {request.fromUser.age}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="profile-follow-request-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={requestBusyId === request.id}
                        onClick={() =>
                          void onRespondRequest(request.id, "accept")
                        }
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light"
                        disabled={requestBusyId === request.id}
                        onClick={() =>
                          void onRespondRequest(request.id, "reject")
                        }
                      >
                        Rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {selectedRequestId && (
        <FollowRequestProfileModal
          profile={requestProfile}
          loading={requestProfileLoading}
          onClose={() => {
            setSelectedRequestId(null);
            setRequestProfile(null);
          }}
        />
      )}
    </div>
  );
}
