import type { VerseIndex } from '../../../core/bible/verse-ref.ts';
import { useLocalization } from '../../../i18n/use-locale.tsx';
import { FiltersIcon } from '../../../shared/ui/icons.tsx';
import type { Translation } from '../../../translations/translation.ts';
import { localizedGloss, useGlosses } from '../../../words/glosses.ts';
import type { OriginalWordIndex } from '../../../words/original-words.ts';
import { alignerFor } from '../../../words/translation-alignment.ts';
import {
  EVIDENCE_KINDS,
  isSelecting,
  kindCounts,
  toggled,
  wordOptions,
  type ConnectionSelection,
  type ConnectionWords,
  type EvidenceKind,
} from '../connection-selection.ts';
import { PanelSection } from './PanelSection.tsx';
import styles from './PassagePanel.module.css';

/**
 * Narrows a verse's links to those that share a chosen word with it, or are of a chosen kind.
 * Each word is named as the reader's translation has it in this verse, with the original beside it.
 */
export function ConnectionFilter({
  here,
  index,
  translation,
  entries,
  selection,
  shown,
  onChange,
}: {
  readonly here: VerseIndex;
  readonly index: OriginalWordIndex;
  readonly translation: Translation;
  /** Every link of the verse, with what it has in common with it. */
  readonly entries: readonly ConnectionWords[];
  readonly selection: ConnectionSelection;
  /** How many of them the selection lets through. */
  readonly shown: number;
  readonly onChange: (selection: ConnectionSelection) => void;
}) {
  const { t, n, locale } = useLocalization();
  const glosses = useGlosses(locale.id);
  const aligned = alignerFor(translation, index, translation.versification.verseCount).align(here);
  const words = wordOptions(index, here, entries)
    .map((option) => ({ ...option, span: aligned.get(option.word.index) }))
    // In the order the verse says them; a word the translation could not be matched to, last.
    .sort((a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity));
  const kinds = kindCounts(entries);
  const kindName: Record<EvidenceKind, string> = {
    'shared-word': t('linkFilter.sharedWord'),
    'same-meaning': t('linkFilter.sameMeaning'),
    thematic: t('evidence.thematic'),
  };
  const selecting = isSelecting(selection);

  return (
    <PanelSection
      id="link-filter"
      icon={FiltersIcon}
      title={t('linkFilter.title')}
      description={t('linkFilter.note')}
      trailing={
        selecting && (
          <span className={styles.filterTally}>
            {n(shown)} / {n(entries.length)}
          </span>
        )
      }
    >
      <p className={styles.filterSummary} role="status">
        <span>{t('linkFilter.shown')(n(shown), n(entries.length), entries.length)}</span>
        {selecting && (
          <button
            type="button"
            className={styles.filterClear}
            onClick={() => {
              onChange({ words: new Set(), kinds: new Set() });
            }}
          >
            {t('linkFilter.clear')}
          </button>
        )}
      </p>
      {words.length > 0 && (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>
            {t('linkFilter.words')}
            <span className={styles.muted}> · {t('linkFilter.wordsNote')}</span>
          </legend>
          {words.map(({ word, count, span }) => {
            const script = word.strongs.startsWith('H')
              ? { lang: 'he', dir: 'rtl' as const }
              : { lang: 'el', dir: 'ltr' as const };
            return (
              <label key={word.index} className={styles.filterOption}>
                <input
                  type="checkbox"
                  checked={selection.words.has(word.index)}
                  onChange={() => {
                    onChange({ ...selection, words: toggled(selection.words, word.index) });
                  }}
                />
                <span lang={translation.manifest.language}>
                  {span?.text ?? localizedGloss(word, glosses).split(' / ')[0]}
                </span>
                <span className={styles.filterOriginal} lang={script.lang} dir={script.dir}>
                  {word.lemma}
                </span>
                <span className={styles.count}>{n(count)}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLegend}>{t('linkFilter.kinds')}</legend>
        {EVIDENCE_KINDS.map((kind) => (
          <label key={kind} className={styles.filterOption}>
            <input
              type="checkbox"
              checked={selection.kinds.has(kind)}
              disabled={(kinds.get(kind) ?? 0) === 0}
              onChange={() => {
                onChange({ ...selection, kinds: toggled(selection.kinds, kind) });
              }}
            />
            <span>{kindName[kind]}</span>
            <span className={styles.count}>{n(kinds.get(kind) ?? 0)}</span>
          </label>
        ))}
      </fieldset>
      {selecting && shown === 0 && <p className={styles.muted}>{t('linkFilter.none')}</p>}
    </PanelSection>
  );
}
