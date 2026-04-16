/**
 * @typedef {import("../distribution/types.js").Node} Node
 */

/**
 * @typedef {Object} PipelineConfig
 * @property {string} [gid]
 * @property {Node[]} [workers]
 * @property {string} [docsGid]
 * @property {string} [indexGid]
 * @property {{gid?: string}} [crawlConfig]
 * @property {{gid?: string, crawlGid?: string, indexGid?: string}} [indexConfig]
 * @property {{gid?: string, indexGid?: string}} [queryConfig]
 */

/**
 * @typedef {Object} PipelineRunConfig
 * @property {string[]} [queries]
 * @property {string} [crawlGid]
 */

/**
 * @typedef {Object} indexConfig
 * @property {number} totalDocs
 * @property {string} [gid]
 * @property {string} [crawlGid]
 * @property {string} [indexGid]
 */

module.exports = {};
