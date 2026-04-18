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

/**
 * Encode package name
 * @param {string} name
 * @returns {string}
 */
function encodePkgPath(name) {
  if (name.startsWith('@')) {
    const i = name.indexOf('/');
    if (i === -1) return encodeURIComponent(name);
    const scope = name.slice(1, i);
    const rest = name.slice(i + 1);
    return `@${encodeURIComponent(scope)}%2F${encodeURIComponent(rest)}`;
  }
  return encodeURIComponent(name);
}

/**
 * @param {string} npmPackageUrl
 * @returns {string | null}
 */
function packageNameFromNpmUrl(npmPackageUrl) {
  try {
    const u = new URL(npmPackageUrl);
    const m = u.pathname.match(/^\/package\/((?:@[^/]+\/)?[^/]+)/);
    return m ? decodeURIComponent(m[1].replace(/%2F/gi, '/')) : null;
  } catch {
    return null;
  }
}

/**
 * Build minimal HTML
 * @param {string} pkgName
 * @param {object} manifest
 * @returns {string}
 */
function syntheticHtmlFromLatest(pkgName, manifest) {
  const deps = Object.keys((manifest.dependencies) || {});
  const devDeps = Object.keys((manifest.devDependencies) || {});
  const links = [...new Set([...deps, ...devDeps])]
    .filter((n) => n && typeof n === 'string')
    .slice(0, 200)
    .map((n) => `<a href="https://www.npmjs.com/package/${n.replace(/"/g, '')}">${n}</a>`)
    .join('\n');
  const desc = (manifest.description || '').replace(/</g, ' ');
  return (
    `<!doctype html><html><head><title>${pkgName}</title></head><body>` +
    `<meta name="description" content="${desc.replace(/"/g, '')}">` +
    `<div id="deps">${links}</div></body></html>`
  );
}

module.exports = {
  normalizeNpmUrl,
  trapReason,
  urlKid,
  encodePkgPath,
  packageNameFromNpmUrl,
  syntheticHtmlFromLatest,
};
