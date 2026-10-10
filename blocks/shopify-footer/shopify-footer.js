import { element, shopifyForm } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  const rows = [...block.children];
  const copy = rows[0]?.children[0];
  const newsletter = element('div', { class: 'shopify-newsletter' });
  const text = element('div');
  if (copy) text.append(...copy.childNodes);
  const form = shopifyForm('customer');
  form.append(
    element('input', { type: 'hidden', name: 'contact[tags]', value: 'newsletter' }),
    element('label', { class: 'shopify-sr-only', for: 'newsletter-email' }, 'E-Mail'),
    element('input', {
      id: 'newsletter-email', type: 'email', name: 'contact[email]', required: '', placeholder: 'E-Mail-Adresse',
    }),
    element('button', { type: 'submit', 'aria-label': 'Anmelden' }, '→'),
  );
  newsletter.append(text, form);
  const utilities = element('div', { class: 'shopify-utilities' });
  const copyrightCell = rows[1]?.children[0];
  const copyright = copyrightCell?.querySelector('p') || element('p');
  if (copyrightCell && !copyright.parentElement) copyright.append(...copyrightCell.childNodes);
  const policy = rows[2]?.querySelector('a');
  if (copyright) utilities.append(copyright);
  if (policy) utilities.append(policy);
  block.replaceChildren(newsletter, utilities);
}
