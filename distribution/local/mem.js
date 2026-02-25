// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {Object} StoreConfig
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const map = new Map();

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  if (configuration != null && typeof configuration != 'string')
    return callback(new Error('invalid string'), null);

  if (configuration == null) 
    configuration = globalThis.distribution.util.id.getID(state);
  
  map.set(configuration, state);
  return callback(null, state);
};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented'));
};

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  let key;
  if (typeof configuration === 'string')
    key = configuration;
  else if (typeof configuration === 'object' && configuration.key)
    key = configuration.key;
  else
    return callback(new Error('invalid key'), null);
  
  if (!map.has(key))
    return callback(new Error('key not found'), null);

  return callback(null, map.get(key));
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  if (typeof configuration !== 'string')
      return callback(new Error('invalid key'), null);

    if (!map.has(configuration))
      return callback(new Error('key not found'), null);

    const value = map.get(configuration);
    map.delete(configuration);
    return callback(null, value);
};

module.exports = {put, get, del, append};
