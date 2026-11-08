/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { SprintsService } from './sprints.service';

function makePrisma(sprint: unknown = null, enrollCount = 0) {
  return {
    sprint: {
      findUnique: jest.fn(async () => sprint),
      findMany: jest.fn(async () => [sprint].filter(Boolean)),
      count: jest.fn(async () => (sprint ? 1 : 0)),
      create: jest.fn(async ({ data }: never) => ({
        id: 1,
        ...(data as object),
      })),
      update: jest.fn(async ({ data }: never) => ({
        ...(sprint as object),
        ...(data as object),
      })),
      delete: jest.fn(async () => ({ id: 1 })),
    },
    enrollment: { count: jest.fn(async () => enrollCount) },
  };
}

const dto = {
  name: 'Sprint Test',
  slug: 'sprint-test',
  priceXof: 50000,
  minimumPaymentXof: 5000,
  startAt: '2026-11-10T09:00:00Z',
  endAt: '2026-12-10T18:00:00Z',
};

describe('SprintsService (CRUD + regles)', () => {
  it('cree un sprint et refuse minimum > prix', async () => {
    const svc = new SprintsService(makePrisma() as never);
    const created = await svc.create({ ...dto });
    expect(created).toMatchObject({ priceXof: 50000 });
    await expect(
      svc.create({ ...dto, slug: 'autre', minimumPaymentXof: 60000 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MINIMUM_EXCEEDS_PRICE' }),
    });
  });

  it('refuse la suppression physique avec inscriptions (409)', async () => {
    const svc = new SprintsService(
      makePrisma({ id: 1, status: 'ACTIVE' }, 3) as never,
    );
    await expect(svc.remove(1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SPRINT_HAS_ENROLLMENTS' }),
    });
  });

  it('refuse une transition de statut non permise', async () => {
    const svc = new SprintsService(
      makePrisma({
        id: 1,
        status: 'DRAFT',
        priceXof: 1,
        minimumPaymentXof: 1,
      }) as never,
    );
    await expect(svc.changeStatus(1, 'COMPLETED')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    });
  });

  it('catalogue public : ACTIVE et INACTIVE visibles, brouillons masques', async () => {
    const prisma = makePrisma();
    const svc = new SprintsService(prisma as never);
    await svc.listPublic();
    expect(prisma.sprint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['ACTIVE', 'INACTIVE'] } },
      }),
    );
  });

  it('detail public masque les sprints non actifs', async () => {
    const svc = new SprintsService(
      makePrisma({ id: 1, status: 'DRAFT' }) as never,
    );
    await expect(svc.detailPublic(1)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SPRINT_NOT_FOUND' }),
    });
  });

  it('forfait duo : prix et minimum optionnels mais coherents', async () => {
    const svc = new SprintsService(makePrisma() as never);
    const created = await svc.create({
      ...dto,
      slug: 'avec-duo',
      duoPriceXof: 80000,
      duoMinimumPaymentXof: 10000,
    });
    expect(created).toMatchObject({ duoPriceXof: 80000 });
    // Minimum duo sans prix duo : refuse.
    await expect(
      svc.create({ ...dto, slug: 'duo-sans-prix', duoMinimumPaymentXof: 5000 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUO_MINIMUM_WITHOUT_PRICE' }),
    });
    // Minimum duo au-dela du prix duo : refuse.
    await expect(
      svc.create({
        ...dto,
        slug: 'duo-incoherent',
        duoPriceXof: 80000,
        duoMinimumPaymentXof: 90000,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUO_MINIMUM_EXCEEDS_PRICE' }),
    });
  });
});
