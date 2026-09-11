import { FormEvent, useEffect, useState } from "react";
import { type Venue } from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { useToast } from "./ToastProvider";
import { NoctaLoading } from "./NoctaLoading";
import { VENUE_PHOTO_FALLBACK, venueCoverSrc } from "../lib/venuePhoto";
import { OptimizedImage } from "./OptimizedImage";
import { ManualSearchInput } from "./ManualSearchInput";
import {
  validateVenueEvidenceFiles,
  VenueEvidenceFields,
} from "./VenueEvidenceFields";

type VenueClaimFormProps = {
  onSubmitted: () => void | Promise<void>;
};

export function VenueClaimForm({ onSubmitted }: VenueClaimFormProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void api<{ venues: Venue[] }>(
      `/api/venues/claimable?q=${encodeURIComponent(submittedQuery)}&limit=20`,
      { signal: controller.signal }
    )
      .then(({ venues: next }) => setVenues(next))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los Espacios"
          );
        }
      })
      .finally(() => setLoading(false));
    return () => {
      controller.abort();
    };
  }, [submittedQuery]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!selected) {
      setError("Elegí el Espacio que querés administrar");
      return;
    }
    const validationError = validateVenueEvidenceFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("venueId", selected.id);
      if (message.trim()) form.append("message", message.trim());
      files.forEach((file) => form.append("evidenceFiles", file));
      await api("/api/venues/claims", { method: "POST", body: form });
      setSelected(null);
      setMessage("");
      setFiles([]);
      toast.success("Recibimos tu reclamación. Te avisaremos cuando la revisemos.");
      await onSubmitted();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo enviar la reclamación"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="venue-request-form venue-claim-form" onSubmit={submit}>
      {error && <p className="text-danger small mb-0">{error}</p>}

      <section className="venue-request-section">
        <h2 className="venue-request-section-title">Elegí el Espacio</h2>
        <p className="venue-request-section-copy">
          Solo aparecen Espacios que todavía no tienen Organizador en Nocta.
        </p>
        <div className="venue-request-field venue-request-field-wide">
          <span>Buscar por nombre o dirección</span>
          <ManualSearchInput
            placeholder="Ej. Zoba Club"
            ariaLabel="Buscar Espacios para reclamar"
            value={query}
            onValueChange={setQuery}
            onSearch={setSubmittedQuery}
          />
        </div>

        {loading ? (
          <NoctaLoading variant="block" />
        ) : venues.length === 0 ? (
          <p className="text-secondary small mb-0">No encontramos Espacios disponibles.</p>
        ) : (
          <div className="venue-claim-results" role="radiogroup" aria-label="Espacio">
            {venues.map((venue) => {
              const active = selected?.id === venue.id;
              return (
                <button
                  key={venue.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`venue-claim-option${active ? " is-selected" : ""}`}
                  onClick={() => setSelected(venue)}
                >
                  <OptimizedImage
                    src={venueCoverSrc(venue)}
                    alt=""
                    variant="thumb"
                    sizes="56px"
                    fallbackSrc={VENUE_PHOTO_FALLBACK}
                  />
                  <span>
                    <strong>{venue.name}</strong>
                    <small>
                      {venue.address} · {venue.city}
                    </small>
                  </span>
                  <i
                    className={`bi ${active ? "bi-check-circle-fill" : "bi-circle"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="venue-request-section">
        <h2 className="venue-request-section-title">Acreditación</h2>
        <p className="venue-request-section-copy">
          Adjuntá documentación que demuestre que sos responsable o estás
          habilitado para administrar el Espacio. Los archivos son privados y
          solo puede verlos el equipo de Nocta.
        </p>
        <VenueEvidenceFields
          message={message}
          onMessageChange={setMessage}
          files={files}
          onFilesChange={setFiles}
          onError={setError}
        />
      </section>

      <div className="venue-request-actions">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy || loading}
        >
          {busy ? "Enviando…" : "Enviar reclamación"}
        </button>
      </div>
    </form>
  );
}
