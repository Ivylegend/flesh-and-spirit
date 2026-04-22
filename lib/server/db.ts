import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  __mongoose_cache__?: MongooseCache;
};

const cache = globalWithMongoose.__mongoose_cache__ ?? {
  conn: null,
  promise: null,
};

globalWithMongoose.__mongoose_cache__ = cache;

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
