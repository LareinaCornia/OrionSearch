#!/usr/bin/env node

const fs = require('fs');

const words = fs.readFileSync(0, 'utf-8')
    .trim()
    .split(/\s+/);

const output = [];

// unigrams
for (let i = 0; i < words.length; i++) {
  output.push(words[i]);
}

// bigrams
for (let i = 0; i < words.length - 1; i++) {
  output.push(`${words[i]} ${words[i+1]}`);
}

// trigrams
for (let i = 0; i < words.length - 2; i++) {
  output.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
}

console.log(output.join('\n'));
