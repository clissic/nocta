import { useEffect, useState } from "react";
import type { AppCity } from "@nocta/shared";
import { api } from "./api";

type CitiesCacheEntry = {
  cities: AppCity[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 60_000;
const citiesCache = new Map<string, CitiesCacheEntry>();

function cacheKey(country?: string, active = true) {
  return `${country ?? "all"}:${active ? "1" : "0"}`;
}

export async function fetchAppCities(opts?: {
  country?: string;
  active?: boolean;
  force?: boolean;
}): Promise<AppCity[]> {
  const country = opts?.country;
  const active = opts?.active ?? true;
  const key = cacheKey(country, active);
  const cached = citiesCache.get(key);
  if (
    !opts?.force &&
    cached &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS
  ) {
    return cached.cities;
  }

  const params = new URLSearchParams();
  if (country) params.set("country", country);
  params.set("active", active ? "true" : "all");
  const res = await api<{ cities: AppCity[] }>(
    `/api/cities?${params.toString()}`
  );
  citiesCache.set(key, { cities: res.cities, fetchedAt: Date.now() });
  return res.cities;
}

export function invalidateAppCitiesCache() {
  citiesCache.clear();
}

export type NearestAppCity = {
  country: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

export async function fetchNearestAppCity(
  lat: number,
  lng: number
): Promise<NearestAppCity> {
  const res = await api<{ city: NearestAppCity }>("/api/cities/nearest", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
  return res.city;
}

/** Hook: ciudades activas del catálogo (por país). */
export function useActiveAppCities(country?: string) {
  const [cities, setCities] = useState<AppCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAppCities({ country })
      .then((list) => {
        if (!alive) return;
        setCities(list);
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setCities([]);
        setError("No se pudieron cargar las ciudades");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [country]);

  return { cities, loading, error };
}
