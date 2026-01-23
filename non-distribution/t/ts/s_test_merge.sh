#!/bin/bash
# This is a student test

set -e

# Prepare a temporary global index
echo "word | url1 2" > tmp_global.txt

# Local index input
local="word | 3 | url2"

output=$(echo "$local" | node c/merge.js tmp_global.txt)

echo "$output" | grep -q "word |"
echo "$output" | grep -q "url2 3"
echo "$output" | grep -q "url1 2"

rm tmp_global.txt