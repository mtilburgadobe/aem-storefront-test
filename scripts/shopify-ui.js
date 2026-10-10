import {
  getCatalog, getProduct, getCart, addToCart, updateCartLine, removeCartLine, money, checkoutURL,
  searchProducts,
} from './shopify-api.js';

function element(tag, attributes, text) {
  const node = document.createElement(tag);
  Object.entries(attributes || {}).forEach(([name, value]) => node.setAttribute(name, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(container, error) {
  console.error('Shopify storefront:', error);
  let message = container.querySelector('.shopify-error');
  if (!message) {
    message = element('p', { class: 'shopify-error', role: 'alert' });
    container.append(message);
  }
  message.textContent = error.message;
  message.hidden = false;
}

function productCard(product) {
  const article = element('article', { class: 'shopify-card', 'data-handle': product.handle });
  const href = `/products/${encodeURIComponent(product.handle)}`;
  const link = element('a', { class: 'shopify-card-link', href });
  link.append(element('span', { class: 'shopify-sr-only' }, product.title));
  const imageLink = element('div', { class: 'shopify-card-image' });
  if (product.featuredImage) {
    const image = new URL(product.featuredImage.url);
    image.searchParams.set('width', '832');
    imageLink.append(element('img', {
      src: image.href,
      alt: product.featuredImage.altText || product.title,
      width: product.featuredImage.width,
      height: product.featuredImage.height,
      loading: 'lazy',
    }));
  }
  const badge = element('span', { class: 'shopify-badge' }, 'Ausverkauft');
  badge.hidden = product.availableForSale;
  imageLink.append(badge);
  const title = element('h3', { class: 'shopify-card-title' }, product.title);
  article.append(
    link,
    imageLink,
    title,
    element('p', { class: 'shopify-card-price' }, money(product.priceRange.minVariantPrice)),
  );
  return article;
}

let products = [];
let activeDialog;

function closeDialog() {
  if (activeDialog?.open) activeDialog.close();
}

function openDialog(kind, title) {
  closeDialog();
  const dialog = element('dialog', { class: 'shopify-dialog', 'data-kind': kind, 'aria-label': title });
  const close = element('button', { class: 'shopify-dialog-close', 'aria-label': 'Schließen' }, '×');
  close.addEventListener('click', () => dialog.close());
  const heading = element('h2', {}, title);
  if (['search', 'cart', 'menu'].includes(kind)) heading.className = 'shopify-sr-only';
  dialog.append(close, heading);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  if (kind === 'cart') {
    dialog.show();
    close.focus();
  } else dialog.showModal();
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dialog.close();
  });
  activeDialog = dialog;
  return dialog;
}

function filterProducts(collection, controls = collection) {
  const availability = [...controls.querySelectorAll('input[name="available"]:checked')].map((input) => input.value === 'true');
  const min = controls.querySelector('[name="min-price"]')?.value;
  const max = controls.querySelector('[name="max-price"]')?.value;
  if ((min && Number(min) < 0) || (max && Number(max) < 0)
    || (min && max && Number(min) > Number(max))) {
    showError(controls, new Error('Bitte einen gültigen Preisbereich auswählen.'));
    return;
  }
  let list = products.filter((product) => {
    const amount = Number(product.priceRange.minVariantPrice.amount);
    return (!availability.length || availability.includes(product.availableForSale))
      && (!min || amount >= Number(min)) && (!max || amount <= Number(max));
  });
  const sort = controls.querySelector('[name="sort"]')?.value || collection.querySelector('[name="sort"]')?.value;
  if (sort?.startsWith('price')) list.sort((a, b) => Number(a.priceRange.minVariantPrice.amount) - Number(b.priceRange.minVariantPrice.amount));
  else list.sort((a, b) => a.title.localeCompare(b.title));
  if (sort?.endsWith('desc')) list = list.reverse();
  const grid = collection.querySelector('.shopify-grid');
  grid.replaceChildren(...list.map(productCard));
  if (!list.length) grid.append(element('p', {}, 'Keine Produkte gefunden.'));
  collection.querySelector('.shopify-result-count').textContent = `${list.length} Artikel`;
}

async function renderCart(container) {
  const cart = await getCart();
  const empty = container.querySelector('.shopify-cart-empty');
  const lines = container.querySelector('.shopify-cart-lines');
  if (!lines) return;
  empty.hidden = !!cart?.totalQuantity;
  lines.hidden = !cart?.totalQuantity;
  lines.replaceChildren();
  if (!cart?.totalQuantity) return;
  cart.lines.nodes.forEach((line) => {
    const row = element('article', { class: 'shopify-cart-line' });
    const { product } = line.merchandise;
    if (product.featuredImage) row.append(element('img', { src: product.featuredImage.url, alt: product.title }));
    row.append(element('a', { href: `/products/${product.handle}` }, product.title));
    const input = element('input', {
      type: 'number', min: '1', step: '1', value: line.quantity, 'aria-label': `Menge für ${product.title}`,
    });
    input.addEventListener('change', async () => {
      input.disabled = true;
      try {
        await updateCartLine(line.id, Number(input.value));
        await renderCart(container);
      } catch (error) {
        input.value = line.quantity;
        showError(container, error);
      } finally {
        input.disabled = false;
      }
    });
    const remove = element('button', { type: 'button' }, 'Entfernen');
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await removeCartLine(line.id);
        await renderCart(container);
      } catch (error) {
        showError(container, error);
        remove.disabled = false;
      }
    });
    row.append(input, element('span', {}, money(line.cost.totalAmount)), remove);
    lines.append(row);
  });
  lines.append(
    element('p', {}, `Gesamtsumme: ${money(cart.cost.totalAmount)}`),
    element('a', { class: 'shopify-button', href: checkoutURL(cart) }, 'Zur Kasse'),
  );
}

