// @ts-check
/**
 * @typedef {import("../../distribution/types.js").Callback} Callback
 */

const fs = require('node:fs');
const path = require('node:path');
const {normalizeNpmUrl} = require('../../npm-crawl/lib/npm-html.js');
const {trapReason} = require('../../npm-crawl/lib/traps.js');
const {urlKid} = require('../../npm-crawl/lib/keys.js');
const {
  encodePkgPath,
  packageNameFromNpmUrl,
  syntheticHtmlFromLatest,
} = require('../../npm-crawl/lib/registry.js');

/**
 * @returns {any}
 */
function getDistribution() {
  return /** @type {any} */ (globalThis).distribution;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
function extractPackageLinks(html) {
  const out = [];
  const seen = new Set();
  const re = /href="([^"]*\/package\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      let href = m[1].replace(/&amp;/g, '&');
      if (href.startsWith('/')) href = new URL(href, 'https://www.npmjs.com').href;
      const u = normalizeNpmUrl(href);
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    } catch {
    }
  }
  return out;
}

/**
 * @param {string} html
 * @returns {string}
 */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} url
 * @param {{ timeoutMs: number, maxBytes: number }} opts
 * @returns {Promise<{ ok: boolean, status: number, body: string, finalUrl: string, via: string }>}
 */
async function fetchPackagePage(url, opts) {
  const browserish = {
    'User-Agent': 'Mozilla/5.0 (compatible; OrionSearch/1.0; +https://github.com/)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const ac = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(opts.timeoutMs)
      : undefined;
    const res = await fetch(url, {redirect: 'follow', headers: browserish, signal: ac});
    let text = await res.text();
    if (!res.ok || res.status === 403) {
      const pkg = packageNameFromNpmUrl(url);
      if (pkg) {
        const regUrl = `https://registry.npmjs.org/${encodePkgPath(pkg)}/latest`;
        const res2 = await fetch(regUrl, {
          headers: {'User-Agent': browserish['User-Agent'], Accept: 'application/json'},
          signal: ac,
        });
        const jt = await res2.text();
        if (res2.ok) {
          const manifest = JSON.parse(jt);
          text = syntheticHtmlFromLatest(pkg, manifest);
          return {ok: true, status: res2.status, body: text.slice(0, opts.maxBytes), finalUrl: url, via: 'registry'};
        }
      }
    }
    const clipped = text.length > opts.maxBytes ? text.slice(0, opts.maxBytes) : text;
    return {ok: res.ok, status: res.status, body: clipped, finalUrl: res.url || url, via: 'www'};
  } catch {
    return {ok: false, status: 0, body: '', finalUrl: url, via: 'www'};
  }
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function lineToSeedUrl(line) {
  const t = String(line || '').trim();
  if (!t || t.startsWith('#')) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return normalizeNpmUrl(t);
  const name = t.replace(/^['"]|['"]$/g, '');
  if (!name) return null;
  return normalizeNpmUrl(`https://www.npmjs.com/package/${name}`);
}

/**
 * @param {string} seedFile
 * @returns {string[]}
 */
function readSeedUrls(seedFile) {
  if (!fs.existsSync(seedFile)) return [];
  const raw = fs.readFileSync(seedFile, 'utf8');
  return raw.split(/\n/).map(lineToSeedUrl).filter((u) => typeof u === 'string');
}

/**
 * @param {Callback} callback
 * @param {any} value
 */
function done(callback, value) {
  callback(null, value);
}

function crawl(config) {
  const context = {
    outputGid: config.outputGid || config.gid || 'docs',
    seedFile: config.seedFile || path.join(__dirname, '..', 'seeds', 'packages.txt'),
    maxPages: Number.isFinite(config.maxPages) ? Number(config.maxPages) : 300,
    maxDepth: Number.isFinite(config.maxDepth) ? Number(config.maxDepth) : 4,
    maxQueryKeys: Number.isFinite(config.maxQueryKeys) ? Number(config.maxQueryKeys) : 4,
    minChars: Number.isFinite(config.minChars) ? Number(config.minChars) : 120,
    timeoutMs: Number.isFinite(config.timeoutMs) ? Number(config.timeoutMs) : 30000,
    maxBytes: Number.isFinite(config.maxBytes) ? Number(config.maxBytes) : 600000,
  };

  /**
   * @param {string} key
   * @param {string} payload
   * @returns {Promise<void>}
   */
  function putDoc(key, payload) {
    return new Promise((resolve, reject) => {
      const distribution = getDistribution();
      if (!distribution || !distribution[context.outputGid] || !distribution[context.outputGid].store) {
        return reject(new Error(`Missing distribution group: ${context.outputGid}`));
      }
      distribution[context.outputGid].store.put(payload, key, (err) => {
        if (err && (!(typeof err === 'object') || Object.keys(err).length > 0)) return reject(err);
        resolve();
      });
    });
  }

  /**
   * @param {Callback} callback
   */
  function exec(callback) {
    const seeds = readSeedUrls(context.seedFile);
    if (seeds.length === 0) {
      return done(callback, {
        implemented: true,
        outputGid: context.outputGid,
        fetchedDocs: 0,
        queuedSeeds: 0,
        discoveredLinks: 0,
      });
    }

    const limits = {maxDepth: context.maxDepth, maxQueryKeys: context.maxQueryKeys};
    const queue = seeds.map((url) => ({url, depth: 0}));
    const seen = new Set();
    let fetchedDocs = 0;
    let discoveredLinks = 0;

    (async () => {
      while (queue.length > 0 && fetchedDocs < context.maxPages) {
        const next = queue.shift();
        if (!next) break;
        if (seen.has(next.url)) continue;
        seen.add(next.url);
        if (trapReason(next.url, limits, next.depth)) continue;

        const res = await fetchPackagePage(next.url, {timeoutMs: context.timeoutMs, maxBytes: context.maxBytes});
        if (!res.ok || !res.body) continue;
        const text = htmlToText(res.body);
        if (text.length < context.minChars) continue;

        const normalizedFinalUrl = normalizeNpmUrl(res.finalUrl);
        const key = urlKid(normalizedFinalUrl);
        const payload = JSON.stringify({url: normalizedFinalUrl, text});
        await putDoc(key, payload);
        fetchedDocs += 1;

        if (next.depth >= context.maxDepth) continue;
        const links = extractPackageLinks(res.body);
        discoveredLinks += links.length;
        for (const link of links) {
          if (!seen.has(link)) queue.push({url: link, depth: next.depth + 1});
        }
      }

      done(callback, {
        implemented: true,
        outputGid: context.outputGid,
        fetchedDocs,
        queuedSeeds: seeds.length,
        discoveredLinks,
      });
    })().catch((err) => callback(err, null));
  }

  return {exec};
}

module.exports = crawl;
