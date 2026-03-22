const { chromium } = require('playwright');

// For each matter: year, body, date string to match (M/D/YYYY), label
const targets = [
  { year: '2014', body: 'City Council', dateStr: '2/11/2014', label: 'Feb 11, 2014' },
  { year: '2018', body: 'City Council', dateStr: '11/27/2018', label: 'Nov 27, 2018' },
  { year: '2022', body: 'City Council', dateStr: '11/1/2022', label: 'Nov 1, 2022' },
  { year: '2023', body: 'City Council', dateStr: '6/27/2023', label: 'Jun 27, 2023' },
  { year: '2024', body: 'City Council', dateStr: '1/23/2024', label: 'Jan 23, 2024' },
  { year: '2024', body: 'City Council', dateStr: '6/25/2024', label: 'Jun 25, 2024' },
  { year: '2024', body: 'Council Transportation Committee', dateStr: '10/29/2024', label: 'Oct 29, 2024' },
  { year: '2025', body: 'Council Transportation Committee', dateStr: '3/4/2025', label: 'Mar 4, 2025' },
  { year: '2025', body: 'Council Transportation Committee', dateStr: '9/2/2025', label: 'Sep 2, 2025' },
  { year: '2025', body: 'City Council', dateStr: '11/18/2025', label: 'Nov 18, 2025' },
];

async function selectDropdownItem(page, inputId, value) {
  await page.click(`#${inputId}`);
  await page.waitForTimeout(500);
  // Find and click the item in the dropdown
  const items = await page.$$('.rcbList li, [class*="DropDown"] li');
  for (const item of items) {
    const text = await item.textContent();
    if (text.trim() === value) {
      await item.click();
      await page.waitForTimeout(2000);
      return true;
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  const results = [];

  let currentYear = null;
  let currentBody = null;

  for (const target of targets) {
    // Navigate to calendar
    if (currentYear !== target.year || currentBody !== target.body) {
      await page.goto('https://mountainview.legistar.com/Calendar.aspx', { waitUntil: 'networkidle', timeout: 20000 });
      
      // Select year
      await selectDropdownItem(page, 'ctl00_ContentPlaceHolder1_lstYears_Input', target.year);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Select body
      await selectDropdownItem(page, 'ctl00_ContentPlaceHolder1_lstBodies_Input', target.body);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      currentYear = target.year;
      currentBody = target.body;
    }

    // Find the meeting link matching the date
    const link = await page.evaluate((dateStr) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const text = (row.innerText || '').replace(/\s+/g, ' ');
        if (text.includes(dateStr)) {
          const a = row.querySelector('a[href*="MeetingDetail"]');
          if (a) return a.href;
        }
      }
      return null;
    }, target.dateStr);

    results.push({ label: target.label, href: link });
    console.error(`${target.label}: ${link || 'not found'}`);
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => console.error(e.message));
