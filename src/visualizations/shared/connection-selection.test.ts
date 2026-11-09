import { describe, expect, it } from 'vitest';
import type { OriginalWordColumns } from '../../core/datasets/formats.ts';
import { linkEvidence } from '../../words/link-evidence.ts';
import { OriginalWordIndex } from '../../words/original-words.ts';
import {
  connectionWords,
  isSelected,
  isSelecting,
  kindCounts,
  NO_SELECTION,
  toggled,
  wordOptions,
  wordsInCommon,
  type ConnectionSelection,
} from './connection-selection.ts';
import type { Connection } from './connections.ts';

/**
 * Verse 0 says "righteous" (Greek) and "love". Verse 1 shares "righteous", verse 2 says it in
 * Hebrew, verse 3 shares "love", and verse 4 has nothing in common with it.
 */
function index(): OriginalWordIndex {
  const columns: OriginalWordColumns = {
    strongs: ['G1342', 'H6662', 'G0025', 'G3962'],
    lemma: ['δίκαιος', 'צַדִּיק', 'ἀγαπάω', 'πατήρ'],
    transliteration: ['dikaios', 'tsaddiq', 'agapaō', 'patēr'],
    gloss: ['righteous', 'righteous', 'to love', 'father'],
    offsets: [0, 2, 3, 5, 6],
    verses: [0, 1, 2, 0, 3, 4],
  };
  return new OriginalWordIndex(columns, 5);
}

function connection(otherStart: number): Connection {
  return { here: 0, otherStart, otherEnd: otherStart, direction: 'outgoing' } as Connection;
}

const CONNECTIONS = [1, 2, 3, 4].map(connection);

describe('wordsInCommon', () => {
  it('finds the same word, and a word that means the same in the other language', () => {
    const common = (other: number) => [...wordsInCommon(linkEvidence(index(), 0, other, other))];
    expect(common(1)).toEqual([0]);
    expect(common(2)).toEqual([0]);
    expect(common(3)).toEqual([2]);
    expect(common(4)).toEqual([]);
  });
});

describe('connection selection', () => {
  const entries = connectionWords(index(), CONNECTIONS);
  const pick = (selection: ConnectionSelection) =>
    entries.filter((entry) => isSelected(entry, selection)).map((e) => e.connection.otherStart);

  it('lets everything through until something is chosen', () => {
    expect(isSelecting(NO_SELECTION)).toBe(false);
    expect(pick(NO_SELECTION)).toEqual([1, 2, 3, 4]);
  });

  it('keeps the passages with any chosen word, in either language', () => {
    expect(pick({ words: new Set([0]), kinds: new Set() })).toEqual([1, 2]);
    expect(pick({ words: new Set([0, 2]), kinds: new Set() })).toEqual([1, 2, 3]);
  });

  it('narrows by kind, and by both together', () => {
    expect(pick({ words: new Set(), kinds: new Set(['thematic']) })).toEqual([4]);
    expect(pick({ words: new Set([0]), kinds: new Set(['shared-word']) })).toEqual([1]);
  });

  it('offers the words some link has, with how many', () => {
    expect(
      wordOptions(index(), 0, entries)
        .map((option) => [option.word.strongs, option.count])
        .sort(),
    ).toEqual([
      ['G0025', 1],
      ['G1342', 2],
    ]);
  });

  it('counts the links of each kind', () => {
    expect([...kindCounts(entries)]).toEqual([
      ['shared-word', 2],
      ['same-meaning', 1],
      ['thematic', 1],
    ]);
  });

  it('switches one choice on and off', () => {
    const on = toggled(new Set<number>(), 3);
    expect([...on]).toEqual([3]);
    expect([...toggled(on, 3)]).toEqual([]);
  });
});
