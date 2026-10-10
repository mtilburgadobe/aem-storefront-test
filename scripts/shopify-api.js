import config from './shopify-config.js';

const endpoint = `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;
const context = '@inContext(country: DE, language: DE)';
const productFields = `
  id handle title availableForSale descriptionHtml
  featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 100) {
    nodes { id title availableForSale selectedOptions { name value } price { amount currencyCode } }
    pageInfo { hasNextPage }
  }
`;
const cartFields = `
  id totalQuantity checkoutUrl
  cost { totalAmount { amount currencyCode } }
  lines(first: 100) {
    nodes {
      id quantity cost { totalAmount { amount currencyCode } }
      merchandise { ... on ProductVariant {
        id title availableForSale price { amount currencyCode }
        product { title handle featuredImage { url altText } }
      } }
    }
    pageInfo { hasNextPage }
  }
`;
let catalogPromise;
let cartId;
let cartQueue = Promise.resolve();
const storageKey = `shopify-cart:${config.storeDomain}`;

export async function request(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.publicToken,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Shopify-Anfrage fehlgeschlagen (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '));
  if (!result.data) throw new Error('Shopify hat keine Daten zurückgegeben.');
  return result.data;
}

export function money(value) {
  return `€${Number(value.amount).toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export function getCatalog({ refresh = false } = {}) {
  if (refresh) catalogPromise = undefined;
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const products = [];
      let after = null;
      let hasNextPage = true;
      while (hasNextPage) {
        // eslint-disable-next-line no-await-in-loop
        const data = await request(`query($after: String) ${context} {
          products(first: 50, after: $after, sortKey: TITLE) {
            nodes { ${productFields} }
            pageInfo { hasNextPage endCursor }
          }
        }`, { after });
        products.push(...data.products.nodes);
        ({ hasNextPage } = data.products.pageInfo);
        after = data.products.pageInfo.endCursor;
        if (hasNextPage && !after) throw new Error('Ungültige Shopify-Katalog-Paginierung.');
      }
      if (products.some((product) => product.variants.pageInfo.hasNextPage)) {
        throw new Error('Dieser Katalog enthält Produkte mit mehr als 100 Varianten.');
      }
      return products;
    })().catch((error) => {
      catalogPromise = undefined;
      throw error;
    });
  }
  return catalogPromise;
}

export async function getProduct(handle) {
  const data = await request(`query($handle: String!) ${context} {
    product(handle: $handle) { ${productFields} }
  }`, { handle });
  if (!data.product) throw new Error('Produkt nicht gefunden.');
  if (data.product.variants.pageInfo.hasNextPage) throw new Error('Mehr als 100 Produktvarianten werden nicht unterstützt.');
  return data.product;
}

export async function searchProducts(query, { predictive = false } = {}) {
  if (!query.trim()) return [];
  if (predictive) {
    const data = await request(`query($query: String!) ${context} {
      predictiveSearch(query: $query, limit: 4, types: [PRODUCT]) {
        products { ${productFields} }
      }
    }`, { query });
    return data.predictiveSearch?.products || [];
  }
  const products = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    // eslint-disable-next-line no-await-in-loop
    const data = await request(`query($query: String!, $after: String) ${context} {
      search(query: $query, first: 50, after: $after, types: [PRODUCT], sortKey: RELEVANCE) {
        nodes { ... on Product { ${productFields} } }
        pageInfo { hasNextPage endCursor }
      }
    }`, { query, after });
    products.push(...data.search.nodes);
    ({ hasNextPage } = data.search.pageInfo);
    after = data.search.pageInfo.endCursor;
    if (hasNextPage && !after) throw new Error('Ungültige Shopify-Such-Paginierung.');
  }
  return products;
}

export async function getRecommendations(productId) {
  const data = await request(`query($id: ID!) ${context} {
    productRecommendations(productId: $id) { ${productFields} }
  }`, { id: productId });
  return data.productRecommendations || [];
}

function readCartId() {
  if (cartId) return cartId;
  try {
    cartId = localStorage.getItem(storageKey);
  } catch (error) {
    console.warn('Shopify-Warenkorb kann nicht dauerhaft gespeichert werden.', error);
  }
  return cartId;
}

function rememberCart(cart) {
  if (cart?.lines.pageInfo.hasNextPage) throw new Error('Mehr als 100 Warenkorbpositionen werden nicht unterstützt.');
  cartId = cart?.id || null;
  try {
    if (cartId) localStorage.setItem(storageKey, cartId);
    else localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Shopify-Warenkorb kann nicht dauerhaft gespeichert werden.', error);
  }
  document.dispatchEvent(new CustomEvent('shopify:cart', { detail: cart }));
  return cart;
}

export async function getCart() {
  const id = readCartId();
  if (!id) return null;
  const data = await request(`query($id: ID!) ${context} { cart(id: $id) { ${cartFields} } }`, { id });
  return rememberCart(data.cart);
}

function enqueueCart(callback) {
  const operation = cartQueue.then(callback);
  cartQueue = operation.catch(() => {});
  return operation;
}

async function mutate(query, variables, field) {
  const data = await request(query, variables);
  const result = data[field];
  if (result.userErrors.length) throw new Error(result.userErrors.map((error) => error.message).join('; '));
  if (result.warnings?.length) console.warn('Shopify-Warenkorbwarnungen:', result.warnings);
  if (!result.cart) throw new Error('Shopify hat keinen Warenkorb zurückgegeben.');
  return rememberCart(result.cart);
}

export async function addToCart(merchandiseId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Bitte eine gültige Menge auswählen.');
  return enqueueCart(async () => {
    const cart = await getCart();
    const lines = [{ merchandiseId, quantity }];
    if (!cart) {
      return mutate(`mutation($input: CartInput!) ${context} {
        cartCreate(input: $input) { cart { ${cartFields} } userErrors { message } warnings { message } }
      }`, { input: { lines, buyerIdentity: { countryCode: config.country } } }, 'cartCreate');
    }
    return mutate(`mutation($cartId: ID!, $lines: [CartLineInput!]!) ${context} {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${cartFields} } userErrors { message } warnings { message }
      }
    }`, { cartId: cart.id, lines }, 'cartLinesAdd');
  });
}

export function updateCartLine(id, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Bitte eine gültige Menge auswählen.');
  return enqueueCart(() => {
    if (!readCartId()) throw new Error('Warenkorb nicht gefunden.');
    return mutate(`mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) ${context} {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${cartFields} } userErrors { message } warnings { message }
      }
    }`, { cartId, lines: [{ id, quantity }] }, 'cartLinesUpdate');
  });
}

export function removeCartLine(id) {
  return enqueueCart(() => {
    if (!readCartId()) throw new Error('Warenkorb nicht gefunden.');
    return mutate(`mutation($cartId: ID!, $lineIds: [ID!]!) ${context} {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${cartFields} } userErrors { message } warnings { message }
      }
    }`, { cartId, lineIds: [id] }, 'cartLinesRemove');
  });
}

export function checkoutURL(cart) {
  const url = new URL(cart.checkoutUrl);
  if (url.protocol !== 'https:' || url.hostname !== config.storeDomain) {
    throw new Error('Ungültige Shopify-Checkout-Adresse.');
  }
  return url.href;
}
