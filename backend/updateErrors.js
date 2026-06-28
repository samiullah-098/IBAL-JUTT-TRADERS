const fs = require('fs');
let code = fs.readFileSync('index.ts', 'utf8');
code = code.replace(/res\.status\(500\)\.json\(\{ error: '([^']+)' \}\);/g, "res.status(500).json({ error: '$1', details: error?.message || String(error) });");
fs.writeFileSync('index.ts', code);
console.log('Done');
