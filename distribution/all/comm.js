// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    const gid = context.gid;

    globalThis.distribution.local.groups.get(gid, (err, group) => {
      if (err) 
        return callback(err, null);

      const sids = Object.keys(group);
      const nodes = Object.values(group);

      if (nodes.length === 0)
        return callback(new Error("Empty group"), null);

      /** @type {{[sid: string]: any}} */
      const values = {};
      /** @type {{ [x: string]: Error }} */
      const errors = {};
      
      let pending = nodes.length;

      nodes.forEach((node, index) => {
        const sid = sids[index];
        globalThis.distribution.local.comm.send(
          message,
          {
            service: configuration.service,
            method: configuration.method,
            node,
          },
          (e, v) => {
            e ? errors[sid] = e : values[sid] = v;
            
            pending--;
            if (pending === 0) {
              callback(errors, values);
            }
          } 
        );
      });
    });
  }

  return {send};
}

module.exports = comm;
