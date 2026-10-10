import {
  getMetadata, decorateSections, decorateBlocks, loadBlock, loadSection, loadSections,
  waitForFirstImage,
} from './aem.js';
import { element } from './shopify-blocks.js';

async function loadFragment(container, pathname, name) {
  if (!container || container.querySelector(`.${name}`)) return;
  const url = new URL(pathname, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('Shopify-Fragmente müssen auf derselben Website liegen.');
  const response = await fetch(`${url.pathname.replace(/\.html$/, '')}.plain.html`);
  if (!response.ok) throw new Error(`Shopify-Fragment ${url.pathname}: HTTP ${response.status}`);
  const fragment = new DOMParser().parseFromString(await response.text(), 'text/html');
  const block = fragment.querySelector(`.${name}`);
  if (!block) throw new Error(`Shopify-Fragment ${url.pathname} enthält keinen ${name}-Block.`);
  container.replaceChildren(block);
  block.classList.add('block');
  block.dataset.blockName = name;
  await loadBlock(block);
}

export default async function loadShopifyPage() {
  document.documentElement.lang = 'de';
  document.body.classList.add('shopify-storefront', 'appear');
  document.body.dataset.shopifyEds = 'true';
  let scroll = document.querySelector('.shopify-scroll');
  if (!scroll) {
    scroll = element('div', { class: 'shopify-scroll' });
    scroll.append(...document.querySelectorAll('body > header, body > main, body > footer'));
    document.body.prepend(scroll);
  }
  const main = document.querySelector('main');
  if (!main) throw new Error('Shopify-Seiteninhalt fehlt.');
  main.id = 'MainContent';
  main.classList.add('content-for-layout');
  if (!main.querySelector(':scope > .section')) {
    decorateSections(main);
    decorateBlocks(main);
  }
  const firstSection = main.querySelector('.section');
  await Promise.all([
    loadFragment(document.querySelector('header'), getMetadata('nav') || '/shopify-nav', 'shopify-header'),
    firstSection ? loadSection(firstSection, waitForFirstImage) : Promise.resolve(),
  ]);
  await Promise.all([
    loadSections(main),
    loadFragment(document.querySelector('footer'), getMetadata('footer') || '/shopify-footer', 'shopify-footer'),
  ]);
  const errors = document.querySelectorAll('[data-shopify-error]');
  if (errors.length) throw new Error('Mindestens ein Shopify-Block konnte nicht geladen werden.');
  const { default: initializeShopifyUI } = await import('./shopify-ui.js');
  await initializeShopifyUI();
}

if (new URL(window.location.href).searchParams.has('dapreview')) {
  // eslint-disable-next-line import/no-unresolved
  const { default: daPreview } = await import('https://da.live/scripts/dapreview.js');
  daPreview(loadShopifyPage);
}
