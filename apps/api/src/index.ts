import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config, isMemoryDb } from "./config.js";
import { connectDb } from "./db.js";
import { seedDemoData, ensureDemoAccounts, normalizeLookingForSingleChoice, syncPilotVenues } from "./seedData.js";
import { Match } from "./models/Match.js";
import { User } from "./models/User.js";
import { ensureUploadsDir, UPLOADS_DIR } from "./uploads/index.js";
import { verifyMailTransport } from "./mail/mailer.js";
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

const app = express();

ensureUploadsDir();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nocta-api",
    db: isMemoryDb ? "memory" : "atlas",
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

async function maybeSeed() {
  if (isMemoryDb) {
    await seedDemoData();
    console.log(
      `Datos demo (memory). Admin: ${config.adminEmail} / ${config.adminPassword}`
    );
    return;
  }

  if (!config.seedOnEmpty) return;

  const users = await User.countDocuments();
  if (users > 0) {
    console.log(`Atlas con datos existentes (${users} users). Seed omitido.`);
    return;
  }

  console.log("Atlas vacío — cargando seed inicial…");
  await seedDemoData();
  console.log(
    `Seed Atlas listo. Admin: ${config.adminEmail} / ${config.adminPassword}`
  );
}

async function start() {
  await connectDb();

  try {
    await Match.collection.dropIndex("users_1_venueId_1");
  } catch {
    /* no existía */
  }
  await Match.syncIndexes();

  await maybeSeed();
  await syncPilotVenues();
  await ensureDemoAccounts();
  await normalizeLookingForSingleChoice();
  await verifyMailTransport();

  app.listen(config.port, () => {
    console.log(`Nocta API en http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error(
    "No se pudo iniciar la API:",
    err instanceof Error ? err.message : err
  );
  console.error(
    "Revisá MONGODB_URI/credenciales y que tu IP esté habilitada en Atlas (Network Access)."
  );
  process.exit(1);
});
