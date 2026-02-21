// bench/m3.performence.js
require('../distribution.js')();

const { performance } = require('node:perf_hooks');
const distribution = globalThis.distribution;
const id = distribution.util.id;

/**
 * M3 performance benchmark (spawn + gossip) with runtime adaptation:
 * - Do NOT modify library code.
 * - Patch gossip.send/comm.send so missing callback won't crash.
 *
 * Measures:
 * 1) Spawn times: distribution.local.status.spawn for many nodes
 * 2) Gossip propagation (lab/ec-only): distribution[gid].gossip.send + poll groups.get
 */

// -------------------- Tunables --------------------
const BASE_IP = '127.0.0.1';
const BASE_PORT = 8001;
const NODE_COUNT = 6; // ✅ change this (e.g., 10/20) to test more nodes

const GID = 'mygroup';
const NEWGROUP = 'newgroup';

// Weak gossip target (similar spirit to extra test): at least 2 node-views observe update
const GOSSIP_TARGET_MIN = 2;
const GOSSIP_POLL_MS = 50;
const GOSSIP_TIMEOUT_MS = 5000;

// Timeouts so script won't hang
const STOP_TIMEOUT_MS = 300;
const START_TIMEOUT_MS = 2000;
const SPAWN_TIMEOUT_MS = 5000;

// -------------------- Nodes --------------------
const PORTS = Array.from({ length: NODE_COUNT }, (_, i) => BASE_PORT + i);

// Base node (often used in tests)
const n1 = { ip: BASE_IP, port: 8000 };
const spawned = PORTS.map((p) => ({ ip: BASE_IP, port: p }));
const ALL_NODES = [n1, ...spawned];

