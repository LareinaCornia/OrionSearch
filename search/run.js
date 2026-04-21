const pipeline = require('./main.js');
const distribution = require('../distribution.js')();
const path = require('node:path');

const p = pipeline({
  workers: [
    { ip: '127.0.0.1', port: 7110 },
    // { ip: '127.0.0.1', port: 7111 },
    // { ip: '127.0.0.1', port: 7112 },
  ],
  gid: 'all',
  crawlConfig: {
    maxPages: 100,
    maxDepth: 2,
    seedFile: path.join(__dirname, '.', 'seeds', 'packages-simple.txt')
  },
});

p.init((err) => {
  if (err) {
    console.error('Init failed:', err);
    process.exit(1);
  }
  console.log('Pipeline initialized');

  const group = {};
  const n1 = { ip: '127.0.0.1', port: 7110 };
  const n2 = { ip: '127.0.0.1', port: 7111 };
  const n3 = { ip: '127.0.0.1', port: 7112 };
  group[distribution.util.id.getSID(n1)] = n1;
  // group[distribution.util.id.getSID(n2)] = n2;
  // group[distribution.util.id.getSID(n3)] = n3;

  distribution.local.groups.put({ gid: 'index' }, group, () => {
    distribution.all.groups.put({ gid: 'index' }, group, () => {
      distribution.local.groups.put({ gid: 'docs' }, group, () => {
        distribution.all.groups.put({ gid: 'docs' }, group, () => {
          p.run({ queries: [] }, (err, report) => {
            if (err) {
              console.error('Pipeline failed:', err);
              return;
            }
            console.log('Crawl result:', report.crawl);
            console.log('Index result:', report.index);
            console.log('Pipeline complete');
          });
        });
      });
    });
  });
});