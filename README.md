# M2: Actors and Remote Procedure Calls (RPC)


## Summary

This milestone implements an extensible actor-style service architecture with asynchronous communication and remote procedure call (RPC) support. My implementation comprises 5 core components, totaling approximately 300 lines of code. Key challengs include:
* Maintaining consistent argument and callback handling across HTTP, routing, and RPC layers, which I resolved by enforcing a uniform invocation pattern using service[method](...args, callback).
* Preventing double async wrapping and recursive callback failures, which I solved by clearly separating synchronous business logic from a single toAsync wrapper boundary.
* Implementing RPC stub generation with remote pointer mapping while preserving routing abstraction, which I addressed by introducing a system-level RPC dispatcher with a consistent call signature.


## Correctness & Performance Characterization

*Correctness*: I wrote 8 tests; these tests take 13.049s to execute.

*Performance*: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`.


## Key Feature

`createRPC` lets one computer run a function that is stored on another computer. It takes a normal function and turns it into a special version that doesn’t run immediately. Instead, when you call it, it sends a request to the computer where the real function lives. Then that computer runs the function and send back the result. You receive the answer as if the function ran locally. From the outside, it still looks like a normal function call.