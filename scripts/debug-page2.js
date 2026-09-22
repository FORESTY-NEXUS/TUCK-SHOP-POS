const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/pos/order/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Get all text on page
  const bodyText = await page.textContent('body');
  console.log('=== Page text (first 2000 chars) ===');
  console.log(bodyText.substring(0, 2000));
  console.log('\n=== Contains Chicken Tikka Pizza? ===', bodyText.includes('Chicken Tikka Pizza'));
  console.log('=== Contains Chicken Tikka? ===', bodyText.includes('Chicken Tikka'));
  console.log('=== Contains Small? ===', bodyText.includes('Small'));

  // Count buttons and product cards
  const buttons = await page.locator('button').count();
  const cards = await page.locator('.bg-white').count();
  console.log('\n=== Buttons:', buttons, 'Cards:', cards);

  // Get text of all visible elements containing "Chicken"
  const chickenEls = await page.locator('text=Chicken').count();
  console.log('Elements containing "Chicken":', chickenEls);

  // Take screenshot
  await page.screenshot({ path: 'C:/midtown-pos/debug-page2.png' });
  console.log('\nScreenshot saved to debug-page2.png');

  // Dump all button text
  console.log('\n=== All button texts ===');
  for (let i = 0; i < await buttons; i++) {
    const text = await page.locator('button').nth(i).textContent();
    console.log(`[${i}]`, text?.trim().substring(0, 60));
  }

  await browser.close();
})();
