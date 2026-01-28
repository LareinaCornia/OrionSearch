#!/bin/bash

set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS="$ROOT/t/tfidf/docs"
EXPECTED="$ROOT/t/tfidf/expected"

echo "TF-IDF synthetic test"

rm -f d/global-index.txt d/doc-lengths.json
: > d/urls.txt
: > d/visited.txt

# index
for f in "$DOCS"/*.txt; do
    name=$(basename "$f")
    url="t/tfidf/docs/$name"
    echo "$url" >> d/urls.txt
    ./index.sh "$f" "$url"
done

# test pizza
echo "Query: pizza (expect d1 > d2)"

./query.js pizza \
    | awk '{print $1}' \
    | sed 's|synthetic://||' \
    > /tmp/pizza.out

if diff -u "$EXPECTED/pizza.txt" /tmp/pizza.out; then
    echo "pizza TF-IDF OK"
else
    echo "pizza TF-IDF FAILED"
    exit 1
fi

# test pasta
echo "Query: pasta (expect d3 > d2)"

./query.js pasta \
    | awk '{print $1}' \
    | sed 's|synthetic://||' \
    > /tmp/pasta.out

if diff -u "$EXPECTED/pasta.txt" /tmp/pasta.out; then
    echo "pasta TF-IDF OK"
else
    echo "pasta TF-IDF FAILED"
    exit 1
fi

echo "TF-IDF synthetic test passed"
