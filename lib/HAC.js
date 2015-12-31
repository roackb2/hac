var uuid = require('node-uuid').v4;
var natural = require('natural');
var _ = require('lodash');
var stringify = require('stringify')
var Node = require('bin-tree').Node;
var Tree = require('bin-tree').BTree;
var Heap = require('Heap');
var FeatureSelector = require('feature-selector');

module.exports = HAC;

function HAC() {
	natural.PorterStemmer.attach();
	this.table = [];
	this.docs = [];
	this.trees = [];
	this.postings = [];
	this.clusterIndex = 0;
	this.lastAlive = -1;
	this.selector = new FeatureSelector();
}

HAC.prototype = {

	addDocument: function(content, id) {
		var doc = new Doc(id);
		if(_.isArray(content)) {
			doc.terms = content;
		} else {
			doc.terms = content.tokenizeAndStem();
		}
		doc.content = content;
		var terms = [].concat(doc.terms);
		terms.sort();
		// Don't use lodash forEach cuz array size would be modified during iteration
		for(var i = 0; i < terms.length; i++) {
			var term = terms[i];
			var tf = doc.tfs.find(x => x.term == term)

			if(!tf) {
				tf = new Tf(term);
				doc.tfs.push(tf);
			}
			tf.frequency++;

			if(i != 0 && terms[i] == terms[i - 1]) {
				terms.splice(i, 1);
				i--;
			}
		}
		this.docs.push(doc);
		_.forEach(terms, term => {
			var posting = this.postings.find(element => {
				return element.term == term;
			})
			if(!posting) {
				posting = new Posting(term);
				this.postings.push(posting);
			}
			posting.indexes.push(doc.id);
		}, this)
	},

	cluster: function(clusteringMethod, showProgress) {
		if(this.docs.length > 1000) {
			preCluster.call(this, showProgress);
		} else {
			preCluster.call(this);
		}
		if(showProgress) {
			console.log("done preCluster");
		}
		_.forEach(this.trees, (tree1, i) => {
			var cluster1 = tree1.root;
			this.table[i] = new Heap(Heap.Max, "sim", ["to"]);
			_.forEach(this.trees, (tree2, j) => {
				if(i != j) {
					var cluster2 = tree2.root;
					var grid = new Grid();
					grid.sim = cosine.call(this, cluster1.docs[0], cluster2.docs[0])
					grid.from = i;
					grid.to = j; // `to` is equal to `index` in ppt.
					this.table[i].push(grid);
				}
				if(showProgress && this.trees.length > 1000 && j % 1000 == 0) {
					console.log("done generating table [" + i + "][" + j + "]");
				}
			}, this)
			if(showProgress && i % 10 == 0) {
				console.log("done generating table for No." + i + " document");
			}
		}, this)
		if(showProgress) {
			console.log("done generating table");
		}

		var steps = this.trees.length - 1;
		_.forEach(_.range(steps), i => {
			if(showProgress && i % 10 == 0) {
				console.log((steps - i) + " steps left");
			}
			var maxSim = -1;
			var maxSimElement;

			_.forEach(this.table, (element, index) => {
				if(element != null) {
					var top = element.getTop();
					var sim = top.sim;
					if(sim > maxSim) {
						maxSim = top.sim;
						maxSimElement = top;
					}
				}
			}, this)

			var tree1Index = maxSimElement.from;
			var tree2Index = maxSimElement.to;
			var tree1 = this.trees[tree1Index];
			var tree2 = this.trees[tree2Index];

			var cluster1 = tree1.root;
			var cluster2 = tree2.root;

			var merged = new Cluster(this.clusterIndex);
			this.clusterIndex++;
			var tree = new Tree();
			tree.root = merged;
			tree.appendLeftChild(merged, tree1);
			tree.appendRightChild(merged, tree2);
			merged.docs = cluster1.docs.concat(cluster2.docs);
			// TODO: do we really need to normalize length?
			var len = 0;
			_.forEach(_.range(this.postings.length), j => {
				merged.vector[j] = cluster1.vector[j] + cluster2.vector[j];
				len += Math.pow(merged.vector[j], 2);
			}, this)
			len = Math.sqrt(len);
			merged.vector.map(element => {
				return element / len
			})
			this.trees[tree1Index] = tree;
			this.trees[tree2Index] = null;

			if(i == steps - 1) {
				this.lastAlive = this.trees[tree1Index];
			}

			tree1Heap = new Heap(Heap.Max, "sim", ["to"]);
			// console.log("tree1Index: " + tree1Index)
			// console.log("tree2Index: " + tree2Index)
			_.forEach(_.range(this.table.length), j => {
				if(showProgress && this.table.length > 1000 && j % 1000 == 0) {
					console.log((steps - i) + " steps left, dealing No." + j + " item");
				}
				if(this.trees[j] != null && j != tree1Index) {
					var sim1 = this.table[j].getByKey("to", tree1Index).sim
					var sim2 = this.table[j].getByKey("to", tree2Index).sim
					// console.log("j: " + j)

					// console.log(this.table[j].getByKey("to", tree1Index))
					// console.log(this.table[j].getByKey("to", tree2Index))
					// if(this.table[tree1Index].getByKey("to", j).sim != this.table[j].getByKey("to", tree1Index).sim) {
					// 	console.log("tree1Index: " + tree1Index)
					// 	console.log("j: " + j)
					// 	console.log(this.table[tree1Index])
					// 	console.log(this.table[j])
					// }
					this.table[j].removeByKey("to", tree1Index);
					this.table[j].removeByKey("to", tree2Index);
					var indexMerged = tree1Index;
					var grid1 = new Grid();
					grid1.sim = clusteringMethod.call(this, j, sim1, sim2, indexMerged);
					grid1.from = j;
					grid1.to = tree1Index;
					this.table[j].push(grid1);

					var grid2 = new Grid();
					grid2.sim = grid1.sim;
					grid2.from = tree1Index;
					grid2.to = j;
					tree1Heap.push(grid2)
				}
			}, this)
			this.table[tree1Index] = tree1Heap;
			this.table[tree2Index] = null;
		}, this)
	},


	getClusters: function(k, fields) {
		var finalTree = this.lastAlive;
		var threshold = 2 * this.docs.length - k;
		var clusters = [];
		finalTree.conditionalPreOrderTraverse(node => {
			if(node.id < threshold) {
				var cluster = {};
				cluster.id = node.id;
				cluster.docs = [];
				_.forEach(node.docs, doc => {
					cluster.docs.push(_.pick(doc, fields));
				})
				clusters.push(cluster);
			}
		}, child => {
			return child.parent.id >= threshold;
		});
		return clusters;
	},

	getClustersWithLabels: function(k, fields, featureCount, featureMethod) {
		this.selector = new FeatureSelector();
		var finalTree = this.lastAlive;
		var threshold = 2 * this.docs.length - k;
		var clusters = [];
		var owner = this;
		finalTree.conditionalPreOrderTraverse(function(node) {
			if(node.id < threshold) {
				var cluster = {};
				cluster.id = node.id;
				cluster.docs = [];
				_.forEach(node.docs, function(doc) {
					cluster.docs.push(_.pick(doc, fields));
					owner.selector.addDocument(doc.terms, node.id)
				})
				clusters.push(cluster);
			}
		}, function(child) {
			return child.parent.id >= threshold;
		});

		var features = this.selector.getFeature(featureCount, featureMethod);
		_.forEach(features, function(feature) {
			var label = feature.label;
			var cluster = clusters.find(function(element) {
				return element.id == label;
			})
			cluster.labels = feature.features;
		})

		return clusters;
	},

	getClustersFrequentTerms: function(k, count) {
		var finalTree = this.lastAlive;
		var threshold = 2 * this.docs.length - k;
		var clusters = [];
		var owner = this;
		finalTree.conditionalPreOrderTraverse(function(node) {
			if(node.id < threshold) {
				var vector = node.vector;
				var maps = [];
				var terms = [];
				for(var i = 0; i < node.docs.length; i++) {
					terms = terms.concat(node.docs[i].terms);
				}

				var tfs = [];

				for(var i = 0; i < terms.length; i++) {
					var term = terms[i];
					var tf = tfs.find(function(element) {
						return element.term == term;
					})
					if(!tf) {
						tf = {};
						tf.term = term;
						tf.frequency = 0;
						tfs.push(tf);
					}
					tf.frequency++;
				}

				tfs.sort(function(item1, item2) {
					return item2.frequency - item1.frequency;
				})

				tfs = tfs.slice(0, count);
				clusters.push(tfs);
			}
		}, function(child) {
			var condition = child.parent.id >= threshold;
			return condition;
		});
		return clusters;

	},

	getClustersTermsContrib: function(k, count) {
		var finalTree = this.lastAlive;
		var threshold = 2 * this.docs.length - k;
		var clusters = [];
		var owner = this;
		finalTree.conditionalPreOrderTraverse(function(node) {
			if(node.id < threshold) {
				var vector = node.vector;
				var maps = [];
				var terms = [];
				for(var i = 0; i < vector.length; i++) {
					var map = {};
					map.index = i;
					map.value = vector[i];
					maps.push(map);
				}

				maps.sort(function(item1, item2) {
					return item2.value - item1.value;
				})

				for(var i = 0; i < count; i++) {
					var index = maps[i].index;
					var map = {};
					map.term = owner.postings[index].term;
					map.value = maps[i].value;
					terms.push(map);
				}

				clusters.push(terms);
			}
		}, function(child) {
			var condition = child.parent.id >= threshold;
			return condition;
		});
		return clusters;

	},


}

