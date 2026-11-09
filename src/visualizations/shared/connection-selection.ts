import type { VerseIndex } from '../../core/bible/verse-ref.ts';
import { linkEvidence, type LinkEvidence } from '../../words/link-evidence.ts';
import type { OriginalWord, OriginalWordIndex } from '../../words/original-words.ts';
import type { Connection } from './connections.ts';

export type EvidenceKind = LinkEvidence['kind'];

export const EVIDENCE_KINDS: readonly EvidenceKind[] = ['shared-word', 'same-meaning', 'thematic'];

/**
 * The words of the verse being read that a linked passage also has: the same dictionary word, or
 * a word glossed alike — Hebrew צַדִּיק followed into the New Testament is Greek δίκαιος.
 */
export function wordsInCommon(evidence: LinkEvidence): ReadonlySet<number> {
  const pairs =
    evidence.kind === 'shared-word'
      ? [...evidence.pairs, ...evidence.alike]
      : evidence.kind === 'same-meaning'
        ? evidence.pairs
        : [];
  return new Set(pairs.map((pair) => pair.here.index));
}

/** What each connection of a verse has in common with it, worked out once per list. */
export interface ConnectionWords {
  readonly connection: Connection;
  readonly kind: EvidenceKind;
  readonly words: ReadonlySet<number>;
}

export function connectionWords(
  index: OriginalWordIndex,
  connections: readonly Connection[],
): readonly ConnectionWords[] {
  return connections.map((connection) => {
    const evidence = linkEvidence(
      index,
      connection.here,
      connection.otherStart,
      connection.otherEnd,
    );
    return { connection, kind: evidence.kind, words: wordsInCommon(evidence) };
  });
}

/**
 * What the reader has chosen to see: any of the chosen words, and any of the chosen kinds. An
 * empty group does not filter.
 */
export interface ConnectionSelection {
  readonly words: ReadonlySet<number>;
  readonly kinds: ReadonlySet<EvidenceKind>;
}

export const NO_SELECTION: ConnectionSelection = { words: new Set(), kinds: new Set() };

export function isSelecting(selection: ConnectionSelection): boolean {
  return selection.words.size > 0 || selection.kinds.size > 0;
}

export function isSelected(entry: ConnectionWords, selection: ConnectionSelection): boolean {
  const byWord =
    selection.words.size === 0 || [...selection.words].some((word) => entry.words.has(word));
  const byKind = selection.kinds.size === 0 || selection.kinds.has(entry.kind);
  return byWord && byKind;
}

/** A word of the verse that can be chosen, and how many of its links have it. */
export interface WordOption {
  readonly word: OriginalWord;
  readonly count: number;
}

/** The verse's words that at least one of its links has, rarest first. */
export function wordOptions(
  index: OriginalWordIndex,
  here: VerseIndex,
  entries: readonly ConnectionWords[],
): readonly WordOption[] {
  return index
    .wordsOf(here)
    .map((word) => ({
      word,
      count: entries.filter((entry) => entry.words.has(word.index)).length,
    }))
    .filter((option) => option.count > 0);
}

/** How many links of each kind the verse has. */
export function kindCounts(entries: readonly ConnectionWords[]): ReadonlyMap<EvidenceKind, number> {
  const counts = new Map<EvidenceKind, number>(EVIDENCE_KINDS.map((kind) => [kind, 0]));
  for (const entry of entries) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  return counts;
}

/** One choice switched on or off. */
export function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}
