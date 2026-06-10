import type { Page } from '@playwright/test';

export const CREDS = {
  person:     { username: 'sh27', password: 'duke24', displayName: 'Sara Hayes, RN' },
  preceptor:  { username: 'ms41', password: 'duke24', displayName: 'Morgan Sullivan, RN' },
  unitLeader: { username: 'wv38', password: 'duke24', displayName: 'Wendy Vale, RN' },
  admin:      { username: 'th55', password: 'duke24', displayName: 'Tammy Hill, RN' },
} as const;

/**
 * Log in as the given role. Waits for the DataProvider to finish its initial
 * data fetch before returning, so tests can interact with real content.
 */
export async function loginAs(page: Page, role: keyof typeof CREDS) {
  const { username, password } = CREDS[role];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 15_000 },
  );
  // Small settle time for React state to stabilise after data lands
  await page.waitForTimeout(300);
}

/**
 * Navigate within the SPA by clicking a sidebar link.
 * Never use page.goto() for sub-paths — it reloads the page and breaks the
 * dynamic basename the app computes on startup.
 */
export async function navTo(page: Page, label: string) {
  await page.locator(`nav a:has-text("${label}")`).first().click();
  await page.waitForTimeout(500);
}
