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
					grid.from = i; //cluster1.id;
					grid.to = j; //cluster2.id;  // `to` is equal to `index` in ppt.
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

/*			for(var j = 0; j < this.table.length; j++) {
				var heap = this.table[j];
				if(heap) {
					var top = heap.getTop();
					var sim = top.sim;
					if(sim > maxSim) {
						maxSim = top.sim;
						maxSimElement = top;
					}
				}
			}*/

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
			//console.log(tree1Index);
			//console.log(tree2Index);
			// console.log(tree1.root.docs[0].content);
			// console.log(tree2.root.docs[0].content);
			//console.log(maxSimElement);
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
/*				console.log("lastAlive: " + tree1Index);
				console.log(this.lastAlive);*/
			}

			this.table[tree1Index] = new Heap(Heap.Max, "sim", ["to"]);
			this.table[tree2Index] = null;

			for(var j = 0; j < this.table.length; j++) {
				if(showProgress && this.table.length > 1000 && j % 1000 == 0) {
					console.log((steps - i) + " steps left, dealing No." + j + " item");				
				}					
/*				console.log("j: " + j);				
				console.log(this.table[j] == null);
				console.log(this.trees[j] == null);*/
				if(this.trees[j] != null && j != tree1Index) {				
/*					console.log(this.table[j].arr);	
					console.log(this.table[j].indexes.to);*/									
					this.table[j].removeByKey("to", tree1Index);
					this.table[j].removeByKey("to", tree2Index);
/*					console.log("tree1Index: " + tree1Index);
					console.log("tree2Index: " + tree2Index);
					console.log(this.table[j].arr);					
					console.log(this.table[j].indexes.to);			*/		
					//this.table[j].verify();
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
/*			for(var j = 0; j < this.table.length; j++) {
				if(this.table[j] != null) {
					console.log(this.table[j].arr);					
				}
			}*/
		}		
	},

	clusterSlow: function(method, showProgress) {
		preCluster.apply(this, showProgress);
		if(showProgress) {
			console.log("done preCluster");				
		}
		for(var i = 0; i < this.trees.length; i++) {
			var cluster1 = this.trees[i].root;
			for(var j = i + 1; j < this.trees.length; j++) {
				var cluster2 = this.trees[j].root;
				var grid = new Grid();
				grid.sim = method.call(this, cluster1, cluster2);
				grid.from = cluster1.id;
				grid.to = cluster2.id;
				this.table.push(grid);
			}
			if(showProgress && i % 10 == 0) {
				console.log("done generating table for No." + i + " document");
			}
		}
		if(showProgress) {
			console.log("done generating table");
		}

		while(this.trees.length > 1) {
			var treeLen = this.trees.length;
			if(showProgress && treeLen % 10 == 0) {
				console.log("tree count: " + treeLen);				
			}
			this.table.sort(function(item1, item2) {
				return item2.sim - item1.sim;
			}) 
			//console.log(this.table);

			var grid = this.table[0];

			var tree1Index;
			var tree2Index;

			var tree1;
			var tree2;

			for(var i = 0; i < this.trees.length; i++) {
				var tree = this.trees[i];
				var cluster = tree.root;
				if(cluster.id == grid.from) {
					tree1 = tree;
					tree1Index = i;
				} else if(cluster.id == grid.to) {
					tree2 = tree;
					tree2Index = i;
				}
			}

			var cluster1 = tree1.root;
			var cluster2 = tree2.root;


			var merged = new Cluster(this.clusterIndex);
			this.clusterIndex++;
			var tree = new Tree();
			tree.root = merged;
			tree.appendLeftChild(merged, tree1);
			tree.appendRightChild(merged, tree2);
			merged.docs = cluster1.docs.concat(cluster2.docs);
			for(var i = 0; i < this.postings.length; i++) {
				merged.vector[i] = cluster1.vector[i] + cluster2.vector[i];
			}
			this.trees.splice(tree1Index, 1);
			tree2Index--;
			this.trees.splice(tree2Index, 1);
			this.trees.push(tree);

			this.table = this.table.filter(function(element) {
				return element.from != cluster1.id && element.from != cluster2.id && element.to != cluster1.id && element.to != cluster2.id;
			})

			for(var i = 0; i < this.trees.length - 1; i++) {
				var grid = new Grid();
				var cluster = this.trees[i].root;
				grid.from = cluster.id;
				grid.to = merged.id;
				grid.sim = method.call(this, cluster, merged);
				this.table.push(grid);
			}
		}
		this.lastAlive = this.trees[0];
	},


	getClusters: function(k, fields) {
		//var finalTree = this.trees[0];
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

/*				for(var i = 0; i < vector.length; i++) {
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

				clusters.push(terms);*/
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

	// TODO: may need detail check.

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


/*	console.log("cluster1: " + cluster1.id);
	console.log("cluster2: " + cluster2.id);
	console.log("n1: " + n1);
	console.log("n2: " + n2);
	console.log(vector);
	console.log("product: " + product);*/

/*	var toVerify = HAC.verifyGA.call(this, cluster1, cluster2);
	console.log(sim);
	console.log(toVerify);*/
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
/*					console.log("term: " + docTerm);
					console.log("tf: " + tf);
					console.log("df: " + df);
					console.log("n: " + n);
					console.log("n / df: " + (n / df));
					console.log("idf: " + idf);*/
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
		//console.log(len);
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

