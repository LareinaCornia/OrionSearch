require('../distribution.js')();
const { util } = globalThis.distribution;
const { performance } = require('node:perf_hooks');

function measureLatency(fn, iters = 1000) {
    let total = 0;

    for (let i = 0; i < iters; i++) {
        const start = performance.now();
        fn();
        total += performance.now() - start;
    }

    return total / iters;
}

// workloads
const workloads = {
    small: { a: 1 },
    medium: Array.from({ length: 100 }, (_, i) => i),
    large: Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [`k${i}`, { v: i }])
    )
};

// pre-serialize
const serialized = Object.fromEntries(
    Object.entries(workloads).map(([k, v]) => [k, util.serialize(v)])
);

const results = {
    serialize: {},
    deserialize: {}
};

for (const [name, obj] of Object.entries(workloads)) {
    results.serialize[name] =
    measureLatency(() => util.serialize(obj));
    results.deserialize[name] =
    measureLatency(() => util.deserialize(serialized[name]));
}

console.log(JSON.stringify(results, null, 2));