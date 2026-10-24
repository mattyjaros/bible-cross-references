import { describe, expect, it } from 'vitest';
import { CARD_HEIGHT, CARD_WIDTH, paintVerseCard, type VerseCardInput } from './verse-card.ts';

/**
 * A canvas that writes down what it was asked to draw instead of drawing it.
 *
 * The card is the one thing the app produces that leaves it — once a verse is in somebody's
 * WhatsApp there is no fixing it — and three of the things on it are not decoration: the verse,
 * the attribution the licences require, and the address that brings a reader back. A recording
 * context is how those can be asserted without a GPU, and it is testing the painter rather than
 * the mock, because what is asserted is the text and the colors it was given.
 */
interface Painted {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly fill: string;
  readonly align: string;
  readonly spacing: string;
}

interface Curve {
  readonly from: readonly [number, number];
  readonly control: readonly [number, number];
  readonly to: readonly [number, number];
  readonly stroke: string;
  readonly alpha: number;
}

function recordingContext() {
  const painted: Painted[] = [];
  const curves: Curve[] = [];
  /** The logo is drawn with curves too, inside a transform; it is not a cross-reference. */
  const markCurves: Curve[] = [];
  let inTransform = 0;
  let transforms = 0;
  const lines: { from: [number, number]; to: [number, number]; stroke: string; width: number }[] =
    [];
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  const arcs: { x: number; y: number; r: number; fill: string }[] = [];
  let at: [number, number] = [0, 0];
  let pending: Curve | null = null;
  let pendingLine: { from: [number, number]; to: [number, number] } | null = null;
  let pendingArc: { x: number; y: number; r: number } | null = null;

  const context = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    letterSpacing: '0px',
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: context.fillStyle });
    },
    fillText(text: string, x: number, y: number) {
      painted.push({
        text,
        x,
        y,
        font: context.font,
        fill: context.fillStyle,
        align: context.textAlign,
        spacing: context.letterSpacing,
      });
    },
    // Width proportional to the size in `font`, so the type scale is exercised for real.
    measureText(text: string) {
      const size = Number(/(\d+)px/u.exec(context.font)?.[1] ?? 10);
      return { width: text.length * size * 0.5 };
    },
    beginPath() {
      pending = null;
      pendingLine = null;
      pendingArc = null;
    },
    moveTo(x: number, y: number) {
      at = [x, y];
      pendingLine = { from: [x, y], to: [x, y] };
    },
    lineTo(x: number, y: number) {
      if (pendingLine) pendingLine.to = [x, y];
      at = [x, y];
    },
    quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
      pending = {
        from: at,
        control: [cx, cy],
        to: [x, y],
        stroke: context.strokeStyle,
        alpha: context.globalAlpha,
      };
      at = [x, y];
    },
    arc(x: number, y: number, r: number) {
      pendingArc = { x, y, r };
    },
    closePath() {
      pendingLine = null;
    },
    save() {
      inTransform += 1;
    },
    restore() {
      inTransform -= 1;
    },
    translate() {
      transforms += 1;
    },
    scale() {
      transforms += 1;
    },
    stroke() {
      if (pending) {
        (inTransform > 0 ? markCurves : curves).push(pending);
        pending = null;
      } else if (pendingLine) {
        lines.push({ ...pendingLine, stroke: context.strokeStyle, width: context.lineWidth });
        pendingLine = null;
      }
    },
    fill() {
      if (pendingArc) {
        arcs.push({ ...pendingArc, fill: context.fillStyle });
      }
    },
  };
  return { context, painted, curves, markCurves, lines, rects, arcs, transforms: () => transforms };
}

const GENRE_HEX = ['#e2679c', '#e0763c', '#d8b945', '#b86fc4', '#3ba894', '#5590d6'];
/** Six verses, one per genre, so a target's color is unambiguous in the assertions. */
const VERSE_GENRES = new Uint8Array([0, 1, 2, 3, 4, 5]);

