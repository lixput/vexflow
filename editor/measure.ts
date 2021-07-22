import { Stave } from '../src/stave';
import { StaveNote, StaveNoteStruct } from '../src/stavenote';
import { SVGContext } from '../src/svgcontext';
import { Voice, VoiceTime } from '../src/voice';
import { Flow } from '../src/flow';

export class Measure {

  protected voices : Voice[];
  protected voicetime : VoiceTime;
  protected stave : Stave;
  protected context : SVGContext;
  protected measureNumber : number;
  protected staveNumber : number;
  protected element : SVGGElement;
  protected clef : string;
  protected keySignature : string;
  protected timeSignature : string;

  protected first : boolean = false;
  protected firstInLine : boolean = false;
  protected last : boolean = false;

  constructor(measureNumber : number, staveNumber : number, clef : string, keySignature : string, voicetime : VoiceTime, context : SVGContext){
    this.measureNumber = measureNumber;
    this.staveNumber = staveNumber;
    this.clef = clef;
    this.keySignature = keySignature;
    this.context = context;
    this.voicetime = voicetime;
    this.timeSignature = voicetime.num_beats + "/" + voicetime.beat_value;
    this.voices = [];
    this.stave = new Stave(0, 0, 400, {}).setContext(context);
    this.context = context;
    this.element = this.context.openGroup("init", "init");
    this.context.closeGroup();
  }

  addVoice() : this{
    let v = new Voice(this.voicetime)
      .setContext(this.context)
      .setStave(this.stave)
      .setMode(Voice.Mode.FULL);
    this.voices.push(v);
    return this;
  }

  getNumberOfVoices() : number{
    return this.voices.length;
  }

  addNote(notestruct : StaveNoteStruct, voice : number = 0) : boolean{
    if (voice < 0) return false; //wrong input    
    if (voice >= this.voices.length){ // create new voice
      this.addVoice();
      voice = this.voices.length - 1;
    }

    let note = new StaveNote(notestruct).setContext(this.context).setStave(this.stave); 
   
    //check if voice has enough space
    let ticksUsed = this.voices[voice].getTicksUsed().clone();
    let totalTicks = this.voices[voice].getTotalTicks().clone();
    ticksUsed.add(note.getTicks());

    if (ticksUsed.lessThanEquals(totalTicks)){
      this.voices[voice].addTickable(note);
      this.draw();
      return true;
    }
    else{
      return false;
    }
  }

  setStaveNumber(staveNumber : number) : this{
    this.staveNumber = staveNumber;
    return this;
  }

  getStaveNumber() : number{
    return this.staveNumber;
  }

  setMeasureNumber(measureNumber : number) : this{
    this.measureNumber = measureNumber;
    return this;
  }

  getMeasureNumber() : number{
    return this.measureNumber;
  }

  setX(x: number) : this{
    this.stave.setX(x);
    return this;
  }

  setY(y : number) : this{
    this.stave.setY(y);
    return this;
  }

  setWidth(width: number) : this{
    return this;
  }

  getStave() : Stave{
    return this.stave;
  }

  setFirst(first : boolean = true) : void{
    this.first = first;
    if (first){
      this.stave.addClef(this.clef);
      this.stave.addKeySignature(this.keySignature, '');
      this.stave.addTimeSignature(this.timeSignature);
    }
  }

  isFirst() : boolean{
    return this.first;
  }

  setFirstInLine(first : boolean = true) : void{
    this.firstInLine = first;
    if (first){
      this.stave.addClef(this.clef);
      this.stave.addKeySignature(this.keySignature, '');
    }
  }

  isFirstInLine() : boolean{
    return this.firstInLine;
  }

  setLast(last : boolean = true) : void{
    this.last = last;
    if (last){
      this.stave.setEndBarType(Flow.Barline.type.END);
    }
  }

  isLast() : boolean{
    return this.last;
  }

  draw() : void{

    this.element.remove();

    this.element = this.context.openGroup("measure", "measure-" + this.measureNumber + "-" + this.staveNumber);
    this.stave.draw();

    if (this.voices.length > 0){

      var formatter = new Flow.Formatter().joinVoices(this.voices).format(this.voices, this.stave.getWidth(), {context: this.context});
      this.voices.forEach(v => v.draw());
    }
    this.context.closeGroup();
  }
}