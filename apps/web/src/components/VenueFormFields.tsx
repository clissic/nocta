import { useEffect, useMemo, useRef } from "react";
import { MAX_PHOTO_UPLOAD_BYTES, VENUE_COUNTRIES } from "@nocta/shared";
import { VENUE_PHOTO_FALLBACK } from "../lib/venuePhoto";
import { OptimizedImage } from "./OptimizedImage";
import { useActiveAppCities } from "../lib/appCities";

type CountryCityProps = {
  country: string;
  city: string;
  onCountryChange: (country: string) => void;
  onCityChange: (city: string) => void;
  /** Ciudad actual del Espacio aunque esté inactiva (edición). */
  preserveCity?: string;
};

export function VenueCountryCityFields({
  country,
  city,
  onCountryChange,
  onCityChange,
  preserveCity,
}: CountryCityProps) {
  const { cities, loading } = useActiveAppCities(country);
  const options = useMemo(() => {
    if (
      preserveCity &&
      !cities.some(
        (item) => item.name.toLowerCase() === preserveCity.toLowerCase()
      )
    ) {
      return [
        ...cities,
        {
          id: `preserved:${preserveCity}`,
          country,
          name: preserveCity,
          lat: 0,
          lng: 0,
          active: false,
        },
      ];
    }
    return cities;
  }, [cities, country, preserveCity]);

  useEffect(() => {
    if (loading || options.length === 0) return;
    const match = options.some(
      (item) => item.name.toLowerCase() === city.trim().toLowerCase()
    );
    if (!match) onCityChange(options[0].name);
  }, [loading, options, city, onCityChange]);

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
          disabled={loading || options.length === 0}
        >
          {options.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
              {item.active === false ? " (inactiva)" : ""}
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
  const mime = file.type.toLowerCase();
  const okMime = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
    mime
  );
  if (!okMime) {
    return "Usá JPEG, PNG o WebP";
  }
  if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
    return `La imagen supera los ${Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024))} MB`;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const valid = bitmap.width >= 32 && bitmap.height >= 32;
    bitmap.close();
    return valid ? null : "La imagen es demasiado pequeña";
  } catch {
    return "No se pudo leer la imagen";
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
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        aria-required={required}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFileSelected(file);
          event.target.value = "";
        }}
      />

      {previewSrc ? (
        <div className="venue-request-photo-preview">
          <OptimizedImage
            src={previewSrc}
            alt="Vista previa del Espacio"
            variant="medium"
            sizes="(min-width: 768px) 320px, 100vw"
            fallbackSrc={VENUE_PHOTO_FALLBACK}
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
          <small>JPEG, PNG o WebP · máx. 10 MB</small>
        </button>
      )}
    </div>
  );
}
