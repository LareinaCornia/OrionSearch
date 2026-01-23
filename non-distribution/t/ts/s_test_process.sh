#!/bin/bash
# This is a student test

set -e

output=$(echo "the and of" | ./c/process.sh)

test -z "$output"