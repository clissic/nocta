import { config, isMemoryDb } from "./config.js";
import { connectDb } from "./db.js";
import {
  seedDemoData,
  ensureDemoAccounts,
  normalizeLookingForSingleChoice,
  syncPilotVenues,
} from "./seedData.js";
import { Match } from "./models/Match.js";
import { User } from "./models/User.js";
import { verifyMailTransport } from "./mail/mailer.js";
import { ensureAppCitiesSeeded } from "./utils/appCities.js";
import { createApp } from "./createApp.js";

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

  try {
    await Match.collection.dropIndex("users_1_venueId_1");
  } catch {
    /* no existía */
  }
  await Match.syncIndexes();

  await maybeSeed();
  await ensureAppCitiesSeeded();
  await syncPilotVenues();
  await ensureDemoAccounts();
  await normalizeLookingForSingleChoice();
  await verifyMailTransport();

  const { startImageLifecycleScheduler } = await import(
    "./image-lifecycle/jobs/scheduler.js"
  );
  startImageLifecycleScheduler();

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

export { app };
