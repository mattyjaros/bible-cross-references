import { expect, test, type Page } from '@playwright/test';
import { ACTIVE, PANEL, openPanel, openShare, settle, waitForApp } from './helpers.ts';
import { DEFAULT_LOCALE_ID, LOCALE_IDS } from '../../src/i18n/locale-id.ts';

/**
 * A picture of every major screen, at a desktop size and on a phone.
 *
 * These are here to be looked at as much as to be compared: the files under
 * `visual.spec.ts-snapshots/` are what the app actually looks like, and reviewing a change to one
 * of them is reviewing the change to the app. See tests/e2e/README.md for how to regenerate them.
 */

/** Phones get the whole page; a desktop window is already the whole page. */
const FULL = { fullPage: false } as const;

/**
 * How much a shot may differ before it fails.
 *
 * The default (`playwright.config.ts`) is 2% of the pixels, which sounds strict and is not: at
 * 1440×900 it permits about 26,000 of them. A regression that turned four bold numbers regular
 * was on the order of 200 pixels — well inside the budget, and the suite stayed green while a
 * human spotted it in the PNG. The budget is wide because the arcs are drawn by a software
 * renderer that is not pixel-identical run to run.
 *
 * But only the shots containing that canvas need the slack. A desktop panel shot is framed on
 * the `aside`: DOM text, no WebGL. Those get a budget that would actually have caught the bold.
 *
 * Only `maxDiffPixels`, with no ratio beside it. Playwright applies the stricter of the two when
 * both are given, so pairing this with `maxDiffPixelRatio: 0` quietly reduced the budget to
 * zero: the panel shots then failed on twelve pixels of text antialiasing, which is noise, and
 * the 150 the comment above promises was never in force. Reading `0` as "no ratio limit" is the
 * easy mistake, and it is the reason this suite had a shot that failed about two runs in three.
 */
const EXACT = { maxDiffPixels: 150 } as const;

/**
 * Photographs the details.
 *
 * On a desktop the panel is a column with a box of its own, and framing the shot to it shows the
 * content at a useful size — and keeps the canvas out of frame, which is what lets it be held to
 * `EXACT`. On a phone it is a sheet whose box runs past the bottom of the screen, so the same
 * framing would capture the page behind it: there, the screen is the shot, canvas and all.
 */
async function shotPanel(page: Page, name: string): Promise<void> {
  const phone = test.info().project.name === 'visual-phone';
  await (phone
    ? expect(page).toHaveScreenshot(name, FULL)
    : expect(page.locator(PANEL)).toHaveScreenshot(name, EXACT));
}

/** Opens the app at a passage, with everything settled and the sheet up on a phone. */
async function show(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await waitForApp(page);
  await settle(page);
}

test.describe('the whole Bible', () => {
  test('arcs, as the app opens', async ({ page }) => {
    await show(page);
    await expect(page).toHaveScreenshot('arcs-home.png', FULL);
  });

  test('arcs, with the genre legend unfolded', async ({ page }) => {
    // Only a phone folds the legend away; on a desktop it is already open in the shot above.
    test.skip(test.info().project.name !== 'visual-phone', 'The legend is always open here.');
    await show(page);
    await page.locator(ACTIVE).getByRole('button', { name: 'Show genres' }).click();
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-genres.png', FULL);
  });

  test('threads, as the view opens', async ({ page }) => {
    await show(page, './threads/');
    await expect(page).toHaveScreenshot('threads-home.png', FULL);
  });
});

test.describe('a passage', () => {
  test('a verse and its cross-references', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('verse-panel.png', FULL);
  });

  test('a whole chapter', async ({ page }) => {
    await show(page, './?ref=Ps.23');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('chapter-panel.png', FULL);
  });

  test('the same verse in Threads', async ({ page }) => {
    await show(page, './threads/?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('threads-verse.png', FULL);
  });

  test('the details panel on its own', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await shotPanel(page, 'panel-only.png');
  });
});

test.describe('the Hebrew and Greek', () => {
  test('a Greek verse, with its words listed', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /Same Greek word/ })
      .waitFor();
    await settle(page);
    await shotPanel(page, 'words-greek.png');
  });

  test('a word opened to every verse that uses it', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /plēthos/ })
      .click();
    await settle(page);
    await shotPanel(page, 'words-expanded.png');
  });

  test('a Hebrew verse, right to left', async ({ page }) => {
    await show(page, './?ref=Gen.1.1');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /Same Hebrew word/ })
      .waitFor();
    await settle(page);
    await shotPanel(page, 'words-hebrew.png');
  });
});

