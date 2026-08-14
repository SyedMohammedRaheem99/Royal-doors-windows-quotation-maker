// Starts a REAL local MongoDB (auto-downloaded binary via mongodb-memory-server)
// for local testing before pointing the app at the live Atlas cluster.
// Data persists to ./.local-mongo-data between restarts (not ephemeral) and
// listens on a fixed port so .env.local can point at it reliably.
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const dbPath = path.resolve(".local-mongo-data");
mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27117,
    dbPath,
    storageEngine: "wiredTiger",
  },
});

const uri = mongod.getUri("royal_quote");
console.log("Local MongoDB running at:", uri);
writeFileSync(path.resolve(".local-mongo-uri.txt"), uri);

process.on("SIGINT", async () => {
  await mongod.stop();
  process.exit(0);
});

// keep process alive
await new Promise(() => {});
