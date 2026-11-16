// Diagnose: does the extension come back after chrome.runtime.reload() under Playwright?
import { chromium } from 'playwright';

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Fail fast on a missing or wrong path instead of an opaque Chromium launch (agy review, #2).
// Absolute, so Chromium's extension flags get a usable path from a relative argument (#7).
const EXT = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!EXT || !existsSync(join(EXT, 'manifest.json'))) {
  console.error(`usage: node ${process.argv[1]} <path to .output/chrome-mv3>`);
  process.exit(2);
}
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  const log = (...a) => console.log(...a);
  const sws = () => ctx.serviceWorkers().map((w) => w.url());

  const watch = (p, tag) =>
    p.on('console', (m) => m.text().includes('[gnr]') && log(`  [${tag}]`, m.text()));

  let sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  log('service workers before reload:', sws());

  const p1 = ctx.pages()[0] ?? (await ctx.newPage());
  watch(p1, 'tab1');
  await p1.goto('https://github.com/wxt-dev/wxt', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(2000);

  ctx.on('serviceworker', (w) => log('  serviceworker event:', w.url()));
  await sw
    .evaluate(() => chrome.runtime.reload())
    .catch((e) => log('reload evaluate threw:', e.message));
  await p1.waitForTimeout(5000);
  log('service workers 5s after reload:', sws());

  log('-- tab1 full reload');
  await p1.reload({ waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(2500);

  log('-- new tab2 fresh load');
  const p2 = await ctx.newPage();
  watch(p2, 'tab2');
  await p2.goto('https://github.com/wxt-dev/wxt/tree/main/packages', {
    waitUntil: 'domcontentloaded',
  });
  await p2.waitForTimeout(2500);

  log('final service workers:', sws());
} finally {
  await ctx.close();
}
