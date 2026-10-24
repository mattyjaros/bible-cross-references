import { elementAt } from '../../core/lib/array.ts';
import {
  arcsGeometry,
  fitText,
  genreBands,
  wrapText,
  type MeasureText,
} from './verse-card-layout.ts';

/**
 * Paints a verse as a picture worth sending to somebody.
 *
 * The card is the focus layer of the arcs view with the verse set above it: the same links the
 * app draws when that verse is selected, over a baseline that stands for the whole Bible, in the
 * same genre colors. That is the one thing on it that could not have come from any other Bible
 * app, and it is why the card is worth making rather than screenshotting.
 *
 * Everything is drawn at full size on an offscreen canvas, never scaled up from the preview: a
 * card that looks right in a 300px box and arrives blurry in a chat is the failure mode here.
 */

/** Sent as a picture: 4:5, the tallest frame a feed will show without cropping. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const PADDING = 84;
const BACKGROUND = '#0d0d0d';
const TEXT = '#ecebe6';
const MUTED = '#6e6c66';
const DIM = '#9a9890';
const RULE = '#232321';

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

/** The type scale the verse is set on, largest first. */
const VERSE_SIZES = [76, 68, 60, 54, 48, 43, 39, 35] as const;
const VERSE_LINE_HEIGHT = 1.34;

const REFERENCE_SIZE = 27;
const FOOTER_SIZE = 23;
/**
 * The attribution is a sentence, not a label — the licences ask for the creators, the licence,
 * a URI and a note that the text was changed, which runs to a few hundred characters. It is set
 * small and wrapped across the card, and the rest of the layout is measured against what it
 * leaves rather than the other way round.
 */
const CREDIT_SIZE = 17;
const CREDIT_LINE_HEIGHT = 1.4;
const CREDIT_MAX_LINES = 5;
const ARC_AREA_HEIGHT = 300;
const BASELINE_WEIGHT = 5;
/** Room under the line for the names of the books the arcs reach. */
const LANDMARK_BAND = 34;
const LANDMARK_SIZE = 16;
const LANDMARK_KEY_WIDTH = 13;
const LANDMARK_KEY_HEIGHT = 3;
/** Clear space either side of a name before the next one is dropped. */
const LANDMARK_GAP = 14;

export interface VerseCardInput {
  /** "Psalm 16:8", in the reader's language. */
  readonly reference: string;
  /**
   * The reader's language tag, for casing the reference.
   *
   * `toLocaleUpperCase()` with no argument asks the host, not the app: on a Turkish phone an
   * English card would set "1 Timothy" as "1 TİMOTHY", because Turkish uppercases a dotted i
   * to a dotted İ. The card is in the app's language, so it is cased in the app's language.
   */
  readonly localeTag: string;
  readonly text: string;
  /** The verse's own index, and where every link of its lands. */
  readonly verse: number;
  readonly targets: readonly number[];
  readonly verseGenres: Uint8Array;
  readonly totalVerses: number;
  /** Genre colors, by ordinal, as the app draws them. */
  readonly genreHex: readonly string[];
  /**
   * The books the arcs reach, named under the line at the point they sit on it.
   *
   * Each carries its genre so the name can be keyed to the color beside it: ten genre colors
   * are not distinguishable by eye alone, which is why `palette.ts` asks every visualization to
   * encode genre by label as well. The name is set in the readable grey and the color is a bar
   * in front of it — History is `#cd4805`, 4.19:1 against this background, which is validated
   * for a mark and not for fifteen-pixel type.
   */
  readonly landmarks: readonly {
    readonly label: string;
    readonly verse: number;
    readonly genre: number;
  }[];
  /** The first verse of the New Testament, marked with a tick on the line. */
  readonly testamentAt: number;
  /** "8 cross-references", already counted and pluralized in the reader's language. */
  readonly countLabel: string;
  /** The text's name and licence, which it is a condition of using it to show. */
  readonly attribution: string;
  /** Where to find the app, without a scheme: people retype this. */
  readonly site: string;
}

/** The app's mark: two arcs over a baseline, the same strokes as the favicon. */
function drawMark(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const scale = size / 32;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = MUTED;
  context.lineWidth = 2.6;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(5, 23);
  context.quadraticCurveTo(16, 4, 27, 23);
  context.moveTo(10, 23);
  context.quadraticCurveTo(16, 13, 22, 23);
  context.moveTo(4, 27);
  context.lineTo(28, 27);
  context.stroke();
  context.restore();
}

