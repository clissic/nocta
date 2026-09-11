import { Router } from "express";
import { z } from "zod";
import { isEnabledVenueCountry } from "@nocta/shared";
import { optionalAuth } from "../middleware/optionalAuth.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { AppCity } from "../models/AppCity.js";
import {
  resolveNearestAppCity,
  serializeAppCity,
} from "../utils/appCities.js";

const router = Router();

const listSchema = z.object({
  country: z.string().trim().min(2).max(60).optional(),
  active: z.enum(["true", "false", "all"]).optional().default("true"),
});

router.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  if (parsed.data.country && !isEnabledVenueCountry(parsed.data.country)) {
    return res.status(400).json({ error: "País no habilitado" });
  }

  const filter: Record<string, unknown> = {};
  if (parsed.data.country) filter.country = parsed.data.country;

  const isAdmin = req.user?.role === "admin";
  if (!isAdmin) {
    filter.active = true;
  } else if (parsed.data.active === "true") {
    filter.active = true;
  } else if (parsed.data.active === "false") {
    filter.active = false;
  }

  const cities = await AppCity.find(filter).sort({ country: 1, name: 1 });
  return res.json({ cities: cities.map((city) => serializeAppCity(city)) });
});

const nearestSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

router.post("/nearest", async (req, res) => {
  const parsed = nearestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ubicación inválida" });
  }
  const nearest = await resolveNearestAppCity(parsed.data.lat, parsed.data.lng);
  if (!nearest) {
    return res.status(404).json({ error: "No hay ciudades activas" });
  }
  return res.json({
    city: {
      country: nearest.country,
      name: nearest.city,
      city: nearest.city,
      lat: nearest.lat,
      lng: nearest.lng,
      distanceKm: nearest.distanceKm,
    },
  });
});

export default router;
