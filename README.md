# M3: Node Groups & Gossip Protocols


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M3 (`hours`) and the lines of code per task.


My implementation comprises 10 new software components, totaling 350 added lines of code over the previous implementation. Key challenges included:
* Separating fan-out (comm) from aggregation (status). I fixed this by moving aggregation logic into all.status.get.
* Ensuring consistent group membership across nodes. I corrected this by using all.groups.put instead of local.groups.put for distributed groups.
* Dynamically instantiating services per group using closures bound to a specific gid.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness* -- I validated the implementation using 8 official milestone tests(13.765s), 1 student tests(3.237s), and 1 scenario tests(6.852s). All tests pass under a multi-node distributed setup.


*Performance* -- Spawn time averaged about 389 ms per node (p95 ≈ 409 ms), showing moderate startup overhead. Gossip propagation was fast, converging in about 8.6 ms, indicating efficient update dissemination once nodes are running.


## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all_ other nodes in its group?
* The point of having a gossip protocol is to make communication scalable, efficient, and fault-tolerant.
* If a node sends the message to all other nodes directly, it creates too much network traffic and does not scale well as the system grows. Gossip reduces this overhead by spreading the message gradually through a few nodes at a time.
