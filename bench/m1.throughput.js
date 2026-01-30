require('../distribution.js')();
const distribution = globalThis.distribution;
const util = distribution.util;

function measureThroughput(fn, durationMs = 1000) {
    let count = 0;
    const start = Date.now();

    while (Date.now() - start < durationMs) {
        fn();
        count++;
    }

    return count;
}

// workloads
const small = { a: 1 };
const medium = Array.from({ length: 100 }, (_, i) => i);
const large = Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [`k${i}`, i])
);

const smallS = util.serialize(small);
const mediumS = util.serialize(medium);
const largeS = util.serialize(large);

const throughput = {
    serialize: {
        small: measureThroughput(() => util.serialize(small)),
        medium: measureThroughput(() => util.serialize(medium)),
        large: measureThroughput(() => util.serialize(large))
    },
    deserialize: {
        small: measureThroughput(() => util.deserialize(smallS)),
        medium: measureThroughput(() => util.deserialize(mediumS)),
        large: measureThroughput(() => util.deserialize(largeS))
    }
};

console.log(JSON.stringify(throughput, null, 2));