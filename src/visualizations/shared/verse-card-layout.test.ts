import { describe, expect, it } from 'vitest';
import { arcsGeometry, fitText, genreBands, wrapText } from './verse-card-layout.ts';

/** Every glyph half an em wide, which makes the arithmetic in these tests readable. */
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.5;

describe('wrapText', () => {
  it('fills each line and breaks before the word that would overflow', () => {
    // At 10px a character is 5px, so 60px holds twelve characters.
    expect(wrapText('one two three four', 10, 60, measure)).toEqual(['one two', 'three four']);
  });

  it('leaves a word longer than the line to overhang rather than breaking it', () => {
    expect(wrapText('Rechtsschutzversicherung', 10, 40, measure)).toEqual([
      'Rechtsschutzversicherung',
    ]);
  });

  it('puts a long word on a line of its own', () => {
    expect(wrapText('a Rechtsschutzversicherung b', 10, 40, measure)).toEqual([
      'a',
      'Rechtsschutzversicherung',
      'b',
    ]);
  });

  it('treats runs of any whitespace as one break, and nothing as nothing', () => {
    expect(wrapText('one \n\t two', 10, 400, measure)).toEqual(['one two']);
    expect(wrapText('   ', 10, 100, measure)).toEqual([]);
  });
});

describe('fitText', () => {
  const sizes = [40, 20, 10];

  it('takes the largest size on the scale that still fits the box', () => {
    // 'one two' is 7 characters: 140px at 40, 70px at 20. The box is 100px wide and one line deep.
    const fitted = fitText({
      text: 'one two',
      sizes,
      maxWidth: 100,
      maxHeight: 30,
      lineHeight: 1.5,
      measure,
    });
    expect(fitted.fontSize).toBe(20);
    expect(fitted.lines).toEqual(['one two']);
  });

  it('keeps the whole verse at the smallest size rather than refusing to set it', () => {
    const fitted = fitText({
      text: 'a '.repeat(80),
      sizes,
      maxWidth: 20,
      maxHeight: 10,
      lineHeight: 1.5,
      measure,
    });
    expect(fitted.fontSize).toBe(10);
    expect(fitted.lines.length).toBeGreaterThan(1);
  });

  it('uses the first size when everything fits', () => {
    const fitted = fitText({
      text: 'hi',
      sizes,
      maxWidth: 1000,
      maxHeight: 1000,
      lineHeight: 1.5,
      measure,
    });
    expect(fitted.fontSize).toBe(40);
  });
});

describe('genreBands', () => {
  it('collects each run of one genre, including the last', () => {
    expect(genreBands(new Uint8Array([0, 0, 1, 1, 1, 2]))).toEqual([
      { start: 0, end: 1, genre: 0 },
      { start: 2, end: 4, genre: 1 },
      { start: 5, end: 5, genre: 2 },
    ]);
  });

  it('gives one band for one genre throughout', () => {
    expect(genreBands(new Uint8Array([3, 3, 3]))).toEqual([{ start: 0, end: 2, genre: 3 }]);
  });

  it('has nothing to say about no verses', () => {
    expect(genreBands(new Uint8Array())).toEqual([]);
  });
});

describe('arcsGeometry', () => {
  const verseGenres = new Uint8Array([0, 1, 2, 3]);

  it('places the verse along the line in proportion to where it falls in the Bible', () => {
    const { verseX } = arcsGeometry({
      verse: 2,
      targets: [],
      verseGenres,
      totalVerses: 4,
      left: 0,
      right: 100,
      maxRise: 50,
    });
    expect(verseX).toBe(50);
  });

  it('colors each arc by the genre it lands in, and starts them all at the verse', () => {
    const { arcs } = arcsGeometry({
      verse: 0,
      targets: [1, 3],
      verseGenres,
      totalVerses: 4,
      left: 0,
      right: 100,
      maxRise: 50,
    });
    expect(arcs.map((arc) => arc.genre)).toEqual([1, 3]);
    expect(arcs.map((arc) => arc.toX)).toEqual([25, 75]);
    expect(new Set(arcs.map((arc) => arc.fromX))).toEqual(new Set([0]));
  });

  it('makes a longer link arch higher, up to a cap that keeps it on the card', () => {
    const { arcs } = arcsGeometry({
      verse: 0,
      targets: [1, 3],
      verseGenres,
      totalVerses: 4,
      left: 0,
      right: 100,
      maxRise: 20,
    });
    const [near, far] = arcs;
    expect(Math.abs(near?.controlY ?? 0)).toBeLessThan(Math.abs(far?.controlY ?? 0));
    for (const arc of arcs) {
      expect(Math.abs(arc.controlY) / 2).toBeLessThanOrEqual(20);
    }
  });

  it('falls back to the first genre for a target off the end of the list', () => {
    const { arcs } = arcsGeometry({
      verse: 0,
      targets: [99],
      verseGenres,
      totalVerses: 100,
      left: 0,
      right: 100,
      maxRise: 20,
    });
    expect(arcs[0]?.genre).toBe(0);
  });
});
