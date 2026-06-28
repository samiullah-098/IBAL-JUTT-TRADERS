import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import committeeRoutes from './committeeRoutes';
import posRoutes from './posRoutes';

const app = express();
export { app };
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const isPostgres = String(process.env.DATABASE_URL || '').startsWith('postgres');
const sqlCompat = (query: string) => {
  if (!isPostgres) return query;
  let converted = query
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
    .replace(/CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP');
  let i = 0;
  converted = converted.replace(/\?/g, () => `$${++i}`);
  return converted;
};
const originalQueryRawUnsafe = prisma.$queryRawUnsafe.bind(prisma);
const originalExecuteRawUnsafe = prisma.$executeRawUnsafe.bind(prisma);
(prisma as any).$queryRawUnsafe = (query: string, ...params: any[]) => originalQueryRawUnsafe(sqlCompat(query), ...params);
(prisma as any).$executeRawUnsafe = (query: string, ...params: any[]) => originalExecuteRawUnsafe(sqlCompat(query), ...params);


const normalizeText = (value: any) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compactText = (value: any) => normalizeText(value).replace(/\s+/g, '');

const inventorySearchText = (item: any) => normalizeText([
  item.variant,
  item.category,
  item.lotNumber,
  item.millName,
  item.yarnCount,
  item.color,
  item.unit,
  item.sellingPrice,
  item.purchaseRate,
  item.supplierName,
  item.lastPurchaseId,
  item.notes,
].filter(Boolean).join(' '));

const parseBagWeights = (raw: any): number[] => {
  if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isFinite(n) && n > 0);
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .replace(/[\n\t]+/g, ',')
    .split(/[,، ]+/)
    .map(v => Number(v.trim()))
    .filter(n => Number.isFinite(n) && n > 0);
};

const itemQuantityFromBags = (item: any) => {
  const weights = parseBagWeights(item.bagWeights || item.bagWeightsText || item.actualBagWeights);
  if (weights.length > 0) return weights.reduce((a, b) => a + b, 0);
  return (parseFloat(item.bags || 0) * parseFloat(item.weightPerBag || item.weightPerUnit || 0)) || parseFloat(item.quantity || 0) || 0;
};

const inventoryItemMatches = (item: any, rawSearch: string) => {
  const query = normalizeText(rawSearch);
  if (!query) return true;
  const haystack = inventorySearchText(item);
  if (haystack.includes(query) || compactText(haystack).includes(compactText(query))) return true;
  const parts = query.split(' ').filter(Boolean);
  return parts.length > 0 && parts.every(part => haystack.includes(part));
};


app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch (e) {}
  } else if (typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch (e) {}
  }
  next();
});
app.use(committeeRoutes);
app.use('/api/pos', posRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Yarn POS Backend is running' });
});

app.get('/api/notifications', async (req, res) => {
  try {
    const lowStockItems = await prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } });
    const lowStock = lowStockItems.filter(i => Number(i.quantity || 0) <= Number(i.reorderLevel || 10));
    
    const receivableParties = await prisma.party.findMany({ where: { type: 'BUYER', outstanding: { gt: 0 } } });
    const payableParties = await prisma.party.findMany({ where: { type: 'SELLER', outstanding: { lt: 0 } } });

    res.json({
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.map(i => ({ id: i.id, text: `${i.variant} (${i.quantity} ${i.unit} left)` })),
      receivableCount: receivableParties.length,
      payableCount: payableParties.length,
      alerts: [
        ...lowStock.map(i => ({ type: 'warning', text: `Low Stock: ${i.variant} only ${i.quantity} ${i.unit}` })),
        ...receivableParties.map(p => ({ type: 'info', text: `${p.name} owes Rs ${p.outstanding.toLocaleString()}` }))
      ].slice(0, 10)
    });
  } catch (error) {
    res.json({ alerts: [] });
  }
});


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
      prisma.sale.findMany({ include: { items: true } }),
      prisma.sale.findMany({ where: { date: { gte: start, lte: end } }, include: { items: true } }),
      prisma.sale.findMany({ where: { date: { gte: todayStart, lte: todayEnd } }, include: { items: true } }),
      prisma.sale.findMany({ where: { date: { gte: weekStart, lte: todayEnd } } }),
      prisma.sale.findMany({ where: { date: { gte: monthStart, lte: todayEnd } } }),
      
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


// -- Advanced Inventory APIs --

app.get('/api/inventory', async (req, res) => {
  try {
    const { search, category } = req.query;
    const categoryFilter = String(category || 'All');
    const searchStr = String(search || '').trim();

    const items = await prisma.inventoryItem.findMany({
      where: { status: 'ACTIVE' },
      include: { Bags: true },
      orderBy: { updatedAt: 'desc' }
    });

    const filtered = items.filter(item => {
      const categoryOk = !categoryFilter || categoryFilter === 'All' || item.category === categoryFilter;
      const searchOk = !searchStr || inventoryItemMatches(item, searchStr);
      return categoryOk && searchOk;
    });

    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inventory', details: error?.message || String(error) });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const data = req.body;
    
    const bagWeights = parseBagWeights(data.actualBagWeights);
    const calculatedQuantity = bagWeights.length > 0 
      ? bagWeights.reduce((a, b) => a + b, 0)
      : (parseFloat(data.quantity) || 0);

    const payload = {
      category: data.category,
      variant: data.variant,
      yarnCount: data.yarnCount,
      millName: data.millName,
      lotNumber: data.lotNumber,
      color: data.color,
      weightPerUnit: data.weightPerUnit ? parseFloat(data.weightPerUnit) : null,
      reorderLevel: parseFloat(data.reorderLevel) || 10,
      notes: data.notes,
      quantity: calculatedQuantity,
      unit: data.unit || 'kg',
      status: 'ACTIVE',
      purchaseRate: parseFloat(data.purchaseRate) || 0,
      sellingMargin: parseFloat(data.sellingMargin) || 0,
      sellingPrice: parseFloat(data.sellingPrice) || 0,
    };

    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({ data: payload });
      if (bagWeights.length > 0) {
        await tx.inventoryBag.createMany({
          data: bagWeights.map(w => ({
            inventoryItemId: item.id,
            weight: w,
            purchaseRate: payload.purchaseRate,
            saleRate: payload.sellingPrice,
            status: 'IN_STOCK',
            source: 'MANUAL'
          }))
        });
      }
      return item;
    });
    res.json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create item', details: error?.message || String(error) });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    let payload: any = {
      category: data.category,
      variant: data.variant,
      yarnCount: data.yarnCount,
      millName: data.millName,
      lotNumber: data.lotNumber,
      color: data.color,
      weightPerUnit: data.weightPerUnit ? parseFloat(data.weightPerUnit) : null,
      reorderLevel: parseFloat(data.reorderLevel) || 10,
      notes: data.notes,
      unit: data.unit || 'kg',
      status: 'ACTIVE',
      purchaseRate: parseFloat(data.purchaseRate) || 0,
      sellingMargin: parseFloat(data.sellingMargin) || 0,
      sellingPrice: parseFloat(data.sellingPrice) || 0
    };

    const updatedItem = await prisma.$transaction(async (tx) => {
      if (data.actualBagWeights !== undefined) {
         const newWeights = parseBagWeights(data.actualBagWeights);
         await tx.inventoryBag.deleteMany({
           where: { inventoryItemId: Number(id), status: 'IN_STOCK', source: 'MANUAL' }
         });
         if (newWeights.length > 0) {
           await tx.inventoryBag.createMany({
             data: newWeights.map(w => ({
               inventoryItemId: Number(id),
               weight: w,
               purchaseRate: payload.purchaseRate,
               saleRate: payload.sellingPrice,
               status: 'IN_STOCK',
               source: 'MANUAL'
             }))
           });
         }
         const allBags = await tx.inventoryBag.findMany({ where: { inventoryItemId: Number(id), status: 'IN_STOCK' }});
         payload.quantity = allBags.length > 0 ? allBags.reduce((acc, b) => acc + b.weight, 0) : (parseFloat(data.quantity) || 0);
      } else {
         payload.quantity = parseFloat(data.quantity) || 0;
      }
      
      return tx.inventoryItem.update({
        where: { id: Number(id) },
        data: payload
      });
    });
    res.json(updatedItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update item', details: error?.message || String(error) });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for references in PurchaseItems or TransactionItems
    const purchaseItemCount = await prisma.purchaseItem.count({
      where: { inventoryItemId: Number(id) }
    });
    const transactionItemCount = await prisma.transactionItem.count({
      where: { inventoryItemId: Number(id) }
    });

    if (purchaseItemCount > 0 || transactionItemCount > 0) {
      // Soft delete / Archive
      await prisma.inventoryItem.update({
        where: { id: Number(id) },
        data: { status: 'INACTIVE' }
      });
      return res.json({ success: true, message: 'Inventory item archived successfully because it has transaction history' });
    } else {
      // Hard delete
      await prisma.inventoryItem.delete({
        where: { id: Number(id) }
      });
      return res.json({ success: true, message: 'Inventory item deleted successfully' });
    }
  } catch (error) {
    console.error("Delete Error", error);
    res.status(500).json({ error: 'Failed to delete item', details: error?.message || String(error) });
  }
});

// -- Advanced Purchases APIs --

