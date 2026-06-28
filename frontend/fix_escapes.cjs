const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PurchasesScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace escaped backticks with actual backticks
content = content.replace(/\\`/g, '`');
// Replace escaped dollar signs with actual dollar signs
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fix applied successfully');
