#!/usr/bin/env bash
# rengstorff-check.sh — Daily check for new Rengstorff Grade Separation matters
# Cron: 0 9 * * *
#
# What it does:
#   1. Queries Legistar API for matters modified since last run
#   2. Filters to Rengstorff-specific grade separation items only
#   3. For each new matter, fetches staff report PDF and extracts text
#   4. Uses headless browser (Playwright) to get the correct MeetingDetail URL
#   5. Generates an HTML blog post and pushes to GitHub Pages

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
STATE_FILE="$SCRIPT_DIR/rengstorff-state.json"
LEGISTAR_API="https://webapi.legistar.com/v1/mountainview"
NODE_PATH_EXTRA="/home/openclaw/.npm/_npx/e41f203b7505f1fb/node_modules"
CHROME="/home/openclaw/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell"
TODAY=$(date -u +%Y-%m-%d)
LOG_PREFIX="[rengstorff-check $(date -u +%H:%M:%S)]"

log() { echo "$LOG_PREFIX $*"; }

# ── 1. Load state ────────────────────────────────────────────────────────────
if [[ -f "$STATE_FILE" ]]; then
  LAST_CHECK=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['last_check'])")
else
  LAST_CHECK=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null \
    || date -u -v-30d +%Y-%m-%dT%H:%M:%S)
fi
log "Last check: $LAST_CHECK"

# ── 2. Sanity check: verify API is reachable ─────────────────────────────────
API_TEST=$(curl -sf --max-time 10 "${LEGISTAR_API}/matters?%24top=1" | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d else 'empty')" 2>/dev/null || echo "FAIL")
if [[ "$API_TEST" == "FAIL" ]]; then
  log "ERROR: Legistar API unreachable. Aborting."
  exit 1
fi
log "API sanity check: $API_TEST"

# ── 3. Sanity check: verify git repo is clean and remote is reachable ────────
cd "$REPO_DIR"
if ! git fetch origin --dry-run 2>/dev/null; then
  log "ERROR: Cannot reach GitHub remote. Aborting."
  exit 1
fi
log "Git remote: reachable"

# ── 4. Fetch recently modified matters with "Rengstorff" in title ────────────
log "Querying Legistar for matters modified since $LAST_CHECK ..."
RAW=$(curl -sf --max-time 20 \
  "${LEGISTAR_API}/matters?\$filter=substringof('Rengstorff',MatterTitle)+eq+true+and+MatterLastModifiedUtc+gt+datetime'${LAST_CHECK}'&\$top=50" \
  || echo "[]")

