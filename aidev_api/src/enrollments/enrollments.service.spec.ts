/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { EnrollmentsService } from './enrollments.service';

function makePrisma(
  sprint: unknown,
  opts: { existing?: unknown; count?: number } = {},
) {
  const created: unknown[] = [];
  const seats = opts.count ?? 0;
  const tx = {
    enrollment: {
      count: jest.fn(async () => seats),
      findMany: jest.fn(async () =>
        Array.from({ length: seats }, () => ({ plan: 'SINGLE' })),
      ),
      findUnique: jest.fn(async () => opts.existing ?? null),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: never) => {
        const row = { id: 1, ...(data as object) };
        created.push(row);
        return { ...row, student: { id: 1 }, sprint: {} };
      }),
    },
    student: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: never) => ({
        id: 1,
        ...(data as object),
      })),
    },
  };
  return {
    created,
    prisma: {
      sprint: { findUnique: jest.fn(async () => sprint) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
  };
}

const student = {
  firstName: 'Aminata',
  lastName: 'Kone',
  email: 'aminata@example.com',
  phone: '+2250700000000',
};

describe('EnrollmentsService (RG01/RG04/RG13/RG14)', () => {
  it('refuse une inscription a un Sprint inactif', async () => {
    const { prisma } = makePrisma({ id: 1, status: 'DRAFT', priceXof: 50000 });
    const svc = new EnrollmentsService(prisma as never);
    await expect(svc.create(1, student)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SPRINT_NOT_ACTIVE' }),
    });
  });

  it('fige le prix du Sprint au moment de inscription (RG04)', async () => {
    const { prisma, created } = makePrisma({
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      capacity: null,
    });
    const svc = new EnrollmentsService(prisma as never);
    await svc.create(1, student);
    expect(created[0]).toMatchObject({ totalAmountXof: 50000 });
  });

  it('un changement de prix catalogue ne modifie pas les inscriptions existantes (RG04)', async () => {
    // Reservation au prix de 50 000 XOF...
    const { prisma, created } = makePrisma({
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      capacity: null,
    });
    const svc = new EnrollmentsService(prisma as never);
    await svc.create(1, student);
    // ...puis le prix catalogue passe a 60 000 XOF : la ligne deja
    // creee garde son total fige, seule une NOUVELLE inscription
    // (autre participant) fige le nouveau prix.
    const other = { ...student, email: 'autre@example.com' };
    const { prisma: prisma2, created: created2 } = makePrisma({
      id: 1,
      status: 'ACTIVE',
      priceXof: 60000,
      capacity: null,
    });
    const svc2 = new EnrollmentsService(prisma2 as never);
    await svc2.create(1, other);
    expect(created[0]).toMatchObject({ totalAmountXof: 50000 });
    expect(created2[0]).toMatchObject({ totalAmountXof: 60000 });
  });

  it('empeche la double inscription (unique student+sprint)', async () => {
    const { prisma } = makePrisma(
      { id: 1, status: 'ACTIVE', priceXof: 50000, capacity: null },
      { existing: { id: 9 } },
    );
    const svc = new EnrollmentsService(prisma as never);
    await expect(svc.create(1, student)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUPLICATE_ENROLLMENT' }),
    });
  });

  it('refuse au-dela de la capacite (RG14)', async () => {
    const { prisma } = makePrisma(
      { id: 1, status: 'ACTIVE', priceXof: 50000, capacity: 2 },
      { count: 2 },
    );
    const svc = new EnrollmentsService(prisma as never);
    await expect(svc.create(1, student)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SPRINT_CAPACITY_REACHED' }),
    });
  });

  it('forfait DUO fige le prix duo et exige le binome', async () => {
    const sprint = {
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      duoPriceXof: 80000,
      capacity: null,
    };
    const { prisma, created } = makePrisma(sprint);
    const svc = new EnrollmentsService(prisma as never);
    await svc.create(1, student, 'DUO', {
      firstName: 'Ibrahim',
      lastName: 'Diallo',
      phone: '+2250700000001',
      email: 'Ibrahim@Example.com',
    });
    expect(created[0]).toMatchObject({
      plan: 'DUO',
      totalAmountXof: 80000,
      partnerFirstName: 'Ibrahim',
      partnerLastName: 'Diallo',
      partnerPhone: '+2250700000001',
      partnerEmail: 'ibrahim@example.com',
    });
    // Forfait inconnu : refuse.
    await expect(svc.create(1, student, 'TRIO')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_PLAN' }),
    });
    const { prisma: prisma2 } = makePrisma(sprint);
    const svc2 = new EnrollmentsService(prisma2 as never);
    await expect(
      svc2.create(1, { ...student, email: 'b@example.com' }, 'DUO', {
        firstName: 'A',
        lastName: 'B',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PARTNER_REQUIRED' }),
    });
    // Nom bon mais numero manquant : refuse aussi.
    const { prisma: prisma3 } = makePrisma(sprint);
    const svc3 = new EnrollmentsService(prisma3 as never);
    await expect(
      svc3.create(1, { ...student, email: 'c@example.com' }, 'DUO', {
        firstName: 'Ibrahim',
        lastName: 'Diallo',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PARTNER_REQUIRED' }),
    });
  });

  it('forfait DUO indisponible sans prix duo au catalogue', async () => {
    const { prisma } = makePrisma({
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      duoPriceXof: null,
      capacity: null,
    });
    const svc = new EnrollmentsService(prisma as never);
    await expect(
      svc.create(1, student, 'DUO', {
        firstName: 'Ibrahim',
        lastName: 'Diallo',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUO_NOT_AVAILABLE' }),
    });
  });

  it('un dossier DUO occupe 2 places de capacite', async () => {
    const sprint = {
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      duoPriceXof: 80000,
      capacity: 3,
    };
    // 2 dossiers SINGLE = 2 places occupees : un DUO (2 places) depasse.
    const { prisma } = makePrisma(sprint, { count: 2 });
    const svc = new EnrollmentsService(prisma as never);
    await expect(
      svc.create(1, student, 'DUO', {
        firstName: 'Ibrahim',
        lastName: 'Diallo',
        phone: '+2250700000001',
        email: 'ibrahim@example.com',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SPRINT_CAPACITY_REACHED' }),
    });
    // Mais un SINGLE passe encore (2 + 1 = 3).
    const { prisma: prisma2, created } = makePrisma(sprint, { count: 2 });
    const svc2 = new EnrollmentsService(prisma2 as never);
    await svc2.create(1, student, 'SINGLE');
    expect(created[0]).toMatchObject({ plan: 'SINGLE', totalAmountXof: 50000 });
  });

  it('retrouve par e-mail et re-emet un jeton (rotation)', async () => {
    const prisma = {
      student: {
        findUnique: jest.fn(async () => ({ id: 1, email: 'a@example.com' })),
      },
      enrollment: {
        findMany: jest.fn(async () => [
          {
            id: 7,
            totalAmountXof: 50000,
            plan: 'SINGLE',
            payments: [{ status: 'SUCCESS', amountXof: 10000 }],
            sprint: { id: 1, name: 'Sprint', slug: 's', status: 'ACTIVE' },
            trackingTokenHash: 'ancien',
            studentId: 1,
          },
        ]),
        update: jest.fn(async ({ data }: never) => data),
      },
    };
    const svc = new EnrollmentsService(prisma as never);
    const out = await svc.findByEmail('A@Example.com');
    expect(
      (out.dossiers[0] as { trackingToken: string }).trackingToken,
    ).toMatch(/^[0-9a-f]{64}$/);
    expect(out.dossiers[0]).toMatchObject({ remainingAmountXof: 40000 });
    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ trackingTokenHash: expect.any(String) }),
    });
  });

  it('e-mail inconnu : aucun dossier, sans devoiler', async () => {
    const prisma = {
      student: { findUnique: jest.fn(async () => null) },
      enrollment: { findMany: jest.fn(async () => []) },
    };
    const svc = new EnrollmentsService(prisma as never);
    await expect(svc.findByEmail('inconnu@example.com')).resolves.toEqual({
      dossiers: [],
    });
  });

  it('forfait DUO exige un e-mail binome distinct et valide', async () => {
    const sprint = {
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      duoPriceXof: 80000,
      capacity: null,
    };
    const binome = {
      firstName: 'Ibrahim',
      lastName: 'Diallo',
      phone: '+2250700000001',
    };
    // Sans e-mail binome : refuse.
    const { prisma: prisma1 } = makePrisma(sprint);
    const svc1 = new EnrollmentsService(prisma1 as never);
    await expect(svc1.create(1, student, 'DUO', binome)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PARTNER_EMAIL_INVALID' }),
    });
    // E-mail binome identique a celui de l'inscription : refuse.
    const { prisma: prisma2 } = makePrisma(sprint);
    const svc2 = new EnrollmentsService(prisma2 as never);
    await expect(
      svc2.create(1, student, 'DUO', { ...binome, email: student.email }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PARTNER_EMAIL_INVALID' }),
    });
  });

  it('le binome ne peut pas recreer un dossier avec son e-mail (doublon)', async () => {
    const sprint = {
      id: 1,
      status: 'ACTIVE',
      priceXof: 50000,
      duoPriceXof: 80000,
      capacity: null,
    };
    const binome = {
      firstName: 'Ibrahim',
      lastName: 'Diallo',
      phone: '+2250700000001',
      email: 'ibrahim@example.com',
    };
    // Un dossier existe deja avec cet e-mail (titulaire ou binome) :
    // la transaction voit le conflit et refuse le second dossier.
    const prismaTx = {
      sprint: { findUnique: jest.fn(async () => sprint) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          enrollment: {
            findMany: jest.fn(async () => []),
            findUnique: jest.fn(async () => null),
            findFirst: jest.fn(async () => ({ id: 9 })),
            create: jest.fn(),
          },
          student: {
            findUnique: jest.fn(async () => null),
            create: jest.fn(async () => ({ id: 2 })),
          },
        }),
      ),
    };
    const svcConflict = new EnrollmentsService(prismaTx as never);
    await expect(
      svcConflict.create(
        1,
        { ...student, email: 'nouveau@example.com' },
        'DUO',
        binome,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUPLICATE_ENROLLMENT' }),
    });
  });

  it("findByEmail retrouve le dossier DUO par l'e-mail du binome", async () => {
    const row = {
      id: 7,
      totalAmountXof: 80000,
      plan: 'DUO',
      partnerEmail: 'ibrahim@example.com',
      payments: [{ status: 'SUCCESS', amountXof: 10000 }],
      sprint: { id: 1, name: 'Sprint', slug: 's', status: 'ACTIVE' },
      trackingTokenHash: 'ancien',
      studentId: 2,
    };
    const prisma = {
      // L'e-mail du binome n'est celui d'aucun titulaire.
      student: { findUnique: jest.fn(async () => null) },
      enrollment: {
        findMany: jest.fn(async () => [row]),
        update: jest.fn(async ({ data }: never) => data),
      },
    };
    const svc = new EnrollmentsService(prisma as never);
    const out = await svc.findByEmail('Ibrahim@Example.com');
    expect(out.dossiers).toHaveLength(1);
    expect(out.dossiers[0]).toMatchObject({ remainingAmountXof: 70000 });
    expect(
      (out.dossiers[0] as { trackingToken: string }).trackingToken,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cloture COMPLETED exige un solde nul (RG07)', async () => {
    const prisma = {
      enrollment: {
        findUnique: jest.fn(async () => ({
          id: 1,
          status: 'CONFIRMED',
          totalAmountXof: 50000,
          payments: [{ status: 'SUCCESS', amountXof: 10000 }],
        })),
      },
    };
    const svc = new EnrollmentsService(prisma as never);
    await expect(svc.changeStatus(1, 'COMPLETED')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ENROLLMENT_NOT_SETTLED' }),
    });
  });
});
