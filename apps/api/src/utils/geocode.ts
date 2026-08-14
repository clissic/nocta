export type GeoPoint = { lat: number; lng: number };

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
    headers: {
      Accept: "application/json",
      "User-Agent": "NoctaApp/0.1 (venue-map; contact=dev@nocta.app)",
    },
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
