const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const isPostgres = String(process.env.DATABASE_URL || '').startsWith('postgres');
const sqlCompat = (query) => {
  if (!isPostgres) return query;
  let converted = query
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
    .replace(/CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP');
  let i = 0;
  converted = converted.replace(/\?/g, () => '$' + (++i));
  return converted;
};

const originalQueryRawUnsafe = prisma.$queryRawUnsafe.bind(prisma);
const originalExecuteRawUnsafe = prisma.$executeRawUnsafe.bind(prisma);
prisma.$queryRawUnsafe = (query, ...params) => originalQueryRawUnsafe(sqlCompat(query), ...params);
prisma.$executeRawUnsafe = (query, ...params) => originalExecuteRawUnsafe(sqlCompat(query), ...params);

const q = (value) => String(value ?? '').trim();
const num = (value) => Number(value || 0);
const toSqlDate = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

async function test() {
  try {
    const d = { title: 'Test 2', amount: 200 };
    await prisma.$executeRawUnsafe(`INSERT INTO Expense (title, category, amount, expenseDate, paymentMethod, paidTo, phone, referenceNumber, notes, proofImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      q(d.title), q(d.category) || 'General', num(d.amount), (toSqlDate(d.expenseDate) || new Date()).toISOString(), q(d.paymentMethod) || 'CASH', q(d.paidTo), q(d.phone), q(d.referenceNumber), q(d.notes), d.proofImage || null);
    console.log('Insert OK');
  } catch(e) {
    console.error('INSERT ERROR:', e);
  }
}
test();
