// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(configuration: Object.<string, Node>, callback: Callback) => void} reconf
 */

const distribution = globalThis.distribution;


/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || globalThis.distribution.util.id.naiveHash;

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function extractKey(configuration, callback) {
    let key = null;
    if (configuration == null)
      key = null;
    else if (typeof configuration === 'string')
      key = configuration;
    else if (typeof configuration === 'object' && typeof configuration.key === 'string')
      key = configuration.key;
    else
      return callback(new Error('invalid key'), null);
    callback(null, key);
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    extractKey(configuration, (e, key) => {
      if (e) 
        callback(e, null);

      if (key == null) 
        return callback(new Error('invalid key'), null);

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0) 
          return callback(new Error('Empty group'), null);

        const kid = distribution.util.id.getID(key);
        const nidToNode = new Map(nodes.map(node => [distribution.util.id.getNID(node), node]));
        const nid = context.hash(kid, [...nidToNode.keys()]);
        const node = nidToNode.get(nid);

        globalThis.distribution.local.comm.send(
          [ configuration ],
          {
            service: 'mem',
            method: 'get',
            node
          },
          callback
        );
      });
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    extractKey(configuration, (e, key) => {
      if (e) 
        callback(e, null);

      key = key ?? distribution.util.id.getID(state);

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0) 
          return callback(new Error('Empty group'), null);

        const kid = distribution.util.id.getID(key);
        const nidToNode = new Map(nodes.map(node => [distribution.util.id.getNID(node), node]));
        const nid = context.hash(kid, [...nidToNode.keys()]);
        const node = nidToNode.get(nid);

        globalThis.distribution.local.comm.send(
          [ state, configuration ],
          {
            service: 'mem',
            method: 'put',
            node
          },
          callback
        );
      });
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    return callback(new Error('mem.append not implemented'));
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    extractKey(configuration, (e, key) => {
      if (e) 
        callback(e, null);

      if (key == null) 
        return callback(new Error('invalid key'), null);

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) 
          return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0) 
          return callback(new Error('Empty group'), null);
        
        const kid = distribution.util.id.getID(key);
        const nidToNode = new Map(nodes.map(node => [distribution.util.id.getNID(node), node]));
        const nid = context.hash(kid, [...nidToNode.keys()]);
        const node = nidToNode.get(nid);

        globalThis.distribution.local.comm.send(
          [ configuration ],
          {
            service: 'mem',
            method: 'del',
            node
          },
          callback
        );
      });
    });
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('mem.reconf not implemented'));
  }
  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;
