const fs = require('fs');
let code = fs.readFileSync('index.ts', 'utf8');

const notifCode = `
app.get('/api/notifications', async (req, res) => {
  try {
    const lowStockItems = await prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } });
    const lowStock = lowStockItems.filter(i => Number(i.quantity || 0) <= Number(i.reorderLevel || 10));
    
    const receivableParties = await prisma.party.findMany({ where: { type: 'BUYER', outstanding: { gt: 0 } } });
    const payableParties = await prisma.party.findMany({ where: { type: 'SELLER', outstanding: { lt: 0 } } });

    res.json({
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.map(i => ({ id: i.id, text: \`\${i.variant} (\${i.quantity} \${i.unit} left)\` })),
      receivableCount: receivableParties.length,
      payableCount: payableParties.length,
      alerts: [
        ...lowStock.map(i => ({ type: 'warning', text: \`Low Stock: \${i.variant} only \${i.quantity} \${i.unit}\` })),
        ...receivableParties.map(p => ({ type: 'info', text: \`\${p.name} owes Rs \${p.outstanding.toLocaleString()}\` }))
      ].slice(0, 10)
    });
  } catch (error) {
    res.json({ alerts: [] });
  }
});
`;

code = code.replace("app.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', message: 'Yarn POS Backend is running' });\n});", "app.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', message: 'Yarn POS Backend is running' });\n});\n" + notifCode);
fs.writeFileSync('index.ts', code);
