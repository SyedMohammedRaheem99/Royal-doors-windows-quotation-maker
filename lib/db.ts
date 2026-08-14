import { MongoClient, type Db } from "mongodb";

const dbName = process.env.MONGODB_DB ?? "royal_quote";

// Reuse the client across hot reloads in dev and across warm serverless
// invocations in prod — Vercel functions are killed and recreated per
// deployment but reused between requests within their lifetime, and a fresh
// MongoClient per request would exhaust Atlas's connection limit.
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Deliberately lazy: the connection is only opened the first time getDb() is
// called, not at module import time. This lets pages/components that don't
// touch the database (e.g. a static shell) render even before MONGODB_URI is
// configured, and gives a clear error exactly where the DB was actually needed
// instead of crashing every route that transitively imports this module.
function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.local.example to .env.local and fill in your Atlas connection string."
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  return new MongoClient(uri).connect();
}

let clientPromise: Promise<MongoClient> | undefined;

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = connect();
  }
  const client = await clientPromise;
  return client.db(dbName);
}
