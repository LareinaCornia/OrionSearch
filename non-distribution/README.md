# M0: Setup & Centralized Computing

* name: `Jiayu Liu`
* email: `jiayu_liu@brown.edu`
* cslogin: `jliu620`

## Summary

My implementation consists of 5 components addressing T1–T8, including centralized crawling and indexing, query processing, automated testing, and EC2 deployment. The most challenging aspect was debugging the testing logic because it required carefully interpreting the inverted index format.

## Correctness & Performance Characterization

To characterize correctness, I developed 9 tests that test the following cases: getText, getURL, combine, invert, merge, process, stem, query.

*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

## Wild Guess

I think it will take 60000 lines of code to build the fully distributed, scalable version of your search engine.
