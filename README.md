# HAC

HAC stands for Hierarchical Agglomerative Clustering, a commeon technique for unsupervised document clustering.


> **NOTICE**:
> HAC requires unpublished modules on github,
> it will just work fine with `npm install`,
> but will fail on *Tonic* (the *Try it out* on npm website),
> since it requires all modules published on npm.
> Future works will try to publish these required modules on npm.

# Installation

```bash
npm install hac --save
```

# Usage

## Instantiate

```javascript
var HAC = require("hac");
var hac = new HAC();
```

## Add documents

```javascript
hac.addDocument(doc, id, class);
```

Arguments:

* doc `String`: the document to be added, could be string of text or array of terms
* id `String/int` (optional): the id of the docuemnt. If ignored, a uuid would generated automatically
* class `String/int` (optional): the class(or label) of this document. You probably won't need this,
 but if specified, you could use `getMeasure()` to get F measure or Randon Index to see clustering performance.

## Clustering

```javascript
hac.cluster(clusterMethod);
```

Arguments:

* clusterMethod `Class Method`: the clustering algorithm to be used. Available options are as following:
    + `HAC.GA`: Group-average Agglomerative clustering
    + `HAC.SingleLink`: single link clustering
    + `HAC.CompleteLink`: complete link clustering
    + `HAC.Centroid`: centroid clustering. *To Be Implemented*

## Get clustering result

```javascript
var clusters = hac.getClusters(k, fields);
```

Arguments:

* k `int`: the number of clusters
* fields `Array`: array of fields of a document that you want in the final clustering result. Available fields are as following:
    + "id": the id of the document
    + "class": the class(label) of the document, if specified when calling `addDocument()`
    + "content": string of document content
    + "terms": document content represented as array of terms
    + "tfs": array of term frequencies for this document
    + "vector": vector representation of this document


Alternatively, you could use following method to get clusters with cluster labeling:
```javascript
var clusters = hac.getClustersWithLabels(k, fields, featureCount, featureMethod);
```


The cluster labeling algorithm uses feature selection, which is a module called [FeatureSelector](https://github.com/roackb2/feature-selector).


Arguments:

* k `int`: number of clusters.
* fields `Array`: array of fields. see above description of `getClusters()`
* featureCount `int`: the number of feature terms that you want for each cluster
* featureMethod `Class Method`: the feature selection algorithm to be used. Available options are as following:;
    + `FeatureSelector.MI`: Expected Mutual Information feature selection
    + `FeatureSelectr.LLR`: Likelihood Ratio feature selection

## Get performance measurement

You could get F measure or Random index for the clustering result.

> **NOTE**: if you want to see performance measurements, you must specify the `class` argument when calling `addDocument()`.
Also, when calling `getClusters()` or `getClustersWithLabels()`, you must include the field `"class"` in the argment `fields`.

```javascript
var measure = getMeasure(clusters, method, beta, showRawScore);
```

Arguments:

* clusters `Array`: the clustering result that you get by calling `getClusters()` or `getClustersWithLabels()`
* method `Class Method`: the measuring algorithm to be used. Available options are as following:
    + `HAC.F`: F measure
    + `HAC.RI`: Random Index
* beta `int` (optional): If you use `HAC.F`, you should give `hac` a beta value, which should be integer greater than or equal to 1
* showRawScore `boolean` (optional): If set to true, print the tp, fp, fn, tn, total negative and total positive on the console

# Complete example

```javascript
var hac = new HAC();
var docs = [];
docs.push(["嗨", "你好"]);
docs.push(["嗨", "很", "高興", "認識", "你"]);
docs.push("hello, how's everything today? is everything ok today?")
docs.push("let's test one more document!");
docs.push("documents are always not large enough");

for(var i = 0; i < docs.length; i++) {
    hac.addDocument(docs[i], i);
}
hac.cluster(HAC.GA);

var clusters = hac.getClusters(2, ["id", "content"]);
_.forEach(clusters, function(cluster) {
    console.log("cluster id: " + cluster.id)
    _.forEach(cluster.docs, function(doc) {
        console.log("doc id: " + doc.id)
        console.log("doc content: " + doc.content);
    })
    console.log()
})
```

the result would be:

```
cluster id: 7
doc id: 0
doc content: 嗨,你好
doc id: 1
doc content: 嗨,很,高興,認識,你
doc id: 2
doc content: hello, how's everything today? is everything ok today?

cluster id: 6
doc id: 3
doc content: let's test one more document!
doc id: 4
doc content: documents are always not large enough
```

# Release Notes

* 1.0.7: update url of modules hosted on github to a simpler form
* 1.0.6: correct require path of the heap module
* 1.0.5: make statements in README for incompatibility with `Tonic`
* 1.0.4: require es6-shim to support older node engine
* 1.0.3: change arrow functions to anonymous functions for backward compatibility
* 1.0.2: subtle modification to README
* 1.0.1: first publishment
