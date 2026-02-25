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

/* Notes/Tips:

- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/

const fs = require('node:fs');
const path = require('node:path');

const distribution = globalThis.distribution;

const STORE_DIR = path.resolve(__dirname, '.store');

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  if (configuration != null && typeof configuration !== 'string')
    return callback(new Error('invalid key'), null);

  if (configuration == null)
    configuration = distribution.util.id.getID(state);

  configuration = String(configuration).replace(/[^a-zA-Z0-9]/g, '');
  
  const filePath = path.join(STORE_DIR, configuration);

  const data = distribution.util.serialize(state);

  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFile(filePath, data, (err) => {
    if (err) 
      return callback(err, null);
    return callback(null, state);
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration == null || typeof configuration !== 'string')
    return callback(new Error('invalid key'), null);

  configuration = String(configuration).replace(/[^a-zA-Z0-9]/g, '');
  const filePath = path.join(STORE_DIR, configuration);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) 
      return callback(new Error('key not found'), null);
    const value = distribution.util.deserialize(data);
    callback(null, value);
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  if (configuration == null || typeof configuration !== 'string')
    return callback(new Error('invalid key'), null);

  configuration = String(configuration).replace(/[^a-zA-Z0-9]/g, '');
  const filePath = path.join(STORE_DIR, configuration);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) 
      return callback(new Error('key not found'), null);

    const value = distribution.util.deserialize(data);

    fs.unlink(filePath, (err2) => {
      if (err2) 
        return callback(err2, null);
      return callback(null, value);
    });
  });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('store.append not implemented'));
}

module.exports = {put, get, del, append};
