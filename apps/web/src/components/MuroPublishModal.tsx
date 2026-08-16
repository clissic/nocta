import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  MAX_POST_BODY_LENGTH,
  MAX_POST_PHOTOS,
  VENUES_PAGE_SIZE,
  type PaginatedVenuesResponse,
  type UserPost,
  type Venue,
} from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { useToast } from "./ToastProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
};

export function MuroPublishModal({ open, onClose, onPublished }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  useEffect(() => {
    if (!open) return;
    setVenueQuery("");
    setVenueResults([]);
    setSelectedVenue(null);
    setVenueMenuOpen(false);
    setBody("");
    setFiles([]);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || !venueMenuOpen) return;
    let alive = true;
    const q = venueQuery.trim();
    setVenueSearching(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        limit: String(VENUES_PAGE_SIZE),
      });
      if (q) params.set("q", q);
      void api<PaginatedVenuesResponse>(`/api/venues?${params.toString()}`)
        .then((res) => {
          if (!alive) return;
          setVenueResults(res.venues ?? []);
        })
        .catch((err) => {
          if (!alive) return;
          setVenueResults([]);
          toast.error(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los espacios"
          );
        })
        .finally(() => {
          if (alive) setVenueSearching(false);
        });
    }, 220);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, venueMenuOpen, venueQuery, toast]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles((prev) => {
      const room = MAX_POST_PHOTOS - prev.length;
      if (room <= 0) {
        toast.warning(`Máximo ${MAX_POST_PHOTOS} fotos`);
        return prev;
      }
      if (incoming.length > room) {
        toast.warning(`Máximo ${MAX_POST_PHOTOS} fotos`);
      }
      return [...prev, ...incoming.slice(0, room)];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedVenue) {
      toast.error("Elegí un Espacio");
      return;
    }
    const text = body.trim();
    if (!text) {
      toast.error("Escribí lo que pensás");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("venueId", selectedVenue.id);
      form.append("body", text);
      files.forEach((file) => form.append("photos", file));

      await api<{ post: UserPost }>("/api/muro/posts", {
        method: "POST",
        body: form,
      });
      toast.success("Publicación lista");
      onPublished();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo publicar"
      );
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="profile-connections-modal muro-publish-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="muro-publish-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
        disabled={busy}
      />
      <div className="profile-connections-dialog muro-publish-dialog">
        <header className="profile-connections-head">
          <h2 id="muro-publish-title">Mi actividad</h2>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <form className="profile-connections-body muro-publish-body" onSubmit={submit}>
          <div className="muro-publish-field">
            <label className="form-label" htmlFor="muro-publish-venue">
              Estoy en...
            </label>
            <div className="muro-publish-venue-picker">
              <button
                type="button"
                id="muro-publish-venue"
                className="muro-publish-venue-trigger"
                aria-expanded={venueMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setVenueMenuOpen((v) => !v)}
              >
                <span>
                  {selectedVenue
                    ? selectedVenue.name
                    : "Buscar un Espacio"}
                </span>
                <i
                  className={`bi ${venueMenuOpen ? "bi-chevron-up" : "bi-chevron-down"}`}
                  aria-hidden="true"
                />
              </button>
              {venueMenuOpen && (
                <div className="muro-publish-venue-menu" role="listbox">
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Buscar espacios…"
                    value={venueQuery}
                    onChange={(e) => setVenueQuery(e.target.value)}
                    autoFocus
                  />
                  <div className="muro-publish-venue-results">
                    {venueSearching ? (
                      <p className="text-secondary small mb-0">Buscando…</p>
                    ) : venueResults.length === 0 ? (
                      <p className="text-secondary small mb-0">
                        No hay espacios con ese nombre.
                      </p>
                    ) : (
                      venueResults.map((venue) => (
                        <button
                          key={venue.id}
                          type="button"
                          className="muro-publish-venue-option"
                          role="option"
                          aria-selected={selectedVenue?.id === venue.id}
                          onClick={() => {
                            setSelectedVenue(venue);
                            setVenueMenuOpen(false);
                            setVenueQuery("");
                          }}
                        >
                          <span className="muro-publish-venue-option-name">
                            {venue.name}
                          </span>
                          <span className="muro-publish-venue-option-meta">
                            {venue.city}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="muro-publish-field">
            <label className="form-label" htmlFor="muro-publish-body">
              ¿Qué pensás?
            </label>
            <textarea
              id="muro-publish-body"
              className="form-control muro-publish-textarea"
              rows={4}
              maxLength={MAX_POST_BODY_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contá tu noche…"
            />
            <p className="form-text text-secondary mb-0">
              {body.trim().length}/{MAX_POST_BODY_LENGTH}
            </p>
          </div>

          <div className="muro-publish-field">
            <p className="form-label mb-2">Fotos</p>
            <div className="row g-2 muro-publish-photo-grid">
              {Array.from({ length: MAX_POST_PHOTOS }, (_, index) => {
                const src = previews[index];
                return (
                  <div key={src ?? `placeholder-${index}`} className="col-4">
                    {src ? (
                      <div className="venue-review-photo-thumb muro-publish-photo-slot">
                        <img src={src} alt={`Vista previa ${index + 1}`} />
                        <button
                          type="button"
                          className="venue-review-photo-remove"
                          aria-label={`Quitar foto ${index + 1}`}
                          onClick={() =>
                            setFiles((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <i className="bi bi-x" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="venue-review-photo-add muro-publish-photo-slot"
                        aria-label={`Subir foto ${index + 1}`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <i className="bi bi-plus-lg" aria-hidden="true" />
                        <span>Foto {index + 1}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="d-none"
              onChange={(e) => pickFiles(e.target.files)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={busy}
          >
            {busy ? "Publicando…" : "Publicar"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
