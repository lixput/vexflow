// [VexFlow](http://vexflow.com) - Copyright (c) Mohit Muthanna 2010.
// MIT License

import { RuntimeError, drawDot } from './util';
import { Flow } from './flow';
import { Tickable } from './tickable';
import { Stroke } from './strokes';
import { Stave } from './stave';
import { Voice } from './voice';
import { TickContext } from './tickcontext';
import { ModifierContext } from './modifiercontext';
import { Modifier } from './modifier';
import { KeyProps, RenderContext } from './types/common';
import { GlyphProps } from './glyph';
import { Fraction } from './fraction';
import { Beam } from './beam';

export interface NoteMetrics {
  /** The total width of the note (including modifiers). */
  width: number;
  glyphWidth?: number;
  /** The width of the note head only. */
  notePx: number;
  /** Start `X` for left modifiers. */
  modLeftPx: number;
  /** Start `X` for right modifiers. */
  modRightPx: number;
  /** Extra space on left of note. */
  leftDisplacedHeadPx: number;
  glyphPx: number;
  /** Extra space on right of note. */
  rightDisplacedHeadPx: number;
}

export interface NoteDuration {
  duration: string;
  dots: number;
  type: string;
}

export interface NoteRenderOptions {
  draw_stem_through_stave?: boolean;
  draw_dots?: boolean;
  draw_stem?: boolean;
  y_shift: number;
  extend_left?: number;
  extend_right?: number;
  glyph_font_scale: number;
  annotation_spacing: number;
  glyph_font_size?: number;
  scale: number;
  font: string;
  stroke_px: number;
}

export interface ParsedNote {
  duration: string;
  type: string;
  customTypes: string[];
  dots: number;
  ticks: number;
}

export interface NoteStruct {
  line?: number;
  /** The number of dots, which affects the duration. */
  dots?: number;
  keys?: string[];
  /** The note type (e.g., `r` for rest, `s` for slash notes, etc.). */
  type?: string;
  align_center?: boolean;
  duration_override?: Fraction;
  /** The time length (e.g., `q` for quarter, `h` for half, `8` for eighth etc.). */
  duration: string;
}

/**
 * Note implements an abstract interface for notes and chords that
 * are rendered on a stave. Notes have some common properties: All of them
 * have a value (e.g., pitch, fret, etc.) and a duration (quarter, half, etc.)
 *
 * Some notes have stems, heads, dots, etc. Most notational elements that
 * surround a note are called *modifiers*, and every note has an associated
 * array of them. All notes also have a rendering context and belong to a stave.
 */
export abstract class Note extends Tickable {
  keys: string[];
  keyProps: KeyProps[];

  protected stave?: Stave;
  render_options: NoteRenderOptions;
  protected duration: string;
  protected dots: number;
  protected leftDisplacedHeadPx: number;
  protected rightDisplacedHeadPx: number;
  protected noteType: string;
  protected customGlyphs: GlyphProps[];
  protected ys: number[];
  // eslint-disable-next-line
  protected glyph?: any;
  protected customTypes: string[];
  protected playNote?: Note;
  protected beam?: Beam;

  static get CATEGORY(): string {
    return 'note';
  }

