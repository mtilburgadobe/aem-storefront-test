import { getMetadata, loadCSS } from './aem.js';

const provider = getMetadata('commerce-provider').trim().toLowerCase();

try {
  if (provider === 'shopify') {
    await loadCSS(`${window.hlx.codeBasePath}/styles/shopify.css`);
    const { default: loadShopifyPage } = await import('./shopify-page.js');
    await loadShopifyPage();
  } else {
    await loadCSS(`${window.hlx.codeBasePath}/styles/styles.css`);
    if (!HTMLScriptElement.supports?.('importmap')) {
      await import('./__dropins__/tools/shims/importmap.js');
    }
    [
      'tools/lib/aem/configs.js',
      '../initializers/index.js',
      '../initializers/auth.js',
      '../initializers/personalization.js',
      'storefront-auth/api.js',
      'tools/event-bus.js',
      'tools/fetch-graphql.js',
      'tools/initializer.js',
      'tools/preact.js',
      'tools/preact-compat.js',
      'tools/preact-hooks.js',
      'tools/components.js',
    ].forEach((file) => {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = `${window.hlx.codeBasePath}/scripts/__dropins__/${file}`;
      document.head.append(link);
    });
    await import('./scripts.js');
  }
} catch (error) {
  console.error('Storefront startup failed:', error);
  document.body.dataset.shopifyReady = 'error';
  document.body.classList.add('appear');
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = `Storefront startup failed: ${error.message}`;
  document.querySelector('main')?.prepend(message);
}
