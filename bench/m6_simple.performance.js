/**
 * M6 Simple Performance Test
 */
require('../distribution.js')();

const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pipeline = require('../search/main.js');
const distribution = globalThis.distribution;
const id = distribution.util.id;

// -------------------- Configurable Constants --------------------
// TODO: change to 'AWS' by chaning to 'AWS_NODES'
const ENVIRONMENT = 'LOCAL';
// TODO: adjust as needed if mocking
const NUM_PAGES = null;

const LOCAL_NODES = [
  { ip: '127.0.0.1', port: 7110 },
  { ip: '127.0.0.1', port: 7111 },
  { ip: '127.0.0.1', port: 7112 },
];

// TODO: set these when aws running
const AWS_NODES = [
  { ip: '10.0.0.10', port: 7110 },
  { ip: '10.0.0.11', port: 7111 },
  { ip: '10.0.0.12', port: 7112 },
];

const WORKERS = ENVIRONMENT === 'AWS' ? AWS_NODES : LOCAL_NODES;

function writeSeedFile() {
  const p = path.join(os.tmpdir(), `perf-seed-${Date.now()}.txt`);


  // TODO: change to full pipeline
  const seeds = fs.readFileSync('../search/seeds/packages-simple.txt', 'utf8').split('\n').slice(0, 5000);

  fs.writeFileSync(p, `${seeds.join('\n')}\n`, 'utf8');
  return p;
}

const seedFile = writeSeedFile();

function start() {
  const p = pipeline({
    workers: WORKERS,
    gid: 'all',
    crawlConfig: {
      seedFile: seedFile,
      maxPages: NUM_PAGES,
      maxDepth: 1,
    }
  });

  p.init((err) => {
    if (err) {
      console.error('Init failed:', err);
      process.exit(1);
    }

    const group = {};
    WORKERS.forEach((node) => { group[id.getSID(node)] = node; });

    distribution.local.groups.put({ gid: 'index' }, group, () => {
      distribution.all.groups.put({ gid: 'index' }, group, () => {
        distribution.local.groups.put({ gid: 'docs' }, group, () => {
          distribution.all.groups.put({ gid: 'docs' }, group, () => {

            console.log(`Starting simple pipeline on ${WORKERS.length} nodes with ${NUM_PAGES} seeds...`);
            const startTotal = performance.now();

            p.run({ queries: [] }, (err, report) => {
              const endTotal = performance.now();
              const totalTimeSec = (endTotal - startTotal) / 1000;

              if (err) {
                console.error('Pipeline failed:', err);
                process.exit(1);
              }

              const docsFetched = report.crawl ? report.crawl.fetchedDocs || NUM_PAGES : NUM_PAGES;
              const throughput = docsFetched / totalTimeSec;

              console.log('\n--- SIMPLE PIPELINE PERFORMANCE ---');
              console.log(`Total Time:    ${totalTimeSec.toFixed(3)} s`);
              console.log(`Docs Crawled:  ${docsFetched}`);
              console.log(`Throughput:    ${throughput.toFixed(2)} docs/sec`);

              if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
              process.exit(0);
            });
          });
        });
      });
    });
  });
}

start();