/**
 * CareCompetencies — Orientee Guide Screenshot Capture
 * =====================================================
 * Captures all screenshots needed for the Orientee User Guide.
 *
 * SETUP (run once):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USAGE:
 *   node capture_screenshots.js
 *
 * Screenshots are saved to ./guide_screenshots/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── CONFIG — edit these ───────────────────────────────────────────────────────
const BASE_URL  = 'http://localhost:5173';
const USERNAME  = 'hesters';             // Duke NetID used to log in
const PASSWORD  = 'duke24';             // Password
const DISPLAY_USERNAME = 'bnd01';       // NetID shown in the login screenshot
const OUT_DIR   = './guide_screenshots';
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORT = { width: 1280, height: 800 };

async function shot(page, filename, description) {
  const filepath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`✓  ${filename}  —  ${description}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false }); // headless:false so you can watch
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page    = await context.newPage();

  // ── 1. LOGIN SCREEN ─────────────────────────────────────────────────────────
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // Fill display username for the screenshot (generic example NetID)
  await page.fill('#username', DISPLAY_USERNAME);
  await page.waitForTimeout(400);
  await shot(page, '01_login_screen.png', 'Login screen');

  // Now switch to real credentials and sign in
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"], button:has-text("Sign in")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // ── 2. DASHBOARD — TOP ──────────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, '02_dashboard_top.png', 'Dashboard — welcome banner, stage progress, summary cards');

  // ── 3. HOVER — CORE ─────────────────────────────────────────────────────────
  // Hover the Core row in the Competencies Achieved card
  const coreRow = page.locator('text=Core').first();
  await coreRow.hover();
  await page.waitForTimeout(700);
  await shot(page, '03_hover_core.png', 'Hover — Core stage pop-up');

  // ── 4. HOVER — ORIENTATION ──────────────────────────────────────────────────
  const orientationRow = page.locator('text=Orientation').nth(1); // second match (first is the badge)
  await orientationRow.hover();
  await page.waitForTimeout(700);
  await shot(page, '04_hover_orientation.png', 'Hover — Orientation stage pop-up');

  // ── 5. HOVER — EDUCATION ────────────────────────────────────────────────────
  const educationRow = page.locator('text=Education').first();
  await educationRow.hover();
  await page.waitForTimeout(700);
  await shot(page, '05_hover_education.png', 'Hover — Education stage pop-up (Achieved + Remaining)');

  // Move mouse away to dismiss hover
  await page.mouse.move(800, 400);
  await page.waitForTimeout(400);

  // ── 6. DASHBOARD — BOTTOM (Up Next + Recent Activity) ───────────────────────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await shot(page, '06_dashboard_bottom.png', 'Dashboard — Up Next and Recent Activity panels');

  // ── 7. SEARCH COMPETENCIES ──────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('text=Search Competencies');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await shot(page, '07_search_competencies.png', 'Search Competencies — full list with filters');

  // ── 8. COMPETENCY DETAIL — TOP ──────────────────────────────────────────────
  // Click the first competency row
  await page.locator('.competency-row, [data-testid="competency-row"], tbody tr, ul li a').first().click().catch(async () => {
    // Fallback: click the first chevron/arrow or competency link
    await page.locator('text=Accessing, text=Advanced, text=Alaris').first().click();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '08_competency_detail_top.png', 'Competency detail — description, Unit Requirements, References & Guidance');

  // ── 9. COMPETENCY DETAIL — STEPS ────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, '09_competency_detail_steps.png', 'Competency detail — Steps section');

  // ── 10. COMPETENCY SUMMARY BUTTON (dashboard) ────────────────────────────────
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Highlight the button with a brief visual cue before screenshot
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Competency Summary'));
    if (btn) btn.style.outline = '3px solid #2B6CB0';
  });
  await page.waitForTimeout(400);
  await shot(page, '10_dashboard_summary_button.png', 'Dashboard — Competency Summary button highlighted');

  // ── DONE ─────────────────────────────────────────────────────────────────────
  console.log(`\n✅  All screenshots saved to: ${path.resolve(OUT_DIR)}`);
  console.log('   You can now close this browser window or let the script exit.');

  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