  /** Debug helper. Displays various note metrics for the given
   * note.
   */
  static plotMetrics(ctx: RenderContext, note: Note, yPos: number): void {
    const metrics = note.getMetrics();
    const xStart = note.getAbsoluteX() - metrics.modLeftPx - metrics.leftDisplacedHeadPx;
    const xPre1 = note.getAbsoluteX() - metrics.leftDisplacedHeadPx;
    const xAbs = note.getAbsoluteX();
    const xPost1 = note.getAbsoluteX() + metrics.notePx;
    const xPost2 = note.getAbsoluteX() + metrics.notePx + metrics.rightDisplacedHeadPx;
    const xEnd = note.getAbsoluteX() + metrics.notePx + metrics.rightDisplacedHeadPx + metrics.modRightPx;
    const xFreedomRight = xEnd + (note.getFormatterMetrics().freedom.right || 0);

    const xWidth = xEnd - xStart;
    ctx.save();
    ctx.setFont('Arial', 8, '');
    ctx.fillText(Math.round(xWidth) + 'px', xStart + note.getXShift(), yPos);

    const y = yPos + 7;
    function stroke(x1: number, x2: number, color: string, yy: number = y) {
      ctx.beginPath();
      ctx.setStrokeStyle(color);
      ctx.setFillStyle(color);
      ctx.setLineWidth(3);
      ctx.moveTo(x1 + note.getXShift(), yy);
      ctx.lineTo(x2 + note.getXShift(), yy);
      ctx.stroke();
    }

    stroke(xStart, xPre1, 'red');
    stroke(xPre1, xAbs, '#999');
    stroke(xAbs, xPost1, 'green');
    stroke(xPost1, xPost2, '#999');
    stroke(xPost2, xEnd, 'red');
    stroke(xEnd, xFreedomRight, '#DD0');
    stroke(xStart - note.getXShift(), xStart, '#BBB'); // Shift
    drawDot(ctx, xAbs + note.getXShift(), y, 'blue');

    const formatterMetrics = note.getFormatterMetrics();
    if (formatterMetrics.iterations > 0) {
      const spaceDeviation = formatterMetrics.space.deviation;
      const prefix = spaceDeviation >= 0 ? '+' : '';
      ctx.setFillStyle('red');
      ctx.fillText(prefix + Math.round(spaceDeviation), xAbs + note.getXShift(), yPos - 10);
    }
    ctx.restore();
  }

  protected static parseDuration(durationString: string): NoteDuration | undefined {
    const regexp = /(\d*\/?\d+|[a-z])(d*)([nrhms]|$)/;
    const result = regexp.exec(durationString);
    if (!result) {
      return undefined;
    }

    const duration = result[1];
    const dots = result[2].length;
    const type = result[3] || 'n';

    return { duration, dots, type };
  }

  protected static parseNoteStruct(noteStruct: NoteStruct): ParsedNote | undefined {
    const durationString = noteStruct.duration;
    const customTypes: string[] = [];

    // Preserve backwards-compatibility
    const durationProps = Note.parseDuration(durationString);
    if (!durationProps) {
      return undefined;
    }

    // If specified type is invalid, return undefined
    let type = noteStruct.type;
    if (type && !Flow.validTypes[type]) {
      return undefined;
    }

    // If no type specified, check duration or custom types
    if (!type) {
      type = durationProps.type || 'n';

      // If we have keys, try and check if we've got a custom glyph
      if (noteStruct.keys !== undefined) {
        noteStruct.keys.forEach((k, i) => {
          const result = k.split('/');
          // We have a custom glyph specified after the note eg. /X2
          customTypes[i] = (result && result.length === 3 ? result[2] : type) as string;
        });
      }
    }

    // Calculate the tick duration of the note
    let ticks = Flow.durationToTicks(durationProps.duration);
    if (!ticks) {
      return undefined;
    }

    // Are there any dots?
    const dots = noteStruct.dots ? noteStruct.dots : durationProps.dots;
    if (typeof dots !== 'number') {
      return undefined;
    }

    // Add ticks as necessary depending on the numbr of dots
    let currentTicks = ticks;
    for (let i = 0; i < dots; i++) {
      if (currentTicks <= 1) return undefined;

      currentTicks = currentTicks / 2;
      ticks += currentTicks;
    }

    return {
      duration: durationProps.duration,
      type,
      customTypes,
      dots,
      ticks,
    };
  }

