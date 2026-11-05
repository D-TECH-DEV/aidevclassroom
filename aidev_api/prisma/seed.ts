/** Seed de developpement : premier admin + sprints de demonstration (aucun secret). */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error(
    'DATABASE_URL manquante : exportez-la ou utilisez `npx prisma db seed`.',
  );
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com')
    .trim()
    .toLowerCase();
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  if (password.length < 8) throw new Error('SEED_ADMIN_PASSWORD trop court.');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, isActive: true },
    create: { name, email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Admin pret : ${email}`);

  const sprints = [
    {
      name: 'Sprint Dev Web Intensif',
      slug: 'sprint-dev-web-intensif',
      description: '4 semaines pour construire une API complete.',
      priceXof: 50000,
      minimumPaymentXof: 5000,
      startAt: new Date('2026-11-10T09:00:00Z'),
      endAt: new Date('2026-12-10T18:00:00Z'),
      capacity: 50,
      status: 'ACTIVE' as const,
    },
    {
      name: 'Sprint Data Fondamentaux',
      slug: 'sprint-data-fondamentaux',
      description: 'SQL, Python et tableaux de bord.',
      priceXof: 75000,
      minimumPaymentXof: 10000,
      startAt: new Date('2026-12-01T09:00:00Z'),
      endAt: new Date('2027-01-15T18:00:00Z'),
      capacity: 30,
      status: 'DRAFT' as const,
    },
  ];
  for (const s of sprints) {
    await prisma.sprint.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }
  console.log('Sprints de demonstration prets.');
}

void main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
