import { element, decorateProductRows, failBlock } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const rows = [...block.children];
    const heading = rows.shift()?.querySelector('h2, h3, h4');
    const grid = element('div', { class: 'shopify-grid' });
    grid.append(...decorateProductRows(rows));
    block.replaceChildren(...[heading, grid].filter(Boolean));
  } catch (error) { failBlock(block, error); }
}
