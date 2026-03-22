const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  await page.goto('https://mountainview.legistar.com/LegislationDetail.aspx?ID=9971&GUID=696C9D79-D71F-4352-ACB4-1A23118E8742&Options=&Search=', { waitUntil: 'networkidle', timeout: 20000 });
  const content = await page.content();
  console.log(content.substring(0, 3000));
  await browser.close();
})().catch(e => console.error(e.message));