  /**
   * Every note is a tickable, i.e., it can be mutated by the `Formatter` class for
   * positioning and layout.
   * To create a new note you need to provide a `noteStruct`.
   */
  constructor(noteStruct: NoteStruct) {
    super();
    this.setAttribute('type', 'Note');

    if (!noteStruct) {
      throw new RuntimeError('BadArguments', 'Note must have valid initialization data to identify duration and type.');
    }

    /** Parses `noteStruct` and get note properties. */
    const initStruct = Note.parseNoteStruct(noteStruct);
    if (!initStruct) {
      throw new RuntimeError('BadArguments', `Invalid note initialization object: ${JSON.stringify(noteStruct)}`);
    }

    // Set note properties from parameters.
    this.keys = noteStruct.keys || [];
    // per-pitch properties
    this.keyProps = [];

    this.duration = initStruct.duration;
    this.dots = initStruct.dots;
    this.noteType = initStruct.type;
    this.customTypes = initStruct.customTypes;

    if (noteStruct.duration_override) {
      // Custom duration
      this.setDuration(noteStruct.duration_override);
    } else {
      // Default duration
      this.setIntrinsicTicks(initStruct.ticks);
    }

    this.modifiers = [];

    // Get the glyph code for this note from the font.
    this.glyph = Flow.getGlyphProps(this.duration, this.noteType);
    this.customGlyphs = this.customTypes.map((t) => Flow.getGlyphProps(this.duration, t));

    // Note to play for audio players.
    this.playNote = undefined;

    // Positioning contexts used by the Formatter.
    this.ignore_ticks = false;

    // Positioning variables
    this.width = 0; // Width in pixels calculated after preFormat
    this.leftDisplacedHeadPx = 0; // Extra room on left for displaced note head
    this.rightDisplacedHeadPx = 0; // Extra room on right for displaced note head
    this.x_shift = 0; // X shift from tick context X
    this.preFormatted = false; // Is this note preFormatted?
    this.ys = []; // list of y coordinates for each note
    // we need to hold on to these for ties and beams.

    if (noteStruct.align_center) {
      this.setCenterAlignment(noteStruct.align_center);
    }

    // The render surface.
    this.render_options = {
      annotation_spacing: 5,
      glyph_font_scale: 1,
      stroke_px: 1,
      scale: 1,
      font: '',
      y_shift: 0,
    };
  }

  /**
   * Get the play note, which is arbitrary data that can be used by an
   * audio player.
   */
  getPlayNote(): Note | undefined {
    return this.playNote;
  }

  /**
   * Set the play note, which is arbitrary data that can be used by an
   * audio player.
   */
  setPlayNote(note: Note): this {
    this.playNote = note;
    return this;
  }

  /**
   * Don't play notes by default, call them rests. This is also used by things like
   * beams and dots for positioning.
   */
  isRest(): boolean {
    return false;
  }

  /** Add stroke. */
  addStroke(index: number, stroke: Stroke): this {
    stroke.setNote(this);
    stroke.setIndex(index);
    this.modifiers.push(stroke);
    this.setPreFormatted(false);
    return this;
  }

  /** Get the target stave. */
  getStave(): Stave | undefined {
    return this.stave;
  }

  /** Check and get the target stave. */
  checkStave(): Stave {
    if (!this.stave) {
      throw new RuntimeError('NoStave', 'No stave attached to instance');
    }
    return this.stave;
  }

  /** Set the target stave. */
  setStave(stave: Stave): this {
    this.stave = stave;
    this.setYs([stave.getYForLine(0)]); // Update Y values if the stave is changed.
    this.setContext(this.stave.getContext());
    return this;
  }

  /**
   * `Note` is not really a modifier, but is used in
   * a `ModifierContext`.
   */
  getCategory(): string {
    return Note.CATEGORY;
  }

  /** Get spacing to the left of the notes. */
  getLeftDisplacedHeadPx(): number {
    return this.leftDisplacedHeadPx;
  }

  /** Get spacing to the right of the notes. */
  getRightDisplacedHeadPx(): number {
    return this.rightDisplacedHeadPx;
  }

