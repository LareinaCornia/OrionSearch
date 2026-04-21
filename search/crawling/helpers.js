// @ts-check
const crypto = require('node:crypto');

/**
 * Normalize URL 
 * @param {string} url
 * @returns {string}
 */
function normalizeNpmUrl(url) {
  const u = new URL(url);
  u.hash = '';
  u.protocol = 'https:';
  if (u.hostname === 'npmjs.com') u.hostname = 'www.npmjs.com';
  u.pathname = u.pathname.replace(/\/$/, '') || '/';
  return u.href;
}

/**
 * @param {string} normalizedUrl
 * @returns {string}
 */
function urlKid(normalizedUrl) {
  return crypto.createHash('sha256').update(JSON.stringify(normalizedUrl)).digest('hex');
}

/**
 * Return rejection reason if URL should not be crawled.
 * @param {string} url
 * @param {{ maxDepth: number, maxQueryKeys: number }} limits
 * @param {number} depth
 * @returns {string | null}
 */
function trapReason(url, limits, depth) {
  if (depth > limits.maxDepth) return 'depth';

  let u;
  try {
    u = new URL(url);
  } catch {
    return 'parse';
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'protocol';
  if (u.hostname !== 'www.npmjs.com' && u.hostname !== 'npmjs.com') return 'host';

  if ((u.search || '').length > 1) {
    const keys = [...new URLSearchParams(u.search).keys()];
    if (keys.length > limits.maxQueryKeys) return 'query';
  }

  const path = u.pathname;
  if (path.includes('..')) return 'path';
  if (path.length > 512) return 'pathlen';
  if (!/^\/package\//.test(path)) return 'notpackage';

  return null;
}

module.exports = {
  normalizeNpmUrl,
  trapReason,
  urlKid,
};
