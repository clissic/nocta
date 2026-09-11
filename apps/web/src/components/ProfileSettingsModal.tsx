import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  MAX_IDENTITY_VERIFICATION_FILE_BYTES,
  PREMIUM_PLANS,
  type AuthUser,
  type PremiumPlanId,
} from "@nocta/shared";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { OverflowFade } from "./OverflowFade";
import { useToast } from "./ToastProvider";
import { NoctaWordmark } from "./NoctaWordmark";
import { PremiumPackagesModal } from "./PremiumPackagesModal";
import { LocationPickerMap, type MapCoords } from "./LocationPickerMap";
import { defaultMapCenter } from "../lib/venueCity";
import { fetchNearestAppCity } from "../lib/appCities";

type Props = {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
};

type SettingKey =
  | "autoAcceptFollowRequests"
  | "showActivityToFollowers"
  | "rogueMode"
  | "teleportMode"
  | "discoverDisabled";

const PLAN_PILL_CLASS: Record<PremiumPlanId, string> = {
  nocta_2am: "is-2am",
  nocta_4am: "is-4am",
  nocta_6am: "is-6am",
};

const PLAN_PILL_LABEL: Record<PremiumPlanId, string> = {
  nocta_2am: "2 AM",
  nocta_4am: "4 AM",
  nocta_6am: "6 AM",
};

const MAX_MB = Math.round(MAX_IDENTITY_VERIFICATION_FILE_BYTES / (1024 * 1024));

