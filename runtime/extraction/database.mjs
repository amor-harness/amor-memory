import mongoose from 'mongoose';
import { createMemoryDb } from '../db/index.mjs';
import { createAclDeps } from '../db/acl.mjs';

let methodsPromise = null;

/** The plugin-owned memory data layer, bound to the host process's default
 *  mongoose connection. Extraction receives these methods as its
 *  `memoryMethods`, so capacity eviction, locking, versions and conversation
 *  links keep the original behavior without loading data-schemas models. */
export async function extractionMethods() {
  if (methodsPromise == null) {
    methodsPromise = (async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
      }
      const db = createMemoryDb(mongoose, createAclDeps(mongoose));
      return db.methods;
    })().catch((error) => {
      methodsPromise = null;
      throw error;
    });
  }
  return methodsPromise;
}
