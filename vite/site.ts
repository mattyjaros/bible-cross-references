import { resolve } from 'node:path';
import type { HtmlTagDescriptor } from 'vite';
import { DEFAULT_LOCALE_ID, LOCALE_IDS, type LocaleId } from '../src/i18n/locale-id.ts';
import { localePathSegment } from '../src/i18n/locale-path.ts';
import {
  SITE_COPY,
  SITE_PAGE_IDS,
  SITE_PAGE_PATHS,
  type SitePageId,
} from '../src/i18n/site-copy.ts';

/**
 * Facts about the site that the build uses: its name, where it is served, its pages, and the
 * helpers the plugins in this folder share.
 */

/** The project's root directory. */
export const ROOT_DIR = resolve(import.meta.dirname, '..');

/** The site's name: `import.meta.env.SITE_NAME` in code, `%SITE_NAME%` in the HTML entries. */
export const SITE_NAME = 'Bible Cross-References';

/**
 * Where the built site is served. GitHub Pages serves this repository (bible-cross-references) at
 * trekhleb.dev/bible-cross-references/, under the owner's custom domain. Set `BASE_PATH` and
 * `SITE_ORIGIN` to build for another location, e.g. `BASE_PATH=/` for the root of a domain.
 */
export const DEPLOY_BASE = '/bible-cross-references/';
export const SITE_ORIGIN = process.env['SITE_ORIGIN'] ?? 'https://trekhleb.dev';

/**
 * A base path always ends in a slash. Vite normalizes its own, but `SITE_URL` is built here and
 * is what absolute share links are resolved against: without the slash, `new URL('pt/…', '…/foo')`
 * replaces `foo` instead of extending it, so a Portuguese link shared from a build at
 * `BASE_PATH=/foo` would point at `/pt/…` and 404.
 */
function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}
/**
 * The published site, e.g. `https://trekhleb.dev/bible-cross-references/`. Links meant for others
 * (copied quotes) point here even from the dev server, which runs at the root.
 */
export const SITE_URL = new URL(
  withTrailingSlash(process.env['BASE_PATH'] ?? DEPLOY_BASE),
  SITE_ORIGIN,
).href;

/**
 * The size every share picture is drawn at: twice the usual 1200×630, so it stays sharp on
 * high-density screens after platforms scale it down. Which file a page points at depends on its
 * language — see `SITE_COPY[locale].socialImage`.
 */
export const SOCIAL_IMAGE_SIZE = { width: 2400, height: 1260 } as const;

interface AnyPage {
  /** The HTML file, relative to the project root, e.g. `pt/threads/index.html`. */
  readonly entry: string;
  readonly locale: LocaleId;
}

/**
 * A page the site publishes: in the sitemap, open to search engines, and one of a set that
 * exists in every language.
 *
 * `listed` is the discriminant rather than a plain boolean so that narrowing on it also narrows
 * `id` away from `debug` — which is what lets a plugin read the page's own translated copy
 * (`SITE_COPY[locale].pages[id]`) without a runtime check for a case that cannot happen.
 */
export interface ListedPage extends AnyPage {
  /** Which page this is, the same in every language. */
  readonly id: SitePageId;
  readonly listed: true;
  /** Part of the installable app: gets the web manifest and a place in the offline cache. */
  readonly app: true;
}

/** The debug page: English only, `noindex`, not installable, and in no sitemap. */
export interface UnlistedPage extends AnyPage {
  readonly id: 'debug';
  readonly listed: false;
  readonly app: false;
}

export type Page = ListedPage | UnlistedPage;

/**
 * The site's pages: every view in every language, plus the English-only debug page.
 *
 * The home page and `threads/` are the same app (src/app/views.ts), each with its own HTML file
 * so that links straight into either view work on a static host. Each language then has its own
 * copy of both, at its own path, because the head of an HTML file is the only place a link
 * preview or a crawler ever looks — see `src/i18n/locale-path.ts`.
 *
 * Generated rather than listed, so that adding a language to `LOCALE_IDS` adds its pages here,
 * its entries to the sitemap, its manifest, and its place in the offline cache, with nothing to
 * remember.
 */
function buildPages(): Readonly<Record<string, Page>> {
  const pages: Record<string, Page> = {};
  for (const locale of LOCALE_IDS) {
    for (const id of SITE_PAGE_IDS) {
      const entry = `${localePathSegment(locale)}${SITE_PAGE_PATHS[id]}index.html`;
      const key = locale === DEFAULT_LOCALE_ID ? id : `${id}.${locale}`;
      pages[key] = { id, entry, listed: true, app: true, locale };
    }
  }
  pages['debug'] = {
    id: 'debug',
    entry: 'debug/index.html',
    listed: false,
    app: false,
    locale: DEFAULT_LOCALE_ID,
  };
  return pages;
}

export const PAGES: Readonly<Record<string, Page>> = buildPages();

/** Every page, in a stable order. */
export const PAGE_LIST: readonly Page[] = Object.values(PAGES);

/** The page an HTML transform is working on, from its public path (e.g. `/pt/threads/index.html`). */
export function pageOf(path: string): Page | undefined {
  return PAGE_LIST.find(({ entry }) => `/${entry}` === path);
}

/** The public URL of a page, e.g. `https://trekhleb.dev/bible-cross-references/pt/threads/`. */
export function pageUrl(page: Page, base: string): string {
  return new URL(`${base}${page.entry.replace(/index\.html$/, '')}`, SITE_ORIGIN).href;
}

/**
 * The same page in every language, the default language first.
 *
 * This is what `hreflang` is built from, and the order matters only in that the default language
 * is also `x-default`: the page a reader is sent to when none of the languages match theirs.
 */
export function translationsOf(page: Page): readonly Page[] {
  if (page.id === 'debug') {
    return [];
  }
  return PAGE_LIST.filter((candidate) => candidate.id === page.id && candidate.listed).toSorted(
    (a, b) =>
      a.locale === DEFAULT_LOCALE_ID
        ? -1
        : b.locale === DEFAULT_LOCALE_ID
          ? 1
          : a.locale.localeCompare(b.locale),
  );
}

/** The share picture a page points at, with the size every one of them is drawn at. */
export function socialImageOf(page: Page) {
  return { ...SITE_COPY[page.locale].socialImage, ...SOCIAL_IMAGE_SIZE };
}

/** Places tags after the page's own, so `<meta charset>` stays first in the head, as it must. */
export function atEndOfHead(tags: readonly HtmlTagDescriptor[]): HtmlTagDescriptor[] {
  return tags.map((tag) => ({ ...tag, injectTo: 'head' }));
}
