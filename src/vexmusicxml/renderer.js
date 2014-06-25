// VexMusicXML - Copyright (c) Edward Potocko 2011
(function() {

var V = Vex,
	VF = Vex.Flow,
	Config = Vex.MusicXml.Config,
	RERR = Vex.RuntimeError,
	LayoutHelper = Vex.MusicXml.LayoutHelper,
	LineBreaker = Vex.MusicXml.LineBreaker,
	isUndefined = Vex.MusicXml.isUndefined,
	isFunction = jQuery.isFunction,
	compactArray = Vex.MusicXml.compactArray;

var Translate = {};

/**
 * Convert a musicxml clef to a vexflow clef
 */
Translate.clef = function(clef) {
	return Config.CLEFS[clef];
}

Translate.keySignature = function(keySignature) {
	if(keySignature && keySignature.mode in Config.KEYS) {
		return Config.KEYS[keySignature.mode][keySignature.fifths + 7];
	}
	return null;
}

Translate.timeSignature = function(timeSignature) {
	var symbol = timeSignature.symbol;
	if(symbol && Config.TIME_SIGNATURE_SYMBOLS[symbol]) {
		return Config.TIME_SIGNATURE_SYMBOLS[symbol];
	}
	return timeSignature.beats + '/' + timeSignature.beatType;
}

var NoteHelper = {};

/**
 * Converts an array of notes organized by voice to VexFlow
 * voices.  
 */
NoteHelper.notesToVoices = function(notes, staves, timeSignature) {
	var voices = [];
	var voiceSpec = {
		num_beats: timeSignature.beats, 
		beat_value: timeSignature.beatType, 
		resolution: VF.RESOLUTION 
	};
	for(var i = 0; i < notes.length; i++) {
		if(isUndefined(notes[i])) continue;
		var voice = new VF.Voice(voiceSpec);
		voice.setStrict(false);
		for(var j = 0; j < notes[i].length; j++) {
			var n = notes[i][j];
			if(n.length == 1) {
				// Single note
				voice.addTickable(NoteHelper.noteToStaveNote(n[0], staves));
			}
			else {
				// Chord
				voice.addTickables(NoteHelper.chordToStaveNotes(n, staves));
			}
		}
		voices.push(voice);
	}
	return voices;
}

NoteHelper.noteToStaveNote = function(data, staves) {
	data.keys = [NoteHelper.getNoteKey(data)];
	data.accidentals = [data.accidental];
	return NoteHelper.createNote(data, staves[data.staff]);
}

NoteHelper.chordToStaveNotes = function(n, staves) {
	var notesByStave = [];
	for(var i = 0; i < n.length; i++) {
		var staffIndex = n[i].staff;
		// Initialize the notesByStave array
		if(isUndefined(notesByStave[staffIndex])) {
			notesByStave[staffIndex] = { keys: [], accidentals: [] };
			for(var k in n[i]) {
				notesByStave[staffIndex][k] = n[i][k];
			}
		}
		// Add the key if there are no keys or this is not a rest
		if(notesByStave[staffIndex].keys.length == 0 || !n[i].isRest) {
			var key = NoteHelper.getNoteKey(n[i]);
			notesByStave[staffIndex].keys.push(key);
			notesByStave[staffIndex].accidentals.push(n[i].accidental);
		}
	}

	for(var i = 0; i < notesByStave.length; i++) {
		if(isUndefined(notesByStave[i])) continue;
		notesByStave[i] = NoteHelper.createNote(notesByStave[i], staves[i]);
	}

	return compactArray(notesByStave);
}

NoteHelper.createNote = function(data, stave) {
	var note = new VF.StaveNote({ 
		keys: data.keys, 
		duration: NoteHelper.getDuration(data), 
		clef: Translate.clef(data.clef)
	});
	note.setStave(stave);
	if(data.dot) {
		note.addDotToAll();
	}
	NoteHelper.addNoteAccidentals(note, data.accidentals);
	return note;
}

// Converts MusicXML note type to a vexflow note duration
NoteHelper.getDuration = function(note) {
	// Figure out the duration
	var duration = Config.DURATIONS[note.type];
	if(isUndefined(duration)) {
		if(note.isRest && note.measure) {
			// TODO: use the duration of the current measure
			duration = 'w';
		}
		else {
			throw new RERR("BAD_NOTE_TYPE", "Unsupported note type: " + note.type);
		}
	}
	if(note.dot) duration += 'd';
	if(note.isRest) duration += 'r';
	return duration;
}

NoteHelper.getNoteKey = function(note) {
	if(note.displayStep && note.displayOctave) {
		return note.displayStep + '/' + note.displayOctave;
	}

	if(note.isRest) {
		return NoteHelper.defaultRestPosition(note.type, note.clef);
	}
	else {
		var step = note.pitchStep;
		if(note.pitchAlter == -1) step += 'b';
		else if(note.pitchAlter == 1) step += '#';
		return step + '/' + note.pitchOctave;
	}
}

NoteHelper.defaultRestPosition = function(type, clef) {
	var pos = Config.REST_POSITIONS;
	if(isUndefined(pos[clef])) {
		throw new RERR("BAD_CLEF", "Unsupported clef for rest position");
	}
	if(pos[clef][type]) {
		return pos[clef][type];
	}
	return pos[clef]['default'];
}

/**
 * Adds accidentals to a Vex.Flow.Note
 */
NoteHelper.addNoteAccidentals = function(note, accidentals) {
	for(var i = 0; i < accidentals.length; i++) {
		if(accidentals[i]) {
			var symbol = Config.ACCIDENTALS[accidentals[i]];
			if(symbol) {
				var accidental = new VF.Accidental(symbol);
				note.addAccidental(i, accidental);
			}
		}
	}
}

/**
 * Converts MusicXML to VexFlow elements
 */
var MusicXmlInterpreter = function(musicXmlDoc, options) {
	this.musicXmlDoc = musicXmlDoc;
	this.options = Vex.Merge({
		measureSpacing: 0
	}, options);
}

MusicXmlInterpreter.prototype.run = function() {
	this.timeSignature = Config.DEFAULT_TIME_SIGNATURE;
	this.keySignature = Config.DEFAULT_KEY_SIGNATURE;
	var result = [];
	var i, j, k;
	var context = this.context;
	var measures = this.musicXmlDoc.measures;

	for(i = 0; i < measures.length; i++) {
		var measure = measures[i];
		var voices = [], elements = [], staves = [], staveElements = [];
		for(j = 0; j < measure.parts.length; j++) {
			var part = measure.parts[j],
				staveSet = part.staves, notesSet = part.notes,
				partStaves = {},
				minModifiersWidth = 0, maxModifiersWidth = 0;
			for(k = 0; k < staveSet.length; k++) {
				if(isUndefined(staveSet[k])) continue;
				var staveInfo = staveSet[k];
				var stave = new VF.Stave(0, 0, 1000);

				staveElements.push({
					clef: this._createClef(staveInfo),
					timeSignature: this._createTimeSignature(staveInfo),
					keySignature: this._createKeySignature(staveInfo)
				});

				// Barlines
				if(staveInfo.barlines) {
					if(staveInfo.barlines.right) {
						var b = Config.BARLINES[staveInfo.barlines.right.style];
						stave.setEndBarType(b);
					}
				}

				staves.push(stave);
				partStaves[staveInfo.number] = stave;
				
				// TODO: calculate width with required modifiers (key change, etc)
				minModifiersWidth = Math.max(minModifiersWidth, 
					LayoutHelper.calculateModifiersWidth({}));
				maxModifiersWidth = Math.max(maxModifiersWidth, 
					LayoutHelper.calculateModifiersWidth(staveElements[staveInfo.number]));
			}
			//var connector = this._createBracketStaveConnector(staves);
			//if(connector) {
			//	elements.push(connector);
			//}
			voices = voices.concat(
				NoteHelper.notesToVoices(notesSet, partStaves, this.timeSignature));
		}

		result.push({
			voices: voices,
			staves: staves,
			notesWidth: this._calculateNotesWidth(voices),
			minModifiersWidth: minModifiersWidth,
			maxModifiersWidth: maxModifiersWidth,
			staveElements: staveElements 
		});
	}
	return result;
}

MusicXmlInterpreter.prototype._createClef = function(stave) {
	var clef = Translate.clef(stave.clef);
	return clef ? (new VF.Clef(clef)) : null;
}

MusicXmlInterpreter.prototype._createTimeSignature = function(stave) {
	if(stave.timeSignature) {
		this.timeSignature = stave.timeSignature
	}
	var timeSignature = Translate.timeSignature(this.timeSignature)
	return timeSignature ? (new VF.TimeSignature(timeSignature)) : null;
}

MusicXmlInterpreter.prototype._createKeySignature = function(stave) {
	if(stave.key) {
		this.keySignature = stave.key;
	}
	var note = Translate.keySignature(this.keySignature);
	return note ? (new VF.KeySignature(note)) : null;
}

MusicXmlInterpreter.prototype._calculateNotesWidth = function(voices) {
	var width = LayoutHelper.calculateVoiceWidth(voices);
	width += width * this.options.measureSpacing;
	return width;
}

MusicXmlInterpreter.prototype._calculateModifiersWidth = function(modifiers) {
	return LayoutHelper.calculateModifiersWidth(modifiers);
}

MusicXmlInterpreter.prototype._createBracketStaveConnector = function(staves) {
	staves = compactArray(staves);
	if(staves.length < 2) {
		return null;
	}
	
	// Draw a bracket stave connector between the first and last stave
	var connector = new VF.StaveConnector(staves[0], staves[staves.length - 1]);
	connector.setType(VF.StaveConnector.type.BRACKET);
	return connector;
}

var MusicXmlRenderer = function(element, musicXmlDoc) {
	this.element = $(element)[0];
	this.musicXmlDoc = musicXmlDoc;
	this.renderer = new VF.Renderer(this.element, VF.Renderer.Backends.CANVAS);
	this.context = this.renderer.getContext();
}

MusicXmlRenderer.prototype.paddingLeft = 25;
MusicXmlRenderer.prototype.paddingRight = 25;
MusicXmlRenderer.prototype.measureSpacing = 0.40;
MusicXmlRenderer.prototype.measurePadding = 20;

MusicXmlRenderer.prototype.render = function() {
	var pageWidth = this.element.offsetWidth;
	
	// Convert the MusicXml to VexFlow elements
	var interpreter = new MusicXmlInterpreter(this.musicXmlDoc, {
		measureSpacing: this.measureSpacing
	});
	var measures = interpreter.run();
	
	// Break the measures up into different lines
	var measureWidth = pageWidth - this.paddingLeft - this.paddingRight;
	var lineBreaker = new LineBreaker(measures, measureWidth);
	var lines = lineBreaker.format(measures);
	
	// Draw each line in the score
	var offsetY = 0;
	for(var i = 0; i < lines.length; i++) {
		var height = this._renderLine(lines[i], i, offsetY);
		offsetY += height + 25;
	}
}

/**
 * Renders a single line in the score
 */
MusicXmlRenderer.prototype._renderLine = function(line, lineNum, offsetY) {
	var offsetX = this.paddingLeft, maxHeight = 0;
	for(var j = 0; j < line.length; j++) {
		var measure = line[j], height = 0;
		for(var k = 0; k < measure.staves.length; k++) {
			if(isUndefined(measure.staves[k])) continue;
			var stave = measure.staves[k];
			stave.init(offsetX, offsetY + height, measure.width);
			this._addStaveModifiers(stave, measure.staveElements[k], lineNum == 0, j == 0);
			stave.setContext(this.context).draw();
			height += stave.getHeight() + 25;
		}
		offsetX += measure.width;
		this._formatVoices(measure.voices, measure.notesWidth);
		this._drawVoices(measure.voices);
		maxHeight = height > maxHeight ? height : maxHeight;
	}
	return maxHeight;
}

MusicXmlRenderer.prototype._addStaveModifiers = function(stave, staveElements, firstRow, firstCol) {
	for(var k in staveElements) {
		if(staveElements[k] && isFunction(staveElements[k].addToStave)) {
			if((k == 'timeSignature' && firstRow && firstCol) || 
				(k != 'timeSignature' && firstCol)) {
				staveElements[k].addToStave(stave);
			}
		}
	}
}

/**
 * Renders an array of elements using the current context
 */
MusicXmlRenderer.prototype._drawElements = function(elements) {
	for(var i = 0; i < elements.length; i++) {
		elements[i].setContext(this.context).draw();
	}
}

MusicXmlRenderer.prototype._formatVoices = function(voices, width) {
	var formatter = new VF.Formatter();
	formatter.joinVoices(voices);
	formatter.createTickContexts(voices);
	formatter.preFormat(width);
	formatter.format(voices, width);
}

/**
 * Draws all the voices for a measure
 */
MusicXmlRenderer.prototype._drawVoices = function(voices) {
	for(var i = 0; i < voices.length; i++) {
		// Have to reset all the staves because the y coords
		// are calculated when the stave is set and it is set
		// before the position of the stave is known
		for(var j = 0; j < voices[i].tickables.length; j++) {
			voices[i].tickables[j].setStave(voices[i].tickables[j].stave);
		}
		this._drawElements(voices[i].tickables);
	}
}

// Export to Vex.MusicXml namespace
Vex.MusicXml.Renderer = MusicXmlRenderer;

})();