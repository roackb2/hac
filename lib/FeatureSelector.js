var natural = require('natural');
var stringify = require('stringify');
var _ = require('lodash')

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
	var numerator = Math.pow(n1i/nTotal, n11) * Math.pow(1 - n1i/nTotal, n01) * Math.pow(n1i/nTotal, n10) * Math.pow(1 - n1i/nTotal, n00);
	var denominator = Math.pow(n11/ni1, n11) * Math.pow(1 - n11/ni1, n01) * Math.pow(n10/ni0, n10) * Math.pow(1 - n10/ni0, n00);
	var llr = (-2) * Math.log(numerator/denominator);
	return llr;
}

FeatureSelector.prototype = {

	addDocument: function(content, label) {
		var doc = {};
		doc.index = this.index;
		this.index++;
		this.docCount++;
		if(_.isArray(content)) {
			doc.terms = content;
		} else {
			doc.terms = content.tokenizeAndStem();
		}
		doc.content = content;
		doc.label = label;
		var cls = this.classes.find(x => x.label == label);
		if(cls === undefined) {
			cls = {
				label: label,
				textLen: 0,
				docs: []
			};
			this.classes.push(cls);
		}
		this.textLen += doc.terms.length;
		cls.textLen += doc.terms.length;
		cls.docs.push(doc);

		var terms = [].concat(doc.terms);
		terms.sort();
		// Don't use lodash cuz array size will be modified
		for(var i = 0; i < terms.length; i++) {
			if(i != 0 && terms[i] == terms[i - 1]) {
				terms.splice(i ,1);
				i--;
			} else {
				var term = terms[i];
				var posting = this.postings.find(x => x.term == term);

				var posting;
				if(posting === undefined) {
					posting = {
						term: term,
						indexes: [],
					};
					this.postings.push(posting);
				}
				posting.indexes.push(doc.index);
			}
		}
	},


	getFeature: function(k, method, showProgress) {
		_.forEach(this.postings, function(posting) {
			if(showProgress && i % 1000 == 0) {
				console.log("getting utility score for No." + i + " term");
			}
			var term = posting.term;
			_.forEach(this.classes, function(cls) {
				if(!cls.features) {
					cls.features = [];
				}
				var utility = this.getUtility(posting, cls, method);
				var map = {};
				map.term = term;
				map.utility = utility;
				cls.features.push(map);
			}, this)
		}, this)

		var clusters = [];

		_.forEach(this.classes, function(cls) {
			cls.features.sort(function(item1, item2) {
				return item2.utility - item1.utility;
			});
			cls.features.splice(k, cls.features.length);
			var features = [].concat(cls.features);
			var cluster = {
				label: cls.label,
				features: features
			};
			clusters.push(cluster);
		}, this)

		return clusters;
	},

	getUtility: function(posting, cls, method) {

		/* first subscript: contains term
		** second subscript: in class
		*/
		var nTotal = this.docCount + 4;

		var n11 = 1;
		var n1i = posting.indexes.length + 2;
		var ni1 = cls.docs.length + 2;
		_.forEach(posting.indexes, function(index) {
			if(cls.docs.some(function(element) {
				return element.index == index;
			})) {
				n11++;
			}
		}, this)

		var n10 = n1i - n11;
		var n01 = ni1 - n11;
		var n00 = nTotal - n1i - n01;
		var n0i = n01 + n00;
		var ni0 = n10 + n00;

		return method(nTotal, n1i, ni1, n0i, ni0, n11, n10, n01, n00);
	},

}