/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { SiteContentService } from './site-content.service';

function makePrisma(overrides?: {
  setting?: { whatsappDisplay: string; whatsappHref: string } | null;
  trainers?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    photoPath: string | null;
    badgePath: string | null;
    bio: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    sortOrder: number;
  }[];
  faqs?: {
    id: number;
    question: string;
    answer: string;
    sortOrder: number;
  }[];
}) {
  const tx = {
    siteSetting: {
      upsert: jest.fn(async () => overrides?.setting ?? null),
    },
    trainer: {
      findMany: jest.fn(async () =>
        (overrides?.trainers ?? []).map((t) => ({ id: t.id })),
      ),
      update: jest.fn(async ({ data }: never) => data),
      create: jest.fn(async ({ data }: never) => ({ id: 99, ...(data as object) })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    faqItem: {
      findMany: jest.fn(async () =>
        (overrides?.faqs ?? []).map((f) => ({ id: f.id })),
      ),
      update: jest.fn(async ({ data }: never) => data),
      create: jest.fn(async ({ data }: never) => ({ id: 88, ...(data as object) })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };

  return {
    tx,
    prisma: {
      siteSetting: {
        findUnique: jest.fn(async () => overrides?.setting ?? null),
      },
      trainer: {
        findMany: jest.fn(async () => overrides?.trainers ?? []),
      },
      faqItem: {
        findMany: jest.fn(async () => overrides?.faqs ?? []),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
        cb(tx),
      ),
    },
  };
}

describe('SiteContentService', () => {
  it('retourne les valeurs par defaut lorsque siteSetting est absent', async () => {
    const { prisma } = makePrisma({ setting: null, trainers: [], faqs: [] });
    const svc = new SiteContentService(prisma as never);

    await expect(svc.getPublicContent()).resolves.toEqual({
      whatsappDisplay: '07 04 92 10 80',
      whatsappHref: 'https://wa.me/2250704921080',
      contactEmail: 'contact@aidevclassroom.com',
      trainers: [],
      faqs: [],
    });
  });

  it('normalise les chaines vides en null dans la reponse publique', async () => {
    const { prisma } = makePrisma({
      setting: {
        whatsappDisplay: ' 07 04 92 10 80 ',
        whatsappHref: ' https://wa.me/2250704921080 ',
      },
      trainers: [
        {
          id: 1,
          firstName: 'Victorien',
          lastName: ' ',
          role: 'Machine learning',
          photoPath: '/formateurs/victorien.png',
          badgePath: '/badges/victorien.png',
          bio: '',
          githubUrl: 'https://github.com/victorien',
          linkedinUrl: null,
          portfolioUrl: ' ',
          sortOrder: 1,
        },
      ],
      faqs: [
        {
          id: 1,
          question: 'Dois-je venir avec mon ordinateur ?',
          answer: '   ',
          sortOrder: 1,
        },
      ],
    });
    const svc = new SiteContentService(prisma as never);
    const result = await svc.getPublicContent();

    expect(result.trainers[0]).toMatchObject({
      firstName: 'Victorien',
      lastName: null,
      bio: null,
      githubUrl: 'https://github.com/victorien',
      portfolioUrl: null,
    });
    expect(result.faqs[0].answer).toBeNull();
  });

  it('met a jour existants, cree les nouveaux et supprime les absents en transaction', async () => {
    const { prisma, tx } = makePrisma({
      setting: {
        whatsappDisplay: '07 00 00 00 00',
        whatsappHref: 'https://wa.me/2250700000000',
      },
      trainers: [
        {
          id: 1,
          firstName: 'Victorien',
          lastName: '',
          role: 'ML',
          photoPath: null,
          badgePath: null,
          bio: '',
          githubUrl: null,
          linkedinUrl: null,
          portfolioUrl: null,
          sortOrder: 1,
        },
        {
          id: 2,
          firstName: 'Ancien',
          lastName: '',
          role: 'Role',
          photoPath: null,
          badgePath: null,
          bio: '',
          githubUrl: null,
          linkedinUrl: null,
          portfolioUrl: null,
          sortOrder: 2,
        },
      ],
      faqs: [
        { id: 10, question: 'Q1', answer: 'R1', sortOrder: 1 },
      ],
    });
    const svc = new SiteContentService(prisma as never);

    await svc.updateContent({
      whatsappDisplay: '07 00 00 00 00',
      whatsappHref: 'https://wa.me/2250700000000',
      trainers: [
        {
          id: 1,
          firstName: 'Victorien',
          role: 'Machine learning',
          githubUrl: 'https://github.com/vic',
        },
        {
          firstName: 'Nouveau',
          role: 'Architecture',
        },
      ],
      faqs: [
        { id: 10, question: 'Q1', answer: 'R1 mise a jour' },
        { question: 'Q2', answer: 'R2' },
      ],
    });

    expect(tx.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(tx.trainer.update).toHaveBeenCalledTimes(1);
    expect(tx.trainer.create).toHaveBeenCalledTimes(1);
    expect(tx.trainer.deleteMany).toHaveBeenCalledWith({
      where: { id: { notIn: [1, 99] } },
    });
    expect(tx.faqItem.update).toHaveBeenCalledTimes(1);
    expect(tx.faqItem.create).toHaveBeenCalledTimes(1);
    expect(tx.faqItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { notIn: [10, 88] } },
    });
  });
});
