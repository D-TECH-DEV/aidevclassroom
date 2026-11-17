import { createHash } from 'crypto';
import type {
  EnrollmentPlan,
  EnrollmentStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

type SeedPayment = {
  reference: string;
  amountXof: number;
  status: PaymentStatus;
  paidAt?: Date;
};

type SeedEnrollment = {
  sprintSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  plan: EnrollmentPlan;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerPhone?: string;
  status: EnrollmentStatus;
  payments: SeedPayment[];
};

const DOSSIERS: SeedEnrollment[] = [
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Kouadio',
    lastName: 'Nguessan',
    email: 'kouadio.nguessan@exemple.ci',
    phone: '+2250701020304',
    plan: 'SINGLE',
    status: 'COMPLETED',
    payments: [
      {
        reference: 'sp_seed_web_01_a',
        amountXof: 20000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-01T10:15:00Z'),
      },
      {
        reference: 'sp_seed_web_01_b',
        amountXof: 30000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-04T15:30:00Z'),
      },
    ],
  },
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Awa',
    lastName: 'Kone',
    email: 'awa.kone@exemple.ci',
    phone: '+2250502030405',
    plan: 'DUO',
    partnerFirstName: 'Mariam',
    partnerLastName: 'Traore',
    partnerPhone: '+2250502030406',
    status: 'CONFIRMED',
    payments: [
      {
        reference: 'sp_seed_web_02_a',
        amountXof: 40000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-05T09:00:00Z'),
      },
      {
        reference: 'sp_seed_web_02_b',
        amountXof: 20000,
        status: 'PENDING',
      },
    ],
  },
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Jean-Luc',
    lastName: 'Bamba',
    email: 'jeanluc.bamba@exemple.ci',
    phone: '+2250103040506',
    plan: 'SINGLE',
    status: 'CONFIRMED',
    payments: [
      {
        reference: 'sp_seed_web_03_a',
        amountXof: 15000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-06T14:20:00Z'),
      },
    ],
  },
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Fatou',
    lastName: 'Diallo',
    email: 'fatou.diallo@exemple.ci',
    phone: '+2250704050607',
    plan: 'SINGLE',
    status: 'PENDING',
    payments: [
      {
        reference: 'sp_seed_web_04_a',
        amountXof: 5000,
        status: 'PENDING',
      },
    ],
  },
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Cedric',
    lastName: 'Yao',
    email: 'cedric.yao@exemple.ci',
    phone: '+2250705060708',
    plan: 'SINGLE',
    status: 'PENDING',
    payments: [
      {
        reference: 'sp_seed_web_05_a',
        amountXof: 10000,
        status: 'FAILED',
      },
    ],
  },
  {
    sprintSlug: 'sprint-dev-web-intensif',
    firstName: 'Estelle',
    lastName: 'Gnahore',
    email: 'estelle.gnahore@exemple.ci',
    phone: '+2250506070809',
    plan: 'SINGLE',
    status: 'CANCELLED',
    payments: [
      {
        reference: 'sp_seed_web_06_a',
        amountXof: 5000,
        status: 'ABANDONED',
      },
    ],
  },
  {
    sprintSlug: 'sprint-data-fondamentaux',
    firstName: 'Ibrahim',
    lastName: 'Coulibaly',
    email: 'ibrahim.coulibaly@exemple.ci',
    phone: '+2250707080910',
    plan: 'SINGLE',
    status: 'CONFIRMED',
    payments: [
      {
        reference: 'sp_seed_data_01_a',
        amountXof: 35000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-08T11:10:00Z'),
      },
    ],
  },
  {
    sprintSlug: 'sprint-data-fondamentaux',
    firstName: 'Nadine',
    lastName: 'Aka',
    email: 'nadine.aka@exemple.ci',
    phone: '+2250108091011',
    plan: 'SINGLE',
    status: 'COMPLETED',
    payments: [
      {
        reference: 'sp_seed_data_02_a',
        amountXof: 75000,
        status: 'SUCCESS',
        paidAt: new Date('2026-11-09T16:45:00Z'),
      },
    ],
  },
];

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function seedEnrollmentsAndPayments(
  prisma: PrismaClient,
): Promise<void> {
  const sprints = await prisma.sprint.findMany({
    select: { id: true, slug: true, priceXof: true, duoPriceXof: true },
  });
  const sprintBySlug = new Map(sprints.map((s) => [s.slug, s]));

  for (const item of DOSSIERS) {
    const sprint = sprintBySlug.get(item.sprintSlug);
    if (!sprint) continue;

    const student = await prisma.student.upsert({
      where: { email: item.email },
      update: {
        firstName: item.firstName,
        lastName: item.lastName,
        phone: item.phone,
      },
      create: {
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        phone: item.phone,
      },
    });

    const totalAmountXof =
      item.plan === 'DUO' && sprint.duoPriceXof != null
        ? sprint.duoPriceXof
        : sprint.priceXof;

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_sprintId: { studentId: student.id, sprintId: sprint.id },
      },
      update: {
        plan: item.plan,
        partnerFirstName: item.partnerFirstName ?? null,
        partnerLastName: item.partnerLastName ?? null,
        partnerPhone: item.partnerPhone ?? null,
        totalAmountXof,
        status: item.status,
      },
      create: {
        studentId: student.id,
        sprintId: sprint.id,
        plan: item.plan,
        partnerFirstName: item.partnerFirstName ?? null,
        partnerLastName: item.partnerLastName ?? null,
        partnerPhone: item.partnerPhone ?? null,
        totalAmountXof,
        status: item.status,
        trackingTokenHash: hashToken(`seed-${item.email}-${sprint.slug}`),
      },
    });

    for (const pay of item.payments) {
      await prisma.payment.upsert({
        where: { reference: pay.reference },
        update: {
          amountXof: pay.amountXof,
          status: pay.status,
          paidAt: pay.paidAt ?? null,
        },
        create: {
          enrollmentId: enrollment.id,
          amountXof: pay.amountXof,
          currency: 'XOF',
          reference: pay.reference,
          status: pay.status,
          paidAt: pay.paidAt ?? null,
        },
      });
    }
  }

  console.log('Inscriptions et paiements de demonstration prets.');
}