/**
 * The whole Bible as one line, this verse marked on it, and every link leaving it.
 *
 * Arcs are painted before the baseline so that the line reads as solid where they meet it, and
 * the dot last of all, because it is the answer to "which verse is this".
 */
function drawArcs(
  context: CanvasRenderingContext2D,
  input: VerseCardInput,
  top: number,
  width: number,
): void {
  const left = PADDING;
  const right = width - PADDING;
  const baselineY = top + ARC_AREA_HEIGHT;
  const { verseX, arcs } = arcsGeometry({
    verse: input.verse,
    targets: input.targets,
    verseGenres: input.verseGenres,
    totalVerses: input.totalVerses,
    left,
    right,
    maxRise: ARC_AREA_HEIGHT - 16,
  });

  context.lineCap = 'round';
  context.lineWidth = 1.9;
  for (const arc of arcs) {
    context.strokeStyle = input.genreHex[arc.genre] ?? DIM;
    context.globalAlpha = 0.72;
    context.beginPath();
    context.moveTo(arc.fromX, baselineY);
    context.quadraticCurveTo(
      (arc.fromX + arc.toX) / 2,
      baselineY + arc.controlY,
      arc.toX,
      baselineY,
    );
    context.stroke();
  }
  context.globalAlpha = 1;

  // The baseline, in the genres of the books it runs through.
  const span = right - left;
  context.lineWidth = BASELINE_WEIGHT;
  context.lineCap = 'butt';
  for (const band of genreBands(input.verseGenres)) {
    context.strokeStyle = input.genreHex[band.genre] ?? DIM;
    context.beginPath();
    context.moveTo(left + (span * band.start) / input.totalVerses, baselineY);
    context.lineTo(left + (span * (band.end + 1)) / input.totalVerses, baselineY);
    context.stroke();
  }

  // One tick where the Old Testament ends, because "does this reach past Malachi" is the
  // question the shape of the arcs most often raises.
  const testamentX = left + (span * input.testamentAt) / input.totalVerses;
  context.strokeStyle = DIM;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(testamentX, baselineY - 11);
  context.lineTo(testamentX, baselineY + 11);
  context.stroke();

  context.fillStyle = TEXT;
  context.beginPath();
  context.arc(verseX, baselineY, 7.5, 0, Math.PI * 2);
  context.fill();
  // A ring of the background separates the dot from a crowded baseline behind it.
  context.strokeStyle = BACKGROUND;
  context.lineWidth = 3;
  context.stroke();

  drawLandmarks(context, input, left, right, baselineY);
}

/**
 * Names the books the arcs reach, under the point on the line where each one sits.
 *
 * A name is dropped rather than overlapped: `axis-painter` does the same for the arcs view's own
 * axis, and a label that collides with its neighbour is worse than a label that is not there.
 * The color goes in a bar in front of the name rather than into the name itself — nine of the
 * ten genre colors clear the contrast a small label needs and History does not, and nine names
 * in color beside one in grey reads as a fault.
 */
function drawLandmarks(
  context: CanvasRenderingContext2D,
  input: VerseCardInput,
  left: number,
  right: number,
  baselineY: number,
): void {
  const span = right - left;
  const y = baselineY + LANDMARK_BAND - 8;
  context.font = `500 ${String(LANDMARK_SIZE)}px ${SANS}`;
  context.textBaseline = 'alphabetic';

  let lastEnd = -Infinity;
  for (const landmark of input.landmarks) {
    const width = LANDMARK_KEY_WIDTH + 6 + context.measureText(landmark.label).width;
    const centre = left + (span * landmark.verse) / input.totalVerses;
    const start = Math.min(Math.max(centre - width / 2, left), right - width);
    if (start < lastEnd + LANDMARK_GAP) {
      continue;
    }
    lastEnd = start + width;
    context.fillStyle = input.genreHex[landmark.genre] ?? DIM;
    context.fillRect(start, y - LANDMARK_SIZE * 0.42, LANDMARK_KEY_WIDTH, LANDMARK_KEY_HEIGHT);
    context.fillStyle = DIM;
    context.fillText(landmark.label, start + LANDMARK_KEY_WIDTH + 6, y);
  }
  context.textBaseline = 'top';
}

