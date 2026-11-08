/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';

/** Faux Prisma minimal : partage un etat en memoire entre appels. */
function makePrisma(initial: {
  payments?: {
    id: number;
    status: string;
    amountXof: number;
    createdAt?: Date;
  }[];
  enrollment?: Record<string, unknown>;
}) {
  const store = {
    payments: [...(initial.payments ?? [])],
    enrollment: initial.enrollment as never,
    updated: [] as unknown[],
    created: [] as unknown[],
  };
  let seq = 100;
  const txApi = {
    // Verrou ligne : SELECT ... FOR UPDATE sur l'inscription (anti-concurrence RG06).
    $queryRaw: jest.fn(async () => []),
    payment: {
      findMany: jest.fn(async () => store.payments.map((p) => ({ ...p }))),
      findUnique: jest.fn(async ({ where }: never) => {
        const w = where as { id: number };
        return store.payments.find((p) => p.id === w.id) ?? null;
      }),
      create: jest.fn(async ({ data }: never) => {
        // Comme Prisma, la ligne creee porte son createdAt (defaut now()).
        const row = { id: seq++, createdAt: new Date(), ...(data as object) };
        store.payments.push(row as never);
        store.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: never) => {
        const w = where as { id: number };
        const i = store.payments.findIndex((p) => p.id === w.id);
        store.payments[i] = { ...store.payments[i], ...(data as object) };
        store.updated.push(store.payments[i]);
        return store.payments[i];
      }),
    },
  };
  return {
    store,
    txApi,
    prisma: {
      enrollment: {
        findUnique: jest.fn(async () => store.enrollment),
      },
      payment: {
        findUnique: jest.fn(async ({ where }: never) => {
          const w = where as { reference?: string; id?: number };
          return (
            store.payments.find(
              (p) =>
                (p as unknown as Record<string, unknown>).reference ===
                  w.reference || (p as { id: number }).id === w.id,
            ) ?? null
          );
        }),
        findFirst: jest.fn(async ({ where }: never) => {
          const ors = (
            where as {
              OR: { reference?: string; providerReference?: string }[];
            }
          ).OR;
          return (
            store.payments.find((p) => {
              const r = p as unknown as Record<string, unknown>;
              return ors.some(
                (c) =>
                  (c.reference && r.reference === c.reference) ||
                  (c.providerReference &&
                    r.providerReference === c.providerReference),
              );
            }) ?? null
          );
        }),
        findMany: jest.fn(async () => store.payments.map((p) => ({ ...p }))),
        update: txApi.payment.update,
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(txApi)),
    },
  };
}

const enrollmentBase = {
  id: 1,
  status: 'CONFIRMED',
  totalAmountXof: 50000,
  student: { email: 'amina@example.com' },
  sprint: { minimumPaymentXof: 5000, status: 'ACTIVE' },
  payments: [] as { status: string; amountXof: number }[],
};

