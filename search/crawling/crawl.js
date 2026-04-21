// @ts-check

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const {
  normalizeNpmUrl,
  trapReason,
  urlKid,
} = require('./helpers.js');

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

async function fetchPackagePage(url, opts) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; OrionSearch/1.0)',
    Accept: 'text/html,*/*',
  };
  try {
    const ac = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(opts.timeoutMs)
      : undefined;
    const res = await fetch(url, {redirect: 'follow', headers, signal: ac});
    const text = await res.text();
    const body = text.length > opts.maxBytes ? text.slice(0, opts.maxBytes) : text;
    return {ok: res.ok, body, finalUrl: res.url || url};
  } catch {
    return {ok: false, body: '', finalUrl: url};
  }
}

function lineToSeedUrl(line) {
  const t = String(line || '').trim();
  if (!t || t.startsWith('#')) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return normalizeNpmUrl(t);
  const name = t.replace(/^['"]|['"]$/g, '');
  if (!name) return null;
  return normalizeNpmUrl(`https://www.npmjs.com/package/${name}`);
}

const DEFAULT_MAX_PAGES = 200000;

function enqueueSeedsFromFile(seedFile, queue) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(seedFile)) return resolve(0);
    const input = fs.createReadStream(seedFile, {encoding: 'utf8'});
    const rl = readline.createInterface({input, crlfDelay: Infinity});
    rl.on('line', (line) => {
      const u = lineToSeedUrl(line);
      if (u) queue.push({url: u, depth: 0});
    });
    rl.on('close', () => resolve(queue.length));
    rl.on('error', reject);
  });
}

function storeList(d, gid) {
  return new Promise((res, rej) => {
    d[gid].store.get(null, (e, keys) => {
      if (e instanceof Error || (e && typeof e === 'object' && Object.keys(e).length > 0)) {
        rej(e instanceof Error ? e : new Error(JSON.stringify(e)));
      } else {
        res(Array.isArray(keys) ? keys : []);
      }
    });
  });
}

function storeGet(d, gid, key) {
  return new Promise((res, rej) => {
    d[gid].store.get(key, (e, v) => (e ? rej(e) : res(v)));
  });
}

function storePut(d, gid, val, key) {
  return new Promise((res, rej) => {
    d[gid].store.put(val, key, (e) => {
      if (e instanceof Error || (e && typeof e === 'object' && Object.keys(e).length > 0)) rej(e);
      else res();
    });
  });
}

function storeDel(d, gid, key) {
  return new Promise((res, rej) => {
    d[gid].store.del(key, (e) => {
      if (e && /** @type {any} */ (e).message !== 'key not found') rej(e);
      else res();
    });
  });
}

function getCrawlGroup(d) {
  return new Promise((res, rej) => {
    d.local.groups.get('crawl', (e, g) => {
      if (e && Object.keys(e).length) rej(e);
      else if (!g || !Object.keys(g).length) rej(new Error('Need a non-empty `crawl` group.'));
      else res(g);
    });
  });
}

function registerAuxGid(d, gid, group) {
  return new Promise((res, rej) => {
    d.local.groups.put({gid}, group, (e2) => {
      if (e2 && Object.keys(e2).length) rej(e2);
      else {
        d.crawl.groups.put({gid}, group, (e3) => {
          if (e3 && Object.keys(e3).length) rej(e3);
          else res();
        });
      }
    });
  });
}

