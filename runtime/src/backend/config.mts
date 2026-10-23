/** Flattened plugin config, merged with the process env. The host process is
 *  separate from the API, so it cannot rely on the API's applied config. */
interface MemoryConfig {
  [name: string]: string | undefined;
}

let values: MemoryConfig = {};

export function setConfig(next: MemoryConfig | null | undefined): void {
  values = next ?? {};
}

export function memoryEnv(name: string): string | undefined {
  const value = values[name];
  if (value !== undefined && value !== '') {
    return String(value);
  }
  return process.env[name];
}
