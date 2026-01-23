#!/bin/bash
# This is a student test

set -e

# Prepare global index
mkdir -p d
echo "hello | url1 2" > d/global-index.txt

output=$(node c/query.js hello)

echo "$output" | grep -q "hello |"