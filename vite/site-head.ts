import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { defaultTranslationFor } from '../src/translations/default-for-locale.ts';
import { crossReferencesDatasetPath, translationDatasetPath } from '../src/core/datasets/paths.ts';
import { DEFAULT_LOCALE_ID, LOCALE_IDS } from '../src/i18n/locale-id.ts';
import { LOCALE_TAGS } from '../src/i18n/locale-tags.ts';
import { SITE_COPY } from '../src/i18n/site-copy.ts';
import { LOCALE_STORAGE_KEY, TRANSLATION_STORAGE_KEY } from '../src/shared/lib/preference-keys.ts';
import { TRANSLATION_MANIFESTS } from '../src/translations/registry.ts';
import { vizCrossReferenceSource } from '../src/visualizations/shared/viz-datasets.ts';
import {
  atEndOfHead,
  PAGE_LIST,
  pageOf,
  pageUrl,
  ROOT_DIR,
  SITE_ORIGIN,
  socialImageOf,
  translationsOf,
  type Page,
} from './site.ts';

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** A page's own title, for the links a reader without JavaScript is given. */
function titleOf(page: Page): string {
  return page.id === 'debug' ? page.id : SITE_COPY[page.locale].pages[page.id].title;
}

/**
 * Completes every page's head: icons and theme color; for listed pages, the canonical URL, the
 * `hreflang` links to the same page in every other language, Open Graph and Twitter card tags
 * (from the page's own title and description) and, on each language's home page, structured
 * data; for unlisted pages, `noindex`. Also writes `sitemap.xml` and `robots.txt`, and publishes
 * each language's share picture.
 */
