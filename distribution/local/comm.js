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
    if (!remote || !remote.node) {
      return callback(new Error('Invalid remote target'));
    }

    const { ip, port } = remote.node;
    const gid = remote.gid || 'local';
    const path = `/${gid}/${remote.service}/${remote.method}`;

    const payload = JSON.stringify(message);

    const options = {
      hostname: ip,
      port: port,
      path: path,
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
          if (!data) return callback(null);

          const parsed = JSON.parse(data);

          if (parsed.error) {
            return callback(null, new Error(parsed.error));
          }

          return callback(null, parsed.value);

        } catch (e) {
          return callback(e);
        }
      });
    });

    req.on('error', (err) => {
      callback(err);
    });

    req.write(payload);
    req.end();

  } catch (err) {
    callback(err);
  }
}

module.exports = {send};
