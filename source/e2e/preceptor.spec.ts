import { test, expect } from '@playwright/test';
import { loginAs, navTo } from './helpers';

test.describe('Preceptor role (ms41)', () => {
  test('login redirects to My Learners', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await expect(page.locator('h1')).toContainText('My Learners');
  });

  test('learner cards are visible', async ({ page }) => {
    await loginAs(page, 'preceptor');
    const cards = page.locator('a[href*="my-orientees/"]');
    await expect(cards.first()).toBeVisible();
  });

  test('learner card opens workspace with learner name', async ({ page }) => {
    await loginAs(page, 'preceptor');
    const firstCard = page.locator('a[href*="my-orientees/"]').first();
    const cardName = await firstCard.locator('p.font-semibold').innerText().catch(() => '');
    await firstCard.click();
    await page.waitForTimeout(600);
    // Workspace H1 includes the learner's name
    const h1 = await page.locator('h1').innerText().catch(() => '');
    expect(h1.length).toBeGreaterThan(0);
    if (cardName) expect(h1).toContain(cardName.split(',')[0]); // first name match
  });

  test('workspace shows competency progress section', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await page.locator('a[href*="my-orientees/"]').first().click();
    await page.waitForTimeout(600);
    // Up Next or a competency list should be present
    await expect(page.locator('body')).toContainText(/Up Next|All current|competencies/i);
  });

  test('Observe Steps page loads', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await navTo(page, 'Observe Steps');
    await expect(page.locator('h1')).toContainText('Record Step Observations');
  });

  test('Sign Off page loads', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await navTo(page, 'Sign Off');
    await expect(page.locator('h1')).toContainText('Sign Off');
  });

  test('Search Competencies page loads', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await navTo(page, 'Search Competencies');
    await expect(page.locator('h1, [data-slot="title"]').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/competenc/i);
  });

  test('no unit-leader-only nav items visible', async ({ page }) => {
    await loginAs(page, 'preceptor');
    await expect(page.locator('nav a:has-text("Dashboard")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Unit Roster")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Competency Matrix")')).toHaveCount(0);
  });
});
