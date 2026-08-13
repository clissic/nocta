import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** Usa "memory" para MongoDB embebido (MVP local sin instalar Mongo). */
  mongoUri: process.env.MONGODB_URI ?? "memory",
  jwtSecret: process.env.JWT_SECRET ?? "nocta-dev-secret",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  /** URL pública de la API (redirect_uri OAuth). */
  apiPublicUrl: process.env.API_PUBLIC_URL ?? "http://localhost:4000",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@nocta.app",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123456",
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? "",
      teamId: process.env.APPLE_TEAM_ID ?? "",
      keyId: process.env.APPLE_KEY_ID ?? "",
      /** PEM; en .env usar \n literales. */
      privateKey: (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      tenant: process.env.MICROSOFT_TENANT ?? "common",
    },
  },
};
