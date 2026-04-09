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
   * @param {string | null} key
   */
  function withGid(key) {
    return {gid: context.gid, key};
  }

  /**
   * @param {any} err
   */
  function hasError(err) {
    if (!err) return false;
    if (err instanceof Error) return true;
    if (typeof err === 'object') return Object.keys(err).length > 0;
    return true;
  }

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
    else if (typeof configuration === 'object' && ('key' in configuration))
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
        return callback(e, null);

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) 
          return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0) 
          return callback(new Error('Empty group'), null);

        if (key === null) {
          let pending = nodes.length;

          /** @type {{ [x: string]: Error }} */
          const errors = {};
          const result = new Set();

          nodes.forEach((node) => {
            const sid = distribution.util.id.getSID(node);
            globalThis.distribution.local.comm.send(
              [withGid(null)],
              {
                service: 'mem',
                method: 'get',
                node
              },
              (err, keys) => {
                if (hasError(err))
                  errors[sid] = err;
                else if (Array.isArray(keys))
                  keys.forEach(k => result.add(k));

                pending--;
                if (pending === 0)
                  return callback(errors, Array.from(result));
              }
            );
          });
          return;
        }

        const kid = distribution.util.id.getID(key);
        const nidToNode = new Map(nodes.map(node => [distribution.util.id.getNID(node), node]));
        const nid = context.hash(kid, [...nidToNode.keys()]);
        const node = nidToNode.get(nid);

        globalThis.distribution.local.comm.send(
          [withGid(key)],
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
        return callback(e, null);

      key = key ?? distribution.util.id.getID(state);

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
          [state, withGid(key)],
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
    extractKey(configuration, (e, key) => {
      if (e)
        return callback(e, null);

      key = key ?? distribution.util.id.getID(state);

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e)
          return callback(e, null);

        const nodes = Object.values(group || {});
        if (nodes.length === 0)
          return callback(new Error('Empty group'), null);

        const kid = distribution.util.id.getID(key);
        const nidToNode = new Map(nodes.map((node) => [distribution.util.id.getNID(node), node]));
        const nid = context.hash(kid, [...nidToNode.keys()]);
        const node = nidToNode.get(nid);

        globalThis.distribution.local.comm.send(
          [state, withGid(key)],
          {
            service: 'mem',
            method: 'append',
            node,
          },
          callback
        );
      });
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    extractKey(configuration, (e, key) => {
      if (e) 
        return callback(e, null);

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
          [withGid(key)],
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
    const oldGroup = configuration || {};
    const oldNodes = Object.values(oldGroup);
    const oldNidToNode = new Map(oldNodes.map(node => [distribution.util.id.getNID(node), node]));
    const oldNids = [...oldNidToNode.keys()];

    distribution.local.groups.get(context.gid, (e, newGroup) => {
      if (e && Object.keys(e).length > 0)
        return callback(e, null);

      const newNodes = Object.values(newGroup || {});
      const newNidToNode = new Map(newNodes.map(node => [distribution.util.id.getNID(node), node]));
      const newNids = [...newNidToNode.keys()];

      let allKeys = [];
      let pendingScan = oldNodes.length;

      if (pendingScan === 0)
        return callback(null, []);

      oldNodes.forEach((node) => {
        distribution.local.comm.send(
          [withGid(null)],
          { service: 'mem', method: 'get', node },
          (err, keys) => {
            if (!hasError(err) && Array.isArray(keys)) {
              allKeys = allKeys.concat(keys);
            }
            pendingScan--;

            if (pendingScan === 0)
              processReconf(allKeys);
          }
        );
      });

      function processReconf(keys) {
        /** @type {{ key: string, from: any, to: any }[]} */
        const moves = [];

        keys.forEach((key) => {
          const kid = distribution.util.id.getID(key);

          const oldNid = context.hash(kid, oldNids);
          const newNid = context.hash(kid, newNids);

          if (oldNid === newNid)
            return;

          const fromNode = oldNidToNode.get(oldNid);
          const toNode = newNidToNode.get(newNid);

          if (!fromNode || !toNode)
            return;

          moves.push({ key, from: fromNode, to: toNode });
        });

        if (moves.length === 0)
          return callback(null, []);

        let pendingMove = moves.length;
        const movedKeys = [];
        let finished = false;

        moves.forEach(({ key, from, to }) => {
          distribution.local.comm.send(
            [withGid(key)],
            { service: 'mem', method: 'get', node: from },
            (err, value) => {
              if (finished) return;
              if (hasError(err)) {
                finished = true;
                return callback(err, null);
              }

              distribution.local.comm.send(
                [withGid(key)],
                { service: 'mem', method: 'del', node: from },
                (err2) => {
                  if (finished) return;
                  if (hasError(err2)) {
                    finished = true;
                    return callback(err2, null);
                  }

                  distribution.local.comm.send(
                    [value, withGid(key)],
                    { service: 'mem', method: 'put', node: to },
                    (err3) => {
                      if (finished) return;
                      if (hasError(err3)) {
                        finished = true;
                        return callback(err3, null);
                      }

                      movedKeys.push(key);
                      pendingMove--;

                      if (pendingMove === 0) {
                        finished = true;
                        return callback(null, movedKeys);
                      }
                    }
                  );
                }
              );
            }
          );
        });
      }
    });
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
