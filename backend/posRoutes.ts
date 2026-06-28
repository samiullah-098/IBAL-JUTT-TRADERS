import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const normalize = (value: any) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compact = (value: any) => normalize(value).replace(/\s+/g, '');

const distance = (a: string, b: string) => {
  const aa = compact(a);
  const bb = compact(b);
  if (!aa || !bb) return 999;
  const dp = Array.from({ length: aa.length + 1 }, (_, i) => Array(bb.length + 1).fill(0));
  for (let i = 0; i <= aa.length; i++) dp[i][0] = i;
  for (let j = 0; j <= bb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (aa[i - 1] === bb[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[aa.length][bb.length];
};

const itemSearchText = (item: any) => normalize([
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

const itemMatches = (item: any, rawQuery: string) => {
  const q = normalize(rawQuery);
  if (!q) return true;
  const haystack = itemSearchText(item);
  if (haystack.includes(q) || compact(haystack).includes(compact(q))) return true;
  const qParts = q.split(' ').filter(Boolean);
  if (qParts.length && qParts.every(part => haystack.includes(part))) return true;

  const words = haystack.split(' ').filter(w => w.length >= 3);
  return qParts.some(part => part.length >= 3 && words.some(w => distance(part, w) <= (part.length <= 4 ? 1 : 2)));
};

const formatPosItem = (item: any) => ({
  id: item.id,
  item_name: item.variant,
  variant_name: item.variant,
  variant: item.variant,
  category: item.category,
  lot_batch_number: item.lotNumber || '',
  lotNumber: item.lotNumber || '',
  mill_brand_name: item.millName || '',
  millName: item.millName || '',
  quality: item.color || item.notes || 'Standard',
  current_quantity: Number(item.quantity || 0),
  quantity: Number(item.quantity || 0),
  unit: item.unit || 'kg',
  sale_rate: Number(item.sellingPrice || 0),
  sellingPrice: Number(item.sellingPrice || 0),
  purchase_rate: Number(item.purchaseRate || 0),
  purchaseRate: Number(item.purchaseRate || 0),
  reorder_level: Number(item.reorderLevel || 10),
  weightPerUnit: item.weightPerUnit || null,
  notes: item.notes || '',
  bagBreakdown: item.Bags || []
});

const getAvailableItems = async () => {
  return prisma.inventoryItem.findMany({
    where: { status: 'ACTIVE', quantity: { gt: 0 } },
    include: { Bags: { where: { status: 'IN_STOCK' } } },
    orderBy: { updatedAt: 'desc' },
    take: 500
  });
};

router.get('/items/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const items = await getAvailableItems();
    const filtered = q ? items.filter(item => itemMatches(item, q)).slice(0, 50) : items.slice(0, 50);
    return res.json({ success: true, items: filtered.map(formatPosItem) });
  } catch (error) {
    console.error('POS Search Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to search POS items' });
  }
});

router.get('/recent-items', async (_req, res) => {
  try {
    const items = await getAvailableItems();
    return res.json({ success: true, items: items.slice(0, 50).map(formatPosItem) });
  } catch (error) {
    console.error('Recent Items Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch recent POS items' });
  }
});

router.get('/today-summary', async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sales = await prisma.transaction.findMany({
      where: { type: 'SALE', date: { gte: today } },
      include: { Items: true }
    });

    const todaySales = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
    const cashReceived = sales.reduce((sum, sale) => sum + Number(sale.amountPaid || 0), 0);
    const itemsSold = sales.reduce((sum, sale) => sum + sale.Items.reduce((x, item) => x + Number(item.quantity || 0), 0), 0);
    const lowStockCount = await prisma.inventoryItem.count({ where: { status: 'ACTIVE', quantity: { lt: 50 } } });

    return res.json({
      success: true,
      summary: {
        todaySales,
        cashReceived,
        todayUdhar: Math.max(todaySales - cashReceived, 0),
        itemsSold,
        lowStockCount,
        today_sales: todaySales,
        cash_received: cashReceived,
        today_udhar: Math.max(todaySales - cashReceived, 0),
        items_sold: itemsSold,
        low_stock_alerts: lowStockCount
      }
    });
  } catch (error) {
    console.error('Today Summary Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch POS today summary' });
  }
});

export default router;