export function siteHead(): Plugin {
  let base = '/';
  return {
    name: 'bible-cross-references:site-head',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html, context) {
      const page = pageOf(context.path);
      const tags: HtmlTagDescriptor[] = [
        { tag: 'link', attrs: { rel: 'icon', href: `${base}favicon.ico`, sizes: '32x32' } },
        { tag: 'link', attrs: { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0d0d0d' } },
      ];
      // The datasets start downloading with the page instead of after the scripts have run. Not
      // when the offline cache serves the page: it has them already, and Chrome can't hand a
      // preload over to the app's own request through a service worker (it would read them twice).
      //
      // Which Bible to preload depends on the reader, and the reader is only known here, in
      // the browser: the HTML is one file for everybody — except for the language, which this
      // page's own path already settles, so it is baked in rather than guessed.
      //
      // This has to answer exactly what `initialChoice` answers: this page's language, then the
      // address's `?lang=`, then the stored choice, then the browser's. `vite/plugins.test.ts`
      // runs this script against that function to keep the two from drifting, which they did
      // the first time this was written.
      const shared = `${base}${crossReferencesDatasetPath(vizCrossReferenceSource().id)}`;
      const preload = {
        shared,
        byTranslation: Object.fromEntries(
          TRANSLATION_MANIFESTS.map((manifest) => [
            manifest.id,
            `${base}${translationDatasetPath(manifest.id)}`,
          ]),
        ),
        byLocale: Object.fromEntries(
          LOCALE_IDS.map((id) => [
            id,
            `${base}${translationDatasetPath(defaultTranslationFor(id))}`,
          ]),
        ),
        fallback: `${base}${translationDatasetPath(defaultTranslationFor(DEFAULT_LOCALE_ID))}`,
        localeKey: LOCALE_STORAGE_KEY,
        translationKey: TRANSLATION_STORAGE_KEY,
        // The language this file is served at, or null for the default language's pages, which
        // are at the bare path and so let the address and the reader decide.
        pageLocale: page && page.locale !== DEFAULT_LOCALE_ID ? page.locale : null,
      };
      tags.push({ tag: 'script', children: preloadScript(preload) });
      if (!page?.listed) {
        tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } });
        return atEndOfHead(tags);
      }
      const copy = SITE_COPY[page.locale];
      // The page's own words, read from the copy rather than back out of the HTML. Reading them
      // out of the file meant reading text that had already been escaped once and then escaping
      // it again, so a single `&` in a title arrived at WhatsApp, Twitter and the structured
      // data as `&amp;amp;`. `vite/site-head.test.ts` pins that these come through verbatim, and
      // `committed English entries match SITE_COPY` keeps the two committed HTML files in step
      // with this, since they are now a copy of it rather than its source.
      const { title, description, noscript: noJavaScript } = copy.pages[page.id];
      const url = pageUrl(page, base);
      const social = socialImageOf(page);
      const image = new URL(`${base}${social.file}`, SITE_ORIGIN).href;
      const meta = (
        key: 'name' | 'property',
        name: string,
        content: string,
      ): HtmlTagDescriptor => ({
        tag: 'meta',
        attrs: { [key]: name, content },
      });
      tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url } });
      // Every language of this page points at every other, itself included, and the default
      // language is also `x-default` — the one a reader is sent to when none of them match.
      // Search engines drop the whole set when it is not reciprocal, which is why these are
      // generated from one list rather than written per page.
      for (const alternate of translationsOf(page)) {
        tags.push({
          tag: 'link',
          attrs: {
            rel: 'alternate',
            hreflang: SITE_COPY[alternate.locale].hreflang,
            href: pageUrl(alternate, base),
          },
        });
        if (alternate.locale === DEFAULT_LOCALE_ID) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'alternate', hreflang: 'x-default', href: pageUrl(alternate, base) },
          });
        }
      }
      tags.push(
        meta('property', 'og:type', 'website'),
        meta('property', 'og:site_name', copy.siteName),
        meta('property', 'og:locale', copy.ogLocale),
        meta('property', 'og:title', title),
        meta('property', 'og:description', description),
        meta('property', 'og:url', url),
        meta('property', 'og:image', image),
        meta('property', 'og:image:width', String(social.width)),
        meta('property', 'og:image:height', String(social.height)),
        meta('property', 'og:image:alt', social.alt),
        meta('name', 'twitter:card', 'summary_large_image'),
        meta('name', 'twitter:title', title),
        meta('name', 'twitter:description', description),
        meta('name', 'twitter:image', image),
        meta('name', 'twitter:image:alt', social.alt),
      );
      // What a reader without JavaScript is given, which is also what a crawler that does not
      // run it reads. Not a keyword block: the words are the page's own description, and the
      // links are the pages that really exist — the other view, and this page in every other
      // language. Without them the site is four addresses nothing links to, which is how a
      // crawler that follows links sees it today. Google runs JavaScript and sees the app
      // instead; this is for everything that does not.
      const noscript = [
        `<h1>${escapeText(title)}</h1>`,
        `<p>${escapeText(description)}</p>`,
        // The one sentence written for a reader who has no JavaScript, in their language. It
        // used to be thrown away with the rest of the block it replaced, so the translated copy
        // and the test that asserted it both passed against an artifact nothing shipped.
        `<p>${escapeText(noJavaScript)}</p>`,
        '<ul>',
        ...PAGE_LIST.filter(
          (other) => other.listed && other.locale === page.locale && other.id !== page.id,
        ).map(
          (other) => `<li><a href="${pageUrl(other, base)}">${escapeText(titleOf(other))}</a></li>`,
        ),
        ...translationsOf(page)
          .filter((alternate) => alternate.locale !== page.locale)
          .map(
            (alternate) =>
              `<li><a href="${pageUrl(alternate, base)}" hreflang="${SITE_COPY[alternate.locale].hreflang}" lang="${LOCALE_TAGS[alternate.locale].tag}">${escapeText(LOCALE_TAGS[alternate.locale].endonym)}</a></li>`,
          ),
        '</ul>',
      ].join('');
      const html_ = html.replace(
        /<noscript>[\s\S]*?<\/noscript>/,
        `<noscript>${noscript}</noscript>`,
      );
      if (page.id === 'main') {
        const structuredData = {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: copy.siteName,
          url,
          description,
          image,
          applicationCategory: 'ReferenceApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript and WebGL 2',
          isAccessibleForFree: true,
          inLanguage: page.locale,
        };
        tags.push({
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: JSON.stringify(structuredData),
        });
      }
      return { html: html_, tags: atEndOfHead(tags) };
    },
    generateBundle() {
      const listed = PAGE_LIST.filter(({ listed }) => listed);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml(listed, base),
      });
      // robots.txt is only read at a domain's root, so this one is honoured when the site is
      // built for one (`BASE_PATH=/`). Under a sub-path it is published for completeness and
      // ignored by crawlers: the sitemap there has to be named by the root robots.txt of the
      // domain, or submitted in Search Console, which needs no robots.txt at all.
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: [
          'User-agent: *',
          'Allow: /',
          '',
          `Sitemap: ${new URL(`${base}sitemap.xml`, SITE_ORIGIN).href}`,
          '',
        ].join('\n'),
      });
      // Each language's share picture. One that names a `from` has no picture of its own yet and
      // is published from another language's file, under its own final name, so that the real
      // one can replace it later without any shared link changing.
      for (const page of listed) {
        const { file, from } = socialImageOf(page);
        if (from === undefined) {
          continue;
        }
        this.emitFile({
          type: 'asset',
          fileName: file,
          source: readFileSync(resolve(ROOT_DIR, 'public', from)),
        });
      }
    },
  };
}