app.get('/api/purchases', async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause: any = {};
    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { billNumber: { contains: searchStr } },
        { truckNumber: { contains: searchStr } },
        { party: { name: { contains: searchStr } } }
      ];
    }
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: { party: true, items: { include: { inventoryItem: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch purchases', details: error?.message || String(error) });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { 
      billNumber, partyId, newSupplier, purchaseDate, status, truckNumber, 
      driverPhone, amountPaid, notes, items,
      paymentMethod, paymentStatus, discountType, totalDiscount, billImage
    } = req.body;
    
    const parsedTotalDiscount = parseFloat(totalDiscount) || 0;
    const parsedAmountPaid = parseFloat(amountPaid) || 0;

    // Calculate gross amount from items
    const grossTotal = items.reduce((acc: number, item: any) => acc + (itemQuantityFromBags(item) * parseFloat(item.rate || 0)), 0);
    const netTotalAmount = grossTotal - parsedTotalDiscount;
    const balanceDue = netTotalAmount - parsedAmountPaid;

    const result = await prisma.$transaction(async (tx) => {
      let finalPartyId = Number(partyId);
      let supplierNameStr = '';

      // Auto-generate Purchase ID
      const year = new Date().getFullYear();
      const count = await tx.purchase.count({ where: { purchaseId: { startsWith: `PUR-${year}-` } } });
      const purchaseId = `PUR-${year}-${String(count + 1).padStart(4, '0')}`;

      if (newSupplier) {
        const openingBalance = parseFloat(newSupplier.openingBalance) || 0;
        const party = await tx.party.create({
          data: {
            name: newSupplier.name,
            type: 'SELLER',
            phone: newSupplier.phone || null,
            shopName: newSupplier.shopName || null,
            city: newSupplier.city || null,
            address: newSupplier.address || null,
            profileImage: newSupplier.profileImage || null,
            openingBalance: openingBalance,
            outstanding: -Math.abs(openingBalance), // payable is negative
            status: 'ACTIVE'
          }
        });
        supplierNameStr = party.name;
        
        if (openingBalance !== 0) {
          await tx.transaction.create({
            data: {
              partyId: party.id,
              type: 'OPENING_BALANCE',
              amount: Math.abs(openingBalance),
              description: 'Account Opening Balance',
              date: new Date()
            }
          });
        }
        finalPartyId = party.id;
      } else {
        const existingParty = await tx.party.findUnique({ where: { id: finalPartyId } });
        if (existingParty) supplierNameStr = existingParty.name;
      }

      let processedItems = [];
      for (const item of items) {
        if (item.isNewItem && item.newItemDetails) {
          const newInvItem = await tx.inventoryItem.create({
            data: {
              category: item.newItemDetails.category || item.category || 'Yarn',
              variant: item.newItemDetails.variant,
              yarnCount: item.newItemDetails.yarnCount || null,
              millName: item.newItemDetails.millName || null,
              lotNumber: item.newItemDetails.lotNumber || null,
              color: item.newItemDetails.color || null,
              weightPerUnit: item.newItemDetails.weightPerUnit ? parseFloat(item.newItemDetails.weightPerUnit) : null,
              reorderLevel: parseFloat(item.newItemDetails.reorderLevel) || 10,
              notes: item.newItemDetails.notes || '',
              sellingPrice: parseFloat(item.newItemDetails.sellingPrice) || 0,
              sellingMargin: parseFloat(item.newItemDetails.sellingMargin) || 0,
              purchaseRate: parseFloat(item.rate) || 0,
              unit: item.unit || 'Kg',
              quantity: 0
            }
          });
          processedItems.push({
            ...item,
            inventoryItemId: newInvItem.id
          });
        } else {
          processedItems.push(item);
        }
      }

      const newPurchase = await tx.purchase.create({
        data: {
          purchaseId: purchaseId,
          billNumber: billNumber || null,
          partyId: finalPartyId,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          status: status || 'RECEIVED',
          truckNumber,
          driverPhone,
          totalAmount: netTotalAmount, // store net amount after discount
          amountPaid: parsedAmountPaid,
          balanceDue,
          notes,
          paymentMethod: paymentMethod || null,
          paymentStatus: paymentStatus || null,
          discountType: discountType || null,
          totalDiscount: parsedTotalDiscount,
          billImage: billImage || null,
          items: {
            create: processedItems.map((item: any) => ({
              inventoryItemId: Number(item.inventoryItemId),
              bags: item.bags ? parseFloat(item.bags) : null,
              weightPerUnit: item.weightPerBag ? parseFloat(item.weightPerBag) : null,
              unit: item.unit || null,
              note: item.note || null,
              bagWeights: parseBagWeights(item.bagWeights || item.bagWeightsText).length ? JSON.stringify(parseBagWeights(item.bagWeights || item.bagWeightsText)) : null,
              quantity: itemQuantityFromBags(item),
              rate: parseFloat(item.rate),
              total: itemQuantityFromBags(item) * parseFloat(item.rate),
              itemDiscount: parseFloat(item.itemDiscount) || 0,
              expectedProfit: parseFloat(item.expectedProfit) || 0
            }))
          }
        },
        include: { items: true, party: true }
      });

      for (const item of processedItems) {
        await tx.inventoryItem.update({
          where: { id: Number(item.inventoryItemId) },
          data: { 
            quantity: { increment: itemQuantityFromBags(item) },
            purchaseRate: parseFloat(item.rate),
            lastPurchaseId: purchaseId,
            lastPurchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            supplierName: supplierNameStr,
            totalPurchaseQuantity: { increment: itemQuantityFromBags(item) }
          }
        });

        const bagWeights = parseBagWeights(item.bagWeights || item.bagWeightsText);
        if (bagWeights.length > 0) {
           await tx.inventoryBag.createMany({
              data: bagWeights.map(w => ({
                 inventoryItemId: Number(item.inventoryItemId),
                 weight: w,
                 purchaseRate: parseFloat(item.rate),
                 saleRate: parseFloat(item?.newItemDetails?.sellingPrice || 0),
                 status: 'IN_STOCK',
                 source: 'PURCHASE',
                 sourceId: purchaseId
              }))
           });
        }
      }

      // Record transaction and update Khata
      // Payable outstanding is typically NEGATIVE in this system (from previous khata rules).
      // So we decrement outstanding for purchases, and increment for payments.
      if (netTotalAmount > 0) {
        await tx.party.update({
          where: { id: finalPartyId },
          data: { outstanding: { decrement: netTotalAmount } } // decrement to increase payable
        });
        
        await tx.transaction.create({
          data: {
            partyId: finalPartyId,
            type: 'PURCHASE',
            amount: netTotalAmount,
            description: `Purchase ID ${purchaseId} ${billNumber ? `(Ref: ${billNumber})` : ''}`,
            referenceNumber: purchaseId,
            date: purchaseDate ? new Date(purchaseDate) : new Date()
          }
        });
      }

      if (parsedAmountPaid > 0) {
        await tx.transaction.create({
          data: {
            partyId: finalPartyId,
            type: 'PAYMENT_OUT',
            amount: parsedAmountPaid,
            paymentMethod: paymentMethod || 'CASH',
            description: `Payment for Purchase ID ${purchaseId}`,
            referenceNumber: purchaseId,
            date: purchaseDate ? new Date(purchaseDate) : new Date()
          }
        });

        await tx.party.update({
          where: { id: finalPartyId },
          data: { outstanding: { increment: parsedAmountPaid } } // increment to reduce payable
        });
      }

      return newPurchase;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create purchase', details: error?.message || String(error) });
  }
});

// -- Supplier Specific APIs --

app.get('/api/suppliers/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await prisma.party.findUnique({
      where: { id: Number(id) }
    });
    
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    
    const purchases = await prisma.purchase.findMany({
      where: { partyId: Number(id) },
      include: { items: { include: { inventoryItem: true } } },
      orderBy: { purchaseDate: 'desc' }
    });
    
    const payments = await prisma.transaction.findMany({
      where: { partyId: Number(id), type: 'PAYMENT_OUT' },
      orderBy: { date: 'desc' }
    });
    
    const totalPurchases = purchases.length;
    let totalMaalSupplied = 0; // quantity of items
    let totalPurchaseAmount = 0;
    let totalDiscountGiven = 0;
    
    purchases.forEach(p => {
      totalPurchaseAmount += p.totalAmount;
      totalDiscountGiven += p.totalDiscount;
      p.items.forEach(i => {
        totalMaalSupplied += i.quantity;
      });
    });
    
    const totalPaidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
    const lastPurchaseDate = purchases.length > 0 ? purchases[0].purchaseDate : null;
    
    res.json({
      supplier,
      stats: {
        totalPurchases,
        totalMaalSupplied,
        totalPurchaseAmount,
        totalPaidAmount,
        remainingPayable: supplier.outstanding < 0 ? Math.abs(supplier.outstanding) : 0,
        totalDiscountGiven,
        lastPurchaseDate
      },
      purchases,
      payments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch supplier analysis', details: error?.message || String(error) });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: Number(id) },
        include: { items: true }
      });
      if (!purchase) throw new Error('Purchase not found');

      for (const item of purchase.items) {
        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            quantity: { decrement: item.quantity },
            totalPurchaseQuantity: { decrement: item.quantity }
          }
        });
      }

      // Original purchase impact was: outstanding - totalAmount + amountPaid.
      // Reverse should be: outstanding + totalAmount - amountPaid.
      await tx.party.update({
        where: { id: purchase.partyId },
        data: { outstanding: { increment: purchase.totalAmount - purchase.amountPaid } }
      });

      await tx.transaction.create({
        data: {
          partyId: purchase.partyId,
          type: 'PURCHASE_REVERSAL',
          amount: purchase.totalAmount,
          description: `Reversal of deleted purchase ${purchase.purchaseId || purchase.billNumber || purchase.id}`,
          referenceNumber: purchase.purchaseId || purchase.billNumber || String(purchase.id),
          date: new Date()
        }
      });

      await tx.purchase.delete({ where: { id: Number(id) } });
    });
    res.json({ success: true, message: 'Purchase deleted and inventory/khata reversed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete purchase', details: error?.message || String(error) });
  }
});

// -- Advanced Sales / POS APIs --
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await prisma.transaction.findMany({
      where: { type: 'SALE' },
      include: { 
        party: true, 
        Items: { include: { inventoryItem: true } } 
      },
      orderBy: { date: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sales', details: error?.message || String(error) });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { partyId, newCustomer, items, discount = 0, freight = 0, amountPaid = 0, paymentMethod = 'CASH' } = req.body;
    
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedFreight = parseFloat(freight) || 0;
    const parsedAmountPaid = parseFloat(amountPaid) || 0;

    // Calculate item total
    const itemTotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);
    const grandTotal = itemTotal - parsedDiscount + parsedFreight;

    const result = await prisma.$transaction(async (tx) => {
      let finalPartyId = Number(partyId);

      if (newCustomer) {
        const openingBalance = parseFloat(newCustomer.openingBalance) || 0;
        const party = await tx.party.create({
          data: {
            name: newCustomer.name,
            type: 'BUYER',
            phone: newCustomer.phone || null,
            shopName: newCustomer.shopName || null,
            city: newCustomer.city || null,
            address: newCustomer.address || null,
            openingBalance: openingBalance,
            outstanding: openingBalance,
            status: 'ACTIVE'
          }
        });
        
        if (openingBalance !== 0) {
          await tx.transaction.create({
            data: {
              partyId: party.id,
              type: 'OPENING_BALANCE',
              amount: Math.abs(openingBalance),
              description: 'Account Opening Balance',
              date: new Date()
            }
          });
        }
        finalPartyId = party.id;
      }

      // 1. Create the SALE transaction
      // Generate Sale ID (SALE-YYYY-XXXX)
      const year = new Date().getFullYear();
      const count = await tx.transaction.count({ where: { type: 'SALE' } });
      const saleNumber = (count + 1).toString().padStart(4, '0');
      const invoiceId = `SALE-${year}-${saleNumber}`;

      let newSale = await tx.transaction.create({
        data: {
          partyId: finalPartyId,
          type: 'SALE',
          amount: grandTotal,
          description: `Sale Bill (Discount: ${parsedDiscount}, Freight: ${parsedFreight})`,
          invoiceId: invoiceId,
          discount: parsedDiscount,
          freight: parsedFreight,
          amountPaid: parsedAmountPaid,
          paymentMethod,
          date: new Date(),
          Items: {
            create: items.map((item: any) => ({
              inventoryItemId: Number(item.inventoryItemId),
              bags: item.bags ? parseFloat(item.bags) : null,
              weightPerUnit: item.weightPerBag ? parseFloat(item.weightPerBag) : null,
              unit: item.unit || null,
              note: item.note || null,
              bagWeights: parseBagWeights(item.bagWeights || item.bagWeightsText).length ? JSON.stringify(parseBagWeights(item.bagWeights || item.bagWeightsText)) : null,
              quantity: itemQuantityFromBags(item),
              rate: parseFloat(item.rate),
              total: itemQuantityFromBags(item) * parseFloat(item.rate)
            }))
          }
        },
        include: { Items: { include: { inventoryItem: true } }, party: true }
      });

      // Update with authentic Bill ID
      newSale = await tx.transaction.update({
        where: { id: newSale.id },
        data: { description: `Sale Bill #${newSale.id} (Discount: ${parsedDiscount}, Freight: ${parsedFreight})` },
        include: { Items: { include: { inventoryItem: true } }, party: true }
      });

      // 2. Decrement inventory and mark bags sold
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { id: Number(item.inventoryItemId) },
          data: { quantity: { decrement: itemQuantityFromBags(item) }, totalSoldQuantity: { increment: itemQuantityFromBags(item) } }
        });

        if (item.selectedBagIds && Array.isArray(item.selectedBagIds) && item.selectedBagIds.length > 0) {
          const txItems = await tx.transactionItem.findMany({
            where: { transactionId: newSale.id, inventoryItemId: Number(item.inventoryItemId) }
          });
          if (txItems.length > 0) {
             const tItemId = txItems[0].id;
             await tx.inventoryBag.updateMany({
               where: { id: { in: item.selectedBagIds.map(Number) } },
               data: { status: 'SOLD', saleItemId: tItemId, saleRate: parseFloat(item.rate) }
             });
          }
        }
      }

      // 3. Update Party Outstanding (+ for sale, - for payment)
      await tx.party.update({
        where: { id: finalPartyId },
        data: { outstanding: { increment: grandTotal } }
      });

      // 4. Create PAYMENT_IN if paid
      if (parsedAmountPaid > 0) {
        await tx.transaction.create({
          data: {
            partyId: finalPartyId,
            type: 'PAYMENT_IN',
            amount: parsedAmountPaid,
            description: `Payment against Sale #${newSale.id}`,
            paymentMethod: paymentMethod,
            date: new Date()
          }
        });

        await tx.party.update({
          where: { id: finalPartyId },
          data: { outstanding: { decrement: parsedAmountPaid } }
        });
      }

      return newSale;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create sale', details: error?.message || String(error) });
  }
});
// -- Advanced Party Khata APIs --
app.get('/api/parties', async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause: any = {};
    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { name: { contains: searchStr } },
        { shopName: { contains: searchStr } },
        { phone: { contains: searchStr } }
      ];
    }
    const parties = await prisma.party.findMany({
      where: whereClause,
      orderBy: { outstanding: 'desc' }
    });
    res.json(parties);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch parties', details: error?.message || String(error) });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.party.findMany({ where: { OR: [{ type: 'BUYER' }, { type: 'BOTH' }] } });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers', details: error?.message || String(error) });
  }
});

