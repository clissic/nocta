import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { seedDemoData } from "./seedData.js";
import authRoutes from "./routes/auth.js";
import oauthRoutes from "./routes/oauth.js";
import profileRoutes from "./routes/profile.js";
import venueRoutes from "./routes/venues.js";
import presenceRoutes from "./routes/presence.js";
import discoverRoutes from "./routes/discover.js";
import matchRoutes from "./routes/matches.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nocta-api" });
});

app.use("/api/auth/oauth", oauthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/admin", adminRoutes);

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

async function start() {
  await connectDb();
  if (config.mongoUri === "memory") {
    await seedDemoData();
    console.log(
      `Datos demo cargados. Admin: ${config.adminEmail} / ${config.adminPassword}`
    );
  }
  app.listen(config.port, () => {
    console.log(`Nocta API en http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error("No se pudo iniciar la API", err);
  process.exit(1);
});
