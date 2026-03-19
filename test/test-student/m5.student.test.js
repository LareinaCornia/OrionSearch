/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');
const id = distribution.util.id;

const studentGroup = {};

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

function getDatasetKeys(dataset) {
  return dataset.map((o) => Object.keys(o)[0]);
}


test('(1 pts) student test', (done) => {
  // Basic word count
  const mapper = (key, value) => value.split(/\s+/).map(w => ({ [w]: 1 }));
  const reducer = (key, values) => ({ [key]: values.reduce((a, b) => a + b, 0) });

  const dataset = [{ 'doc1': 'a a b' }];
  const expected = [{ a: 2 }, { b: 1 }];

  let cntr = 0;
  dataset.forEach(o => {
    const key = Object.keys(o)[0];
    distribution.m1.store.put(o[key], key, () => {
      cntr++;
      if (cntr === dataset.length) {
        distribution.m1.mr.exec(
          { keys: getDatasetKeys(dataset), map: mapper, reduce: reducer },
          (e, v) => {
            try {
              expect(v).toEqual(expect.arrayContaining(expected));
              done();
            } catch (err) {
              done(err);
            }
          }
        );
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  // Multiple documents aggregation
  const mapper = (key, value) => value.split(/\s+/).map(w => ({ [w]: 1 }));
  const reducer = (key, values) => ({ [key]: values.reduce((a, b) => a + b, 0) });

  const dataset = [
    { 'doc1': 'a b' },
    { 'doc2': 'a a' }
  ];
  const expected = [{ a: 3 }, { b: 1 }];

  let cntr = 0;
  dataset.forEach(o => {
    const key = Object.keys(o)[0];
    distribution.m2.store.put(o[key], key, () => {
      cntr++;
      if (cntr === dataset.length) {
        distribution.m2.mr.exec(
          { keys: getDatasetKeys(dataset), map: mapper, reduce: reducer },
          (e, v) => {
            try {
              expect(v).toEqual(expect.arrayContaining(expected));
              done();
            } catch (err) {
              done(err);
            }
          }
        );
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  // Count number of words per document
  const mapper = (key, value) => {
    const words = value.split(/\s+/).filter(w => w);
    return [{ [key]: words.length }];
  };

  const reducer = (key, values) => {
    return { [key]: values.reduce((a, b) => a + b, 0) };
  };

  const dataset = [
    { 'doc1': 'a b c' },
    { 'doc2': 'hello world' },
    { 'doc3': 'one two three four' }
  ];

  const expected = [
    { doc1: 3 },
    { doc2: 2 },
    { doc3: 4 }
  ];

  let cntr = 0;
  dataset.forEach(o => {
    const key = Object.keys(o)[0];
    distribution.m3.store.put(o[key], key, () => {
      cntr++;
      if (cntr === dataset.length) {
        distribution.m3.mr.exec(
          { keys: getDatasetKeys(dataset), map: mapper, reduce: reducer },
          (e, v) => {
            try {
              expect(v).toEqual(expect.arrayContaining(expected));
              expect(v).toHaveLength(expected.length);
              done();
            } catch (err) {
              done(err);
            }
          }
        );
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  // Numeric aggregation
  const mapper = (key, value) => [{ num: value }];
  const reducer = (key, values) => ({ [key]: values.reduce((a, b) => a + b, 0) });

  const dataset = [
    { 'k1': 1 },
    { 'k2': 2 },
    { 'k3': 3 }
  ];
  const expected = [{ num: 6 }];

  let cntr = 0;
  dataset.forEach(o => {
    const key = Object.keys(o)[0];
    distribution.m4.store.put(o[key], key, () => {
      cntr++;
      if (cntr === dataset.length) {
        distribution.m4.mr.exec(
          { keys: getDatasetKeys(dataset), map: mapper, reduce: reducer },
          (e, v) => {
            try {
              expect(v).toEqual(expected);
              done();
            } catch (err) {
              done(err);
            }
          }
        );
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  // Inverted index
  const mapper = (key, value) => {
    const words = value.split(/\s+/).filter(w => w);
    const uniqueWords = [...new Set(words)];
    return uniqueWords.map(w => ({ [w]: key }));
  };

  const reducer = (key, values) => {
    const uniqueDocs = [...new Set(values)];
    return { [key]: uniqueDocs.sort() };
  };

  const dataset = [
    { 'doc1': 'a b' },
    { 'doc2': 'a c' },
    { 'doc3': 'b c' }
  ];

  const expected = [
    { a: ['doc1', 'doc2'] },
    { b: ['doc1', 'doc3'] },
    { c: ['doc2', 'doc3'] }
  ];

  let cntr = 0;
  dataset.forEach(o => {
    const key = Object.keys(o)[0];
    distribution.m5.store.put(o[key], key, () => {
      cntr++;
      if (cntr === dataset.length) {
        distribution.m5.mr.exec(
          { keys: getDatasetKeys(dataset), map: mapper, reduce: reducer },
          (e, v) => {
            try {
              expect(v).toEqual(expect.arrayContaining(expected));
              expect(v).toHaveLength(expected.length);
              done();
            } catch (err) {
              done(err);
            }
          }
        );
      }
    });
  });
});


beforeAll((done) => {
  try {
    studentGroup[id.getSID(n1)] = n1;
    studentGroup[id.getSID(n2)] = n2;
    studentGroup[id.getSID(n3)] = n3;

    const startNodes = (cb) => {
      distribution.local.status.spawn(n1, (e) => {
        if (e) return done(e);
        distribution.local.status.spawn(n2, (e) => {
          if (e) return done(e);
          distribution.local.status.spawn(n3, (e) => {
            if (e) return done(e);
            cb();
          });
        });
      });
    };

    distribution.node.start((e) => {
      if (e) return done(e);

      startNodes(() => {
        const groups = ['m1', 'm2', 'm3', 'm4', 'm5'];
        let groupCntr = 0;
        groups.forEach(gid => {
          const config = { gid: gid };
          distribution.local.groups.put(config, studentGroup, () => {
            distribution[gid].groups.put(config, studentGroup, () => {
              groupCntr++;
              if (groupCntr === groups.length) done();
            });
          });
        });
      });
    });
  } catch (e) {
    done(e);
  }
});

afterAll((done) => {
  const remote = { service: 'status', method: 'stop' };

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