app.post('/api/customers/quick-add', async (req, res) => {
  try {
    const data = req.body;
    const openingBalance = parseFloat(data.openingBalance) || 0;
    
    const result = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.party.create({
        data: {
          name: data.name,
          type: 'BUYER',
          phone: data.phone || null,
          shopName: data.shopName || null,
          city: data.city || null,
          address: data.address || null,
          openingBalance: openingBalance,
          outstanding: openingBalance,
          status: 'ACTIVE'
        }
      });
      
      if (openingBalance > 0) {
        await tx.transaction.create({
          data: {
            partyId: newCustomer.id,
            type: 'OPENING_BALANCE',
            amount: openingBalance,
            description: 'Account Opening Balance (Receivable)',
            date: new Date()
          }
        });
      }
      return newCustomer;
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to quick add customer', details: error?.message || String(error) });
  }
});

app.get('/api/suppliers', async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause: any = { OR: [{ type: 'SELLER' }, { type: 'BOTH' }] };
    if (search) {
      const s = String(search);
      whereClause = {
        AND: [
          { OR: [{ type: 'SELLER' }, { type: 'BOTH' }] },
          { OR: [
            { name: { contains: s } },
            { shopName: { contains: s } },
            { phone: { contains: s } }
          ]}
        ]
      };
    }
    const suppliers = await prisma.party.findMany({
      where: whereClause,
      orderBy: { outstanding: 'asc' } // most payable first
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers', details: error?.message || String(error) });
  }
});

app.post('/api/parties', async (req, res) => {
  try {
    const data = req.body;
    const openingBalance = parseFloat(data.openingBalance) || 0;
    
    const result = await prisma.$transaction(async (tx) => {
      const newParty = await tx.party.create({
        data: {
          name: data.name,
          type: data.type,
          phone: data.phone,
          shopName: data.shopName,
          cnic: data.cnic,
          ntn: data.ntn,
          city: data.city,
          address: data.address,
          creditLimit: parseFloat(data.creditLimit) || 0,
          openingBalance: openingBalance,
          outstanding: openingBalance,
          status: data.status || 'ACTIVE'
        }
      });
      
      if (openingBalance !== 0) {
        await tx.transaction.create({
          data: {
            partyId: newParty.id,
            type: 'OPENING_BALANCE',
            amount: Math.abs(openingBalance), // Handle negative opening balances in logic
            description: 'Account Opening Balance',
            date: new Date()
          }
        });
      }
      return newParty;
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create party', details: error?.message || String(error) });
  }
});

app.get('/api/parties/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    const party = await prisma.party.findUnique({ where: { id: Number(id) } });
    if (!party) return res.status(404).json({ error: 'Not found' });
    
    const transactions = await prisma.transaction.findMany({
      where: { partyId: Number(id) },
      orderBy: { date: 'asc' }
    });
    
    let runningBalance = 0;
    const ledgerWithBalance = transactions.map(tx => {
      if (tx.type === 'PURCHASE' || tx.type === 'SALE' || tx.type === 'OPENING_BALANCE') {
         runningBalance += tx.amount;
         return { ...tx, dr: tx.amount, cr: 0, runningBalance };
      } else if (tx.type === 'PAYMENT_IN' || tx.type === 'PAYMENT_OUT') {
         runningBalance -= tx.amount;
         return { ...tx, dr: 0, cr: tx.amount, runningBalance };
      }
      return { ...tx, runningBalance };
    });
    
    res.json({ party, ledger: ledgerWithBalance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ledger', details: error?.message || String(error) });
  }
});

// (old analysis endpoint replaced by new one added at the top of supplier section)

app.get('/api/customers/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.party.findUnique({ where: { id: Number(id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    // Ledger
    const transactions = await prisma.transaction.findMany({
      where: { partyId: Number(id) },
      orderBy: { date: 'asc' }
    });
    
    let runningBalance = 0;
    const ledger = transactions.map(tx => {
      if (tx.type === 'PURCHASE' || tx.type === 'SALE' || tx.type === 'OPENING_BALANCE') {
         runningBalance += tx.amount;
         return { ...tx, dr: tx.amount, cr: 0, runningBalance };
      } else if (tx.type === 'PAYMENT_IN' || tx.type === 'PAYMENT_OUT') {
         runningBalance -= tx.amount;
         return { ...tx, dr: 0, cr: tx.amount, runningBalance };
      }
      return { ...tx, runningBalance };
    });

    // Sales Analysis
    const salesTransactions = await prisma.transaction.findMany({
      where: { partyId: Number(id), type: 'SALE' },
      include: { Items: { include: { inventoryItem: true } } },
      orderBy: { date: 'desc' }
    });

    const itemStats: Record<string, { variant: string, millName: string, totalBags: number, totalQuantity: number, totalValue: number, unit: string }> = {};
    let totalDiscountDerived = 0;

    for (const sale of salesTransactions) {
      for (const item of sale.Items) {
        const v = item.inventoryItem.variant;
        if (!itemStats[v]) {
          itemStats[v] = { variant: v, millName: item.inventoryItem.millName || '-', totalBags: 0, totalQuantity: 0, totalValue: 0, unit: item.unit || 'Kg' };
        }
        itemStats[v].totalBags += (item.bags || 0);
        itemStats[v].totalQuantity += item.quantity;
        itemStats[v].totalValue += item.total;
      }
    }

    res.json({
      customer,
      ledger,
      itemStats: Object.values(itemStats),
      salesHistory: salesTransactions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch customer analysis', details: error?.message || String(error) });
  }
});

app.post('/api/parties/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, paymentMethod, referenceNumber, date } = req.body;
    const parsedAmount = parseFloat(amount);
    
    const result = await prisma.$transaction(async (tx) => {
      const party = await tx.party.findUnique({ where: { id: Number(id) }});
      if(!party) throw new Error("Party not found");
      
      const newTx = await tx.transaction.create({
        data: {
          partyId: Number(id),
          type,
          amount: parsedAmount,
          description,
          paymentMethod,
          referenceNumber,
          date: date ? new Date(date) : new Date()
        }
      });
      
      let outstandingDelta = 0;
      if (type === 'SALE') outstandingDelta = parsedAmount; // customer owes us more
      if (type === 'PAYMENT_IN') outstandingDelta = -parsedAmount; // customer paid us
      if (type === 'PURCHASE') outstandingDelta = -parsedAmount; // we owe supplier more
      if (type === 'PAYMENT_OUT') outstandingDelta = parsedAmount; // we paid supplier, payable reduces
      if (type === 'OPENING_BALANCE') outstandingDelta = party.type === 'SELLER' ? -parsedAmount : parsedAmount;
      
      await tx.party.update({
        where: { id: Number(id) },
        data: { outstanding: { increment: outstandingDelta } }
      });
      
      return newTx;
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add transaction', details: error?.message || String(error) });
  }
});

app.delete('/api/parties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const txCount = await prisma.transaction.count({ where: { partyId: Number(id) } });
    
    if (txCount > 0) {
      return res.status(400).json({ error: 'Cannot delete party with existing transactions. Please deactivate instead.' });
    }
    
    await prisma.party.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete party', details: error?.message || String(error) });
  }
});

// -- POS Specialized APIs --

app.get('/api/pos/items/search', async (req, res) => {
  try {
    const { q } = req.query;
    const s = String(q || '');
    
    if (!s) {
      return res.json([]);
    }

    const items = await prisma.inventoryItem.findMany({
      where: {
        status: 'ACTIVE',
        quantity: { gt: 0 },
        OR: [
          { variant: { contains: s } },
          { category: { contains: s } },
          { lotNumber: { contains: s } },
          { millName: { contains: s } },
          { yarnCount: { contains: s } },
          { color: { contains: s } },
          { notes: { contains: s } },
          { supplierName: { contains: s } }
        ]
      },
      orderBy: { quantity: 'desc' },
      take: 20
    });
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search POS items', details: error?.message || String(error) });
  }
});

app.get('/api/pos/recent-items', async (req, res) => {
  try {
    // Just fetch the top 20 items by quantity for now, or recently updated
    const items = await prisma.inventoryItem.findMany({
      where: { status: 'ACTIVE', quantity: { gt: 0 } },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent POS items', details: error?.message || String(error) });
  }
});

app.get('/api/pos/today-summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sales = await prisma.transaction.findMany({
      where: {
        type: 'SALE',
        date: { gte: today }
      },
      include: { Items: true }
    });

    const payments = await prisma.transaction.findMany({
      where: {
        type: 'PAYMENT_IN',
        date: { gte: today }
      }
    });

    const totalSales = sales.reduce((acc, sale) => acc + sale.amount, 0);
    const cashReceived = payments.reduce((acc, pay) => acc + pay.amount, 0);
    
    // Calculate udhar accurately by inspecting payment vs sale amounts
    const totalUdhar = totalSales - cashReceived; // Simplification for today

    let itemsSold = 0;
    sales.forEach(sale => {
      sale.Items.forEach(item => {
        itemsSold += item.quantity;
      });
    });

    const lowStockCount = await prisma.inventoryItem.count({ where: { status: 'ACTIVE', quantity: { lt: 50 } } });

    res.json({
      todaySales: totalSales,
      cashReceived,
      todayUdhar: totalUdhar > 0 ? totalUdhar : 0,
      itemsSold,
      lowStockCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch POS today summary', details: error?.message || String(error) });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalParties = await prisma.party.count({ where: { status: 'ACTIVE' } });
    const allParties = await prisma.party.findMany({ where: { status: 'ACTIVE' } });
    const totalReceivable = allParties.filter(p => p.outstanding > 0).reduce((acc, p) => acc + p.outstanding, 0);
    const totalPayable = allParties.filter(p => p.outstanding < 0).reduce((acc, p) => acc + Math.abs(p.outstanding), 0);
    const activeCommittees = await prisma.committee.count({ where: { status: 'ACTIVE' } });
    const lowStockCount = await prisma.inventoryItem.count({ where: { status: 'ACTIVE', quantity: { lte: 10 } } });

    const todaySalesRows = await prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: today } }, include: { Items: { include: { inventoryItem: true } } } });
    const dailySales = todaySalesRows.reduce((acc, sale) => acc + sale.amount, 0);
    const grossProfit = todaySalesRows.reduce((acc, sale) => {
      const itemsProfit = sale.Items.reduce((sum, item) => {
        const cost = Number(item.inventoryItem?.purchaseRate || 0) * Number(item.quantity || 0);
        return sum + (Number(item.total || 0) - cost);
      }, 0);
      return acc + itemsProfit;
    }, 0);

    const todayPurchasesAgg = await prisma.purchase.aggregate({
      where: { purchaseDate: { gte: today } },
      _sum: { totalAmount: true }
    });

    const inventory = await prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } });
    const inventoryValue = inventory.reduce((acc, item) => acc + (item.quantity * item.purchaseRate), 0);

    res.json({
      totalParties,
      totalOutstanding: totalReceivable,
      totalReceivable,
      totalPayable,
      activeCommittees,
      lowStockCount,
      grossProfit,
      dailySales,
      todayPurchases: todayPurchasesAgg._sum.totalAmount || 0,
      netCapital: inventoryValue + totalReceivable - totalPayable
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics', details: error?.message || String(error) });
  }
});


