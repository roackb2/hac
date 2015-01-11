
var fs = require("fs");

module.exports = {

	readDocs: function(rootDir) {
		var docs = [];
		var files = fs.readdirSync(rootDir + "/data/docs");
		files = files.filter(function(element, index, arr) {
			return !element.indexOf(".") == 0;
		})
		for(var i = 0; i < files.length; i++) {
			var file = files[i];
			var doc = {};
			doc.index = file.split(".")[0];
			doc.content = fs.readFileSync(rootDir + "/data/docs/" + file, "utf8");
			docs.push(doc);
		}
		//console.log(docs[1]);
		return docs;
	},

	readReuters: function(rootDir) {
		var reuters = [];
		var dataPath = rootDir + "/data/reuters-21578-json/data/full";
		var files = fs.readdirSync(dataPath);
		files = files.filter(function(element, index, arr) {
			return !element.indexOf(".") == 0;
		})		
		for(var i = 0; i < files.length; i++) {
			var fileContent = fs.readFileSync(dataPath + "/" + files[i]);
			var json = JSON.parse(fileContent);
			reuters = reuters.concat(json);
		}
		//console.log(reuters);
		return reuters;
	},


	outputResult: function(rootDir, content, name) {
		var file = rootDir + "/data/outputs/" + name;
		fs.writeFileSync(file, content);
	}
}