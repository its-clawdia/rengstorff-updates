const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  await page.goto('https://mountainview.legistar.com/Legislation.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('#ctl00_ContentPlaceHolder1_txtSearch', 'Rengstorff Grade Separation');
  
  // Click search button instead of Enter
  const btn = await page.$('input[type="submit"], input[value*="Search"], button[type="submit"]');
  if (btn) await btn.click();
  else await page.keyboard.press('Enter');
  
  await page.waitForTimeout(5000);
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="LegislationDetail"]'))
      .map(e => ({ text: e.textContent.trim().substring(0, 100), href: e.href }))
      .slice(0, 15);
  });
  console.log(JSON.stringify(links, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
