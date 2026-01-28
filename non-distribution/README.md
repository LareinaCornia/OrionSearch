# M0: Setup & Centralized Computing

* name: `Jiayu Liu`
* email: `jiayu_liu@brown.edu`
* cslogin: `jliu620`

## Summary

My implementation consists of multiple components addressing T1–T8, including centralized crawling and indexing, query processing, automated testing, and EC2 deployment. The most challenging aspect was debugging the testing logic because it required carefully interpreting the inverted index format and correctly handling n-gram terms and posting lists.

## Correctness & Performance Characterization

To characterize correctness, we developed automated unit and integration tests, including the provided synthetic TF-IDF tests, which validate correct indexing, TF-IDF scoring, and document ranking for representative queries.

*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

## Wild Guess

I think it will take 60000 lines of code to build the fully distributed, scalable version of your search engine.
