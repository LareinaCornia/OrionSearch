// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

let counts = 0;
let node = null;

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  counts++;

  if (configuration === "heapUsed" || configuration === "heapTotal") {
    const mem = process.memoryUsage();
    return callback(null, mem[configuration]);
  }

  if (configuration === "counts") {
    return callback(null, counts);
  }

  if (!node) {
    return callback(new Error("Node not initialized"));
  }

  switch (configuration) {
    case "nid":
    case "sid":
    case "ip":
    case "port":
      if (node[configuration] !== undefined) {
        return callback(null, node[configuration]);
      }
      return callback(new Error("Property not found"));

    default:
      return callback(new Error("Accessible property does not exist"));
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  node = configuration;
  callback(null);
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(null);
}

module.exports = {get, spawn, stop};
