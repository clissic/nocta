import "dotenv/config";
import { config } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";
import { seedDemoData } from "./seedData.js";

async function seed() {
  await connectDb();
  await seedDemoData();
  console.log(`Admin listo: ${config.adminEmail} / ${config.adminPassword}`);
  console.log("Venues y promos listos");
  await disconnectDb();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
