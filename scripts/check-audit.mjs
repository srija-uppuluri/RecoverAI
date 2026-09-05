import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const logs = await prisma.auditLog.groupBy({ by: ['action'], _count: { action: true } });
const total = await prisma.auditLog.count();
console.log('Total audit logs:', total);
console.log('By action:', JSON.stringify(logs, null, 2));
await prisma.$disconnect();
