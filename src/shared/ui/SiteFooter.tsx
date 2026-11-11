import type { ReactNode } from 'react';
import { useLocalization } from '../../i18n/use-locale.tsx';
import { SourceCodeIcon } from './icons.tsx';
import { InstallLink } from './InstallGuide.tsx';
import styles from './SiteFooter.module.css';

const YEAR = new Date().getFullYear();

/** Where this version's code lives. The project is open source, so every page points at it. */
const REPOSITORY_URL = 'https://github.com/mattyjaros/bible-cross-references';

/** The project this site is a modified version of. */
const ORIGINAL_URL = 'https://github.com/trekhleb/bible-cross-references';

interface SiteFooterProps {
  /** Page-specific credits, such as data attribution. */
  readonly children?: ReactNode;
  /** Extra class for page-specific spacing (CSS Modules class names may be undefined). */
  readonly className?: string | undefined;
}

/**
 * The minimal site-wide footer: the year, a note that this is a modified version, the source and
 * how to install the app, plus credits.
 */
export function SiteFooter({ children, className }: SiteFooterProps) {
  const { t } = useLocalization();
  return (
    <footer className={className ? `${styles.footer} ${className}` : styles.footer}>
      <span className={styles.owner}>
        <span className={styles.copyright}>© {YEAR} · </span>
        <a href={ORIGINAL_URL} target="_blank" rel="noreferrer" title={t('footer.original')}>
          {t('footer.modified')}
        </a>{' '}
        ·{' '}
        <a
          className={styles.source}
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          title={t('footer.source')}
          aria-label={t('footer.source')}
        >
          <SourceCodeIcon />
          <span className={styles.sourceLabel}>{t('footer.sourceLabel')}</span>
        </a>{' '}
        <InstallLink />
      </span>
      {children !== undefined && <span className={styles.credits}>{children}</span>}
    </footer>
  );
}
