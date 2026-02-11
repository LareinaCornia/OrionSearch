require('../distribution.js')();

const { performance } = require('node:perf_hooks');
const distribution = globalThis.distribution;

const ITER = 1000;

// simple service
function addOne(n) {
    return n + 1;
}

distribution.local.routes.put(
    { addOne },
    'bench',
    () => {

        let completed = 0;
        const latencies = [];

        const startTotal = performance.now();

        for (let i = 0; i < ITER; i++) {
            const start = performance.now();

            // the comm performence
            distribution.local.comm.send(
                [i],
                {
                    node: distribution.node.config,
                    service: 'bench',
                    method: 'addOne'
                },
                () => {
                const end = performance.now();
                    latencies.push(end - start);

                    completed++;

                    if (completed === ITER) {
                        const endTotal = performance.now();
                        const totalTime = endTotal - startTotal;

                        const avgLatency =
                        latencies.reduce((a, b) => a + b) / ITER;

                        const throughput =
                        ITER / (totalTime / 1000);

                        console.log({
                        totalTime: totalTime.toFixed(3) + " ms",
                        latency: avgLatency.toFixed(3) + " ms",
                        throughput: throughput.toFixed(2) + " req/s"
                        });

                        process.exit(0);
                    }
                }
            );
        }
    }
);
