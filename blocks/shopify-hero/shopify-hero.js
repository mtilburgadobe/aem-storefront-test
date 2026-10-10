import { element, failBlock } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const media = block.children[0]?.querySelector('picture, img');
    const copy = block.children[1]?.children[0];
    if (!media || !copy) throw new Error('Hero benötigt Bild und Inhalt.');
    const content = element('div');
    const link = copy.querySelector('a');
    if (link?.parentElement.tagName === 'P') link.parentElement.replaceWith(link);
    content.append(...copy.childNodes);
    block.replaceChildren(media, content);
  } catch (error) { failBlock(block, error); }
}
