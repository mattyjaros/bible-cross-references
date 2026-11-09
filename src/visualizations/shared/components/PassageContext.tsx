import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { formatVerseIndexRange } from '../../../core/bible/reference-format.ts';
import type { VerseIndex } from '../../../core/bible/verse-ref.ts';
import type { Versification } from '../../../core/bible/versification.ts';
import { useLocalization } from '../../../i18n/use-locale.tsx';
import { CloseIcon } from '../../../shared/ui/icons.tsx';
import type { Translation } from '../../../translations/translation.ts';
import { verseTextOrNote } from '../../../translations/verse-text.ts';
import type { AlignedSpan } from '../../../words/translation-alignment.ts';
import { markedText } from './LinkEvidence.tsx';
import styles from './PassageContext.module.css';

/** Verses shown on each side of the passage when it opens. */
const CONTEXT_VERSES = 5;
/** Verses each "earlier" or "later" adds. */
const CONTEXT_STEP = 10;

/**
 * A linked passage shown among the verses around it, without leaving the verse being studied.
 * The reader can load more verses either way, or go to the passage.
 */
export function PassageContext({
  translation,
  versification,
  start,
  end,
  marks,
  onGo,
  onClose,
}: {
  readonly translation: Translation;
  readonly versification: Versification;
  readonly start: VerseIndex;
  readonly end: VerseIndex;
  /** Where in a verse the words this passage shares with the one being read stand. */
  readonly marks?: ((verse: VerseIndex) => readonly AlignedSpan[]) | undefined;
  readonly onGo: () => void;
  readonly onClose: () => void;
}) {
  const { t, books, n } = useLocalization();
  const book = versification.bookRange(versification.bookAt(start).id);
  const [from, setFrom] = useState(Math.max(book.start, start - CONTEXT_VERSES));
  const [to, setTo] = useState(Math.min(book.end, end + CONTEXT_VERSES));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLDivElement>(null);
  /** The text's height before earlier verses were added above it, to keep the reader's place. */
  const heightBefore = useRef<number | null>(null);

  // Opened once the content is there, with the passage in the middle of what is shown.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const text = textRef.current;
    const passage = passageRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    if (text && passage) {
      text.scrollTop = passage.offsetTop - text.offsetTop - text.clientHeight / 3;
    }
  }, []);

  // Keeps the reader's place when earlier verses are added above.
  useLayoutEffect(() => {
    const text = textRef.current;
    if (text && heightBefore.current !== null) {
      text.scrollTop += text.scrollHeight - heightBefore.current;
      heightBefore.current = null;
    }
  }, [from]);

  const lang = translation.manifest.language;
  const dir = translation.manifest.direction;
  const verses = Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
  // Marks only inside the passage; the same word in the surrounding verses is not the link.
  const textOf = (verse: VerseIndex) =>
    marks && verse >= start && verse <= end && !translation.isOmitted(verse)
      ? markedText(translation.verseText(verse), marks(verse))
      : verseTextOrNote(translation, verse);
  const verse = (index: VerseIndex) => {
    const ref = versification.refAt(index);
    return (
      <Fragment key={index}>
        {(ref.verse === 1 || index === from) && (
          <span className={styles.chapter}>{t('context.chapter')(n(ref.chapter))}</span>
        )}
        <span className={styles.verse}>
          <sup className={styles.verseMark}>{n(ref.verse)}</sup>
          {textOf(index)}{' '}
        </span>
      </Fragment>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={formatVerseIndexRange(versification, books, start, end)}
      onClick={(event) => {
        // A tap on the backdrop closes it, as with the other dialogs.
        if (event.target === dialogRef.current) {
          dialogRef.current.close();
        }
      }}
      onClose={onClose}
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            {formatVerseIndexRange(versification, books, start, end)}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={t('panel.close')}
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            <CloseIcon />
          </button>
        </header>
        <div ref={textRef} className={styles.text} lang={lang} dir={dir}>
          {from > book.start && (
            <button
              type="button"
              className={styles.more}
              onClick={() => {
                heightBefore.current = textRef.current?.scrollHeight ?? null;
                setFrom(Math.max(book.start, from - CONTEXT_STEP));
              }}
            >
              {t('context.earlier')}
            </button>
          )}
          <p className={styles.verses}>{verses.filter((index) => index < start).map(verse)}</p>
          <div ref={passageRef} className={styles.passage}>
            <p className={styles.verses}>
              {verses.filter((index) => index >= start && index <= end).map(verse)}
            </p>
          </div>
          <p className={styles.verses}>{verses.filter((index) => index > end).map(verse)}</p>
          {to < book.end && (
            <button
              type="button"
              className={styles.more}
              onClick={() => {
                setTo(Math.min(book.end, to + CONTEXT_STEP));
              }}
            >
              {t('context.later')}
            </button>
          )}
        </div>
        <button type="button" className={styles.go} onClick={onGo}>
          {t('context.open')}
        </button>
      </div>
    </dialog>
  );
}