app.get('/api/inventory/:id/details', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        Bags: { orderBy: { createdAt: 'desc' } },
        PurchaseItems: { include: { purchase: { include: { party: true } } }, orderBy: { id: 'desc' }, take: 20 },
        TransactionItems: { include: { transaction: { include: { party: true } } }, orderBy: { id: 'desc' }, take: 20 }
      }
    });
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    const stockValue = Number(item.quantity || 0) * Number(item.purchaseRate || 0);
    const potentialProfit = Number(item.quantity || 0) * Math.max(0, Number(item.sellingPrice || 0) - Number(item.purchaseRate || 0));
    const purchaseHistory = item.PurchaseItems.map(pi => ({
      id: pi.id,
      purchaseId: pi.purchase?.purchaseId,
      date: pi.purchase?.purchaseDate,
      supplier: pi.purchase?.party?.name,
      bags: pi.bags,
      weightPerUnit: pi.weightPerUnit,
      bagWeights: pi.bagWeights,
      quantity: pi.quantity,
      rate: pi.rate,
      total: pi.total,
      note: pi.note
    }));
    const saleHistory = item.TransactionItems.map(si => ({
      id: si.id,
      invoiceId: si.transaction?.invoiceId,
      date: si.transaction?.date,
      customer: si.transaction?.party?.name,
      bags: si.bags,
      weightPerUnit: si.weightPerUnit,
      bagWeights: si.bagWeights,
      quantity: si.quantity,
      rate: si.rate,
      total: si.total,
      note: si.note
    }));
    res.json({ item, metrics: { stockValue, potentialProfit }, purchaseHistory, saleHistory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inventory item details', details: error?.message || String(error) });
  }
});

app.get('/api/inventory/stats', async (req, res) => {
  try {
    const inventory = await prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } });
    let totalStockKG = 0;
    let totalValuation = 0;
    let totalPotentialProfit = 0;
    
    inventory.forEach(item => {
      if (item.unit.toLowerCase() === 'kg' || item.unit.toLowerCase() === 'kgs') {
        totalStockKG += item.quantity;
      }
      totalValuation += item.quantity * item.purchaseRate;
      totalPotentialProfit += item.quantity * (item.sellingPrice - item.purchaseRate);
    });

    const purchases = await prisma.purchase.aggregate({
      _sum: { totalAmount: true }
    });
    const totalPurchasesAmount = purchases._sum.totalAmount || 0;
    const totalMargin = totalValuation > 0 ? (totalPotentialProfit / totalValuation) * 100 : 0;
    
    res.json({
      totalStockKG,
      totalValuation,
      totalPotentialProfit,
      totalPurchasesAmount,
      totalMargin
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inventory stats', details: error?.message || String(error) });
  }
});



// -- Advanced Dashboard, Reports & Settings APIs --

type ReportDefinition = {
  key: string;
  title: string;
  category: string;
  source: string;
  period?: string;
  description: string;
};

const money = (n: any) => Number(n || 0);
const sum = (arr: any[], fn: (row: any) => number) => arr.reduce((acc, row) => acc + fn(row), 0);

const getPeriodStart = (period?: string) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'today') return start;
  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    return start;
  }
  if (period === 'week') {
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1);
  }
  return null;
};

const buildReportDefinitions = (): ReportDefinition[] => {
  const defs: ReportDefinition[] = [];
  const add = (category: string, source: string, items: Array<[string,string,string,string?]>) => {
    items.forEach(([key, title, description, period]) => defs.push({ key, title, category, source, period, description }));
  };

  add('Sales & Billing', 'sales', [
    ['sales-today', 'Today Sales Summary', 'All invoices generated today with paid and udhar amount.', 'today'],
    ['sales-yesterday', 'Yesterday Sales Summary', 'Previous day invoice and payment summary.', 'yesterday'],
    ['sales-week', 'Last 7 Days Sales', 'Sales trend and invoices for the last seven days.', 'week'],
    ['sales-month', 'Current Month Sales', 'Complete current month sales performance.', 'month'],
    ['sales-year', 'Current Year Sales', 'Year-to-date sales summary.', 'year'],
    ['sales-all', 'All Sales Register', 'Every sale invoice with customer and amount details.'],
    ['sales-udhar', 'Udhar Sales Report', 'Sales where remaining amount is still receivable.'],
    ['sales-cash', 'Cash Sales Report', 'Sales with received cash/payment records.'],
    ['sales-top-invoices', 'Top Sale Invoices', 'Highest-value sale bills.'],
    ['sales-item-breakdown', 'Sale Item Breakdown', 'Item-wise quantity, rate and total in sales.']
  ]);

  add('Purchase & Supplier', 'purchases', [
    ['purchase-today', 'Today Purchases', 'Purchases entered today.', 'today'],
    ['purchase-week', 'Last 7 Days Purchases', 'Purchase activity in the last seven days.', 'week'],
    ['purchase-month', 'Current Month Purchases', 'All purchases this month.', 'month'],
    ['purchase-year', 'Current Year Purchases', 'Year-to-date purchase value.', 'year'],
    ['purchase-all', 'All Purchase Records', 'Every purchase invoice and supplier reference.'],
    ['purchase-unpaid', 'Unpaid Purchases', 'Purchases with remaining payable/udhar.'],
    ['purchase-paid', 'Paid Purchases', 'Purchases that are fully or mostly paid.'],
    ['purchase-discount', 'Supplier Discount Report', 'Purchases showing supplier discounts.'],
    ['purchase-stock-in', 'Stock In From Purchases', 'Quantity received from purchase records.'],
    ['purchase-top-suppliers', 'Top Purchase Suppliers', 'Suppliers with highest purchase value.']
  ]);

  add('Inventory & Stock', 'inventory', [
    ['inventory-current-stock', 'Current Stock Report', 'All active stock items with quantity and rate.'],
    ['inventory-low-stock', 'Low Stock Items', 'Items at or below reorder level.'],
    ['inventory-out-stock', 'Out of Stock Items', 'Items with zero or negative stock.'],
    ['inventory-valuation', 'Inventory Valuation', 'Stock value based on purchase rate.'],
    ['inventory-profit-potential', 'Potential Profit Report', 'Expected profit from available stock.'],
    ['inventory-margin', 'Item Margin Report', 'Purchase rate, sale rate and margin per item.'],
    ['inventory-category', 'Category Wise Stock', 'Stock grouped by yarn/category.'],
    ['inventory-supplier-reference', 'Supplier-wise Stock', 'Inventory items linked with supplier names.'],
    ['inventory-recent-updated', 'Recently Updated Stock', 'Items recently updated or purchased.'],
    ['inventory-dead-stock', 'Dead / Slow Stock Indicator', 'Items with stock but no recent sale movement.']
  ]);

  add('Customer Receivables', 'customers', [
    ['customer-all', 'All Customers', 'Customer profiles and balances.'],
    ['customer-receivable', 'Customers Receivable', 'Customers who owe money to the business.'],
    ['customer-top-due', 'Top Due Customers', 'Highest customer udhar balances.'],
    ['customer-zero-balance', 'Zero Balance Customers', 'Customers with no current udhar.'],
    ['customer-credit-limit', 'Credit Limit Watch', 'Customers near or above credit limits.'],
    ['customer-sales-history', 'Customer Sales History', 'Customer-wise sales value.'],
    ['customer-payment-history', 'Customer Payment History', 'Payments received from customers.'],
    ['customer-city-wise', 'City Wise Customers', 'Customers grouped by city.'],
    ['customer-shop-wise', 'Shop / Company Customers', 'Customers with shop/company details.'],
    ['customer-new', 'New Customers', 'Recently added customer records.']
  ]);

  add('Supplier Payables', 'suppliers', [
    ['supplier-all', 'All Suppliers', 'Supplier profiles and current payable.'],
    ['supplier-payable', 'Suppliers Payable', 'Suppliers whom business has to pay.'],
    ['supplier-top-payable', 'Top Payable Suppliers', 'Highest supplier payable balances.'],
    ['supplier-zero-balance', 'Zero Balance Suppliers', 'Suppliers with no current payable.'],
    ['supplier-purchase-history', 'Supplier Purchase History', 'Supplier-wise purchase records.'],
    ['supplier-payment-history', 'Supplier Payment History', 'Payments made to suppliers.'],
    ['supplier-discount', 'Supplier Discount Summary', 'Discounts received from suppliers.'],
    ['supplier-city-wise', 'City Wise Suppliers', 'Suppliers grouped by city.'],
    ['supplier-item-wise', 'Items Supplied By Supplier', 'Maal supplied with quantity details.'],
    ['supplier-new', 'New Suppliers', 'Recently added suppliers.']
  ]);

  add('Khata & Ledger', 'khata', [
    ['khata-all-parties', 'All Parties Khata', 'All buyers, sellers and both type parties.'],
    ['khata-receivable-payable', 'Receivable vs Payable', 'Complete business balance comparison.'],
    ['khata-opening-balance', 'Opening Balance Report', 'Party accounts created with opening balances.'],
    ['khata-payments-in', 'Payments Received', 'All customer payment-in records.'],
    ['khata-payments-out', 'Payments Paid', 'All supplier payment-out records.'],
    ['khata-adjustments', 'Adjustments & Reversals', 'Reversal and adjustment entries.'],
    ['khata-negative-balance', 'Payable Balance Parties', 'Parties showing negative balance.'],
    ['khata-positive-balance', 'Receivable Balance Parties', 'Parties showing positive balance.'],
    ['khata-high-risk', 'High Udhar Risk', 'Customers with large receivable balances.'],
    ['khata-net-position', 'Net Business Position', 'Receivable minus payable position.']
  ]);

  add('Payments & Cash Flow', 'payments', [
    ['payment-today', 'Today Payments', 'All payments received and paid today.', 'today'],
    ['payment-week', 'Last 7 Days Payments', 'Payment flow for last seven days.', 'week'],
    ['payment-month', 'Current Month Payments', 'Current month payment summary.', 'month'],
    ['payment-in', 'Payment In Report', 'Money received from customers.'],
    ['payment-out', 'Payment Out Report', 'Money paid to suppliers.'],
    ['payment-cash', 'Cash Method Report', 'Transactions made through cash.'],
    ['payment-bank', 'Bank Method Report', 'Transactions made through bank.'],
    ['payment-reference', 'Payment Reference Report', 'Payments with reference numbers.'],
    ['payment-proof', 'Payment Proof Report', 'Payments with proof images/attachments.'],
    ['payment-net-cash', 'Net Cash Flow', 'Payment in minus payment out.']
  ]);

  add('Profit & Margin', 'profit', [
    ['profit-today', 'Today Profit Estimate', 'Profit estimate from today sales.', 'today'],
    ['profit-week', 'Last 7 Days Profit', 'Profit estimate from last seven days.', 'week'],
    ['profit-month', 'Current Month Profit', 'Profit estimate from current month.', 'month'],
    ['profit-year', 'Current Year Profit', 'Year-to-date profit estimate.', 'year'],
    ['profit-item-wise', 'Item Wise Profit', 'Profit based on sale rate minus purchase rate.'],
    ['profit-customer-wise', 'Customer Wise Profit', 'Profit estimate by customer.'],
    ['profit-category-wise', 'Category Wise Profit', 'Profit estimate by inventory category.'],
    ['profit-low-margin', 'Low Margin Items', 'Items with weak sale margin.'],
    ['profit-high-margin', 'High Margin Items', 'Items with strongest margin.'],
    ['profit-potential-stock', 'Potential Stock Profit', 'Expected profit from unsold stock.']
  ]);

  add('Committee / Besi', 'committee', [
    ['committee-active', 'Active Committees', 'All currently active committee/BC groups.'],
    ['committee-completed', 'Completed Committees', 'Completed or archived committee records.'],
    ['committee-participants', 'Committee Participants', 'Participants across all committees.'],
    ['committee-collections', 'Committee Collections', 'Paid, partial and pending collection rows.'],
    ['committee-pending', 'Committee Pending Payments', 'Participants with pending committee installments.'],
    ['committee-paid', 'Committee Paid Participants', 'Paid committee collections.'],
    ['committee-winners', 'Committee Winners History', 'Winner history for all committees.'],
    ['committee-payouts', 'Committee Payouts', 'Winner payout records and status.'],
    ['committee-monthly', 'Committee Monthly History', 'Month-wise committee summary.'],
    ['committee-pool', 'Committee Pool Summary', 'Pool value, collected and pending values.']
  ]);

  return defs;
};

