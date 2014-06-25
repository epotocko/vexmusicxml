// VexMusicXML - Copyright (c) Edward Potocko 2011
(function() {

var VF = Vex.Flow;

var LayoutHelper = {};

LayoutHelper.calculateVoiceWidth = function(voices) {
	var formatter = new VF.Formatter();
	formatter.joinVoices(voices);
	formatter.createTickContexts(voices);
	return LayoutHelper.calculateContextsWidth(formatter.tContexts);
}

LayoutHelper.calculateContextsWidth = function(contexts) {
	var contextList = contexts.list,
		contextMap = contexts.map,
		width = 0;
	for(var i = 0; i < contextList.length; ++i) {
		var context = contextMap[contextList[i]];
		context.preFormat();
		width += context.getWidth();
	}
	return width;
}

LayoutHelper.calculateModifiersWidth = function(modifiers) {
	// Create a temporary stave to add the modifiers to
	var stave = new VF.Stave(0, 0, 10000);
	for(var k in modifiers) {
		if(modifiers[k]) {
			stave.addModifier(modifiers[k]);
		}
	}

	// Get the width of all the modifiers
	var width = stave.glyph_start_x;
	for(var i = 0; i < stave.glyphs.length; i++) {
		width += stave.glyphs[i].getMetrics().width;
	}
	width += stave.options.vertical_bar_width;
	return width;
}

var LineBreaker = function(measures, width) {
	this.measures = measures;
	this.width = width;
}

LineBreaker.prototype.format = function() {
	var lines = [], line = [];
	var currentWidth = 0;
	for(var i = 0; i < this.measures.length; i++) {
		var measure = this.measures[i];
		
		// Width of measure if it is on a new line
		var firstWidth = measure.maxModifiersWidth + measure.notesWidth;
		
		// Width of measure if it is in the middle of a line
		var normalWidth = measure.minModifiersWidth + measure.notesWidth;
		
		// Wrap to the next line if we run out of room
		if(normalWidth + currentWidth > this.width) {
			// Update the width of all the measures to fit the page width
			var extraWidth = this.width - currentWidth;
			for(var j = 0; j < line.length; j++) {
				var x = line[j];
				x.width += (x.width / currentWidth) * extraWidth;
				x.notesWidth = x.width - (j ? x.minModifiersWidth : x.maxModifiersWidth);
			}
			lines.push(line);
			line = [];
			currentWidth = 0;
		}
		measure.width = (currentWidth == 0) ? firstWidth : normalWidth;
		line.push(measure);
		currentWidth += measure.width;
	}
	return lines;
}

Vex.MusicXml.LayoutHelper = LayoutHelper;
Vex.MusicXml.LineBreaker = LineBreaker;

})();