function anInput(over: Partial<VerseCardInput> = {}): VerseCardInput {
  return {
    reference: 'Psalm 16:8',
    localeTag: 'en',
    landmarks: [
      { label: 'Gen', verse: 0, genre: 0 },
      { label: 'Acts', verse: 4, genre: 4 },
    ],
    testamentAt: 3,
    text: 'I have set the LORD always before me.',
    verse: 2,
    targets: [0, 4, 5],
    verseGenres: VERSE_GENRES,
    totalVerses: 6,
    genreHex: GENRE_HEX,
    countLabel: '3 cross-references',
    attribution: 'Berean Standard Bible (BSB) · Public domain',
    site: 'trekhleb.dev/bible-cross-references',
    ...over,
  };
}

function paint(over: Partial<VerseCardInput> = {}) {
  const recorder = recordingContext();
  paintVerseCard(recorder.context as unknown as CanvasRenderingContext2D, anInput(over));
  return recorder;
}

const said = (painted: readonly Painted[]) => painted.map((one) => one.text);

describe('what the card says', () => {
  it('carries the attribution the licence asks for', () => {
    const { painted } = paint();
    expect(said(painted)).toContain('Berean Standard Bible (BSB) · Public domain');
  });

  it('carries a different text’s attribution, rather than a baked-in one', () => {
    const { painted } = paint({ attribution: 'Bíblia Livre (BLIVRE) · CC BY 3.0 BR' });
    expect(said(painted)).toContain('Bíblia Livre (BLIVRE) · CC BY 3.0 BR');
    expect(said(painted)).not.toContain('Berean Standard Bible (BSB) · Public domain');
  });

  it('names the verse, in the reader’s own language and in capitals', () => {
    expect(said(paint({ reference: 'João 3:16' }).painted)).toContain('JOÃO 3:16');
  });

  it('counts the links in words the reader was given, not in digits of its own', () => {
    const { painted } = paint({ countLabel: '96 referências cruzadas' });
    expect(said(painted)).toContain('96 referências cruzadas');
  });

  it('gives the address to type back in', () => {
    const { painted } = paint({ site: 'trekhleb.dev/bible-cross-references/pt' });
    expect(said(painted)).toContain('trekhleb.dev/bible-cross-references/pt');
  });

  it('sets the whole verse, losing no word to the line breaking', () => {
    const { painted } = paint();
    const verseLines = painted.filter((one) => one.font.includes('Iowan'));
    expect(verseLines.length).toBeGreaterThan(0);
    expect(verseLines.map((one) => one.text).join(' ')).toBe(
      'I have set the LORD always before me.',
    );
  });

  it('sets a long verse too, at a smaller size rather than not at all', () => {
    const long = 'And '.repeat(90).trim();
    const { painted } = paint({ text: long });
    const verseLines = painted.filter((one) => one.font.includes('Iowan'));
    expect(verseLines.map((one) => one.text).join(' ')).toBe(long);
    const sizeOf = (one: Painted | undefined) => Number(/(\d+)px/u.exec(one?.font ?? '')?.[1] ?? 0);
    const short = paint().painted.filter((one) => one.font.includes('Iowan'));
    expect(sizeOf(verseLines[0])).toBeLessThan(sizeOf(short[0]));
  });
});

