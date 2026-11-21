// Store screenshots for a release: the extension on a public repository, 1280x800, light theme.
//   node store-shots.mjs <path to .output/chrome-mv3> <output dir>
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

if (!process.argv[2] || !process.argv[3]) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3> <output dir>`);
  process.exit(2);
}
const EXT = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
if (!existsSync(join(EXT, 'manifest.json'))) {
  console.error(`no manifest.json in ${EXT}: pass the built .output/chrome-mv3 directory`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const PAGES = [
  ['root', 'https://github.com/wxt-dev/wxt'],
  ['folder', 'https://github.com/wxt-dev/wxt/tree/main/packages'],
];

for (const [name, url] of PAGES) {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    colorScheme: 'light',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-gnr="toggle"]').length === 1 &&
        !document.documentElement.hasAttribute('data-gnr-pending'),
      null,
      { timeout: 15000 },
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${name}-collapsed-1280x800.png`) });
    await page.click('[data-gnr="toggle"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${name}-expanded-1280x800.png`) });
    console.log(name, 'ok');
  } finally {
    await ctx.close();
  }
}
