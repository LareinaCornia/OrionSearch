/**
 * M6 Complex Performance Test (Granular Metrics)
 */
const { performance } = require('node:perf_hooks');
const path = require('node:path');

const pipeline = require('../search/main.js');
const createCrawler = require('../search/crawling/crawl.js');
const createIndex = require('../search/indexing/index.js');

const distribution = globalThis.distribution || require('../distribution.js')();

// -------------------- Configurable Constants --------------------
const ENVIRONMENT = 'LOCAL';
const NUM_PAGES = 1000;
const ITER_QUERIES = 2000;

const LOCAL_NODES = [
  { ip: '127.0.0.1', port: 7110 },
  { ip: '127.0.0.1', port: 7111 },
  { ip: '127.0.0.1', port: 7112 },
  { ip: '127.0.0.1', port: 7113 }
];
const AWS_NODES = [
  { ip: '10.0.0.10', port: 7110 },
  { ip: '10.0.0.11', port: 7111 },
  { ip: '10.0.0.12', port: 7112 }
];

const WORKERS = ENVIRONMENT === 'AWS' ? AWS_NODES : LOCAL_NODES;
const seedFile = path.join(__dirname, '..', 'search', 'seeds', 'packages-simple.txt');

const testPipeline = pipeline({
  workers: WORKERS,
  gid: 'all',
  crawlConfig: { seedFile, maxPages: NUM_PAGES, maxDepth: 3, outputGid: 'docs' },
  indexConfig: { gid: 'index' },
});

// -------------------- Execution Logic --------------------

function runPerformanceSuite() {
  console.log('--- INITIALIZING CLUSTER ---');

  testPipeline.init((err) => {
    if (err) {
      console.error('Initialization failed:', err);
      process.exit(1);
    }
    runCrawlerPhase();
  });
}

function runCrawlerPhase() {
  console.log(`\nStarting Phase 1: Crawler (${NUM_PAGES} pages)`);

  const crawler = createCrawler({
    outputGid: 'docs',
    seedFile: seedFile,
    maxPages: NUM_PAGES,
    maxDepth: 3,
  });

  const start = performance.now();
  crawler.exec((err, report) => {
    const end = performance.now();
    const totalTimeSec = (end - start) / 1000;
    const docs = (report && report.fetchedDocs) ? report.fetchedDocs : NUM_PAGES;

    console.log(`[Crawler] Total Time: ${totalTimeSec.toFixed(3)} s`);
    console.log(`[Crawler] Throughput: ${(docs / totalTimeSec).toFixed(2)} pages/sec`);

    runIndexPhase();
  });
}

function runIndexPhase() {
    console.log(`\nStarting Phase 2: Indexer`);

    const n1 = { ip: '127.0.0.1', port: 7110 };
    const n2 = { ip: '127.0.0.1', port: 7111 };
    const n3 = { ip: '127.0.0.1', port: 7112 };
    const n4 = { ip: '127.0.0.1', port: 7113 };
    const group = {};
    group[distribution.util.id.getSID(n1)] = n1;
    group[distribution.util.id.getSID(n2)] = n2;
    group[distribution.util.id.getSID(n3)] = n3;
    group[distribution.util.id.getSID(n4)] = n4;

    distribution.local.groups.put({gid: 'docs'}, group, () => {
        distribution.all.groups.put({gid: 'docs'}, group, () => {
            distribution.local.groups.put({gid: 'index'}, group, () => {
                distribution.all.groups.put({gid: 'index'}, group, () => {
                    const indexer = createIndex({
                        gid: 'index',
                        crawlGid: 'docs',
                    });

                    const start = performance.now();
                    indexer.exec((err, report) => {
                        const end = performance.now();
                        const totalTimeSec = (end - start) / 1000;

                        console.log(`[Indexer] Total Time: ${totalTimeSec.toFixed(3)} s`);
                        console.log(`[Indexer] Status: Completed across ${WORKERS.length} nodes`);

                        runQueryPhase();
                    });
                });
            });
        });
    });
}

function runQueryPhase() {
  console.log(`\nStarting Phase 3: Query System with (${ITER_QUERIES} queries)`);

  const queryer = require('../search/querying/query.js')({ gid: 'all', indexGid: 'index' });
  const searchTerms = ['npm', 'js', 'react', 'angular', 'system'];

  let completed = 0;
  const latencies = [];
  const startBurst = performance.now();

  for (let i = 0; i < ITER_QUERIES; i++) {
    const term = searchTerms[i % searchTerms.length];
    const startReq = performance.now();

    queryer.exec([term], (err) => {
      const endReq = performance.now();
      latencies.push(endReq - startReq);
      completed++;

      if (completed === ITER_QUERIES) {
        const totalBurstTime = (performance.now() - startBurst) / 1000;
        const avgLat = latencies.reduce((a, b) => a + b, 0) / ITER_QUERIES;

        console.log(`[Query] Total Time: ${totalBurstTime.toFixed(3)} s`);
        console.log(`[Query] Avg Latency: ${avgLat.toFixed(3)} ms`);
        console.log(`[Query] True Throughput: ${(ITER_QUERIES / totalBurstTime).toFixed(2)} queries/sec`);

        shutdown();
      }
    });
  }
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