import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config, isMemoryDb } from "./config.js";

let memoryServer: MongoMemoryServer | null = null;

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:***@");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(err: unknown): string {
  const e = err as {
    message?: string;
    reason?: { servers?: Map<string, { error?: { message?: string } }> };
  };
  const servers = e.reason?.servers;
  if (!servers?.size) return e.message ?? String(err);

  const detail = [...servers]
    .map(([host, desc]) => `${host}: ${desc.error?.message ?? "sin respuesta"}`)
    .join(" | ");
  return `${e.message ?? "fallo de conexión"} → ${detail}`;
}

/** Reintenta la conexión: un corte de red o un cold start de Atlas no debe tumbar la API. */
export async function connectDb() {
  let uri = config.mongoUri;

  if (isMemoryDb) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri(config.mongoDbName);
    console.log("MongoDB en memoria (MVP local)");
  } else {
    console.log(`MongoDB Atlas/remoto: ${redactUri(uri)}`);
  }

  const attempts = isMemoryDb ? 1 : config.mongoRetries;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: isMemoryDb ? 5000 : 15000,
        dbName: isMemoryDb ? undefined : config.mongoDbName,
      });

      console.log(
        `MongoDB conectado (db: ${mongoose.connection.name || config.mongoDbName})`
      );
      registerConnectionLogs();
      return;
    } catch (err) {
      const last = attempt === attempts;
      console.error(
        `MongoDB intento ${attempt}/${attempts} falló: ${describeError(err)}`
      );
      if (last) throw err;
      const wait = Math.min(2000 * attempt, 10000);
      console.log(`Reintentando en ${wait / 1000}s…`);
      await delay(wait);
    }
  }
}

let logsRegistered = false;

function registerConnectionLogs() {
  if (logsRegistered) return;
  logsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB desconectado — Mongoose intentará reconectar");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconectado");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB error de conexión:", describeError(err));
  });
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
