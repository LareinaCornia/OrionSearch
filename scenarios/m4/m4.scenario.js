require('../../distribution.js')();
const distribution = globalThis.distribution;
const util = distribution.util;
const id = distribution.util.id;

test('(5 pts) (scenario) use the local store', (done) => {
  /*
      Use the distributed store to put a key-value pair.
      Make sure to run the check() function at the last callback of your solution.
  */
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbspsg';

  distribution.local.store.put(user, key, (e, v) => {
    check();
  });

  function check() {
    distribution.local.store.get(key, (e, v) => {
      try {
        expect(v).toEqual(user);
        done();
      } catch (error) {
        done(error);
      }
    });
  }
});


test('(5 pts) (scenario) hash functions return different nodes', () => {
  /*

        Identify two keys that consistentHash maps to the same node. You will
        likely need to try a few (but not many) keys. What can you conclude
        about using consistentHash for a small number of keys.

    */
  const nodeIds = [
    util.id.getNID({ip: '192.168.0.1', port: 8000}),
    util.id.getNID({ip: '192.168.0.2', port: 8000}),
    util.id.getNID({ip: '192.168.0.3', port: 8000}),
    util.id.getNID({ip: '192.168.0.4', port: 8000}),
    util.id.getNID({ip: '192.168.0.5', port: 8000}),
  ];
  
  // Find two keys that map to the same node. 
  // 'a' and 'b' often collide on small rings, but we check and provide valid ones.
  let key1 = 'k1';
  let key2 = 'k4';

  const kid1 = util.id.getID(key1);
  const kid2 = util.id.getID(key2);

  const key1Node = util.id.consistentHash(kid1, nodeIds);
  const key2Node = util.id.consistentHash(kid2, nodeIds);

  expect(key1Node).toEqual(key2Node);
});

test('(5 pts) (scenario) hash functions return the same node', () => {
  /*

        Identify a key for which the three hash functions agree about its placement.
        You will likely need to try a few (but not many) keys.

    */

  const nodeIds = [
    util.id.getNID({ip: '192.168.0.1', port: 8000}),
    util.id.getNID({ip: '192.168.0.2', port: 8000}),
    util.id.getNID({ip: '192.168.0.3', port: 8000}),
    util.id.getNID({ip: '192.168.0.4', port: 8000}),
  ];

  // We need to find a key where naive, rendezvous, and consistent hash all point to the same NID.
  let key = 'choice'; 

  const kid = util.id.getID(key);

  const a = util.id.naiveHash(kid, nodeIds);
  const b = util.id.rendezvousHash(kid, nodeIds);
  const c = util.id.consistentHash(kid, nodeIds);

  expect(a).toEqual(b);
  expect(b).toEqual(c);
});

const n1 = {ip: '127.0.0.1', port: 9001};
const n2 = {ip: '127.0.0.1', port: 9002};
const n3 = {ip: '127.0.0.1', port: 9003};
const n4 = {ip: '127.0.0.1', port: 9004};
const n5 = {ip: '127.0.0.1', port: 9005};
const n6 = {ip: '127.0.0.1', port: 9006};

test('(5 pts) (scenario) use mem.reconf', (done) => {
  /*
  In this scenario, you will use the `mem.reconf` method to reconfigure the placement of items in a group of nodes.
  You will create a group of nodes and place items in them.
  Then, you will remove a node from the group and call `mem.reconf` to place the items in the remaining nodes.
  Finally, you will check if the items are in the right place.
  */

  // Create a group with any number of nodes
  const mygroupGroup = {};
  // Add more nodes to the group...
  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  // Create a set of items and corresponding keys...
  const keysAndItems = [
    {key: 'a', item: {first: 'Josiah', last: 'Carberry'}},
  ];

  // Experiment with different hash functions...
  const config = {gid: 'mygroup', hash: 'consistentHash'};

  distribution.local.groups.put(config, mygroupGroup, (e, v) => {
    // Now, place each one of the items you made inside the group...
    distribution.mygroup.groups.put(config, mygroupGroup, (e, v) => {
      distribution.mygroup.mem.put(keysAndItems[0].item, keysAndItems[0].key, (e, v) => {
        // We need to pass a copy of the group's
        // nodes before the changes to reconf()
        const groupCopy = {...mygroupGroup};

        // Remove a node from the group...
        let toRemove = n3;
        distribution.mygroup.groups.rem(
            'mygroup',
            id.getSID(toRemove),
            (e, v) => {
            // We call `reconf()` on the distributed mem service. This will place the items in the remaining group nodes...
              distribution.mygroup.mem.reconf(groupCopy, (e, v) => {
              // Fill out the `checkPlacement` function (defined below) based on how you think the items will have been placed after the reconfiguration...
                checkPlacement();
              });
            });
      });
    });
  });

  // This function will be called after we put items in nodes
  // Send the right messages to the right nodes to check if the items are in the right place...
  const checkPlacement = (e, v) => {
    const messages = [
      [{key: keysAndItems[0].key, gid: 'mygroup'}],
    ];

    // After removal of n3, we determine where 'a' maps in {n1, n2}
    const nodesRemaining = [util.id.getNID(n1), util.id.getNID(n2)];
    const targetNID = util.id.consistentHash(util.id.getID(keysAndItems[0].key), nodesRemaining);
    const targetNode = targetNID === util.id.getNID(n1) ? n1 : n2;

    const remote = {node: targetNode, service: 'mem', method: 'get'};
    distribution.local.comm.send(messages[0], remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(keysAndItems[0].item);
      } catch (error) {
        done(error);
        return;
      }

      // Write checks for the rest of the items...
      done(); // Only call `done()` once all checks are written
    });
  };
});

beforeAll((done) => {
  // First, stop the nodes if they are running
  const remote = {service: 'status', method: 'stop'};

  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              startNodes();
            });
          });
        });
      });
    });
  });

  const startNodes = () => {
    // Now, start the nodes listening node
    distribution.node.start(() => {
      // Start the nodes
      distribution.local.status.spawn(n1, (e, v) => {
        distribution.local.status.spawn(n2, (e, v) => {
          distribution.local.status.spawn(n3, (e, v) => {
            distribution.local.status.spawn(n4, (e, v) => {
              distribution.local.status.spawn(n5, (e, v) => {
                distribution.local.status.spawn(n6, (e, v) => {
                  done();
                });
              });
            });
          });
        });
      });
    });
  };
});


afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              if (globalThis.distribution.node.server) {
                globalThis.distribution.node.server.close();
              }
              done();
            });
          });
        });
      });
    });
  });
});