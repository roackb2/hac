var es6Shim = require("../node_modules/es6-shim");
var uuid = require("../node_modules/node-uuid").v4;
var natural = require("../node_modules/natural");
var Node = require("./Node.js");
var Tree = require("./BTree.js");
var Heap = require("./Heap.js");

module.exports = HAC;

function HAC() {
	natural.PorterStemmer.attach();
	this.table = [];	
	this.docs = [];
	this.trees = [];
	this.postings = [];
	this.clusterIndex = 0;
	this.lastAlive = -1;
}


HAC.prototype = {
	
	addDocument: function(content, id) {
		var doc = new Doc(id);
		if(content instanceof Array) {
			doc.terms = content;	
		} else {
			doc.terms = content.tokenizeAndStem();
		}
		doc.content = content;
		var terms = [].concat(doc.terms);
		terms.sort();
		for(var i = 0; i < terms.length; i++) {
			var term = terms[i];
			var tf = doc.tfs.find(function(element) {
				return element.term == term;
			})
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
		for(var i = 0; i < terms.length; i++) {
			var term = terms[i];
			var posting = this.postings.find(function(element) {
				return element.term == term;
			})
			if(!posting) {
				posting = new Posting(term);
				this.postings.push(posting);
			}
			posting.indexes.push(doc.id);
		}
	},

	cluster: function(method, showProgress) {
		if(this.docs.length > 1000) {
			preCluster.call(this, showProgress);			
		} else {
			preCluster.call(this);						
		}
		if(showProgress) {
			console.log("done preCluster");				
		}		
		for(var i = 0; i < this.trees.length; i++) {
			var cluster1 = this.trees[i].root;
			this.table[i] = new Heap(Heap.Max, "sim", ["to"]);
			for(var j = 0; j < this.trees.length; j++) {
				if(i != j) {
					var cluster2 = this.trees[j].root;
					var grid = new Grid();
					grid.sim = method.call(this, cluster1, cluster2);
					grid.from = i; 
					grid.to = j; // `to` is equal to `index` in ppt.
					this.table[i].push(grid);			
				}
				if(showProgress && this.trees.length > 1000 && j % 1000 == 0) {
					console.log("done generating table [" + i + "][" + j + "]");
				}				
			}
			if(showProgress && i % 10 == 0) {
				console.log("done generating table for No." + i + " document");
			}			
		}
		if(showProgress) {
			console.log("done generating table");
		}

		var steps = this.trees.length;
		steps--;
		for(var i = 0; i < steps; i++) {
			if(showProgress && i % 10 == 0) {
				console.log((steps - i) + " steps left");				
			}	
			var maxSim = 0;
			var maxSimElement;
			var owner = this;

			this.table.map(function(element, index) {
				if(owner.trees[index] != null) {
					var top = element.getTop();				
					var sim = top.sim;
					if(sim > maxSim) {
						maxSim = top.sim;
						maxSimElement = top;
					}					
				}
			})

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
			for(var j = 0; j < this.postings.length; j++) {
				merged.vector[j] = cluster1.vector[j] + cluster2.vector[j];
			}
			this.trees[tree1Index] = tree;
			this.trees[tree2Index] = null;

			if(i == steps - 1) {
				this.lastAlive = this.trees[tree1Index];
			}

			this.table[tree1Index] = new Heap(Heap.Max, "sim", ["to"]);
			this.table[tree2Index] = null;

			for(var j = 0; j < this.table.length; j++) {
				if(showProgress && this.table.length > 1000 && j % 1000 == 0) {
					console.log((steps - i) + " steps left, dealing No." + j + " item");				
				}					

				if(this.trees[j] != null && j != tree1Index) {				
					this.table[j].removeByKey("to", tree1Index);
					this.table[j].removeByKey("to", tree2Index);
					var clust1 = this.trees[j].root;
					var clust2 = this.trees[tree1Index].root;
					var grid1 = new Grid();
					grid1.sim = method.call(this, clust1, clust2);
					grid1.from = j; 
					grid1.to = tree1Index;
					this.table[j].push(grid1);						

					var grid2 = new Grid();
					grid2.sim = grid1.sim;
					grid2.from = tree1Index;
					grid2.to = j;
					this.table[tree1Index].push(grid2);
									

				}
			}
		}		
	},


	getClusters: function(k, fields) {
		var finalTree = this.lastAlive;
		var threshold = 2 * this.docs.length - k;
		var clusters = [];
		finalTree.conditionalPreOrderTraverse(function(node) {
			if(node.id < threshold) {
				var cluster = [];
				for(var i = 0; i < node.docs.length; i++) {
					var doc = {};
					for(var j = 0; j < fields.length; j++) {
						doc[fields[j]] = node.docs[i][fields[j]];
					}
					cluster.push(doc);
				}
				clusters.push(cluster);
			}
		}, function(child) {
			var condition = child.parent.id >= threshold;
			return condition;
		});
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

HAC.GA = function(cluster1, cluster2) {

	var n1 = cluster1.docs.length;
	var n2 = cluster2.docs.length;

	var vector = [];
	var product = 0;

	for(var i = 0; i < this.postings.length; i++) {
		vector[i] = cluster1.vector[i] + cluster2.vector[i];
		vector[i] *= vector[i];
		product += vector[i];
	}

	var sim = ( product - (n1 + n2) ) / ( (n1 + n2) * (n1 + n2 - 1) );

	return sim;
};


HAC.SingleLink = function(cluster1, cluster2) {

};

HAC.CompleteLink = function(cluster1, cluster2) {

};

HAC.Centroid = function(cluster1, cluster2) {

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

	for(var i = 0; i < this.docs.length; i++) {
		var doc = this.docs[i];
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
	}		
}

