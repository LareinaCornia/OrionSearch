// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Status
 * @property {(configuration: string, callback: Callback) => void} get
 * @property {(configuration: Node, callback: Callback) => void} spawn
 * @property {(callback: Callback) => void} stop
 */

const localSid = globalThis.distribution.util.id.getSID(globalThis.distribution.node.config);

/**
 * @param {Config} config
 * @returns {Status}
 */
function status(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    globalThis.distribution[context.gid].comm.send(
      [configuration],
      { 
        service: "status", 
        method: "get" 
      },
      callback
    );
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    globalThis.distribution.local.status.spawn(configuration, (err) => {
      if (err) return 
        callback(err);

      globalThis.distribution[context.gid].comm.send(
        [ context.gid, configuration ],
        { service: "groups", method: "add" },
        callback
      );
    });
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    globalThis.distribution.local.groups.get(context.gid, (err, group) => {
      if (err) 
        return callback(err);

      /** @type {{[sid: string]: any}} */
      const values = {};
      /** @type {{[sid: string]: Error}} */
      const errors = {};

      const sids = Object.keys(group).filter(
        sid => sid !== localSid 
      );

      if (sids.length === 0)
        return callback(null, {});

      let pending = sids.length;
      sids.forEach((sid) => {
        const node = group[sid];

        globalThis.distribution.local.comm.send(
          [],
          { node, service: "status", method: "stop" },
          (e, v) => {
            e ? errors[sid] = e : values[sid] = v;

            pending--;
            if (pending === 0) {
              callback(
                Object.keys(errors).length ? errors : null,
                values
              );
            }
          }
        );
      });
    });
  }

  return {get, stop, spawn};
}

module.exports = status;
