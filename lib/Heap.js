module.exports = Heap;

function Heap(order, key, indexKeys) {
	this.arr = [];
	this.arr[0] = -Infinity;
	this.indexKeys = indexKeys;
	this.indexes = {};
	this.order = order;
	this.key = key;
	if(indexKeys != undefined){
		for(var i = 0; i < indexKeys.length; i++) {
			var indexKey = indexKeys[i];
			this.indexes[indexKey] = {};
		}
	}

}


Heap.prototype = {

	push: function(element) {
		this.arr[this.arr.length] = element;
		addIndex.call(this, element, this.arr.length - 1);
		if(this.arr.length > 2) {
			var index = this.arr.length - 1;
			moveUp.call(this, index);
		}


	},

	pop: function() {
		var len = this.arr.length;
		if(len > 1) {
			var top = this.arr[1];
			removeIndex.call(this, top);
			this.arr[1] = this.arr[len - 1];
			this.arr.length--;
			if(len > 2) {
				var index = 1;
				moveDown.call(this, index);
			}
		}

	},

	getTop: function() {
		return this.arr[1];
	},

	getByKey: function(key, value) {
		return this.arr[this.indexes[key][value]]
	},

	remove: function(index) {
		index++; // first node is dummy head
		if(index >= this.arr.length) throw "invalid index " + (index - 1) + ", array length is " + (this.arr.length - 1);
		var origin = this.arr[index];
		removeIndex.call(this, origin);
		var last = this.arr[this.arr.length - 1];
		this.arr.length--;

		if(index != this.arr.length) {
			this.arr[index] = last;
			addIndex.call(this, this.arr[index], index);
			moveUp.call(this, index);
			moveDown.call(this, index);
		}
	},

	removeByKey: function(key, value) {
		var index = this.indexes[key][value];
		if(this.arr[index] != undefined) {
			index--;
			this.remove(index);
		}
	},

	verify: function() {
		if(this.arr[0] != -Infinity) throw "dummy head is modified";
		for(var i = 1; i < this.arr.length; i++) {
			var p = this.arr[i];
			var c1id = i * 2;
			var c2id = i * 2 + 1;
			if(this.arr[c1id] != undefined) {
				var c1 = this.arr[c1id];
				if(this.key != undefined) {
					c1 = c1[this.key];
					p = p[this.key];
				}
				if(this.order == Heap.Max && p < c1) throw "invalid order at " + i;
				if(this.order == Heap.Min && p > c1) throw "invalid order at " + i;
			}
			if(this.arr[c2id] != undefined) {
				var c2 = this.arr[c2id];
				if(this.key != undefined) {
					c2 = c2[this.key];
					p = p [this.key];
				}
				if(this.order == Heap.Max && p < c2) throw "invalid order at " + i;
				if(this.order == Heap.Min && p > c2) throw "invalid order at " + i;
			}
		}
		if(this.indexKeys != undefined) {
			for(var i = 0; i < this.indexKeys.length; i++) {
				var indexKey = this.indexKeys[i];
				for(var j = 0; j < this.indexes[indexKey].length; j++) {
					var index = this.indexes[indexKey][j]
					if(index != undefined && j != this.arr[index][indexKey]) throw "invalid index at " + j;
				}
			}
		}
	}
}

Heap.Max = 1;
Heap.Min = -1;

function addIndex(element, index) {
	var indexKeys = this.indexKeys
	if(indexKeys != undefined){
		for(var i = 0; i < indexKeys.length; i++) {
			var indexKey = indexKeys[i];
			this.indexes[indexKey][element[indexKey]] = index;
		}
	}

}

function removeIndex(element) {
	var indexKeys = this.indexKeys
	if(indexKeys != undefined){
		for(var i = 0; i < indexKeys.length; i++) {
			var indexKey = indexKeys[i];
			delete(this.indexes[indexKey][element[indexKey]]);
		}
	}
}


function choose(parentIndex) {
	var order = this.order;
	var key = this.key;
	var child1Index = parentIndex * 2;
	var child2Index = parentIndex * 2 + 1;
	var child1 = this.arr[child1Index];
	var child2 = this.arr[child2Index];
	if(child1 != undefined && child2 == undefined) {
		return child1Index;
	} else if(child1 == undefined && child2 != undefined) {
		return child2Index;
	} else if(child1 == undefined && child2 == undefined) {
		return this.arr.length;
	}else {
		if(key != undefined) {
			child1 = child1[key];
			child2 = child2[key];
		}
	 	if(order == Heap.Max) {
			if(child1 > child2) {
				return child1Index
			} else {
				return child2Index;
			}
		} else if(order == Heap.Min) {
			if(child1 > child2) {
				return child2Index;
			} else {
				return child1Index;
			}
		} else throw "unknown heap order: " + order;
	}
}



function satisfy(parentIndex, childIndex) {
	var order = this.order;
	var key = this.key;
	var parent = this.arr[parentIndex];
	var child = this.arr[childIndex];
	if(key != undefined) {
		parent = parent[key];
		child = child[key];
	}
	if(order == Heap.Max) {
		return parent >= child;
	} else if(order == Heap.Min) {
		return parent <= child;
	} else throw "unknown heap order: " + order;
}

function moveUp(index) {
	var childIndex = index;
	var parentIndex = Math.floor(childIndex / 2);
	while(parentIndex > 0 && !satisfy.call(this, parentIndex, childIndex)) {
		swap.call(this, parentIndex, childIndex);
		childIndex = parentIndex;
		parentIndex = Math.floor(childIndex / 2);
	}
}

function moveDown(index) {
	var parentIndex = index;
	var childIndex = choose.call(this, parentIndex);
	while(childIndex < this.arr.length && !satisfy.call(this, parentIndex, childIndex)) {
		swap.call(this, parentIndex, childIndex);
		parentIndex = childIndex;
		childIndex = choose.call(this, parentIndex);
	}
}


function swap(index1, index2) {
	var temp = this.arr[index1];
	this.arr[index1] = this.arr[index2];
	this.arr[index2] = temp;
	if(this.indexKeys != undefined) {
		addIndex.call(this, this.arr[index1], index1);
		addIndex.call(this, this.arr[index2], index2);
	}
}