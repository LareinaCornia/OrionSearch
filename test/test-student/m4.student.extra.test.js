/*
    In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

test('(15 pts) detect the need to reconfigure', (done) => {
    const user1 = {first: "Alice", last: "A"};
    const user2 = {first: "Bob", last: "B"};

    const key1 = "reconfKey1";
    const key2 = "reconfKey2";

    const n1 = {ip: '127.0.0.1', port: 9101};
    const n2 = {ip: '127.0.0.1', port: 9102};
    const n3 = {ip: '127.0.0.1', port: 9103};

    const group = {};

    group[id.getSID(n1)] = n1;
    group[id.getSID(n2)] = n2;
    group[id.getSID(n3)] = n3;

    distribution.node.start((e) => {
        if (e) {
        done(e);
        return;
        }

        distribution.local.status.spawn(n1, () => {
        distribution.local.status.spawn(n2, () => {
            distribution.local.status.spawn(n3, () => {

            const config = {gid: "reconfGroup"};

            distribution.local.groups.put(config, group, () => {

                distribution.reconfGroup.groups.put(config, group, () => {

                distribution.reconfGroup.mem.put(user1, key1, () => {

                    distribution.reconfGroup.mem.put(user2, key2, () => {

                    // remove node to trigger reconf
                    distribution.local.groups.rem(
                        "reconfGroup",
                        id.getSID(n3),
                        () => {

                        distribution.reconfGroup.groups.rem(
                            "reconfGroup",
                            id.getSID(n3),
                            () => {

                            distribution.reconfGroup.mem.get(key1, (e, v) => {

                                try {
                                if (e) {
                                    expect(e).toBeInstanceOf(Error);
                                } else {
                                    expect(v).toBeDefined();
                                }
                                } catch (err) {
                                done(err);
                                return;
                                }

                                distribution.reconfGroup.mem.get(key2, (e, v) => {

                                try {
                                    if (e) {
                                    expect(e).toBeInstanceOf(Error);
                                    } else {
                                    expect(v).toBeDefined();
                                    }
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                                });
                            });
                            }
                        );
                        }
                    );

                    });
                });
                });
            });
            });
        });
        });
    });
});