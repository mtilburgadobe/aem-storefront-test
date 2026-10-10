import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); });

[360, 1440].forEach((width) => {
  test(`Shopify search and empty cart at ${width}px`, async () => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: 'de-DE',
      storageState: {
        cookies: [],
        origins: [{
          origin: 'http://127.0.0.1:8793',
          localStorage: [{ name: 'shopify-replica-consent', value: 'Ablehnen' }],
        }],
      },
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:8793/');
      await page.locator('body[data-shopify-ready="true"]').waitFor();
      await page.getByRole('button', { name: 'Suche', exact: true }).click();
      const search = page.locator('dialog[data-kind="search"]');
      assert.equal(await search.locator('.shopify-card').count(), 4);
      if (width === 360) {
        const box = await search.boundingBox();
        assert.deepEqual([box.x, box.y, box.width, box.height], [0, 0, 360, 900]);
      }
      await search.getByRole('searchbox').fill('helmet');
      await search.locator('.shopify-card').nth(1).waitFor({ state: 'detached' });
      assert.equal(await search.locator('.shopify-card-title').innerText(), 'Road Bike Helmet');
      assert.equal(await search.getByRole('button', { name: 'Alle ansehen' }).isVisible(), true);
      await search.getByRole('button', { name: 'Löschen' }).click();
      await search.locator('.shopify-card').nth(3).waitFor();
      await page.keyboard.press('Escape');
      await search.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Warenkorb 0', exact: true }).click();
      const cart = page.locator('dialog[data-kind="cart"]');
      assert.equal(await cart.getByRole('heading', { name: 'Dein Warenkorb ist leer' }).isVisible(), true);
      assert.equal(await cart.getByRole('link', { name: 'Logge dich ein' }).isVisible(), true);
      const box = await cart.boundingBox();
      assert.deepEqual([box.x, box.y, box.width, box.height], width === 360
        ? [0, 0, 360, 900] : [960, 0, 480, 900]);
      const button = await cart.getByRole('link', { name: 'Weiter einkaufen' }).boundingBox();
      assert.equal(button.height, 46);
      await page.keyboard.press('Escape');
      await cart.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
});
