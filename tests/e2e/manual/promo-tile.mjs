// Renders the Chrome Web Store small promo tile (440x280) from the extension icon. The text states
// only what the current version does (docs/release.md section 6).
//
//   node promo-tile.mjs <assets/icon.png> <output .png>
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const [icon, out] = process.argv.slice(2);
const b64 = readFileSync(icon).toString('base64');
const html = `<!doctype html><html><body style="margin:0;width:440px;height:280px;background:#0d1117;
display:flex;align-items:center;gap:22px;padding:0 30px;box-sizing:border-box;font-family:'Inter','Segoe UI',sans-serif">
<img src="data:image/png;base64,${b64}" style="width:120px;height:120px;border-radius:24px">
<div><div style="color:#f0f6fc;font-size:30px;font-weight:700;line-height:1.15">GH ListRollup</div>
<div style="color:#9198a1;font-size:17px;line-height:1.4;margin-top:10px">Collapse GitHub's file list<br>to one line. One click<br>brings it back.</div></div></body></html>`;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log('ok');
