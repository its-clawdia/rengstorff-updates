const { chromium } = require('playwright');

const matters = [
  { id: 1351, guid: '3F3FBB5D-06D6-444A-8814-72AF9C89014C', label: 'Feb 11, 2014' },
  { id: 3628, guid: 'A7FA1D8F-4A05-4CEB-8AF3-34E4BFEF122E', label: 'Nov 27, 2018' },
  { id: 6796, guid: '26BCA987-9100-42FA-BFE9-B949F31D624B', label: 'Nov 1, 2022' },
  { id: 7689, guid: '59D03979-6D9D-4983-A8B8-8CB5C0DE7155', label: 'Jun 27, 2023' },
  { id: 7989, guid: 'E7A01BD4-3E15-4FEC-9E1E-C55389C7AD55', label: 'Jan 23, 2024' },
  { id: 8444, guid: 'B5AF0940-E67A-4751-A89C-F4002DF991A6', label: 'Jun 25, 2024' },
  { id: 9095, guid: 'C1652088-8B11-477B-A5A4-6FDBBD34A73D', label: 'Oct 29, 2024' },
  { id: 9146, guid: 'C4D3F1C1-F762-4627-B478-8B1EFD13F7F5', label: 'Mar 4, 2025' },
  { id: 9795, guid: '35B32D17-FF5B-41C1-98D7-E6C9E03D29AB', label: 'Sep 2, 2025' },
  { id: 9971, guid: '696C9D79-D71F-4352-ACB4-1A23118E8742', label: 'Nov 18, 2025' },
];

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage();
  const results = [];

  for (const m of matters) {
    const url = `https://mountainview.legistar.com/LegislationDetail.aspx?ID=${m.id}&GUID=${m.guid}&Options=&Search=`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    
    // Look for MeetingDetail links on this page
    const meetingLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="MeetingDetail"]'));
      return links.length > 0 ? links[0].href : null;
    });
    
    // Also get page title to confirm it loaded
    const title = await page.title();
    
    results.push({ label: m.label, matterId: m.id, title, meetingLink });
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => console.error(e.message));
