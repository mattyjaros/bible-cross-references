import { elementAt } from '../../core/lib/array.ts';

/**
 * Where everything on a shared verse card goes.
 *
 * The arithmetic lives apart from the painting so that it can be tested: a canvas cannot be
 * exercised in this environment, but choosing a type size, breaking a line and placing an arc
 * are all decisions, and decisions are worth checking. Every function here takes the measuring
 * it needs as an argument, so none of them touch a canvas or the DOM.
 */

/** Measures a run of text at a given size, in pixels. */
export type MeasureText = (text: string, fontSize: number) => number;

/** A line of the verse, already broken to fit. */
export interface WrappedText {
  readonly fontSize: number;
  readonly lines: readonly string[];
}

/**
 * Breaks `text` into lines no wider than `maxWidth`.
 *
 * A word longer than the line (a URL, or German at its most German) is left to overhang rather
 * than broken mid-word: a hyphen inserted by a machine in the middle of scripture is worse than
 * a line that runs a little wide, and the size search above this will usually resolve it anyway.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  const words = text.split(/\s+/u).filter((word) => word !== '');
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let line = elementAt(words, 0);
  for (let i = 1; i < words.length; i += 1) {
    const word = elementAt(words, i);
    const candidate = `${line} ${word}`;
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * The largest size from `sizes` at which the verse still fits the box, with the lines it breaks
 * into there.
 *
 * `sizes` is a scale rather than a range because the card is a typographic object: stepping down
 * a designed scale keeps every card recognisably the same family, where solving for the exact
 * size that fills the box would give each verse its own arbitrary one. The smallest size is used
 * even when the text overflows it — a very long verse is clipped by the painter, and refusing to
 * draw it would be worse than setting it small.
 */
export function fitText({
  text,
  sizes,
  maxWidth,
  maxHeight,
  lineHeight,
  measure,
}: {
  readonly text: string;
  readonly sizes: readonly number[];
  readonly maxWidth: number;
  readonly maxHeight: number;
  /** Multiple of the font size. */
  readonly lineHeight: number;
  readonly measure: MeasureText;
}): WrappedText {
  let fallback: WrappedText = { fontSize: elementAt(sizes, sizes.length - 1), lines: [] };
  for (const fontSize of sizes) {
    const lines = wrapText(text, fontSize, maxWidth, measure);
    fallback = { fontSize, lines };
    if (lines.length * fontSize * lineHeight <= maxHeight) {
      return fallback;
    }
  }
  return fallback;
}

/** A stretch of the baseline where every verse belongs to one genre. */
export interface GenreBand {
  readonly start: number;
  readonly end: number;
  readonly genre: number;
}

/**
 * The baseline, split into runs of one genre.
 *
 * The whole Bible is drawn as a single line a few hundred pixels long, so the bands are found by
 * walking the genre of every verse once rather than by asking the versification for book edges:
 * the picture is of the text, and this is the same array the arcs themselves are colored from.
 */
export function genreBands(verseGenres: Uint8Array): GenreBand[] {
  const bands: GenreBand[] = [];
  if (verseGenres.length === 0) {
    return bands;
  }
  let genre = elementAt(verseGenres, 0);
  let start = 0;
  for (let verse = 1; verse < verseGenres.length; verse += 1) {
    const next = elementAt(verseGenres, verse);
    if (next !== genre) {
      bands.push({ start, end: verse - 1, genre });
      genre = next;
      start = verse;
    }
  }
  bands.push({ start, end: verseGenres.length - 1, genre });
  return bands;
}

/** One cross-reference, as a curve to paint. */
export interface CardArc {
  readonly fromX: number;
  readonly toX: number;
  /** Control point for a quadratic curve; the apex sits half this far above the baseline. */
  readonly controlY: number;
  readonly genre: number;
}

export interface ArcsGeometry {
  readonly verseX: number;
  readonly arcs: readonly CardArc[];
}

/**
 * This verse's own cross-references, as curves over a baseline that stands for the whole Bible.
 *
 * It is the focus layer of the arcs view and nothing else: the full picture behind it, 344,799
 * links deep, is a grey smudge at this size. A link that reaches further across the Bible rises
 * higher, which is what makes the shape of a verse's connections readable at a glance, and the
 * rise is capped so that a Genesis-to-Revelation link cannot leave the card.
 */
export function arcsGeometry({
  verse,
  targets,
  verseGenres,
  totalVerses,
  left,
  right,
  maxRise,
}: {
  readonly verse: number;
  /** The other end of each link, as a verse index. */
  readonly targets: readonly number[];
  readonly verseGenres: Uint8Array;
  readonly totalVerses: number;
  readonly left: number;
  readonly right: number;
  readonly maxRise: number;
}): ArcsGeometry {
  const span = right - left;
  const positionOf = (index: number) => left + (span * index) / totalVerses;
  const verseX = positionOf(verse);
  const arcs = targets.map((target) => {
    const toX = positionOf(target);
    const distance = Math.abs(toX - verseX);
    // By the root of the distance rather than the distance itself. A verse usually points at its
    // own neighbourhood — a psalm to other psalms — and under a linear rise those dozen short
    // links flatten into one smudge on the baseline. The root lifts the near ones apart while
    // still letting a Genesis-to-Revelation link arch over everything.
    const rise = maxRise * (0.18 + 0.82 * Math.sqrt(Math.min(1, distance / span)));
    return {
      fromX: verseX,
      toX,
      // A quadratic curve reaches half way to its control point, so the apex is `rise` high.
      controlY: -rise * 2,
      genre: target < verseGenres.length ? elementAt(verseGenres, target) : 0,
    };
  });
  return { verseX, arcs };
}
