// MusicXML Parser - Copyright (c) Edward Potocko 2011
(function() {

// Define the MusicXml namespace
MusicXml = {};

var isUndefined = function(o) {
	return typeof o === 'undefined';
}

var isString = function(o) {
	return typeof o === 'string';
}

var toInt = function(x) {
	return isString(x) ? parseInt(x) : x;
}

/**
 * Wrapper around jQuery xml parsing to make the functionality
 * that is commonly used in the MusicXML parsing a little cleaner
 */
var XmlNode = function(node) {
	this.node = $(node);
}

XmlNode.prototype.find = function(selector) {
	return this.node.find(selector);
}

XmlNode.prototype.children = function() {
	return this.node.children();
}

XmlNode.prototype.text = function(selector, defaultValue) {
	var res = this.node.find(selector);
	return res.length ? res.text() : defaultValue;
}

XmlNode.prototype.textAsInt = function(selector, defaultValue) {
	return toInt(this.text(selector, defaultValue));
}

XmlNode.prototype.attr = function(name, defaultValue) {
	return this.node.attr(name) || defaultValue;
}

XmlNode.prototype.attrAsInt = function(name, defaultValue) {
	return toInt(this.node.attr(name) || defaultValue);
}

XmlNode.prototype.exists = function(selector) {
	return this.node.find(selector).length > 0;
}

XmlNode.prototype.parent = function() {
	return new XmlNode(this.node.parent());
}

XmlNode.prototype.tagName = function() {
	return this.node[0].tagName;
}

// Shortcut for creating new XmlNodes
var $X = function(node) { return new XmlNode(node); };


// http://www.recordare.com/musicxml/dtd/attributes-module
var AttributesParser = {
	clef: function(node) {
		return {
			number: node.attrAsInt('number', 1),
			sign: node.text('sign')
		};
	},
	
	key: function(node) {
		return { 
			fifths: node.textAsInt('fifths'), 
			mode: node.text('mode', 'major')
		};
	},
	
	time: function(node) {
		return {
			beats: node.text('beats'), 
			beatType: node.textAsInt('beat-type'),
			symbol: node.attr('symbol')
		};
	}
}

// http://www.recordare.com/musicxml/dtd/barline-module
var BarlineParser = {
	barline: function(node) {
		return { 
			location: node.attr('location', 'right'),
			style: node.text('bar-style')
		};
	}
}

// http://www.recordare.com/musicxml/dtd/note-module
var NoteParser = {
	note: function(node) {
		var note = {};

		// Basic stuff
		note.staff = node.textAsInt('staff', 1);
		note.voice = node.textAsInt('voice', 1);
		note.chord = node.exists('chord');
		note.defaultX = node.attr('default-x');
		note.type = node.text('type');
		note.dot = node.exists('dot');
		note.accidental = node.text('accidental');

		// Rest
		note.isRest = node.exists('rest');
		if(note.isRest) {
			var rest = node.find('rest');
			NoteParser.rest($X(rest[0]), note);
		}

		// Pitch
		if(!note.isRest) {
			note.pitchStep = node.text('pitch > step');
			note.pitchOctave = node.text('pitch > octave');
			note.pitchAlter = node.textAsInt('pitch > alter', 0);
		}
		
		// Unpitched
		var unpitchedNode = node.find('unpitched');
		note.unpitched = unpitchedNode.length > 0;
		if(note.unpitched) {
			unpitchedNode = $X(unpitchedNode);
			note.displayStep = unpitchedNode.text('display-step', null);
			note.displayOctave = unpitchedNode.text('display-octave', null);
		}
		
		return note;
	},
	
	rest: function(node, note) {
		if(node.attr('measure') == 'yes') {
			note.measure = true;
			// TODO: determine duration of measure
		}
		//if(!note.type) {
			// Note does not have a type
			// TODO: Use type from note at the same position
			//       in a different voice
		//}
		note.displayStep = node.text('display-step', null);
		note.displayOctave = node.text('display-octave', null);
	}
}

// http://www.recordare.com/musicxml/dtd/score-module
var ScoreParser = {
	partList: function(node) {
		var parts = new PartList();
		node.find('score-part').each(function() {
			parts.addPart(ScoreParser.scorePart($X(this)));
		});
		return parts;
	},

	scorePart: function(node) {
		var part = new Part(node.attr('id'));
		part.name = node.text('part-name');
		return part;
	}
}


var PartList = function() {
	this.parts = [];
}

PartList.prototype.addPart = function(part) {
	this.parts.push(part);
}

/**
 * Find the part with the specified id
 */
PartList.prototype.getPartById = function(id) {
	for(var i = 0; i < this.parts.length; i++) {
		if(this.parts[i].id == id) {
			return this.parts[i];
		}
	}
	return null;
}

var Part = function(id) {
	this.id = id;
	this.state = { numStaves: 1, staves: [] };
}

var Measure = function(number) {
	this.number = number;
	this.parts = [];
}

var PartMeasure = function() {
	// Notes stored by voice
	this.notes = [];
	this.staves = [];
}

/**
 * Adds a note to the voice and creates chords for notes
 * at the same position
 */
PartMeasure.prototype.addNote = function(note) {
	var voiceIndex = note.voice;
	if(isUndefined(this.notes[voiceIndex])) {
		this.notes[voiceIndex] = [];
	}
	if(note.chord && this.notes[voiceIndex].length > 0) {
		// Add chord notes to the last note
		this.notes[voiceIndex][this.notes[voiceIndex].length - 1].push(note);
	}
	else {
		this.notes[voiceIndex].push([note]);
	}
}

var ScorePartwise = function(xml) {
	// Convert the xml to a document if needed
	this.doc = isString(xml) ? $.parseXML(xml) : xml;
}

ScorePartwise.prototype.parse = function() {
	var doc = $X(this.doc);
	
	// Parse the parts
	var node = doc.find('score-partwise > part-list')[0];
	this.parts = ScoreParser.partList($X(node));
	
	// Parse the measures
	this.measures = this._parseMeasures(doc);
}

ScorePartwise.prototype._parseMeasures = function(doc) {
	var nodes = this._getMeasureNodes(doc);
	var measures = [];
	for(var i = 0; i < nodes.length; i++) {
		if(isUndefined(nodes[i])) continue;
		var measure = new Measure(i);
		for(var j = 0; j < nodes[i].length; j++) {
			measure.parts.push(this._parseMeasure(nodes[i][j]));
		}
		measures.push(measure);
	}
	return measures;
}

/**
 * Returns a hash with all the measures stored
 * by measure number
 */
ScorePartwise.prototype._getMeasureNodes = function(doc) {
	var measureNodes = [];
	doc.find('score-partwise > part > measure').each(function() {
		var num = $X(this).attrAsInt('number');
		if(isUndefined(measureNodes[num])) measureNodes[num] = [];
		measureNodes[num].push($X(this));
	});
	return measureNodes;
}

ScorePartwise.prototype._parseMeasure = function(node) {
	var part = this.parts.getPartById(node.parent().attr('id'));
	var measure = new PartMeasure();
	measure.width = node.attrAsInt('width', 0);
	
	// If the number of staves is not present use the value from 
	// the last time it was present
	var numStaves = node.textAsInt('attributes staves', part.state.numStaves);
	var staves = [];
	for(var i = 1; i <= numStaves; i++) {
		if(isUndefined(part.state.staves[i])) {
			part.state.staves[i] = { clef: null };
		}
		staves[i] = { 
			number: i, partId: part.id,
			clef: part.state.staves[i].clef,
			barlines: {}
		};
		measure.staves.push(staves[i]);
	}
	part.state.numStaves = numStaves;

	// Process the measure child nodes
	var children = node.children();
	for(var i = 0; i < children.length; i++) {
		var child = $X(children[i]);
		switch(child.tagName()) {
			case 'note':
				var note = NoteParser.note(child);
				note.clef = part.state.staves[note.staff].clef;
				measure.addNote(note);
				break;			
			case 'attributes':
				this._parseMeasureAttributes(child, part, staves);
				break;
			case 'barline':
				this._parseMeasureBarline(child, part, staves);
				break;
		}
	}
	return measure;
}

ScorePartwise.prototype._parseMeasureBarline = function(node, part, staves) {
	var barline = BarlineParser.barline(node);
	for(var i = 1; i < staves.length; i++) {
		staves[i].barlines[barline.location] = barline;
	}
}

ScorePartwise.prototype._parseMeasureAttributes = function(node, part, staves) {
	var children = node.children();
	for(var i = 0; i < children.length; i++) {
		var child = $X(children[i]);
		switch(child.tagName()) {
			case 'clef':
				this._parseMeasureAttributeClef(child, part, staves);
				break;
			case 'time':
				this._parseMeasureAttributeTime(child, part, staves);
				break;
			case 'key':
				this._parseMeasureAttributeKey(child, part, staves);
				break;
		}
	}
}

ScorePartwise.prototype._parseMeasureAttributeClef = function(node, part, staves) {
	var clef = AttributesParser.clef(node);
	var staveIndex = clef.number;
	part.state.staves[staveIndex].clef = staves[staveIndex].clef = clef.sign;
}

ScorePartwise.prototype._parseMeasureAttributeTime = function(node, part, staves) {
	var timeSignature = AttributesParser.time(node);
	for(var i = 1; i < staves.length; i++) {
		part.state.staves[i].timeSignature = staves[i].timeSignature = timeSignature;
	}
}

ScorePartwise.prototype._parseMeasureAttributeKey = function(node, part, staves) {
	var key = AttributesParser.key(node);
	for(var i = 1; i < staves.length; i++) {
		part.state.staves[i].key = staves[i].key = key;
	}
}

/**
 * Convenience function for parsing MusicXML
 */
MusicXml.parse = function(xml) {
	var doc = isString(xml) ? $.parseXML(xml) : xml;
	var musicxml = null;
	if($X(doc).exists('score-partwise')) {
		musicxml = new ScorePartwise(doc);
	}
	else {
		throw new Error('Invalid or unsupported MusicXML document.  ' + 
			'Only score-partwise documents are supported.');
	}
	musicxml.parse();
	return musicxml;
}

// Export to MusicXml namespace
MusicXml.ScorePartwise = ScorePartwise;

})();