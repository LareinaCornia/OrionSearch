require('../distribution.js')();
require('./helpers/sync-guard');

const createIndex = require('../search/indexing/index.js');

const distribution = globalThis.distribution;
const id = distribution.util.id;

const docsGroup = {};
const indexGroup = {};

const n1 = {ip: '127.0.0.1', port: 9121};
const n2 = {ip: '127.0.0.1', port: 9122};
const n3 = {ip: '127.0.0.1', port: 9123};

const indexer = createIndex({
  gid: 'index',
  crawlGid: 'docs',
});

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

function seedDocs(docs, callback) {
  let pending = docs.length;
  if (pending === 0) {
    return callback();
  }

  docs.forEach((entry) => {
    const key = Object.keys(entry)[0];
    distribution.docs.store.put(entry[key], key, (e) => {
      if (e) throw e;
      pending -= 1;
      if (pending === 0) {
        callback();
      }
    });
  });
}

function clearGroupStore(gid, callback) {
  distribution[gid].store.get(null, (e, keys) => {
    if (e && Object.keys(e).length > 0) {
      return callback(e);
    }

    if (!Array.isArray(keys) || keys.length === 0) {
      return callback(null);
    }

    let pending = keys.length;
    keys.forEach((key) => {
      distribution[gid].store.del(key, (delErr) => {
        if (delErr) {
          return callback(delErr);
        }

        pending -= 1;
        if (pending === 0) {
          callback(null);
        }
      });
    });
  });
}

function resetStores(callback) {
  clearGroupStore('docs', (docsErr) => {
    if (docsErr) {
      return callback(docsErr);
    }

    clearGroupStore('index', callback);
  });
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
      const docsConfig = {gid: 'docs'};
      distribution.local.groups.put(docsConfig, docsGroup, () => {
        distribution.docs.groups.put(docsConfig, docsGroup, () => {
          const indexConfig = {gid: 'index'};
          distribution.local.groups.put(indexConfig, indexGroup, () => {
            distribution.index.groups.put(indexConfig, indexGroup, () => {
              done();
            });
          });
        });
      });
    });
  });
});

beforeEach((done) => {
  resetStores(done);
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

test('builds postings into the stable index gid', (done) => {
  const docs = [
    {doc1: 'Machine learning powers search'},
    {doc2: 'Search systems use machine signals'},
    {doc3: 'Learning systems adapt quickly'},
  ];

  seedDocs(docs, () => {
    indexer.exec((e) => {
      try {
        expectNoError(e);
      } catch (error) {
        return done(error);
      }

      distribution.index.store.get('machine', (getErr, postings) => {
        try {
          expectNoError(getErr);
          expect(postings).toHaveLength(2);
          expect(postings[0].url).toBe('doc1');
          expect(postings[1].url).toBe('doc2');
          expect(postings[0].tf).toBe(1);
          expect(postings[1].tf).toBe(1);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('normalizes punctuation/casing and stores retrieval features', (done) => {
  const docs = [
    {doc4: 'Hello, HELLO! systems?'},
  ];

  seedDocs(docs, () => {
    indexer.exec((e) => {
      try {
        expectNoError(e);
      } catch (error) {
        return done(error);
      }

      distribution.index.store.get('hello', (getErr, postings) => {
        try {
          expectNoError(getErr);
          expect(postings).toHaveLength(1);
          expect(postings[0].url).toBe('doc4');
          expect(postings[0].tf).toBe(2);
          expect(postings[0].docLength).toBe(3);
          expect(postings[0].normalizedTf).toBeCloseTo(2 / 3);
          expect(postings[0].titleBoost).toBeGreaterThan(1);
          expect(postings[0].df).toBe(1);
          expect(postings[0].idf).toBeGreaterThan(0);
          expect(postings[0].score).toBeGreaterThan(0);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('sorts postings by ranking score instead of raw tf alone', (done) => {
  const docs = [
    {doc5: 'signal filler filler filler filler filler filler filler filler filler'},
    {doc6: 'signal rare'},
    {doc7: 'signal'},
  ];

  seedDocs(docs, () => {
    indexer.exec((e) => {
      try {
        expectNoError(e);
      } catch (error) {
        return done(error);
      }

      distribution.index.store.get('signal', (getErr, postings) => {
        try {
          expectNoError(getErr);
          expect(postings).toHaveLength(3);
          expect(postings[0].url).toBe('doc7');
          expect(postings[1].url).toBe('doc6');
          expect(postings[2].url).toBe('doc5');
          expect(postings[0].score).toBeGreaterThan(postings[1].score);
          expect(postings[1].score).toBeGreaterThan(postings[2].score);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});