# Filter to grade separation items only (exclude housing, park, etc.)
NEW_MATTERS=$(echo "$RAW" | python3 -c "
import json, sys
data = json.load(sys.stdin)
keep = []
for m in data:
    t = (m.get('MatterTitle') or '').lower()
    if 'grade separation' in t or ('rengstorff' in t and ('grade' in t or 'underpass' in t or 'overpass' in t)):
        keep.append(m)
print(json.dumps(keep))
")

COUNT=$(echo "$NEW_MATTERS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
log "Found $COUNT new/updated Rengstorff grade separation matter(s)."

if [[ "$COUNT" -eq 0 ]]; then
  log "Nothing to post. Updating state."
  # Check if weekly all-clear is due (every 7 days)
  LAST_WEEKLY=$(python3 -c "
import json, datetime
try:
    s = json.load(open('$STATE_FILE'))
    lw = s.get('last_weekly_report')
    if lw:
        delta = (datetime.date.today() - datetime.date.fromisoformat(lw)).days
        print(delta)
    else:
        print(999)
except:
    print(999)
")
  python3 -c "
import json
try:
    s = json.load(open('$STATE_FILE'))
except:
    s = {}
s['last_check'] = '$(date -u +%Y-%m-%dT%H:%M:%S)'
json.dump(s, open('$STATE_FILE','w'))
"
  if [[ "$LAST_WEEKLY" -ge 7 ]]; then
    python3 -c "
import json
s = json.load(open('$STATE_FILE'))
s['last_weekly_report'] = '$(date -u +%Y-%m-%d)'
json.dump(s, open('$STATE_FILE','w'))
"
    echo "✅ Rengstorff grade separation weekly check: no new matters. Everything is working."
  fi
  exit 0
fi

# ── 5. For each matter: get attachments, download PDFs, extract text ──────────
ENRICHED=$(echo "$NEW_MATTERS" | python3 - <<'PYEOF'
import json, sys, subprocess, tempfile, os, urllib.request

matters = json.load(sys.stdin)
api_base = "https://webapi.legistar.com/v1/mountainview"

def fetch_json(url):
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return []

def extract_pdf_text(url, max_chars=3000):
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
            tmp = f.name
        with urllib.request.urlopen(url, timeout=30) as r:
            with open(tmp, 'wb') as f:
                f.write(r.read())
        result = subprocess.run(['pdftotext', tmp, '-'], capture_output=True, text=True, timeout=30)
        os.unlink(tmp)
        if result.returncode == 0:
            # Return first max_chars chars of meaningful content
            text = result.stdout
            # Skip past the header/title area, focus on RECOMMENDATION + BACKGROUND
            for section in ['RECOMMENDATION', 'BACKGROUND', 'SUMMARY', 'PURPOSE']:
                idx = text.find(section)
                if idx > 0:
                    return text[idx:idx+max_chars]
            return text[:max_chars]
    except Exception as e:
        return f"(PDF extraction failed: {e})"

enriched = []
for m in matters:
    mid = m['MatterId']
    # Fetch attachments
    attachments = fetch_json(f"{api_base}/matters/{mid}/attachments")
    # Find the primary staff report (prefer "Council Report" or "CTC Memo")
    pdf_url = None
    for att in attachments:
        name = (att.get('MatterAttachmentName') or '').lower()
        url = att.get('MatterAttachmentHyperlink') or ''
        if url.endswith('.pdf') and any(k in name for k in ['council report', 'ctc memo', 'staff report', 'memo']):
            pdf_url = url
            break
    if not pdf_url and attachments:
        # Fall back to first PDF
        for att in attachments:
            if (att.get('MatterAttachmentHyperlink') or '').endswith('.pdf'):
                pdf_url = att['MatterAttachmentHyperlink']
                break

    pdf_text = extract_pdf_text(pdf_url) if pdf_url else "(No PDF available)"
    m['_pdf_text'] = pdf_text
    m['_pdf_url'] = pdf_url or ''
    enriched.append(m)

print(json.dumps(enriched))
PYEOF
)

# ── 6. Get MeetingDetail URLs via headless browser ────────────────────────────
log "Fetching meeting detail URLs via headless browser ..."
MEETING_URLS=$(echo "$ENRICHED" | python3 -c "
import json, sys
matters = json.load(sys.stdin)
for m in matters:
    agenda = (m.get('MatterAgendaDate') or '').split('T')[0]
    body = m.get('MatterBodyName','')
    print(f\"{m['MatterId']}|{agenda}|{body}\")
" | while IFS='|' read -r mid date body; do
  if [[ -z "$date" ]]; then
    echo "$mid|null"
    continue
  fi
  year="${date%%-*}"
  month="${date#*-}"; month="${month%%-*}"; month="${month#0}"
  day="${date##*-}"; day="${day#0}"
  date_str="${month}/${day}/${year%%-*}"
  # Use node + playwright to scrape the calendar
  URL=$(NODE_PATH="$NODE_PATH_EXTRA" node - "$year" "$date_str" "$body" "$CHROME" <<'JSEOF' 2>/dev/null
const [,, year, dateStr, body, chrome] = process.argv;
const { chromium } = require('playwright');
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: chrome });
    const page = await browser.newPage();
    await page.goto(`https://mountainview.legistar.com/Calendar.aspx`, { waitUntil: 'networkidle', timeout: 20000 });
    // Select year
    await page.click('#ctl00_ContentPlaceHolder1_lstYears_Input');
    await page.waitForTimeout(400);
    const yearItems = await page.$$('.rcbList li');
    for (const li of yearItems) {
      if ((await li.textContent()).trim() === year) { await li.click(); break; }
    }
    await page.waitForTimeout(2000);
    // Select body
    await page.click('#ctl00_ContentPlaceHolder1_lstBodies_Input');
    await page.waitForTimeout(400);
    const bodyItems = await page.$$('.rcbList li');
    for (const li of bodyItems) {
      if ((await li.textContent()).trim() === body) { await li.click(); break; }
    }
    await page.waitForTimeout(2000);
    // Find link
    const href = await page.evaluate((ds) => {
      for (const row of document.querySelectorAll('tr')) {
        if (row.innerText.includes(ds)) {
          const a = row.querySelector('a[href*="MeetingDetail"]');
          if (a) return a.href;
        }
      }
      return null;
    }, dateStr);
    console.log(href || 'null');
  } catch(e) { console.log('null'); }
  finally { if (browser) await browser.close(); }
})();
JSEOF
  )
  echo "$mid|${URL:-null}"
done)

# ── 7. Generate blog post HTML ────────────────────────────────────────────────
POST_SLUG="${TODAY}-update"
POST_FILE="$REPO_DIR/posts/${POST_SLUG}.html"

python3 - <<PYEOF
import json, sys

