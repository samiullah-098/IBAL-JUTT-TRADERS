const fs = require('fs');
let code = fs.readFileSync('index.ts', 'utf8');

const dashboardCode = `
app.get('/api/dashboard/detailed', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Parse dates
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(endDate as string) : new Date(new Date().setHours(23,59,59,999));
    end.setHours(23,59,59,999);

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(); monthStart.setDate(1);

    // Queries
    const [
      allSales, rangeSales, todaySalesRaw, weekSalesRaw, monthSalesRaw,
      allPurchases, rangePurchasesRaw,
      allExpenses,
      allParties,
      allInventory,
      allCommittees
    ] = await Promise.all([
      prisma.transaction.findMany({ where: { type: 'SALE' }, include: { Items: { include: { inventoryItem: true } }, party: true } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: start, lte: end } }, include: { Items: { include: { inventoryItem: true } }, party: true } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: todayStart, lte: todayEnd } }, include: { Items: { include: { inventoryItem: true } }, party: true } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: weekStart, lte: todayEnd } } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: monthStart, lte: todayEnd } } }),
      
      prisma.purchase.findMany({ include: { items: true } }),
      prisma.purchase.findMany({ where: { purchaseDate: { gte: start, lte: end } } }),
      
      prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.party.findMany(),
      prisma.inventoryItem.findMany(),
      prisma.committee.findMany({ where: { status: 'ACTIVE' } })
    ]);

    const calcSaleTotal = (sales: any[]) => sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const calcProfit = (sales: any[]) => sales.reduce((sum, s) => {
       const profit = s.items?.reduce((pSum: number, item: any) => {
          const cost = Number(item.purchaseRate || 0) * Number(item.quantity || 0);
          const revenue = Number(item.total || 0);
          return pSum + (revenue - cost);
       }, 0) || 0;
       return sum + profit;
    }, 0);

    const todaySales = calcSaleTotal(todaySalesRaw);
    const todayProfit = calcProfit(todaySalesRaw);
    const weekSales = calcSaleTotal(weekSalesRaw);
    const monthSales = calcSaleTotal(monthSalesRaw);
    const rangeSalesTotal = calcSaleTotal(rangeSales);
    const rangeProfit = calcProfit(rangeSales);

    const expensesTotal = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = rangeProfit - expensesTotal;

    const rangePurchases = rangePurchasesRaw.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

    // Cash received & paid (from all transactions in range - simple approximation)
    const transactions = await prisma.transaction.findMany({ where: { date: { gte: start, lte: end } } });
    const cashReceived = transactions.filter(t => t.type === 'PAYMENT_IN').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const cashPaidOut = transactions.filter(t => t.type === 'PAYMENT_OUT').reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // Khata
    const receivable = allParties.filter(p => p.type === 'BUYER').reduce((sum, p) => sum + Number(p.outstanding || 0), 0);
    const payable = Math.abs(allParties.filter(p => p.type === 'SELLER').reduce((sum, p) => sum + Number(p.outstanding || 0), 0));
    const netKhata = receivable - payable;

    // Inventory
    let inventoryValue = 0;
    let potentialProfit = 0;
    let totalStockKg = 0;
    let lowStockCount = 0;
    let outStockCount = 0;
    const lowStockItems: any[] = [];

    allInventory.forEach(inv => {
      const qty = Number(inv.quantity || 0);
      const pr = Number(inv.purchaseRate || 0);
      const sp = Number(inv.sellingPrice || 0);
      const rl = Number(inv.reorderLevel || 10);
      
      if (qty > 0) {
        inventoryValue += (qty * pr);
        potentialProfit += (qty * (sp - pr));
        totalStockKg += qty;
      }

      if (qty <= 0) {
        outStockCount++;
      } else if (qty <= rl) {
        lowStockCount++;
        lowStockItems.push(inv);
      }
    });

    const topCustomers = allParties.filter(p => p.type === 'BUYER' && p.outstanding > 0).sort((a,b) => b.outstanding - a.outstanding).slice(0,5);
    const topSuppliers = allParties.filter(p => p.type === 'SELLER' && p.outstanding < 0).sort((a,b) => a.outstanding - b.outstanding).slice(0,5);
    
    const recentSales = rangeSales.sort((a:any,b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,5);
    const recentPurchases = rangePurchasesRaw.sort((a:any,b:any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()).slice(0,5);
    const recentExpenses = allExpenses.sort((a:any,b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,5);

    res.json({
      cards: {
        todaySales, todayProfit, weekSales, monthSales, rangeSales: rangeSalesTotal, rangeProfit,
        expenses: expensesTotal, netProfit, rangePurchases, cashReceived, cashPaidOut,
        receivable, payable, netKhata, inventoryValue, potentialProfit, totalStockKg,
        lowStockCount, outStockCount, activeCommittees: allCommittees.length
      },
      lists: {
        topCustomers, topSuppliers, lowStockItems, recentSales, recentPurchases, recentExpenses
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});
`;

code = code.replace("app.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', message: 'Yarn POS Backend is running' });\n});", "app.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', message: 'Yarn POS Backend is running' });\n});\n" + dashboardCode);
fs.writeFileSync('index.ts', code);
console.log('Dashboard API added');
