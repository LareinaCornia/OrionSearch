function query(config) {
    function exec(queries, callback) {
        const indexGid = config.indexGid || config.gid || 'index';
        const terms = Array.isArray(queries) ? queries : [queries];
        const scores = {};
        let pending = terms.length;

        terms.forEach((term) => {
        globalThis.distribution[indexGid].store.get(term.toLowerCase(), (error, docs) => {
            if (!error && docs && typeof docs === 'object') {
            Object.keys(docs).forEach((docId) => {
                scores[docId] = (scores[docId] || 0) + (docs[docId].score || 0);
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