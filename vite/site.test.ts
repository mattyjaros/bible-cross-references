import { describe, expect, it } from 'vitest';
import {
  atEndOfHead,
  DEPLOY_BASE,
  PAGE_LIST,
  pageOf,
  pageUrl,
  SITE_NAME,
  SITE_URL,
  socialImageOf,
  translationsOf,
} from './site.ts';
import { DEFAULT_LOCALE_ID, LOCALE_IDS } from '../src/i18n/locale-id.ts';
import { SITE_PAGE_IDS, SITE_PAGE_PATHS } from '../src/i18n/site-copy.ts';

describe('the site', () => {
  it('is published under its own path of a shared domain', () => {
    expect(DEPLOY_BASE).toBe('/bible-cross-references/');
    expect(SITE_URL.endsWith(DEPLOY_BASE)).toBe(true);
    expect(SITE_URL.startsWith('https://')).toBe(true);
  });

  it('names itself', () => {
    expect(SITE_NAME).toBe('Bible Cross-References');
    for (const page of PAGE_LIST) {
      const social = socialImageOf(page);
      expect(social.file).toMatch(/\.(png|jpe?g)$/);
      expect(social.width).toBeGreaterThan(social.height);
      expect(social.alt).toBeTruthy();
    }
  });
});

describe('the languages a page comes in', () => {
  it('gives every view a page in every language', () => {
    for (const id of SITE_PAGE_IDS) {
      for (const locale of LOCALE_IDS) {
        expect(
          PAGE_LIST.some((page) => page.id === id && page.locale === locale),
          `${id} in ${locale}`,
        ).toBe(true);
      }
    }
  });

  it('serves the default language from the bare path and every other from its own', () => {
    for (const page of PAGE_LIST) {
      if (page.id === 'debug') {
        continue;
      }
      const expected = page.locale === DEFAULT_LOCALE_ID ? false : true;
      expect(page.entry.startsWith(`${page.locale}/`), page.entry).toBe(expected);
    }
  });

  it('points every language of a page at every other, itself included', () => {
    for (const page of PAGE_LIST.filter(({ listed }) => listed)) {
      const alternates = translationsOf(page);
      expect(alternates).toContain(page);
      expect(alternates.map(({ locale }) => locale).toSorted()).toEqual([...LOCALE_IDS].toSorted());
      // Reciprocal: search engines drop a set of alternates that does not point both ways.
      for (const alternate of alternates) {
        expect(translationsOf(alternate)).toContain(page);
      }
    }
  });

  it('has no alternates for a page that exists in one language only', () => {
    const debug = PAGE_LIST.find(({ id }) => id === 'debug');
    expect(debug && translationsOf(debug)).toEqual([]);
  });

  it('keeps language ids and page paths from colliding', () => {
    // A page is published at `<locale>/<page path>`, so a language id that matched a page path
    // would give two pages the same entry file: `pageOf` would resolve both to the first, and
    // the bundler would be handed the same input twice.
    const paths = new Set(
      SITE_PAGE_IDS.map((id) => SITE_PAGE_PATHS[id].replace(/\/$/, '')).filter(
        (path) => path !== '',
      ),
    );
    for (const locale of LOCALE_IDS) {
      expect(paths.has(locale), `${locale} is also a page path`).toBe(false);
    }
    expect(new Set(PAGE_LIST.map(({ entry }) => entry)).size).toBe(PAGE_LIST.length);
  });

  it('gives each page a URL of its own', () => {
    const urls = PAGE_LIST.map((page) => pageUrl(page, '/base/'));
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('PAGES', () => {
  it("lists the app's pages in every language, and the debug page", () => {
    expect(PAGE_LIST.length).toBe(SITE_PAGE_IDS.length * LOCALE_IDS.length + 1);
    expect(PAGE_LIST.filter((page) => page.app).length).toBe(
      SITE_PAGE_IDS.length * LOCALE_IDS.length,
    );
    expect(PAGE_LIST.some((page) => !page.app)).toBe(true);
  });

  it('gives every page an entry HTML file', () => {
    for (const page of PAGE_LIST) {
      expect(page.entry.endsWith('index.html')).toBe(true);
    }
  });
});

describe('pageOf', () => {
  it('finds a page by the path Vite hands it', () => {
    for (const page of PAGE_LIST) {
      expect(pageOf(`/${page.entry}`)).toBe(page);
    }
  });

  it('is undefined for anything that is not a page', () => {
    expect(pageOf('/some/other.html')).toBeUndefined();
    expect(pageOf('')).toBeUndefined();
  });
});

describe('pageUrl', () => {
  it('joins a page onto the base it is served from', () => {
    const [page] = PAGE_LIST;
    expect(page && pageUrl(page, '/base/')).toContain('/base/');
  });

  it('drops the index.html, so a page is its directory', () => {
    for (const page of PAGE_LIST) {
      expect(pageUrl(page, '/')).not.toContain('index.html');
    }
  });
});

describe('atEndOfHead', () => {
  it('puts every tag at the end of the head', () => {
    const tags = atEndOfHead([
      { tag: 'link', attrs: { rel: 'manifest', href: '/m.webmanifest' } },
      { tag: 'meta', attrs: { name: 'x' } },
    ]);
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag.injectTo).toBe('head');
    }
  });

  it('keeps what each tag already said', () => {
    const [tag] = atEndOfHead([{ tag: 'script', children: 'console.log(1)' }]);
    expect(tag?.tag).toBe('script');
    expect(tag?.children).toBe('console.log(1)');
  });

  it('handles an empty list', () => {
    expect(atEndOfHead([])).toEqual([]);
  });
});
