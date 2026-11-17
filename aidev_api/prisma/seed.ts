/** Seed de developpement : premier admin + sprints de demonstration (aucun secret). */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedEnrollmentsAndPayments } from './seed-enrollments';

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
      description:
        "Pas de framework à avaler en trois heures : tu appelles le modèle, tu poses la règle métier et le back garde le cap. Le déploiement se fait devant tout le monde.",
      priceXof: 50000,
      minimumPaymentXof: 5000,
      duoPriceXof: 80000,
      duoMinimumPaymentXof: 10000,
      startAt: new Date('2026-11-10T09:00:00Z'),
      endAt: new Date('2026-12-10T18:00:00Z'),
      capacity: 50,
      city: 'Yamoussoukro',
      location: 'Mairie de Yamoussoukro — salle multimédia Orange',
      format: '1 journée · présentiel',
      level: 'Bases en dev',
      modules: [
        'Le design de ton site',
        "Le code, en guidant l'IA",
        'Ton admin + ton chatbot IA',
        'Ton site déployé en ligne',
      ],
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
      city: 'Yamoussoukro',
      location: 'Mairie de Yamoussoukro — salle multimédia Orange',
      format: 'Atelier intensif · présentiel',
      level: 'Bases en dev',
      modules: [
        'Structuration SQL',
        'Analyse Python',
        'Tableaux de bord interactifs',
        'Mise en ligne du projet',
      ],
      status: 'DRAFT' as const,
    },
  ];
  for (const s of sprints) {
    const existing = await prisma.sprint.findUnique({ where: { slug: s.slug } });
    if (!existing) {
      await prisma.sprint.create({ data: s });
    } else if (
      existing.city === null &&
      existing.location === null &&
      existing.format === null &&
      existing.level === null &&
      existing.modules === null
    ) {
      await prisma.sprint.update({
        where: { slug: s.slug },
        data: {
          city: s.city,
          location: s.location,
          format: s.format,
          level: s.level,
          modules: s.modules,
        },
      });
    }
  }
  console.log('Sprints de demonstration prets.');

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      whatsappDisplay: '07 04 92 10 80',
      whatsappHref: 'https://wa.me/2250704921080',
    },
  });

  if ((await prisma.trainer.count()) === 0) {
    await prisma.trainer.createMany({
      data: [
        {
          firstName: 'Victorien',
          lastName: '',
          role: 'Machine learning',
          photoPath: '/formateurs/victorien.png',
          badgePath: '/badges/victorien.png',
          bio: '',
          sortOrder: 1,
        },
        {
          firstName: 'Youssouf',
          lastName: 'Doumje',
          role: 'DevOps & MLOps',
          photoPath: '/formateurs/youssouf.png',
          badgePath: '/badges/youssouf.png',
          bio: 'Déploiement, mise en production, infrastructure.',
          sortOrder: 2,
        },
        {
          firstName: 'Abdel Malik',
          lastName: '',
          role: 'Frontend & design',
          photoPath: '/formateurs/malik.png',
          badgePath: '/badges/malik.png',
          bio: "Comment fonctionnent les skills, et comment obtenir un design qui n'est pas cliché avec l'IA.",
          sortOrder: 3,
        },
      ],
    });
  }

  if ((await prisma.faqItem.count()) === 0) {
    await prisma.faqItem.createMany({
      data: [
        {
          question: 'Quel niveau faut-il avoir ?',
          answer:
            "Des bases en développement. L'IA ne remplace pas les compétences, elle les démultiplie.",
          sortOrder: 1,
        },
        {
          question: 'Avec quoi je repars ?',
          answer:
            'Ton portfolio en ligne, avec son espace admin et son chatbot IA, plus la méthode pour tes prochains projets.',
          sortOrder: 2,
        },
        {
          question: 'Dois-je venir avec mon ordinateur ?',
          answer: '',
          sortOrder: 3,
        },
        {
          question: 'Comment réserver ?',
          answer: 'Directement sur ce site, ou sur WhatsApp au 07 04 92 10 80.',
          sortOrder: 4,
        },
      ],
    });
  }
  console.log('Contenu editorial par defaut pret.');

  await seedEnrollmentsAndPayments(prisma);
}

void main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
