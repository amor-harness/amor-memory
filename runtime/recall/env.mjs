import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

function flatten(value, out) {
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry, out);
    } else if (typeof entry === 'string') {
      out[key] = entry;
    }
  }
  return out;
}

let values = null;

function configValues() {
  if (values == null) {
    try {
      values = flatten(JSON.parse(fs.readFileSync(path.join(directory, '..', '..', 'config.json'), 'utf8')), {});
    } catch {
      values = {};
    }
  }
  return values;
}

export function memoryEnv(name) {
  const value = configValues()[name];
  if (value !== undefined && value !== '') {
    return value;
  }
  return process.env[name];
}
