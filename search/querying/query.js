const distribution = require('../../distribution.js')();
const http = require('http');
const fs = require('fs');
const path = require('path');
const queryService = require('../../distribution/all/query.js');

distribution.node.start(() => {
    const qs = queryService({ gid: 'query', indexGid: 'index' });

    function serveStatic(res, filename, contentType) {
        const filePath = path.join(__dirname, 'static', filename);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, {'Content-Type': contentType});
            res.end(data);
        });
    }

    function renderTemplate(filename, vars, res) {
        const filePath = path.join(__dirname, 'static', filename);
        fs.readFile(filePath, 'utf8', (err, template) => {
            let html = template;
            Object.keys(vars).forEach((key) => {
                html = html.split(`{{${key}}}`).join(vars[key]);
            });
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    }

    function getEdits(word) {
        const edits = [];
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        // deletions
        for (let i = 0; i < word.length; i++) {
            edits.push(word.slice(0, i) + word.slice(i + 1));
        }
        // swaps
        for (let i = 0; i < word.length - 1; i++) {
            edits.push(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
        }
        // replacements
        for (let i = 0; i < word.length; i++) {
            for (let j = 0; j < letters.length; j++) {
                if (letters[j] !== word[i]) {
                edits.push(word.slice(0, i) + letters[j] + word.slice(i + 1));
                }
            }
        }
        // insertions
        for (let i = 0; i <= word.length; i++) {
            for (let j = 0; j < letters.length; j++) {
                edits.push(word.slice(0, i) + letters[j] + word.slice(i));
            }
        }
        return [...new Set(edits)];
    }

    function spellCheck(term, callback) {
        distribution.all.store.get(term, (error1, docs) => {
            if (!error1 && docs && Object.keys(docs).length >= 1) {
                return callback(null, null);
            }

            const variations = getEdits(term);
            let best = null;
            let bestCount = 0;
            let checked = 0;

            variations.forEach((variation) => {
                distribution.all.store.get(variation, (error2, docs2) => {
                if (!error2 && docs2 && typeof docs2 === 'object') {
                    const count = Object.keys(docs2).length;
                    if (count > bestCount) {
                    best = variation;
                    bestCount = count;
                    }
                }
                checked++;
                if (checked === variations.length) {
                    callback(null, bestCount > 2 ? best : null);
                }
                });
            });
        });
    }

    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/style.css') {
            serveStatic(res, 'query.css', 'text/css');
            return;
        }
        if (url.pathname === '/') {
            serveStatic(res, 'index.html', 'text/html');
            return;
        }

        if (url.pathname === '/big_logo.png') {
            serveStatic(res, 'big_logo.png', 'image/png');
            return;
        }

        if (url.pathname === '/logo.png') {
            serveStatic(res, 'logo.png', 'image/png');
            return;
        }

    if (url.pathname === '/status') {
        distribution.local.groups.get('all', (e, group) => {
            const nodes = Object.values(group);
            const statuses = {};
            let checked = 0;

            nodes.forEach((node) => {
                const fields = ['heapUsed', 'nid', 'sid'];
                const fieldResults = {};
                let fieldsDone = 0;
                const start = Date.now();

                fields.forEach((field) => {
                    distribution.local.comm.send(
                        [field],
                        { service: 'status', method: 'get', node: node },
                        (err, v) => {
                            fieldResults[field] = err ? null : v;
                            fieldsDone++;
                            if (fieldsDone === fields.length) {
                                statuses[`${node.ip}:${node.port}`] = {
                                    alive: fieldResults.heapUsed !== null,
                                    latency: Date.now() - start,
                                    heapUsed: fieldResults.heapUsed,
                                    nid: fieldResults.nid,
                                    sid: fieldResults.sid,
                                };
                                checked++;
                                if (checked === nodes.length) {
                                    const rows = Object.entries(statuses).map(([addr, s]) => `
                                        <tr>
                                            <td style="padding:8px 16px">${addr}</td>
                                            <td style="padding:8px 16px;color:${s.alive ? 'green' : 'red'}">
                                                ${s.alive ? 'Online' : 'Offline'}</td>
                                            <td style="padding:8px 16px">${s.latency}ms</td>
                                            <td style="padding:8px 16px">${s.heapUsed ? (s.heapUsed / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</td>
                                            <td style="padding:8px 16px">${s.nid || 'N/A'}</td>
                                            <td style="padding:8px 16px">${s.sid || 'N/A'}</td>
                                        </tr>`).join('');

                                    renderTemplate('status.html', {
                                        ROWS: rows,
                                        COUNT: String(nodes.length),
                                    }, res);
                                }
                            }
                        }
                    );
                });
            });
        });
        return;
    }

    if (url.pathname === '/status.json') {
        distribution.local.groups.get('all', (e, group) => {
            const nodes = Object.values(group);
            const statuses = {};
            let checked = 0;

            nodes.forEach((node) => {
                const fields = ['heapUsed', 'nid', 'sid'];
                const fieldResults = {};
                let fieldsDone = 0;
                const start = Date.now();

                fields.forEach((field) => {
                    distribution.local.comm.send(
                        [field],
                        { service: 'status', method: 'get', node: node },
                        (err, v) => {
                            fieldResults[field] = err ? null : v;
                            fieldsDone++;
                            if (fieldsDone === fields.length) {
                                statuses[`${node.ip}:${node.port}`] = {
                                    alive: fieldResults.heapUsed !== null,
                                    latency: Date.now() - start,
                                    heapUsed: fieldResults.heapUsed,
                                    nid: fieldResults.nid,
                                    sid: fieldResults.sid,
                                };
                                checked++;
                                if (checked === nodes.length) {
                                    console.log(JSON.stringify(statuses, null, 2));
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    res.end(JSON.stringify(statuses, null, 2));
                                }
                            }
                        }
                    );
                });
            });
        });
        return;
    }

    if (url.pathname === '/search' && url.searchParams.get('q')) {
        const query = url.searchParams.get('q').toLowerCase().split(/\s+/);

        qs.exec(query, (e, results) => {
                // Spell check terms with no results
                let sugChecked = 0;
                const suggestions = {};
                query.forEach((term) => {
                spellCheck(term, (e, suggestion) => {
                    if (suggestion) suggestions[term] = suggestion;
                    sugChecked++;
                    if (sugChecked === query.length) {
                    const suggestedQuery = query.map(t => suggestions[t] || t).join(' ');
                    const hasSuggestion = Object.keys(suggestions).length > 0;

                    const suggestHtml = hasSuggestion
                        ? `<div style="margin-bottom:16px;font-size:14px">
                            Did you mean: 
                            <a href="/search?q=${encodeURIComponent(suggestedQuery)}" 
                            style="color:#1a0dab;font-style:italic">${suggestedQuery}</a>?
                        </div>`
                        : '';

                    const resultsHtml = results.length > 0
                        ? results.map(([id, score]) => `
                        <div class="result-item">
                            <a href="#" class="result-title">${id}</a>
                            <div class="result-url">${id}</div>
                            <div class="result-score">Relevance score: ${score.toFixed(4)}</div>
                        </div>`).join('')
                        : '<div class="no-results">No results found.</div>';

                        renderTemplate('results.html', {
                            QUERY: url.searchParams.get('q'),
                            SUGGEST: suggestHtml,
                            COUNT: String(results.length),
                            RESULTS: resultsHtml,
                        }, res);
                    }
                });
                });
            });
        } else {
            serveStatic(res, 'index.html', 'text/html');
        }
    });

    server.listen(3000, () => {
        console.log('Running on http://localhost:3000');
    });
});