async function mrCrawlMap(_key, value) {
  const I = globalThis.__orionCrawlMrInternals;
  if (!I) return [];

  let rec;
  try {
    rec = JSON.parse(String(value));
  } catch {
    return [];
  }

  const {url, depth, sessionId, limits, minChars, timeoutMs, maxBytes, maxDepth} = rec;
  if (!url || typeof depth !== 'number' || !sessionId) return [];

  const g = globalThis;
  if (!g.__orionMrCrawlSess) g.__orionMrCrawlSess = Object.create(null);
  if (!g.__orionMrCrawlSess[sessionId]) g.__orionMrCrawlSess[sessionId] = new Set();
  const localSeen = g.__orionMrCrawlSess[sessionId];
  if (localSeen.has(url)) return [];
  localSeen.add(url);

  const lim = limits || {maxDepth: 4, maxQueryKeys: 4};
  if (I.trapReason(url, lim, depth)) return [];

  const res = await I.fetchPackagePage(url, {
    timeoutMs: Number(timeoutMs) || 30000,
    maxBytes: Number(maxBytes) || 600000,
  });
  if (!res.ok || !res.body) return [];

  const text = I.htmlToText(res.body);
  if (text.length < (Number(minChars) || 0)) return [];

  const finalUrl = I.normalizeNpmUrl(res.finalUrl);
  const docKid = I.urlKid(finalUrl);
  const docPayload = JSON.stringify({url: finalUrl, text});
  /** @type {object[]} */
  const out = [{[docKid]: JSON.stringify({role: 'doc', payload: docPayload})}];

  const dlim = Number.isFinite(maxDepth) ? maxDepth : lim.maxDepth;
  if (depth >= dlim) return out;

  const seenLink = new Set();
  for (const link of I.extractPackageLinks(res.body)) {
    if (seenLink.has(link)) continue;
    seenLink.add(link);
    if (I.trapReason(link, lim, depth + 1)) continue;
    out.push({
      [`fr${I.urlKid(link)}`]: JSON.stringify({role: 'front', url: link, depth: depth + 1}),
    });
  }
  return out;
}

function mrCrawlReduce(key, values) {
  if (!Array.isArray(values) || values.length === 0) return {void: '1'};

  if (key.startsWith('fr')) {
    let best = null;
    for (const raw of values) {
      let o;
      try {
        o = JSON.parse(String(raw));
      } catch {
        continue;
      }
      if (!o || o.role !== 'front' || !o.url) continue;
      if (!best || o.depth < best.depth) best = {url: o.url, depth: o.depth};
    }
    if (!best) return {void: '1'};
    return {[`zf${key.slice(2)}`]: JSON.stringify({url: best.url, depth: best.depth})};
  }

  let docStr = null;
  for (const raw of values) {
    let o;
    try {
      o = JSON.parse(String(raw));
    } catch {
      continue;
    }
    if (o && o.role === 'doc' && typeof o.payload === 'string') {
      docStr = o.payload;
      break;
    }
  }
  if (!docStr) return {void: '1'};
  return {[key]: docStr};
}

async function drainMrOut(d, mrOutGid, docGid, frontier, seen, limits) {
  let n = 0;
  for (const k of await storeList(d, mrOutGid)) {
    if (k === 'void') {
      await storeDel(d, mrOutGid, k).catch(() => {});
      continue;
    }
    const v = await storeGet(d, mrOutGid, k);
    await storeDel(d, mrOutGid, k);
    if (k.startsWith('zf')) {
      try {
        const f = JSON.parse(String(v));
        if (f.url && !seen.has(f.url) && !trapReason(f.url, limits, f.depth)) {
          frontier.push({url: f.url, depth: f.depth});
        }
      } catch {
      }
    } else {
      await storePut(d, docGid, v, k);
      n++;
    }
  }
  return n;
}

