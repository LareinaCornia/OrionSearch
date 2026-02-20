// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const { fork } = require("node:child_process");
const path = require("node:path");
const util = require("../util/util.js"); 

let counts = 0;

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  counts++;

  const key = Array.isArray(configuration) ? configuration[0] : configuration;

  const node = distribution?.node?.config;
  const id = distribution.util.id;

  if (!node || !id)
    return callback(new Error('Node or ID utility not initialized'), null);

  if (key === "heapUsed" || key=== "heapTotal") {
    const mem = process.memoryUsage();
    return callback(null, mem[key]);
  }

  if (key === "counts")
    return callback(null, counts);
  
  switch (key) {
    case "nid":
      const nid = id.getNID(node);
      return callback(null, nid ?? null);
    case "sid":
      const sid = id.getSID(node);
      return callback(null, sid ?? null);
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
  if (!configuration || typeof configuration !== "object")
    return callback(new Error("Invalid configuration"), null);

  if (typeof configuration.ip !== "string" || 
      typeof configuration.port !== "number" ||
      configuration.port <= 0)
    return callback(new Error("Invalid node fields"), null);

  if (typeof callback !== "function")
    throw new Error("Callback required");

  const userOnStart = configuration.onStart;
  const rpcCallback = distribution.util.wire.createRPC(callback);

  const userSource = "(" + String(userOnStart) + ")";
  const rpcSource = "(" + String(rpcCallback) + ")";


  const composedOnStart = new Function(
    "e",
    "v",
    `
      const __user = ${userSource};
      const __rpc = ${rpcSource};

      if (typeof __user === "function") {
        __user(e, v);
      }

      __rpc(e, v, function(){});
    `
  );

  const newConfig = {
    ...configuration,
    onStart: composedOnStart
  };
  
  const entry = path.resolve(__dirname, "../../distribution.js");
  fork(entry, [ "--config", util.serialize(newConfig) ]);
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(null, "Node stopping");

  setTimeout(() => {
    const server = globalThis.distribution.node.server;
    if (server) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 10);
}

module.exports = {get, spawn, stop};
