#!/bin/bash
# This is a student test

set -e

html='<a href="page.html">Link</a>'
output=$(echo "$html" | node c/getURLs.js https://example.com/index.html)

test "$output" = "https://example.com/page.html"