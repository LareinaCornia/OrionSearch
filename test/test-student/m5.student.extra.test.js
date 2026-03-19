/*
    In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
const id = distribution.util.id;
require('../helpers/sync-guard');

const compactGroup = {};

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

test.only('(15 pts) implement compaction', (done) => {
    const mapper = (key, value) => {
        const words = value.split(' ');
        const out = [];
        words.forEach(w => {
            const obj = {};
            obj[w] = 1;
            out.push(obj);
        });
        return out;
    };

    const reducer = (key, values) => {
        const out = {};
        out[key] = values.reduce((a, b) => a + b, 0);
        return out;
    };

    const compact = reducer;

    const dataset = [
        {'doc1': 'aa bb'},
        {'doc2': 'ab ab'},
        {'doc3': 'bb aa'},
    ];

    const expected = [
        { aa: 2 },
        { bb: 2 },
        { ab: 2 }
    ];

    const doMapReduce = () => {
        distribution.icgp.mr.exec({keys: getDatasetKeys(dataset), map: mapper, reduce: reducer, compact: compact}, (e, v) => {
            try {
                expect(v).toEqual(expect.arrayContaining(expected));
                expect(v).toHaveLength(expected.length);
                done();
            } catch (e) {
                done(e);
            }
        });
    };

    let cntr = 0;

    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.icgp.store.put(value, key, (e, v) => {
            cntr++;
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});

test('(15 pts) add support for distributed persistence', (done) => {
    done(new Error('Not implemented'));
});

test('(5 pts) add support for optional in-memory operation', (done) => {
    done(new Error('Not implemented'));
});

test('(15 pts) add support for iterative map-reduce', (done) => {
    done(new Error('Not implemented'));
});

function getDatasetKeys(dataset) {
    return dataset.map((o) => Object.keys(o)[0]);
}

beforeAll((done) => {
    try {
        compactGroup[id.getSID(n1)] = n1;
        compactGroup[id.getSID(n2)] = n2;
        compactGroup[id.getSID(n3)] = n3;

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
            const compactConfig = {gid: 'icgp'};
            startNodes(() => {
                distribution.local.groups.put(compactConfig, compactGroup, () => {
                    distribution.icgp.groups.put(compactConfig, compactGroup, () => { done(); });
                });
            });
        });
    } catch (e) {
        done(e);
    }
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