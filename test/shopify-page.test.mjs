import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.SHOPIFY_TEST_ORIGIN || 'http://localhost:3000';
const contentOrigin = 'https://main--aem-storefront-test--mtilburgadobe.aem.page';
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); });

async function context(width) {
  const session = await browser.newContext({
    viewport: { width, height: 900 },
    locale: 'de-DE',
    storageState: {
      cookies: [],
      origins: [{
        origin,
        localStorage: [{ name: 'shopify-replica-consent', value: 'Ablehnen' }],
      }],
    },
  });
  if (origin === 'http://localhost:3000') {
    await session.route(`${origin}/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const fragment = ['/shopify-nav.plain.html', '/shopify-footer.plain.html'].includes(url.pathname);
      if (!request.isNavigationRequest() && !fragment) return route.continue();
      const response = await session.request.get(`${contentOrigin}${url.pathname}${url.search}`);
      assert.equal(response.status(), 200, `Preview content ${url.pathname}`);
      let body = await response.text();
      if (!fragment) {
        body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
          .replace(/<link\b[^>]*(?:stylesheet|modulepreload)[^>]*>/g, '')
          .replace('</head>', '<script type="module" src="/scripts/storefront.js"></script></head>');
      }
      return route.fulfill({ contentType: 'text/html', body });
    });
  }
  return session;
}

[360, 900, 1440].forEach((width) => {
  test(`Shopify AEM startup at ${width}px avoids Adobe Commerce`, async () => {
    const session = await context(width);
    try {
      const page = await session.newPage();
      const requests = [];
      const errors = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(`${origin}/`);
      await page.locator('body[data-shopify-ready="true"]').waitFor();
      assert.equal(await page.locator('main .shopify-card').count(), 4);
      assert.match(await page.locator('footer').innerText(), /Powered by Shopify/);
      const announcement = await page.locator('.shopify-announcement').boundingBox();
      assert.equal(announcement.height, 43);
      assert.deepEqual(requests.filter((url) => /\/commerce\.js|\/initializers\/|\/__dropins__\//.test(url)), []);
      assert.deepEqual(errors, []);
      if (process.env.SHOPIFY_TEST_ARTIFACTS) {
        await page.screenshot({
          path: `${process.env.SHOPIFY_TEST_ARTIFACTS}/shopify-aem-${width}.png`,
          fullPage: true,
        });
      }
      await page.getByRole('button', { name: 'Suche', exact: true }).click();
      const search = page.locator('dialog[data-kind="search"]');
      assert.equal(await search.locator('.shopify-card').count(), 4);
      await search.getByRole('searchbox').fill('helmet');
      await search.locator('.shopify-card').nth(1).waitFor({ state: 'detached' });
      assert.equal(await search.locator('.shopify-card-title').innerText(), 'Road Bike Helmet');
      await page.keyboard.press('Escape');
      await search.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Warenkorb 0', exact: true }).click();
      assert.equal(await page.getByRole('heading', { name: 'Dein Warenkorb ist leer' }).isVisible(), true);
      await page.keyboard.press('Escape');
    } finally { await session.close(); }
  });
});

test('Shopify authored routes load without configuration errors', async () => {
  const session = await context(1440);
  try {
    const page = await session.newPage();
    const paths = [
      '/collections/all', '/products/road-bike-helmet', '/products/road-running-shoes',
      '/products/running-shorts', '/products/trail-running-shoes', '/pages/contact',
      '/cart', '/search', '/policies/privacy-policy',
    ];
    await paths.reduce(async (previous, pathname) => {
      await previous;
      await page.goto(`${origin}${pathname}`);
      await page.locator('body[data-shopify-ready="true"]').waitFor();
      assert.equal(await page.locator('[data-shopify-error]').count(), 0, pathname);
      assert.doesNotMatch(await page.locator('body').innerText(), /Configuration Error|startup failed/);
      if (pathname.startsWith('/products/')) {
        const purchasable = await page.evaluate(async () => {
          const { getProduct } = await import('/scripts/shopify-api.js'); // eslint-disable-line import/no-unresolved, import/no-absolute-path
          const product = await getProduct(document.querySelector('.shopify-product').dataset.handle);
          return product.variants.nodes.some((variant) => variant.availableForSale);
        });
        assert.equal(await page.locator('.shopify-add').isDisabled(), !purchasable, pathname);
        assert.match(await page.locator('.shopify-product-price').innerText(), /^€\d/);
      }
    }, Promise.resolve());
  } finally { await session.close(); }
});

test('Collection filtering restores the original authored card nodes', async () => {
  const session = await context(1440);
  try {
    const page = await session.newPage();
    await page.goto(`${origin}/collections/all`);
    await page.locator('body[data-shopify-ready="true"]').waitFor();
    await page.evaluate(() => {
      window.originalCards = [...document.querySelectorAll('.collection-grid .shopify-card')];
    });
    const min = page.getByRole('spinbutton', { name: 'Preis von', exact: true });
    await page.locator('.shopify-filter-fields details').nth(1).locator('summary').click();
    await min.fill('10000');
    await min.press('Tab');
    assert.equal(await page.locator('.collection-grid .shopify-card').count(), 0);
    await min.fill('');
    await min.press('Tab');
    assert.equal(await page.evaluate(() => window.originalCards.every((card) => (
      document.querySelector('.collection-grid').contains(card)
    ))), true);
  } finally { await session.close(); }
});

test('New DA product content hydrates and sold-out variants stay disabled', async () => {
  const session = await context(360);
  try {
    const page = await session.newPage();
    await page.route('**/api/*/graphql.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (data.data?.product) {
        data.data.product.variants.nodes.forEach((variant) => {
          variant.availableForSale = false;
        });
      }
      await route.fulfill({ response, json: data });
    });
    await page.goto(`${origin}/products/road-bike-helmet`);
    await page.locator('body[data-shopify-ready="true"]').waitFor();
    assert.equal(await page.locator('.shopify-add').isDisabled(), true);
    const response = await session.request.get(`${contentOrigin}/products/road-bike-helmet`);
    assert.equal(response.status(), 200);
    const rebound = await page.evaluate(async (html) => {
      const { default: loadPage } = await import('/scripts/shopify-page.js'); // eslint-disable-line import/no-unresolved, import/no-absolute-path
      const documentCopy = new DOMParser().parseFromString(html, 'text/html');
      document.body.className = 'da-preview';
      document.body.innerHTML = documentCopy.body.innerHTML;
      await loadPage();
      await loadPage();
      return document.querySelector('.shopify-product').dataset.shopifyHydrated === 'true';
    }, await response.text());
    assert.equal(rebound, true);
    assert.equal(await page.locator('.shopify-add').isDisabled(), true);
    await page.getByRole('button', { name: 'Menge erhöhen' }).click();
    assert.equal(await page.getByRole('spinbutton', { name: 'Menge', exact: true }).inputValue(), '2');
    assert.equal(await page.locator('.shopify-announcement').count(), 1);
  } finally { await session.close(); }
});

test('Decoration retains authored heading, price text, image and link nodes', async () => {
  const session = await context(360);
  try {
    const page = await session.newPage();
    await page.goto(`${origin}/`);
    await page.locator('body[data-shopify-ready="true"]').waitFor();
    const retained = await page.evaluate(async () => {
      // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
      const { default: decorate } = await import('/blocks/shopify-shelf/shopify-shelf.js');
      const block = document.createElement('div');
      block.innerHTML = '<div><div><h3>Produkte</h3></div></div><div><div><img alt="Test"></div><div><h3>Test</h3>€1,00<a href="/products/test">Test</a></div></div>';
      const title = block.querySelectorAll('h3')[1];
      const image = block.querySelector('img');
      const link = block.querySelector('a');
      const price = title.nextSibling;
      decorate(block);
      return [title, image, link, price].every((node) => block.contains(node));
    });
    assert.equal(retained, true);
  } finally { await session.close(); }
});

test('Non-Shopify metadata still selects the original Adobe Commerce entry point', async () => {
  const session = await context(1440);
  try {
    const page = await session.newPage();
    await page.route('**/scripts/__dropins__/**', (route) => route.fulfill({
      contentType: 'application/javascript', body: '',
    }));
    await page.route('**/scripts/initializers/**', (route) => route.fulfill({
      contentType: 'application/javascript', body: '',
    }));
    await page.route('**/scripts/scripts.js', (route) => route.fulfill({
      contentType: 'application/javascript', body: 'window.originalCommerceEntryLoaded = true;',
    }));
    await page.route(`${origin}/routing-fixture`, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<html><head><script type="module" src="/scripts/storefront.js"></script></head><body><main>Existing commerce content</main></body></html>',
    }));
    await page.goto(`${origin}/routing-fixture`);
    await page.waitForFunction(() => window.originalCommerceEntryLoaded === true);
    assert.equal(await page.locator('body.shopify-storefront').count(), 0);
    assert.equal(await page.locator('link[href$="/styles/styles.css"]').count(), 1);
  } finally { await session.close(); }
});
