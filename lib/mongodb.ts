import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not set. Add it to .env before starting the server.');
}

/**
 * `ignoreUndefined` keeps optional task fields (category, deferUntil, notes)
 * absent rather than stored as null — the client types treat the two
 * differently and a stray null would round-trip as a value.
 */
const options = {
  ignoreUndefined: true,
  /**
   * Serverless keeps one pool per warm instance, and instances fan out under
   * load. A small cap keeps a traffic spike from exhausting the cluster's
   * connection limit (500 on Atlas' free tier).
   */
  maxPoolSize: 10,
};

declare global {
  var _slateMongoClient: Promise<MongoClient> | undefined;
}

/**
 * One pooled client per process. In dev the module is re-evaluated on every
 * HMR pass, so the promise is parked on globalThis to avoid leaking a new
 * connection pool per edit.
 */
const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === 'development'
    ? (globalThis._slateMongoClient ??= new MongoClient(uri, options).connect())
    : new MongoClient(uri, options).connect();

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'slate');
}

export default clientPromise;
