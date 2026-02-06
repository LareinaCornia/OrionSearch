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
  if (configuration === "heapUsed") {
    const mem = process.memoryUsage();
    return callback(null, mem.heapUsed);
  }


  if (!node) {
    return callback(new Error("Node not initialized"));
  }

  counts++;

  try {
    switch (configuration) {

      case "nid":
      case "sid":
      case "ip":
      case "port":
        if (node[configuration] !== undefined) {
          return callback(null, node[configuration]);
        }
        return callback(new Error("Property not found"));

      case "counts":
        return callback(null, counts);

      default:
        return callback(new Error("Accessible property does not exist"));
    }

  } catch (err) {
    return callback(err);
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
