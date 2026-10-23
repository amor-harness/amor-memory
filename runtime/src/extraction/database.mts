import { connectAppDb, connectDb } from '../db.mjs';
import { createMemoryDb } from '../db/index.mjs';
import { createAclDeps } from '../db/acl.mjs';

/** The method set the data layer exposes to its consumers. */
type MemoryMethodSet = ReturnType<typeof createMemoryDb>['methods'];

let methodsPromise: Promise<MemoryMethodSet> | null = null;

/** The plugin-owned memory data layer, bound to the same instance-scoped
 *  Mongo connection as the rest of memory. */
export async function extractionMethods(): Promise<MemoryMethodSet> {
  if (methodsPromise == null) {
    methodsPromise = (async () => {
      const connection = await connectDb();
      const app = await connectAppDb();
      const db = createMemoryDb(connection, createAclDeps(app), app);
      return db.methods;
    })().catch((error) => {
      methodsPromise = null;
      throw error;
    });
  }
  return methodsPromise;
}
