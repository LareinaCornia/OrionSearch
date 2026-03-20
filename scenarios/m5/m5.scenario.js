require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const ncdcGroup = {};
const dlibGroup = {};
const tfidfGroup = {};
const crawlGroup = {};
const urlxtrGroup = {};
const strmatchGroup = {};
const ridxGroup = {};
const rlgGroup = {};


/*
    The local node will be the orchestrator.
*/

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

test('(0 pts) (scenario) all.mr:ncdc', (done) => {
/* Implement the map and reduce functions.
   The map function should parse the string value and return an object with the year as the key and the temperature as the value.
   The reduce function should return the maximum temperature for each year.

   (The implementation for this scenario is provided below.)
*/

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = {};
    out[words[1]] = parseInt(words[3]);
    return out;
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return out;
  };

  const dataset = [
    {'000': '006701199099999 1950 0515070049999999N9 +0000 1+9999'},
    {'106': '004301199099999 1950 0515120049999999N9 +0022 1+9999'},
    {'212': '004301199099999 1950 0515180049999999N9 -0011 1+9999'},
    {'318': '004301265099999 1949 0324120040500001N9 +0111 1+9999'},
    {'424': '004301265099999 1949 0324180040500001N9 +0078 1+9999'},
  ];

  const expected = [{'1950': 22}, {'1949': 111}];

  const doMapReduce = () => {
    distribution.ncdc.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }


      distribution.ncdc.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ncdc.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:dlib', (done) => {
/*
   Implement the map and reduce functions.
   The map function should parse the string value and return an object with the word as the key and the value as 1.
   The reduce function should return the count of each word.
*/

  const mapper = (key, value) => {
    const words = value.split(/\s+/).filter((w) => w.length > 0);
    return words.map((w) => ({[w]: 1}));
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => a + b, 0);
    return out;
  };

  const dataset = [
    {'b1-l1': 'It was the best of times, it was the worst of times,'},
    {'b1-l2': 'it was the age of wisdom, it was the age of foolishness,'},
    {'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,'},
    {'b1-l4': 'it was the season of Light, it was the season of Darkness,'},
    {'b1-l5': 'it was the spring of hope, it was the winter of despair,'},
  ];

  const expected = [
    {It: 1}, {was: 10},
    {the: 10}, {best: 1},
    {of: 10}, {'times,': 2},
    {it: 9}, {worst: 1},
    {age: 2}, {'wisdom,': 1},
    {'foolishness,': 1}, {epoch: 2},
    {'belief,': 1}, {'incredulity,': 1},
    {season: 2}, {'Light,': 1},
    {'Darkness,': 1}, {spring: 1},
    {'hope,': 1}, {winter: 1},
    {'despair,': 1},
  ];

  const doMapReduce = () => {
    distribution.dlib.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.dlib.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.dlib.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:tfidf', (done) => {
/*
    Implement the map and reduce functions.
    The map function should parse the string value and return an object with the word as the key and the document and count as the value.
    The reduce function should return the TF-IDF for each word.

    Hint:
    TF = (Number of times the term appears in a document) / (Total number of terms in the document)
    IDF = log10(Total number of documents / Number of documents with the term in it)
    TF-IDF = TF * IDF
*/

  const mapper = (key, value) => {
    const words = value.split(/\s+/).filter((w) => w.length > 0);
    const counts = {};
    words.forEach((w) => counts[w] = (counts[w] || 0) + 1);
    return Object.keys(counts).map((w) => ({[w]: {doc: key, count: counts[w], total: words.length}}));
  };

  // Reduce function: calculate TF-IDF for each word
  const reducer = (key, values) => {
    const totalDocs = 3;
    const df = values.length;
    const idf = Math.log10(totalDocs / df);
    const out = {};
    out[key] = {};
    values.forEach((v) => {
      const tf = v.count / v.total;
      out[key][v.doc] = parseFloat((tf * idf).toFixed(2));
    });
    return out;
  };

  const dataset = [
    {'doc1': 'machine learning is amazing'},
    {'doc2': 'deep learning powers amazing systems'},
    {'doc3': 'machine learning and deep learning are related'},
  ];

  const expected = [{'is': {'doc1': 0.12}},
    {'deep': {'doc2': 0.04, 'doc3': 0.03}},
    {'systems': {'doc2': 0.1}},
    {'learning': {'doc1': 0, 'doc2': 0, 'doc3': 0}},
    {'amazing': {'doc1': 0.04, 'doc2': 0.04}},
    {'machine': {'doc1': 0.04, 'doc3': 0.03}},
    {'are': {'doc3': 0.07}}, {'powers': {'doc2': 0.1}},
    {'and': {'doc3': 0.07}}, {'related': {'doc3': 0.07}}];

  const doMapReduce = () => {
    distribution.tfidf.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.tfidf.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.tfidf.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

/*
  The rest of the scenarios are left as an exercise.
  For each one you'd like to implement, you'll need to:
  - Define the map and reduce functions.
  - Create a dataset.
  - Run the map reduce.
*/

test('(10 pts) (scenario) all.mr:crawl', (done) => {
  const mapper = (key, value) => [{[value]: 1}];
  const reducer = (key, values) => ({[key]: values.length});
  const dataset = [{'p1': 'webA'}, {'p2': 'webB'}, {'p3': 'webA'}];
  const expected = [{'webA': 2}, {'webB': 1}];
  
  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.crawl.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) {
        distribution.crawl.mr.exec({keys: dataset.map(d => Object.keys(d)[0]), map: mapper, reduce: reducer}, (e, v) => {
          try { expect(v).toEqual(expect.arrayContaining(expected)); done(); } catch (e) { done(e); }
        });
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:urlxtr', (done) => {
  const mapper = (key, value) => {
    const urls = value.match(/https?:\/\/[^\s]+/g) || [];
    return urls.map(u => ({[u]: 1}));
  };
  const reducer = (key, values) => ({[key]: values.length});
  const dataset = [{'d1': 'link to http://a.com'}, {'d2': 'http://a.com and http://b.com'}];
  const expected = [{'http://a.com': 2}, {'http://b.com': 1}];

  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.urlxtr.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) {
        distribution.urlxtr.mr.exec({keys: dataset.map(d => Object.keys(d)[0]), map: mapper, reduce: reducer}, (e, v) => {
          try { expect(v).toEqual(expect.arrayContaining(expected)); done(); } catch (e) { done(e); }
        });
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:strmatch', (done) => {
  const mapper = (key, value) => value.includes('target') ? [{[key]: true}] : [];
  const reducer = (key, values) => ({[key]: values[0]});
  const dataset = [{'d1': 'no match'}, {'d2': 'this is target'}];
  const expected = [{'d2': true}];

  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.strmatch.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) {
        distribution.strmatch.mr.exec({keys: dataset.map(d => Object.keys(d)[0]), map: mapper, reduce: reducer}, (e, v) => {
          try { expect(v).toEqual(expect.arrayContaining(expected)); done(); } catch (e) { done(e); }
        });
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:ridx', (done) => {
  const mapper = (key, value) => value.split(' ').map(w => ({[w]: key}));
  const reducer = (key, values) => ({[key]: values.sort()});
  const dataset = [{'d1': 'a b'}, {'d2': 'a c'}];
  const expected = [{'a': ['d1', 'd2']}, {'b': ['d1']}, {'c': ['d2']}];

  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.ridx.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) {
        distribution.ridx.mr.exec({keys: dataset.map(d => Object.keys(d)[0]), map: mapper, reduce: reducer}, (e, v) => {
          try { expect(v).toEqual(expect.arrayContaining(expected)); done(); } catch (e) { done(e); }
        });
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:rlg', (done) => {
  const mapper = (key, value) => {
    const parts = value.split('->');
    return [{[parts[0]]: parts[1]}];
  };
  const reducer = (key, values) => ({[key]: values.sort()});
  const dataset = [{'l1': 'A->B'}, {'l2': 'A->C'}, {'l3': 'B->D'}];
  const expected = [{'A': ['B', 'C']}, {'B': ['D']}];

  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.rlg.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) {
        distribution.rlg.mr.exec({keys: dataset.map(d => Object.keys(d)[0]), map: mapper, reduce: reducer}, (e, v) => {
          try { expect(v).toEqual(expect.arrayContaining(expected)); done(); } catch (e) { done(e); }
        });
      }
    });
  });
});

