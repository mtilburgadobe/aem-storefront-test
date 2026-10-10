import { element, decorateProductRows, failBlock } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const rows = [...block.children];
    const heading = rows.shift()?.querySelector('h1');
    const controls = element('div', { class: 'shopify-filters' });
    const fields = element('div', { class: 'shopify-filter-fields' });
    const available = element('details');
    const availability = element('fieldset');
    availability.append(element('legend', { class: 'shopify-sr-only' }, 'Verfügbarkeit'));
    [['true', 'Auf Lager'], ['false', 'Nicht vorrätig']].forEach(([value, text]) => {
      const label = element('label');
      label.append(element('input', { type: 'checkbox', name: 'available', value }), text);
      availability.append(label);
    });
    available.append(element('summary', {}, 'Verfügbarkeit'), availability);
    const prices = element('details');
    const priceFields = element('fieldset');
    priceFields.append(
      element('legend', {}, 'Preis'),
      element('input', {
        type: 'number', name: 'min-price', min: '0', placeholder: 'Von', 'aria-label': 'Preis von',
      }),
      element('input', {
        type: 'number', name: 'max-price', min: '0', placeholder: 'Bis', 'aria-label': 'Preis bis',
      }),
    );
    prices.append(element('summary', {}, 'Preis'), priceFields);
    fields.append(available, prices);
    const sort = element('label', { class: 'shopify-sort' }, 'Sortieren');
    const select = element('select', { name: 'sort', 'aria-label': 'Sortieren' });
    [
      ['title', 'Alphabetisch, A–Z'], ['title-desc', 'Alphabetisch, Z–A'],
      ['price', 'Preis, niedrig nach hoch'], ['price-desc', 'Preis, hoch nach niedrig'],
    ].forEach(([value, text]) => select.append(element('option', { value }, text)));
    sort.append(select);
    controls.append(
      element('button', { type: 'button', class: 'shopify-mobile-filter', 'data-open': 'filters' }, 'Filtern'),
      fields,
      element('span', { class: 'shopify-result-count' }, `${rows.length} Artikel`),
      sort,
      element('button', {
        type: 'button', class: 'shopify-layout-toggle', 'data-columns': '4', 'aria-label': 'Rasteransicht',
      }, '▦'),
      element('button', {
        type: 'button', class: 'shopify-layout-toggle', 'data-columns': '6', 'aria-label': 'Kompakte Ansicht',
      }, '⠿'),
    );
    const grid = element('div', { class: 'shopify-grid collection-grid' });
    grid.append(...decorateProductRows(rows));
    block.replaceChildren(...[heading, controls, grid].filter(Boolean));
  } catch (error) { failBlock(block, error); }
}