async function cartDialog() {
  const dialog = openDialog('cart', 'Warenkorb');
  const empty = element('div', { class: 'shopify-cart-empty' });
  empty.append(
    element('h2', {}, 'Dein Warenkorb ist leer'),
    element('p'),
    element('a', { class: 'shopify-button', href: '/collections/all' }, 'Weiter einkaufen'),
  );
  const login = element('a', {
    href: 'https://t8bnc1-5b.myshopify.com/customer_authentication/redirect?locale=de&region_country=DE',
  }, 'Logge dich ein');
  empty.querySelector('p').append('Hast du ein Konto? ', login, ', damit es beim Checkout schneller geht.');
  dialog.classList.add('shopify-cart');
  dialog.append(empty, element('div', { class: 'shopify-cart-lines', hidden: '' }));
  try {
    await renderCart(dialog);
  } catch (error) {
    showError(dialog, error);
  }
}

function searchDialog() {
  const dialog = openDialog('search', 'Suche');
  const form = element('form', { action: '/search', role: 'search' });
  const header = element('div', { class: 'shopify-search-header' });
  const input = element('input', {
    type: 'search', name: 'q', placeholder: 'Suchen', 'aria-label': 'Suchen', autocomplete: 'off',
  });
  const submit = element('button', { type: 'submit', class: 'shopify-search-submit', 'aria-label': 'Suchen' });
  submit.append(element('img', {
    src: '/icons/shopify-search.svg', alt: '', width: '20', height: '20',
  }));
  const clear = element('button', { type: 'button', class: 'shopify-search-clear', hidden: '' }, 'Löschen');
  const content = element('div', { class: 'shopify-search-results' });
  const results = element('div', { class: 'shopify-grid', 'aria-live': 'polite' });
  const count = element('p', { class: 'shopify-sr-only', 'aria-live': 'polite' });
  const viewAll = element('button', { type: 'submit', class: 'shopify-button shopify-search-view-all', hidden: '' }, 'Alle ansehen');
  let timer;
  let revision = 0;
  const update = async () => {
    const current = revision;
    const query = input.value.trim();
    results.setAttribute('aria-busy', 'true');
    try {
      const matches = query ? await searchProducts(query, { predictive: true }) : products;
      if (current !== revision || !dialog.open) return;
      results.replaceChildren(...matches.map(productCard));
      clear.hidden = !query;
      viewAll.hidden = !query;
      count.textContent = query ? `${matches.length} Suchergebnisse für „${query}“ gefunden` : '';
      if (query && !matches.length) results.append(element('p', {}, 'Keine Produkte gefunden.'));
    } catch (error) {
      if (current === revision && dialog.open) showError(dialog, error);
    } finally {
      if (current === revision) results.removeAttribute('aria-busy');
    }
  };
  input.addEventListener('input', () => {
    revision += 1;
    window.clearTimeout(timer);
    timer = window.setTimeout(update, 250);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    revision += 1;
    window.clearTimeout(timer);
    update();
    input.focus();
  });
  dialog.addEventListener('close', () => {
    revision += 1;
    window.clearTimeout(timer);
  }, { once: true });
  header.append(submit, input, clear, dialog.querySelector('.shopify-dialog-close'));
  content.append(count, element('h4', {}, 'Produkte'), results);
  form.append(header, content, viewAll);
  dialog.append(form);
  update();
  input.focus();
}