describe('PaymentsService (Paystack moque, RG08-RG12)', () => {
  it("initialise via Paystack moque et renvoie l'URL du fournisseur", async () => {
    const { prisma } = makePrisma({ enrollment: { ...enrollmentBase } });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/xyz',
        providerReference: 'prov_1',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      {
        get: (k: string) => (k === 'PAYSTACK_CURRENCY' ? 'XOF' : undefined),
      } as unknown as ConfigService,
    );
    const out = await svc.initialize(1, 10000);
    expect(out.status).toBe('PENDING');
    expect(out.authorizationUrl).toBe('https://checkout.paystack.com/xyz');
    expect(paystack.initializeTransaction).toHaveBeenCalledTimes(1);
  });

  it('deux initialisations concurrentes ne depassent pas le solde (reservation PENDING)', async () => {
    const { prisma } = makePrisma({ enrollment: { ...enrollmentBase } });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/u',
        providerReference: 'prov_x',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await svc.initialize(1, 40000); // reserve 40000 sur 50000
    await expect(svc.initialize(1, 20000)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      }),
    });
  });

  it('verification repetee ne compte jamais deux fois (idempotence RG11)', async () => {
    const done = {
      id: 7,
      enrollmentId: 1,
      amountXof: 10000,
      currency: 'XOF',
      reference: 'sp_done',
      providerReference: 'sp_done',
      status: 'SUCCESS',
      paidAt: new Date(),
    };
    const { prisma } = makePrisma({
      payments: [{ id: 7, status: 'SUCCESS', amountXof: 10000 }],
      enrollment: {
        ...enrollmentBase,
        payments: [{ status: 'SUCCESS', amountXof: 10000 }],
      },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      ...done,
      enrollment: {
        totalAmountXof: 50000,
        payments: [{ status: 'SUCCESS', amountXof: 10000 }],
      },
    });
    const paystack = {
      initializeTransaction: jest.fn(),
      verifyTransaction: jest.fn(async () => {
        throw new Error('ne doit pas etre appele si deja SUCCESS');
      }),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    const out = await svc.verify('sp_done');
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'SUCCESS' });
  });

  it('ecart de montant/devise => FAILED sans annuler inscription (RG07/RG09)', async () => {
    const pending = {
      id: 9,
      enrollmentId: 1,
      amountXof: 10000,
      currency: 'XOF',
      reference: 'sp_9',
      providerReference: 'sp_9',
      status: 'PENDING',
    };
    const { prisma, store } = makePrisma({
      payments: [{ id: 9, status: 'PENDING', amountXof: 10000 }],
      enrollment: { ...enrollmentBase },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      ...pending,
      enrollment: { totalAmountXof: 50000, payments: [] },
    });
    const paystack = {
      initializeTransaction: jest.fn(),
      verifyTransaction: jest.fn(async () => ({
        status: 'success',
        reference: 'sp_9',
        amount: 5000, // montant different de 10000
        currency: 'XOF',
      })),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await expect(svc.verify('sp_9')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_VERIFICATION_MISMATCH',
      }),
    });
    expect(store.updated[0]).toMatchObject({ status: 'FAILED' });
  });

  it('webhook a signature invalide => aucune modification financiere (RG10)', async () => {
    const { prisma, store } = makePrisma({ payments: [] });
    const paystack = {
      initializeTransaction: jest.fn(),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(() => false),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await expect(
      svc.handleWebhook(Buffer.from('{}'), 'fausse'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_WEBHOOK_SIGNATURE' }),
    });
    expect(store.updated).toHaveLength(0);
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });

  it('envoie a Paystack le montant en plus petite unite x100 (XOF inclus)', async () => {
    const { prisma } = makePrisma({ enrollment: { ...enrollmentBase } });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/xyz',
        providerReference: 'prov_1',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      {
        get: (k: string) => (k === 'PAYSTACK_CURRENCY' ? 'XOF' : undefined),
      } as unknown as ConfigService,
    );
    await svc.initialize(1, 10000);
    // 10 000 XOF -> 1 000 000 transmis a Paystack (doc officielle : x100
    // pour toutes les devises, XOF inclus). Avant correction, 10 000
    // etait transmis tel quel et seuls 100 XOF etaient debites.
    expect(paystack.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ providerAmount: 1000000, currency: 'XOF' }),
    );
  });

  it('versements partiels : 10000 puis 15000 puis solde exact 25000 (RG03)', async () => {
    const oldPending = {
      id: 3,
      status: 'PENDING',
      amountXof: 40000,
      createdAt: new Date(Date.now() - 3 * 3600_000), // expire (> 120 min)
    };
    const { prisma } = makePrisma({
      payments: [
        { id: 1, status: 'SUCCESS', amountXof: 10000 },
        { id: 2, status: 'SUCCESS', amountXof: 15000 },
        { id: 4, status: 'FAILED', amountXof: 5000 },
        oldPending,
      ],
      enrollment: {
        ...enrollmentBase,
        payments: [
          { status: 'SUCCESS', amountXof: 10000 },
          { status: 'SUCCESS', amountXof: 15000 },
          { status: 'FAILED', amountXof: 5000 },
          { status: 'PENDING', amountXof: 40000 },
        ],
      },
    });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/u',
        providerReference: 'prov_x',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    // Solde restant = 50000 - 25000 = 25000 : FAILED et PENDING expire
    // ignores, le solde exact est accepte.
    const out = await svc.initialize(1, 25000);
    expect(out.status).toBe('PENDING');
    // Au-dela du solde : refuse (409).
    await expect(svc.initialize(1, 25001)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      }),
    });
    // Sous le minimum du sprint : refuse (400).
    await expect(svc.initialize(1, 4999)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_AMOUNT_BELOW_MINIMUM',
      }),
    });
  });

  it('prix catalogue modifie apres reservation : le plafond reste le total fige', async () => {
    // L inscription a fige 50 000 XOF ; le catalogue affiche desormais
    // 60 000 XOF. initialize ne lit jamais sprint.priceXof : seul le
    // total de l inscription borne les versements.
    const { prisma } = makePrisma({
      enrollment: {
        ...enrollmentBase,
        totalAmountXof: 50000,
        payments: [],
        sprint: { minimumPaymentXof: 5000, status: 'ACTIVE' },
      },
    });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/u',
        providerReference: 'prov_x',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await svc.initialize(1, 50000);
    await expect(svc.initialize(1, 50001)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      }),
    });
  });

  it('verrouille la ligne inscription dans la transaction (anti-concurrence RG06)', async () => {
    const { prisma, txApi } = makePrisma({
      enrollment: { ...enrollmentBase },
    });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/u',
        providerReference: 'prov_x',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await svc.initialize(1, 10000);
    expect(txApi.$queryRaw).toHaveBeenCalled();
    const queryRaw = txApi.$queryRaw as unknown as {
      mock: { calls: [strings: string[], ...args: unknown[]][] };
    };
    const sql = queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toMatch(/FOR UPDATE/);
  });

  it('devise Paystack differente => FAILED sans toucher l inscription (RG09)', async () => {
    const pending = {
      id: 9,
      enrollmentId: 1,
      amountXof: 10000,
      currency: 'XOF',
      reference: 'sp_9',
      providerReference: 'sp_9',
      status: 'PENDING',
    };
    const { prisma, store } = makePrisma({
      payments: [{ id: 9, status: 'PENDING', amountXof: 10000 }],
      enrollment: { ...enrollmentBase },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      ...pending,
      enrollment: { totalAmountXof: 50000, payments: [] },
    });
    const paystack = {
      initializeTransaction: jest.fn(),
      // Montant exact a l echelle Paystack (10000 x 100) mais devise
      // inattendue : la transaction ne correspond pas.
      verifyTransaction: jest.fn(async () => ({
        status: 'success',
        reference: 'sp_9',
        amount: 1000000,
        currency: 'NGN',
      })),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    await expect(svc.verify('sp_9')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_VERIFICATION_MISMATCH',
      }),
    });
    expect(store.updated[0]).toMatchObject({ status: 'FAILED' });
  });

  it('dossier DUO : le minimum duo fait foi quand il est defini', async () => {
    const { prisma } = makePrisma({
      enrollment: {
        ...enrollmentBase,
        plan: 'DUO',
        totalAmountXof: 80000,
        sprint: {
          minimumPaymentXof: 5000,
          duoMinimumPaymentXof: 10000,
          status: 'ACTIVE',
        },
        payments: [],
      },
    });
    const paystack = {
      initializeTransaction: jest.fn(async () => ({
        authorizationUrl: 'https://checkout.paystack.com/u',
        providerReference: 'prov_duo',
      })),
      verifyTransaction: jest.fn(),
      checkSignature: jest.fn(),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    // 8 000 < minimum duo 10 000 : refuse, meme si >= minimum single.
    await expect(svc.initialize(1, 8000)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYMENT_AMOUNT_BELOW_MINIMUM',
      }),
    });
    const out = await svc.initialize(1, 10000);
    expect(out.status).toBe('PENDING');
  });

  it('webhook duplique : le second ne re-verifie pas (idempotence RG11)', async () => {
    const done = {
      id: 7,
      enrollmentId: 1,
      amountXof: 10000,
      currency: 'XOF',
      reference: 'sp_dup',
      providerReference: 'sp_dup',
      status: 'SUCCESS',
      paidAt: new Date(),
    };
    const { prisma } = makePrisma({
      payments: [{ id: 7, status: 'SUCCESS', amountXof: 10000 }],
      enrollment: {
        ...enrollmentBase,
        payments: [{ status: 'SUCCESS', amountXof: 10000 }],
      },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(done);
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(done);
    const paystack = {
      initializeTransaction: jest.fn(),
      verifyTransaction: jest.fn(async () => {
        throw new Error('ne doit pas etre appele si deja SUCCESS');
      }),
      checkSignature: jest.fn(() => true),
      callbackUrl: 'http://cb',
    };
    const svc = new PaymentsService(
      prisma as never,
      paystack as unknown as PaystackService,
      { get: () => 'XOF' } as unknown as ConfigService,
    );
    const body = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: 'sp_dup' },
      }),
    );
    const first = await svc.handleWebhook(body, 'sig');
    const second = await svc.handleWebhook(body, 'sig');
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(first).toMatchObject({ status: 'SUCCESS' });
    expect(second).toMatchObject({ status: 'SUCCESS' });
  });
});
