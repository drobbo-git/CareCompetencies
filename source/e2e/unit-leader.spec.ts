import { test, expect } from '@playwright/test';
import { loginAs, navTo } from './helpers';

test.describe('Unit Leader role (vankirkw, DN 4100)', () => {
  test('login redirects to Dashboard', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('Dashboard shows health-check, planner, and trend sections', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await expect(page.locator('body')).toContainText('Health check');
    await expect(page.locator('body')).toContainText('Planner — path to independence');
    await expect(page.locator('body')).toContainText('Unit Progress Trend');
  });

  test('Unit Roster page loads with a table', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Unit Roster');
    await expect(page.locator('h1')).toContainText('Unit Roster');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('Competency Matrix renders the matrix', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Competency Matrix');
    await expect(page.locator('h1')).toContainText('Competency Matrix');
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('Assignments page shows learner rows and preceptor dropdowns', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Assignments');
    await expect(page.locator('h1')).toContainText('Assignments');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
    const dropdowns = page.locator('[role="combobox"]');
    expect(await dropdowns.count()).toBeGreaterThan(0);
  });

  test('Assignments dropdown lists preceptors with load counts and unit leader label', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Assignments');
    await page.locator('[role="combobox"]').first().click();
    await page.waitForTimeout(300);
    const options = await page.locator('[role="option"]').allInnerTexts();
    expect(options).toContain('(unassigned)');
    expect(options.some((o) => /learner/.test(o))).toBe(true);
    expect(options.some((o) => /Unit Leader/.test(o))).toBe(true);
  });

  test('Assignments: changing preceptor opens confirmation dialog; cancel dismisses it', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Assignments');
    // Open first dropdown and pick the last option (guaranteed different from nothing/current)
    await page.locator('[role="combobox"]').first().click();
    await page.waitForTimeout(300);
    const options = await page.locator('[role="option"]').all();
    await options[options.length - 1].click();
    await page.waitForTimeout(400);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Confirm reassignment');
    await expect(dialog).toContainText('→');
    await expect(dialog.locator('textarea')).toBeVisible();
    // Cancel — no DB mutation
    await dialog.locator('button:has-text("Cancel")').click();
    await expect(dialog).not.toBeVisible();
  });

  test('Unit Learners page shows learner cards', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Unit Learners');
    await expect(page.locator('h1')).toContainText('Unit Learners');
    // Cards link to the learner workspace
    const cards = page.locator('a[href*="my-orientees/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('Observe Steps page loads', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Observe Steps');
    await expect(page.locator('h1')).toContainText('Record Step Observations');
  });

  test('Sign Off page loads', async ({ page }) => {
    await loginAs(page, 'unitLeader');
    await navTo(page, 'Sign Off');
    await expect(page.locator('h1')).toContainText('Sign Off');
  });
});
