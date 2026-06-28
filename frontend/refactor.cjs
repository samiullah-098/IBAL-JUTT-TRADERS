const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir);

const replacements = [
  { regex: /shadow-\[0_2px_10px_rgba\(0,0,0,0\.02\)\]/g, replacement: 'shadow-sm border border-slate-100' },
  { regex: /bg-\[#f97316\]/g, replacement: 'bg-[var(--color-brand-accent)]' },
  { regex: /hover:bg-\[#ea580c\]/g, replacement: 'hover:bg-[var(--color-brand-accent-hover)]' },
  { regex: /text-orange-500/g, replacement: 'text-[var(--color-brand-accent)]' },
  { regex: /bg-orange-500/g, replacement: 'bg-[var(--color-brand-accent)]' },
  { regex: /border-orange-500/g, replacement: 'border-[var(--color-brand-accent)]' },
  { regex: /text-orange-600/g, replacement: 'text-[var(--color-brand-primary)]' },
  { regex: /hover:text-orange-600/g, replacement: 'hover:text-[var(--color-brand-accent)]' },
  { regex: /hover:bg-orange-50/g, replacement: 'hover:bg-emerald-50' },
  { regex: /bg-orange-50/g, replacement: 'bg-emerald-50' },
  { regex: /border-orange-200/g, replacement: 'border-emerald-200' },
  { regex: /hover:bg-orange-600/g, replacement: 'hover:bg-[var(--color-brand-accent-hover)]' },
  { regex: /text-orange-400/g, replacement: 'text-[var(--color-brand-accent)]' },
  { regex: /bg-orange-100/g, replacement: 'bg-emerald-100' },
  { regex: /text-orange-100/g, replacement: 'text-emerald-100' },
  { regex: /text-orange-800/g, replacement: 'text-[var(--color-brand-primary)]' },
  { regex: /text-orange-700/g, replacement: 'text-[var(--color-brand-primary)]' },
  { regex: /focus:border-orange-500/g, replacement: 'focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)]' },
];

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });
  
  // Enhance headings
  content = content.replace(/className="([^"]*)text-xl([^"]*)font-bold([^"]*)"/g, 'className="$1text-xl$2font-bold$3 font-heading"');
  content = content.replace(/className="([^"]*)font-bold([^"]*)text-xl([^"]*)"/g, 'className="$1font-bold$2text-xl$3 font-heading"');
  content = content.replace(/className="([^"]*)text-2xl([^"]*)font-black([^"]*)"/g, 'className="$1text-2xl$2font-black$3 font-heading"');

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Refactor complete');