  /** Set spacing to the left of the notes. */
  setLeftDisplacedHeadPx(x: number): this {
    this.leftDisplacedHeadPx = x;
    return this;
  }

  /** Set spacing to the right of the notes. */
  setRightDisplacedHeadPx(x: number): this {
    this.rightDisplacedHeadPx = x;
    return this;
  }

  /** True if this note has no duration (e.g., bar notes, spacers, etc.). */
  shouldIgnoreTicks(): boolean {
    return this.ignore_ticks;
  }

  /** Get the stave line number for the note. */
  // eslint-disable-next-line
  getLineNumber(isTopNote?: boolean): number {
    return 0;
  }

  /** Get the stave line number for rest. */
  getLineForRest(): number {
    return 0;
  }

  /** Get the glyph associated with this note. */
  // eslint-disable-next-line
  getGlyph(): any {
    return this.glyph;
  }

  /** Get the glyph width. */
  getGlyphWidth(): number {
    // TODO: FIXME (multiple potential values for this.glyph)
    if (this.glyph) {
      if (this.glyph.getMetrics) {
        return this.glyph.getMetrics().width;
      } else if (this.glyph.getWidth) {
        return this.glyph.getWidth(this.render_options.glyph_font_scale);
      }
    }

    return 0;
  }

  /**
   * Set Y positions for this note. Each Y value is associated with
   * an individual pitch/key within the note/chord.
   */
  setYs(ys: number[]): this {
    this.ys = ys;
    return this;
  }

  /**
   * Get Y positions for this note. Each Y value is associated with
   * an individual pitch/key within the note/chord.
   */
  getYs(): number[] {
    if (this.ys.length === 0) {
      throw new RuntimeError('NoYValues', 'No Y-values calculated for this note.');
    }

    return this.ys;
  }

  /**
   * Get the Y position of the space above the stave onto which text can
   * be rendered.
   */
  getYForTopText(text_line: number): number {
    return this.checkStave().getYForTopText(text_line);
  }

  /** Return the voice that this note belongs in. */
  getVoice(): Voice {
    if (!this.voice) throw new RuntimeError('NoVoice', 'Note has no voice.');
    return this.voice;
  }

  /** Attache this note to `voice`. */
  setVoice(voice: Voice): this {
    this.voice = voice;
    this.preFormatted = false;
    return this;
  }

  /** Get the `TickContext` for this note. */
  getTickContext(): TickContext {
    if (!this.tickContext) throw new RuntimeError('NoTickContext', 'Note has no tick context.');
    return this.tickContext;
  }

  /** Set the `TickContext` for this note. */
  setTickContext(tc: TickContext): this {
    this.tickContext = tc;
    this.preFormatted = false;
    return this;
  }

  /** Accessor to duration. */
  getDuration(): string {
    return this.duration;
  }

  /** Accessor to isDotted. */
  isDotted(): boolean {
    return this.dots > 0;
  }

  /** Accessor to hasStem. */
  hasStem(): boolean {
    return false;
  }

  /** Accessor to note type. */
  getNoteType(): string {
    return this.noteType;
  }

  /** Get the beam. */
  getBeam(): Beam | undefined {
    return this.beam;
  }

  /** Check and get the beam. */
  checkBeam(): Beam {
    if (!this.beam) {
      throw new RuntimeError('NoBeam', 'No beam attached to instance');
    }
    return this.beam;
  }

  /** Check it has a beam. */
  hasBeam(): boolean {
    return this.beam != undefined;
  }

  /** Set the beam. */
  setBeam(beam: Beam): this {
    this.beam = beam;
    return this;
  }

  /** Attach this note to a modifier context. */
  setModifierContext(mc?: ModifierContext): this {
    this.modifierContext = mc;
    return this;
  }

