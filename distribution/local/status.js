// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

let counts = 0;

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  counts++;

  const distribution = globalThis.distribution;
  if (!distribution) 
    return callback(new Error('Distribution missing'), null);

  const node = distribution?.node?.config;
  const id = distribution.util.id;

  if (!node || !id)
    return callback(new Error('Node or ID utility not initialized'), null);

  if (configuration === "heapUsed" || configuration === "heapTotal") {
    const mem = process.memoryUsage();
    return callback(null, mem[configuration]);
  }

  if (configuration === "counts")
    return callback(null, counts);

  switch (configuration) {
    case "nid":
      const nid = id.getNID(node);
      return callback(null, nid ?? null);
      // return callback(null, id.getNID(node));
    case "sid":
      const sid = id.getSID(node);
      return callback(null, sid ?? null);
      // return callback(null, id.getSID(node));
    case "ip":
      return callback(null, node.ip);
    case "port":
      return callback(null, node.port);
    default:
      return callback(new Error('Property does not exist'), null);
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  const distribution = globalThis.distribution;

  if (!distribution || !distribution.node) {
    return callback(new Error("Distribution not initialized"), null);
  }

  distribution.node.config = configuration;

  callback(null, null);
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  const distribution = globalThis.distribution;

  if (distribution && distribution.node) {
    distribution.node.config = null;
  }

  callback(null, null);
}

module.exports = {get, spawn, stop};
