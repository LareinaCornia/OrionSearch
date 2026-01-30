# M1: Serialization / Deserialization


## Summary

My implementation provides a basic string-based serialization and deserialization mechanism for JavaScript values. It consists of 5 components with a total of 150 lines of code. 

The main challenges were handling JavaScript type edge cases (e.g., null vs. object) and ensuring round-trip correctness. These were addressed through explicit type checks and symmetric serialization/deserialization logic. 

The time spent and lines of code for this milestone are recorded in the report section of package.json.


## Correctness & Performance Characterization

*Correctness*: I wrote 10 tests; these tests take `4.585s` to execute. The tests cover primitive types (number, string, boolean), as well as null, undefined, function, array, error, and recursive object, and verify correct round-trip behavior for supported cases.


*Performance*: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.