matters = json.loads('''$ENRICHED'''.replace("'", "'"))
meeting_urls = {}
for line in """$MEETING_URLS""".strip().split('\n'):
    if '|' in line:
        mid_str, url = line.split('|', 1)
        try: meeting_urls[int(mid_str)] = url.strip() if url.strip() != 'null' else None
        except: pass

today = "$TODAY"
rows = ""
for m in sorted(matters, key=lambda x: x.get('MatterAgendaDate','') or ''):
    title = (m.get('MatterTitle') or '').replace('<','&lt;').replace('>','&gt;')
    agenda = (m.get('MatterAgendaDate') or '').split('T')[0]
    body = m.get('MatterBodyName','')
    mtype = m.get('MatterTypeName','')
    status = m.get('MatterStatusName','')
    mid = m.get('MatterId')
    file_no = m.get('MatterFile','')
    meeting_url = meeting_urls.get(mid)
    date_str = f'<a href="{meeting_url}" target="_blank">{agenda} ↗</a>' if meeting_url else agenda

    # Summarize PDF text (first 600 chars of RECOMMENDATION/BACKGROUND)
    pdf_snippet = (m.get('_pdf_text') or '').strip()[:600].replace('<','&lt;').replace('>','&gt;')
    pdf_link = m.get('_pdf_url','')
    pdf_section = f'<div class="detail">{pdf_snippet}{"..." if len(pdf_snippet)==600 else ""}'
    if pdf_link:
        pdf_section += f' <a href="{pdf_link}" target="_blank">[full report]</a>'
    pdf_section += '</div>'

    rows += f"""
    <li>
      <div class="date">{date_str} — {body}</div>
      <div><strong>{title}</strong></div>
      <div class="body">Type: {mtype} &nbsp;|&nbsp; Status: {status} &nbsp;|&nbsp; Legistar #{file_no}</div>
      {pdf_section}
    </li>"""

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rengstorff Grade Separation Update — {today}</title>
  <style>
    body {{ font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }}
    h1 {{ font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 10px; }}
    .meta {{ color: #666; font-size: 0.9em; margin-bottom: 2em; }}
    .timeline {{ list-style: none; padding: 0; }}
    .timeline li {{ margin: 1.8em 0; padding-left: 1.5em; border-left: 3px solid #444; }}
    .timeline .date {{ font-weight: bold; color: #333; }}
    .timeline .detail {{ color: #444; font-size: 0.9em; margin-top: 0.4em; line-height: 1.5; }}
    .timeline .body {{ color: #888; font-size: 0.82em; margin-top: 0.3em; }}
    a {{ color: #1a0dab; }}
    nav {{ margin-bottom: 2em; }}
    footer {{ margin-top: 3em; border-top: 1px solid #ccc; padding-top: 1em; color: #666; font-size: 0.85em; }}
  </style>
</head>
<body>
  <nav><a href="../index.html">&larr; All posts</a></nav>
  <h1>Rengstorff Grade Separation Update — {today}</h1>
  <div class="meta">Auto-generated: {today} &nbsp;|&nbsp; Source: Mountain View Legistar API + staff reports</div>
  <p>{len(matters)} new or updated matter(s) detected since last check:</p>
  <ul class="timeline">{rows}
  </ul>
  <footer>
    Data from <a href="https://webapi.legistar.com/v1/mountainview/">Mountain View Legistar API</a> and staff reports (PDFs).
  </footer>
</body>
</html>"""

with open("$POST_FILE", "w") as f:
    f.write(html)
print(f"Post written: $POST_FILE")
PYEOF

# ── 8. Update index.html ───────────────────────────────────────────────────────
python3 -c "
import re
index = '$REPO_DIR/index.html'
with open(index) as f: content = f.read()
entry = '''    <li>
      <span class=\"date\">$TODAY</span><br>
      <a href=\"posts/${POST_SLUG}.html\">Rengstorff Update &mdash; $TODAY</a>
    </li>
    '''
content = content.replace('<ul class=\"post-list\">\n', '<ul class=\"post-list\">\n' + entry, 1)
with open(index, 'w') as f: f.write(content)
print('Index updated.')
"

# ── 9. Commit and push ────────────────────────────────────────────────────────
cd "$REPO_DIR"
git add -A
git commit -m "Auto-update: ${COUNT} new Rengstorff matter(s) — ${TODAY}"
git push origin main
log "Pushed to GitHub."

# ── 10. Update state ──────────────────────────────────────────────────────────
python3 -c "import json; json.dump({'last_check': '$(date -u +%Y-%m-%dT%H:%M:%S)', 'last_post': '$TODAY', 'last_count': $COUNT}, open('$STATE_FILE','w'))"
log "Done."