  /** Attach a modifier to this note. */
  addModifier(a: number | Modifier, b: number | Modifier = 0): this {
    let index: number;
    let modifier: Modifier;

    if (typeof a === 'object' && typeof b === 'number') {
      index = b;
      modifier = a;
    } else {
      throw new RuntimeError(
        'WrongParams',
        'Call signature to addModifier not supported, use addModifier(modifier, index) instead.'
      );
    }
    modifier.setNote(this);
    modifier.setIndex(index);
    this.modifiers.push(modifier);
    this.setPreFormatted(false);
    return this;
  }

  /** Get the coordinates for where modifiers begin. */
  // eslint-disable-next-line
  getModifierStartXY(position?: number, index?: number, options?: any): { x: number; y: number } {
    if (!this.preFormatted) {
      throw new RuntimeError('UnformattedNote', "Can't call GetModifierStartXY on an unformatted note");
    }

    return {
      x: this.getAbsoluteX(),
      y: this.ys[0],
    };
  }

  /** Get the metrics for this note. */
  getMetrics(): NoteMetrics {
    if (!this.preFormatted) {
      throw new RuntimeError('UnformattedNote', "Can't call getMetrics on an unformatted note.");
    }

    const modLeftPx = this.modifierContext ? this.modifierContext.state.left_shift : 0;
    const modRightPx = this.modifierContext ? this.modifierContext.state.right_shift : 0;
    const width = this.getWidth();
    const glyphWidth = this.getGlyphWidth();
    const notePx =
      width -
      modLeftPx - // subtract left modifiers
      modRightPx - // subtract right modifiers
      this.leftDisplacedHeadPx - // subtract left displaced head
      this.rightDisplacedHeadPx; // subtract right displaced head

    return {
      // ----------
      // NOTE: If you change this, remember to update MockTickable in the tests/ directory.
      // --------------
      width,
      glyphWidth,
      notePx,

      // Modifier spacing.
      modLeftPx,
      modRightPx,

      // Displaced note head on left or right.
      leftDisplacedHeadPx: this.leftDisplacedHeadPx,
      rightDisplacedHeadPx: this.rightDisplacedHeadPx,
      glyphPx: 0,
    };
  }

  /**
   * Get the absolute `X` position of this note's tick context. This
   * excludes x_shift, so you'll need to factor it in if you're
   * looking for the post-formatted x-position.
   */
  getAbsoluteX(): number {
    if (!this.tickContext) {
      throw new RuntimeError('NoTickContext', 'Note needs a TickContext assigned for an X-Value');
    }

    // Position note to left edge of tick context.
    let x = this.tickContext.getX();
    if (this.stave) {
      x += this.stave.getNoteStartX() + this.musicFont.lookupMetric('stave.padding');
    }

    if (this.isCenterAligned()) {
      x += this.getCenterXShift();
    }

    return x;
  }

  /** Set preformatted status. */
  setPreFormatted(value: boolean): void {
    this.preFormatted = value;
  }

  /** Get the direction of the stem. */
  getStemDirection(): number {
    throw new RuntimeError('NoStem', 'No stem attached to this note.');
  }

  /** Get the top and bottom `y` values of the stem. */
  getStemExtents(): Record<string, number> {
    throw new RuntimeError('NoStem', 'No stem attached to this note.');
  }

  /** Get the `x` coordinate to the right of the note. */
  getTieRightX(): number {
    let tieStartX = this.getAbsoluteX();
    const note_glyph_width = this.glyph.getWidth();
    tieStartX += note_glyph_width / 2;
    tieStartX += -this.width / 2 + this.width + 2;

    return tieStartX;
  }

  /** Get the `x` coordinate to the left of the note. */
  getTieLeftX(): number {
    let tieEndX = this.getAbsoluteX();
    const note_glyph_width = this.glyph.getWidth();
    tieEndX += note_glyph_width / 2;
    tieEndX -= this.width / 2 + 2;

    return tieEndX;
  }
}
