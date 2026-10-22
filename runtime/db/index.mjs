import { createMemoryModels } from './models.mjs';
import { createMemoryMethodSet } from './methods.mjs';

/** Builds the plugin-owned memory data layer on the shared mongoose instance.
 *  ACL helpers stay injected so this module has no app-side dependency. */
export function createMemoryDb(mongoose, aclDeps) {
  const models = createMemoryModels(mongoose);
  const methods = createMemoryMethodSet(mongoose, aclDeps);
  const getAgent = async ({ id }) =>
    mongoose.connection.collection('agents').findOne({ id });
  return { models, methods: { ...methods, getAgent } };
}

export { createMemoryModels } from './models.mjs';
export { createMemoryMethodSet } from './methods.mjs';