const reportDefinitions = buildReportDefinitions();

const getSettingsPaths = () => {
  const dataDir = path.join(process.cwd(), 'data');
  const backupDir = path.join(dataDir, 'backups');
  const settingsFile = path.join(dataDir, 'software-settings.json');
  const lastAutoFile = path.join(dataDir, '.last-auto-backup');
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return { dataDir, backupDir, settingsFile, lastAutoFile, dbPath };
};

const ensureDataFolders = () => {
  const { dataDir, backupDir } = getSettingsPaths();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
};

const defaultSoftwareSettings = {
  businessName: 'IQBAL JUTT TRADER',
  businessPhone: '0300-1234567',
  businessAddress: 'Main Yarn Market',
  city: 'Sanghar',
  currency: 'Rs',
  invoiceNote: 'Thank you for your business.',
  lowStockLevel: 10,
  autoBackupEnabled: true,
  backupTime: '23:30',
  allowDataReset: true,
  requireResetConfirmation: true
};

const readSoftwareSettings = () => {
  ensureDataFolders();
  const { settingsFile } = getSettingsPaths();
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSoftwareSettings, null, 2));
    return defaultSoftwareSettings;
  }
  try {
    return { ...defaultSoftwareSettings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
  } catch {
    return defaultSoftwareSettings;
  }
};

const writeSoftwareSettings = (settings: any) => {
  ensureDataFolders();
  const { settingsFile } = getSettingsPaths();
  const safe = { ...defaultSoftwareSettings, ...settings, businessName: fixedBrandName };
  fs.writeFileSync(settingsFile, JSON.stringify(safe, null, 2));
  return safe;
};

