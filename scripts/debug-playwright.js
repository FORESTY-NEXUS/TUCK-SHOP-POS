const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/pos/order/new', { waitUntil: 'networkidle' });

  // Wait for products to load
  await page.waitForTimeout(3000);

  // Check what text is on the page
  const bodyText = await page.textContent('body');
  const hasChickenTikka = bodyText.includes('Chicken Tikka Pizza');
  console.log('Has Chicken Tikka Pizza in text:', hasChickenTikka);

  // Find all elements with "Chicken Tikka" in text
  const elements = await page.locator('*').filter({ hasText: 'Chicken Tikka Pizza' }).count();
  console.log('Elements containing "Chicken Tikka Pizza":', elements);

  // Check for buttons specifically
  const buttons = await page.locator('button').count();
  console.log('Total buttons:', buttons);

  // Get text of first few buttons
  for (let i = 0; i < Math.min(5, buttons); i++) {
    const text = await page.locator('button').nth(i).textContent();
    console.log(`Button ${i}:`, text?.substring(0, 80));
  }

  // Check if the product cards exist
  const cards = await page.locator('.bg-white.border.border-gray-100').count();
  console.log('Product cards:', cards);

  // Get text of all cards
  for (let i = 0; i < Math.min(5, cards); i++) {
    const text = await page.locator('.bg-white.border.border-gray-100').nth(i).textContent();
    console.log(`Card ${i}:`, text?.substring(0, 100));
  }

  // Check for "Select a size" text
  const modalText = await page.textContent('body');
  const hasModal = modalText.includes('Select a size');
  console.log('Has modal text:', hasModal);

  // Take screenshot
  await page.screenshot({ path: 'C:/midtown-pos/debug-page.png' });
  console.log('Screenshot saved');

  await browser.close();
})();