test.describe('the controls', () => {
  test('the filters', async ({ page }) => {
    await show(page);
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Filters/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-filters.png', FULL);
  });

  test('the translations', async ({ page }) => {
    await show(page);
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Translation/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-translation.png', FULL);
  });

  test('a reference that is not one', async ({ page }) => {
    await show(page);
    await page.locator(ACTIVE).getByRole('searchbox').fill('Hesitations 4:4');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await settle(page);
    await expect(page).toHaveScreenshot('search-error.png', FULL);
  });

  test('the app in another translation', async ({ page }) => {
    await show(page, './?ref=John.3.16&t=kjv');
    await openPanel(page);
    await settle(page);
    await shotPanel(page, 'panel-kjv.png');
  });
});

test.describe('the panel, section by section', () => {
  /** Folds away every section that has a heading to click. */
  async function collapseAll(page: Page): Promise<void> {
    const headers = page.locator(PANEL).getByRole('button', { expanded: true });
    // Taken one at a time from the front: collapsing one changes the list.
    for (let guard = 0; guard < 8; guard += 1) {
      const open = await headers.count();
      if (open === 0) {
        return;
      }
      await headers.first().click();
    }
  }

  test('every section folded away, which is how a reader who wants only the text leaves it', async ({
    page,
  }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await collapseAll(page);
    await settle(page);
    await shotPanel(page, 'panel-collapsed.png');
  });

  test('a chapter, where the verse list is a section of its own', async ({ page }) => {
    await show(page, './?ref=Ps.23');
    await openPanel(page);
    await settle(page);
    await shotPanel(page, 'panel-chapter-only.png');
  });

  test('every cross-reference, past the handful shown at first', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    const showAll = page
      .locator(PANEL)
      .getByRole('button', { name: /Show all/ })
      .first();
    await showAll.click();
    await settle(page);
    await shotPanel(page, 'panel-show-all.png');
  });

  test('a reference copied, with the line that says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await page.locator(PANEL).getByRole('button', { name: /^Copy/ }).first().click();
    // Writing to the clipboard is asynchronous and the panel says so when it is done; shooting
    // before that catches the panel mid-change.
    await expect(page.locator(PANEL).getByRole('status').first()).toHaveText(/copied/);
    await settle(page);
    await shotPanel(page, 'panel-copied.png');
  });
});

test.describe('the Hebrew and Greek, opened up', () => {
  test('a Hebrew word opened to every verse that uses it', async ({ page }) => {
    // The Greek equivalent is `words-expanded`; Hebrew reads right to left, so it is its own
    // picture rather than the same one mirrored.
    await show(page, './?ref=Gen.1.1');
    await openPanel(page);
    const word = page
      .locator(PANEL)
      .getByRole('button', { name: /bara|ʾelohim|reshit/i })
      .first();
    await word.click();
    await settle(page);
    await shotPanel(page, 'words-hebrew-expanded.png');
  });

  test('the words folded away, leaving the verse', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /Same Greek word/ })
      .click();
    await settle(page);
    await shotPanel(page, 'words-collapsed.png');
  });

  /**
   * Scrolls an opened word's verses up under the two headings that pin to the top.
   *
   * The point of the picture is what does *not* move: the section's own band ("Same Greek word")
   * and, flush beneath it, the word being read. Scrolled far enough that neither could still be
   * in view if it were not sticky, so the shot fails if either comes unstuck.
   */
  async function scrollUnderStickyHeadings(page: Page, word: RegExp): Promise<void> {
    const button = page.locator(PANEL).getByRole('button', { name: word }).first();
    await button.click();
    await button.scrollIntoViewIfNeeded();
    await page.locator(`${PANEL} [class*="scroll"]`).evaluate((element) => {
      element.scrollTop += 600;
    });
  }

  test('the two headings that stay put while the verses scroll under them', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await scrollUnderStickyHeadings(page, /plēthos/);
    await settle(page);
    await shotPanel(page, 'words-sticky-headings.png');
  });

  test('the same, in Hebrew, where the word reads the other way', async ({ page }) => {
    await show(page, './?ref=Gen.1.1');
    await openPanel(page);
    await scrollUnderStickyHeadings(page, /bara|ʾelohim|reshit/i);
    await settle(page);
    await shotPanel(page, 'words-sticky-headings-hebrew.png');
  });
});

