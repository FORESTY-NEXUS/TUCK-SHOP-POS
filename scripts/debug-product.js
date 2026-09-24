const fs = require('fs');
const html = fs.readFileSync('/tmp/page.html', 'utf8');
const idx = html.indexOf('Chicken Tikka Pizza');
if (idx >= 0) {
  const start = Math.max(0, idx - 400);
  const end = Math.min(html.length, idx + 400);
  console.log(html.substring(start, end));
} else {
  console.log('NOT FOUND');
}