function openFeature(kind, trigger) {
  if (kind === 'cart') return cartDialog();
  if (kind === 'search') return searchDialog();
  if (kind === 'menu') {
    const dialog = openDialog(kind, 'Menü');
    dialog.append(document.querySelector('.shopify-navigation').cloneNode(true));
    const bottom = element('div', { class: 'shopify-menu-bottom' });
    bottom.append(element('button', { class: 'shopify-menu-region', 'data-open': 'region' }, 'EUR ›'));
    const shelf = element('div', { class: 'shopify-grid shopify-menu-products' });
    shelf.append(...products.map(productCard));
    bottom.append(shelf);
    dialog.append(bottom);
  } else if (kind === 'image') {
    const dialog = openDialog(kind, 'Bild vergrößern');
    dialog.append(trigger.querySelector('img').cloneNode(true));
  } else if (kind === 'policies') {
    const dialog = openDialog(kind, 'Geschäftsbedingungen und Richtlinien');
    const nav = element('nav');
    nav.append(element('a', { href: '/policies/privacy-policy' }, 'Datenschutzerklärung'));
    const consent = element('button', {}, 'Cookie-Einstellungen');
    consent.addEventListener('click', () => { closeDialog(); showConsent(true); });
    nav.append(consent);
    dialog.append(nav);
  } else if (kind === 'region') {
    const dialog = openDialog(kind, 'Region- und Sprachwahl');
    dialog.append(element('p', {}, 'Deutschland | EUR €'), element('p', {}, 'Deutsch'));
  } else if (kind === 'filters') {
    const dialog = openDialog(kind, 'Filtern');
    const collection = document.querySelector('.shopify-collection');
    const controls = collection.querySelector('.shopify-filter-fields').cloneNode(true);
    controls.querySelectorAll('details').forEach((details) => { details.open = true; });
    controls.addEventListener('change', () => filterProducts(collection, controls));
    dialog.append(controls);
  }
  return undefined;
}

function showConsent(force = false) {
  let saved;
  try {
    saved = localStorage.getItem('shopify-replica-consent');
  } catch (error) {
    console.warn('Cookie-Einstellungen können nicht gespeichert werden.', error);
  }
  if (saved && !force) return;
  document.querySelector('.shopify-consent')?.remove();
  const banner = element('section', { class: 'shopify-consent', 'aria-label': 'Cookie-Zustimmung' });
  banner.append(
    element('h2', {}, 'Cookie-Zustimmung'),
    element('p', {}, 'Wir und unsere Partner, einschließlich Shopify, verwenden Cookies und weitere Technologien, um dein Erlebnis individuell an dich anzupassen, dir Werbung zu zeigen und Analysen durchzuführen. Wir nutzen Cookies und andere Technologien für diese Zwecke nur mit deiner Zustimmung.'),
    element('a', { href: '/policies/privacy-policy' }, 'Mehr Informationen findest du in unserer Datenschutzerklärung'),
  );
  ['Einstellungen verwalten', 'Akzeptieren', 'Ablehnen'].forEach((label) => {
    const button = element('button', {}, label);
    button.addEventListener('click', () => {
      if (label === 'Einstellungen verwalten') {
        banner.querySelector('p').textContent = 'Notwendige Funktionen sind aktiv. Optionale Analyse- und Werbetechnologien werden auf diesem AEM-Storefront nicht geladen.';
        return;
      }
      try {
        localStorage.setItem('shopify-replica-consent', label);
      } catch (error) {
        console.warn('Cookie-Einstellungen können nicht gespeichert werden.', error);
      }
      banner.remove();
    });
    banner.append(button);
  });
  document.body.append(banner);
}

