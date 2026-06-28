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

async function main() {
  try {
    const originalQueryRawUnsafe = prisma.$queryRawUnsafe.bind(prisma);
    const originalExecuteRawUnsafe = prisma.$executeRawUnsafe.bind(prisma);
    prisma.$queryRawUnsafe = (query, ...params) => originalQueryRawUnsafe(sqlCompat(query), ...params);
    prisma.$executeRawUnsafe = (query, ...params) => originalExecuteRawUnsafe(sqlCompat(query), ...params);

    const q = `INSERT INTO Expense (title, category, amount, expenseDate) VALUES ('test', 'test', 10, CURRENT_TIMESTAMP)`;
    await prisma.$executeRawUnsafe(q);
    console.log('Expense insertion successful!');
  } catch (error) {
    console.error('ERROR Expense:', error.message);
  }
  
  try {
    const d = await prisma.$queryRawUnsafe(`SELECT * FROM Expense`);
    console.log('Expenses:', d);
  } catch (error) {
    console.error('ERROR SELECT:', error.message);
  }
}
main();
