const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  await page.goto('https://mountainview.legistar.com/Calendar.aspx?SelectYear=2025', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Get all meeting detail links with surrounding text
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="MeetingDetail"]'))
      .map(e => {
        const row = e.closest('tr');
        return { text: row ? row.innerText.replace(/\s+/g, ' ').substring(0, 120) : e.textContent, href: e.href };
      });
  });
  console.log(JSON.stringify(links, null, 2));
  await browser.close();
})().catch(e => console.error(e.message));
