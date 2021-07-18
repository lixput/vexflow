import { Index } from "./index";
import { VoiceTime } from "../src/voice";
import { Flow } from "../src/flow";
import { StaveNoteStruct } from "../src/stavenote";
import { Measure } from "./measure";
import { SVGContext } from "../src/svgcontext";

export class VirtualScore {

  protected measureMatrix : Measure[][];
  protected clefs : string[] = [];
  
  protected numberOfMeasures : number;
  protected connectStaves : boolean;
  protected keySignature : string;

  protected voiceTime: VoiceTime;
  protected timeSignature : string;
  
  protected index : Index;
  protected context : SVGContext;

  protected xLeft = 10;
  protected yTop = 10;
  protected measureWidth = 400;
  protected rendererWidth = 1500;
  protected rendererHeight = 500;
  protected spaceBetweenStaves = 100;
  protected spaceBetweenSystems = 50;

  constructor(
    numberOfStaves : number, 
    numberOfMeasures : number, 
    keySignature : string, 
    num_beats : number, 
    beat_value : number, 
    connectStaves : boolean, 
    id : string
  ){

    this.numberOfMeasures = numberOfMeasures;
    this.keySignature = keySignature;
    this.timeSignature = num_beats + "/" + beat_value;
    this.voiceTime = {num_beats: num_beats, beat_value: beat_value, resolution: Flow.RESOLUTION}; 

    let renderer = new Flow.Renderer(id, Flow.Renderer.Backends.SVG);
    renderer.resize(this.rendererWidth, this.rendererHeight);
    this.context = renderer.getContext() as SVGContext;

    
    this.measureMatrix = [];
    for (let measure = 0; measure<numberOfMeasures; measure++){
      this.measureMatrix[measure] = [];
      for (let stave = 0; stave<numberOfStaves; stave++){
        this.measureMatrix[measure][stave] = new Measure(stave, measure, "treble", this.keySignature, this.voiceTime, this.context);
      }
    }

    this.connectStaves = connectStaves;

    this.index = new Index(this);
  }

  getVoiceTime() : VoiceTime{
    return this.voiceTime;
  }

  getKeySignature() : string {
    return this.keySignature;
  }

  getTimeSignature() : string {
    return this.timeSignature;
  }

  getClef(stave : number) : string{
    if (stave < 0 || stave >= this.clefs.length) return "none";
    return this.clefs[stave];
  }

  setClef(stave : number, clef : string) : void{
    if (stave < 0 || stave >= this.clefs.length) return;
    this.clefs[stave] = clef;
  }

  getNumberOfMeasures() : number{
    return this.measureMatrix.length;
  }

  getNumberOfStaves() : number{
    let max = 1;
    for (let i = 0; i < this.measureMatrix.length; i++){
      max = Math.max(max, this.measureMatrix[i].length);
    }
    return max;
  }

  getConnectStaves() : boolean{
    return this.connectStaves;
  }

  addNoteAtIndex(noteStruct : StaveNoteStruct) : void {
    let indexMeasure = this.measureMatrix[this.index.getMeasure()][this.index.getStave()]
    if (!indexMeasure.addNote(noteStruct, this.index.getVoice())){
      if (this.moveIndex(1, 0)){
        let indexMeasure = this.measureMatrix[this.index.getMeasure()][this.index.getStave()]
        indexMeasure.addNote(noteStruct, this.index.getVoice());
      }
    }
  }

  getIndex() : Index {
    return this.index;
  }

  setIndex(measure : number, stave : number){
    this.index.setMeasure(measure);
    this.index.setStave(stave);
  }

  moveIndex(measureOffset : number, staveOffset : number) : boolean{
    let newMeasureIndex = this.index.getMeasure() + measureOffset;
    let newStaveIndex = this.index.getStave() + staveOffset;
    
    if (newMeasureIndex < 0 || newMeasureIndex >= this.getNumberOfMeasures()) return false;
    if (newStaveIndex < 0 || newStaveIndex >= this.getNumberOfStaves()) return false;

    this.setIndex(newMeasureIndex, newStaveIndex);
    return true;
  }

  layout() : void{
    
    let numStaves = this.getNumberOfStaves();
    let numMeasures = this.getNumberOfMeasures();
    
    let showClef = true;
    let showKeySignature = true;
    let showTimeSignature = true;
    let showEndline = false;

    let firstInLine = false;

    let xRight = this.xLeft;
    let yBottom = this.yTop;
    
    for (let m = 0; m < this.measureMatrix.length; m++){
      if (m == 0){
        //first measure
        showClef = true;
        showKeySignature = true;
        showTimeSignature = true;
        firstInLine = true;

      }
      else if (xRight + this.measureWidth > this.rendererWidth){
        //line break
        firstInLine = true;
        xRight = this.xLeft;
        yBottom += numStaves * this.spaceBetweenStaves + this.spaceBetweenSystems;
        showClef = true;
        showKeySignature = true;
        showTimeSignature = false;
      }
      else{
        //normal measure
        showClef = false;
        showKeySignature = false;
        showTimeSignature = false;
      }

      if (m == numMeasures - 1){
        showEndline = true;
      }

      let measureY = yBottom;

      //Layout stave by stave
      for (let s = 0; s<numStaves; s++){
        let measure = this.measureMatrix[m][s];
        measure.setFirstInLine(firstInLine);
        measure.setLast(showEndline);
        measure.setX(xRight);
        measure.setY(measureY);
        measure.setWidth(this.measureWidth);
        measure.showClef(showClef);
        measure.showKeySignature(showKeySignature);
        measure.showTimeSignature(showTimeSignature);

        measureY += this.spaceBetweenStaves;
      }

      xRight += this.measureWidth;
    }
  }

  drawConnectors(measure1 : Measure, measure2 : Measure, left : boolean, right : boolean){
    if (left){
      var connectorLeft = new Flow.StaveConnector(measure1.getStave(), measure2.getStave());
      connectorLeft.setType(Flow.StaveConnector.type.SINGLE_LEFT);
      connectorLeft.setContext(this.context);
      connectorLeft.draw();
    }
    if (right){
      var connectorRight = new Flow.StaveConnector(measure1.getStave(), measure2.getStave());
      connectorRight.setType(Flow.StaveConnector.type.SINGLE_RIGHT);
      connectorRight.setContext(this.context);
      connectorRight.draw();
    }
  }

  drawEndline(measure1 : Measure, measure2 : Measure){
    let endline = new Flow.StaveConnector(measure1.getStave(), measure2.getStave());
    endline.setType(Flow.StaveConnector.type.BOLD_DOUBLE_RIGHT);
    endline.setContext(this.context);
    endline.draw();
  }

  draw() : void{
    let numMeasures = this.getNumberOfMeasures();
    let connectRight = this.connectStaves;
    let connectLeft = this.connectStaves;
    let showEndline = false;

    for (let m = 0; m<numMeasures; m++){
      let measure = this.measureMatrix[m][0];
      connectLeft = measure.isFirstInLine();
      showEndline = measure.isLast();
      for (let s = 0; s<this.measureMatrix[m].length; s++){
        measure = this.measureMatrix[m][s];
        measure.draw();
      }
      this.drawConnectors(this.measureMatrix[m][0], measure, connectLeft, connectRight);
      if (connectRight && showEndline) this.drawEndline(this.measureMatrix[m][0], measure);
    }
  }
}