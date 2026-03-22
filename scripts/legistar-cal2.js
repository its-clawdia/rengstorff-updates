const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  
  // Navigate to calendar with year param and look for a specific body
  // Try to select year 2025 from the dropdown
  await page.goto('https://mountainview.legistar.com/Calendar.aspx', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Check what's in the year dropdown
  const yearOptions = await page.evaluate(() => {
    const input = document.getElementById('ctl00_ContentPlaceHolder1_lstYears_Input');
    if (input) {
      // Try to get the underlying Telerik dropdown options
      const listbox = document.querySelector('[id*="lstYears_DropDown"] li');
      return { inputValue: input.value, listItems: Array.from(document.querySelectorAll('[id*="lstYears"] li')).map(li => li.textContent.trim()) };
    }
    return null;
  });
  console.log('Year options:', JSON.stringify(yearOptions));
  
  // Click year dropdown to open it
  await page.click('#ctl00_ContentPlaceHolder1_lstYears_Input');
  await page.waitForTimeout(1000);
  
  const dropdownItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="DropDown"] li, .rcbList li')).map(li => li.textContent.trim());
  });
  console.log('Dropdown items:', JSON.stringify(dropdownItems));
  
  await browser.close();
})().catch(e => console.error(e.message));
