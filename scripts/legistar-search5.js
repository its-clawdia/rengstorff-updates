const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  // Try file number search for matter 9971 - need to get the file number first
  // From API: MatterFile for these items. Let's try searching by file number "25-555" or try title keywords
  await page.goto('https://mountainview.legistar.com/Legislation.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Try searching just "Rengstorff"
  await page.fill('#ctl00_ContentPlaceHolder1_txtSearch', 'Rengstorff');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000);
  
  const data = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="LegislationDetail"]')).map(e => ({ text: e.textContent.trim().substring(0, 100), href: e.href }));
    const snippet = document.body.innerText.substring(0, 800);
    return { links: links.slice(0, 10), snippet };
  });
  console.log(JSON.stringify(data, null, 2));
  
  await browser.close();
})().catch(e => console.error(e.message));
