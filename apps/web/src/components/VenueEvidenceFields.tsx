import { useRef, useState, type DragEvent } from "react";
import {
  MAX_VENUE_CLAIM_FILE_BYTES,
  MAX_VENUE_CLAIM_FILES,
  VENUE_CLAIM_FILE_EXTENSIONS,
  VENUE_CLAIM_FILE_MIME_TYPES,
} from "@nocta/shared";

const allowedMimes = new Set<string>(VENUE_CLAIM_FILE_MIME_TYPES);
const allowedExtensions = new Set<string>(VENUE_CLAIM_FILE_EXTENSIONS);

function validateEvidenceFile(file: File) {
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!allowedMimes.has(file.type.toLowerCase()) || !allowedExtensions.has(extension)) {
    return "Los comprobantes deben ser PDF, JPG, PNG o WebP";
  }
  if (file.size > MAX_VENUE_CLAIM_FILE_BYTES) {
    return `Cada comprobante puede pesar hasta ${Math.round(
      MAX_VENUE_CLAIM_FILE_BYTES / (1024 * 1024)
    )} MB`;
  }
  return null;
}

export function validateVenueEvidenceFiles(files: File[]) {
  if (files.length < 1 || files.length > MAX_VENUE_CLAIM_FILES) {
    return `Subí entre 1 y ${MAX_VENUE_CLAIM_FILES} comprobantes`;
  }
  for (const file of files) {
    const fileError = validateEvidenceFile(file);
    if (fileError) return fileError;
  }
  return null;
}

type VenueEvidenceFieldsProps = {
  message: string;
  onMessageChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onError: (message: string) => void;
};

export function VenueEvidenceFields({
  message,
  onMessageChange,
  files,
  onFilesChange,
  onError,
}: VenueEvidenceFieldsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(nextFiles: File[]) {
    const validationError = nextFiles
      .map(validateEvidenceFile)
      .find((candidate): candidate is string => Boolean(candidate));
    if (validationError) {
      onError(validationError);
      return;
    }
    const combined = [...files];
    for (const file of nextFiles) {
      const duplicate = combined.some(
        (current) =>
          current.name === file.name &&
          current.size === file.size &&
          current.lastModified === file.lastModified
      );
      if (!duplicate) combined.push(file);
    }
    if (combined.length > MAX_VENUE_CLAIM_FILES) {
      onError(`Podés subir hasta ${MAX_VENUE_CLAIM_FILES} comprobantes`);
      return;
    }
    onFilesChange(combined);
    onError("");
  }

  function dropEvidence(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <>
      <label className="venue-request-field venue-request-field-wide">
        <span>Información adicional (opcional)</span>
        <textarea
          className="form-control"
          rows={4}
          maxLength={1000}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Contanos cuál es tu vínculo con el Espacio…"
        />
      </label>
      <div className="venue-request-field venue-request-field-wide">
        <div className="venue-claim-upload-head">
          <span>Comprobantes</span>
          <strong>
            {files.length} / {MAX_VENUE_CLAIM_FILES}
          </strong>
        </div>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          aria-required="true"
        />
        <div
          className={`venue-claim-upload${dragging ? " is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragging(false);
            }
          }}
          onDrop={dropEvidence}
        >
          {Array.from({ length: MAX_VENUE_CLAIM_FILES }, (_, index) => {
            const file = files[index];
            return file ? (
              <div
                className="venue-claim-file-slot is-filled"
                key={`${file.name}-${file.lastModified}`}
              >
                <i
                  className={`bi ${
                    file.type === "application/pdf"
                      ? "bi-file-earmark-pdf"
                      : "bi-file-earmark-image"
                  }`}
                  aria-hidden="true"
                />
                <strong title={file.name}>{file.name}</strong>
                <small>{Math.ceil(file.size / 1024)} KB</small>
                <button
                  type="button"
                  aria-label={`Quitar ${file.name}`}
                  title="Quitar archivo"
                  onClick={() =>
                    onFilesChange(
                      files.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                className="venue-claim-file-slot is-empty"
                type="button"
                key={`empty-${index}`}
                onClick={() => inputRef.current?.click()}
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
                <strong>Archivo {index + 1}</strong>
                <small>Agregar</small>
              </button>
            );
          })}
        </div>
        <small className="venue-request-hint">
          Seleccioná uno por vez, varios juntos o arrastralos aquí. PDF, JPG,
          PNG o WebP; hasta 2 MB cada uno.
        </small>
      </div>
    </>
  );
}
