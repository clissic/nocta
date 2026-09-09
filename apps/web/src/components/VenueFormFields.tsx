import { useRef } from "react";
import {
  MAX_PHOTO_UPLOAD_BYTES,
  VENUE_COUNTRIES,
  VENUE_COVER_HEIGHT,
  VENUE_COVER_MIME,
  VENUE_COVER_WIDTH,
  venueCitiesForCountry,
} from "@nocta/shared";
import { onVenuePhotoError } from "../lib/venuePhoto";

type CountryCityProps = {
  country: string;
  city: string;
  onCountryChange: (country: string) => void;
  onCityChange: (city: string) => void;
};

export function VenueCountryCityFields({
  country,
  city,
  onCountryChange,
  onCityChange,
}: CountryCityProps) {
  const cities = venueCitiesForCountry(country);

  return (
    <div className="venue-request-country-city venue-request-field-wide">
      <label className="venue-request-field">
        <span>País</span>
        <select
          className="form-select"
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
          required
        >
          {VENUE_COUNTRIES.map((item) => (
            <option
              key={item.id}
              value={item.label}
              disabled={!item.enabled}
            >
              {item.label}
              {!item.enabled ? " (próximamente)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="venue-request-field">
        <span>Ciudad</span>
        <select
          className="form-select"
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          required
        >
          {cities.map((item) => (
            <option key={item.id} value={item.label}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export async function validateVenueCoverFile(
  file: File
): Promise<string | null> {
  if (
    file.type.toLowerCase() !== VENUE_COVER_MIME ||
    !file.name.toLowerCase().endsWith(".webp")
  ) {
    return "La imagen debe estar en formato .webp";
  }
  if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
    return `La imagen supera los ${Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024))} MB`;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const valid =
      bitmap.width === VENUE_COVER_WIDTH &&
      bitmap.height === VENUE_COVER_HEIGHT;
    bitmap.close();
    return valid
      ? null
      : `La imagen debe medir exactamente ${VENUE_COVER_WIDTH}×${VENUE_COVER_HEIGHT} píxeles`;
  } catch {
    return "No se pudo leer la imagen WebP";
  }
}

type CoverFieldProps = {
  previewSrc: string | null;
  required: boolean;
  hasNewFile?: boolean;
  onFileSelected: (file: File) => void | Promise<void>;
  onClear: () => void;
};

export function VenueCoverField({
  previewSrc,
  required,
  hasNewFile = false,
  onFileSelected,
  onClear,
}: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="venue-request-photo venue-request-field-wide">
      <span className="venue-request-field-label">
        Imagen del Espacio {required ? "" : "(opcional)"}
      </span>
      <input
        ref={inputRef}
        className="d-none"
        type="file"
        accept=".webp,image/webp"
        aria-required={required}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFileSelected(file);
          event.target.value = "";
        }}
      />

      {previewSrc ? (
        <div className="venue-request-photo-preview">
          <img
            src={previewSrc}
            alt="Vista previa del Espacio"
            onError={onVenuePhotoError}
          />
          <div className="venue-request-photo-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={() => inputRef.current?.click()}
            >
              Cambiar
            </button>
            {(required || hasNewFile) && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={onClear}
              >
                {required ? "Quitar" : "Restaurar"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="venue-request-photo-upload"
          onClick={() => inputRef.current?.click()}
        >
          <i className="bi bi-image" aria-hidden="true" />
          <strong>Subir imagen</strong>
          <small>WebP · 1600×1200 px · máx. 8 MB</small>
        </button>
      )}
    </div>
  );
}