const createDatabaseBackup = (type: 'manual' | 'auto' | 'pre-reset' = 'manual') => {
  ensureDataFolders();
  const { backupDir, dbPath } = getSettingsPaths();
  if (!fs.existsSync(dbPath)) throw new Error('Database file not found');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${type}-backup-${stamp}.db`;
  const dest = path.join(backupDir, fileName);
  fs.copyFileSync(dbPath, dest);
  return {
    fileName,
    type,
    createdAt: new Date().toISOString(),
    sizeBytes: fs.statSync(dest).size
  };
};

const listBackups = () => {
  ensureDataFolders();
  const { backupDir } = getSettingsPaths();
  return fs.readdirSync(backupDir)
    .filter(name => name.endsWith('.db'))
    .map(name => {
      const filePath = path.join(backupDir, name);
      const stat = fs.statSync(filePath);
      return { fileName: name, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const createAutoBackupIfDue = () => {
  try {
    const settings = readSoftwareSettings();
    if (!settings.autoBackupEnabled) return;
    const { lastAutoFile } = getSettingsPaths();
    const today = new Date().toISOString().slice(0, 10);
    const last = fs.existsSync(lastAutoFile) ? fs.readFileSync(lastAutoFile, 'utf8').trim() : '';
    if (last !== today) {
      createDatabaseBackup('auto');
      fs.writeFileSync(lastAutoFile, today);
      console.log('Daily automatic backup completed.');
    }
  } catch (err) {
    console.error('Auto backup failed:', err);
  }
};

createAutoBackupIfDue();
setInterval(createAutoBackupIfDue, 60 * 60 * 1000);

app.get('/api/dashboard/advanced', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [parties, inventory, todaySales, monthSales, purchases, transactions, activeCommittees, pendingCollections] = await Promise.all([
      prisma.party.findMany({ where: { status: 'ACTIVE' } }),
      prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: today } }, include: { Items: { include: { inventoryItem: true } }, party: true } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: monthStart } }, include: { Items: { include: { inventoryItem: true } }, party: true } }),
      prisma.purchase.findMany({ include: { items: true, party: true } }),
      prisma.transaction.findMany({ include: { party: true } }),
      prisma.committee.count({ where: { status: 'ACTIVE' } }),
      prisma.committeeCollection.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } })
    ]);

    const receivable = parties.filter(p => p.outstanding > 0).reduce((a, p) => a + p.outstanding, 0);
    const payable = parties.filter(p => p.outstanding < 0).reduce((a, p) => a + Math.abs(p.outstanding), 0);
    const inventoryValue = inventory.reduce((a, i) => a + i.quantity * i.purchaseRate, 0);
    const potentialProfit = inventory.reduce((a, i) => a + i.quantity * (i.sellingPrice - i.purchaseRate), 0);
    const totalStockKg = inventory.filter(i => String(i.unit).toLowerCase().includes('kg')).reduce((a, i) => a + i.quantity, 0);
    const lowStock = inventory.filter(i => i.quantity <= i.reorderLevel).length;
    const outStock = inventory.filter(i => i.quantity <= 0).length;
    const todaySaleValue = todaySales.reduce((a, s) => a + s.amount, 0);
    const monthSaleValue = monthSales.reduce((a, s) => a + s.amount, 0);
    const todayReceived = transactions.filter(t => t.type === 'PAYMENT_IN' && t.date >= today).reduce((a, t) => a + t.amount, 0);
    const todayPaidOut = transactions.filter(t => t.type === 'PAYMENT_OUT' && t.date >= today).reduce((a, t) => a + t.amount, 0);
    const monthPurchaseValue = purchases.filter(p => p.purchaseDate >= monthStart).reduce((a, p) => a + p.totalAmount, 0);
    const totalPurchaseValue = purchases.reduce((a, p) => a + p.totalAmount, 0);
    const profitToday = todaySales.reduce((acc, sale) => acc + sale.Items.reduce((s, item) => s + (item.total - (item.inventoryItem?.purchaseRate || 0) * item.quantity), 0), 0);
    const profitMonth = monthSales.reduce((acc, sale) => acc + sale.Items.reduce((s, item) => s + (item.total - (item.inventoryItem?.purchaseRate || 0) * item.quantity), 0), 0);

    const topCustomers = parties.filter(p => p.outstanding > 0).sort((a,b) => b.outstanding - a.outstanding).slice(0, 5);
    const topSuppliers = parties.filter(p => p.outstanding < 0).sort((a,b) => Math.abs(b.outstanding) - Math.abs(a.outstanding)).slice(0, 5);
    const lowStockItems = inventory.filter(i => i.quantity <= i.reorderLevel).sort((a,b) => a.quantity - b.quantity).slice(0, 8);

    res.json({
      cards: [
        { title: 'Today Sales', value: todaySaleValue, type: 'money', note: 'POS sale value today' },
        { title: 'Today Cash/Jama', value: todayReceived, type: 'money', note: 'Payments received today' },
        { title: 'Today Paid Out', value: todayPaidOut, type: 'money', note: 'Supplier payments today' },
        { title: 'Today Profit', value: profitToday, type: 'money', note: 'Estimated profit from today sales' },
        { title: 'Month Sales', value: monthSaleValue, type: 'money', note: 'Current month sales' },
        { title: 'Month Purchases', value: monthPurchaseValue, type: 'money', note: 'Current month purchases' },
        { title: 'Month Profit', value: profitMonth, type: 'money', note: 'Estimated current month profit' },
        { title: 'Total Purchase Value', value: totalPurchaseValue, type: 'money', note: 'All purchase records' },
        { title: 'Customer Receivable', value: receivable, type: 'money', note: 'Customers ka udhar' },
        { title: 'Supplier Payable', value: payable, type: 'money', note: 'Suppliers ko dena hai' },
        { title: 'Net Khata Position', value: receivable - payable, type: 'money', note: 'Receivable minus payable' },
        { title: 'Inventory Valuation', value: inventoryValue, type: 'money', note: 'Current stock cost value' },
        { title: 'Potential Stock Profit', value: potentialProfit, type: 'money', note: 'Expected profit on current stock' },
        { title: 'Total Stock KG', value: totalStockKg, type: 'number', note: 'Available KG stock' },
        { title: 'Active Items', value: inventory.length, type: 'number', note: 'Sellable inventory variants' },
        { title: 'Low Stock Items', value: lowStock, type: 'number', note: 'Need reorder' },
        { title: 'Out of Stock', value: outStock, type: 'number', note: 'Zero stock items' },
        { title: 'Total Parties', value: parties.length, type: 'number', note: 'Customers and suppliers' },
        { title: 'Active Committees', value: activeCommittees, type: 'number', note: 'Ongoing Besi/BC' },
        { title: 'Committee Pending', value: pendingCollections, type: 'number', note: 'Pending/partial installments' }
      ],
      topCustomers,
      topSuppliers,
      lowStockItems,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch advanced dashboard', details: error?.message || String(error) });
  }
});

app.get('/api/reports/catalog', (req, res) => {
  const grouped = reportDefinitions.reduce((acc: any, report) => {
    acc[report.category] = acc[report.category] || [];
    acc[report.category].push(report);
    return acc;
  }, {});
  res.json({ totalReports: reportDefinitions.length, categories: grouped, reports: reportDefinitions });
});

app.get('/api/reports/run/:key', async (req, res) => {
  try {
    const report = reportDefinitions.find(r => r.key === req.params.key);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const start = getPeriodStart(report.period);
    let rows: any[] = [];
    let summary: any[] = [];

    if (report.source === 'sales') {
      const sales = await prisma.transaction.findMany({
        where: { type: 'SALE', ...(start ? { date: { gte: start } } : {}) },
        include: { party: true, Items: { include: { inventoryItem: true } } },
        orderBy: { date: 'desc' }
      });
      rows = sales.map(s => {
        const profit = s.Items.reduce((a, i) => a + (i.total - (i.inventoryItem?.purchaseRate || 0) * i.quantity), 0);
        return {
          date: s.date,
          invoice: s.invoiceId || `INV-${String(s.id).padStart(6, '0')}`,
          customer: s.party?.name || 'Walk-in',
          phone: s.party?.phone || '-',
          items: s.Items.length,
          quantity: s.Items.reduce((a, i) => a + i.quantity, 0),
          total: s.amount,
          paid: s.amountPaid || 0,
          udhar: Math.max(0, s.amount - (s.amountPaid || 0)),
          profit
        };
      });
      if (report.key.includes('udhar')) rows = rows.filter(r => r.udhar > 0);
      if (report.key.includes('cash')) rows = rows.filter(r => r.paid > 0);
      if (report.key.includes('top')) rows = rows.sort((a,b) => b.total - a.total).slice(0, 25);
      summary = [
        { label: 'Invoices', value: rows.length },
        { label: 'Sale Value', value: sum(rows, r => r.total), type: 'money' },
        { label: 'Paid', value: sum(rows, r => r.paid), type: 'money' },
        { label: 'Udhar', value: sum(rows, r => r.udhar), type: 'money' },
        { label: 'Profit', value: sum(rows, r => r.profit), type: 'money' }
      ];
    }

    if (report.source === 'purchases') {
      const purchases = await prisma.purchase.findMany({
        where: start ? { purchaseDate: { gte: start } } : {},
        include: { party: true, items: { include: { inventoryItem: true } } },
        orderBy: { purchaseDate: 'desc' }
      });
      rows = purchases.map(p => ({
        date: p.purchaseDate,
        purchaseId: p.purchaseId || p.billNumber || p.id,
        supplier: p.party?.name || '-',
        phone: p.party?.phone || '-',
        items: p.items.length,
        quantity: p.items.reduce((a, i) => a + i.quantity, 0),
        discount: p.totalDiscount,
        total: p.totalAmount,
        paid: p.amountPaid,
        payable: p.balanceDue,
        status: p.paymentStatus || p.status
      }));
      if (report.key.includes('unpaid')) rows = rows.filter(r => r.payable > 0);
      if (report.key.includes('paid')) rows = rows.filter(r => r.payable <= 0);
      if (report.key.includes('top')) rows = rows.sort((a,b) => b.total - a.total).slice(0, 25);
      summary = [
        { label: 'Purchase Bills', value: rows.length },
        { label: 'Purchase Value', value: sum(rows, r => r.total), type: 'money' },
        { label: 'Paid', value: sum(rows, r => r.paid), type: 'money' },
        { label: 'Payable', value: sum(rows, r => r.payable), type: 'money' },
        { label: 'Discount', value: sum(rows, r => r.discount), type: 'money' }
      ];
    }

    if (report.source === 'inventory') {
      const items = await prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' } });
      rows = items.map(i => ({
        item: i.variant,
        category: i.category,
        lot: i.lotNumber || '-',
        mill: i.millName || '-',
        stock: i.quantity,
        unit: i.unit,
        purchaseRate: i.purchaseRate,
        saleRate: i.sellingPrice,
        margin: i.sellingPrice - i.purchaseRate,
        valuation: i.quantity * i.purchaseRate,
        potentialProfit: i.quantity * (i.sellingPrice - i.purchaseRate),
        supplier: i.supplierName || '-',
        lastPurchaseId: i.lastPurchaseId || '-',
        reorderLevel: i.reorderLevel
      }));
      if (report.key.includes('low-stock')) rows = rows.filter(r => r.stock <= r.reorderLevel);
      if (report.key.includes('out-stock')) rows = rows.filter(r => r.stock <= 0);
      if (report.key.includes('valuation')) rows = rows.sort((a,b) => b.valuation - a.valuation);
      if (report.key.includes('profit')) rows = rows.sort((a,b) => b.potentialProfit - a.potentialProfit);
      if (report.key.includes('margin')) rows = rows.sort((a,b) => b.margin - a.margin);
      summary = [
        { label: 'Items', value: rows.length },
        { label: 'Total Stock', value: sum(rows, r => r.stock) },
        { label: 'Valuation', value: sum(rows, r => r.valuation), type: 'money' },
        { label: 'Potential Profit', value: sum(rows, r => r.potentialProfit), type: 'money' },
        { label: 'Low Stock', value: rows.filter(r => r.stock <= r.reorderLevel).length }
      ];
    }

    if (['customers', 'suppliers', 'khata'].includes(report.source)) {
      const parties = await prisma.party.findMany({ where: { status: 'ACTIVE' }, orderBy: { outstanding: 'desc' } });
      rows = parties.map(p => ({
        name: p.name,
        type: p.type,
        phone: p.phone || '-',
        shop: p.shopName || '-',
        city: p.city || '-',
        openingBalance: p.openingBalance,
        receivable: p.outstanding > 0 ? p.outstanding : 0,
        payable: p.outstanding < 0 ? Math.abs(p.outstanding) : 0,
        netBalance: p.outstanding,
        createdAt: p.createdAt
      }));
      if (report.source === 'customers') rows = rows.filter(r => r.type === 'BUYER' || r.type === 'BOTH');
      if (report.source === 'suppliers') rows = rows.filter(r => r.type === 'SELLER' || r.type === 'BOTH');
      if (report.key.includes('receivable') || report.key.includes('top-due') || report.key.includes('positive')) rows = rows.filter(r => r.receivable > 0);
      if (report.key.includes('payable') || report.key.includes('top-payable') || report.key.includes('negative')) rows = rows.filter(r => r.payable > 0);
      if (report.key.includes('zero-balance')) rows = rows.filter(r => r.receivable === 0 && r.payable === 0);
      if (report.key.includes('top')) rows = rows.sort((a,b) => (b.receivable + b.payable) - (a.receivable + a.payable)).slice(0, 25);
      summary = [
        { label: 'Parties', value: rows.length },
        { label: 'Receivable', value: sum(rows, r => r.receivable), type: 'money' },
        { label: 'Payable', value: sum(rows, r => r.payable), type: 'money' },
        { label: 'Net Position', value: sum(rows, r => r.netBalance), type: 'money' }
      ];
    }

    if (report.source === 'payments') {
      const transactions = await prisma.transaction.findMany({
        where: { type: { in: ['PAYMENT_IN', 'PAYMENT_OUT'] }, ...(start ? { date: { gte: start } } : {}) },
        include: { party: true },
        orderBy: { date: 'desc' }
      });
      rows = transactions.map(t => ({
        date: t.date,
        type: t.type === 'PAYMENT_IN' ? 'Received' : 'Paid Out',
        party: t.party?.name || '-',
        phone: t.party?.phone || '-',
        method: t.paymentMethod || '-',
        reference: t.referenceNumber || '-',
        amount: t.amount,
        description: t.description || '-'
      }));
      if (report.key.includes('payment-in')) rows = rows.filter(r => r.type === 'Received');
      if (report.key.includes('payment-out')) rows = rows.filter(r => r.type === 'Paid Out');
      if (report.key.includes('cash')) rows = rows.filter(r => String(r.method).toLowerCase().includes('cash'));
      if (report.key.includes('bank')) rows = rows.filter(r => String(r.method).toLowerCase().includes('bank'));
      summary = [
        { label: 'Payments', value: rows.length },
        { label: 'Received', value: sum(rows.filter(r => r.type === 'Received'), r => r.amount), type: 'money' },
        { label: 'Paid Out', value: sum(rows.filter(r => r.type === 'Paid Out'), r => r.amount), type: 'money' },
        { label: 'Net Cash', value: sum(rows, r => r.type === 'Received' ? r.amount : -r.amount), type: 'money' }
      ];
    }

    if (report.source === 'profit') {
      const sales = await prisma.transaction.findMany({
        where: { type: 'SALE', ...(start ? { date: { gte: start } } : {}) },
        include: { party: true, Items: { include: { inventoryItem: true } } },
        orderBy: { date: 'desc' }
      });
      rows = sales.flatMap(s => s.Items.map(i => ({
        date: s.date,
        invoice: s.invoiceId || s.id,
        customer: s.party?.name || '-',
        item: i.inventoryItem?.variant || '-',
        category: i.inventoryItem?.category || '-',
        quantity: i.quantity,
        saleRate: i.rate,
        purchaseRate: i.inventoryItem?.purchaseRate || 0,
        total: i.total,
        profit: i.total - (i.inventoryItem?.purchaseRate || 0) * i.quantity,
        marginPercent: i.total ? ((i.total - (i.inventoryItem?.purchaseRate || 0) * i.quantity) / i.total) * 100 : 0
      })));
      if (report.key.includes('low-margin')) rows = rows.filter(r => r.marginPercent < 10);
      if (report.key.includes('high-margin')) rows = rows.filter(r => r.marginPercent >= 20);
      summary = [
        { label: 'Sale Lines', value: rows.length },
        { label: 'Sales', value: sum(rows, r => r.total), type: 'money' },
        { label: 'Profit', value: sum(rows, r => r.profit), type: 'money' },
        { label: 'Avg Margin %', value: rows.length ? (sum(rows, r => r.marginPercent) / rows.length) : 0 }
      ];
    }

    if (report.source === 'committee') {
      const committees = await prisma.committee.findMany({
        include: { participants: true, months: { include: { collections: true, winners: { include: { participant: true, payout: true } } } } },
        orderBy: { createdAt: 'desc' }
      });
      rows = committees.map(c => {
        const collections = c.months.flatMap(m => m.collections);
        const winners = c.months.flatMap(m => m.winners);
        return {
          committee: c.name,
          status: c.status,
          participants: c.participants.length,
          installment: c.installmentAmount,
          totalPool: c.totalPool,
          collected: collections.reduce((a, col) => a + col.paidAmount, 0),
          pending: collections.reduce((a, col) => a + col.remainingAmount, 0),
          winners: winners.length,
          startDate: c.startDate,
          endDate: c.endDate || '-'
        };
      });
      if (report.key.includes('active')) rows = rows.filter(r => r.status === 'ACTIVE');
      if (report.key.includes('completed')) rows = rows.filter(r => r.status !== 'ACTIVE');
      summary = [
        { label: 'Committees', value: rows.length },
        { label: 'Total Pool', value: sum(rows, r => r.totalPool), type: 'money' },
        { label: 'Collected', value: sum(rows, r => r.collected), type: 'money' },
        { label: 'Pending', value: sum(rows, r => r.pending), type: 'money' }
      ];
    }

    res.json({ report, summary, rows, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to run report', details: error?.message || String(error) });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = readSoftwareSettings();
    const backups = listBackups();
    const [inventoryCount, partyCount, salesCount, purchaseCount, committeeCount] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.party.count(),
      prisma.transaction.count({ where: { type: 'SALE' } }),
      prisma.purchase.count(),
      prisma.committee.count()
    ]);
    res.json({
      settings,
      backup: {
        autoBackupEnabled: settings.autoBackupEnabled,
        backupTime: settings.backupTime,
        totalBackups: backups.length,
        lastBackup: backups[0] || null,
        backups
      },
      system: { inventoryCount, partyCount, salesCount, purchaseCount, committeeCount }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch settings', details: error?.message || String(error) });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const saved = writeSoftwareSettings(req.body || {});
    res.json({ success: true, settings: saved });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save settings', details: error?.message || String(error) });
  }
});

app.get('/api/settings/backups', (req, res) => {
  try {
    res.json({ backups: listBackups() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups', details: error?.message || String(error) });
  }
});

app.post('/api/settings/backup/manual', (req, res) => {
  try {
    const backup = createDatabaseBackup('manual');
    res.json({ success: true, message: 'Manual backup created successfully', backup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create manual backup', details: error?.message || String(error) });
  }
});

app.post('/api/settings/reset-all', async (req, res) => {
  try {
    const confirmText = String(req.body?.confirm || '');
    if (confirmText !== 'RESET IQBAL JUTT') {
      return res.status(400).json({ error: 'Invalid confirmation text' });
    }
    const backup = createDatabaseBackup('pre-reset');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('DELETE FROM Expense').catch(() => {});
      await tx.$executeRawUnsafe('DELETE FROM QuotationItem').catch(() => {});
      await tx.$executeRawUnsafe('DELETE FROM Quotation').catch(() => {});
      await tx.$executeRawUnsafe('DELETE FROM StaffSalaryPayment').catch(() => {});
      await tx.committeeAuditLog.deleteMany();
      await tx.committeePayout.deleteMany();
      await tx.committeeWinner.deleteMany();
      await tx.committeeCollection.deleteMany();
      await tx.committeeMonth.deleteMany();
      await tx.committeeParticipant.deleteMany();
      await tx.committee.deleteMany();
      await tx.transactionItem.deleteMany();
      await tx.transaction.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.purchase.deleteMany();
      await tx.inventoryItem.deleteMany();
      await tx.party.deleteMany();
    });
    try {
      await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name IN ('InventoryItem','Party','Transaction','TransactionItem','Purchase','PurchaseItem','Committee','CommitteeParticipant','CommitteeMonth','CommitteeCollection','CommitteeWinner','CommitteePayout','CommitteeAuditLog','Expense','Quotation','QuotationItem','StaffSalaryPayment')");
    } catch {}
    res.json({ success: true, message: 'All business data has been reset. A pre-reset backup was created first.', backup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reset data', details: error?.message || String(error) });
  }
});

app.get('/api/reports/khata', async (req, res) => {
  try {
    const allParties = await prisma.party.findMany();
    
    let totalReceivable = 0;
    let totalPayable = 0;
    
    const customersReceivable: any[] = [];
    const suppliersPayable: any[] = [];
    
    allParties.forEach(party => {
      if (party.outstanding > 0) {
        totalReceivable += party.outstanding;
        if (party.type === 'BUYER' || party.type === 'BOTH') {
          customersReceivable.push(party);
        }
      } else if (party.outstanding < 0) {
        totalPayable += Math.abs(party.outstanding);
        if (party.type === 'SELLER' || party.type === 'BOTH') {
          suppliersPayable.push(party);
        }
      }
    });

    // Sort to get top
    customersReceivable.sort((a, b) => b.outstanding - a.outstanding);
    suppliersPayable.sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding));

    const netBusinessBalance = totalReceivable - totalPayable;
    
    res.json({
      totalReceivable,
      totalPayable,
      netBusinessBalance,
      topCustomers: customersReceivable.slice(0, 5),
      topSuppliers: suppliersPayable.slice(0, 5)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch khata reports', details: error?.message || String(error) });
  }
});


// -- Extra ERP APIs: Urdu Guides, Expenses, Quotations, General Ledger, Security & Staff --
const q = (value: any) => String(value ?? '').trim();
const num = (value: any) => Number(value || 0);

const toSqlDate = (value?: any) => {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

const getDateWhere = (startDate?: any, endDate?: any) => {
  const start = toSqlDate(startDate);
  const endRaw = toSqlDate(endDate);
  const end = endRaw ? new Date(endRaw) : null;
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
};

const whereDateSql = (column: string, start?: Date | null, end?: Date | null) => {
  const clauses: string[] = [];
  const params: any[] = [];
  if (start) { clauses.push(`${column} >= ?`); params.push(start.toISOString()); }
  if (end) { clauses.push(`${column} <= ?`); params.push(end.toISOString()); }
  return { clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

const ensureExtraTables = async () => {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS Expense (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    amount REAL NOT NULL DEFAULT 0,
    expenseDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paymentMethod TEXT DEFAULT 'CASH',
    paidTo TEXT,
    phone TEXT,
    referenceNumber TEXT,
    notes TEXT,
    proofImage TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS Quotation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotationId TEXT UNIQUE NOT NULL,
    supplierId INTEGER,
    supplierName TEXT,
    supplierPhone TEXT,
    validUntil DATETIME,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    totalAmount REAL NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS QuotationItem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotationRowId INTEGER NOT NULL,
    inventoryItemId INTEGER,
    itemName TEXT NOT NULL,
    category TEXT,
    lotNumber TEXT,
    millName TEXT,
    quality TEXT,
    unit TEXT DEFAULT 'Kg',
    quantity REAL NOT NULL DEFAULT 0,
    expectedRate REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY(quotationRowId) REFERENCES Quotation(id) ON DELETE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS StaffProfile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    cnic TEXT,
    salary REAL NOT NULL DEFAULT 0,
    profileImage TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'STAFF',
    pin TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS StaffSalaryPayment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staffId INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    salaryMonth TEXT,
    paymentDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paymentMethod TEXT DEFAULT 'CASH',
    notes TEXT,
    FOREIGN KEY(staffId) REFERENCES StaffProfile(id) ON DELETE CASCADE
  )`);
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const admin = await prisma.user.create({ data: { username: 'admin', password: 'admin', role: 'ADMIN' } });
    await prisma.$executeRawUnsafe(`INSERT INTO StaffProfile (userId, name, phone, cnic, salary, role, pin, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      admin.id, 'Administrator', '', '', 0, 'ADMIN', '1234', JSON.stringify(['ALL']), 'ACTIVE'
    );
  }
};
ensureExtraTables().catch(err => console.error('Extra table setup failed:', err));

const fixedBrandName = 'IQBAL JUTT TRADER';

app.get('/api/auth/status', async (_req, res) => {
  try {
    await ensureExtraTables();
    const users = await prisma.user.count();
    res.json({ success: true, loginEnabled: true, users, brandName: fixedBrandName });
  } catch (error) {
    res.status(500).json({ error: 'Auth status failed', details: error?.message || String(error) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureExtraTables();
    const { username, password, pin } = req.body || {};
    const user = await prisma.user.findFirst({
      where: { username: q(username), ...(password ? { password: q(password) } : {}) }
    });
    if (!user) return res.status(401).json({ error: 'Invalid username/password' });
    const profileRows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM StaffProfile WHERE userId = ? LIMIT 1`, user.id);
    const profile = profileRows[0] || null;
    if (profile?.status && profile.status !== 'ACTIVE') return res.status(403).json({ error: 'User is inactive' });
    if (profile?.pin && pin && q(pin) !== String(profile.pin)) return res.status(401).json({ error: 'Invalid PIN' });
    let permissions: any[] = [];
    try { permissions = profile?.permissions ? JSON.parse(profile.permissions) : []; } catch {}
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: profile?.name || user.username,
        phone: profile?.phone || '',
        permissions: user.role === 'ADMIN' ? ['ALL'] : permissions
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed', details: error?.message || String(error) });
  }
});

