/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation(() => {});

const mygroupGroup = {};

const n1 = {ip: '127.0.0.1', port: 9100};
const n2 = {ip: '127.0.0.1', port: 9101};
const n3 = {ip: '127.0.0.1', port: 9102};

test('(1 pts) local.groups.put/get()', (done) => {
  const g = {
    [id.getSID(n1)]: n1,
    [id.getSID(n2)]: n2,
  };

  distribution.local.groups.put('student', g, (e) => {
    if (e) return done(e);
    distribution.local.groups.get('student', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(g);
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});

test('(1 pts) all.status.get(nid)', (done) => {
  const expected = Object.values(mygroupGroup).map(n => id.getNID(n));

  distribution.mygroup.status.get('nid', (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.values(v)).toEqual(expect.arrayContaining(expected));
      done();
    } catch (err) {
      done(err);
    }
  });
});

test('(1 pts) all.comm.send(status.get(nid))', (done) => {
  const expected = Object.values(mygroupGroup).map(n => id.getNID(n));
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['nid'], remote, (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.values(v)).toEqual(expect.arrayContaining(expected));
      done();
    } catch (err) {
      done(err);
    }
  });
});

test('(1 pts) all.routes.put()', (done) => {
  const svc = {
    ping: () => 'pong',
  };

  distribution.mygroup.routes.put(svc, 'ping', (e) => {
    if (e && Object.keys(e).length > 0) return done(e);

    const remote = {node: n1, service: 'routes', method: 'get'};
    distribution.local.comm.send(['ping'], remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v.ping()).toEqual('pong');
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});

test('(1 pts) all.groups.put/get()', (done) => {
  const g = {
    foo: {ip: '127.0.0.1', port: 9999},
  };

  distribution.mygroup.groups.put('xgroup', g, (e) => {
    if (e && Object.keys(e).length > 0) return done(e);

    distribution.mygroup.groups.get('xgroup', (e, v) => {
      try {
        expect(e).toEqual({});
        Object.values(v).forEach(view => {
          expect(view).toEqual(g);
        });
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});

beforeAll((done) => {
  const remote = {service: 'status', method: 'stop'};

  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, start);
    });
  });

  function start() {
    mygroupGroup[id.getSID(n1)] = n1;
    mygroupGroup[id.getSID(n2)] = n2;
    mygroupGroup[id.getSID(n3)] = n3;

    distribution.node.start((e) => {
      if (e) return done(e);

      distribution.local.status.spawn(n1, (e) => {
        if (e) return done(e);
        distribution.local.status.spawn(n2, (e) => {
          if (e) return done(e);
          distribution.local.status.spawn(n3, (e) => {
            if (e) return done(e);

            distribution.local.groups.put(
              {gid: 'mygroup'},
              mygroupGroup,
              (e) => {
                if (e) return done(e);
                done();
              }
            );
          });
        });
      });
    });
  }
});

afterAll((done) => {
  distribution.mygroup.status.stop(() => {
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
});