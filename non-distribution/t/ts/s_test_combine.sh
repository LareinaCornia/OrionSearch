#!/bin/bash
# This is a student test

set -e

echo "<html><body>Hello world</body></html>" \
| node c/getText.js \
| ./c/process.sh \
| node c/stem.js \
| grep -q "hello"