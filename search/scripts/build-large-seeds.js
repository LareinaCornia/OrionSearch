#!/usr/bin/env node
/* eslint-disable no-restricted-syntax, no-restricted-globals */
// @ts-check
/** Fetches unique package names via registry.npmjs.org/-/v1/search for crawl seeds. */
const fs = require('node:fs');
const path = require('node:path');
const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');

/** Single-char + short terms so search pages overlap less and coverage grows faster. */
const DEFAULT_QUERIES = (() => {
  const letters = Array.from({length: 26}, (_, i) => String.fromCharCode(97 + i));
  const digits = Array.from({length: 10}, (_, i) => String(i));
  const topics =
    'ai,io,ui,db,ml,3d,xr,go,js,ts,py,rb,rs,cli,gui,api,sdk,orm,sql,nosql,css,svg,wasm,' +
    'react,vue,svelte,ember,gulp,vite,jest,mocha,deno,node,http,tcp,udp,grpc,mqtt,csv,pdf,' +
    'xml,yaml,auth,jwt,oauth,cors,csrf,xss,lint,fmt,git,ci';
  return letters.concat(digits, topics.split(','));
})();

/**
 * @param {string} u
 * @returns {Promise<any>}
 */
async function getJson(u) {
  const res = await fetch(u, {headers: {'User-Agent': 'OrionSearch-build-large-seeds/1.0'}});
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('out', {
      type: 'string',
      default: path.join(__dirname, '..', 'seeds', 'packages-large.txt'),
      describe: 'Output file (one package name per line)',
    })
    .option('target', {
      type: 'number',
      default: 120000,
      describe: 'Stop after collecting this many unique names (approx)',
    })
    .option('sleepMs', {
      type: 'number',
      default: 120,
      describe: 'Pause between API calls to be polite to registry',
    })
    .option('queries', {
      type: 'string',
      describe: 'Optional path to JSON array of search strings (overrides built-in list)',
    })
    .strict()
    .help()
    .parse();

  const seen = new Set();
  if (fs.existsSync(argv.out)) {
    for (const line of fs.readFileSync(argv.out, 'utf8').split('\n')) {
      const t = line.trim();
      if (t && !t.startsWith('#')) seen.add(t.toLowerCase());
    }
  }

  /** @type {string[]} */
  let queries = DEFAULT_QUERIES;
  if (argv.queries) {
    const raw = fs.readFileSync(argv.queries, 'utf8');
    queries = JSON.parse(raw);
    if (!Array.isArray(queries) || queries.some((q) => typeof q !== 'string')) {
      throw new Error('--queries file must be a JSON array of strings');
    }
  }

  let added = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  outer:
  for (const text of queries) {
    if (seen.size >= argv.target) break outer;
    for (let page = 0; ; page++) {
      if (seen.size >= argv.target) break outer;
      const from = page * 250;
      const u =
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}` +
        `&size=250&from=${from}`;
      let j;
      try {
        j = await getJson(u);
      } catch (e) {
        console.error(`Search failed text=${JSON.stringify(text)} page=${page}:`, e && e.message);
        await sleep(argv.sleepMs * 3);
        continue;
      }
      const objects = (j && j.objects) || [];
      for (const row of objects) {
        const name = row.package && row.package.name;
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        fs.appendFileSync(argv.out, `${name}\n`);
        added++;
        if (seen.size >= argv.target) break outer;
      }
      if (objects.length < 250) break;
      await sleep(argv.sleepMs);
    }
    await sleep(argv.sleepMs);
  }

  console.error(`Wrote ${added} new names; unique total in file ~${seen.size} -> ${argv.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
