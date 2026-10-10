import { element } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  const content = block.children[0]?.children[0];
  const empty = element('div', { class: 'shopify-cart-empty' });
  if (content) empty.append(...content.childNodes);
  const link = empty.querySelector('a[href="/collections/all"]');
  if (link) {
    link.classList.add('shopify-button');
    if (link.parentElement.tagName === 'P') link.parentElement.replaceWith(link);
  }
  block.replaceChildren(empty, element('div', { class: 'shopify-cart-lines', hidden: '' }));
}
