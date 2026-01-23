#!/bin/bash
# This is a student test

set -e

output=$(echo "running" | node c/stem.js)

test "$output" = "run"