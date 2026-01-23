#!/bin/bash
# This is a student test

set -e

html='<html><body><h1>Hello</h1><p>World</p></body></html>'
output=$(echo "$html" | node c/getText.js)

echo "$output" | grep -q "Hello"
echo "$output" | grep -q "World"