import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CANONICAL_VERSIFICATION } from '../../../core/bible/versification.ts';
import type { OriginalWordColumns } from '../../../core/datasets/formats.ts';
import { createTranslationFile, verseIndex } from '../../../test-utils/fixtures.ts';
import { getTranslationManifest } from '../../../translations/registry.ts';
import { Translation } from '../../../translations/translation.ts';
import { OriginalWordIndex } from '../../../words/original-words.ts';
import {
  connectionWords,
  isSelected,
  NO_SELECTION,
  type ConnectionSelection,
} from '../connection-selection.ts';
import type { Connection } from '../connections.ts';
import { ConnectionFilter } from './ConnectionFilter.tsx';

const PS_1_6 = verseIndex('Ps', 1, 6);
const PS_37_29 = verseIndex('Ps', 37, 29);
const MT_5_45 = verseIndex('Matt', 5, 45);
const GEN_1_1 = verseIndex('Gen', 1, 1);

/** "Righteous" in two psalms and, in Greek, in Matthew; Genesis shares nothing. */
const INDEX = new OriginalWordIndex(
  {
    strongs: ['H6662', 'G1342', 'H1870'],
    lemma: ['צַדִּיק', 'δίκαιος', 'דֶּרֶךְ'],
    transliteration: ['tsaddiq', 'dikaios', 'derek'],
    gloss: ['righteous', 'righteous', 'way'],
    offsets: [0, 2, 3, 4],
    verses: [PS_1_6, PS_37_29, MT_5_45, PS_1_6].map(Number),
  } satisfies OriginalWordColumns,
  CANONICAL_VERSIFICATION.verseCount,
);

const TRANSLATION = new Translation(
  getTranslationManifest('ubg'),
  CANONICAL_VERSIFICATION,
  createTranslationFile(
    new Map([
      [PS_1_6, 'Pan zna drogę sprawiedliwych'],
      [PS_37_29, 'Sprawiedliwi odziedziczą ziemię'],
      [MT_5_45, 'zsyła deszcz na sprawiedliwych'],
      [GEN_1_1, 'Na początku'],
    ]),
  ),
);

const ENTRIES = connectionWords(
  INDEX,
  [PS_37_29, MT_5_45, GEN_1_1].map(
    (otherStart) =>
      ({ here: PS_1_6, otherStart, otherEnd: otherStart, direction: 'outgoing' }) as Connection,
  ),
);

function Harness() {
  const [selection, setSelection] = useState<ConnectionSelection>(NO_SELECTION);
  return (
    <ConnectionFilter
      here={PS_1_6}
      index={INDEX}
      translation={TRANSLATION}
      entries={ENTRIES}
      selection={selection}
      shown={ENTRIES.filter((entry) => isSelected(entry, selection)).length}
      onChange={setSelection}
    />
  );
}

describe('ConnectionFilter', () => {
  it('offers the verse’s words as its translation says them, and counts what is left', async () => {
    render(<Harness />);
    expect(screen.getByText('3 of 3 linked passages')).toBeDefined();
    const righteous = screen.getByRole('checkbox', { name: /sprawiedliwych/ });
    expect(screen.getByText('צַדִּיק')).toBeDefined();
    // "Way" is in no linked passage, so it is not offered.
    expect(screen.queryByText('דֶּרֶךְ')).toBeNull();

    await userEvent.click(righteous);
    expect(screen.getByText('2 of 3 linked passages')).toBeDefined();
    expect(screen.getByText('2 / 3')).toBeDefined();

    await userEvent.click(screen.getByRole('checkbox', { name: /same meaning/ }));
    expect(screen.getByText('1 of 3 linked passages')).toBeDefined();

    await userEvent.click(screen.getByRole('checkbox', { name: /thematic/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /same meaning/ }));
    expect(screen.getByText('No linked passage matches.')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('3 of 3 linked passages')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});
