import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const mode = process.argv.includes('--eds') ? 'drafts' : 'prototypes';
const port = Number(process.env.PORT || 8793);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    let file;
    if (/^\/(scripts|styles|fonts|icons)\//.test(pathname)) file = path.resolve(root, `.${pathname}`);
    else if (/^\/stardust\/prototypes\/[^/]+\.(html|css)$/.test(pathname)) file = path.resolve(root, `.${pathname}`);
    else if (mode === 'drafts') file = path.resolve(root, `drafts${pathname === '/' ? '/index' : pathname.replace(/\.html$/, '')}.html`);
    else {
      const slug = pathname === '/' ? 'index' : pathname.slice(1).replaceAll('/', '-').replace(/\.html$/, '');
      file = path.resolve(root, `stardust/prototypes/${slug}-proposed.html`);
    }
    if (!file.startsWith(`${root}${path.sep}`) || file.split(path.sep).some((part) => part.startsWith('.')) || !types[path.extname(file)]) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error.code === 'ENOENT') response.writeHead(404).end('Not found');
    else {
      console.error(error);
      response.writeHead(500).end('Preview failed');
    }
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Shopify ${mode} preview: http://127.0.0.1:${port}`));
