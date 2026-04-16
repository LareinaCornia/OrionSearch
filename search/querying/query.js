function query(config) {
    function exec(queries, callback) {
        callback(null, {
            implemented: false,
            indexGid: config.indexGid || config.gid || 'index',
            queries,
        });
    };
    return { exec };
};

module.exports = query;
