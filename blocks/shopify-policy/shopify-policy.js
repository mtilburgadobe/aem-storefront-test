import { element } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  const title = block.children[0]?.querySelector('h1');
  const content = block.children[1]?.children[0];
  const body = element('div', { class: 'shopify-policy-body' });
  if (content) body.append(...content.childNodes);
  block.replaceChildren(...[title, body].filter(Boolean));
}
