const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  await page.goto('https://mountainview.legistar.com/Legislation.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('#ctl00_ContentPlaceHolder1_txtSearch', 'Rengstorff Grade Separation');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000);
  
  // Get all links and some body text to see what loaded
  const data = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a')).map(e => e.href).filter(h => h.includes('Detail')).slice(0, 10);
    const bodySnippet = document.body.innerText.substring(0, 500);
    return { links, bodySnippet };
  });
  console.log(JSON.stringify(data, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
