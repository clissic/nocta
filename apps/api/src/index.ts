import { createServer } from "node:http";
import { config, isMemoryDb } from "./config.js";
import { connectDb } from "./db.js";
import {
  seedDemoData,
  ensureDemoAccounts,
  normalizeLookingForSingleChoice,
  syncPilotVenues,
} from "./seedData.js";
import {
  Match,
  backfillMatchPairKeys,
  repairMissingMatches,
} from "./models/Match.js";
import { User } from "./models/User.js";
import { verifyMailTransport } from "./mail/mailer.js";
import { ensureAppCitiesSeeded } from "./utils/appCities.js";
import { createApp } from "./createApp.js";
import { attachChatRealtime } from "./realtime/chat.js";

const app = createApp();

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

  await backfillMatchPairKeys();
  try {
    await Match.collection.dropIndex("users_1_venueId_1");
  } catch {
    /* índice viejo (único por persona) ya no está */
  }
  await Match.collection.createIndex(
    { pairKey: 1, venueId: 1 },
    { unique: true, name: "pairKey_1_venueId_1" }
  );

  if (config.boot.syncIndexes) {
    await Match.syncIndexes();
  } else {
    console.log(
      "[boot] Match.syncIndexes omitido (SYNC_INDEXES≠1 en prod). One-shot: SYNC_INDEXES=1"
    );
  }

  await maybeSeed();
  await ensureAppCitiesSeeded();

  if (config.boot.syncData) {
    await syncPilotVenues();
    await ensureDemoAccounts();
    await normalizeLookingForSingleChoice();
  } else {
    console.log(
      "[boot] sync demos/pilotos omitido (prod). Emergencia: BOOT_SYNC=1 o npm run seed"
    );
  }

  await repairMissingMatches();

  await verifyMailTransport();

  const { startImageLifecycleScheduler } = await import(
    "./image-lifecycle/jobs/scheduler.js"
  );
  startImageLifecycleScheduler();

  const server = createServer(app);
  attachChatRealtime(server);
  server.listen(config.port, () => {
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

export { app };
