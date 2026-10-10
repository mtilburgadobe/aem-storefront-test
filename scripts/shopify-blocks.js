import config from './shopify-config.js';

export function element(tag, attributes, text) {
  const node = document.createElement(tag);
  Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function failBlock(block, error) {
  console.error('Shopify block:', error);
  block.dataset.shopifyError = 'true';
  block.append(element('p', { class: 'shopify-error', role: 'alert' }, error.message));
}

export function productHandle(link) {
  if (!link) throw new Error('Produktverknüpfung fehlt.');
  const url = new URL(link.href);
  const match = url.pathname.match(/^\/products\/([^/]+)\/?$/);
  if (!match) throw new Error('Ungültige Produktverknüpfung.');
  return decodeURIComponent(match[1]);
}

export function priceParagraph(cell) {
  const paragraph = [...(cell?.querySelectorAll(':scope > p') || [])]
    .find((node) => !node.querySelector('a'));
  if (paragraph) return paragraph;
  const price = element('p');
  price.append(...[...(cell?.childNodes || [])]
    .filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim();
      return node.nodeType === Node.ELEMENT_NODE
        && !node.matches('h1, h2, h3, h4, h5, h6, a') && !node.querySelector('a');
    }));
  if (!price.textContent.trim()) throw new Error('Produktpreis fehlt.');
  return price;
}

export function decorateProductRows(rows) {
  return rows.map((row) => {
    const media = row.children[0]?.querySelector('picture, img');
    const copy = row.children[1];
    const title = copy?.querySelector('h2, h3, h4');
    const price = priceParagraph(copy);
    const link = copy?.querySelector('a');
    if (!media || !title || !price) throw new Error('Produktzeile benötigt Bild, Titel und Preis.');
    const card = element('article', { class: 'shopify-card', 'data-handle': productHandle(link) });
    link.classList.add('shopify-card-link');
    link.setAttribute('aria-label', title.textContent);
    // The authored link remains an editable slot; its duplicate label is visually hidden.
    link.classList.add('shopify-card-overlay');
    const image = element('div', { class: 'shopify-card-image' });
    image.append(media, element('span', { class: 'shopify-badge' }, 'Ausverkauft'));
    title.classList.add('shopify-card-title');
    price.classList.add('shopify-card-price');
    card.append(link, image, title, price);
    return card;
  });
}

export function quantityControl() {
  const wrapper = element('div', { class: 'shopify-quantity' });
  wrapper.append(
    element('button', { type: 'button', 'data-quantity': '-1', 'aria-label': 'Menge verringern' }, '-'),
    element('input', {
      type: 'number', name: 'quantity', value: '1', min: '1', step: '1', 'aria-label': 'Menge',
    }),
    element('button', { type: 'button', 'data-quantity': '1', 'aria-label': 'Menge erhöhen' }, '+'),
  );
  return wrapper;
}

export function shopifyForm(type) {
  const form = element('form', {
    action: `https://${config.storeDomain}/contact#contact_form`, method: 'post',
  });
  form.append(element('input', { type: 'hidden', name: 'form_type', value: type }));
  return form;
}

export function icon(name, attributes) {
  const button = element('button', { type: 'button', ...attributes });
  button.append(element('img', {
    src: `${window.hlx.codeBasePath}/icons/shopify-${name}.svg`, alt: '', width: '20', height: '20',
  }));
  return button;
}

export const accountURL = `https://${config.storeDomain}/customer_authentication/redirect?locale=de&region_country=DE`;
