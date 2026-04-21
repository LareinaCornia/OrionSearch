function query(config) {
    function exec(queries, callback) {
        const indexGid = config.indexGid || config.gid || 'index';
        const terms = Array.isArray(queries) ? queries : [queries];
        const scores = {};
        let pending = terms.length;

        if (pending === 0) {
            return callback(null, []);
        }

        terms.forEach((term) => {
            globalThis.distribution[indexGid].store.get(term.toLowerCase(), (error, docs) => {
                if (!error && Array.isArray(docs)) {
                    docs.forEach((entry) => {
                        if (entry && entry.url && typeof entry.score === 'number') {
                            scores[entry.url] = (scores[entry.url] || 0) + entry.score;
                        }
                    });
                }
                if (--pending === 0) {
                    const results = Object.entries(scores)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10);
                    callback(null, results);
                }
            });
        });
    }
    return { exec };
}

module.exports = query;