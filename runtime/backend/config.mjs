/** Flattened plugin config, merged with the process env. The host process is
 *  separate from the API, so it cannot rely on the API's applied config. */
let values = {};

export function setConfig(next) {
  values = next ?? {};
}

export function memoryEnv(name) {
  const value = values[name];
  if (value !== undefined && value !== '') {
    return String(value);
  }
  return process.env[name];
}
