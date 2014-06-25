// VexMusicXML - Copyright (c) Edward Potocko 2011
(function() {

var VF = Vex.Flow;

var Config = {};

Config.DEFAULT_CLEF = 'treble';
Config.DEFAULT_TIME_SIGNATURE = {beats: 4, beatType: 4};
Config.DEFAULT_KEY_SIGNATURE = {mode: 'major', fifths: 0};

Config.TIME_SIGNATURE_SYMBOLS = {
	'common': 'C'
};

Config.DURATIONS = {
	'whole': 'w', 'half': 'h', 'quarter': 'q',
	'eighth': '8', '16th': '16', '32nd': '32'
};

Config.CLEFS = {
	'G': 'treble', 
	'F': 'bass', 
	'C': 'alto',
	'percussion': 'treble' // TODO
	//'?': 'tenor'
};

Config.REST_POSITIONS = {
	'G': {
		'default': 'd/5',
		'whole': 'd/5',
		'half': 'd/5', // TODO
		'quarter': 'd/5', // TODO
		'eighth': 'd/5' // TODO
	},
	'F': {
		'default': 'f/3',
		'whole': 'f/3',
		'half': 'f/3', // TODO
		'quarter': 'f/3', // TODO
		'eighth': 'f/3' // TODO
	},
	'percussion': {
		'default': 'd/5'
	}
};

Config.KEYS = {
	major: [
		'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 
		'C',  'G',  'D',  'A',  'E',  'B',  'F#', 'C#'
	],
	minor: [ 
		'Abm', 'Ebm', 'Bbm', 'Fm',  'Cm',  'Gm',  'Dm', 
		'Am',  'Em',  'Bm',  'F#m', 'C#m', 'G#m', 'D#m', 'A#m'
	]	
};

Config.ACCIDENTALS = { 
	'sharp': '#', 
	'flat': 'b',
	'double-sharp': '##', 
	'flat-flat': 'bb'
};

Config.BARLINES = {
	'none': VF.Barline.type.NONE,
	'regular': VF.Barline.type.SINGLE, 
	'dotted': null, // TODO
	'dashed': null, // TODO
	'heavy': null, // TODO
	'light-light': VF.Barline.type.DOUBLE,
	'light-heavy': VF.Barline.type.END, 
	'heavy-light': null, // TODO
	'heavy-heavy': null, // TODO
	'tick': null, // TODO
	'short': null // TODO
};

// Export to Vex.MusicXml namespace
Vex.MusicXml.Config = Config;

})();