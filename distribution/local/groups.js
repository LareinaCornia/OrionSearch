// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const id = globalThis.distribution.util.id;
const allServices = require('../all/all.js');

const groupMap = new Map();

const localNode = globalThis.distribution.node.config;
const localSid = id.getSID(localNode);
groupMap.set("all", {[localSid]: localNode});

/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  if (!groupMap.has(name))
    return callback(new Error('unknown GID'), null);

  callback(null, groupMap.get(name));
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  const gid = typeof config === "string" ? config : config.gid;

  groupMap.set(gid, group);
  
  const all = groupMap.get("all");
  for (const sid in group) {
    all[sid] = group[sid];
  }

  globalThis.distribution[gid] = {
    status: allServices.status({ gid }),
    comm:   allServices.comm({ gid }),
    groups: allServices.groups({ gid }),
    routes: allServices.routes({ gid }),
    mem:    allServices.mem({ gid }),
    store:  allServices.store({ gid }),
    gossip: allServices.gossip({ gid }),
  };

  callback(null, group);
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  if (!groupMap.has(name))
    return callback(new Error('unkown GID'), null);

  const old = groupMap.get(name);
  groupMap.delete(name);

  delete globalThis.distribution[name];

  callback(null, old);
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  if (!groupMap.has(name))
    return callback && callback(new Error('unkown GID'), null);

  const sid = id.getSID(node);
  const group = groupMap.get(name);
  group[sid] = node;

  groupMap.get("all")[sid] = node;

  callback && callback(null, group);
};

/**
 * @param {string} name
 * @param {string} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  if (!groupMap.has(name))
    return callback && callback(new Error('unkown GID'), null);

  const group = groupMap.get(name);

  delete group[node];
  callback && callback(null, null);
}

module.exports = {get, put, del, add, rem};
