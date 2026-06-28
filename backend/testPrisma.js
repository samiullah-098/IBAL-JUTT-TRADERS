const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$transaction(async (tx) => {
  return await tx.party.create({ data: { name: 'Test Tx', type: 'BUYER' } });
}).then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
