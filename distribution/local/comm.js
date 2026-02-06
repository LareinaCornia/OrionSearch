// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('node:http');

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} [gid]
 */

/**
 * @param {Array<any>} message
 * @param {Target} remote
 * @param {(error: Error, value?: any) => void} callback
 * @returns {void}
 */
function send(message, remote, callback) {
  try {
    if (!Array.isArray(message)) {
      return callback(new Error('Invalid message'), null);
    }

    if (!remote || typeof remote !== 'object') {
      return callback(new Error('Invalid remote'), null);
    }

    const { node, service, method } = remote;

    if (!node || typeof node !== 'object') {
      return callback(new Error('Invalid remote node'), null);
    }

    if (!node.ip || !node.port) {
      return callback(new Error('Invalid remote node'), null);
    }

    if (!service || typeof service !== 'string') {
      return callback(new Error('Invalid service'), null);
    }

    if (!method || typeof method !== 'string') {
      return callback(new Error('Invalid method'), null);
    }

    const gid = remote.gid || 'local';
    const path = `/${gid}/${service}/${method}`;

    const payload = globalThis.distribution.util.serialize(message);

    const options = {
      hostname: node.ip,
      port: node.port,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const decoded = globalThis.distribution.util.deserialize(data);

          if (!Array.isArray(decoded) || decoded.length !== 2) {
            return callback(new Error('Invalid response'), null);
          }

          const [err, value] = decoded;
          
          return callback(err || null, value ?? null);

        } catch (e) {
          return callback(e, null);
        }
      });
    });

    req.on('error', (err) => {
      callback(err, null);
    });

    req.write(payload);
    req.end();

  } catch (err) {
    callback(err, null);
  }
}

module.exports = {send};
