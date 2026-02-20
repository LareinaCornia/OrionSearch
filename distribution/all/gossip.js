// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Node} Node
 *
 * @typedef {Object} Remote
 * @property {Node} node
 * @property {string} service
 * @property {string} method

 * @typedef {Object} Payload
 * @property {Remote} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 *
 *
 * @typedef {Object} Gossip
 * @property {(payload: Payload, remote: Remote, callback: Callback) => void} send
 * @property {(perod: number, func: () => void, callback: Callback) => void} at
 * @property {(intervalID: NodeJS.Timeout, callback: Callback) => void} del
 */

const distribution = globalThis.distribution;

/**
 * @param {Config} config
 * @returns {Gossip}
 */
function gossip(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.subset = config.subset || function(lst) {
    return Math.ceil(Math.log(lst.length));
  };

  /**
   * @param {Payload} payload
   * @param {Remote} remote
   * @param {Callback} callback
   */
  function send(payload, remote, callback) {
    distribution.local.groups.get(context.gid, (err, group) => {
      if (err) 
        return callback(err, null);

      const newPayload = payload.mid
        ? payload   // repost
        : {
            remote: remote,
            message: payload,
            mid: distribution.util.id.getMID(payload),
            gid: context.gid,
          };

      const sids = Object.keys(group);
      const nodes = Object.values(group);

      if (nodes.length === 0)
        return callback(new Error("Empty group"), null);

      const k = context.subset(sids);
      const shuffled = [...sids ].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, k);

      /** @type {{[sid: string]: any}} */
      const values = {};
      /** @type {{ [x: string]: Error }} */
      const errors = {};

      let pending = chosen.length;
      chosen.forEach((sid) => {
        const node = group[sid];
        globalThis.distribution.local.comm.send(
          [
            newPayload,
          ],
          {
            service: 'gossip',
            method: 'recv',
            node,
          },
          (e, v) => {
            e ? errors[sid] = e : values[sid] = v;
            pending--;
            if (pending === 0)
              callback(errors, values);
          }
        );
      });
    });
  }

  /**
   * @param {number} period
   * @param {() => void} func
   * @param {Callback} callback
   */
  function at(period, func, callback) {
    return callback(new Error('gossip.at not implemented'));
  }

  /**
   * @param {NodeJS.Timeout} intervalID
   * @param {Callback} callback
   */
  function del(intervalID, callback) {
    return callback(new Error('gossip.del not implemented'));
  }

  return {send, at, del};
}

module.exports = gossip;
