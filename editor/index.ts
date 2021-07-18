import { VirtualScore } from "./virtualscore";

export class Index{
  
  protected score : VirtualScore;
  protected stave : number;
  protected measure : number;
  protected voice : number;

  constructor(score : VirtualScore){
    this.score = score;
    this.stave = 0;
    this.measure = 0;
    this.voice = 0;
  }

  getStave() : number{
    return this.stave;
  }

  getMeasure() : number{
    return this.measure;
  }

  setMeasure(measure : number) : void{
    this.measure = measure;
  }

  setStave(stave : number) : void{
    this.stave = stave;
  }

  getVoice() : number{
    return this.voice;
  }

  setVoice(voice : number) : void{
    this.voice = voice;
  }
}