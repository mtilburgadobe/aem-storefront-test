import { element, shopifyForm, failBlock } from '../../scripts/shopify-blocks.js';

export default function decorate(block) {
  try {
    const rows = [...block.children];
    const heading = rows.shift()?.querySelector('h1');
    const submit = rows.pop()?.querySelector('strong');
    const form = shopifyForm('contact');
    const first = element('div', { class: 'shopify-contact-row' });
    rows.forEach((row, index) => {
      const [labelCell, typeCell, nameCell, requiredCell] = row.children;
      const labelNode = labelCell?.querySelector('strong');
      const type = typeCell?.textContent.trim();
      const name = nameCell?.textContent.trim();
      if (!labelNode || !['text', 'email', 'tel', 'textarea'].includes(type) || !name) {
        throw new Error('Ungültige Kontaktformular-Zeile.');
      }
      const id = `shopify-contact-${index}`;
      const label = element('label', { class: 'shopify-sr-only', for: id });
      label.append(labelNode);
      const field = element(type === 'textarea' ? 'textarea' : 'input', {
        id, name, placeholder: label.textContent, 'aria-label': label.textContent,
      });
      if (type !== 'textarea') field.type = type;
      else field.rows = 10;
      field.required = requiredCell?.textContent.trim() === 'required';
      form.append(label);
      if (index < 2) first.append(field);
      else form.append(field);
    });
    form.children[0].after(first);
    const button = element('button', { type: 'submit' });
    if (submit) button.append(submit);
    else throw new Error('Formular benötigt einen Submit-Text.');
    form.append(button);
    block.replaceChildren(...[heading, form].filter(Boolean));
  } catch (error) { failBlock(block, error); }
}
