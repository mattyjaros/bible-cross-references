import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_VERSIFICATION } from '../../../core/bible/versification.ts';
import type { OriginalWordColumns } from '../../../core/datasets/formats.ts';
import { verseIndex } from '../../../test-utils/fixtures.ts';
import { getWordSourceManifest } from '../../../words/registry.ts';
import { OriginalWordIndex } from '../../../words/original-words.ts';
import type { OriginalWordsDataset } from '../../../words/load-original-words.ts';
import { WordOccurrences } from '../../../words/load-word-occurrences.ts';
import type { Connection } from '../connections.ts';
import { LinkEvidence } from './LinkEvidence.tsx';

const GEN_1_1 = verseIndex('Gen', 1, 1);
const PS_4_8 = verseIndex('Ps', 4, 8);
const JOHN_1_14 = verseIndex('John', 1, 14);
const JOHN_3_16 = verseIndex('John', 3, 16);
const JOHN_14_27 = verseIndex('John', 14, 27);

/** μονογενής in two verses of John; "peace" once in Greek and once in Hebrew. */
function columns(): OriginalWordColumns {
  return {
    strongs: ['G1515', 'G3439', 'H7965'],
    lemma: ['εἰρήνη', 'μονογενής', 'שָׁלוֹם'],
    transliteration: ['eirēnē', 'monogenēs', 'shalom'],
    gloss: ['peace', 'only begotten', 'peace / friendship'],
    offsets: [0, 1, 3, 4],
    verses: [JOHN_14_27, JOHN_1_14, JOHN_3_16, PS_4_8].map(Number),
  };
}

function dataset(): OriginalWordsDataset {
  return {
    manifest: getWordSourceManifest('stepbible'),
    provenance: { url: 'x', sha256: 'a'.repeat(64), retrievedAt: '2026-01-01', snapshotDate: null },
    notices: [],
    maxVerses: 100,
    contentWordMaxVerses: 100,
    index: new OriginalWordIndex(columns(), CANONICAL_VERSIFICATION.verseCount),
  };
}

function occurrences(): WordOccurrences {
  return new WordOccurrences({
    grammar: ['N-ASF', 'A-GSM', 'A-ASM', 'HNcmsa'],
    grammarAt: [0, 1, 2, 3],
    english: ['peace', 'of an only begotten', 'only begotten', 'peace'],
  });
}

const state = vi.hoisted(() => ({
  words: null as OriginalWordsDataset | null,
  occurrencesFail: false,
  reset: vi.fn(),
}));

vi.mock('../viz-data.ts', () => ({
  originalWordsIfLoaded: () => state.words,
  originalWordsLoader: { load: () => Promise.resolve(dataset()), reset: vi.fn() },
  resetOriginalWords: vi.fn(),
  wordOccurrencesLoader: {
    load: () =>
      state.occurrencesFail ? Promise.reject(new Error('offline')) : Promise.resolve(occurrences()),
    reset: state.reset,
  },
}));

beforeEach(() => {
  state.words = dataset();
  state.occurrencesFail = false;
  state.reset.mockClear();
});

function connection(here: number, otherStart: number, otherEnd = otherStart): Connection {
  return { here, otherStart, otherEnd, direction: 'outgoing' } as unknown as Connection;
}

function show(link: Connection) {
  return render(<LinkEvidence connection={link} versification={CANONICAL_VERSIFICATION} />);
}

describe('LinkEvidence', () => {
  it('names the word two passages share, and opens on how each uses it', async () => {
    show(connection(JOHN_3_16, JOHN_1_14));
    const badge = screen.getByRole('button', { name: /shared word · μονογενής/ });
    expect(badge.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(badge);
    expect(badge.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByText('of an only begotten')).toBeTruthy();
    // Once as the word's gloss, once as the English it is given in John 3:16.
    expect(screen.getAllByText('only begotten')).toHaveLength(2);
    expect(screen.getByText('adjective, accusative, singular, masculine')).toBeTruthy();
    expect(screen.getByText('in 2 verses of the Bible')).toBeTruthy();
  });

  it('falls back to words that mean the same across the Testaments', async () => {
    show(connection(PS_4_8, JOHN_14_27));
    const badge = screen.getByRole('button', { name: /same meaning · peace/ });
    await userEvent.click(badge);
    expect(await screen.findByText('noun, masculine, singular, absolute')).toBeTruthy();
    expect(screen.getByText('noun, accusative, singular, feminine')).toBeTruthy();
  });

  it('says a link has no word in common, and why it is there anyway', async () => {
    show(connection(GEN_1_1, JOHN_1_14));
    await userEvent.click(screen.getByRole('button', { name: /thematic/ }));
    expect(screen.getByText(/Treasury of Scripture Knowledge/)).toBeTruthy();
  });

  it('keeps waiting rather than failing when the uses cannot be fetched', async () => {
    state.occurrencesFail = true;
    show(connection(JOHN_3_16, JOHN_1_14));
    await userEvent.click(screen.getByRole('button', { name: /shared word/ }));
    await waitFor(() => {
      expect(state.reset).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Loading how the words are used…')).toHaveLength(2);
  });

  it('shows nothing until the words have arrived', () => {
    state.words = null;
    const { container } = show(connection(JOHN_3_16, JOHN_1_14));
    expect(container.innerHTML).toBe('');
  });
});
