// T-GNR-109 Phase 1 exit check on live github.com (logged out), in Playwright's Chromium.
//
//   node t-gnr-109.mjs <path to .output/chrome-mv3> [<screenshot dir>]
//
// 1. Cold load of a repository root: exactly one toggle, the listing collapsed, aria-expanded=false.
// 2. A click on the toggle shows the listing; a second click hides it again.
// 3. 20 consecutive soft navigations (expand, open a folder, browser Back): after every one, exactly
//    one toggle and a collapsed listing on the new page.
// 4. Screenshots of the collapsed header in light and dark themes, for the visual check.
// Exits 1 on any failed check, 2 on a missing extension path.
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const EXT = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!EXT || !existsSync(join(EXT, 'manifest.json'))) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3> [<screenshot dir>]`);
  process.exit(2);
}
const SHOTS = process.argv[3] ? resolve(process.argv[3]) : undefined;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const REPO = 'https://github.com/wxt-dev/wxt';
const FOLDER_LINK = 'a[href="/wxt-dev/wxt/tree/main/packages"]';
const failures = [];
const check = (ok, what) => {
  console.error(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

for (const colorScheme of ['light', 'dark']) {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    colorScheme,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    // The state of the page as the extension leaves it, read in the page.
    const state = () =>
      page.evaluate(() => {
        const toggles = document.querySelectorAll('[data-gnr="toggle"]');
        const listing = document.querySelector('[data-testid="directory-content"]');
        return {
          toggles: toggles.length,
          expanded: toggles[0]?.getAttribute('aria-expanded') ?? null,
          listingShown: listing ? getComputedStyle(listing).display !== 'none' : null,
          pending: document.documentElement.hasAttribute('data-gnr-pending'),
          path: location.pathname,
        };
      });
    // Waits until the toggle for the current URL is in place (the extension re-applies per frame).
    const settled = async () => {
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[data-gnr="toggle"]').length === 1 &&
          !document.documentElement.hasAttribute('data-gnr-pending'),
        null,
        { timeout: 10_000 },
      );
      await page.waitForTimeout(400); // let late re-renders and re-applies finish
      return state();
    };

    await page.goto(REPO, { waitUntil: 'domcontentloaded' });
    let s = await settled();
    check(
      s.toggles === 1 && s.listingShown === false && s.expanded === 'false',
      `[${colorScheme}] cold load: one toggle, collapsed (${JSON.stringify(s)})`,
    );

    if (SHOTS) {
      const box = await page
        .locator('[data-gnr="toggle"]')
        .evaluateHandle((b) => b.closest('.border'));
      await box.asElement()?.screenshot({ path: join(SHOTS, `collapsed-${colorScheme}.png`) });
    }

    await page.click('[data-gnr="toggle"]');
    s = await state();
    check(
      s.listingShown === true && s.expanded === 'true',
      `[${colorScheme}] click shows the listing`,
    );
    if (SHOTS) {
      await page.screenshot({
        path: join(SHOTS, `expanded-${colorScheme}.png`),
        clip: { x: 0, y: 0, width: 1280, height: 900 },
      });
    }
    await page.click('[data-gnr="toggle"]');
    s = await state();
    check(
      s.listingShown === false && s.expanded === 'false',
      `[${colorScheme}] second click hides it`,
    );

    if (colorScheme === 'light') {
      for (let i = 1; i <= 20; i += 2) {
        // Expand, open a folder (a soft navigation), check; then Back (another), check.
        await page.click('[data-gnr="toggle"]');
        await page.locator(`${FOLDER_LINK}:visible`).first().click();
        await page.waitForURL('**/tree/main/packages');
        s = await settled();
        check(
          s.toggles === 1 && s.listingShown === false && s.expanded === 'false',
          `soft navigation ${i} (to ${s.path}): one toggle, collapsed`,
        );
        await page.goBack();
        await page.waitForURL(REPO);
        s = await settled();
        check(
          s.toggles === 1 && s.listingShown === false && s.expanded === 'false',
          `soft navigation ${i + 1} (back to ${s.path}): one toggle, collapsed`,
        );
      }
    }
  } finally {
    await ctx.close();
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} check(s)`);
  process.exitCode = 1;
} else {
  console.error('PASS: all Phase 1 exit checks');
}
