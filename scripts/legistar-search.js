const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  // Try Legistar search
  await page.goto('https://mountainview.legistar.com/Legislation.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  const content = await page.content();
  console.log('Page title:', await page.title());
  
  // Look for search inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select')).map(e => ({
      tag: e.tagName, type: e.type, name: e.name, id: e.id, placeholder: e.placeholder
    })).slice(0, 15);
  });
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
