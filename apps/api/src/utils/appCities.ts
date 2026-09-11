import {
  ENABLED_VENUE_COUNTRIES,
  SEED_VENUE_CITIES,
  nearestVenueCityFrom,
  type VenueCityMatch,
} from "@nocta/shared";
import { AppCity, type AppCityDocument } from "../models/AppCity.js";

export function serializeAppCity(city: AppCityDocument) {
  return {
    id: city._id.toString(),
    country: city.country,
    name: city.name,
    lat: city.lat,
    lng: city.lng,
    active: Boolean(city.active),
    createdAt: city.createdAt?.toISOString?.() ?? undefined,
    updatedAt: city.updatedAt?.toISOString?.() ?? undefined,
  };
}

/** Si la colección está vacía, carga el catálogo seed. */
export async function ensureAppCitiesSeeded() {
  const count = await AppCity.countDocuments();
  if (count > 0) return { seeded: false, count };

  const docs = SEED_VENUE_CITIES.map((city) => ({
    country: city.country,
    name: city.label,
    nameNormalized: city.label.trim().toLowerCase(),
    lat: city.lat,
    lng: city.lng,
    active: true,
  }));
  await AppCity.insertMany(docs, { ordered: false });
  const next = await AppCity.countDocuments();
  console.log(`[cities] seed inicial: ${next} ciudades`);
  return { seeded: true, count: next };
}

export async function listActiveAppCities(country?: string) {
  const filter: Record<string, unknown> = { active: true };
  if (country) filter.country = country;
  return AppCity.find(filter).sort({ country: 1, name: 1 });
}

export async function isActiveAppCity(
  country: string,
  cityName: string
): Promise<boolean> {
  if (
    !ENABLED_VENUE_COUNTRIES.includes(
      country as (typeof ENABLED_VENUE_COUNTRIES)[number]
    )
  ) {
    return false;
  }
  const found = await AppCity.findOne({
    country,
    active: true,
    nameNormalized: cityName.trim().toLowerCase(),
  }).lean();
  return Boolean(found);
}

export async function resolveNearestAppCity(
  lat: number,
  lng: number
): Promise<VenueCityMatch | null> {
  const cities = await listActiveAppCities();
  return nearestVenueCityFrom(
    cities.map((city) => ({
      country: city.country,
      label: city.name,
      lat: city.lat,
      lng: city.lng,
    })),
    lat,
    lng
  );
}
