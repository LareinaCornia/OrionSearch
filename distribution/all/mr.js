// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

/**
 * Map functions used for mapreduce
 * @callback Mapper
 * @param {string} key
 * @param {any} value
 * @returns {object[]}
 */

/**
 * Reduce functions used for mapreduce
 * @callback Reducer
 * @param {string} key
 * @param {any[]} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 * @property {Reducer} [compact]
 *
 * @typedef {Object} Mr
 * @property {(configuration: MRConfig, cb: Callback) => void} exec
 */

const distribution = globalThis.distribution;

/*
  Note: The only method explicitly exposed in the `mr` service is `exec`.
  Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
  installed on the remote nodes and not necessarily exposed to the user.
*/

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  /**
   * @param {string} mrid
   * @param {Callback} callback
   */
  function mapPhase(mrid, callback) {
    function notify() {
      return distribution.local.comm.send(
        [[]],
        {
          service: mrid,
          method: 'notify',
          node: distribution.node.config
        },
        ( ) => { }
      );
    };

    distribution.local.store.get({ gid: mrid , key: null}, (e, keys) => {
      if (e)  return callback(e, null);

      let results = [];
      let pending = keys.length;
      if (pending == 0) 
        return notify();

      keys.forEach((key) => {
        distribution.local.store.get({ gid: mrid, key }, (e, value) => {
          if (e)  return callback(e, null);

          distribution.local.comm.send(
            [ key, value],
            {
              service: mrid,
              method: 'map',
              node: distribution.node.config
            },
            (e, rs) => {
              if (e) return callback(e, null);

              rs.forEach(obj => {
                Object.entries(obj).forEach(([k, v]) => {
                  results.push({ key: k, value: v });
                });
              });

              pending--;
              if (pending == 0) {
                // compaction
                distribution.local.routes.get({ service: mrid }, (e, service) => {
                  if (!e && service['compact']) {
                    const grouped = {};
                    results.forEach((item) => {
                      if (!grouped[item.key]) 
                        grouped[item.key] = [];
                      grouped[item.key].push(item.value);
                    });

                    results = [];
                    const entries = Object.entries(grouped);
                    pending = entries.length;
                    entries.forEach(([key, values]) => {
                      service['compact'](key, values, (_, result) => { 
                        Object.entries(result).forEach(([k, v]) => {
                          results.push({ key: k, value: v });
                        });
                        pending--;
                        if (pending == 0) {
                          distribution.local.store.put(
                            results,
                            { gid: mrid, key: 'intermediate'},
                            (e, _) => {
                              if (e) return callback(e, null);
                              return notify();
                            }
                          );
                        }
                      });
                    });
                  }
                  else {
                    distribution.local.store.put(
                      results,
                      { gid: mrid, key: 'intermediate'},
                      (e, _) => {
                        if (e) return callback(e, null);
                        return notify();
                      }
                    );
                  }
                });
              }
            }
          );
        });
      });
    });
  }

  /**
   * @param {string} mrid
   * @param {Callback} callback
   */
  function shufflePhase(mrid, callback) {
    function notify() {
      return distribution.local.comm.send(
        [[]],
        {
          service: mrid,
          method: 'notify',
          node: distribution.node.config
        },
        ( ) => { }
      );
    };
    
    distribution.local.store.get({ gid: mrid, key: null}, (e, keys) => {
      if (e) return callback(e, null);

      keys = keys.filter(k => k !== 'intermediate');
      let pending = keys.length;
      if (pending == 0) 
        return notify();

      keys.forEach((key) => {
        distribution.local.store.del({ gid: mrid, key }, (e, _) => {
          if (e) return callback(e, null);
          
          pending--;
          if (pending === 0) {
            // TODO: compaction implementation
            distribution.local.store.get({ gid: mrid, key: 'intermediate'}, (e, list) => {
              if (e) return callback(e, null);

              pending = list.length;
              if (pending == 0)
                return notify();

              const grouped = {};
              list.forEach((item) => {
                const k = item.key;
                const v = item.value;

                if (!grouped[k]) grouped[k] = [];
                grouped[k].push(v);
              });

              const entries = Object.entries(grouped);
              pending = entries.length;
              if (pending == 0) 
                return notify();

              entries.forEach(([key, values]) => {
                distribution[mrid].store.append(
                  values,
                  { gid: mrid, key: key },
                  (e, _) => {
                    if (e) return callback(e, null);
                    pending--;
                    if (pending == 0)
                      return notify();
                  }
                );
              });
            });
          }
        });
      });
    });
  }
  
  /**
   * @param {string} mrid
   * @param {Callback} callback
   */
  function reducePhase(mrid, callback) {
    function notify(res) {
      return distribution.local.comm.send(
        [res],
        {
          service: mrid,
          method: 'notify',
          node: distribution.node.config
        },
        (e, _) => { if (e)  return callback(e, null);}
      );
    }

    distribution.local.store.get({ gid: mrid, key: null}, (e, keys) => {
      if (e) return callback(e, null);

      keys = keys.filter(k => k !== 'intermediate');
      let pending = keys.length;
      if (pending == 0)
        return notify([]);

      const results = [];
      keys.forEach((key) => {
        distribution.local.store.get(
          { gid: mrid, key},
          (e, values) => {
            if (e) return callback(e, null);
            distribution.local.comm.send(
            [ key, values ], 
            {
              service: mrid,
              method: 'reduce',
              node: distribution.node.config
            },
            (e, res) => {
              if (e) return callback(e, null);
              results.push(res);
              pending--;
              if (pending === 0) 
                return notify(results);
            }
          );
          }
        );
      });
    });
  }

  /**
   * @param {MRConfig} configuration
   * @param {Callback} cb
   * @returns {void}
   */
  function exec(configuration, cb) {
    const gid = context.gid;
    const mrid = `mr-${gid}-${distribution.util.id.getID(configuration)}`

    distribution.local.groups.get(gid, (e, group) => {
      if (e) return cb(e);
      
      const phases = ['mapPhase', 'shufflePhase', 'reducePhase'];
      const n = Object.keys(group).length;
      
      let idx = 0;
      let pending = n;
      let results = [];
      function notify(rs, callback) {
        rs.forEach(r => {results.push(r);});
        
        pending--;
        if (pending === 0) {
          ++idx;
          if (idx >= phases.length) {
            return cleanup((e) => {
              if (e) return cb(e);
              cb(null, results);
            });
          }

          pending = n;
          results = [];
          globalThis.distribution[mrid].comm.send(
            [ mrid, () => {} ],
            {
              service: mrid,
              method: phases[idx],
              gid: mrid
            },
            () => {}
          );
        }
        callback(null, null);
      }
      
      const notifyRPC = globalThis.distribution.util.wire.createRPC(notify);   
      
      function setup(callback) {
        let pending = configuration.keys.length;

        distribution.local.groups.put(mrid, group, () => {
          distribution[gid].groups.put(mrid, group, () => {
            // data migration
            configuration.keys.forEach(key => {
              distribution[gid].store.get(key, (_, value) => {
                distribution[mrid].store.put(value, key, () => {
                  pending--;
                  if (pending == 0) {

                    // function registration
                    const map = new Function(
                      'key', 'value', 'cb', `
                      const fn = ${configuration.map.toString()};
                      const res = fn(key, value);
                      cb(null, res);
                    `);
                    const reduce = new Function(
                      'key', 'values', 'cb', `
                      const fn = ${configuration.reduce.toString()};
                      const res = fn(key, values);
                      cb(null, res);
                    `);

                    const workerService = {
                      'map': map,
                      'reduce': reduce,
                      'notify': notifyRPC,
                      'mapPhase': mapPhase,
                      'shufflePhase': shufflePhase,
                      'reducePhase': reducePhase
                    };
                
                    if (configuration.compact) {
                      const compact = new Function(
                        'key', 'values', 'cb', `
                        const fn = ${configuration.compact.toString()};
                        const res = fn(key, values);
                        cb(null, res);
                      `);
                      workerService['compact'] = compact;
                    }

                    distribution.local.routes.put(notify, 'notify', () => {
                      distribution[mrid].routes.put(workerService, mrid, () => { callback(null, null); });
                    });
                  }
                });
              });
            });
          });
        });
      }

      function cleanup(callback) {
        distribution[mrid].routes.rem(mrid, () => {
          distribution[gid].groups.del(mrid, () => {
            distribution.local.routes.rem('notify', () => {
              distribution.local.groups.del(mrid, () => {
                // TODO: mr task data clean up ?
                callback(null, null);
              });
            });
          });
        });
      }

      setup(() => {
        distribution[mrid].comm.send(
          [ mrid, () => {}],
          {
            service: mrid,
            method: phases[0],
            gid: mrid
          },
          () => {}
        );
      });
    });
  }

  return {exec};
}

module.exports = mr;
