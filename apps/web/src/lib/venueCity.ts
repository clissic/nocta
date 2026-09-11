import {

  DEFAULT_URUGUAY_CITY,

  DEFAULT_VENUE_COUNTRY,

  type AuthUser,

} from "@nocta/shared";

import { fetchNearestAppCity } from "./appCities";



const GPS_CACHE_KEY = "nocta_gps_city";



export type EffectiveVenueCity = {

  country: string;

  city: string;

  lat: number;

  lng: number;

  source: "teleport" | "gps";

};



type GpsCache = {

  country: string;

  city: string;

  lat: number;

  lng: number;

  coordsLat: number;

  coordsLng: number;

};



export function hasTeleportCity(user: AuthUser | null | undefined): boolean {

  return Boolean(

    user?.premium &&

      user.teleportMode &&

      user.teleportCity?.country &&

      user.teleportCity?.city

  );

}



export function teleportNeedsCity(user: AuthUser | null | undefined): boolean {

  return Boolean(user?.premium && user.teleportMode && !hasTeleportCity(user));

}



export function readGpsCityCache(): EffectiveVenueCity | null {

  try {

    const raw = sessionStorage.getItem(GPS_CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as GpsCache;

    if (!parsed.country || !parsed.city) return null;

    return {

      country: parsed.country,

      city: parsed.city,

      lat: parsed.lat,

      lng: parsed.lng,

      source: "gps",

    };

  } catch {

    return null;

  }

}



export function writeGpsCityCache(

  city: Omit<EffectiveVenueCity, "source">,

  coords: { lat: number; lng: number }

) {

  const payload: GpsCache = {

    country: city.country,

    city: city.city,

    lat: city.lat,

    lng: city.lng,

    coordsLat: coords.lat,

    coordsLng: coords.lng,

  };

  sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify(payload));

}



export function clearGpsCityCache() {

  sessionStorage.removeItem(GPS_CACHE_KEY);

}



function getCurrentPosition(): Promise<GeolocationPosition> {

  return new Promise((resolve, reject) => {

    if (!navigator.geolocation) {

      reject(new Error("Geolocalización no disponible"));

      return;

    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {

      enableHighAccuracy: false,

      timeout: 15000,

      maximumAge: 5 * 60 * 1000,

    });

  });

}



/** Ciudad efectiva para listar Espacios (Teleport o GPS). */

export async function resolveEffectiveVenueCity(

  user: AuthUser | null | undefined,

  opts?: { forceGps?: boolean }

): Promise<EffectiveVenueCity> {

  if (user?.premium && user.teleportMode) {

    if (user.teleportCity?.country && user.teleportCity?.city) {

      return {

        country: user.teleportCity.country,

        city: user.teleportCity.city,

        lat: user.teleportCity.lat,

        lng: user.teleportCity.lng,

        source: "teleport",

      };

    }

    throw new Error("TELEPORT_NEEDS_CITY");

  }



  if (!opts?.forceGps) {

    const cached = readGpsCityCache();

    if (cached) return cached;

  }



  const position = await getCurrentPosition();

  const { latitude, longitude } = position.coords;

  const nearest = await fetchNearestAppCity(latitude, longitude);

  const city: EffectiveVenueCity = {

    country: nearest.country,

    city: nearest.city,

    lat: nearest.lat,

    lng: nearest.lng,

    source: "gps",

  };

  writeGpsCityCache(city, { lat: latitude, lng: longitude });

  return city;

}



export function defaultMapCenter() {

  return {

    lat: DEFAULT_URUGUAY_CITY.lat,

    lng: DEFAULT_URUGUAY_CITY.lng,

    country: DEFAULT_VENUE_COUNTRY,

    city: DEFAULT_URUGUAY_CITY.label,

  };

}