async function hydrateProduct(section) {
  const product = await getProduct(section.dataset.handle);
  const form = section.querySelector('.shopify-buy');
  const button = form.querySelector('.shopify-add');
  const variants = product.variants.nodes;
  let selected = variants.find((variant) => variant.availableForSale) || variants[0];
  if (!selected) throw new Error('Keine Produktvariante verfügbar.');
  if (variants.length > 1) {
    const select = element('select', { 'aria-label': 'Variante' });
    variants.forEach((variant) => select.append(element('option', { value: variant.id }, variant.title)));
    select.value = selected.id;
    select.addEventListener('change', () => {
      selected = variants.find((variant) => variant.id === select.value);
      update();
    });
    form.before(select);
  }
  function update() {
    section.querySelector('h1').textContent = product.title;
    section.querySelector('.shopify-product-price').textContent = money(selected.price);
    button.disabled = !selected.availableForSale;
    button.textContent = selected.availableForSale ? 'In den Warenkorb' : 'Ausverkauft';
  }
  update();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selected.availableForSale) return;
    button.disabled = true;
    try {
      await addToCart(selected.id, Number(form.elements.quantity.value));
      await cartDialog();
    } catch (error) {
      showError(section, error);
    } finally {
      update();
    }
  });
}

export default async function initializeShopifyUI() {
  if (document.body.dataset.shopifyInitialized) return;
  document.body.dataset.shopifyInitialized = 'true';
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open]');
    if (trigger) openFeature(trigger.dataset.open, trigger);
    const step = event.target.closest('[data-quantity]');
    if (step) {
      const input = step.parentElement.querySelector('input');
      input.value = Math.max(1, Number(input.value) + Number(step.dataset.quantity));
    }
    const layout = event.target.closest('[data-columns]');
    if (layout) {
      const grid = document.querySelector('.collection-grid');
      const alternate = layout.dataset.columns === '6';
      let columns = alternate ? 11 : 5;
      const desktop = window.innerWidth >= 750;
      if (!desktop) columns = alternate ? 2 : 1;
      grid.dataset.layout = desktop && alternate ? 'compact' : 'default';
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    }
  });
  document.addEventListener('shopify:cart', (event) => {
    const count = event.detail?.totalQuantity || 0;
    document.querySelectorAll('.shopify-cart-count').forEach((badge) => {
      badge.textContent = count;
      badge.hidden = !count;
      badge.parentElement.setAttribute('aria-label', `Warenkorb ${count}`);
    });
  });
  showConsent();
  try {
    products = await getCatalog();
    document.querySelectorAll('.shopify-card').forEach((card) => {
      const product = products.find((item) => item.handle === card.dataset.handle);
      if (!product) {
        card.remove();
        return;
      }
      card.querySelector('.shopify-card-price').textContent = money(product.priceRange.minVariantPrice);
      card.querySelector('.shopify-badge').hidden = product.availableForSale;
    });
    const collection = document.querySelector('.shopify-collection');
    if (collection) {
      collection.addEventListener('change', () => filterProducts(collection));
      filterProducts(collection);
    }
    const search = document.querySelector('.shopify-search-page');
    if (search) {
      const query = new URLSearchParams(window.location.search).get('q') || '';
      search.querySelector('input').value = query;
      const found = query.trim() ? await searchProducts(query) : products;
      search.querySelector('.shopify-grid').replaceChildren(...found.map(productCard));
      if (!found.length) search.append(element('p', {}, 'Keine Produkte gefunden.'));
    }
    await Promise.all([...document.querySelectorAll('.shopify-product')].map(hydrateProduct));
    const cart = document.querySelector('main .shopify-cart');
    if (cart) await renderCart(cart);
    else await getCart();
    document.body.dataset.shopifyReady = 'true';
  } catch (error) {
    showError(document.querySelector('main'), error);
    document.body.dataset.shopifyReady = 'error';
  }
}

if (document.body.classList.contains('shopify-storefront')) initializeShopifyUI();
