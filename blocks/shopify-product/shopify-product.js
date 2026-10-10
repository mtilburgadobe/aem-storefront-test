import {
  element, productHandle, quantityControl, priceParagraph, failBlock,
} from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const rows = [...block.children];
    const media = rows[0]?.querySelector('picture, img');
    const title = rows[1]?.querySelector('h1');
    const price = priceParagraph(rows[1]?.children[1]);
    const description = rows[2]?.children[0];
    const link = rows[3]?.querySelector('a');
    block.dataset.handle = productHandle(link);
    if (!media || !title || !price) throw new Error('Produkt benötigt Bild, Titel und Preis.');
    const image = element('button', {
      type: 'button', class: 'shopify-product-image', 'data-open': 'image', 'aria-label': 'Bild vergrößern',
    });
    image.append(media);
    price.classList.add('shopify-product-price');
    const form = element('form', { class: 'shopify-buy' });
    form.append(quantityControl(), element('button', {
      type: 'submit', class: 'shopify-add', disabled: '',
    }, 'Ausverkauft'));
    const body = element('div', { class: 'shopify-description' });
    if (description) body.append(...description.childNodes);
    const info = element('div', { class: 'shopify-product-info' });
    info.append(title, price, form, body);
    link.classList.add('shopify-sr-only');
    info.append(link);
    block.replaceChildren(image, info);
  } catch (error) { failBlock(block, error); }
}
