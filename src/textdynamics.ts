// [VexFlow](http://vexflow.com) - Copyright (c) Mohit Muthanna 2010.
// MIT License

import { RuntimeError, log, check } from './util';
import { Note } from './note';
import { Glyph } from './glyph';
import { TextNoteStruct } from './textnote';

// eslint-disable-next-line
function L(...args: any[]) {
  if (TextDynamics.DEBUG) log('Vex.Flow.TextDynamics', args);
}

/**
 * `TextDynamics` renders traditional
 * text dynamics markings, **ie: p, f, sfz, rfz, ppp**
 *
 * You can render any dynamics string that contains a combination of
 * the following letters:  P, M, F, Z, R, S
 */
export class TextDynamics extends Note {
  /** To enable logging for this class. Set `Vex.Flow.TextDynamics.DEBUG` to `true`. */
  static DEBUG: boolean;

  protected sequence: string;

  protected line: number;
  protected glyphs: Glyph[];

  /** The glyph data for each dynamics letter. */
  static get GLYPHS(): Record<string, { code: string; width: number }> {
    return {
      f: {
        code: 'dynamicForte',
        width: 12,
      },
      p: {
        code: 'dynamicPiano',
        width: 14,
      },
      m: {
        code: 'dynamicMezzo',
        width: 17,
      },
      s: {
        code: 'dynamicSforzando',
        width: 10,
      },
      z: {
        code: 'dynamicZ',
        width: 12,
      },
      r: {
        code: 'dynamicRinforzando',
        width: 12,
      },
    };
  }

  /**
   * A `TextDynamics` object inherits from `Note` so that it can be formatted
   * within a `Voice`.
   * Create the dynamics marking. `text_struct` is an object
   * that contains a `duration` property and a `sequence` of
   * letters that represents the letters to render
   */
  constructor(text_struct: TextNoteStruct) {
    super(text_struct);
    this.setAttribute('type', 'TextDynamics');

    this.sequence = text_struct.text.toLowerCase();
    this.line = text_struct.line || 0;
    this.glyphs = [];

    this.render_options = {
      ...this.render_options,
      ...{
        glyph_font_size: 40,
      },
    };

    L('New Dynamics Text: ', this.sequence);
  }

  /** Set the Stave line on which the note should be placed. */
  setLine(line: number): this {
    this.line = line;
    return this;
  }

  /** Preformat the dynamics text. */
  preFormat(): this {
    let total_width = 0;
    // Iterate through each letter
    this.sequence.split('').forEach((letter) => {
      // Get the glyph data for the letter
      const glyph_data = TextDynamics.GLYPHS[letter];
      if (!glyph_data) throw new RuntimeError('Invalid dynamics character: ' + letter);

      const size = check<number>(this.render_options.glyph_font_size);
      const glyph = new Glyph(glyph_data.code, size, { category: 'textNote' });

      // Add the glyph
      this.glyphs.push(glyph);

      total_width += glyph_data.width;
    });

    // Store the width of the text
    this.setWidth(total_width);
    this.preFormatted = true;
    return this;
  }

  /** Draw the dynamics text on the rendering context. */
  draw(): void {
    this.setRendered();
    const x = this.getAbsoluteX();
    const y = this.checkStave().getYForLine(this.line + -3);

    L('Rendering Dynamics: ', this.sequence);

    let letter_x = x;
    this.glyphs.forEach((glyph, index) => {
      const current_letter = this.sequence[index];
      glyph.render(this.checkContext(), letter_x, y);
      letter_x += TextDynamics.GLYPHS[current_letter].width;
    });
  }
}