describe('how the card is laid out', () => {
  it('paints its own ground first, so nothing shows through in a dark chat', () => {
    const { rects } = paint();
    expect(rects[0]).toEqual({ x: 0, y: 0, w: CARD_WIDTH, h: CARD_HEIGHT, fill: '#0d0d0d' });
  });

  /**
   * The anchors alone prove nothing — every one of them is a padding constant well inside the
   * card. What can escape is the run of text drawn from an anchor, so this measures that: the
   * same half-em-per-glyph rule the recording context uses, applied to each painted line.
   */
  it('keeps every painted line inside the card, clear of the edges', () => {
    const { painted } = paint({ text: 'Supercalifragilistic '.repeat(14).trim() });
    for (const one of painted) {
      const size = Number(/(\d+)px/u.exec(one.font)?.[1] ?? 0);
      const width = one.text.length * size * 0.5;
      const [start, end] = one.align === 'right' ? [one.x - width, one.x] : [one.x, one.x + width];
      expect(start, one.text).toBeGreaterThanOrEqual(0);
      expect(end, one.text).toBeLessThanOrEqual(CARD_WIDTH);
      expect(one.y, one.text).toBeGreaterThanOrEqual(0);
      expect(one.y + size, one.text).toBeLessThanOrEqual(CARD_HEIGHT);
    }
  });

  it('wraps a long attribution rather than running it off the edge', () => {
    const long =
      'Scripture text: Versión Biblia Libre (VBL) by A. Gallagher, J. Barrios de Avila, ' +
      'D. Sanabria and T. Põldaas, licensed CC BY-SA 4.0, adapted for this site.';
    const { painted } = paint({ attribution: long });
    const credit = painted.filter((one) => long.includes(one.text) && one.text.length > 8);
    expect(credit.length).toBeGreaterThan(1);
    expect(credit.map((one) => one.text).join(' ')).toBe(long);
  });

  it('colors the reference by the book it is in', () => {
    const reference = paint().painted.find((one) => one.text === 'PSALM 16:8');
    // Verse 2 is the third genre in the fixture.
    expect(reference?.fill).toBe('#d8b945');
  });

  it('tracks the reference out and then stops, so the verse is not spaced too', () => {
    const { painted } = paint();
    expect(painted.find((one) => one.text === 'PSALM 16:8')?.spacing).toBe('0.16em');
    const verse = painted.find((one) => one.font.includes('Iowan'));
    expect(verse?.spacing).toBe('0px');
  });

  it('puts the address back to the left after setting it right, for whatever draws next', () => {
    const { painted } = paint();
    const site = painted.find((one) => one.text.startsWith('trekhleb.dev'));
    expect(site?.align).toBe('right');
    expect(paint().context.textAlign).toBe('left');
  });

  it('sets the footer below the verse, not over it', () => {
    const { painted } = paint();
    const verse = painted.filter((one) => one.font.includes('Iowan'));
    const attribution = painted.find((one) => one.text.includes('Public domain'));
    const lowestVerseLine = Math.max(...verse.map((one) => one.y));
    expect(attribution?.y).toBeGreaterThan(lowestVerseLine);
  });
});

