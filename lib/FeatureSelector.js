var natural = require("natural");

module.exports = FeatureSelector;

function FeatureSelector() {
	natural.PorterStemmer.attach();
	this.index = 0;
	this.textLen = 0;
	this.docCount = 0;
	this.classes = [];
	this.postings = [];
}

FeatureSelector.MI = function(nTotal, n1i, ni1, n0i, ni0, n11, n10, n01, n00) {
	var mi = 0;
	mi += (n11 / nTotal) * (Math.log((nTotal * n11) / (n1i * ni1)) / Math.log(2));
	mi += (n01 / nTotal) * (Math.log((nTotal * n01) / (n0i * ni1)) / Math.log(2));
	mi += (n10 / nTotal) * (Math.log((nTotal * n10) / (n1i * ni0)) / Math.log(2));
	mi += (n00 / nTotal) * (Math.log((nTotal * n00) / (n0i * ni0)) / Math.log(2));
	return mi;
}

FeatureSelector.LLR = function(nTotal, n1i, ni1, n0i, ni0, n11, n10, n01, n00) {
	var llr = 0;

	return llr;
}

FeatureSelector.prototype = {

	addDocument: function(content, label) {
		var doc = {};
		doc.index = this.index;
		this.index++;
		this.docCount++;
		if(content instanceof Array) {
			doc.terms = content;
		} else {
			doc.terms = content.tokenizeAndStem();
		}
		doc.content = content;
		doc.label = label;
		var filtered = this.classes.filter(function(element, index, arr) {
			return element.label == label;
		})

		var cls;
		if(filtered.length == 0) {
			cls = {};
			cls.label = label;
			cls.textLen = 0;
			cls.docs = [];
			this.classes.push(cls);
		} else {
			cls = filtered[0];
		}
		this.textLen += doc.terms.length;
		cls.textLen += doc.terms.length;
		cls.docs.push(doc);

		var terms = [].concat(doc.terms);
		terms.sort();
		for(var i = 0; i < terms.length; i++) {
			if(i != 0 && terms[i] == terms[i - 1]) {
				terms.splice(i ,1);
				i--;
			} else {
				var term = terms[i];
				var postings = this.postings.filter(function(element, index, arr) {
					return element.term == term;
				})

				var posting;
				if(postings.length == 0) {
					posting = {};
					posting.term = term;
					posting.indexes = [];
					this.postings.push(posting);
				} else {
					posting = postings[0];
				}
				posting.indexes.push(doc.index);
			}
		}
		/*
		for(var i = 0; i < this.classes.length; i++) {
			console.log(this.classes[i]);
		}
		console.log(this.postings);
		*/
	},


	getFeature: function(k, method, showProgress) {
		//console.log("class count: " + this.classes.length);
		for(var i = 0; i < this.postings.length; i++) {
			if(showProgress && i % 1000 == 0) {
				console.log("getting utility score for No." + i + " term");
			}
			var posting = this.postings[i];
			var term = posting.term;
			for(var j = 0; j < this.classes.length; j++) {
				var cls = this.classes[j];
				//console.log(cls.label);
				if(!cls.features) {
					cls.features = [];
				}
				var utility = this.getUtility(posting, cls, method);
				//console.log(utility);
				var map = {};
				map.term = term;
				map.utility = utility;
				cls.features.push(map);
			}
		}


		var clusters = [];

		for(var i = 0; i < this.classes.length; i++) {
			var cls = this.classes[i];
			cls.features.sort(function(item1, item2) {
				return item2.utility - item1.utility;
			});
			cls.features.splice(k, cls.features.length);
			var features = [].concat(cls.features);
			var cluster = {};
			cluster.label = cls.label;
			cluster.features = features
			clusters.push(cluster);
		}

		return clusters;
	},

	getUtility: function(posting, cls, method) {

		/* first subscript: contains term
		** second subscript: in class
		*/
		var nTotal = this.docCount ;

		var n11 = 0;
		var n10 = 0;
		var n1i = posting.indexes.length;
		var ni1 = cls.docs.length;
		for(var i = 0; i < posting.indexes.length; i++) {
			var index = posting.indexes[i];
			if(cls.docs.some(function(element) {
				return element.index == index;
			})) {
				n11++;
			} else {
				n10++;
			}
		}

		var n01 = ni1 - n11;
		var n00 = nTotal - n1i - n01;
		var n0i = n01 + n00;
		var ni0 = n10 + n00;

		return method(nTotal, n1i, ni1, n0i, ni0, n11, n10, n01, n00)
	},

}