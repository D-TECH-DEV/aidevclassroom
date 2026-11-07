/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { EnrollmentsService } from './enrollments.service';

function makePrisma(
  sprint: unknown,
  opts: { existing?: unknown; count?: number } = {},
) {
  const created: unknown[] = [];
  const tx = {
    enrollment: {
      count: jest.fn(async () => opts.count ?? 0),
      findUnique: jest.fn(async () => opts.existing ?? null),
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
