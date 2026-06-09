import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Person role (hesters)', () => {
  test('login lands on My Competencies (Welcome heading)', async ({ page }) => {
    await loginAs(page, 'person');
    await expect(page.locator('h1')).toContainText('Welcome, Stacy');
  });

  test('stage badge visible', async ({ page }) => {
    await loginAs(page, 'person');
    await expect(page.locator('body')).toContainText(
      /Core|Orientation|Education|Continuous Learning/,
    );
  });

  test('no unit-leader or preceptor nav items visible', async ({ page }) => {
    await loginAs(page, 'person');
    await expect(page.locator('nav a:has-text("Dashboard")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Unit Roster")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("My Learners")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Observe Steps")')).toHaveCount(0);
  });
});
