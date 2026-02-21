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
      (errors, values) => {
        if (errors && Object.keys(errors).length > 0) {
          return callback(errors, {});
        }

        if (!values) 
          return callback({}, {});

        if (configuration === "sid" || configuration === "nid") {
          return callback({}, Object.values(values));
        }

        if (configuration === "heapTotal" || configuration === "heapUsed") {
          const sum = Object.values(values).reduce((a, b) => a + b, 0);
          return callback({}, sum);
        }
        return callback({}, values);
      }
    );
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    globalThis.distribution.local.status.spawn(
      configuration,
      (e, v) => {
        if (e) 
          return callback(e, null);

        globalThis.distribution.local.groups.add(
          context.gid,
          configuration,
          (e2) => {
            callback(null, configuration);
          }
        );
      }
    );
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    globalThis.distribution[context.gid].comm.send(
      [ ],
      { 
        service: "status", 
        method: "stop",
      },
      callback
    );
  }

  return {get, stop, spawn};
}

module.exports = status;
