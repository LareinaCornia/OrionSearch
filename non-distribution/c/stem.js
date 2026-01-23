#!/usr/bin/env node

/*
Convert each term to its stem
Usage: input > ./stem.js > output
*/

const readline = require('readline');
const natural = require('natural');

const stemmer = natural.PorterStemmer;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', function(line) {
  // Print the Porter stem from `natural` for each element of the stream.
  const stems = line
      .trim()
      .split(/\s+/)
      .map((word) => stemmer.stem(word));
  console.log(stems.join(' '));
});
