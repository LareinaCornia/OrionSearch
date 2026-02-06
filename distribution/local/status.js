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
  const node = distribution?.node?.config;

  if (configuration === "heapUsed" || configuration === "heapTotal") {
    const mem = process.memoryUsage();
    return callback(null, mem[configuration]);
  }

  if (configuration === "counts")
    return callback(null, counts);

    if (!node)
      return callback(Error('Node not initialized'));

  switch (configuration) {
    case "nid":
      return callback(null, node["nid"]);
    case "sid":
      return callback(null, node["sid"]);
    case "ip":
      return callback(null, node.ip);
    case "port":
      return callback(null, node.port);
    default:
      return callback(new Error("Property does not exist"));
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  const distribution = globalThis.distribution;

  if (!distribution || !distribution.node) {
    return callback(new Error("Distribution not initialized"));
  }

  distribution.node.config = configuration;

  callback(null);
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  const distribution = globalThis.distribution;

  if (distribution && distribution.node) {
    distribution.node.config = null;
  }

  callback(null);
}

module.exports = {get, spawn, stop};