function crawl(config) {
  const context = {
    outputGid: config.outputGid || config.gid || 'docs',
    seedFile: config.seedFile || path.join(__dirname, '..', 'seeds', 'packages.txt'),
    maxPages: Number.isFinite(config.maxPages) ? Number(config.maxPages) : DEFAULT_MAX_PAGES,
    maxDepth: Number.isFinite(config.maxDepth) ? Number(config.maxDepth) : 4,
    maxQueryKeys: Number.isFinite(config.maxQueryKeys) ? Number(config.maxQueryKeys) : 4,
    minChars: Number.isFinite(config.minChars) ? Number(config.minChars) : 120,
    timeoutMs: Number.isFinite(config.timeoutMs) ? Number(config.timeoutMs) : 30000,
    maxBytes: Number.isFinite(config.maxBytes) ? Number(config.maxBytes) : 600000,
  };

  const limits = {maxDepth: context.maxDepth, maxQueryKeys: context.maxQueryKeys};

  function exec(callback) {
    const d = /** @type {any} */ (globalThis.distribution);
    /** @type {{url: string, depth: number}[]} */
    const frontier = [];
    const seen = new Set();
    let fetchedDocs = 0;

    (async () => {
      let crawlGroup;
      try {
        crawlGroup = await getCrawlGroup(d);
      } catch (err) {
        return callback(err instanceof Error ? err : new Error(String(err)), null);
      }

      const nSeeds = await enqueueSeedsFromFile(context.seedFile, frontier);
      if (nSeeds === 0) {
        return callback(null, {implemented: true, outputGid: context.outputGid, fetchedDocs: 0});
      }
      if (!globalThis.__orionCrawlMrInternals) {
        return callback(new Error('Call crawl.registerOnDistribution() from bootstrap.'), null);
      }

      const base = String(context.outputGid).replace(/[^a-zA-Z0-9]/g, '');
      const frIn = `${base}FrIn`;
      const mrOut = `${base}MrOut`;
      await registerAuxGid(d, frIn, crawlGroup);
      await registerAuxGid(d, mrOut, crawlGroup);
      for (const gid of [frIn, mrOut]) {
        for (const k of await storeList(d, gid)) await storeDel(d, gid, k);
      }

      const sessionId = crypto.randomBytes(12).toString('hex');

      while (fetchedDocs < context.maxPages) {
        const cap = context.maxPages - fetchedDocs;
        /** @type {{url: string, depth: number}[]} */
        const wave = [];
        while (wave.length < cap && frontier.length > 0) {
          const next = frontier.shift();
          if (!next) break;
          if (seen.has(next.url)) continue;
          if (trapReason(next.url, limits, next.depth)) {
            seen.add(next.url);
            continue;
          }
          seen.add(next.url);
          wave.push(next);
        }
        if (wave.length === 0) {
          if (frontier.length === 0) break;
          continue;
        }

        const waveKeys = [];
        for (const t of wave) {
          const k = urlKid(t.url);
          waveKeys.push(k);
          await storePut(
            d,
            frIn,
            JSON.stringify({
              url: t.url,
              depth: t.depth,
              sessionId,
              limits,
              minChars: context.minChars,
              timeoutMs: context.timeoutMs,
              maxBytes: context.maxBytes,
              maxDepth: context.maxDepth,
            }),
            k,
          );
        }

        await new Promise((res, rej) => {
          d.crawl.mr.exec(
            {
              keys: waveKeys,
              input: frIn,
              output: mrOut,
              map: mrCrawlMap,
              reduce: mrCrawlReduce,
            },
            (e, v) => {
              if (e instanceof Error || (e && typeof e === 'object' && Object.keys(e).length > 0)) {
                rej(e instanceof Error ? e : new Error(JSON.stringify(e)));
              } else res(v);
            },
          );
        });

        for (const k of waveKeys) await storeDel(d, frIn, k).catch(() => {});

        fetchedDocs += await drainMrOut(d, mrOut, context.outputGid, frontier, seen, limits);
      }

      callback(null, {implemented: true, outputGid: context.outputGid, fetchedDocs});
    })().catch((err) => callback(err, null));
  }

  return {exec};
}

function registerOnDistribution() {
  globalThis.__orionCrawlMrInternals = {
    fetchPackagePage,
    htmlToText,
    extractPackageLinks,
    normalizeNpmUrl,
    trapReason,
    urlKid,
  };
}

crawl.registerOnDistribution = registerOnDistribution;

module.exports = crawl;
