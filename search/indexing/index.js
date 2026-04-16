// @ts-check
/**
 * @typedef {import("../../distribution/types.js").Callback} Callback
 * @typedef {import("../type.js").indexConfig} indexConfig
 */

/**
 * @typedef {{
 *   url: string,
 *   tf: number,
 *   docLength: number,
 *   normalizedTf: number,
 *   titleBoost: number,
 *   df?: number,
 *   idf?: number,
 *   score?: number
 * }} Posting
 */

const distribution = /** @type {any} */ (globalThis).distribution;

/**
 * @param {indexConfig} config
 */
function index(config) {
  const context = {
    gid: config.gid || 'index',
    crawlGid: config.crawlGid || 'docs',
  };

  /**
   * @param {string} url
   * @param {string} content
   * @returns {Object[]}
   */
  const mapper = (url, content) => {
    const text = String(content);
    const normalizedWords = text
      .toLowerCase()
      .replace(/[^a-z]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const docLength = normalizedWords.length || 1;
    const titleSlice = normalizedWords.slice(0, Math.min(12, docLength));
    const titleTerms = new Set(titleSlice);
    const counts = Object.create(null);

    normalizedWords.forEach((word) => {
      counts[word] = (counts[word] || 0) + 1;
    });

    return Object.entries(counts).map(([term, tf]) => ({
      [term]: {
        url,
        tf,
        docLength,
        normalizedTf: tf / docLength,
        titleBoost: titleTerms.has(term) ? 1.25 : 1,
      },
    }));
  };

  /**
   * @param {string} term
   * @param {Posting[]} postings
   * @returns {Object}
   */
  const reducer = (term, postings) => {
    const df = postings.length || 1;
    const idf = Math.log(1 + 1 / df);

    const rankedPostings = postings.map((posting) => {
      const docLength = posting.docLength || 1;
      const normalizedTf = posting.normalizedTf || (posting.tf / docLength);
      const titleBoost = posting.titleBoost || 1;

      const score = normalizedTf * titleBoost * idf;
      return { ...posting, df, idf, score };
    }).sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;

      if (scoreB !== scoreA)
        return scoreB - scoreA;

      if (b.tf !== a.tf)
        return b.tf - a.tf;

      return a.url.localeCompare(b.url);
    });
    return { [term]: rankedPostings };
  };


  /**
   * @param {Callback} callback
   */
  function exec(callback) {
    const gid = context.gid;
    const crawlGid = context.crawlGid;

    distribution[crawlGid].store.get(null, (e, urls) => {
      if (e instanceof Error || (e && Object.keys(e).length > 0)) {
        return callback(e, null);
      }

      distribution[gid].mr.exec(
        {
          keys: urls,
          input: crawlGid,
          output: gid,
          map: mapper,
          reduce: reducer,
        },
        (e, v) => {
          if (e instanceof Error || (e && Object.keys(e).length > 0)) {
            return callback(e, null);
          }
          return callback(null, v);
        }
      );
    });
  }

  return { exec };
}

module.exports = index;
