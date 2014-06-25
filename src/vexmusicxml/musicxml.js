// VexMusicXML - Copyright (c) Edward Potocko 2011
(function() {

if(typeof Vex == 'undefined') throw new Error("Required dependency Vex is missing");
if(typeof Vex.Flow == 'undefined') throw new Error("Required dependency VexFlow is missing");

// Define the Vex.MusicXml namespace
if(typeof Vex.MusicXml == 'undefined') Vex.MusicXml = {};

/**
 * Returns true if o is undefined
 */
Vex.MusicXml.isUndefined = function(o) {
	return typeof o === 'undefined';
};

Vex.MusicXml.isString = function(o) {
	return typeof o === 'string';
};

/**
 * Returns a new array with all null and undefined elements removed.
 */
Vex.MusicXml.compactArray = function(arr) {
	var result = [];
	for(var i = 0; i < arr.length; i++) {
		if(arr[i] !== null && typeof arr[i] !== 'undefined') {
			result.push(arr[i]);
		}
	}
	return result;
};

Vex.MusicXml.logError = function(message) {
	V.LogMessage(V.LogLevels.ERROR, message);
};

})();