HAC.GA = function(indexI, sim1, sim2, indexMerged) {
	var clusteri = this.trees[indexI].root;
	var clusterMerged = this.trees[indexMerged].root;
	var n1 = clusteri.docs.length;
	var n2 = clusterMerged.docs.length;

	var vector = [];
	var product = 0;

	_.forEach(_.range(this.postings.length), function(i) {
		vector[i] = clusteri.vector[i] + clusterMerged.vector[i];
		vector[i] *= vector[i];
		product += vector[i];
	})

	var sim = ( product - (n1 + n2) ) / ( (n1 + n2) * (n1 + n2 - 1) );
	return sim;
};


HAC.SingleLink = function(indexI, sim1, sim2, indexMerged) {
	return Math.max(sim1, sim2)
};

HAC.CompleteLink = function(indexI, sim1, sim2, indexMerged) {
	return Math.min(sim1, sim2)
};

HAC.Centroid = function(indexI, sim1, sim2, indexMerged) {

};

HAC.verifyGA = function(cluster1, cluster2) {
	var n1 = cluster1.docs.length;
	var n2 = cluster2.docs.length;

	var docs = cluster1.docs.concat(cluster2.docs)
	var sim = 0;
	for(var i = 0; i < docs.length; i++) {
		for(var j = 0; j < docs.length; j++) {
			if(i != j) {
				var vector = [];
				for(var k = 0; k < cluster1.vector.length; k++) {
					vector[k] = cluster1.vector[k] * cluster2.vector[k];
					sim += vector[k];
				}
			}
		}
	}
	sim /= (n1 + n2) * (n1 + n2 - 1);
	return sim;
}


