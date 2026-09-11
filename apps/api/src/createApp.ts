import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config.js";
import {
  ensureTempUploadDir,
  ensureUploadsDir,
  UPLOADS_DIR,
} from "./uploads/index.js";
import {
  noteLegacyUploadBlockedWrite,
  noteLegacyUploadGet,
} from "./uploads/legacyAccess.js";
import authRoutes from "./routes/auth.js";
import oauthRoutes from "./routes/oauth.js";
import profileRoutes from "./routes/profile.js";
import venueRoutes from "./routes/venues.js";
import presenceRoutes from "./routes/presence.js";
import discoverRoutes from "./routes/discover.js";
import matchRoutes from "./routes/matches.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/users.js";
import meRoutes from "./routes/me.js";
import muroRoutes from "./routes/muro.js";
import notificationRoutes from "./routes/notifications.js";
import premiumRoutes from "./routes/premium.js";
import cityRoutes from "./routes/cities.js";
import adsRoutes from "./routes/ads.js";
import mediaRoutes from "./routes/media.js";

/** App Express sin listen (tests E2E / boot). */
export function createApp() {
  const app = express();

  ensureUploadsDir();
  ensureTempUploadDir();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (process.env.NOCTA_E2E !== "1") {
    app.use(morgan("dev"));
  }

  /**
   * Fase 11: `/uploads` solo lectura residual (corpus legacy).
   * Nuevos bytes → TEMP + Image Service; no writes vía esta ruta.
   */
  app.use("/uploads", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      noteLegacyUploadBlockedWrite(req.method, req.path);
      return res.status(405).json({
        error: "Legacy /uploads es solo lectura",
        code: "LEGACY_UPLOADS_READONLY",
      });
    }
    noteLegacyUploadGet(req.path);
    next();
  });
  app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      fallthrough: true,
      index: false,
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "nocta-api",
      db: config.mongoUri === "memory" ? "memory" : "atlas",
    });
  });

  app.use("/api/auth/oauth", oauthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/venues", venueRoutes);
  app.use("/api/presence", presenceRoutes);
  app.use("/api/discover", discoverRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/me", meRoutes);
  app.use("/api/muro", muroRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/premium", premiumRoutes);
  app.use("/api/cities", cityRoutes);
  app.use("/api/ads", adsRoutes);
  app.use("/api/media", mediaRoutes);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error(err);
      res.status(500).json({ error: "Error interno" });
    }
  );

  return app;
}
