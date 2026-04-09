// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const map = new Map();

/**
 * @param {SimpleConfig} configuration
 */
function extract(configuration) {
  let key = configuration != null && typeof configuration === 'object' ? configuration.key : configuration;
  let gid = configuration != null && typeof configuration === 'object' ? configuration.gid : 'local';
  return {key, gid};
}

/**
 * @param {?string} gid
 * @param {string} key
 */
function namespacedKey(gid, key) {
  return `${gid}:${key}`;
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  let {key, gid} = extract(configuration);

  key = key ? key : globalThis.distribution.util.id.getID(state);
  const storageKey = namespacedKey(gid, key);

  map.set(storageKey, state);
  return callback(null, state);
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const {key, gid} = extract(configuration);
  if (key == null)
    return callback(new Error('invalid key'), null);

  const storageKey = namespacedKey(gid, key);
  let values = [];
  if (map.has(storageKey)) {
    values = map.get(storageKey);
  }

  if (!Array.isArray(values)) {
    values = [values];
  }

  values.push(...(Array.isArray(state) ? state : [state]));
  map.set(storageKey, values);
  callback(null, values);
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const {key, gid} = extract(configuration);

  if (key === null) {
    const prefix = `${gid}:`;
    const keys = [];

    map.forEach((_, entryKey) => {
      if (entryKey.startsWith(prefix)) {
        keys.push(entryKey.slice(prefix.length));
      }
    });

    return callback(null, keys);
  }

  const storageKey = namespacedKey(gid, key);
  if (!map.has(storageKey))
    return callback(new Error('key not found'), null);

  return callback(null, map.get(storageKey));
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const {key, gid} = extract(configuration);
  if (key == null)
    return callback(new Error('invalid key'), null);

  const storageKey = namespacedKey(gid, key);
  if (!map.has(storageKey))
    return callback(new Error('key not found'), null);

  const value = map.get(storageKey);
  map.delete(storageKey);
  return callback(null, value);
}

module.exports = {put, get, del, append};