function Grid() {
	this.sim = 0;
	this.from = "";
	this.to = "";
}

function Posting(term) {
	this.term = term;
	this.indexes = [];
}

function Tf(term) {
	this.term = term;
	this.frequency = 0;
}

function Doc(id) {
	if(id == undefined) {
		id = uuid();
	}
	this.id = id;
	this.content = "";
	this.terms = [];
	this.tfs = [];
	this.vector = [];

}

function Cluster(id) {
	if(id == undefined) {
		id = uuid();
	}
	this.id = id;
	this.docs = [];
	this.vector = [];
}

Cluster.prototype = new Node();
Cluster.prototype.constructor = Cluster;

function cosine(doc1, doc2) {
	var product = 0;
	_.forEach(_.range(doc1.vector.length), i => {
		product += doc1.vector[i] * doc2.vector[i]
	})
	return product;
}


function preCluster(showProgress) {
	this.postings.sort(function(item1, item2) {
		if(item1.term > item2.term) {
			return 1;
		} else {
			return -1;
		}
	});
	if(showProgress) {
		console.log("done sorting postings");
	}

	_.forEach(this.docs, function(doc, i) {
		var vector = doc.vector;
		var j = 0;
		var k = 0;
		var len = 0;
		while(k < this.postings.length) {
			vector[k] = 0;
			if(j < doc.tfs.length) {
				var docTerm = doc.tfs[j].term;
				var postingTerm = this.postings[k].term;
				if(docTerm == postingTerm) {
					var tf = doc.tfs[j].frequency;
					var df = this.postings[k].indexes.length;
					var n = this.docs.length;
					var idf = Math.log(n / df);
					vector[k] = tf * idf;
					len += Math.pow(vector[k], 2);
					j++;
					k++;
				} else if(docTerm > postingTerm) {
					k++;
				} else {
					throw "wrong order";
				}
			} else {
				k++;
			}
		}
		len = Math.sqrt(len);
		doc.vector = vector.map(function(element) {
			return element / len;
		})
		var cluster = new Cluster(this.clusterIndex);
		var tree = new Tree();
		tree.root = cluster;
		this.clusterIndex++;
		cluster.docs.push(doc);
		cluster.vector = [].concat(doc.vector);
		this.trees.push(tree);
		if(showProgress && i % 100 == 0) {
			console.log("done generating vector for No." + i + " document");
		}
	}, this)
}

