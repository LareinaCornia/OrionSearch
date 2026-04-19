const crawl = require('./crawling/crawl.js');

const crawler = crawl({
  seedFile: './seeds/packages.txt',
  maxPages: 200
});

crawler.exec((err, res) => {
  if (err) throw err;
  console.log("Crawl done:", res);
});