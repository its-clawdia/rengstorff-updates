const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  await page.goto('https://mountainview.legistar.com/Legislation.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Type in search box
  await page.fill('#ctl00_ContentPlaceHolder1_txtSearch', 'Rengstorff Grade Separation');
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  
  // Get result links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="LegislationDetail"], a[href*="MeetingDetail"]'))
      .map(e => ({ text: e.textContent.trim().substring(0, 80), href: e.href }))
      .slice(0, 20);
  });
  console.log(JSON.stringify(links, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
