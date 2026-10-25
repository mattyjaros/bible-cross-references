import { useEffect, useMemo, useState } from 'react';
import { formatVerseRef } from '../../../core/bible/reference-format.ts';
import type { VerseIndex } from '../../../core/bible/verse-ref.ts';
import type { Versification } from '../../../core/bible/versification.ts';
import { useLocalization } from '../../../i18n/use-locale.tsx';
import { ExpandIcon } from '../../../shared/ui/icons.tsx';
import { localizedGloss, useGlosses, type GlossTable } from '../../../words/glosses.ts';
import { describeGrammar } from '../../../words/grammar.ts';
import { linkEvidence } from '../../../words/link-evidence.ts';
import type { WordOccurrences } from '../../../words/load-word-occurrences.ts';
import type { OriginalWord, OriginalWordIndex } from '../../../words/original-words.ts';
import type { Connection } from '../connections.ts';
import { wordOccurrencesLoader } from '../viz-data.ts';
import { useOriginalWords } from './OriginalWordsSection.tsx';
import styles from './PassagePanel.module.css';

/** More shared words than this are a list nobody reads; the rarest say the most. */
const MAX_WORDS = 3;

/** The occurrences, fetched the first time a reader opens any link's evidence. */
function useWordOccurrences(wanted: boolean): WordOccurrences | null {
  const [occurrences, setOccurrences] = useState<WordOccurrences | null>(null);
  useEffect(() => {
    if (!wanted || occurrences) {
      return undefined;
    }
    let current = true;
    wordOccurrencesLoader.load().then(
      (loaded) => {
        if (current) {
          setOccurrences(loaded);
        }
      },
      () => {
        // Forgotten, so opening the evidence again asks again; the summary is still shown.
        wordOccurrencesLoader.reset();
      },
    );
    return () => {
      current = false;
    };
  }, [wanted, occurrences]);
  return occurrences;
}

function scriptOf(word: OriginalWord): { readonly lang: string; readonly dir: 'rtl' | 'ltr' } {
  return word.strongs.startsWith('H') ? { lang: 'he', dir: 'rtl' } : { lang: 'el', dir: 'ltr' };
}

/** How a word is used in one verse: where, the English it is given there, and its grammar. */
function WordUseLine({
  word,
  verse,
  index,
  occurrences,
  versification,
}: {
  readonly word: OriginalWord;
  readonly verse: VerseIndex;
  readonly index: OriginalWordIndex;
  readonly occurrences: WordOccurrences | null;
  readonly versification: Versification;
}) {
  const { t, books, locale } = useLocalization();
  const entry = index.entryOf(word.index, verse);
  const use = occurrences && entry !== null ? occurrences.useAt(entry) : null;
  return (
    <div className={styles.evidenceUse}>
      <span className={styles.evidenceUseRef}>
        {formatVerseRef(versification.refAt(verse), books)}
      </span>
      {use ? (
        <>
          <span className={styles.evidenceEnglish} lang="en">
            {use.english}
          </span>
          <span className={styles.muted}>{describeGrammar(use.grammar, locale.id)}</span>
        </>
      ) : (
        <span className={styles.muted}>{t('evidence.loading')}</span>
      )}
    </div>
  );
}

/** The dictionary word: its form, how it is said, what it means and how rare it is. */
function WordHeading({
  word,
  glosses,
}: {
  readonly word: OriginalWord;
  readonly glosses: GlossTable | null;
}) {
  const { t, n } = useLocalization();
  const { lang, dir } = scriptOf(word);
  return (
    <p className={styles.evidenceWord}>
      <strong lang={lang} dir={dir}>
        {word.lemma}
      </strong>
      <span className={styles.wordSound}>{word.transliteration}</span>
      <span>{localizedGloss(word, glosses)}</span>
      <span className={styles.count}>
        {t('evidence.verses')(n(word.verseCount), word.verseCount)}
      </span>
    </p>
  );
}

