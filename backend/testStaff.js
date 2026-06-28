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

async function test() {
  try {
    const d = { name: 'Staff Test', phone: '03001234567', username: 'staff1', password: '123', salary: 10000 };
    const user = await prisma.user.create({ data: { username: q(d.username) || `staff${Date.now()}`, password: q(d.password) || '1234', role: 'STAFF' } });
    await prisma.$executeRawUnsafe(`INSERT INTO StaffProfile (userId, name, phone, cnic, salary, profileImage, address, role, pin, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      user.id, q(d.name), q(d.phone), q(d.cnic), num(d.salary), d.profileImage || null, q(d.address), 'STAFF', '1234', JSON.stringify([]), 'ACTIVE');
    console.log('Staff Insert OK');
  } catch(e) {
    console.error('STAFF INSERT ERROR:', e.message);
  }
}
test();