/**
 * Draws the whole card onto a context.
 *
 * Separate from the canvas that hands back a PNG so that what the card *says* can be checked:
 * a test can give this a recording context and assert that the attribution, the count and the
 * verse itself were actually painted. The licences make the attribution a condition of using
 * these translations, which is not something to find out by looking.
 */
export function paintVerseCard(context: CanvasRenderingContext2D, input: VerseCardInput): void {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const accent = input.genreHex[elementAt(input.verseGenres, input.verse)] ?? DIM;

  // The reference, in the genre's color: the one tie that makes six languages' cards a family.
  context.fillStyle = accent;
  context.font = `600 ${String(REFERENCE_SIZE)}px ${SANS}`;
  context.textBaseline = 'top';
  context.letterSpacing = '0.16em';
  context.fillText(input.reference.toLocaleUpperCase(input.localeTag), PADDING, PADDING);
  context.letterSpacing = '0px';

  // The verse, as large as it will go on the scale.
  const measure: MeasureText = (text, fontSize) => {
    context.font = `${String(fontSize)}px ${SERIF}`;
    return context.measureText(text).width;
  };
  const maxWidth = CARD_WIDTH - PADDING * 2;
  const textTop = PADDING + REFERENCE_SIZE + 54;
  // The credit is wrapped first, because how many lines it takes decides where everything above
  // it can go. A translation with a long licence leaves the verse less room, which is the right
  // way round: the licence is not optional and the type scale is.
  const creditLines = wrapText(input.attribution, CREDIT_SIZE, maxWidth, (text, fontSize) => {
    context.font = `${String(fontSize)}px ${SANS}`;
    return context.measureText(text).width;
  }).slice(0, CREDIT_MAX_LINES);
  const creditTop = CARD_HEIGHT - PADDING - creditLines.length * CREDIT_SIZE * CREDIT_LINE_HEIGHT;
  const footerTop = creditTop - FOOTER_SIZE * 1.7;
  const arcsTop = footerTop - 40 - LANDMARK_BAND - ARC_AREA_HEIGHT;
  const textRegion = arcsTop - 40 - textTop;
  const { fontSize, lines } = fitText({
    text: input.text,
    sizes: VERSE_SIZES,
    maxWidth,
    maxHeight: textRegion,
    lineHeight: VERSE_LINE_HEIGHT,
    measure,
  });
  context.fillStyle = TEXT;
  context.font = `${String(fontSize)}px ${SERIF}`;
  // Centred in the space it was given rather than hung from the top: most verses are two or
  // three lines, and against a baseline anchored to the foot of the card a top-set short verse
  // leaves a hole in the middle that reads as a mistake.
  const textHeight = lines.length * fontSize * VERSE_LINE_HEIGHT;
  const firstLine = textTop + Math.max(0, (textRegion - textHeight) / 2);
  lines.forEach((line, index) => {
    context.fillText(line, PADDING, firstLine + index * fontSize * VERSE_LINE_HEIGHT);
  });

  drawArcs(context, input, arcsTop, CARD_WIDTH);

  // A rule, then what the card owes: how many links, whose text, and where to find it.
  context.strokeStyle = RULE;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(PADDING, footerTop - 26);
  context.lineTo(CARD_WIDTH - PADDING, footerTop - 26);
  context.stroke();

  // How many links, and where the card came from, on one line.
  context.font = `500 ${String(FOOTER_SIZE)}px ${SANS}`;
  context.fillStyle = DIM;
  context.fillText(input.countLabel, PADDING, footerTop);

  context.font = `${String(FOOTER_SIZE - 1)}px ${SANS}`;
  context.textAlign = 'right';
  context.fillStyle = DIM;
  context.fillText(input.site, CARD_WIDTH - PADDING, footerTop + 1);
  const siteWidth = context.measureText(input.site).width;
  context.textAlign = 'left';
  drawMark(context, CARD_WIDTH - PADDING - siteWidth - 42, footerTop - 4, 30);

  // Then the credit, in full, under both of them.
  context.font = `${String(CREDIT_SIZE)}px ${SANS}`;
  context.fillStyle = MUTED;
  creditLines.forEach((line, index) => {
    context.fillText(line, PADDING, creditTop + index * CREDIT_SIZE * CREDIT_LINE_HEIGHT);
  });
}
