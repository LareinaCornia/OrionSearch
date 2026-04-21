// @ts-check
/**
 * @typedef {import("../distribution/types.js").Callback} Callback
 * @typedef {import("../distribution/types.js").Node} Node
 *
 * @typedef {import("./type.js").PipelineConfig} PipelineConfig
 * @typedef {import("./type.js").PipelineRunConfig} PipelineRunConfig
 */

const crawl = require('./crawling/crawl.js');
const index = require('./indexing/index.js');
const query = require('./querying/query.js');

// @ts-ignore
const distribution = globalThis.distribution || require('../distribution.js')();

/**
 * @param {any} err
 * @returns {boolean}
 */
function hasError(err) {
  if (!err) {
    return false;
  }
  if (err instanceof Error) {
    return true;
  }
  return typeof err === 'object' && Object.keys(err).length > 0;
}

/**
 * @param {Node[]} workers
 * @returns {Record<string, Node>}
 */
function buildGroup(workers) {
  /** @type {Record<string, Node>} */
  const group = {};
  workers.forEach((node) => {
    group[distribution.util.id.getSID(node)] = node;
  });
  return group;
}

/**
 * @param {string} gid
 * @param {Record<string, Node>} group
 * @param {Callback} callback
 */
function ensureGroup(gid, group, callback) {
  distribution.local.groups.put({ gid }, group, (localErr) => {
    if (localErr) {
      console.log(`ensureGroup local error for ${gid}:`, localErr);
      return callback(localErr, null);
    }
    console.log(`ensureGroup local success for ${gid}`);

    distribution.all.groups.put({ gid }, group, (remoteErr) => {
      if (hasError(remoteErr)) {
        console.log(`ensureGroup remote error for ${gid}:`, remoteErr);
        return callback(remoteErr, null);
      }
      console.log(`ensureGroup remote success for ${gid}`);
      callback(null, group);
    });
  });
}

/**
 * @param {PipelineConfig} config
 */
function pipeline(config) {
  const context = {
    initialized: false,
    workers: config.workers || [],
    gid: config.gid || 'all',
  };

  const crawlConfig = config.crawlConfig || {};
  const indexConfig = config.indexConfig || {};
  const queryConfig = config.queryConfig || {};

  const crawler = crawl(crawlConfig);
  const queryer = query(queryConfig);

  /**
   * @returns {string}
   */
  function statusSpawnGid() {
    const g = context.gid;
    if (distribution[g] && distribution[g].status) {
      return g;
    }
    return 'all';
  }

  /**
   * @param {Callback} callback
   */
  function init(callback) {
    if (context.initialized) {
      return callback(null, { workers: context.workers });
    }

    const workers = context.workers;
    const group = buildGroup(workers);

    function ensureSearchGroups(cb) {
      const gids = ['crawl', 'index', 'query', 'docs'];
      let i = 0;

      function next(err) {
        if (err) {
          return cb(err, null);
        }
        if (i >= gids.length) {
          return cb(null, group);
        }
        const gid = gids[i];
        i += 1;
        ensureGroup(gid, group, next);
      }

      next(null);
    }

    function spawnWorkers(cb) {
      if (workers.length === 0) {
        return cb(null, null);
      }

      let pending = workers.length;
      let done = false;
      workers.forEach((node) => {
        distribution[statusSpawnGid()].status.spawn(node, (err) => {
          if (done) {
            return;
          }
          if (err) {
            done = true;
            return cb(err, null);
          }

          pending -= 1;
          if (pending === 0) {
            cb(null, null);
          }
        });
      });
    }

    const finish = () => {
      ensureSearchGroups((groupErr) => {
        if (groupErr) {
          return callback(groupErr, null);
        }
        context.initialized = true;
        callback(null, {
          workers,
          gids: ['crawl', 'index', 'query', 'docs'],
        });
      });
    };

    if (distribution.node.server) {
      return spawnWorkers((spawnErr) => {
        if (spawnErr) {
          return callback(spawnErr, null);
        }
        finish();
      });
    }

    distribution.node.start((startErr) => {
      if (startErr) {
        return callback(startErr, null);
      }
      spawnWorkers((spawnErr) => {
        if (spawnErr) {
          return callback(spawnErr, null);
        }
        finish();
      });
    });
  }

  /**
   * @param {PipelineRunConfig} config
   * @param {Callback} callback
   */
  function run(config, callback) {
    const report = {
      crawl: null,
      index: null,
      query: null,
    };

    crawler.exec((crawlErr, crawlResult) => {
      if (hasError(crawlErr)) {
        return callback(crawlErr, null);
      }

      report.crawl = crawlResult || {
        outputGid: (config.crawlGid || (context.gid === 'crawl' ? 'crawl' : 'docs')),
      };
      const crawlReport = /** @type {{ outputGid?: string } | null} */ (report.crawl);

      const indexInputGid =
        (crawlReport && crawlReport.outputGid) ||
        crawlConfig.outputGid ||
        crawlConfig.gid ||
        config.crawlGid ||
        'docs';
      const runIndexer = index({
        ...indexConfig,
        crawlGid: indexInputGid,
      });

      runIndexer.exec((indexErr, indexResult) => {
        if (hasError(indexErr)) {
          return callback(indexErr, null);
        }

        report.index = indexResult;

        queryer.exec(config.queries || [], (queryErr, queryResult) => {
          if (hasError(queryErr)) {
            return callback(queryErr, null);
          }
          report.query = queryResult;
          callback(null, report);
        });
      });
    });
  }

  /**
   * @param {Callback} callback
   */
  function shutdown(callback) {
    if (!context.initialized) {
      return callback(null, { stopped: false, reason: 'not initialized' });
    }

    const workers = context.workers;
    if (workers.length === 0) {
      return distribution.local.status.stop(callback);
    }

    let pending = workers.length;
    let firstErr = null;

    workers.forEach((node) => {
      distribution.local.comm.send(
        [],
        { service: 'status', method: 'stop', node },
        (err) => {
          if (err && !firstErr) {
            firstErr = err;
          }

          pending -= 1;
          if (pending === 0) {
            context.initialized = false;
            distribution.local.status.stop((localErr, value) => {
              callback(firstErr || localErr || null, value);
            });
          }
        }
      );
    });
  }

  return { init, run, shutdown };
}

module.exports = pipeline;