describe('the arcs on the card', () => {
  it('draws one for every cross-reference, and no more', () => {
    expect(paint({ targets: [0, 1, 4] }).curves).toHaveLength(3);
    expect(paint({ targets: [] }).curves).toHaveLength(0);
  });

  it('colors each by the genre it lands in', () => {
    const { curves } = paint({ targets: [0, 4, 5] });
    expect(curves.map((curve) => curve.stroke)).toEqual(['#e2679c', '#3ba894', '#5590d6']);
  });

  it('starts every arc at the verse, and ends it where the link does', () => {
    const { curves } = paint({ verse: 2, targets: [0, 5] });
    const starts = new Set(curves.map((curve) => curve.from[0]));
    expect(starts.size).toBe(1);
    // The further link ends further along the line.
    expect(curves[1]?.to[0]).toBeGreaterThan(curves[0]?.to[0] ?? 0);
  });

  it('arches a far link higher than a near one', () => {
    const { curves } = paint({ verse: 0, targets: [1, 5] });
    const [near, far] = curves;
    expect(far?.control[1]).toBeLessThan(near?.control[1] ?? 0);
  });

  it('keeps the arcs under the verse and inside the card', () => {
    const { curves } = paint({ verse: 0, targets: [5] });
    for (const curve of curves) {
      expect(curve.control[1]).toBeGreaterThan(0);
      expect(curve.from[1]).toBeLessThan(CARD_HEIGHT);
    }
  });

  it('draws them softly, so a crowd of links reads as density rather than a blot', () => {
    const { curves } = paint();
    for (const curve of curves) {
      expect(curve.alpha).toBeLessThan(1);
    }
  });

  it('lays the whole Bible under them, a band per genre', () => {
    const { lines } = paint();
    const baseline = lines.filter((line) => line.from[1] === line.to[1] && line.width > 2);
    expect(baseline.map((line) => line.stroke)).toEqual(GENRE_HEX);
    // Left to right, meeting end to end.
    for (let i = 1; i < baseline.length; i += 1) {
      expect(baseline[i]?.from[0]).toBeCloseTo(baseline[i - 1]?.to[0] ?? 0, 5);
    }
  });

  it('signs the card with the app\u2019s own mark, beside the address', () => {
    const { markCurves } = paint();
    expect(markCurves.length).toBeGreaterThan(0);
  });

  it('marks which verse it is', () => {
    const { arcs, curves } = paint({ verse: 2, targets: [0] });
    const dot = arcs.at(-1);
    expect(dot?.fill).toBe('#ecebe6');
    expect(dot?.x).toBeCloseTo(curves[0]?.from[0] ?? -1, 5);
  });

  it('still draws the Bible and the footer for a verse nothing points at', () => {
    const { curves, lines, painted } = paint({ targets: [], countLabel: '0 cross-references' });
    expect(curves).toHaveLength(0);
    expect(lines.filter((line) => line.width > 2).length).toBe(GENRE_HEX.length);
    expect(said(painted)).toContain('0 cross-references');
    expect(said(painted)).toContain('Berean Standard Bible (BSB) · Public domain');
  });
});

describe('the books the card names', () => {
  it('names each one the arcs reach', () => {
    expect(said(paint().painted)).toEqual(expect.arrayContaining(['Gen', 'Acts']));
  });

  /**
   * Keyed by a bar in the genre's color, not by coloring the name: `palette.ts` validated these
   * ten for marks at 4.19:1 and up, which History does not clear for fifteen-pixel type.
   */
  it('keys each name with a bar in its genre, and sets the name itself readably', () => {
    const { painted, rects } = paint();
    const keys = rects.filter((rect) => rect.w === 13 && rect.h === 3);
    expect(keys.map((key) => key.fill)).toEqual(['#e2679c', '#3ba894']);
    for (const label of painted.filter((one) => ['Gen', 'Acts'].includes(one.text))) {
      expect(label.fill).toBe('#9a9890');
    }
  });

  it('puts each name under the stretch of the line it belongs to', () => {
    const { painted } = paint();
    const gen = painted.find((one) => one.text === 'Gen');
    const acts = painted.find((one) => one.text === 'Acts');
    expect(gen?.x).toBeLessThan(acts?.x ?? 0);
  });

  it('drops a name rather than letting it collide with its neighbour', () => {
    const crowded = paint({
      landmarks: [
        { label: 'Gen', verse: 0, genre: 0 },
        { label: 'Exod', verse: 0, genre: 1 },
        { label: 'Acts', verse: 5, genre: 4 },
      ],
    });
    const names = said(crowded.painted);
    expect(names).toContain('Gen');
    expect(names).not.toContain('Exod');
    expect(names).toContain('Acts');
  });

  it('marks where the New Testament begins', () => {
    const { lines } = paint();
    const tick = lines.find((line) => line.from[0] === line.to[0] && line.width === 1);
    expect(tick).toBeDefined();
    expect(tick?.from[1]).toBeLessThan(tick?.to[1] ?? 0);
  });

  it('draws a card for a verse whose links reach nowhere worth naming', () => {
    const { painted, curves } = paint({ landmarks: [], targets: [] });
    expect(curves).toHaveLength(0);
    expect(said(painted)).toContain('3 cross-references');
  });
});
