#!/usr/bin/env node
const fs = require('fs');

const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) process.exit(0);

/*
输入格式（来自 local-index 或 merge 前的中间产物）：
term | count | url
*/

const docLen = Object.create(null);

for (const line of input.split('\n')) {
  const parts = line.split('|');
  if (parts.length < 3) continue;

  const count = Number(parts[1]);
  const url = parts[2];

  docLen[url] = (docLen[url] || 0) + count;
}

fs.writeFileSync(
    'd/doc-lengths.json',
    JSON.stringify(docLen, null, 2),
);
