import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'fs';

const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html style="margin:0;padding:0;background:#f96302">` +
    `<body style="margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden">` +
    svg.replace('<svg ', `<svg width="${size}" height="${size}" `) +
    `</body></html>`
  );
  await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname });
  console.log(`icons/icon-${size}.png written`);
}

await browser.close();
