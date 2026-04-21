/**
 * M6 Spell Check Performance Test
 */
const { performance } = require('node:perf_hooks');

const pipeline = require('../search/main.js');
const distribution = globalThis.distribution || require('../distribution.js')();

const ENVIRONMENT = 'LOCAL';
const ITER_LOOKUPS = 5000;

const LOCAL_NODES = [
  { ip: '127.0.0.1', port: 7110 },
  { ip: '127.0.0.1', port: 7111 },
  { ip: '127.0.0.1', port: 7112 },
];
const AWS_NODES = [
  { ip: '10.0.0.10', port: 7110 },
  { ip: '10.0.0.11', port: 7111 },
  { ip: '10.0.0.12', port: 7112 }
];

const WORKERS = ENVIRONMENT === 'AWS' ? AWS_NODES : LOCAL_NODES;

const seedFile = require('path').join(__dirname, '..', 'search', 'seeds', 'packages.txt');

const testPipeline = pipeline({
  workers: WORKERS,
  gid: 'all',
  crawlConfig: { seedFile, maxPages: 300, outputGid: 'docs' },
  indexConfig: { gid: 'index' },
});

const knownTerms = new Set();

// same spell check as site.js
function getEdits(word) {
  const edits = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  for (let i = 0; i < word.length; i++) {
    edits.push(word.slice(0, i) + word.slice(i + 1));
  }
  for (let i = 0; i < word.length - 1; i++) {
    edits.push(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
  }
  for (let i = 0; i < word.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      if (letters[j] !== word[i]) {
        edits.push(word.slice(0, i) + letters[j] + word.slice(i + 1));
      }
    }
  }
  for (let i = 0; i <= word.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      edits.push(word.slice(0, i) + letters[j] + word.slice(i));
    }
  }
  return [...new Set(edits)];
}

function spellCheck(term) {
  if (knownTerms.has(term)) return null;
  const edits = getEdits(term);
  for (let i = 0; i < edits.length; i++) {
    if (knownTerms.has(edits[i])) return edits[i];
  }
  return null;
}

function runPerformanceSuite() {
  console.log('--- INITIALIZING CLUSTER ---');

  testPipeline.init((err) => {
    if (err) {
      console.error('Initialization failed:', err);
      process.exit(1);
    }
    buildIndexPhase();
  });
}

function buildIndexPhase() {
  console.log('\nStarting Phase 0: Running crawl and index pipeline');
  testPipeline.run({ queries: [] }, (err) => {
    if (err) {
      console.error('Pipeline error:', err);
      process.exit(1);
    }
    console.log('[Pipeline] Done');
    loadTermsPhase();
  });
}

function loadTermsPhase() {
  console.log(`\nStarting Phase 1: Loading terms into memory`);

  const start = performance.now();
  let done = 0;

  WORKERS.forEach((node) => {
    distribution.local.comm.send(
      [{ gid: 'index', key: null }],
      { service: 'store', method: 'get', node: node },
      (err, keys) => {
        if (!err && Array.isArray(keys)) {
          keys.forEach(k => knownTerms.add(k));
        }
        done++;
        if (done === WORKERS.length) {
          const end = performance.now();
          const totalTimeSec = (end - start) / 1000;

          console.log(`[Load] Total Time: ${totalTimeSec.toFixed(3)} s`);
          console.log(`[Load] Terms Loaded: ${knownTerms.size}`);

          runLookupPhase();
        }
      }
    );
  });
}

function runLookupPhase() {
  console.log(`\nStarting Phase 2: Spell check lookups (${ITER_LOOKUPS} queries)`);

  // mix of correct and misspelled
  const testTerms = ['react', 'expres', 'angualr', 'typescrpt', 'webpak',
                     'redux', 'mochq', 'jeste', 'npm', 'javscript'];

  const latencies = [];
  const startBurst = performance.now();

  for (let i = 0; i < ITER_LOOKUPS; i++) {
    const term = testTerms[i % testTerms.length];
    const startReq = performance.now();
    spellCheck(term);
    const endReq = performance.now();
    latencies.push(endReq - startReq);
  }

  const totalBurstTime = (performance.now() - startBurst) / 1000;
  const avgLat = latencies.reduce((a, b) => a + b, 0) / ITER_LOOKUPS;

  console.log(`[Lookup] Total Time: ${totalBurstTime.toFixed(3)} s`);
  console.log(`[Lookup] Avg Latency: ${avgLat.toFixed(4)} ms`);
  console.log(`[Lookup] Throughput: ${(ITER_LOOKUPS / totalBurstTime).toFixed(2)} lookups/sec`);

  shutdown();
}

function shutdown() {
  console.log('Shutting down workers...');
  testPipeline.shutdown((err) => {
    if (err) console.error('Shutdown error:', err);
    console.log('\n--- PERFORMANCE TEST COMPLETE ---');
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  distribution.all.status.stop(() => process.exit());
});

runPerformanceSuite();