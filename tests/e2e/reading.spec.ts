import { expect, test } from '@playwright/test';
import { ACTIVE, PANEL, collectErrors, openPassage, openShare, waitForApp } from './helpers.ts';

test.describe('reading the Bible', () => {
  test('the arcs are drawn, and say how much is shown', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('./');
    await waitForApp(page);
    await expect(page.locator(`${ACTIVE} canvas`).first()).toBeVisible();
    await expect(page.getByText(/31,102 verses/)).toBeVisible();
    await expect(page.getByText(/of 344,799 links shown/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a verse can be found by typing its reference', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);
    await page.locator(ACTIVE).getByRole('searchbox').fill('Ps 23:1');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await expect(page.locator(PANEL).getByRole('heading', { name: 'Psalm 23:1' })).toBeVisible();
    await expect(page).toHaveURL(/ref=Ps\.23\.1/);
  });

  test('a whole chapter can be opened, and lists its verses', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);
    await page.locator(ACTIVE).getByRole('searchbox').fill('Psalm 23');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await expect(page.locator(PANEL).getByRole('heading', { name: 'Psalm 23' })).toBeVisible();
    await expect(page.locator(PANEL).getByRole('button', { name: /Verses/ })).toBeVisible();
  });

  test('a reference that is not a reference says so, and changes nothing', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);
    await page.locator(ACTIVE).getByRole('searchbox').fill('Hesitations 4:4');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await expect(page.locator(ACTIVE).getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/ref=/);
  });

  test('a shared address opens exactly the passage it names', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    await expect(page.locator(PANEL).getByRole('heading', { name: 'John 3:16' })).toBeVisible();
    await expect(page.locator(PANEL)).toContainText(/For God so loved the world/);
  });

  test('the panel steps to the next verse and back', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    await page.locator(PANEL).getByRole('button', { name: 'Next verse' }).click();
    await expect(page.locator(PANEL).getByRole('heading', { name: 'John 3:17' })).toBeVisible();
    await page.locator(PANEL).getByRole('button', { name: 'Previous verse' }).click();
    await expect(page.locator(PANEL).getByRole('heading', { name: 'John 3:16' })).toBeVisible();
  });

  test('the panel closes', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    await page.locator(PANEL).getByRole('button', { name: 'Close' }).click();
    await expect(page.locator(PANEL)).toHaveCount(0);
  });

  test('a cross-reference can be followed to where it leads', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    const link = page
      .locator(PANEL)
      .getByRole('button', { name: /^Romans 5:8/ })
      .first();
    await link.click();
    await expect(page.locator(PANEL).getByRole('heading', { name: 'Romans 5:8' })).toBeVisible();
    await expect(page).toHaveURL(/ref=Rom\.5\.8/);
  });

  test('Back returns to the passage before it', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    await page.locator(ACTIVE).getByRole('searchbox').fill('Ps 23:1');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await expect(page.locator(PANEL).getByRole('heading', { name: 'Psalm 23:1' })).toBeVisible();
    await page.goBack();
    await expect(page.locator(PANEL).getByRole('heading', { name: 'John 3:16' })).toBeVisible();
  });

  test('the two views switch, keeping the passage', async ({ page }) => {
    await openPassage(page, 'John.3.16');
    await page.locator(ACTIVE).getByRole('link', { name: 'Threads', exact: true }).click();
    await expect(page).toHaveURL(/threads\//);
    await expect(page).toHaveURL(/ref=John\.3\.16/);
    await page.locator(ACTIVE).getByRole('link', { name: 'Arcs', exact: true }).click();
    await expect(page).toHaveURL(/ref=John\.3\.16/);
  });
});

test.describe('sending a verse on', () => {
  /**
   * The share button lives in the slot that otherwise holds the cross-reference count, revealed
   * by a pointer and, on a touch screen, by selecting the verse. An invisible button still takes
   * a press, though, and the first version of this had `pointer-events` left at their default:
   * a reader tapping the count of any verse got a share sheet for it instead of selecting it,
   * because the button sits over that number on every row and stops the press reaching the row.
   */
  test('tapping a verse selects it, rather than offering to send it', async ({ page }) => {
    // Touch only: a pointer arriving at that spot reveals the button, so clicking it there is
    // somebody asking to share. It is the screen with no hover where the press must pass through.
    test.skip(test.info().project.name !== 'phone', 'about a screen with no pointer');
    await page.goto('./threads/?ref=Ps.16.8');
    await waitForApp(page);
    const rows = page.locator(`${ACTIVE} ol li`);
    const target = rows.nth(2);
    await target.scrollIntoViewIfNeeded();
    // Aim at the count, which is where a hidden share button would be.
    const slot = target.locator('span').last();
    await slot.click();
    await expect(target).toHaveAttribute('data-selected', 'true');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  /**
   * On a touch screen the offer follows the selection: the chosen verse shows the button in the
   * slot its cross-reference count otherwise holds, and every other verse keeps its count. This
   * is asserted rather than photographed, because capturing a list taller than the screen turns
   * `(hover: none)` off and photographs the opposite.
   */
  test('on a touch screen the offer sits on the chosen verse alone', async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'about a screen with no pointer');
    await page.goto('./threads/?ref=Ps.16.8');
    await waitForApp(page);
    const shown = (li: ReturnType<typeof page.locator>, what: string) =>
      li
        .locator(what)
        .first()
        .evaluate((el) => Number(getComputedStyle(el).opacity));

    const chosen = page.locator(`${ACTIVE} ol li[data-selected="true"]`).first();
    await chosen.scrollIntoViewIfNeeded();
    expect(await shown(chosen, 'button:not([aria-pressed])')).toBeGreaterThan(0);
    expect(await shown(chosen, 'span[title]')).toBe(0);

    const other = page.locator(`${ACTIVE} ol li:not([data-selected="true"])`).first();
    expect(await shown(other, 'button:not([aria-pressed])')).toBe(0);
    expect(await shown(other, 'span[title]')).toBe(1);
  });

  test('the button on the chosen verse opens a card of it', async ({ page }) => {
    await page.goto('./threads/?ref=Ps.16.8');
    await waitForApp(page);
    await openShare(page);
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByRole('heading', { name: 'Psalm 16:8' })).toBeVisible();
    await expect(dialog.locator('img')).toBeVisible();
    // The ways out of it, and the ways of keeping what it drew.
    await expect(dialog.getByRole('link', { name: /Save image/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy text' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    // Escape leaves the reader exactly where they were.
    await expect(page).toHaveURL(/ref=Ps\.16\.8/);
  });

  test('a verse this translation leaves out offers no card', async ({ page }) => {
    // Acts 8:37 is absent from the Berean Standard Bible.
    await page.goto('./threads/?ref=Acts.8.37');
    await waitForApp(page);
    const row = page.locator(`${ACTIVE} ol li[data-selected="true"]`).first();
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    await expect(row.locator('button:not([aria-pressed])')).toHaveCount(0);
  });
});
