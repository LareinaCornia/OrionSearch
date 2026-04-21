require('../distribution.js')();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const createCrawler = require('../search/crawling/crawl.js');
const createPipeline = require('../search/main.js');

const distribution = globalThis.distribution;
const id = distribution.util.id;

const docsGroup = {};
const indexGroup = {};
const crawlGroup = {};

const n1 = {ip: '127.0.0.1', port: 9141};
const n2 = {ip: '127.0.0.1', port: 9142};
const n3 = {ip: '127.0.0.1', port: 9143};

function expectNoError(err) {
  if (!err) {
    expect(err).toBeFalsy();
    return;
  }
  if (err instanceof Error) {
    throw err;
  }
  expect(Object.keys(err)).toHaveLength(0);
}

function ensureStoreGroup(gid, callback) {
  distribution.local.groups.put({gid}, docsGroup, (localErr) => {
    if (localErr && Object.keys(localErr).length > 0) return callback(localErr);
    distribution[gid].groups.put({gid}, docsGroup, (groupErr) => {
      if (groupErr && Object.keys(groupErr).length > 0) return callback(groupErr);
      callback(null);
    });
  });
}

function writeSeedFile(lines) {
  const p = path.join(os.tmpdir(), `orionsearch-seeds-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(p, `${lines.join('\n')}\n`, 'utf8');
  return p;
}

beforeAll((done) => {
  docsGroup[id.getSID(n1)] = n1;
  docsGroup[id.getSID(n2)] = n2;
  docsGroup[id.getSID(n3)] = n3;
  indexGroup[id.getSID(n1)] = n1;
  indexGroup[id.getSID(n2)] = n2;
  indexGroup[id.getSID(n3)] = n3;
  crawlGroup[id.getSID(n1)] = n1;
  crawlGroup[id.getSID(n2)] = n2;
  crawlGroup[id.getSID(n3)] = n3;

  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e) => {
      if (e) return done(e);
      distribution.local.status.spawn(n2, (e2) => {
        if (e2) return done(e2);
        distribution.local.status.spawn(n3, (e3) => {
          if (e3) return done(e3);
          cb();
        });
      });
    });
  };

  distribution.node.start((e) => {
    if (e) return done(e);
    startNodes(() => {
      distribution.local.groups.put({gid: 'docs'}, docsGroup, () => {
        distribution.docs.groups.put({gid: 'docs'}, docsGroup, () => {
          distribution.local.groups.put({gid: 'index'}, indexGroup, () => {
            distribution.index.groups.put({gid: 'index'}, indexGroup, () => {
              distribution.local.groups.put({gid: 'crawl'}, crawlGroup, () => {
                distribution.crawl.groups.put({gid: 'crawl'}, crawlGroup, (groupErr) => {
                  if (groupErr && Object.keys(groupErr).length > 0) return done(groupErr);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});

jest.setTimeout(120000);

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, () => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});

test('crawler writes URL-keyed docs into docs gid', (done) => {
  const seedFile = writeSeedFile(['lodash']);
  const outputGid = `docs_crawl_${Date.now()}`;
  ensureStoreGroup(outputGid, (groupErr) => {
    if (groupErr) {
      if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
      return done(groupErr);
    }
  const crawler = createCrawler({
    outputGid,
    seedFile,
    maxPages: 1,
    maxDepth: 0,
    minChars: 1,
  });

  crawler.exec((err, report) => {
    try {
      expectNoError(err);
      expect(report.implemented).toBe(true);
      expect(report.outputGid).toBe(outputGid);
      expect(report.fetchedDocs).toBeGreaterThanOrEqual(1);
    } catch (e) {
      fs.unlinkSync(seedFile);
      return done(e);
    }

    distribution[outputGid].store.get(null, (e2, keys) => {
      try {
        expectNoError(e2);
        expect(Array.isArray(keys)).toBe(true);
        expect(keys.length).toBeGreaterThanOrEqual(1);
      } catch (e) {
        fs.unlinkSync(seedFile);
        return done(e);
      }

      distribution[outputGid].store.get(keys[0], (e3, payload) => {
        fs.unlinkSync(seedFile);
        try {
          expectNoError(e3);
          const doc = JSON.parse(String(payload));
          expect(typeof doc.url).toBe('string');
          expect(typeof doc.text).toBe('string');
          expect(doc.text.length).toBeGreaterThan(10);
          expect(doc.url.startsWith('https://www.npmjs.com/package/')).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });
  });
});

test('pipeline run connects crawler output to indexer input', (done) => {
  const seedFile = writeSeedFile(['lodash']);
  const outputGid = 'docs';
  const indexGid = 'index';
  const pipeline = createPipeline({
    crawlConfig: {
      outputGid,
      seedFile,
      maxPages: 1,
      maxDepth: 0,
      minChars: 1,
    },
    indexConfig: {
      gid: indexGid,
      crawlGid: outputGid,
    },
  });

  pipeline.run({queries: ['lodash']}, (err, report) => {
    if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
    try {
      expectNoError(err);
      expect(report.crawl.implemented).toBe(true);
      expect(report.crawl.fetchedDocs).toBeGreaterThanOrEqual(1);
      expect(report.index).toBeTruthy();
      distribution[indexGid].store.get('lodash', (e2, postings) => {
        try {
          expectNoError(e2);
          expect(Array.isArray(postings)).toBe(true);
          expect(postings.length).toBeGreaterThan(0);
          expect(typeof postings[0].url).toBe('string');
          expect(postings[0].url.includes('npmjs.com')).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      });
    } catch (e) {
      done(e);
    }
  });
});
