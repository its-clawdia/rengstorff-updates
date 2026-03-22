const { chromium } = require('playwright');

// Target meetings: date, body, matter title fragment
const targets = [
  { date: '2014-02-11', body: 'City Council', label: 'Feb 11, 2014' },
  { date: '2018-11-27', body: 'City Council', label: 'Nov 27, 2018' },
  { date: '2022-11-01', body: 'City Council', label: 'Nov 1, 2022' },
  { date: '2023-06-27', body: 'City Council', label: 'Jun 27, 2023' },
  { date: '2024-01-23', body: 'City Council', label: 'Jan 23, 2024' },
  { date: '2024-06-25', body: 'City Council', label: 'Jun 25, 2024' },
  { date: '2024-10-29', body: 'Transportation', label: 'Oct 29, 2024' },
  { date: '2025-03-04', body: 'Transportation', label: 'Mar 4, 2025' },
  { date: '2025-09-02', body: 'Transportation', label: 'Sep 2, 2025' },
  { date: '2025-11-18', body: 'City Council', label: 'Nov 18, 2025' },
];

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();

  const results = [];

  for (const target of targets) {
    // Search the calendar for past meetings around the target date
    const year = target.date.split('-')[0];
    const url = `https://mountainview.legistar.com/Calendar.aspx?SelectYear=${year}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

    // Find meeting detail links matching the date and body
    const match = await page.evaluate((t) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const text = row.innerText || '';
        // Check if this row contains our date and body
        if (text.includes(t.dateFragment) && text.includes(t.bodyFragment)) {
          const link = row.querySelector('a[href*="MeetingDetail"]');
          if (link) return { href: link.href, text: text.substring(0, 100) };
        }
      }
      return null;
    }, {
      dateFragment: target.date.replace(/-/g, '/').replace(/^(\d+)\/(\d+)\/(\d+)$/, '$2/$3/$1').replace(/^0/, ''),
      bodyFragment: target.body
    });

    // Try alternate date formats
    if (!match) {
      // Try M/D/YYYY format
      const [y, m, d] = target.date.split('-');
      const dateStr = `${parseInt(m)}/${parseInt(d)}/${y}`;
      const match2 = await page.evaluate((t) => {
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const text = row.innerText || '';
          if (text.includes(t.dateStr) && text.includes(t.bodyFragment)) {
            const link = row.querySelector('a[href*="MeetingDetail"]');
            if (link) return { href: link.href, text: text.substring(0, 100) };
          }
        }
        return null;
      }, { dateStr, bodyFragment: target.body });
      results.push({ label: target.label, date: target.date, ...( match2 || { href: null }) });
    } else {
      results.push({ label: target.label, date: target.date, ...match });
    }
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => console.error(e.message));
