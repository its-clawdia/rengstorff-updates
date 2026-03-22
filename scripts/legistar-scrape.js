const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch({
      args: ['--no-sandbox'],
      executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
    });
    const page = await browser.newPage();
    
    // Navigate to the Legistar calendar
    await page.goto('https://mountainview.legistar.com/Calendar.aspx', { waitUntil: 'networkidle', timeout: 20000 });
    
    // Get all MeetingDetail links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="MeetingDetail"]'))
        .map(e => ({ text: e.closest('tr') ? e.closest('tr').innerText.substring(0, 80) : e.textContent.trim(), href: e.href }))
        .slice(0, 10);
    });
    console.log(JSON.stringify(links, null, 2));
    await browser.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
