import { element, icon, accountURL } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  const rows = [...block.children];
  const announcementCell = rows[0]?.children[0];
  const announcement = element('div', { class: 'shopify-announcement' });
  if (announcementCell) announcement.append(...announcementCell.childNodes);
  const logo = rows[1]?.querySelector('a');
  if (logo) logo.classList.add('shopify-logo');
  const nav = element('nav', { class: 'shopify-navigation', 'aria-label': 'Hauptnavigation' });
  nav.append(...(rows[2]?.querySelectorAll('a') || []));
  const actions = element('div', { class: 'shopify-header-actions' });
  const account = element('a', { class: 'shopify-icon', href: accountURL, 'aria-label': 'Konto' });
  account.append(element('img', {
    src: `${window.hlx.codeBasePath}/icons/shopify-account.svg`, alt: '', width: '20', height: '20',
  }));
  const cart = icon('cart', { class: 'shopify-icon', 'data-open': 'cart', 'aria-label': 'Warenkorb 0' });
  cart.append(element('span', { class: 'shopify-cart-count', hidden: '' }));
  actions.append(
    element('button', {
      type: 'button', class: 'shopify-region', 'data-open': 'region', 'aria-label': 'EUR Region- und Sprachwahl',
    }, 'EUR ⌄'),
    icon('search', { class: 'shopify-icon shopify-search-toggle', 'data-open': 'search', 'aria-label': 'Suche' }),
    account,
    cart,
  );
  block.replaceChildren(
    icon('menu', { class: 'shopify-icon shopify-menu-toggle', 'data-open': 'menu', 'aria-label': 'Menü öffnen' }),
    ...[logo, nav, actions].filter(Boolean),
  );
  block.before(announcement);
}