export function ProfileSettingsModal({
  user,
  onClose,
  onUserUpdated,
}: Props) {
  const toast = useToast();
  const [autoAccept, setAutoAccept] = useState(user.autoAcceptFollowRequests);
  const [showActivity, setShowActivity] = useState(
    user.showActivityToFollowers
  );
  const [rogueMode, setRogueMode] = useState(Boolean(user.rogueMode));
  const [teleportMode, setTeleportMode] = useState(Boolean(user.teleportMode));
  const [discoverDisabled, setDiscoverDisabled] = useState(
    Boolean(user.discoverDisabled)
  );
  const [busyKey, setBusyKey] = useState<SettingKey | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumInitialPlanId, setPremiumInitialPlanId] =
    useState<PremiumPlanId | null>(null);
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [teleportPin, setTeleportPin] = useState<MapCoords | null>(
    user.teleportCity
      ? { lat: user.teleportCity.lat, lng: user.teleportCity.lng }
      : null
  );
  const [teleportBusy, setTeleportBusy] = useState(false);
  const [previewTeleportCity, setPreviewTeleportCity] = useState<{
    country: string;
    city: string;
    lat: number;
    lng: number;
  } | null>(user.teleportCity ?? null);

  const verificationStatus = user.identityVerification?.status ?? "none";
  const mapCenter = useMemo(() => {
    if (teleportPin) return teleportPin;
    if (user.teleportCity) {
      return { lat: user.teleportCity.lat, lng: user.teleportCity.lng };
    }
    const fallback = defaultMapCenter();
    return { lat: fallback.lat, lng: fallback.lng };
  }, [teleportPin, user.teleportCity]);

  useEffect(() => {
    if (!teleportPin) {
      setPreviewTeleportCity(user.teleportCity ?? null);
      return;
    }
    let alive = true;
    void fetchNearestAppCity(teleportPin.lat, teleportPin.lng)
      .then((nearest) => {
        if (!alive) return;
        setPreviewTeleportCity({
          country: nearest.country,
          city: nearest.city,
          lat: teleportPin.lat,
          lng: teleportPin.lng,
        });
      })
      .catch(() => {
        if (!alive) return;
        setPreviewTeleportCity(null);
      });
    return () => {
      alive = false;
    };
  }, [teleportPin, user.teleportCity]);

  useEffect(() => {
    setAutoAccept(user.autoAcceptFollowRequests);
    setShowActivity(user.showActivityToFollowers);
    setRogueMode(Boolean(user.rogueMode));
    setTeleportMode(Boolean(user.teleportMode));
    setDiscoverDisabled(Boolean(user.discoverDisabled));
    if (user.teleportCity) {
      setTeleportPin({
        lat: user.teleportCity.lat,
        lng: user.teleportCity.lng,
      });
    }
  }, [
    user.autoAcceptFollowRequests,
    user.showActivityToFollowers,
    user.rogueMode,
    user.teleportMode,
    user.discoverDisabled,
    user.teleportCity,
  ]);

  useEffect(() => {
    if (!documentFront) {
      setDocumentPreview(null);
      return;
    }
    const url = URL.createObjectURL(documentFront);
    setDocumentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [documentFront]);

  useEffect(() => {
    if (!selfie) {
      setSelfiePreview(null);
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !premiumModalOpen) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, premiumModalOpen]);

  function pickFile(
    file: File | null | undefined,
    setter: (file: File | null) => void,
    label: string
  ) {
    if (!file) {
      setter(null);
      return;
    }
    if (file.size > MAX_IDENTITY_VERIFICATION_FILE_BYTES) {
      toast.error(`${label}: máximo ${MAX_MB} MB`);
      return;
    }
    const okType = ["image/jpeg", "image/png", "image/webp"].includes(
      file.type.toLowerCase()
    );
    if (!okType) {
      toast.error(`${label}: usá JPG, PNG o WebP`);
      return;
    }
    setter(file);
  }

  async function patchSetting(key: SettingKey, value: boolean) {
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
      else if (key === "showActivityToFollowers") setShowActivity(!value);
      else if (key === "rogueMode") setRogueMode(!value);
      else if (key === "teleportMode") setTeleportMode(!value);
      else if (key === "discoverDisabled") setDiscoverDisabled(!value);
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar"
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function saveTeleportPin(coords: MapCoords) {
    setTeleportPin(coords);
    setTeleportBusy(true);
    try {
      const response = await api<{ user: AuthUser }>(
        "/api/me/teleport-location",
        {
          method: "PUT",
          body: JSON.stringify(coords),
        }
      );
      onUserUpdated(response.user);
      toast.success(
        response.user.teleportCity
          ? `Explorando ${response.user.teleportCity.city}, ${response.user.teleportCity.country}`
          : "Ubicación Teleport guardada"
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar la ubicación"
      );
    } finally {
      setTeleportBusy(false);
    }
  }

  async function onSubmitVerification(e: FormEvent) {
    e.preventDefault();
    if (!documentFront) {
      toast.error("Elegí la foto del documento");
      return;
    }
    if (!selfie) {
      toast.error("Elegí la selfie con el documento");
      return;
    }

    setVerifyBusy(true);
    try {
      const form = new FormData();
      form.append("documentFront", documentFront);
      form.append("selfieWithDocument", selfie);
      const response = await api<{ user: AuthUser }>(
        "/api/me/identity-verification",
        { method: "POST", body: form }
      );
      onUserUpdated(response.user);
      setDocumentFront(null);
      setSelfie(null);
      toast.success("Solicitud enviada. La revisaremos pronto.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar"
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <>
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

          <OverflowFade className="profile-connections-body profile-settings-body">
            <section
              className="profile-settings-premium"
              aria-labelledby="settings-premium-heading"
            >
              <h3 id="settings-premium-heading">Nocta Premium</h3>
              <div
                className="profile-settings-premium-grid"
                role="group"
                aria-label="Planes Premium"
              >
                {PREMIUM_PLANS.map((plan) => {
                  const disabled = plan.comingSoon;
                  const isCurrent =
                    user.premium && user.premiumPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`profile-settings-plan${
                        isCurrent ? " is-current" : ""
                      }`}
                      disabled={disabled}
                      aria-label={
                        disabled
                          ? `${plan.name}, próximamente`
                          : isCurrent
                            ? `${plan.name}, tu plan actual — ver catálogo`
                            : `Ver catálogo de ${plan.name}`
                      }
                      onClick={() => {
                        if (disabled) return;
                        setPremiumInitialPlanId(plan.id);
                        setPremiumModalOpen(true);
                      }}
                    >
                      <NoctaWordmark className="profile-settings-plan-wordmark" />
                      <span
                        className={`profile-settings-plan-pill ${PLAN_PILL_CLASS[plan.id]}`}
                      >
                        {PLAN_PILL_LABEL[plan.id]}
                      </span>
                      <span className="profile-settings-plan-tagline">
                        {plan.tagline}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              className="profile-settings-verification"
              aria-labelledby="settings-verification-heading"
            >
              <h3 id="settings-verification-heading">Verificación</h3>
              <p className="profile-settings-verification-copy">
                Subí la parte frontal de tu DNI o la página de datos de tu
                pasaporte, y una selfie sosteniendo el mismo documento. Un
                administrador de Nocta revisará tu solicitud.
              </p>

              {verificationStatus === "approved" || user.identityVerified ? (
                <p className="profile-settings-verified mb-0">
                  <i className="bi bi-patch-check-fill" aria-hidden="true" />
                  <span>Cuenta verificada</span>
                </p>
              ) : verificationStatus === "pending" ? (
                <p className="text-secondary small mb-0">
                  Solicitud en revisión. Te avisamos cuando haya una
                  respuesta.
                </p>
              ) : (
                <form
                  className="profile-settings-verification-form d-grid gap-2"
                  onSubmit={onSubmitVerification}
                >
                  {verificationStatus === "rejected" &&
                    user.identityVerification?.rejectionReason && (
                      <p className="small text-danger mb-0">
                        No aprobada:{" "}
                        {user.identityVerification.rejectionReason}
                      </p>
                    )}
                  <div className="profile-settings-verification-uploads">
                    <div className="profile-settings-verification-slot">
                      {documentPreview ? (
                        <div className="profile-settings-verification-thumb">
                          <img src={documentPreview} alt="" />
                          <button
                            type="button"
                            className="profile-settings-verification-remove"
                            aria-label="Quitar documento"
                            disabled={verifyBusy}
                            onClick={() => setDocumentFront(null)}
                          >
                            <i className="bi bi-x" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`profile-settings-verification-add${
                            verifyBusy ? " is-disabled" : ""
                          }`}
                        >
                          <input
                            type="file"
                            className="visually-hidden"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={verifyBusy}
                            onChange={(event) => {
                              pickFile(
                                event.target.files?.[0],
                                setDocumentFront,
                                "Documento"
                              );
                              event.target.value = "";
                            }}
                          />
                          <i className="bi bi-person-vcard" aria-hidden="true" />
                          <span>Documento</span>
                        </label>
                      )}
                      <span className="profile-settings-verification-slot-label">
                        Frente del DNI / pasaporte
                      </span>
                    </div>

                    <div className="profile-settings-verification-slot">
                      {selfiePreview ? (
                        <div className="profile-settings-verification-thumb">
                          <img src={selfiePreview} alt="" />
                          <button
                            type="button"
                            className="profile-settings-verification-remove"
                            aria-label="Quitar selfie"
                            disabled={verifyBusy}
                            onClick={() => setSelfie(null)}
                          >
                            <i className="bi bi-x" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`profile-settings-verification-add${
                            verifyBusy ? " is-disabled" : ""
                          }`}
                        >
                          <input
                            type="file"
                            className="visually-hidden"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={verifyBusy}
                            onChange={(event) => {
                              pickFile(
                                event.target.files?.[0],
                                setSelfie,
                                "Selfie"
                              );
                              event.target.value = "";
                            }}
                          />
                          <i className="bi bi-camera" aria-hidden="true" />
                          <span>Selfie</span>
                        </label>
                      )}
                      <span className="profile-settings-verification-slot-label">
                        Selfie con el documento
                      </span>
                    </div>
                  </div>
                  <p className="small text-secondary mb-0">
                    Máximo {MAX_MB} MB por archivo · JPG, PNG o WebP
                  </p>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={verifyBusy}
                  >
                    {verifyBusy ? "Enviando…" : "Enviar para verificar"}
                  </button>
                </form>
              )}
            </section>

            <section className="profile-settings-privacy">
              <h3>Privacidad y seguridad</h3>

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
                <label
                  className="form-check-label"
                  htmlFor="settings-auto-accept"
                >
                  Aceptar automáticamente las solicitudes de seguimiento
                </label>
              </div>

              <div className="form-check form-switch profile-settings-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="settings-show-activity"
                  checked={showActivity}
                  disabled={busyKey === "showActivityToFollowers"}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setShowActivity(next);
                    void patchSetting("showActivityToFollowers", next);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="settings-show-activity"
                >
                  Que quienes me siguen vean mi actividad
                </label>
              </div>

              <div className="form-check form-switch profile-settings-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="settings-rogue-mode"
                  checked={rogueMode}
                  disabled={busyKey === "rogueMode"}
                  onChange={(event) => {
                    const next = event.target.checked;
                    if (next && !user.premium) {
                      setPremiumInitialPlanId(null);
                      setPremiumModalOpen(true);
                      return;
                    }
                    setRogueMode(next);
                    void patchSetting("rogueMode", next);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="settings-rogue-mode"
                >
                  <span className="profile-settings-switch-title">
                    Modo pícaro
                    <i
                      className="bi bi-gem profile-settings-premium-gem"
                      aria-hidden="true"
                      title="Premium"
                    />
                  </span>
                  <small className="d-block text-secondary">
                    Solo te ven en Discover las personas a las que les diste
                    like
                  </small>
                </label>
              </div>

              <div className="form-check form-switch profile-settings-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="settings-teleport-mode"
                  checked={teleportMode}
                  disabled={busyKey === "teleportMode"}
                  onChange={(event) => {
                    const next = event.target.checked;
                    if (next && !user.premium) {
                      setPremiumInitialPlanId(null);
                      setPremiumModalOpen(true);
                      return;
                    }
                    setTeleportMode(next);
                    void patchSetting("teleportMode", next);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="settings-teleport-mode"
                >
                  <span className="profile-settings-switch-title">
                    Modo Teleport
                    <i
                      className="bi bi-gem profile-settings-premium-gem"
                      aria-hidden="true"
                      title="Premium"
                    />
                  </span>
                  <small className="d-block text-secondary">
                    Explorá Espacios de otra ciudad sin usar tu GPS
                  </small>
                </label>
              </div>

                  {teleportMode && user.premium && (
                <div
                  className={`profile-settings-teleport-panel${
                    busyKey === "teleportMode" || teleportBusy
                      ? " is-busy"
                      : ""
                  }`}
                >
                  <p className="small text-secondary mb-2">
                    Tocá el mapa para elegir un punto. Asignamos la ciudad
                    registrada más cercana (Uruguay, Argentina o Brasil).
                  </p>
                  <div className="profile-settings-teleport-map">
                    <LocationPickerMap
                      center={mapCenter}
                      value={teleportPin}
                      onPick={(coords) => {
                        if (teleportBusy) return;
                        void saveTeleportPin(coords);
                      }}
                    />
                  </div>
                  {previewTeleportCity ? (
                    <p className="small mb-0 mt-2">
                      Vas a explorar:{" "}
                      <strong>
                        {previewTeleportCity.city},{" "}
                        {previewTeleportCity.country}
                      </strong>
                    </p>
                  ) : (
                    <p className="small text-secondary mb-0 mt-2">
                      Elegí un punto para activar la ciudad Teleport.
                    </p>
                  )}
                </div>
              )}

              <Link className="profile-settings-link" to="/profile/blocked">
                <i className="bi bi-slash-circle" aria-hidden="true" />
                <span>
                  <strong>Usuarios bloqueados</strong>
                  <small>Consultá y administrá tus bloqueos</small>
                </span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </Link>
            </section>

            <section
              className="profile-settings-discover"
              aria-labelledby="settings-discover-heading"
            >
              <h3 id="settings-discover-heading">Discover</h3>
              <div className="form-check form-switch profile-settings-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="settings-discover-disabled"
                  checked={discoverDisabled}
                  disabled={busyKey === "discoverDisabled"}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setDiscoverDisabled(next);
                    void patchSetting("discoverDisabled", next);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="settings-discover-disabled"
                >
                  <span className="profile-settings-switch-title">
                    Desactivar Discover
                  </span>
                  <small className="d-block text-secondary">
                    No podrás publicarte en ningún Espacio
                  </small>
                </label>
              </div>
            </section>
          </OverflowFade>
        </div>
      </div>

      {premiumModalOpen && (
        <PremiumPackagesModal
          planId={premiumInitialPlanId ?? undefined}
          onClose={() => {
            setPremiumModalOpen(false);
            setPremiumInitialPlanId(null);
          }}
        />
      )}
    </>
  );
}