/** `sitemap.xml`, with every language of a page named as an alternate of the others. */
export function sitemapXml(pages: readonly Page[], base: string): string {
  const entries = pages.map((page) => {
    const alternates = translationsOf(page).flatMap((alternate) => {
      const href = pageUrl(alternate, base);
      const link = (hreflang: string) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`;
      return alternate.locale === DEFAULT_LOCALE_ID
        ? [link(SITE_COPY[alternate.locale].hreflang), link('x-default')]
        : [link(SITE_COPY[alternate.locale].hreflang)];
    });
    return [`  <url><loc>${pageUrl(page, base)}</loc>`, ...alternates, '  </url>'].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** What the inline preload script needs to make the same choice the app will. */
export interface PreloadPlan {
  readonly shared: string;
  readonly byTranslation: Readonly<Record<string, string>>;
  readonly byLocale: Readonly<Record<string, string>>;
  readonly fallback: string;
  readonly localeKey: string;
  readonly translationKey: string;
  readonly pageLocale: string | null;
}

/**
 * The script that starts the datasets downloading before the app has parsed.
 *
 * Written as a string because it has to run before any module does. `Object.keys` rather than
 * `in` throughout: `in` finds `toString` on the prototype of a plain object, so `?lang=toString`
 * would otherwise preload a URL made from a function's source text.
 */
export function preloadScript(plan: PreloadPlan): string {
  return [
    'if (!navigator.serviceWorker?.controller) {',
    `  const plan = ${JSON.stringify(plan)};`,
    '  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };',
    '  const pick = (map, key) => (key !== null && Object.keys(map).includes(key) ? map[key] : null);',
    '  const params = new URL(location.href).searchParams;',
    '  const lang =',
    '    plan.pageLocale !== null',
    '      ? plan.pageLocale',
    '      : pick(plan.byLocale, params.get("lang")) !== null',
    '        ? params.get("lang")',
    '        : pick(plan.byLocale, read(plan.localeKey)) !== null',
    '          ? read(plan.localeKey)',
    '          : (navigator.languages || [])',
    '              .map((tag) => String(tag).toLowerCase().split("-")[0])',
    '              .find((tag) => Object.keys(plan.byLocale).includes(tag)) ?? null;',
    '  const text =',
    '    pick(plan.byTranslation, params.get("t")) ??',
    '    pick(plan.byTranslation, read(plan.translationKey)) ??',
    '    pick(plan.byLocale, lang) ??',
    '    plan.fallback;',
    '  for (const href of [plan.shared, text]) {',
    '    const link = document.createElement("link");',
    '    link.rel = "preload"; link.as = "fetch"; link.crossOrigin = "anonymous";',
    '    link.href = href; document.head.append(link);',
    '  }',
    '}',
  ].join('\n');
}