app.post('/api/auth/update-admin', async (req, res) => {
  try {
    await ensureExtraTables();
    const { username, password, pin } = req.body || {};
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } });
    if (!admin) return res.status(404).json({ error: 'Admin user not found' });
    const data: any = {};
    if (q(username)) data.username = q(username);
    if (q(password)) data.password = q(password);
    const updated = Object.keys(data).length ? await prisma.user.update({ where: { id: admin.id }, data }) : admin;
    if (q(pin)) await prisma.$executeRawUnsafe(`UPDATE StaffProfile SET pin = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?`, q(pin), updated.id);
    res.json({ success: true, message: 'Login settings updated', user: { id: updated.id, username: updated.username, role: updated.role } });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update login settings' });
  }
});

app.get('/api/dashboard/detailed', async (req, res) => {
  try {
    await ensureExtraTables();
    const { startDate, endDate } = req.query;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = toSqlDate(startDate) || today;
    const end = toSqlDate(endDate) || new Date();
    end.setHours(23, 59, 59, 999);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [parties, inventory, rangeSales, todaySales, weekSales, monthSales, rangePurchases, monthPurchases, transactions, activeCommittees, pendingCollections] = await Promise.all([
      prisma.party.findMany({ where: { status: 'ACTIVE' } }),
      prisma.inventoryItem.findMany({ where: { status: 'ACTIVE' } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: start, lte: end } }, include: { party: true, Items: { include: { inventoryItem: true } } } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: today } }, include: { Items: { include: { inventoryItem: true } } } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: weekStart } }, include: { Items: { include: { inventoryItem: true } } } }),
      prisma.transaction.findMany({ where: { type: 'SALE', date: { gte: monthStart } }, include: { Items: { include: { inventoryItem: true } } } }),
      prisma.purchase.findMany({ where: { purchaseDate: { gte: start, lte: end } }, include: { party: true, items: true } }),
      prisma.purchase.findMany({ where: { purchaseDate: { gte: monthStart } }, include: { items: true } }),
      prisma.transaction.findMany({ where: { date: { gte: start, lte: end } }, include: { party: true } }),
      prisma.committee.count({ where: { status: 'ACTIVE' } }),
      prisma.committeeCollection.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } })
    ]);
    const expenses: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense WHERE expenseDate >= ? AND expenseDate <= ? ORDER BY expenseDate DESC`, start.toISOString(), end.toISOString());
    const salaryPayments: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM StaffSalaryPayment WHERE paymentDate >= ? AND paymentDate <= ? ORDER BY paymentDate DESC`, start.toISOString(), end.toISOString());

    const calcProfit = (sales: any[]) => sales.reduce((acc, sale) => acc + sale.Items.reduce((sum: number, item: any) => sum + (Number(item.total || 0) - Number(item.inventoryItem?.purchaseRate || 0) * Number(item.quantity || 0)), 0), 0);
    const saleTotal = (sales: any[]) => sales.reduce((a, s) => a + Number(s.amount || 0), 0);
    const received = transactions.filter(t => t.type === 'PAYMENT_IN').reduce((a, t) => a + t.amount, 0);
    const paidOut = transactions.filter(t => t.type === 'PAYMENT_OUT').reduce((a, t) => a + t.amount, 0);
    const expenseTotal = expenses.reduce((a, e) => a + Number(e.amount || 0), 0) + salaryPayments.reduce((a, s) => a + Number(s.amount || 0), 0);
    const receivable = parties.filter(p => p.outstanding > 0).reduce((a, p) => a + p.outstanding, 0);
    const payable = parties.filter(p => p.outstanding < 0).reduce((a, p) => a + Math.abs(p.outstanding), 0);
    const inventoryValue = inventory.reduce((a, i) => a + i.quantity * i.purchaseRate, 0);
    const potentialProfit = inventory.reduce((a, i) => a + i.quantity * (i.sellingPrice - i.purchaseRate), 0);
    const totalStockKg = inventory.filter(i => String(i.unit).toLowerCase().includes('kg')).reduce((a, i) => a + i.quantity, 0);
    const lowStockItems = inventory.filter(i => i.quantity <= i.reorderLevel);
    const outStock = inventory.filter(i => i.quantity <= 0);

    res.json({
      success: true,
      range: { startDate: start.toISOString(), endDate: end.toISOString() },
      cards: {
        todaySales: saleTotal(todaySales), todayProfit: calcProfit(todaySales),
        weekSales: saleTotal(weekSales), monthSales: saleTotal(monthSales), monthPurchases: monthPurchases.reduce((a,p)=>a+p.totalAmount,0),
        rangeSales: saleTotal(rangeSales), rangeProfit: calcProfit(rangeSales), rangePurchases: rangePurchases.reduce((a,p)=>a+p.totalAmount,0),
        cashReceived: received, cashPaidOut: paidOut, expenses: expenseTotal, netProfit: calcProfit(rangeSales) - expenseTotal,
        receivable, payable, netKhata: receivable - payable,
        inventoryValue, potentialProfit, totalStockKg, totalItems: inventory.length, lowStockCount: lowStockItems.length, outStockCount: outStock.length,
        activeCommittees, pendingCommitteeInstallments: pendingCollections
      },
      lists: {
        topCustomers: parties.filter(p => p.outstanding > 0).sort((a,b)=>b.outstanding-a.outstanding).slice(0, 8),
        topSuppliers: parties.filter(p => p.outstanding < 0).sort((a,b)=>Math.abs(b.outstanding)-Math.abs(a.outstanding)).slice(0, 8),
        lowStockItems: lowStockItems.slice(0, 8),
        recentSales: rangeSales.slice(0, 10),
        recentPurchases: rangePurchases.slice(0, 10),
        recentExpenses: expenses.slice(0, 10)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch detailed dashboard', details: error?.message || String(error) });
  }
});

