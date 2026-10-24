import type { BookId } from '../../core/bible/books.ts';
import { versePassage, formatPassage } from '../../core/bible/passage.ts';
import type { VerseIndex } from '../../core/bible/verse-ref.ts';
import type { Localization } from '../../i18n/use-locale.tsx';
import { collectConnections } from './connections.ts';
import type { LinkFilter } from './link-filter.ts';
import { GENRE_HEX } from './palette.ts';
import { quotePassage } from './passage-quote.ts';
import type { VerseCardInput } from './verse-card.ts';
import type { PassageQuote } from './passage-quote.ts';
import type { VizData } from './viz-data.ts';

/** Everything the share dialog needs, gathered where the verse was clicked. */
export interface VerseShareRequest extends VerseCardInput {
  /** The verse's address on the published site. */
  readonly url: string;
  /** The same verse as text, for the reader who wants the words rather than the picture. */
  readonly quote: PassageQuote;
}

/** How many books a card names. Beyond this the labels crowd the line they sit under. */
const MAX_LANDMARKS = 4;

/**
 * Everything a share card needs, gathered from the same places the app draws from.
 *
 * The links are collected with `collectConnections`, which is what `ArcsStage` feeds to the GPU
 * when a verse is focused — so the card's arcs are that focus layer, not a second idea of which
 * links matter. A filtered-out link is missing from both, which is the point: the picture should
 * agree with the screen it was taken from.
 */
export function buildVerseShareRequest({
  data,
  filter,
  verse,
  url,
  localization,
}: {
  readonly data: VizData;
  readonly filter: LinkFilter;
  readonly verse: VerseIndex;
  /** The verse's address on the published site. */
  readonly url: string;
  readonly localization: Localization;
}): VerseShareRequest {
  const { versification, translation, crossReferences, verseGenres } = data;
  const { t, books, n, locale } = localization;
  const connections = collectConnections(
    crossReferences.index,
    { start: verse, end: verse },
    filter,
    verseGenres,
  );
  const links = [...connections.outgoing, ...connections.incoming];
  // Where each link lands, as one point: a link to a range is drawn to the middle of it, the
  // same simplification the arc diagram makes.
  const targets = links.map(({ otherStart, otherEnd }) => Math.floor((otherStart + otherEnd) / 2));
  const reference = formatPassage(versePassage(verse), versification, books);

  // Which books the arcs reach, most-reached first. Ten genre colors cannot be told apart by
  // eye alone — `palette.ts` says as much, and asks every visualization to name them too — and
  // naming the books a verse actually lands in says something about this verse rather than
  // reprinting the table of contents.
  const landings = new Map<BookId, number>();
  for (const target of targets) {
    const book = versification.bookAt(target).id;
    landings.set(book, (landings.get(book) ?? 0) + 1);
  }
  const landmarks = [...landings]
    .sort(([bookA, a], [bookB, b]) => b - a || bookA.localeCompare(bookB))
    .slice(0, MAX_LANDMARKS)
    .map(([book]) => {
      const { start, end } = versification.bookRange(book);
      return {
        label: books[book].abbreviation ?? book,
        verse: Math.floor((start + end) / 2),
        genre: start < verseGenres.length ? (verseGenres[start] ?? 0) : 0,
      };
    })
    .sort((a, b) => a.verse - b.verse);

  return {
    reference,
    localeTag: locale.tag,
    text: translation.verseText(verse),
    verse,
    targets,
    verseGenres,
    totalVerses: versification.verseCount,
    genreHex: GENRE_HEX,
    landmarks,
    // Where the New Testament begins, as one tick: "does this reach past Malachi" is the
    // question the shape of the arcs most often raises.
    testamentAt: versification.bookRange('Matt').start,
    countLabel: t('share.crossReferences')(n(links.length), links.length),
    // The translation's own attribution, in the reader's language, and not a short form built
    // here. CC BY and CC BY-SA ask for the creators, the licence, the URI the licensor
    // designated and a note that the text was changed; the manifests carry exactly that, and
    // the picture is the one copy of the text that travels without the page around it. A card
    // naming only "VBL · CC BY-SA 4.0" would redistribute it on worse terms than the licence.
    attribution: t(`attribution.${translation.manifest.id}`),
    site: siteOf(url),
    url,
    quote: quotePassage({
      translation,
      versification,
      names: books,
      start: verse,
      end: verse,
      url,
    }),
  };
}

/**
 * The app's address as people retype it: no scheme, no query, no trailing slash.
 *
 * It keeps the language segment, so a Portuguese card sends a reader to the Portuguese app.
 */
export function siteOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/u, '');
  } catch {
    return url;
  }
}
