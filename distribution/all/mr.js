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
 * @property {boolean} [mode]
 * @property {number} [rounds]
 * @property {string} [input]
 * @property {string} [output]
 *
 * @typedef {Object} Mr
 * @property {(configuration: MRConfig, cb: Callback) => void} exec
 */

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
   * @param {boolean} mode
   * @param {Callback} callback
   */
  function mapPhase(mrid, mode, callback) {
    console.log('MAP PHASE started for', mrid);
    const storage = mode ? globalThis.distribution.local.mem : globalThis.distribution.local.store;

    function notify() {
      console.log('MAP PHASE: notifying coordinator');
      return globalThis.distribution.local.comm.send(
        [[]],
        {
          service: mrid,
          method: 'notify',
          node: globalThis.distribution.node.config
        },
        (e) => {
          if (e) {
            return callback(e, null);
          }
          return callback(null, null);
        }
      );
    };

    storage.get({ gid: mrid, key: null }, (e, keys) => {
      if (e) return callback(e, null);

      let results = [];
      let pending = keys.length;
      if (pending == 0)
        return notify();

      keys.forEach((key) => {
        storage.get({ gid: mrid, key }, (e, value) => {
          if (e) return callback(e, null);

          globalThis.distribution.local.comm.send(
            [key, value],
            {
              service: mrid,
              method: 'map',
              node: globalThis.distribution.node.config
            },
            (e, rs) => {
              if (e) return callback(e, null);

              if (!Array.isArray(rs))
                rs = [rs];

              rs.forEach(obj => {
                Object.entries(obj).forEach(([k, v]) => {
                  results.push({ key: k, value: v });
                });
              });

              pending--;
              if (pending == 0) {
                // compaction
                globalThis.distribution.local.routes.get({ service: mrid }, (e, service) => {
                  if (!e && service['compact']) {
                    const grouped = Object.create(null);
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
                          storage.put(
                            results,
                            { gid: mrid, key: 'intermediate' },
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
                    storage.put(
                      results,
                      { gid: mrid, key: 'intermediate' },
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
   * @param {boolean} mode
   * @param {Callback} callback
   */
  function shufflePhase(mrid, mode, callback) {
    const storage = mode ? globalThis.distribution.local.mem : globalThis.distribution.local.store;
    const distributedStorage = mode ? globalThis.distribution[mrid].mem : globalThis.distribution[mrid].store;

    function notify() {
      console.log('SHUFFLE PHASE: notifying coordinator');
      return globalThis.distribution.local.comm.send(
        [[]],
        {
          service: mrid,
          method: 'notify',
          node: globalThis.distribution.node.config
        },
        (e) => {
          if (e) {
            return callback(e, null);
          }
          return callback(null, null);
        }
      );
    };

    storage.get({ gid: mrid, key: null }, (e, keys) => {
      if (e) return callback(e, null);

      keys = keys.filter(k => k !== 'intermediate');
      let pending = keys.length;
      if (pending == 0)
        return notify();

      keys.forEach((key) => {
        storage.del({ gid: mrid, key }, (e, _) => {
          if (e) return callback(e, null);

          pending--;
          if (pending === 0) {
            storage.get({ gid: mrid, key: 'intermediate' }, (e, list) => {
              if (e) return callback(e, null);

              pending = list.length;
              if (pending == 0)
                return notify();

              const grouped = Object.create(null);
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
                distributedStorage.append(
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
   * @param {boolean} mode
   * @param {string | undefined} outputGid
   * @param {Callback} callback
   */
  function reducePhase(mrid, mode, outputGid, callback) {
    const storage = mode ? globalThis.distribution.local.mem : globalThis.distribution.local.store;
    const finalOutputGid = outputGid || `${mrid}Output`;

    function notify(res) {
      console.log('REDUCE PHASE: notifying coordinator');
      return globalThis.distribution.local.comm.send(
        [res],
        {
          service: mrid,
          method: 'notify',
          node: globalThis.distribution.node.config
        },
        (e) => {
          if (e) {
            return callback(e, null);
          }
          return callback(null, res);
        }
      );
    }

    storage.get({ gid: mrid, key: null }, (e, keys) => {
      if (e) return callback(e, null);

      keys = keys.filter(k => k !== 'intermediate');
      let pending = keys.length;
      if (pending == 0)
        return notify([]);

      const results = [];
      keys.forEach((key) => {
        storage.get(
          { gid: mrid, key },
          (e, values) => {
            if (e) return callback(e, null);
            globalThis.distribution.local.comm.send(
              [key, values],
              {
                service: mrid,
                method: 'reduce',
                node: globalThis.distribution.node.config
              },
              (e, res) => {
                if (e) return callback(e, null);

                // distributed persistence implementation
                const [k, v] = Object.entries(res)[0];
                if (mode)
                  globalThis.distribution[finalOutputGid].mem.put(v, k, (e, _) => {
                    results.push(res);
                    pending--;
                    if (pending === 0)
                      return notify(results);
                  });
                else
                  globalThis.distribution[finalOutputGid].store.put(v, k, (e, _) => {
                    results.push(res);
                    pending--;
                    if (pending === 0)
                      return notify(results);
                  });
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
    console.log('MR.EXEC called on', context.gid, 'with', configuration.keys?.length || 0, 'keys');

    const gid = context.gid;
    const rounds = configuration.rounds || 1;

    if (rounds > 1) {
      const outputGid = configuration.output ||
        `mr-${gid}-${globalThis.distribution.util.id.getID({
          ...configuration,
          rounds,
          output: undefined,
        })}-round-${rounds}`;
      const current = {
        ...configuration,
        rounds: 1,
        output: outputGid,
      };

      return exec(current, (e, values) => {
        if (e) return cb(e, null);

        if (!Array.isArray(values) || values.length === 0) {
          return cb(null, values);
        }

        let pending = values.length;
        const nextKeys = [];
        values.forEach((obj) => {
          const [key, value] = Object.entries(obj)[0];
          nextKeys.push(key);

          globalThis.distribution[outputGid].store.put(value, key, (putErr) => {
            if (putErr) return cb(putErr, null);

            pending--;
            if (pending === 0) {
              return exec({
                ...configuration,
                keys: nextKeys,
                input: outputGid,
                rounds: rounds - 1,
              }, cb);
            }
          });
        });
      });
    }

    const mrid = `mr-${gid}-${globalThis.distribution.util.id.getID(configuration)}`;
    const mode = configuration.mode;
    const outputGid = configuration.output || `${mrid}Output`;

    globalThis.distribution.local.groups.get(gid, (e, group) => {
      if (e) return cb(e);

      const phases = ['mapPhase', 'shufflePhase', 'reducePhase'];
      const n = Object.keys(group).length;

      let idx = 0;
      let pending = n;
      let results = [];
      function notify(rs, callback) {
        console.log('COORDINATOR notify received, pending:', pending - 1);
        rs.forEach(r => { results.push(r); });

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
          const args = phases[idx] === 'reducePhase' ?
            [mrid, mode, outputGid] :
            [mrid, mode];
          globalThis.distribution[mrid].comm.send(
            args,
            {
              service: mrid,
              method: phases[idx],
              gid: mrid
            },
            () => { }
          );
        }
        callback(null, null);
      }

      const notifyRPC = globalThis.distribution.util.wire.createRPC(notify);

      function setup(callback) {
        console.log('SETUP: starting data migration for', configuration.keys.length, 'keys');
        console.log('SETUP: inputGid =', configuration.input || gid);
        console.log('SETUP: globalThis.distribution[inputGid] exists?', !!globalThis.distribution[configuration.input || gid]);
        let pending = configuration.keys.length;
        const inputGid = configuration.input || gid;

        if (pending === 0) {
          return callback(null, null);
        }

        globalThis.distribution.local.groups.put(mrid, group, () => {
          globalThis.distribution[gid].groups.put(mrid, group, () => {

            const outputDir = outputGid;
            globalThis.distribution.local.groups.put(outputDir, group, () => {
              globalThis.distribution[gid].groups.put(outputDir, group, () => {
                if (pending === 0) {
                  return callback(null, null);
                }

                // data migration
                configuration.keys.forEach(key => {
                  globalThis.distribution[inputGid].store.get(key, (_, value) => {
                    const storage = mode ? globalThis.distribution[mrid].mem : globalThis.distribution[mrid].store;
                    storage.put(value, key, () => {
                      pending--;
                      if (pending % 50 === 0) console.log('SETUP: migrated, pending:', pending);
                      if (pending == 0) {
                        console.log('SETUP: data migration complete, registering routes');
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

                        globalThis.distribution.local.routes.put(notify, 'notify', () => {
                          globalThis.distribution[mrid].routes.put(workerService, mrid, () => { callback(null, null); });
                        });
                      }
                    });
                  });
                });
              });
            });
          });
        });
      }

      function cleanup(callback) {
        globalThis.distribution[mrid].routes.rem(mrid, () => {
          globalThis.distribution[gid].groups.del(mrid, () => {
            globalThis.distribution.local.routes.rem('notify', () => {
              globalThis.distribution.local.groups.del(mrid, () => {
                callback(null, null);
              });
            });
          });
        });
      }

      setup(() => {
        console.log('SETUP complete, sending first phase to workers');
        const args = phases[0] === 'reducePhase' ?
          [mrid, mode, outputGid] :
          [mrid, mode];
        globalThis.distribution[mrid].comm.send(
          args,
          {
            service: mrid,
            method: phases[0],
            gid: mrid
          },
          () => {
            console.log('First phase dispatch returned');
          }
        );
      });
    });
  }

  return { exec };
}

module.exports = mr;