test.describe('the controls, in use', () => {
  test('the genres menu, where a view labels them itself', async ({ page }) => {
    // Threads puts the genres behind a menu button; the arcs show the legend outright.
    await show(page, './threads/');
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Genres/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-genres.png', FULL);
  });

  test('the genre legend, unfolded', async ({ page }) => {
    await show(page);
    const toggle = page.locator(ACTIVE).getByRole('button', { name: 'Show genres' });
    if ((await toggle.count()) > 0) {
      await toggle.click();
    }
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-legend.png', FULL);
  });

  test('the filters, set to something other than their defaults', async ({ page }) => {
    await show(page, './?votes=all&hide=law,history');
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Filters/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-filters-changed.png', FULL);
  });
});

test.describe('the arcs themselves', () => {
  test('a chapter picked out of the whole Bible', async ({ page }) => {
    await show(page, './?ref=Ps.23');
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-chapter.png', FULL);
  });

  test('a verse picked out of the whole Bible', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-verse.png', FULL);
  });

  test('zoomed in on a part of the canvas', async ({ page }) => {
    // The keyboard zoom is a fixed 1.6x about the middle of the stage, so three presses land on
    // the same view every run — a wheel gesture would depend on the device's scroll granularity.
    await show(page);
    const stage = page.locator(`${ACTIVE} [role="application"]`).first();
    const box = await stage.boundingBox();
    if (box === null) {
      throw new Error('The arcs stage is not on screen.');
    }
    // A wheel zooms immediately — `exp(-deltaY * 0.002)`, so this is an exact 4.06x about the
    // point under the cursor. The keyboard zoom animates instead, and animations are the wrong
    // thing to photograph: each press starts from wherever the last one had got to, so under a
    // loaded machine three presses land somewhere slightly different every run.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -700);
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-zoomed.png', FULL);
  });

  test('with whole genres hidden, which thins the canvas out', async ({ page }) => {
    await show(page, './?hide=law,history,poetry,major-prophets,minor-prophets');
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-genres-hidden.png', FULL);
  });

  test('with every link shown, which fills it in', async ({ page }) => {
    await show(page, './?votes=all');
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-all-links.png', FULL);
  });

  test('the reading threads, on a chapter', async ({ page }) => {
    await show(page, './threads/?ref=Ps.23');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('threads-chapter.png', FULL);
  });
});

test.describe('installing', () => {
  test('the install guide', async ({ page }) => {
    await show(page, './#install');
    await page.locator('dialog[open]').waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('install-guide.png', FULL);
  });
});

test.describe('the loading and error screens', () => {
  test('the loading screen, before the data arrives', async ({ page }) => {
    // Hold the links back so the screen that waits for them stays on display.
    await page.route('**/cross-references/*.json', async () => {
      await new Promise(() => undefined);
    });
    await page.goto('./');
    await page.getByText(/Loading 31,102 verses/).waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('loading.png', FULL);
  });

  test('the error screen, when the data cannot be fetched', async ({ page }) => {
    await page.route('**/cross-references/*.json', (route) => route.abort());
    await page.goto('./');
    await page.getByRole('alert').waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('load-error.png', FULL);
  });
});

test.describe('the data page', () => {
  test('the debug dashboard', async ({ page }) => {
    await page.goto('./debug/');
    await page.locator('table').first().waitFor({ timeout: 45_000 });
    await settle(page);
    await expect(page).toHaveScreenshot('debug.png', FULL);
  });
});

/**
 * Folds every section of the details away, leaving the bands.
 *
 * The bands are the tightest row in the app: an icon, a name, a description, a count and a
 * chevron, all on one line. They are where a longer language stops fitting, and for a while they
 * pushed the panel sideways instead of truncating.
 */
async function foldEverySection(page: Page): Promise<void> {
  const headers = page.locator(PANEL).getByRole('button', { expanded: true });
  for (let guard = 0; guard < 8; guard += 1) {
    if ((await headers.count()) === 0) {
      return;
    }
    await headers.first().click();
  }
}