// Expenses
app.get('/api/expenses', async (req, res) => {
  try {
    await ensureExtraTables();
    const { search, startDate, endDate } = req.query;
    const { start, end } = getDateWhere(startDate, endDate);
    const wh = whereDateSql('expenseDate', start, end);
    let rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense ${wh.clause} ORDER BY expenseDate DESC, id DESC`, ...wh.params);
    const s = normalizeText(search);
    if (s) rows = rows.filter(r => normalizeText([r.title, r.category, r.paidTo, r.phone, r.referenceNumber, r.notes].join(' ')).includes(s));
    const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
    res.json({ success: true, rows, summary: { count: rows.length, total } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch expenses', details: error?.message || String(error) }); }
});
app.get('/api/expenses/:id', async (req, res) => {
  try { const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense WHERE id = ?`, Number(req.params.id)); res.json(rows[0] || null); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch expense', details: error?.message || String(error) }); }
});
app.post('/api/expenses', async (req, res) => {
  try {
    await ensureExtraTables();
    const d = req.body || {};
    await prisma.$executeRawUnsafe(`INSERT INTO Expense (title, category, amount, expenseDate, paymentMethod, paidTo, phone, referenceNumber, notes, proofImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      q(d.title), q(d.category) || 'General', num(d.amount), (toSqlDate(d.expenseDate) || new Date()).toISOString(), q(d.paymentMethod) || 'CASH', q(d.paidTo), q(d.phone), q(d.referenceNumber), q(d.notes), d.proofImage || null);
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense ORDER BY id DESC LIMIT 1`);
    res.json({ success: true, expense: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to create expense', details: error?.message || String(error) }); }
});
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const d = req.body || {};
    await prisma.$executeRawUnsafe(`UPDATE Expense SET title=?, category=?, amount=?, expenseDate=?, paymentMethod=?, paidTo=?, phone=?, referenceNumber=?, notes=?, proofImage=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      q(d.title), q(d.category) || 'General', num(d.amount), (toSqlDate(d.expenseDate) || new Date()).toISOString(), q(d.paymentMethod) || 'CASH', q(d.paidTo), q(d.phone), q(d.referenceNumber), q(d.notes), d.proofImage || null, Number(req.params.id));
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense WHERE id=?`, Number(req.params.id));
    res.json({ success: true, expense: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to update expense', details: error?.message || String(error) }); }
});
app.delete('/api/expenses/:id', async (req, res) => {
  try { await prisma.$executeRawUnsafe(`DELETE FROM Expense WHERE id=?`, Number(req.params.id)); res.json({ success: true, message: 'Expense deleted' }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete expense', details: error?.message || String(error) }); }
});

// Supplier quotations
app.get('/api/quotations', async (_req, res) => {
  try { await ensureExtraTables(); const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Quotation ORDER BY createdAt DESC, id DESC`); res.json({ success: true, rows }); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch quotations', details: error?.message || String(error) }); }
});
app.get('/api/quotations/:id', async (req, res) => {
  try { const quotes: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Quotation WHERE id=?`, Number(req.params.id)); const items: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM QuotationItem WHERE quotationRowId=?`, Number(req.params.id)); res.json({ success: true, quotation: quotes[0] || null, items }); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch quotation', details: error?.message || String(error) }); }
});
app.post('/api/quotations', async (req, res) => {
  try {
    await ensureExtraTables();
    const d = req.body || {}; const items = Array.isArray(d.items) ? d.items : [];
    const year = new Date().getFullYear();
    const countRows: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM Quotation WHERE quotationId LIKE ?`, `QUO-${year}-%`);
    const quotationId = `QUO-${year}-${String(Number(countRows[0]?.c || 0) + 1).padStart(4, '0')}`;
    const totalAmount = items.reduce((a: number, i: any) => a + num(i.total || (num(i.quantity) * num(i.expectedRate))), 0);
    await prisma.$executeRawUnsafe(`INSERT INTO Quotation (quotationId, supplierId, supplierName, supplierPhone, validUntil, status, notes, totalAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      quotationId, d.supplierId ? Number(d.supplierId) : null, q(d.supplierName), q(d.supplierPhone), d.validUntil ? new Date(d.validUntil).toISOString() : null, q(d.status) || 'DRAFT', q(d.notes), totalAmount);
    const quoteRows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Quotation WHERE quotationId=?`, quotationId);
    const quote = quoteRows[0];
    for (const i of items) {
      const total = num(i.total || (num(i.quantity) * num(i.expectedRate)));
      await prisma.$executeRawUnsafe(`INSERT INTO QuotationItem (quotationRowId, inventoryItemId, itemName, category, lotNumber, millName, quality, unit, quantity, expectedRate, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        quote.id, i.inventoryItemId ? Number(i.inventoryItemId) : null, q(i.itemName), q(i.category), q(i.lotNumber), q(i.millName), q(i.quality), q(i.unit) || 'Kg', num(i.quantity), num(i.expectedRate), total, q(i.notes));
    }
    res.json({ success: true, quotation: quote });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to create quotation', details: error?.message || String(error) }); }
});
app.delete('/api/quotations/:id', async (req, res) => {
  try { await prisma.$executeRawUnsafe(`DELETE FROM QuotationItem WHERE quotationRowId=?`, Number(req.params.id)); await prisma.$executeRawUnsafe(`DELETE FROM Quotation WHERE id=?`, Number(req.params.id)); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete quotation', details: error?.message || String(error) }); }
});

// General Ledger
app.get('/api/general-ledger', async (req, res) => {
  try {
    await ensureExtraTables();
    const { startDate, endDate } = req.query; const { start, end } = getDateWhere(startDate, endDate);
    const txWhere: any = {}; if (start || end) txWhere.date = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    const transactions = await prisma.transaction.findMany({ where: txWhere, include: { party: true, Items: { include: { inventoryItem: true } } }, orderBy: { date: 'asc' } });
    const wh = whereDateSql('expenseDate', start, end);
    const expenses: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Expense ${wh.clause}`, ...wh.params);
    const salaryWh = whereDateSql('paymentDate', start, end);
    const salaries: any[] = await prisma.$queryRawUnsafe(`SELECT s.*, st.name AS staffName FROM StaffSalaryPayment s LEFT JOIN StaffProfile st ON st.id=s.staffId ${salaryWh.clause}`, ...salaryWh.params);
    const entries: any[] = [];
    transactions.forEach(t => {
      const debit = ['SALE', 'PAYMENT_OUT', 'OPENING_BALANCE'].includes(t.type) ? t.amount : 0;
      const credit = ['PURCHASE', 'PAYMENT_IN'].includes(t.type) ? t.amount : 0;
      entries.push({ date: t.date, module: t.type === 'SALE' ? 'Sales' : t.type === 'PURCHASE' ? 'Purchases' : 'Khata/Payment', reference: t.invoiceId || t.referenceNumber || t.id, party: t.party?.name || '-', description: t.description || t.type, debit, credit, amount: t.amount, detail: t });
    });
    expenses.forEach(e => entries.push({ date: e.expenseDate, module: 'Expenses', reference: e.referenceNumber || e.id, party: e.paidTo || '-', description: e.title, debit: Number(e.amount||0), credit: 0, amount: Number(e.amount||0), detail: e }));
    salaries.forEach(s => entries.push({ date: s.paymentDate, module: 'Staff Salary', reference: s.id, party: s.staffName || '-', description: `Salary payment ${s.salaryMonth || ''}`, debit: Number(s.amount||0), credit: 0, amount: Number(s.amount||0), detail: s }));
    entries.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0;
    const rows = entries.map(e => { balance += Number(e.debit || 0) - Number(e.credit || 0); return { ...e, balance }; });
    res.json({ success: true, rows: rows.reverse(), summary: { entries: rows.length, debit: rows.reduce((a,r)=>a+Number(r.debit||0),0), credit: rows.reduce((a,r)=>a+Number(r.credit||0),0), balance } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch general ledger', details: error?.message || String(error) }); }
});

// Staff and salary
app.get('/api/staff', async (_req, res) => {
  try { await ensureExtraTables(); const rows: any[] = await prisma.$queryRawUnsafe(`SELECT sp.*, u.username, u.role AS userRole FROM StaffProfile sp LEFT JOIN "User" u ON u.id = sp.userId ORDER BY sp.createdAt DESC`); res.json({ success: true, rows: rows.map(r => ({ ...r, permissions: (()=>{try{return JSON.parse(r.permissions||'[]')}catch{return []}})() })) }); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch staff', details: error?.message || String(error) }); }
});
app.post('/api/staff', async (req, res) => {
  try {
    await ensureExtraTables(); const d = req.body || {};
    const user = await prisma.user.create({ data: { username: q(d.username) || q(d.phone) || `staff${Date.now()}`, password: q(d.password) || '1234', role: q(d.role) || 'STAFF' } });
    await prisma.$executeRawUnsafe(`INSERT INTO StaffProfile (userId, name, phone, cnic, salary, profileImage, address, role, pin, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      user.id, q(d.name), q(d.phone), q(d.cnic), num(d.salary), d.profileImage || null, q(d.address), q(d.role) || 'STAFF', q(d.pin) || '1234', JSON.stringify(d.permissions || []), q(d.status) || 'ACTIVE');
    res.json({ success: true, message: 'Staff created' });
  } catch (error: any) { console.error(error); res.status(500).json({ error: error?.message || 'Failed to create staff' }); }
});
app.put('/api/staff/:id', async (req, res) => {
  try {
    const d = req.body || {}; const id = Number(req.params.id);
    const current: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM StaffProfile WHERE id=?`, id);
    if (!current[0]) return res.status(404).json({ error: 'Staff not found' });
    await prisma.$executeRawUnsafe(`UPDATE StaffProfile SET name=?, phone=?, cnic=?, salary=?, profileImage=?, address=?, role=?, pin=?, permissions=?, status=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      q(d.name), q(d.phone), q(d.cnic), num(d.salary), d.profileImage || current[0].profileImage || null, q(d.address), q(d.role)||'STAFF', q(d.pin)||current[0].pin||'1234', JSON.stringify(d.permissions||[]), q(d.status)||'ACTIVE', id);
    if (current[0].userId) {
      const udata: any = {}; if (q(d.username)) udata.username = q(d.username); if (q(d.password)) udata.password = q(d.password); if (q(d.role)) udata.role = q(d.role);
      if (Object.keys(udata).length) await prisma.user.update({ where: { id: Number(current[0].userId) }, data: udata });
    }
    res.json({ success: true, message: 'Staff updated' });
  } catch (error: any) { res.status(500).json({ error: error?.message || 'Failed to update staff' }); }
});
app.delete('/api/staff/:id', async (req, res) => {
  try { const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM StaffProfile WHERE id=?`, Number(req.params.id)); await prisma.$executeRawUnsafe(`DELETE FROM StaffProfile WHERE id=?`, Number(req.params.id)); if (rows[0]?.userId) await prisma.user.delete({ where: { id: Number(rows[0].userId) } }).catch(()=>{}); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete staff', details: error?.message || String(error) }); }
});
app.get('/api/staff/:id/salary', async (req, res) => {
  try { const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM StaffSalaryPayment WHERE staffId=? ORDER BY paymentDate DESC`, Number(req.params.id)); res.json({ success: true, rows, totalPaid: rows.reduce((a,r)=>a+Number(r.amount||0),0) }); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch salary history', details: error?.message || String(error) }); }
});
app.post('/api/staff/:id/salary', async (req, res) => {
  try { const d=req.body||{}; await prisma.$executeRawUnsafe(`INSERT INTO StaffSalaryPayment (staffId, amount, salaryMonth, paymentDate, paymentMethod, notes) VALUES (?, ?, ?, ?, ?, ?)`, Number(req.params.id), num(d.amount), q(d.salaryMonth), (toSqlDate(d.paymentDate)||new Date()).toISOString(), q(d.paymentMethod)||'CASH', q(d.notes)); res.json({ success: true, message: 'Salary payment saved' }); }
  catch (error) { res.status(500).json({ error: 'Failed to save salary payment', details: error?.message || String(error) }); }
});


if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
