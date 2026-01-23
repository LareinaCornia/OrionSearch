#!/bin/bash
# This is a student test

set -e

input="hello world
hello world
hello there"

output=$(echo "$input" | ./c/invert.sh https://example.com)

echo "$output" | grep -q "hello world | 2 | https://example.com"
echo "$output" | grep -q "hello there | 1 | https://example.com"