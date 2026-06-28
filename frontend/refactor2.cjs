const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir);

const replacements = [
  { regex: /ring-orange-500/g, replacement: 'ring-[var(--color-brand-accent)]' },
  { regex: /border-l-orange-500/g, replacement: 'border-l-[var(--color-brand-accent)]' },
  { regex: /border-orange-100/g, replacement: 'border-emerald-100' },
  { regex: /border-orange-300/g, replacement: 'border-emerald-300' },
  { regex: /border-orange-600/g, replacement: 'border-[var(--color-brand-accent-hover)]' },
  { regex: /text-orange-900/g, replacement: 'text-[var(--color-brand-primary)]' },
  { regex: /border-t-orange-500/g, replacement: 'border-t-[var(--color-brand-accent)]' },
];

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Refactor 2 complete');
