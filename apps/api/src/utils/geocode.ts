export type GeoPoint = { lat: number; lng: number };

export type ReverseGeocodeResult = {
  address: string;
  city?: string;
  displayName?: string;
};

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "NoctaApp/0.1 (venue-map; contact=dev@nocta.app)",
};

/**
 * Geocodifica una dirección con Nominatim (OpenStreetMap).
 * Respetar uso justo: User-Agent identificable + rate limit del caller.
 */
export async function geocodeAddress(
  address: string,
  city?: string
): Promise<GeoPoint | null> {
  const query = [address, city].filter(Boolean).join(", ");
  if (!query.trim()) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

type NominatimReverse = {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
};

function formatReverseAddress(hit: NominatimReverse): ReverseGeocodeResult | null {
  const parts = hit.address;
  if (!parts && !hit.display_name) return null;

  const street =
    parts?.road || parts?.pedestrian || parts?.footway || undefined;
  const number = parts?.house_number;
  const locality =
    parts?.city ||
    parts?.town ||
    parts?.village ||
    parts?.municipality ||
    parts?.county ||
    undefined;
  const neighbourhood = parts?.neighbourhood || parts?.suburb;

  const streetLine = [street, number].filter(Boolean).join(" ");
  const address =
    [streetLine || neighbourhood, locality].filter(Boolean).join(", ") ||
    hit.display_name ||
    "";

  if (!address.trim()) return null;

  return {
    address: address.trim(),
    city: locality,
    displayName: hit.display_name,
  };
}

/** Geocoding inverso: coords → dirección legible. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as NominatimReverse;
  return formatReverseAddress(data);
}

/** Si no hay coords, intenta geocode; si falla, deja undefined. */
export async function resolveVenueLocation(input: {
  address: string;
  city?: string;
  location?: GeoPoint | null;
}): Promise<GeoPoint | undefined> {
  if (
    input.location &&
    Number.isFinite(input.location.lat) &&
    Number.isFinite(input.location.lng)
  ) {
    return {
      lat: input.location.lat,
      lng: input.location.lng,
    };
  }
  const found = await geocodeAddress(input.address, input.city);
  return found ?? undefined;
}