/**
 * The verse card, and the button that offers it.
 *
 * The button's shot is framed on the verse list alone — DOM text, no canvas behind it — so it
 * can be held to `EXACT`. That matters more here than elsewhere: this button shares a 2rem slot
 * with the cross-reference count, and the first version of it left the count misaligned and the
 * button hanging over the threads. The full-page budget absorbed both without complaint. A shot
 * framed on the list would not have.
 *
 * The card itself is a bitmap drawn on a canvas, so its shot takes the usual budget.
 */
test.describe('sending a verse', () => {
  test('the button, on the verse being read', async ({ page }) => {
    await show(page, './threads/?ref=Ps.16.10');
    const phone = test.info().project.name === 'visual-phone';
    if (phone) {
      // The whole list is taller than a phone screen, and Playwright captures an element past
      // the viewport by scrolling it — during which `(hover: none)` stops matching, so the shot
      // came back showing the count and no button at all: a baseline of the feature being
      // absent, held to `EXACT`, which could never have failed. The selected row fits, so that
      // is what is photographed.
      const row = page.locator(`${ACTIVE} ol li[data-selected="true"]`).first();
      await row.scrollIntoViewIfNeeded();
      await settle(page);
      await expect(row).toHaveScreenshot('share-button.png', EXACT);
      return;
    }
    await page.locator(`${ACTIVE} ol li`).nth(5).hover();
    await settle(page);
    await expect(page.locator(`${ACTIVE} ol`)).toHaveScreenshot('share-button.png', EXACT);
  });

  test('the card it offers, and the ways of sending it', async ({ page }) => {
    await show(page, './threads/?ref=Ps.16.8');
    await openShare(page);
    await expect(page.locator('dialog[open]')).toHaveScreenshot('share-card.png');
  });
});

/**
 * The app in each language it speaks other than English.
 *
 * English is photographed screen by screen above. A translation is not, and does not need to be:
 * what changes with the language is the chrome and the text, never the canvas behind them. These
 * are the places where a language that runs longer or shorter than English actually shows — the
 * app as it opens, a verse's details, those details with every section folded, the other view,
 * and the picker, whose order depends on which language is reading it.
 *
 * Written as a loop over `LOCALE_IDS` rather than one block per language, because a block per
 * language means the next language is only photographed when somebody remembers to copy one —
 * which is how Portuguese came to be the only translation anybody could look at.
 */
for (const locale of LOCALE_IDS.filter((id) => id !== DEFAULT_LOCALE_ID)) {
  test.describe(`in ${locale}`, () => {
    test('the arcs, with the whole interface translated', async ({ page }) => {
      await show(page, `./?lang=${locale}`);
      await expect(page).toHaveScreenshot(`${locale}-arcs.png`, FULL);
    });

    test('a verse and its cross-references', async ({ page }) => {
      await show(page, `./?lang=${locale}&ref=John.3.16`);
      await openPanel(page);
      await settle(page);
      await shotPanel(page, `${locale}-panel.png`);
    });

    test('the card, named and credited in this language', async ({ page }) => {
      await show(page, `./threads/?lang=${locale}&ref=John.3.16`);
      await openShare(page);
      await expect(page.locator('dialog[open]')).toHaveScreenshot(`${locale}-share-card.png`);
    });

    test('the reading threads, whose spine is lettered too', async ({ page }) => {
      await show(page, `./threads/?lang=${locale}&ref=John.3.16`);
      await openPanel(page);
      await settle(page);
      await expect(page).toHaveScreenshot(`${locale}-threads.png`, FULL);
    });

    test('the sections folded away, where a longer language has to fit the same row', async ({
      page,
    }) => {
      await show(page, `./?lang=${locale}&ref=2Cor.11`);
      await openPanel(page);
      await foldEverySection(page);
      await settle(page);
      await shotPanel(page, `${locale}-panel-collapsed.png`);
    });

    test('the picker, with this language’s own Bibles at the top', async ({ page }) => {
      await show(page, `./?lang=${locale}`);
      // Found by its shape rather than its name: the translation menu is the one that shows a
      // value (the abbreviation) next to a chevron, which is true whatever the label says. A
      // regex of every language's word for "Translation" would need editing for each new one.
      await page.locator(`${ACTIVE} button:has([class*="menuValue"])`).click();
      await settle(page);
      // Framed on the popover: the canvas behind it is the same in every language, and a shot
      // without it is both smaller on disk and held to a budget that would catch a wrong weight.
      await expect(page.locator(`${ACTIVE} [class*="popover"]`)).toHaveScreenshot(
        `${locale}-translations.png`,
        EXACT,
      );
    });
  });
}
