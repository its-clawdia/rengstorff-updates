const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  // Try the calendar with SelectYear and other params to get past meetings
  await page.goto('https://mountainview.legistar.com/Calendar.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Check available controls
  const controls = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select, input[type="text"]')).map(e => ({
      id: e.id, name: e.name, options: e.tagName === 'SELECT' ? Array.from(e.options).map(o => o.value + ':' + o.text) : []
    }));
    return selects;
  });
  console.log('Controls:', JSON.stringify(controls, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
