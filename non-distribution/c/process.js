#!/usr/bin/env node
const fs = require('fs');

const stopwords = new Set(
    fs.readFileSync('d/stopwords.txt', 'utf-8')
        .split(/\r?\n/)
        .map((w) => w.trim())
        .filter(Boolean),
);

const input = fs.readFileSync(0, 'utf-8');

let tokens = input
    .replace(/[^A-Za-z]+/g, ' ')
    .trim()
    .split(/\s+/);

tokens = tokens.map((t) => t.toLowerCase());

tokens = tokens.map((t) =>
  t.normalize('NFKD').replace(/[^\x00-\x7F]/g, ''),
);

tokens = tokens.filter((t) =>
  t.length > 0 && !stopwords.has(t),
);

for (const t of tokens) {
  console.log(t);
}