// -------------------- Helpers --------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  let t = null;
  const timeout = new Promise((resolve) => {
    t = setTimeout(() => resolve([new Error(`Timeout: ${label} (${ms}ms)`), null]), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function patchCallbacks() {
  // Patch distribution[gid].gossip.send for known gids (including dynamic ones later)
  // and distribution.local.comm.send as a safety net.
  const patchSend = (obj, pathLabel) => {
    if (!obj || typeof obj.send !== 'function') return;
    const original = obj.send.bind(obj);
    obj.send = (message, remote, cb) => {
      if (typeof cb !== 'function') cb = () => {};
      return original(message, remote, cb);
    };
    // Optional debug:
    // console.log(`Patched ${pathLabel}.send`);
  };

  // local comm send safety (won't hurt)
  if (distribution?.local?.comm) patchSend(distribution.local.comm, 'distribution.local.comm');

  // Patch already-instantiated groups if present
  for (const k of Object.keys(distribution)) {
    if (distribution[k]?.gossip) patchSend(distribution[k].gossip, `distribution["${k}"].gossip`);
  }

  // Also patch future instantiations: if later you create distribution.mygroup, run patch again.
}

function stopNodeBestEffort(node) {
  return withTimeout(
    new Promise((resolve) => {
      const remote = { node, service: 'status', method: 'stop' };
      // ensure callback exists via patch
      distribution.local.comm.send([], remote, () => resolve([null, null]));
    }),
    STOP_TIMEOUT_MS,
    `stop ${node.ip}:${node.port}`
  ).then(() => null);
}

function startBaseNode() {
  return withTimeout(
    new Promise((resolve) => {
      distribution.node.start((e) => resolve([e, null]));
    }),
    START_TIMEOUT_MS,
    'distribution.node.start'
  );
}

function spawnNode(node) {
  return withTimeout(
    new Promise((resolve) => {
      distribution.local.status.spawn(node, (e, v) => resolve([e, v]));
    }),
    SPAWN_TIMEOUT_MS,
    `spawn ${node.ip}:${node.port}`
  );
}

function putLocalGroup(gid, groupObj) {
  return new Promise((resolve) => {
    distribution.local.groups.put({ gid }, groupObj, (e, v) => resolve([e, v]));
  });
}

function putDistGroup(gid, groupObj) {
  return new Promise((resolve) => {
    distribution[gid].groups.put({ gid }, groupObj, (e, v) => resolve([e, v]));
  });
}

function distGroupsPut(gid, groupName, groupObj) {
  return new Promise((resolve) => {
    distribution[gid].groups.put(groupName, groupObj, (e, v) => resolve([e, v]));
  });
}

function distGroupsGet(gid, groupName) {
  return new Promise((resolve) => {
    distribution[gid].groups.get(groupName, (e, v) => resolve([e, v]));
  });
}

function distGossipSend(gid, message, remote) {
  return new Promise((resolve) => {
    // ensure callback exists via patch
    distribution[gid].gossip.send(message, remote, (e, v) => resolve([e, v]));
  });
}

function countNonEmptyViews(viewObj) {
  let count = 0;
  if (!viewObj || typeof viewObj !== 'object') return 0;
  for (const k in viewObj) {
    if (viewObj[k] && typeof viewObj[k] === 'object' && Object.keys(viewObj[k]).length > 0) {
      count++;
    }
  }
  return count;
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.floor(sortedArr.length * p);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

// -------------------- Benchmark Steps --------------------
async function setupEnvironment() {
  // patch early (prevents callback-not-function crashes)
  patchCallbacks();

  console.log('Cleaning old nodes (best-effort stop) ...');
  for (const node of ALL_NODES) await stopNodeBestEffort(node);

  console.log('Starting base listening node ...');
  const [startErr] = await startBaseNode();
  if (startErr) throw startErr;
  console.log('Base node started.');

  // patch again (after node.start, some namespaces might appear)
  patchCallbacks();
}

async function measureSpawnTimes() {
  console.log('== M3 Performance: spawn times ==');

  if (!distribution.local?.status || typeof distribution.local.status.spawn !== 'function') {
    throw new Error('distribution.local.status.spawn is not a function (check your M3 status wiring)');
  }

  console.log('Spawning nodes:', ALL_NODES.map((n) => `${n.ip}:${n.port}`).join(', '));

  const latencies = [];

  for (const node of ALL_NODES) {
    const t0 = performance.now();
    const [e] = await spawnNode(node);
    const t1 = performance.now();

    if (e) throw e;

    const dt = t1 - t0;
    latencies.push(dt);
    console.log(`spawn ${node.ip}:${node.port} -> ${dt.toFixed(3)} ms`);
  }

  const sorted = latencies.slice().sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
  const p95 = percentile(sorted, 0.95);

  console.log({
    spawned: sorted.length,
    avgSpawnMs: avg.toFixed(3),
    p95SpawnMs: p95.toFixed(3),
  });

  return { avg, p95, all: sorted };
}

async function setupGroups() {
  // Build group object including all nodes we spawned
  const group = {};
  for (const node of ALL_NODES) group[id.getSID(node)] = node;

  const [e1] = await putLocalGroup(GID, group);
  if (e1 && Object.keys(e1).length > 0) throw e1;

  // Ensure distribution[gid] exists then patch gossip there
  if (!distribution[GID]) {
    throw new Error(`distribution["${GID}"] is not initialized after groups.put; check your M3 group wiring`);
  }
  patchCallbacks();

  const [e2] = await putDistGroup(GID, group);
  if (e2 && Object.keys(e2).length > 0) throw e2;

  return group;
}

async function measureGossipPropagation() {
  console.log('\n== M3 Performance: gossip propagation ==');

  // create empty group
  const [ePut] = await distGroupsPut(GID, NEWGROUP, {});
  if (ePut && Object.keys(ePut).length > 0) throw ePut;

  // gossip add message
  const newNode = { ip: BASE_IP, port: 4444 };
  const message = [NEWGROUP, newNode];
  const remote = { service: 'groups', method: 'add' };

  const t0 = performance.now();
  const [eSend] = await distGossipSend(GID, message, remote);
  if (eSend && Object.keys(eSend).length > 0) throw eSend;

  const deadline = t0 + GOSSIP_TIMEOUT_MS;

  while (performance.now() < deadline) {
    const [eGet, v] = await distGroupsGet(GID, NEWGROUP);
    if (eGet && Object.keys(eGet).length > 0) throw eGet;

    const observed = countNonEmptyViews(v);
    if (observed >= GOSSIP_TARGET_MIN) {
      const t1 = performance.now();
      const gossipMs = t1 - t0;

      console.log({
        gid: NEWGROUP,
        observedNodes: observed,
        targetMin: GOSSIP_TARGET_MIN,
        gossipMs: gossipMs.toFixed(3),
      });

      return { gossipMs, observed };
    }

    await sleep(GOSSIP_POLL_MS);
  }

  console.log({
    gid: NEWGROUP,
    result: 'NOT_CONVERGED',
    timeoutMs: GOSSIP_TIMEOUT_MS,
    targetMin: GOSSIP_TARGET_MIN,
  });

  return { gossipMs: null, observed: 0 };
}

async function cleanup() {
  console.log('\nCleaning up ...');

  // Patch again right before cleanup (in case some background code calls gossip.send without cb)
  patchCallbacks();

  for (const node of ALL_NODES) await stopNodeBestEffort(node);

  // Close base server last
  if (globalThis.distribution?.node?.server) {
    globalThis.distribution.node.server.close();
  }

  // Give pending in-flight requests a short moment to settle (optional but reduces noisy socket errors)
  await sleep(100);
}

// -------------------- Main --------------------
(async function main() {
  // Extra safety: if anything throws asynchronously, don't crash with unhelpful stack
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err?.stack || err);
  });
  process.on('unhandledRejection', (err) => {
    console.error('unhandledRejection:', err?.stack || err);
  });

  try {
    await setupEnvironment();

    const spawnStats = await measureSpawnTimes();

    await setupGroups();
    const gossipStats = await measureGossipPropagation();

    console.log('\n== Summary ==');
    console.log({
      nodeCount: ALL_NODES.length,
      avgSpawnMs: spawnStats.avg.toFixed(3),
      p95SpawnMs: spawnStats.p95.toFixed(3),
      gossipMs: gossipStats.gossipMs === null ? null : gossipStats.gossipMs.toFixed(3),
      gossipObservedNodes: gossipStats.observed,
    });
  } catch (err) {
    console.error('Benchmark failed:', err?.stack || err);
  } finally {
    await cleanup();
    process.exit(0);
  }
})();