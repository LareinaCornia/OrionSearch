// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Hasher} Hasher
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const distribution = globalThis.distribution;


/**
 * @param {Config} config
 */
function store(config) {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || globalThis.distribution.util.id.naiveHash,
    subset: config.subset,
  };

  /**
   * @param {SimpleConfig} configuration
   */
  function extractKey(configuration) {
    if (configuration === null) 
      return null;

    if (typeof configuration === 'string')
      return configuration;

    if (typeof configuration === 'object')
      return configuration.key;

    return undefined;
  }

  /**
   * @param {String} key
   * @param {Callback} callback
   */
  function pickNode(key, callback) {
    distribution.local.groups.get(context.gid, (e, group) => {
      if (e) return callback(e);

      const nodes = Object.values(group || {});
      if (nodes.length === 0)
        return callback(new Error('Empty group'));

      const kid = distribution.util.id.getID(key);

      const nidToNode = new Map(nodes.map(node => [distribution.util.id.getNID(node), node]));
      const chosenNid = context.hash(kid, [...nidToNode.keys()]);
      const node = nidToNode.get(chosenNid);

      if (!node)
        return callback(new Error('Node not found'));
      callback(null, node);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const key = extractKey(configuration);

    if (key === null) {
      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) 
          return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0)
          return callback(new Error('Empty group'), null);

        let pending = nodes.length;

        /** @type {{ [x: string]: Error }} */
        const errors = {};
        const allKeys = new Set();

        nodes.forEach((node) => {
          const sid = distribution.util.id.getSID(node);
          distribution.local.comm.send(
            [ { gid: context.gid, key: null } ],
            {
              node,
              service: 'store',
              method: 'get'
            },
            (err, keys) => {
              if (err)
                errors[sid] = err;
              else if (Array.isArray(keys))
                keys.forEach(k => allKeys.add(k));

              pending--;
              if (pending === 0)
                return callback(errors, Array.from(allKeys));
            }
          );
        });
      });
      return;
    }

    if (key === undefined)
      return callback(new Error('invalid key'), null);

    pickNode(key, (e, node) => {
      if (e) 
        return callback(e, null);

      distribution.local.comm.send(
        [ { gid: context.gid, key} ],
        {
          node,
          service: 'store',
          method: 'get'
        },
        callback
      );
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    let key = extractKey(configuration);
    if (key === undefined)
      return callback(new Error('invalid key'), null);

    key = key === null ? distribution.util.id.getID(state) : key;

    pickNode(key, (e, node) => {
      if (e) 
        return callback(e, null);
      
      distribution.local.comm.send(
        [ state, { gid: context.gid, key } ],
        {
          node,
          service: 'store',
          method: 'put'
        },
        callback
      );
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    return callback(new Error('store.append not implemented'));
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    const key = extractKey(configuration);

    if (key === undefined || key === null)
      return callback(new Error('invalid key'), null);

    pickNode(key, (e, node) => {
      if (e) 
        return callback(e, null);

      distribution.local.comm.send(
        [ { gid: context.gid, key} ],
        {
          node,
          service: 'store',
          method: 'del'
        },
        callback
      );
    });
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('store.reconf not implemented'));
  }

  /* For the distributed store service, the configuration will
          always be a string */
  return {get, put, append, del, reconf};
}

module.exports = store;
