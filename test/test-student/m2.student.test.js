/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

test('(1 pts) student test', (done) => {
  // status test
  distribution.local.status.spawn(
    { ip: "127.0.0.1", port: 9000, nid: "n1", sid: "s1" },
    () => {

      distribution.local.status.get("ip", (err, res) => {
        expect(err).toBeNull();
        expect(res).toBe("127.0.0.1");
        done();
      });

    }
  );
});


test('(1 pts) student test', (done) => {
  // route
  const fn = (x, cb) => cb(null, x + 1);

  distribution.local.routes.put("inc", fn, (err) => {
    expect(err).toBeNull();

    distribution.local.routes.get("inc", (err, res) => {
      expect(err).toBeNull();
      expect(res).toBe(fn);

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
  distribution.local.routes.put("echo", (msg, cb) => {
    cb(null, msg);
  }, () => {

    distribution.local.comm.send(
      { service: "routes", method: "get", args: ["echo"] },
      (err, res) => {

        expect(err).toBeNull();
        expect(typeof res).toBe("function");

        distribution.local.comm.send(
          { service: "bad", method: "x", args: [] },
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
  // RPC-style remote invocation simulation
  distribution.local.routes.put("add", (args, cb) => {
    cb(null, args[0] + args[1]);
  }, () => {

    distribution.local.comm.send(
      { service: "routes", method: "get", args: ["add"] },
      (err, fn) => {

        expect(err).toBeNull();

        fn([2, 3], (err, result) => {
          expect(err).toBeNull();
          expect(result).toBe(5);
          done();
        });
      }
    );
  });
});
