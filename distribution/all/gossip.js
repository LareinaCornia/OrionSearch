// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Node} Node
 *
 * @typedef {Object} Remote
 * @property {Node} node
 * @property {string} service
 * @property {string} method

 * @typedef {Object} Payload
 * @property {Remote} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 *
 *
 * @typedef {Object} Gossip
 * @property {(payload: Payload, remote: Remote, callback: Callback) => void} send
 * @property {(perod: number, func: () => void, callback: Callback) => void} at
 * @property {(intervalID: NodeJS.Timeout, callback: Callback) => void} del
 * @property {(listener: Function) => void} register
 */

const distribution = globalThis.distribution;

/**
 * @type {Map<string, {
 *   listeners: Array<Function>,
 *   beaconStarted: boolean,
 *   beaconInFlight: boolean,
 *   debounceTimer: NodeJS.Timeout | null
 * }>}
 */
const GID_STATE = new Map();

function getSharedState(gid) {
  if (!GID_STATE.has(gid)) {
    GID_STATE.set(gid, {
      listeners: [],
      beaconStarted: false,
      beaconInFlight: false,
      debounceTimer: null,
    });
  }
  return GID_STATE.get(gid);
}

/**
 * @param {Config} config
 * @returns {Gossip}
 */
function gossip(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.subset = config.subset || function(lst) {
    return Math.ceil(Math.log(lst.length));
  };

  const shared = getSharedState(context.gid);

  /**
   * @param {Payload} payload
   * @param {Remote} remote
   * @param {Callback} callback
   */
  function send(payload, remote, callback) {
    distribution.local.groups.get(context.gid, (err, group) => {
      if (err) 
        return callback(err, null);

      const newPayload = payload.mid
        ? payload   // repost
        : {
            remote: remote,
            message: payload,
            mid: distribution.util.id.getMID(payload),
            gid: context.gid,
          };

      const sids = Object.keys(group);
      const nodes = Object.values(group);

      if (nodes.length === 0)
        return callback(new Error("Empty group"), null);

      const k = context.subset(sids);
      const shuffled = [...sids ].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, k);

      /** @type {{[sid: string]: any}} */
      const values = {};
      /** @type {{ [x: string]: Error }} */
      const errors = {};

      let pending = chosen.length;
      chosen.forEach((sid) => {
        const node = group[sid];
        globalThis.distribution.local.comm.send(
          [
            newPayload,
          ],
          {
            service: 'gossip',
            method: 'recv',
            node,
          },
          (e, v) => {
            e ? errors[sid] = e : values[sid] = v;
            pending--;
            if (pending === 0)
              callback(errors, values);
          }
        );
      });
    });
  }

  /**
   * @param {number} period
   * @param {() => void} func
   * @param {Callback} callback
   */
  function at(period, func, callback) {
    if (typeof period !== "number" || period <= 0)
      return callback(new Error("Invalid period"), null);

    if (typeof func !== "function")
      return callback(new Error("Invalid function"), null);

    const intervalID = setInterval(() => {
      try {
        func();
      } catch (err) {
        console.error("gossip.at execution error:", err);
      }
    }, period);

    callback(null, intervalID);
  }

  /**
   * @param {NodeJS.Timeout} intervalID
   * @param {Callback} callback
   */
  function del(intervalID, callback) {
    if (!intervalID)
      return callback(new Error("Invalid intervalID"));

    clearInterval(intervalID);
    callback(null, "stopped");
  }

  /**
   * @param {number} period
   */
  function beacons(period) {
    shared.beaconStarted = true;

    at(period, () => {
      // avoid overlapping healthy check rounds
      if (shared.beaconInFlight) 
        return; 
      shared.beaconInFlight = true;

      distribution.local.groups.get(context.gid, (e, group) => {
        if (e) {
          shared.beaconInFlight = false;
          return;
        }

        const selfSID = distribution.util.id.getSID(distribution.node.config);
        const deads = [];

        const entries = Object.entries(group || {});
        let pending = entries.length;

        entries.forEach(([sid, node]) => {
          if (sid === selfSID) {
            pending--;
            if (pending == 0)
                finishDetection(group, deads);
            return;
          }
            
          distribution.local.comm.send(
            [ 'port' ],
            { node, service: 'status', method: 'get' },
            (err, _) => {
              if (err)
                deads.push(sid);
              
              pending--;
              if (pending == 0)
                finishDetection(group, deads);
            }
          );
        });
        
        /**
         * @param {Object.<string, Node>} oldGroup
         * @param {string[]} deads
         */
        function finishDetection(oldGroup, deads) {
          if (!deads || deads.length === 0) {
            shared.beaconInFlight = false;
            return;
          }

          let pending = deads.length;
          deads.forEach((sid) => {
            // gossip dead notification
            send([ context.gid, sid ], { service: 'groups', method: 'rem' }, () => {});

            pending--;
            if (pending === 0) {
              distribution.local.groups.get(context.gid, (e2, newGroup) => {
                shared.beaconInFlight = false;
                if (e2) return;

                const oldSize = Object.keys(oldGroup || {}).length;
                const newSize = Object.keys(newGroup || {}).length;
                if (oldSize !== newSize)
                  upcall(oldGroup);
              });
            }
          });
        }
      });
    }, () => {});
  }

  /**
   * @param {Function} listener
   */
  function register(listener) {
    shared.listeners.push(listener);
  }

  /**
   * @param {Object.<string, Node>} oldGroup
   */
  function upcall(oldGroup) {
    // avoid trigger upcall frequently
    if (shared.debounceTimer) 
      return;

    shared.debounceTimer = setTimeout(() => {
      shared.debounceTimer = null;
      shared.listeners.forEach(listener => (listener(oldGroup)));
    }, 100);
  }

  // start beacons only once each gid
  // if (!shared.beaconStarted)
  //   beacons(1000);

  return {send, at, del, register};
}

module.exports = gossip;
