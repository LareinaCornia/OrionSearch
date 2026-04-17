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
            distribution.index.groups.put({gid: 'index'}, indexGroup, (groupErr) => {
              if (groupErr && Object.keys(groupErr).length > 0) return done(groupErr);
              done();
            });
          });
        });
      });
    });
  });
});

beforeEach((done) => {
  global.fetch = jest.fn(async (url) => {
    const u = String(url);
    if (u.includes('/package/foo')) {
      return {
        ok: true,
        status: 200,
        url: 'https://www.npmjs.com/package/foo',
        text: async () => '<html><body>Foo package alpha <a href="/package/bar">bar</a></body></html>',
      };
    }
    if (u.includes('/package/bar')) {
      return {
        ok: true,
        status: 200,
        url: 'https://www.npmjs.com/package/bar',
        text: async () => '<html><body>Bar package beta gamma</body></html>',
      };
    }
    return {
      ok: false,
      status: 404,
      url: u,
      text: async () => '',
    };
  });
  done();
});

afterEach(() => {
  delete global.fetch;
});

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
  const seedFile = writeSeedFile(['foo']);
  const outputGid = `docs_crawl_${Date.now()}`;
  ensureStoreGroup(outputGid, (groupErr) => {
    if (groupErr) {
      if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
      return done(groupErr);
    }
  const crawler = createCrawler({
    outputGid,
    seedFile,
    maxPages: 2,
    maxDepth: 1,
    minChars: 1,
  });

  crawler.exec((err, report) => {
    try {
      expectNoError(err);
      expect(report.implemented).toBe(true);
      expect(report.outputGid).toBe(outputGid);
      expect(report.fetchedDocs).toBe(2);
    } catch (e) {
      fs.unlinkSync(seedFile);
      return done(e);
    }

    distribution[outputGid].store.get(null, (e2, keys) => {
      try {
        expectNoError(e2);
        expect(Array.isArray(keys)).toBe(true);
        expect(keys).toHaveLength(2);
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
          expect(doc.text.length).toBeGreaterThan(0);
          expect(
            /foo package alpha|bar package beta gamma/i.test(doc.text)
          ).toBe(true);
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
  const seedFile = writeSeedFile(['foo']);
  const outputGid = 'docs';
  const indexGid = 'index';
  const pipeline = createPipeline({
    crawlConfig: {
      outputGid,
      seedFile,
      maxPages: 2,
      maxDepth: 1,
      minChars: 1,
    },
    indexConfig: {
      gid: indexGid,
      crawlGid: outputGid,
    },
  });

  pipeline.run({queries: ['gamma']}, (err, report) => {
    if (fs.existsSync(seedFile)) fs.unlinkSync(seedFile);
    try {
      expectNoError(err);
      expect(report.crawl.implemented).toBe(true);
      expect(report.index).toBeTruthy();
      distribution[indexGid].store.get('gamma', (e2, postings) => {
        try {
          expectNoError(e2);
          expect(Array.isArray(postings)).toBe(true);
          expect(postings.length).toBeGreaterThan(0);
          expect(postings[0].url).toBe('https://www.npmjs.com/package/bar');
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
