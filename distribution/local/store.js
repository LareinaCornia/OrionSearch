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
 * @param {SimpleConfig} configuration
 */
function extract(configuration) {
  let key = configuration != null && typeof configuration === 'object' ? configuration.key : configuration;
  let gid = configuration != null && typeof configuration === 'object' ? configuration.gid : 'local';
  return { key, gid };
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  let { key, gid } = extract(configuration);

  key = key ? key : distribution.util.id.getID(state);
  key = String(key).replace(/[^a-zA-Z0-9]/g, '');

  const dir = path.join(STORE_DIR, `${ distribution.node.config.ip}-${distribution.node.config.port}`, gid);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, key);

  const data = distribution.util.serialize(state);

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
  const { key, gid } = extract(configuration);

  if (key === null) {
    const dirPath = path.join(STORE_DIR, `${distribution.node.config.ip}-${distribution.node.config.port}`, gid);

    return fs.readdir(dirPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT')
          return callback(null, []);
        return callback(err, null);
      }
      return callback(null, files);
    });
  }

  const filePath = path.join(STORE_DIR, `${distribution.node.config.ip}-${distribution.node.config.port}`, gid, key);
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
  const { key, gid } = extract(configuration);
  if (key == null)
    return callback(new Error('invalid key'), null);

  const filePath = path.join(STORE_DIR, `${distribution.node.config.ip}-${distribution.node.config.port}`, gid, key);
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
  const { key, gid } = extract(configuration);
  if (key == null)
    return callback(new Error('invalid key'), null);

  const filePath = path.join(STORE_DIR, `${distribution.node.config.ip}-${distribution.node.config.port}`, gid, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let values = [];
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    values = distribution.util.deserialize(data);
  }
  values.push(...(Array.isArray(state) ? state : [state]));

  fs.writeFileSync(filePath, distribution.util.serialize(values));
  callback(null, values);
}

function appendBatch(batch, configuration, callback) {
    const gid = configuration.gid || 'all';
    const keys = Object.keys(batch);
    let pending = keys.length;
    if (pending === 0) return callback(null, null);
    
    keys.forEach((key) => {
        append(batch[key], { gid, key }, () => {
            pending--;
            if (pending === 0) return callback(null, null);
        });
    });
}

module.exports = {put, get, del, append, appendBatch};
