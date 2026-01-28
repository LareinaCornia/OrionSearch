#!/usr/bin/env node
const fs = require('fs');

const url = process.argv[2];
const raw = fs.readFileSync(0, 'utf-8').trim();
if (!raw) process.exit(0);

const index = new Map();
let docLength = 0;

function add(term) {
  if (!term) return;
  index.set(term, (index.get(term) || 0) + 1);
  docLength++;
}

for (const line of raw.split(/\r?\n/)) {
  const s = line.trim();
  if (!s) continue;

  const term = s.replace(/\s+/g, ' ');
  add(term);
}

const out = [];
for (const [term, count] of index.entries()) {
  out.push(`${term}|${count}|${url}`);
}

out.sort();
process.stdout.write(out.join('\n') + '\n');
