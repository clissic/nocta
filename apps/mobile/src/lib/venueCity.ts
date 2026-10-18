import * as Location from "expo-location";
import type { AuthUser } from "@nocta/shared";
import { api } from "./api";

export type EffectiveVenueCity = {
  country: string;
  city: string;
  lat: number;
  lng: number;
  source: "teleport" | "gps";
};

type GpsCache = EffectiveVenueCity & {
  coordsLat: number;
  coordsLng: number;
};

let gpsCache: GpsCache | null = null;

type NearestAppCity = {
  country: string;
  city: string;
  lat: number;
  lng: number;
};

function coordsOf(
  position: Location.LocationObject | null | undefined
): { lat: number; lng: number } | null {
  const lat = position?.coords?.latitude;
  const lng = position?.coords?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function ensureLocationPermission() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain !== false) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status === "granted") return;
  if (permission.canAskAgain === false) throw new Error("GPS_SETTINGS");
  throw new Error("GPS_DENIED");
}

async function currentCoords() {
  await ensureLocationPermission();

  // Alta precisión: en el emulador es el punto de Location, no la ubicación de red.
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    const fresh = coordsOf(position);
    if (fresh) return fresh;
  } catch {
    // Sin fix nuevo: se usa la última posición conocida.
  }

  const fallback = coordsOf(await Location.getLastKnownPositionAsync());
  if (fallback) return fallback;
  throw new Error("GPS_UNAVAILABLE");
}

/** Ciudad efectiva para listar Espacios: Teleport o la más cercana al GPS. */
export async function resolveEffectiveVenueCity(
  user: AuthUser | null | undefined,
  opts?: { forceGps?: boolean }
): Promise<EffectiveVenueCity> {
  const teleport = user?.teleportCity;
  if (user?.premium && user.teleportMode) {
    if (teleport?.country && teleport.city) {
      return {
        country: teleport.country,
        city: teleport.city,
        lat: teleport.lat,
        lng: teleport.lng,
        source: "teleport",
      };
    }
    throw new Error("TELEPORT_NEEDS_CITY");
  }

  if (!opts?.forceGps && gpsCache) {
    return {
      country: gpsCache.country,
      city: gpsCache.city,
      lat: gpsCache.lat,
      lng: gpsCache.lng,
      source: "gps",
    };
  }

  const coords = await currentCoords();
  const res = await api<{ city?: NearestAppCity | null }>("/api/cities/nearest", {
    method: "POST",
    body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
  });
  const nearest = res?.city;
  if (!nearest?.country || !nearest.city) {
    throw new Error("NO_NEARBY_CITY");
  }
  gpsCache = {
    country: nearest.country,
    city: nearest.city,
    lat: nearest.lat,
    lng: nearest.lng,
    source: "gps",
    coordsLat: coords.lat,
    coordsLng: coords.lng,
  };
  return {
    country: nearest.country,
    city: nearest.city,
    lat: nearest.lat,
    lng: nearest.lng,
    source: "gps",
  };
}
