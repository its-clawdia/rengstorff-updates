const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  await page.goto('https://mountainview.legistar.com/Calendar.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Set date filter to a past date - Nov 18, 2025 (one of our target dates)
  await page.fill('#ctl00_ContentPlaceHolder1_txtDateFilter_dateInput', '11/18/2025');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="MeetingDetail"]'))
      .map(e => {
        const row = e.closest('tr');
        return { text: row ? row.innerText.replace(/\s+/g, ' ').substring(0, 100) : '', href: e.href };
      });
  });
  console.log('After date filter:', JSON.stringify(links.slice(0, 10), null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
