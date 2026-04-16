function crawl(config) {
    function exec(callback) {
        callback(null, {
            implemented: false,
            outputGid: config.outputGid || config.gid || 'docs',
        });
    };
    return { exec };
};

module.exports = crawl;
