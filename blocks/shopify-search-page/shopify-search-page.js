import {
  element, icon, decorateProductRows, failBlock,
} from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const rows = [...block.children];
    const heading = rows.shift()?.querySelector('h1, h3');
    const form = element('form', { action: '/search', role: 'search' });
    form.append(
      element('input', {
        type: 'search', name: 'q', placeholder: 'Suchen', 'aria-label': 'Suchen',
      }),
      icon('search', { type: 'submit', 'aria-label': 'Suchen' }),
    );
    const grid = element('div', { class: 'shopify-grid' });
    grid.append(...decorateProductRows(rows));
    block.replaceChildren(...[heading, form, element('h4', {}, 'Produkte'), grid].filter(Boolean));
  } catch (error) { failBlock(block, error); }
}
