import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { versePassage } from '../../../core/bible/passage.ts';
import { CANONICAL_VERSIFICATION } from '../../../core/bible/versification.ts';
import { verseIndex } from '../../../test-utils/fixtures.ts';
import { createVizData } from '../../../test-utils/viz-data.ts';
import type { OriginalWordsDataset } from '../../../words/load-original-words.ts';
import { OriginalWordIndex } from '../../../words/original-words.ts';
import { getWordSourceManifest } from '../../../words/registry.ts';
import { DEFAULT_LINK_FILTER } from '../link-filter.ts';
import type { Connection } from '../connections.ts';
import { PassagePanel } from './PassagePanel.tsx';

const JOHN_3_16 = verseIndex('John', 3, 16);
const ROM_5_8 = verseIndex('Rom', 5, 8);
const GEN_1_1 = verseIndex('Gen', 1, 1);

/** "Love" in John 3:16 and Romans 5:8; Genesis 1:1 shares nothing with them. */
const WORDS = vi.hoisted(() => ({ dataset: null as OriginalWordsDataset | null }));
WORDS.dataset = {
  manifest: getWordSourceManifest('stepbible'),
  provenance: { url: 'x', sha256: 'a'.repeat(64), retrievedAt: '2026-01-01', snapshotDate: null },
  notices: [],
  maxVerses: 100,
  contentWordMaxVerses: 100,
  index: new OriginalWordIndex(
    {
      strongs: ['G0025'],
      lemma: ['ἀγαπάω'],
      transliteration: ['agapaō'],
      gloss: ['to love'],
      offsets: [0, 2],
      verses: [JOHN_3_16, ROM_5_8].map(Number),
    },
    CANONICAL_VERSIFICATION.verseCount,
  ),
};

vi.mock('../viz-data.ts', () => ({
  originalWordsIfLoaded: () => WORDS.dataset,
  originalWordsLoader: { load: () => Promise.resolve(WORDS.dataset), reset: vi.fn() },
  resetOriginalWords: vi.fn(),
  wordOccurrencesLoader: { load: () => new Promise(() => undefined), reset: vi.fn() },
}));

const DATA = createVizData(
  [
    { from: JOHN_3_16, to: ROM_5_8, votes: 50 },
    { from: GEN_1_1, to: JOHN_3_16, votes: 30 },
  ],
  new Map([
    [JOHN_3_16, 'For God so loved the world'],
    [ROM_5_8, 'But God proves His love'],
    [GEN_1_1, 'In the beginning'],
  ]),
);

describe('PassagePanel, narrowed by word', () => {
  it('lists only the passages with the chosen word, and tells the view which they are', async () => {
    const onHighlight = vi.fn<(connections: readonly Connection[] | null) => void>();
    render(
      <PassagePanel
        data={DATA}
        passage={versePassage(JOHN_3_16)}
        filter={DEFAULT_LINK_FILTER}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onHighlight={onHighlight}
        shareUrl={() => 'https://example.org/'}
      />,
    );
    expect(screen.getByText('2 of 2 linked passages')).toBeDefined();
    expect(screen.getByText(/In the beginning/)).toBeDefined();

    await userEvent.click(screen.getByRole('checkbox', { name: /ἀγαπάω/ }));
    expect(screen.getByText('1 of 2 linked passages')).toBeDefined();
    expect(screen.queryByText(/In the beginning/)).toBeNull();
    expect(screen.getAllByText(/proves His love/).length).toBeGreaterThan(0);
    expect(onHighlight.mock.lastCall?.[0]?.map((connection) => connection.otherStart)).toEqual([
      ROM_5_8,
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/In the beginning/)).toBeDefined();
  });
});
