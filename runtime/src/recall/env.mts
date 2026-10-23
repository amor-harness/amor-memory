import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

/** The config file's nesting as the env bridge walks it: string leaves become
 *  environment values, everything else is ignored. */
interface ConfigNode {
  [key: string]: unknown;
}

function flatten(
  value: ConfigNode | null | undefined,
  out: Record<string, string>,
): Record<string, string> {
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry as ConfigNode, out);
    } else if (typeof entry === 'string') {
      out[key] = entry;
    }
  }
  return out;
}

let values: Record<string, string> | null = null;

function configValues(): Record<string, string> {
  if (values == null) {
    try {
      values = flatten(
        JSON.parse(
          fs.readFileSync(path.join(directory, '..', '..', 'config.json'), 'utf8'),
        ) as ConfigNode,
        {},
      );
    } catch {
      values = {};
    }
  }
  return values;
}

/** The plugin config value for `name`, falling back to the process environment. */
export function memoryEnv(name: string): string | undefined {
  const value = configValues()[name];
  if (value !== undefined && value !== '') {
    return value;
  }
  return process.env[name];
}
