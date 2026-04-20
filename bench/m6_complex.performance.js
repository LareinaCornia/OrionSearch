/**
 * M6 Complex Performance Test
 * * Breaks down the pipeline to measure TRUE concurrent throughput vs latency 
 * across raw storage, indexing, and high-volume querying.
 */
require('../distribution.js')();

const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const createCrawler = require('../search/crawling/crawl.js');
const createIndex = require('../search/indexing/index.js');
const createQuery = require('../search/querying/query.js');

const distribution = globalThis.distribution;
const id = distribution.util.id;

// -------------------- Configurable Constants --------------------
// TODO: adjust to AWS
const ENVIRONMENT = 'LOCAL';
const ITER_RAW = 5000;
// TODO: adjust as needed if mocking
const NUM_PAGES = 500;
const ITER_QUERIES = 2000;

const LOCAL_NODES = [
  { ip: '127.0.0.1', port: 7110 },
  { ip: '127.0.0.1', port: 7111 },
  { ip: '127.0.0.1', port: 7112 },
];

const AWS_NODES = [
  { ip: '10.0.0.10', port: 7110 },
  { ip: '10.0.0.11', port: 7111 },
  { ip: '10.0.0.12', port: 7112 },
];

const WORKERS = ENVIRONMENT === 'AWS' ? AWS_NODES : LOCAL_NODES;

// Setup mock fetch for the crawler phase
global.fetch = async (url) => {
  const terms = ['ai', 'js', 'react', 'distributed', 'systems', 'latency', 'throughput'];
  const text = Array.from({ length: 20 }, () => terms[Math.floor(Math.random() * terms.length)]).join(' ');
  return {
    ok: true, status: 200, url: String(url),
    text: async () => `<html><body>${text}</body></html>`,
  };
};

function writeSeedFile() {
  const p = path.join(os.tmpdir(), `perf-seed-${Date.now()}.txt`);

  // TODO: change to full pipeline
  const seeds = fs.readFileSync('../search/seeds/packages-simple.txt', 'utf8').split('\n').slice(0, 5000);

  fs.writeFileSync(p, `${seeds.join('\n')}\n`, 'utf8');
  return p;
}

function start() {
  distribution.node.start((e) => {
    if (e) return console.error(e), process.exit(1);

    let pending = WORKERS.length;
    WORKERS.forEach((node) => {
      distribution.local.status.spawn(node, (err) => {
        if (err) console.error('Spawn error:', err);
        if (--pending === 0) setupGroups();
      });
    });
  });
}

function setupGroups() {
  const group = {};
  WORKERS.forEach(node => { group[id.getSID(node)] = node; });

  distribution.local.groups.put({ gid: 'docs' }, group, () => {
    distribution.all.groups.put({ gid: 'docs' }, group, () => {
      distribution.local.groups.put({ gid: 'index' }, group, () => {
        distribution.all.groups.put({ gid: 'index' }, group, () => {
          runRawStorageBaseline();
        });
      });
    });
  });
}

// insert data
function runRawStorageBaseline() {
  console.log(`Starting storage...`);

  let completed = 0;

  for (let i = 0; i < ITER_RAW; i++) {
    const doc = { url: `test${i}`, text: "payload data" };
    distribution.docs.store.put(doc, doc.url, (err) => {
      completed++;
      if (completed === ITER_RAW) {
        runCrawlerPhase();
      }
    });
  }
}

// crawler
function runCrawlerPhase() {
  console.log(`\nStarting Phase 2: Crawler (${NUM_PAGES} seeds)`);
  const seedFile = writeSeedFile();
  const crawler = createCrawler({
    outputGid: 'docs',
    seedFile: seedFile,
    maxPages: NUM_PAGES,
    maxDepth: 1,
  });

  const startCrawl = performance.now();
  crawler.exec((err, report) => {
    const totalTimeSec = (performance.now() - startCrawl) / 1000;
    const docs = report ? report.fetchedDocs : NUM_PAGES;

    console.log(`[Crawler] Total Time: ${totalTimeSec.toFixed(3)} s`);
    console.log(`[Crawler] Throughput: ${(docs / totalTimeSec).toFixed(2)} pages/sec`);

    if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
    runIndexPhase();
  });
}

// indexer
function runIndexPhase() {
  console.log(`\nStarting Phase 3: Indexer`);
  const indexer = createIndex({
    gid: 'index',
    crawlGid: 'docs',
  });

  const startIndex = performance.now();
  indexer.exec((err, report) => {
    const totalTimeSec = (performance.now() - startIndex) / 1000;
    console.log(`[Indexer] Total Time: ${totalTimeSec.toFixed(3)} s`);
    console.log(`[Indexer] Check index sizes to calculate exact terms/sec throughput`);

    runQueryPhase();
  });
}

// query
function runQueryPhase() {
  console.log(`\nStarting Phase 4: Granular Query Concurrency (${ITER_QUERIES} concurrent queries)`);

  const queryer = createQuery({ gid: 'all', indexGid: 'index' });
  const searchTerms = ['ai', 'js', 'react', 'distributed', 'systems'];

  let completed = 0;
  const latencies = [];
  const startTotal = performance.now();

  for (let i = 0; i < ITER_QUERIES; i++) {
    const term = searchTerms[i % searchTerms.length];
    const startQuery = performance.now();

    queryer.exec([term], (err, results) => {
      const endQuery = performance.now();
      latencies.push(endQuery - startQuery);
      completed++;

      if (completed === ITER_QUERIES) {
        const totalTimeSec = (performance.now() - startTotal) / 1000;
        const avgLatency = latencies.reduce((a, b) => a + b) / ITER_QUERIES;
        const throughput = ITER_QUERIES / totalTimeSec;

        console.log(`[Query] Total Time: ${totalTimeSec.toFixed(3)} s`);
        console.log(`[Query] Avg Latency per Request: ${avgLatency.toFixed(3)} ms`);
        console.log(`[Query] True Throughput: ${throughput.toFixed(2)} queries/sec`);

        shutdown();
      }
    });
  }
}

function shutdown() {
  const remote = { service: 'status', method: 'stop' };
  let pending = WORKERS.length;
  WORKERS.forEach((node) => {
    remote.node = node;
    distribution.local.comm.send([], remote, () => {
      if (--pending === 0 && globalThis.distribution.node.server) {
        console.log('\n--- PERFORMANCE TEST COMPLETE ---');
        globalThis.distribution.node.server.close();
        process.exit(0);
      }
    });
  });
}

start();