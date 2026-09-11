import "./env.js";
import { createServer, type Server } from "node:http";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../db.js";
import { createApp } from "../createApp.js";
import { resetStorageSingleton, getStorage } from "../storage/index.js";
import { signToken } from "../middleware/auth.js";
import { User, type UserDocument } from "../models/User.js";
import { Venue, type VenueDocument } from "../models/Venue.js";
import { resetImageRateLimitsForTests } from "../middleware/imageRateLimit.js";

export type E2EContext = {
  baseUrl: string;
  server: Server;
  storage: ReturnType<typeof getStorage>;
};

let ctx: E2EContext | null = null;

export async function startE2E(): Promise<E2EContext> {
  if (ctx) return ctx;
  resetStorageSingleton();
  resetImageRateLimitsForTests();
  await connectDb();
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("No se pudo bindear el server E2E");
  }
  ctx = {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    server,
    storage: getStorage(),
  };
  return ctx;
}

export async function stopE2E() {
  if (!ctx) return;
  await new Promise<void>((resolve, reject) => {
    ctx!.server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  resetStorageSingleton();
  ctx = null;
}

export async function makeJpeg(
  width = 640,
  height = 480,
  color = { r: 30, g: 140, b: 200 }
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function createTestUser(opts: {
  email: string;
  role?: "user" | "admin";
  name?: string;
  verified?: boolean;
  gender?: string;
  interestedIn?: string[];
}): Promise<{ user: UserDocument; token: string }> {
  const passwordHash = await bcrypt.hash("Demo1234!", 8);
  const user = await User.create({
    email: opts.email.toLowerCase(),
    passwordHash,
    role: opts.role ?? "user",
    emailVerified: opts.verified !== false,
    profileComplete: true,
    authVersion: 0,
    profile: {
      name: opts.name ?? "E2E User",
      birthDate: new Date("1995-06-15"),
      gender: opts.gender ?? "woman",
      interestedIn: opts.interestedIn ?? ["man"],
      lookingFor: ["relacion"],
      heightCm: 165,
      livesIn: { country: "Uruguay", city: "Montevideo" },
      photos: [],
      bio: "e2e",
    },
  });
  return { user, token: signToken(user) };
}

export async function createTestVenue(
  ownerId: string
): Promise<VenueDocument> {
  return Venue.create({
    name: "E2E Espacio",
    type: "bar",
    address: "18 de Julio 1234",
    country: "Uruguay",
    city: "Montevideo",
    description: "Espacio de prueba E2E",
    photos: [],
    active: true,
    ownerId,
    location: { lat: -34.9, lng: -56.16 },
  });
}

export type ApiInit = RequestInit & {
  token?: string;
  /** Default `manual` para poder assertar 302 de /api/media. */
  redirect?: RequestRedirect;
};

export async function api(path: string, init: ApiInit = {}) {
  if (!ctx) throw new Error("E2E no iniciado");
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json, text };
}

export function jpegPart(buffer: Buffer) {
  return new Blob([new Uint8Array(buffer)], { type: "image/jpeg" });
}

export async function uploadProfilePhoto(token: string, buffer: Buffer) {
  const form = new FormData();
  form.append("photo", jpegPart(buffer), "profile.jpg");
  return api("/api/profile/photos", { method: "POST", token, body: form });
}

/** PATCH manage exige todos los campos del Espacio. */
export async function patchVenueCover(
  token: string,
  venue: VenueDocument,
  jpeg: Buffer,
  description = "Portada E2E"
) {
  const form = new FormData();
  form.append("photo", jpegPart(jpeg), "cover.jpg");
  form.append("name", venue.name);
  form.append("type", venue.type);
  form.append("address", venue.address);
  form.append("country", venue.country ?? "Uruguay");
  form.append("city", venue.city);
  form.append("description", description);
  form.append(
    "location",
    JSON.stringify({
      lat: venue.location?.lat ?? -34.9,
      lng: venue.location?.lng ?? -56.16,
    })
  );
  return api(`/api/venues/${venue._id}/manage`, {
    method: "PATCH",
    token,
    body: form,
  });
}
