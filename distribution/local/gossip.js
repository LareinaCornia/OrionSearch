// @ts-check
/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {import("../types").Node} Node
 *
 * @typedef {Object} Payload
 * @property {{service: string, method: string, node: Node}} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 */

const N = 10;

const messageSeen = new Set();

/**
 * @param {Payload} payload
 * @param {Callback} callback
 */
function recv(payload, callback) {
  if (messageSeen.has(payload.mid)) {
    return callback(null, "duplicate");
  }

  messageSeen.add(payload.mid);

  const execRemote = {
    node: globalThis.distribution.node.config,
    service: payload.remote.service,
    method: payload.remote.method,
  };

  globalThis.distribution.local.comm.send(
    payload.message, 
    execRemote,
    (e, v) => {
      globalThis.distribution[payload.gid].gossip.send(payload);
      callback(e, v);
    }
  );
}

module.exports = {recv};
