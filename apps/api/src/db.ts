import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "./config.js";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDb() {
  let uri = config.mongoUri;

  if (uri === "memory") {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("nocta");
    console.log("MongoDB en memoria (MVP local)");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("MongoDB conectado");
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
