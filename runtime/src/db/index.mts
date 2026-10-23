import type { Connection, Model, Schema as MongooseSchema } from 'mongoose';
import { createMemoryModels } from './models.mjs';
import { createMemoryMethodSet } from './methods.mjs';
import type { MemoryStoreDeps } from './methods.mjs';

/** Builds the plugin-owned memory data layer on the shared mongoose instance.
 *  ACL helpers stay injected so this module has no app-side dependency. */
interface ModelRegistry {
  models: Record<string, Model<unknown>>;
  model(name: string, schema: MongooseSchema): Model<unknown>;
  connection?: Connection;
}

/** The app's agent document, as far as the memory layer reads it. */
export interface AgentRow {
  id?: string;
  memory_store?: string;
  use_memory?: boolean;
}

export function createMemoryDb(
  mongoose: ModelRegistry,
  aclDeps: MemoryStoreDeps,
  appMongoose: ModelRegistry = mongoose,
) {
  const models = createMemoryModels(mongoose);
  const methods = createMemoryMethodSet(mongoose, aclDeps, appMongoose);
  const appConnection: Connection = appMongoose.connection ?? (mongoose.connection as Connection);
  const getAgent = async ({ id }: { id: string }): Promise<AgentRow | null> =>
    appConnection.collection<AgentRow>('agents').findOne({ id });
  return { models, methods: { ...methods, getAgent } };
}

export { createMemoryModels } from './models.mjs';
export { createMemoryMethodSet } from './methods.mjs';