/** The first verse of a linked passage that uses a word. */
function firstVerseWith(
  word: OriginalWord,
  index: OriginalWordIndex,
  start: VerseIndex,
  end: VerseIndex,
) {
  for (let verse = start; verse <= end; verse += 1) {
    if (index.entryOf(word.index, verse) !== null) {
      return verse;
    }
  }
  return start;
}

/**
 * What links a passage to one of its cross-references, in the original languages: a badge that
 * says what kind of link it is, opening on what the two passages share. Worked out when the
 * badge is drawn, from words that are already loaded; how each word is used is fetched only when
 * a reader opens one.
 */
export function LinkEvidence({
  connection,
  versification,
}: {
  readonly connection: Connection;
  readonly versification: Versification;
}) {
  const { t, locale } = useLocalization();
  const words = useOriginalWords();
  const glosses = useGlosses(locale.id);
  const [open, setOpen] = useState(false);
  const occurrences = useWordOccurrences(open);
  const index = words?.index ?? null;
  const evidence = useMemo(
    () =>
      index
        ? linkEvidence(index, connection.here, connection.otherStart, connection.otherEnd)
        : null,
    [index, connection.here, connection.otherStart, connection.otherEnd],
  );
  if (!index || !evidence) {
    return null;
  }

  const label =
    evidence.kind === 'shared-word'
      ? t('evidence.sharedWord')(evidence.words[0]?.lemma ?? '')
      : evidence.kind === 'same-meaning'
        ? t('evidence.sameMeaning')(
            // The first sense is the one the words were matched on.
            localizedGloss(evidence.pairs[0]?.here ?? { strongs: '', gloss: '' }, glosses).split(
              ' / ',
            )[0] ?? '',
          )
        : t('evidence.thematic');

  // A shared word used in a few dozen verses says more than one used in a thousand, and the badge
  // says so by its weight: the rare word is the strong evidence, the common one a weaker hint.
  const strength =
    evidence.kind === 'shared-word'
      ? (evidence.words[0]?.verseCount ?? 0) <= (words?.maxVerses ?? 0)
        ? 'shared-word'
        : 'shared-common-word'
      : evidence.kind;

  return (
    <div className={styles.evidence}>
      <button
        type="button"
        className={`${styles.evidenceBadge} ${styles[`evidence-${strength}`] ?? ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {label}
        <ExpandIcon className={styles.chevron} />
      </button>
      {open && (
        <div className={styles.evidenceDetails}>
          {evidence.kind === 'shared-word' && (
            <>
              <p className={styles.muted}>{t('evidence.sharedWord.note')}</p>
              {evidence.words.slice(0, MAX_WORDS).map((word) => (
                <div key={word.strongs} className={styles.evidenceItem}>
                  <WordHeading word={word} glosses={glosses} />
                  <WordUseLine
                    word={word}
                    verse={connection.here}
                    index={index}
                    occurrences={occurrences}
                    versification={versification}
                  />
                  <WordUseLine
                    word={word}
                    verse={firstVerseWith(word, index, connection.otherStart, connection.otherEnd)}
                    index={index}
                    occurrences={occurrences}
                    versification={versification}
                  />
                </div>
              ))}
            </>
          )}
          {evidence.kind === 'same-meaning' && (
            <>
              <p className={styles.muted}>{t('evidence.sameMeaning.note')}</p>
              {evidence.pairs.slice(0, MAX_WORDS).map(({ here, there }) => (
                <div key={`${here.strongs}-${there.strongs}`} className={styles.evidenceItem}>
                  <WordHeading word={here} glosses={glosses} />
                  <WordUseLine
                    word={here}
                    verse={connection.here}
                    index={index}
                    occurrences={occurrences}
                    versification={versification}
                  />
                  <WordHeading word={there} glosses={glosses} />
                  <WordUseLine
                    word={there}
                    verse={firstVerseWith(there, index, connection.otherStart, connection.otherEnd)}
                    index={index}
                    occurrences={occurrences}
                    versification={versification}
                  />
                </div>
              ))}
            </>
          )}
          {evidence.kind === 'thematic' && (
            <p className={styles.muted}>{t('evidence.thematic.note')}</p>
          )}
        </div>
      )}
    </div>
  );
}
