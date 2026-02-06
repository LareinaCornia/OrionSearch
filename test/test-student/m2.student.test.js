/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')({ ip: '127.0.0.1', port: 9000 });
require('../helpers/sync-guard');

beforeAll((done) => {
  distribution.node.start(done);
});

afterAll((done) => {
  if (distribution.node.server) {
    distribution.node.server.close();
  }
  done();
});

test('(1 pts) student test', (done) => {
  // status test
  distribution.local.status.get("ip", (err, res) => {
    try {
      expect(err).toBeNull();
      expect(res).toBe(distribution.node.config.ip);
      done();
    } catch (e) {
      done(e);
    }
  });
});


test('(1 pts) student test', (done) => {
  // routes test
  const service = {
    inc: (x, cb) => cb(null, x + 1)
  };

  distribution.local.routes.put(service, "inc", (err) => {
    expect(err).toBeNull();

    distribution.local.routes.get("inc", (err, res) => {
      expect(err).toBeNull();
      expect(res).toBe(service);

      distribution.local.routes.get("missing", (err) => {
        expect(err).toBeInstanceOf(Error);

        distribution.local.routes.rem("inc", (err) => {
          expect(err).toBeNull();

          distribution.local.routes.rem("missing", (err) => {
            expect(err).toBeInstanceOf(Error);
            done();
          });
        });
      });
    });
  });
});


test('(1 pts) student test', (done) => {
  // comm
  const echoService = {
    echo: (msg, cb) => cb(null, msg)
  };

  distribution.local.routes.put(echoService, "echo", () => {

    distribution.local.comm.send(
      ["echo"],
      { node: { ip: "127.0.0.1", port: 9000 }, service: "routes", method: "get" },
      (err, res) => {

        expect(err).toBeNull();

        distribution.local.comm.send(
          [],
          { node: { ip: "127.0.0.1", port: 9000 }, service: "bad", method: "x" },
          (err) => {
            expect(err).toBeInstanceOf(Error);
            done();
          }
        );
      }
    );
  });
});

test('(1 pts) student test', (done) => {
  // collecting multiple async callbacks
  const results = [];
  let finished = 0;

  function collect(err, value) {
    if (err) return done(err);

    results.push(value);
    finished++;

    if (finished === 3) {
      expect(results.sort()).toEqual([1, 2, 3]);
      done();
    }
  }

  setTimeout(() => collect(null, 1), 10);
  setTimeout(() => collect(null, 2), 5);
  setTimeout(() => collect(null, 3), 1);
});

test('(1 pts) student test', (done) => {
  // RPC-style invocation
  const addService = {
    add: (args, cb) => {
      const params = Array.isArray(args) ? args : [];
      const result = params[0] + params[1];
      cb(null, result);
    }
  };

  distribution.local.routes.put(addService, "add", () => {
    distribution.local.comm.send(
      [2, 3],
      { node: { ip: "127.0.0.1", port: 9000 }, service: "add", method: "add" },
      (err, result) => {
        try {
          expect(err).toBeNull();
          expect(result).toBe(5);
          done();
        } catch (e) {
          done(e);
        }
      }
    );
  });
});
