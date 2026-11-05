/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';

/** Faux Prisma minimal : partage un etat en memoire entre appels. */
function makePrisma(initial: {
  payments?: { id: number; status: string; amountXof: number }[];
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
    payment: {
      findMany: jest.fn(async () => store.payments.map((p) => ({ ...p }))),
      findUnique: jest.fn(async ({ where }: never) => {
        const w = where as { id: number };
        return store.payments.find((p) => p.id === w.id) ?? null;
      }),
      create: jest.fn(async ({ data }: never) => {
        const row = { id: seq++, ...(data as object) };
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
});
