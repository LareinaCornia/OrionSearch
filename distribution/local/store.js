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
 */
function extract(configuration, state) {
  let key;
  let gid = 'local';

  if (configuration == null && state)
    key = distribution.util.id.getID(state);
  else if (typeof configuration === 'string')
    key = configuration;
  else if (typeof configuration === 'object' && typeof configuration.key === 'string') {
    key = configuration.key;
    gid = configuration.gid || 'local';
  } 
  else
    return { error: new Error('invalid key') };

  key = String(key).replace(/[^a-zA-Z0-9]/g, '');
  return { key, gid };
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const { key, gid, error } = extract(configuration, state);
  if (error) 
    return callback(error, null);

  const dir = path.join(STORE_DIR, gid);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, key);

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
  if (configuration === null) {
    const gid = 'local'; 
    const dirPath = path.join(STORE_DIR, gid);

    return fs.readdir(dirPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT')
          return callback(null, []);
        return callback(err, null);
      }
      return callback(null, files);
    });
  }

  const { key, gid, error } = extract(configuration);
  
  if (error)
    return callback(new Error('invalid key'), null);

  const filePath = path.join(STORE_DIR, gid, key);
  
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
  const { key, gid, error } = extract(configuration);
  if (error || key == null)
    return callback(new Error('invalid key'), null);

  const filePath = path.join(STORE_DIR, gid, key);

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
