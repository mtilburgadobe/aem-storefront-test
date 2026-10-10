import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalCustomEvent = globalThis.CustomEvent;
let sequence = 0;

function environment(respond) {
  const storage = new Map();
  const calls = [];
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.document = new EventTarget();
  globalThis.CustomEvent = class extends Event {
    constructor(name, options) {
      super(name);
      this.detail = options.detail;
    }
  };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return respond(body, url, options);
  };
  return calls;
}

function response(data) {
  return { ok: true, json: async () => ({ data }) };
}

function cart(quantity = 1) {
  return {
    id: 'gid://shopify/Cart/test',
    totalQuantity: quantity,
    checkoutUrl: 'https://t8bnc1-5b.myshopify.com/cart/c/test',
    cost: { totalAmount: { amount: '89.99', currencyCode: 'EUR' } },
    lines: { nodes: [], pageInfo: { hasNextPage: false } },
  };
}

const api = () => {
  sequence += 1;
  return import(`../scripts/shopify-api.js?test=${sequence}`);
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
  globalThis.document = originalDocument;
  globalThis.CustomEvent = originalCustomEvent;
});

test('concurrent additions create one cart and append to that same cart', async () => {
  const calls = environment(async ({ query }) => {
    if (query.includes('cartCreate(')) {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
      return response({ cartCreate: { cart: cart(), userErrors: [], warnings: [] } });
    }
    if (query.includes('cartLinesAdd(')) {
      return response({ cartLinesAdd: { cart: cart(2), userErrors: [], warnings: [] } });
    }
    return response({ cart: cart() });
  });
  const { addToCart } = await api();
  await Promise.all([addToCart('variant-1', 1), addToCart('variant-2', 1)]);
  assert.equal(calls.filter(({ query }) => query.includes('cartCreate(')).length, 1);
  assert.equal(calls.filter(({ query }) => query.includes('cartLinesAdd(')).length, 1);
  assert.equal(calls.at(-1).variables.cartId, cart().id);
});

test('failed cart operations reject, and do not poison the next operation', async () => {
  let attempt = 0;
  environment(() => {
    attempt += 1;
    return response({
      cartCreate: {
        cart: attempt === 1 ? null : cart(),
        userErrors: attempt === 1 ? [{ message: 'Unavailable variant' }] : [],
        warnings: [],
      },
    });
  });
  const { addToCart } = await api();
  await assert.rejects(addToCart('variant-1', 1), /Unavailable variant/);
  assert.equal((await addToCart('variant-2', 1)).id, cart().id);
});

test('line update queued after cart creation uses the newly persisted cart', async () => {
  const calls = environment(async ({ query }) => {
    const field = query.includes('cartCreate(') ? 'cartCreate' : 'cartLinesUpdate';
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    return response({ [field]: { cart: cart(), userErrors: [], warnings: [] } });
  });
  const { addToCart, updateCartLine } = await api();
  const addition = addToCart('variant-1', 1);
  const update = updateCartLine('line-1', 2);
  await Promise.all([addition, update]);
  assert.equal(calls.at(-1).variables.cartId, cart().id);
});

test('invalid quantities are rejected without backend requests', async () => {
  const calls = environment(() => { throw new Error('Unexpected request'); });
  const { addToCart, updateCartLine } = await api();
  await Promise.all([0, -1, 1.5, NaN, Infinity].map(async (quantity) => {
    await assert.rejects(addToCart('variant', quantity), /gültige Menge/);
    assert.throws(() => updateCartLine('line', quantity), /gültige Menge/);
  }));
  assert.equal(calls.length, 0);
});

test('HTTP and GraphQL failures are surfaced', async () => {
  environment(() => ({ ok: false, status: 401 }));
  const { request } = await api();
  await assert.rejects(request('{}'), /HTTP 401/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ errors: [{ message: 'Denied' }] }) });
  await assert.rejects(request('{}'), /Denied/);
});

test('catalog pagination returns all products and rejects missing cursors', async () => {
  const product = (handle) => ({ handle, variants: { pageInfo: { hasNextPage: false } } });
  environment(({ variables }) => response({
    products: {
      nodes: [product(variables.after ? 'second' : 'first')],
      pageInfo: { hasNextPage: !variables.after, endCursor: variables.after ? null : 'cursor' },
    },
  }));
  const { getCatalog } = await api();
  assert.deepEqual((await getCatalog()).map(({ handle }) => handle), ['first', 'second']);
  globalThis.fetch = async () => response({
    products: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
  });
  await assert.rejects(getCatalog({ refresh: true }), /Paginierung/);
});

test('checkout accepts only HTTPS URLs on the configured Shopify host', async () => {
  const { checkoutURL } = await api();
  assert.equal(checkoutURL(cart()), cart().checkoutUrl);
  [
    'http://t8bnc1-5b.myshopify.com/checkout',
    'https://example.com/checkout',
    'https://t8bnc1-5b.myshopify.com.example.com/checkout',
  ].forEach((checkoutUrl) => {
    assert.throws(() => checkoutURL({ checkoutUrl }), /Checkout-Adresse/);
  });
});
