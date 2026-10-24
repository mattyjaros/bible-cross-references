import { describe, expect, it } from 'vitest';
import { verseIndex } from '../../test-utils/fixtures.ts';
import { createVizData } from '../../test-utils/viz-data.ts';
import { ENGLISH, localizationFor } from '../../i18n/use-locale.tsx';
import { DEFAULT_LINK_FILTER } from './link-filter.ts';
import { buildVerseShareRequest, siteOf } from './verse-share.ts';

const JOHN_3_16 = verseIndex('John', 3, 16);
const ROM_5_8 = verseIndex('Rom', 5, 8);
const ROM_5_9 = verseIndex('Rom', 5, 9);
const GEN_1_1 = verseIndex('Gen', 1, 1);

const DATA = createVizData(
  [
    { from: JOHN_3_16, to: ROM_5_8, toEnd: ROM_5_9, votes: 50 },
    { from: GEN_1_1, to: JOHN_3_16, toEnd: JOHN_3_16, votes: 50 },
  ],
  new Map([
    [JOHN_3_16, 'For God so loved the world…'],
    [ROM_5_8, 'But God proves His love…'],
  ]),
);

function request(locale: 'en' | 'pt' = 'en') {
  return buildVerseShareRequest({
    data: DATA,
    filter: DEFAULT_LINK_FILTER,
    verse: JOHN_3_16,
    url: 'https://trekhleb.dev/bible-cross-references/?ref=John.3.16',
    localization: localizationFor(locale),
  });
}

describe('buildVerseShareRequest', () => {
  it('names the verse and carries its words', () => {
    const card = request();
    expect(card.reference).toBe('John 3:16');
    expect(card.text).toBe('For God so loved the world…');
    expect(card.verse).toBe(JOHN_3_16);
  });

  it('draws every link of the verse, in both directions', () => {
    // One link out to Romans 5:8–9 and one in from Genesis 1:1.
    const { targets } = request();
    expect(targets).toHaveLength(2);
    expect(targets).toContain(GEN_1_1);
  });

  it('aims a link at the middle of the range it lands in', () => {
    const { targets } = request();
    expect(targets).toContain(Math.floor((ROM_5_8 + ROM_5_9) / 2));
  });

  it('counts the links in the reader’s own language', () => {
    expect(request().countLabel).toBe('2 cross-references');
    expect(request('pt').countLabel).toBe('2 referências cruzadas');
  });

  /**
   * The picture is the one copy of the text that travels without the page around it, so what it
   * says about the text has to be what the licence asks for — the whole attribution the manifest
   * carries, in the reader's language, rather than a short form assembled here.
   */
  it('carries the translation\u2019s own attribution, in full', () => {
    expect(request().attribution).toBe(ENGLISH.t('attribution.bsb'));
  });

  it('carries it in the reader\u2019s language', () => {
    const pt = request('pt').attribution;
    expect(pt).toBe(localizationFor('pt').t('attribution.bsb'));
    expect(pt).not.toBe(request().attribution);
  });

  it('is a sentence that credits the text, not a label', () => {
    const { attribution } = request();
    expect(attribution).toContain('Berean Standard Bible');
    expect(attribution.length).toBeGreaterThan(40);
  });

  it('quotes the verse with its reference and the link, for the reader who wants words', () => {
    const { quote } = request();
    expect(quote.text).toContain('For God so loved the world…');
    expect(quote.text).toContain('John 3:16 (BSB)');
    expect(quote.text).toContain('?ref=John.3.16');
  });

  it('reads the picture’s colors from the same genres the app draws from', () => {
    const card = request();
    expect(card.verseGenres).toBe(DATA.verseGenres);
    expect(card.totalVerses).toBe(DATA.versification.verseCount);
    expect(card.genreHex.length).toBeGreaterThan(0);
  });
});

describe('siteOf', () => {
  it('is the address as somebody would retype it from a picture', () => {
    expect(siteOf('https://trekhleb.dev/bible-cross-references/?ref=John.3.16')).toBe(
      'trekhleb.dev/bible-cross-references',
    );
  });

  it('keeps the language, so a Portuguese card sends them to the Portuguese app', () => {
    expect(siteOf('https://trekhleb.dev/bible-cross-references/pt/?ref=John.3.16')).toBe(
      'trekhleb.dev/bible-cross-references/pt',
    );
  });

  it('hands back anything it cannot parse rather than throwing at paint time', () => {
    expect(siteOf('not a url')).toBe('not a url');
  });
});

describe('the books a card names', () => {
  it('names the books its links reach, by their short forms', () => {
    const { landmarks } = request();
    expect(landmarks.map((one) => one.label)).toEqual(expect.arrayContaining(['Gen', 'Rom']));
  });

  it('names them in the reader\u2019s language', () => {
    const pt = request('pt').landmarks.map((one) => one.label);
    const en = request().landmarks.map((one) => one.label);
    expect(pt).not.toEqual(en);
  });

  it('names no more than a line will hold', () => {
    expect(request().landmarks.length).toBeLessThanOrEqual(4);
  });

  it('puts them in the order they fall in the Bible, so the line reads left to right', () => {
    const verses = request().landmarks.map((one) => one.verse);
    expect([...verses].sort((a, b) => a - b)).toEqual(verses);
  });

  it('marks the New Testament where Matthew starts', () => {
    const { testamentAt } = request();
    expect(DATA.versification.refAt(testamentAt)).toMatchObject({ book: 'Matt', chapter: 1 });
  });
});
