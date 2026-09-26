const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/pos/order/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check if there's a Suspense boundary or loading state
  const suspenseCount = await page.locator('[data-next-suspense]').count();
  console.log('Suspense boundaries:', suspenseCount);

  // Check for loading states
  const loadingText = await page.textContent('body');
  console.log('Has "Loading":', loadingText.includes('Loading'));
  console.log('Has "Search":', loadingText.includes('Search'));

  // Find all interactive elements
  const allClickable = await page.locator('button, a, [role="button"], input').count();
  console.log('All clickable elements:', allClickable);

  // Get product card area HTML
  const cards = await page.locator('.bg-white.border.border-gray-100').all();
  console.log('Product cards found:', cards.length);
  for (const card of cards.slice(0, 3)) {
    const text = await card.textContent();
    console.log('Card text:', text?.substring(0, 120));
  }

  // Check if product grid exists
  const grid = await page.locator('.grid-cols-2').count();
  console.log('Product grid:', grid);

  // Check the actual DOM structure around Chicken Tikka
  const result = await page.evaluate(() => {
    const el = document.querySelector('*:has-text("Chicken Tikka Pizza")');
    if (el) {
      return { tag: el.tagName, class: el.className, text: el.textContent?.substring(0, 100), parent: el.parentElement?.tagName };
    }
    // Try text node search
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('Chicken Tikka Pizza')) {
        return { foundIn: node.parentElement?.tagName, parentClass: node.parentElement?.className, text: node.textContent.substring(0, 80) };
      }
    }
    return { foundIn: 'none' };
  });
  console.log('Chicken Tikka Pizza context:', JSON.stringify(result, null, 2));

  await page.screenshot({ path: 'C:/midtown-pos/debug-page3.png' });
  console.log('Screenshot saved');
  await browser.close();
})();
