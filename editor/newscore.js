const VF = Vex.Flow;

console.log("initializing ...");
const score = new VF.VirtualScore(2, 5, 'Bb', 4, 4, true, "boo");

console.log("setting index ...");
score.setIndex(1, 1);

console.log("adding note ...");
score.addNoteAtIndex({clef: "treble", keys: ["f/4"], duration: "q", auto_stem: true});

console.log("layout ...");
score.layout();

console.log("drawing ...");
score.draw();

console.log("done ...");