import { describe, expect, it } from 'vitest';
import type { OriginalWordColumns } from '../core/datasets/formats.ts';
import { OriginalWordIndex } from './original-words.ts';
import { dictionaryWord, linkEvidence, meaningKey, meaningKeys } from './link-evidence.ts';

/**
 * Six verses. Verses 0 and 1 share a rare Greek word and a commoner one; verse 2 is Hebrew and
 * means "peace" where verse 3 says it in Greek; verse 4 has nothing in common with anything.
 */
function index(): OriginalWordIndex {
  const columns: OriginalWordColumns = {
    strongs: ['G0001', 'G0002', 'G1515', 'H7965', 'H0001'],
    lemma: ['ἄλφα', 'βῆτα', 'εἰρήνη', 'שָׁלוֹם', 'אָב'],
    transliteration: ['alpha', 'bēta', 'eirēnē', 'shalom', 'av'],
    gloss: ['only begotten', 'to love', 'peace', 'peace / friendship', 'father'],
    //        G0001   G0002     G1515  H7965  H0001
    offsets: [0, 2, 5, 6, 7, 8],
    verses: [0, 1, 0, 1, 5, 3, 2, 4],
  };
  return new OriginalWordIndex(columns, 6);
}

describe('linkEvidence', () => {
  it('finds the words both passages use, the rarest first', () => {
    const evidence = linkEvidence(index(), 0, 1, 1);
    expect(evidence.kind).toBe('shared-word');
    if (evidence.kind === 'shared-word') {
      expect(evidence.pairs.map(({ here }) => here.strongs)).toEqual(['G0001', 'G0002']);
      expect(evidence.alike).toEqual([]);
    }
  });

  it('looks across every verse of a linked passage', () => {
    expect(linkEvidence(index(), 5, 0, 1).kind).toBe('shared-word');
  });

  it('falls back to words that mean the same, which is all two Testaments can share', () => {
    const evidence = linkEvidence(index(), 2, 3, 3);
    expect(evidence.kind).toBe('same-meaning');
    if (evidence.kind === 'same-meaning') {
      expect(evidence.pairs.map(({ here, there }) => [here.strongs, there.strongs])).toEqual([
        ['H7965', 'G1515'],
      ]);
    }
  });

  it('shares a word whose two verses use it in different senses', () => {
    // דֶּרֶךְ as "way / conduct" in verse 0 and "way / road" in verse 1, and "to know" in both
    // under one number; verse 0 also says "father", which verse 1 says with another word.
    const senses = new OriginalWordIndex(
      {
        strongs: ['H1870G', 'H1870K', 'H3045', 'H0001', 'H0002'],
        lemma: ['דֶּרֶךְ', 'דֶּרֶךְ', 'יָדַע', 'אָב', 'אַבָּא'],
        transliteration: ['derekh', 'derekh', 'yada', 'av', 'abba'],
        gloss: ['way / conduct', 'way / road', 'to know', 'father', 'father'],
        offsets: [0, 1, 2, 4, 5, 6],
        verses: [0, 1, 0, 1, 0, 1],
      },
      2,
    );
    const evidence = linkEvidence(senses, 0, 1, 1);
    expect(evidence.kind).toBe('shared-word');
    if (evidence.kind === 'shared-word') {
      expect(evidence.pairs.map(({ here, there }) => [here.strongs, there.strongs])).toEqual([
        ['H1870G', 'H1870K'],
        ['H3045', 'H3045'],
      ]);
      expect(evidence.alike.map(({ here, there }) => [here.strongs, there.strongs])).toEqual([
        ['H0001', 'H0002'],
      ]);
    }
  });

  it('says plainly when the passages have no word in common', () => {
    expect(linkEvidence(index(), 4, 0, 0)).toEqual({ kind: 'thematic' });
  });
});

describe('meaningKey', () => {
  it('compares a verb with or without its infinitive marker', () => {
    expect(meaningKey('to love')).toBe(meaningKey('love'));
    expect(meaningKey('to be holy')).toBe('holy');
  });

  it('compares the first sense only, without notes in brackets', () => {
    expect(meaningKey('peace / friendship')).toBe('peace');
    expect(meaningKey('Valley (of Beracah)')).toBe('valley');
    expect(meaningKey('voice / [sound of]')).toBe('voice');
  });
});

describe('OriginalWordIndex.entryOf', () => {
  it('finds where a word and one of its verses sit in the dataset', () => {
    expect(index().entryOf(1, 5)).toBe(4);
    expect(index().entryOf(0, 0)).toBe(0);
  });

  it('has no entry for a verse the word is not in', () => {
    expect(index().entryOf(1, 3)).toBeNull();
  });
});

describe('meaningKeys', () => {
  it('offers each alternative of a first sense written with a slash', () => {
    expect(meaningKeys('near/neighbor')).toEqual(['near/neighbor', 'near', 'neighbor']);
    expect(meaningKeys('neighbor')).toEqual(['neighbor']);
  });
});

describe('dictionaryWord', () => {
  it('drops the letter that names a sense', () => {
    expect(dictionaryWord('H1870G')).toBe('H1870');
    expect(dictionaryWord('G0025')).toBe('G0025');
    expect(dictionaryWord('unknown')).toBe('unknown');
  });
});
