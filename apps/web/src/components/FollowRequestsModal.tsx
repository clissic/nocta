import { useEffect, useState } from "react";
import type {
  FollowRequestItem,
  FollowRequestProfile,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { FollowRequestProfileModal } from "./FollowRequestProfileModal";
import { OverflowFade } from "./OverflowFade";
import { useToast } from "./ToastProvider";

type Props = {
  requests: FollowRequestItem[];
  busyRequestId: string | null;
  onClose: () => void;
  onRespond: (
    requestId: string,
    action: "accept" | "reject"
  ) => Promise<void>;
};

export function FollowRequestsModal({
  requests,
  busyRequestId,
  onClose,
  onRespond,
}: Props) {
  const toast = useToast();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [requestProfile, setRequestProfile] =
    useState<FollowRequestProfile | null>(null);
  const [requestProfileLoading, setRequestProfileLoading] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
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
      document.body.style.overflow = previousOverflow;
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

  return (
    <div
      className="profile-connections-modal profile-follow-requests-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-requests-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="profile-connections-dialog">
        <header className="profile-connections-head">
          <div className="profile-settings-section-head">
            <h2 id="follow-requests-title">Solicitudes de seguimiento</h2>
            {requests.length > 0 && (
              <span className="profile-settings-count">{requests.length}</span>
            )}
          </div>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <OverflowFade className="profile-connections-body">
          {requests.length === 0 ? (
            <p className="text-secondary small mb-0">
              No tenés solicitudes pendientes.
            </p>
          ) : (
            <ul className="profile-follow-request-list">
              {requests.map((request) => (
                <li key={request.id} className="profile-follow-request-item">
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
                      disabled={busyRequestId === request.id}
                      onClick={() => void onRespond(request.id, "accept")}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      disabled={busyRequestId === request.id}
                      onClick={() => void onRespond(request.id, "reject")}
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OverflowFade>
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
