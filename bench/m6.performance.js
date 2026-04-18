/**
 * M6 Performance Tests
 */

// -------------------- Configurable Constants --------------------
// TODO: replace with AWS IP
const NODES = [
  { ip: '127.0.0.1', port: 9000 },
  { ip: '127.0.0.1', port: 9001 },
  { ip: '127.0.0.1', port: 9002 },
];

const PIPELINE_GID = 'search-pipeline';
const TEST_QUERIES = ['distributed', 'systems', 'javascript'];
const MAX_RUNS = 3;

const CRAWL_OPTS = {
  seedFile: 'TODO',
  maxPages: 1,
  maxDepth: 1,
};

// ----------------------------------------------------------------

const { performance } = require('node:perf_hooks');
const pipelineFactory = require('../search/main.js');
const distribution = require('../distribution.js')();

const META_REPORT = {
  setup: {},
  iterations: [],
  summary: {},
};

function start() {
  const config = {
    gid: PIPELINE_GID,
    workers: NODES,
    crawlConfig: CRAWL_OPTS,
    indexConfig: { totalDocs: 10 },
    queryConfig: {},
  };

  const pipeline = pipelineFactory(config);

  const tInitStart = performance.now();
  pipeline.init((err) => {
    if (err) {
      process.exit(1);
    }

    META_REPORT.setup.initLatency = performance.now() - tInitStart;
    META_REPORT.setup.workerCount = NODES.length;

    runIteration(pipeline, 0);
  });
}

function runIteration(pipeline, count) {
  if (count >= MAX_RUNS) {
    return finalize();
  }

  const runConfig = { queries: TEST_QUERIES };
  const tRunStart = performance.now();

  pipeline.run(runConfig, (err, report) => {
    const tRunEnd = performance.now();

    META_REPORT.iterations.push({
      run: count + 1,
      latency: tRunEnd - tRunStart,
      error: err || null,
      crawlGid: report?.crawl?.outputGid,
      queryResultCount: report?.query ? Object.keys(report.query).length : 0,
    });

    runIteration(pipeline, count + 1);
  });
}

function finalize() {
  const totalLatency = META_REPORT.iterations.reduce((acc, it) => acc + it.latency, 0);

  META_REPORT.summary = {
    totalRuns: MAX_RUNS,
    avgLatencyMs: (totalLatency / MAX_RUNS).toFixed(3),
    throughputRunsPerSec: (MAX_RUNS / (totalLatency / 1000)).toFixed(3),
  };

  // Final Report Output
  console.log('--- M6 PERFORMANCE REPORT ---');
  console.log('Setup:', META_REPORT.setup);
  console.log('Iterations:', META_REPORT.iterations);
  console.log('Summary:', META_REPORT.summary);

  process.exit(0);
}

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

start();