/*
    This is the setup for the test scenario.
    Do not modify the code below.
*/

beforeAll((done) => {
  ncdcGroup[id.getSID(n1)] = n1;
  ncdcGroup[id.getSID(n2)] = n2;
  ncdcGroup[id.getSID(n3)] = n3;

  dlibGroup[id.getSID(n1)] = n1;
  dlibGroup[id.getSID(n2)] = n2;
  dlibGroup[id.getSID(n3)] = n3;

  tfidfGroup[id.getSID(n1)] = n1;
  tfidfGroup[id.getSID(n2)] = n2;
  tfidfGroup[id.getSID(n3)] = n3;

  crawlGroup[id.getSID(n1)] = n1;
  crawlGroup[id.getSID(n2)] = n2;
  crawlGroup[id.getSID(n3)] = n3;

  urlxtrGroup[id.getSID(n1)] = n1;
  urlxtrGroup[id.getSID(n2)] = n2;
  urlxtrGroup[id.getSID(n3)] = n3;

  strmatchGroup[id.getSID(n1)] = n1;
  strmatchGroup[id.getSID(n2)] = n2;
  strmatchGroup[id.getSID(n3)] = n3;

  ridxGroup[id.getSID(n1)] = n1;
  ridxGroup[id.getSID(n2)] = n2;
  ridxGroup[id.getSID(n3)] = n3;

  rlgGroup[id.getSID(n1)] = n1;
  rlgGroup[id.getSID(n2)] = n2;
  rlgGroup[id.getSID(n3)] = n3;


  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          cb();
        });
      });
    });
  };

  distribution.node.start(() => {
    startNodes(() => {
      const allGroups = [
        {gid: 'ncdc', grp: ncdcGroup}, {gid: 'dlib', grp: dlibGroup},
        {gid: 'tfidf', grp: tfidfGroup}, {gid: 'crawl', grp: crawlGroup},
        {gid: 'urlxtr', grp: urlxtrGroup}, {gid: 'strmatch', grp: strmatchGroup},
        {gid: 'ridx', grp: ridxGroup}, {gid: 'rlg', grp: rlgGroup},
      ];
      let gcnt = 0;
      allGroups.forEach((g) => {
        const config = {gid: g.gid};
        distribution.local.groups.put(config, g.grp, (e, v) => {
          distribution[g.gid].groups.put(config, g.grp, (e, v) => {
            if (++gcnt === allGroups.length) done();
          });
        });
      });
    });
  });
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});

