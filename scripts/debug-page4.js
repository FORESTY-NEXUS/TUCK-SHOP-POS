const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/pos/order/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Find the DOM node containing "Chicken Tikka Pizza"
  const result = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('Chicken Tikka Pizza')) {
        const el = node.parentElement;
        return {
          tag: el.tagName,
          classes: el.className,
          text: el.textContent?.substring(0, 120),
          grandparent: el.parentElement?.tagName + '.' + (el.parentElement?.className || '').substring(0, 60),
        };
      }
    }
    return { found: false };
  });
  console.log('Product element context:', JSON.stringify(result, null, 2));

  // Check what the product grid area looks like
  const html = await page.evaluate(() => {
    // Find the area with product cards
    const all = document.querySelectorAll('*');
    let found = null;
    for (const el of all) {
      if (el.textContent?.includes('Chicken Tikka Pizza') && el.children.length > 0) {
        found = {
          tag: el.tagName,
          classes: el.className,
          childCount: el.children.length,
          innerText: el.textContent?.substring(0, 200),
        };
        break;
      }
    }
    return found;
  });
  console.log('Product container:', JSON.stringify(html, null, 2));

  // Count elements with "Chicken" text
  const chickenCount = await page.locator(':text("Chicken")').count();
  console.log('Elements with "Chicken":', chickenCount);

  // Get all text elements with product names
  const products = await page.locator(':text("Chicken Biryani"), :text("Chicken Karahi"), :text("Chicken Tikka Pizza"), :text("Zinger Burger")').all();
  console.log('Product elements found:', products.length);
  for (const p of products.slice(0, 3)) {
    console.log(' -', (await p.textContent())?.trim());
  }

  // Check the main content area
  const mainText = await page.locator('main').textContent();
  console.log('Main text length:', mainText?.length);
  console.log('Main contains Chicken Tikka Pizza:', mainText?.includes('Chicken Tikka Pizza'));

  await page.screenshot({ path: 'C:/midtown-pos/debug-page4.png' });
  await browser.close();
})();
