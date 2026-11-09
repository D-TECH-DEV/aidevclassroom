/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
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
        findFirst: jest.fn(async ({ where, orderBy }: never) => {
          const w = where as {
            OR?: { reference?: string; providerReference?: string }[];
            enrollmentId?: number;
            amountXof?: number;
            status?: string;
            createdAt?: { gte?: Date };
          };
          const matches = (p: unknown) => {
            const r = p as unknown as Record<string, unknown>;
            if (w.OR) {
              return w.OR.some(
                (c) =>
                  (c.reference && r.reference === c.reference) ||
                  (c.providerReference &&
                    r.providerReference === c.providerReference),
              );
            }
            if (
              w.enrollmentId !== undefined &&
              r['enrollmentId'] !== w.enrollmentId
            ) {
              return false;
            }
            if (w.amountXof !== undefined && r['amountXof'] !== w.amountXof) {
              return false;
            }
            if (w.status !== undefined && r['status'] !== w.status) {
              return false;
            }
            const gte = w.createdAt?.gte;
            if (gte && !((r['createdAt'] as Date) >= gte)) return false;
            return true;
          };
          const found = store.payments.filter(matches);
          // orderBy createdAt desc : la tentative la plus recente gagne.
          if (orderBy) return found.length ? found[found.length - 1] : null;
          return found.length ? found[0] : null;
        }),
        findMany: jest.fn(async () => store.payments.map((p) => ({ ...p }))),
        update: txApi.payment.update,
        updateMany: jest.fn(async ({ where, data }: never) => {
          const w = where as {
            status?: string;
            createdAt?: { lt?: Date };
          };
          const d = data as { status: string };
          let count = 0;
          store.payments = store.payments.map((p) => {
            const r = p as unknown as Record<string, unknown>;
            const matchStatus =
              w.status === undefined || r['status'] === w.status;
            const createdAt = r['createdAt'] as Date | undefined;
            const matchDate =
              !w.createdAt?.lt ||
              (createdAt instanceof Date && createdAt < w.createdAt.lt);
            if (matchStatus && matchDate) {
              count++;
              return { ...p, status: d.status };
            }
            return p;
          });
          return { count };
        }),
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

  describe('Canal Charge mobile money (LOT B)', () => {
    function chargeConfig(extra: Record<string, string> = {}) {
      const values: Record<string, string> = {
        PAYSTACK_CURRENCY: 'XOF',
        PAYSTACK_CHARGE_ENABLED: 'true',
        PAYSTACK_CHARGE_PROVIDERS: 'mtn,orange,wave',
        PAYSTACK_PENDING_RESERVE_MINUTES: '120',
        PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES: '15',
        ...extra,
      };
      return { get: (k: string) => values[k] } as unknown as ConfigService;
    }

    function chargePaystack(overrides: {
      initializeTransaction?: jest.Mock;
      chargeMobileMoney?: jest.Mock;
      verifyTransaction?: jest.Mock;
      checkSignature?: jest.Mock;
      callbackUrl?: string;
    } = {}) {
      return {
        initializeTransaction: jest.fn(),
        chargeMobileMoney: jest.fn(),
        verifyTransaction: jest.fn(),
        checkSignature: jest.fn(() => true),
        callbackUrl: 'http://cb',
        ...overrides,
      };
    }

    it.each(['mtn', 'orange', 'wave'])(
      'charge %s : payload POST /charge, PENDING + display_text, ancien flux inactif',
      async (provider) => {
        const { prisma, store } = makePrisma({
          enrollment: { ...enrollmentBase },
        });
        const paystack = chargePaystack({
          chargeMobileMoney: jest.fn(async () => ({
            outcome: 'pending_user_action',
            providerReference: `prov_${provider}_1`,
            displayText: 'Validez le paiement sur votre telephone.',
            rawStatus: 'pay_offline',
          })),
        });
        const svc = new PaymentsService(
          prisma as never,
          paystack as unknown as PaystackService,
          chargeConfig(),
        );
        const out = await svc.initialize(1, 10000, {
          provider,
          phone: '2250551234987',
        });
        expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
        expect(paystack.chargeMobileMoney).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'amina@example.com',
            amountXof: 10000,
            phone: '2250551234987',
            provider,
            reference: expect.any(String),
          }),
        );
        expect(paystack.initializeTransaction).not.toHaveBeenCalled();
        expect(out).toMatchObject({
          status: 'PENDING',
          authorizationUrl: null,
          displayText: 'Validez le paiement sur votre telephone.',
          chargeStatus: 'pay_offline',
        });
        expect(store.updated[0]).toMatchObject({
          status: 'PENDING',
          providerReference: `prov_${provider}_1`,
        });
      },
    );

    it('charge pending : verify ulterieur passe a SUCCESS (fenetre 180 s)', async () => {
      const { prisma, store } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = chargePaystack({
        chargeMobileMoney: jest.fn(async () => ({
          outcome: 'pending',
          providerReference: 'prov_mtn_9',
          rawStatus: 'pending',
        })),
        verifyTransaction: jest.fn(async () => ({
          status: 'success',
          reference: 'prov_mtn_9',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const init = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(init).toMatchObject({ status: 'PENDING' });
      const created = store.created[0] as unknown as {
        id: number;
        reference: string;
      };
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: created.id,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: created.reference,
        providerReference: 'prov_mtn_9',
        status: 'PENDING',
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const out = await svc.verify(created.reference);
      expect(paystack.verifyTransaction).toHaveBeenCalledWith('prov_mtn_9');
      expect(out).toMatchObject({ status: 'SUCCESS' });
    });

    it('charge success : confirmation serveur puis SUCCESS', async () => {
      const { prisma } = makePrisma({ enrollment: { ...enrollmentBase } });
      const paystack = chargePaystack({
        chargeMobileMoney: jest.fn(async () => ({
          outcome: 'success',
          providerReference: 'prov_orange_3',
          rawStatus: 'success',
        })),
        verifyTransaction: jest.fn(async () => ({
          status: 'success',
          reference: 'prov_orange_3',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const out = await svc.initialize(1, 10000, {
        provider: 'orange',
        phone: '2250551234987',
      });
      expect(paystack.verifyTransaction).toHaveBeenCalledWith('prov_orange_3');
      expect(out).toMatchObject({ status: 'SUCCESS' });
    });

    it('charge failed : FAILED + 422 PAYMENT_CHARGE_FAILED', async () => {
      const { prisma, store } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = chargePaystack({
        chargeMobileMoney: jest.fn(async () => ({
          outcome: 'failed',
          providerReference: 'prov_wave_2',
          rawStatus: 'failed',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      await expect(
        svc.initialize(1, 10000, {
          provider: 'wave',
          phone: '2250551234987',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAYMENT_CHARGE_FAILED' }),
      });
      expect(store.updated[0]).toMatchObject({
        status: 'FAILED',
        providerReference: 'prov_wave_2',
      });
    });

    it('flag desactive : provider fourni mais ancien flux conserve', async () => {
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
        { get: () => 'XOF' } as unknown as ConfigService,
      );
      const out = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(paystack.initializeTransaction).toHaveBeenCalledTimes(1);
      expect(out.authorizationUrl).toBe('https://checkout.paystack.com/xyz');
    });

    it('provider inconnu ou telephone invalide : 400 sans appel fournisseur', async () => {
      const { prisma } = makePrisma({ enrollment: { ...enrollmentBase } });
      const paystack = chargePaystack();
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      await expect(
        svc.initialize(1, 10000, {
          provider: 'moov',
          phone: '2250551234987',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAYMENT_PROVIDER_INVALID' }),
      });
      await expect(
        svc.initialize(1, 10000, { provider: 'mtn', phone: '0551234987' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAYMENT_PHONE_INVALID' }),
      });
      await expect(
        svc.initialize(1, 10000, { provider: 'mtn' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAYMENT_PHONE_INVALID' }),
      });
      expect(paystack.chargeMobileMoney).not.toHaveBeenCalled();
      expect(paystack.initializeTransaction).not.toHaveBeenCalled();
    });

    it('collision de reference (P2002) : nouvelle tentative au lieu du 409 direct', async () => {
      const { prisma, txApi } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
      (txApi.payment.create as jest.Mock).mockRejectedValueOnce(p2002);
      const paystack = chargePaystack({
        initializeTransaction: jest.fn(async () => ({
          authorizationUrl: 'https://checkout.paystack.com/u',
          providerReference: 'prov_x',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig({ PAYSTACK_CHARGE_ENABLED: 'false' }),
      );
      const out = await svc.initialize(1, 10000);
      expect(out.status).toBe('PENDING');
      expect(txApi.payment.create).toHaveBeenCalledTimes(2);
    });

    it('collisions persistantes : 409 PAYMENT_REFERENCE_CONFLICT apres essais bornes', async () => {
      const { prisma, txApi } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
      (txApi.payment.create as jest.Mock).mockRejectedValue(p2002);
      const paystack = chargePaystack();
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig({ PAYSTACK_CHARGE_ENABLED: 'false' }),
      );
      await expect(svc.initialize(1, 10000)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PAYMENT_REFERENCE_CONFLICT',
        }),
      });
      expect(txApi.payment.create).toHaveBeenCalledTimes(5);
    });

    it('verify sur FAILED recent : court-circuit sans appel fournisseur', async () => {
      const failed = {
        id: 11,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_11',
        providerReference: 'sp_11',
        status: 'FAILED',
        updatedAt: new Date(),
      };
      const { prisma } = makePrisma({
        payments: [{ id: 11, status: 'FAILED', amountXof: 10000 }],
        enrollment: { ...enrollmentBase },
      });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...failed,
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const paystack = chargePaystack({
        verifyTransaction: jest.fn(async () => {
          throw new Error('ne doit pas etre appele si FAILED recent');
        }),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      await expect(svc.verify('sp_11')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PAYMENT_VERIFICATION_MISMATCH',
        }),
      });
      expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    });

    it('verify sur FAILED ancien : re-verification normale', async () => {
      const failed = {
        id: 12,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_12',
        providerReference: 'sp_12',
        status: 'FAILED',
        updatedAt: new Date(Date.now() - 3600_000),
      };
      const { prisma } = makePrisma({
        payments: [{ id: 12, status: 'FAILED', amountXof: 10000 }],
        enrollment: { ...enrollmentBase },
      });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...failed,
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const paystack = chargePaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'success',
          reference: 'sp_12',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const out = await svc.verify('sp_12');
      expect(paystack.verifyTransaction).toHaveBeenCalledTimes(1);
      expect(out).toMatchObject({ status: 'SUCCESS' });
    });

    it('idempotence : SUCCESS via Charge ne re-verifie pas (providerReference distincte)', async () => {
      const done = {
        id: 31,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_31',
        providerReference: 'prov_mtn_31',
        status: 'SUCCESS',
        paidAt: new Date(),
      };
      const { prisma } = makePrisma({
        payments: [{ id: 31, status: 'SUCCESS', amountXof: 10000 }],
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
      const paystack = chargePaystack({
        verifyTransaction: jest.fn(async () => {
          throw new Error('ne doit pas etre appele si deja SUCCESS');
        }),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const out = await svc.verify('sp_31');
      expect(paystack.verifyTransaction).not.toHaveBeenCalled();
      expect(out).toMatchObject({ status: 'SUCCESS' });
    });

    it('webhook non charge.success : lecture seule, aucune ecriture', async () => {
      const { prisma, store } = makePrisma({
        payments: [{ id: 9, status: 'PENDING', amountXof: 10000 }],
        enrollment: { ...enrollmentBase },
      });
      const paystack = chargePaystack({
        verifyTransaction: jest.fn(),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const body = Buffer.from(
        JSON.stringify({
          event: 'charge.failed',
          data: { reference: 'sp_9' },
        }),
      );
      const out = await svc.handleWebhook(body, 'sig');
      expect(out).toEqual({ received: true, processed: false });
      expect(store.updated).toHaveLength(0);
      expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    });

    it('expiration : PENDING perime -> ABANDONED, les autres statuts intacts', async () => {
      const { prisma, store } = makePrisma({
        payments: [
          {
            id: 21,
            status: 'PENDING',
            amountXof: 5000,
            createdAt: new Date(Date.now() - 3 * 3600_000),
          },
          {
            id: 22,
            status: 'PENDING',
            amountXof: 5000,
            createdAt: new Date(),
          },
          {
            id: 23,
            status: 'SUCCESS',
            amountXof: 5000,
            createdAt: new Date(Date.now() - 3 * 3600_000),
          },
        ],
        enrollment: { ...enrollmentBase },
      });
      const svc = new PaymentsService(
        prisma as never,
        chargePaystack() as unknown as PaystackService,
        chargeConfig(),
      );
      const out = await svc.expireStalePendingPayments();
      expect(out).toEqual({ expired: 1 });
      const byId = Object.fromEntries(
        store.payments.map((p) => [
          (p as unknown as { id: number }).id,
          p as unknown as Record<string, unknown>,
        ]),
      );
      expect(byId[21]).toMatchObject({ status: 'ABANDONED' });
      expect(byId[22]).toMatchObject({ status: 'PENDING' });
      expect(byId[23]).toMatchObject({ status: 'SUCCESS' });
    });

    it('ABANDONED paye : re-verifiable via verify', async () => {
      const abandoned = {
        id: 41,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_41',
        providerReference: 'prov_mtn_41',
        status: 'ABANDONED',
      };
      const { prisma } = makePrisma({
        payments: [{ id: 41, status: 'ABANDONED', amountXof: 10000 }],
        enrollment: { ...enrollmentBase },
      });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...abandoned,
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const paystack = chargePaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'success',
          reference: 'prov_mtn_41',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        chargeConfig(),
      );
      const out = await svc.verify('sp_41');
      expect(out).toMatchObject({ status: 'SUCCESS' });
    });
  });

  describe('Durcissement (LOT D)', () => {
    function dConfig(extra: Record<string, string> = {}) {
      const values: Record<string, string> = {
        PAYSTACK_CURRENCY: 'XOF',
        PAYSTACK_CHARGE_ENABLED: 'true',
        PAYSTACK_CHARGE_PROVIDERS: 'mtn,orange,wave',
        PAYSTACK_PENDING_RESERVE_MINUTES: '120',
        PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES: '15',
        ...extra,
      };
      return { get: (k: string) => values[k] } as unknown as ConfigService;
    }

    function dPaystack(overrides: Record<string, jest.Mock> = {}) {
      return {
        initializeTransaction: jest.fn(async () => ({
          authorizationUrl: 'https://checkout.paystack.com/u',
          providerReference: 'prov_x',
        })),
        chargeMobileMoney: jest.fn(async () => ({
          outcome: 'pending_user_action',
          providerReference: 'prov_mtn_1',
          displayText: 'Validez le paiement sur votre telephone.',
          rawStatus: 'pay_offline',
        })),
        verifyTransaction: jest.fn(),
        checkSignature: jest.fn(() => true),
        callbackUrl: 'http://cb',
        ...overrides,
      };
    }

    function dSvc(
      prisma: unknown,
      paystack: unknown,
      config?: ConfigService,
    ) {
      return new PaymentsService(
        prisma as never,
        paystack as unknown as PaystackService,
        config ?? dConfig(),
      );
    }

    /** Ajoute une ligne complete au faux Prisma (reference, provider...). */
    function ajouteLigne(
      store: { payments: unknown[] },
      ligne: Record<string, unknown>,
    ) {
      (store.payments as unknown as Record<string, unknown>[]).push(ligne);
    }

    it.each(['pending', 'pay_offline', 'ongoing', 'send_otp'])(
      'verify transitoire (%s) : reste PENDING, jamais FAILED',
      async (transitoire) => {
        const ligne = {
          id: 51,
          enrollmentId: 1,
          amountXof: 10000,
          currency: 'XOF',
          reference: 'sp_51',
          providerReference: 'prov_mtn_51',
          status: 'PENDING',
          authorizationUrl: null,
          providerResponse: {
            sanitized: true,
            status: 'pay_offline',
            display_text: 'Validez le paiement sur votre telephone.',
            provider: 'mtn',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const { prisma, store } = makePrisma({
          payments: [],
          enrollment: { ...enrollmentBase },
        });
        ajouteLigne(store, { ...ligne });
        (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
          ...ligne,
          enrollment: { totalAmountXof: 50000, payments: [] },
        });
        const paystack = dPaystack({
          verifyTransaction: jest.fn(async () => ({
            status: transitoire,
            reference: 'prov_mtn_51',
            amount: 1000000,
            currency: 'XOF',
          })),
        });
        const out = await dSvc(prisma, paystack).verify('sp_51');
        expect(out).toMatchObject({ status: 'PENDING' });
        // Aucune ligne passee a FAILED, la marque operateur est conservee.
        expect(
          store.payments.every(
            (p) =>
              (p as unknown as Record<string, unknown>)['status'] !== 'FAILED',
          ),
        ).toBe(true);
        const maj = store.updated[store.updated.length - 1] as unknown as {
          providerResponse: Record<string, unknown>;
        };
        expect(maj.providerResponse['provider']).toBe('mtn');
        expect(maj.providerResponse['display_text']).toBe(
          'Validez le paiement sur votre telephone.',
        );
      },
    );

    it('verify transitoire avec reference inconnue : FAILED (rejet ferme)', async () => {
      const ligne = {
        id: 52,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_52',
        providerReference: 'prov_mtn_52',
        status: 'PENDING',
        authorizationUrl: null,
        providerResponse: { sanitized: true, provider: 'mtn' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { prisma, store } = makePrisma({
        payments: [],
        enrollment: { ...enrollmentBase },
      });
      ajouteLigne(store, { ...ligne });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...ligne,
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'pending',
          reference: 'prov_intrus',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      await expect(dSvc(prisma, paystack).verify('sp_52')).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            code: 'PAYMENT_VERIFICATION_MISMATCH',
          }),
        },
      );
      expect(store.updated[store.updated.length - 1]).toMatchObject({
        status: 'FAILED',
      });
    });

    it('verify failed terminal : FAILED + 422 PAYMENT_VERIFICATION_MISMATCH', async () => {
      const ligne = {
        id: 53,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_53',
        providerReference: 'prov_mtn_53',
        status: 'PENDING',
        authorizationUrl: null,
        providerResponse: { sanitized: true, provider: 'mtn' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { prisma, store } = makePrisma({
        payments: [],
        enrollment: { ...enrollmentBase },
      });
      ajouteLigne(store, { ...ligne });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...ligne,
        enrollment: { totalAmountXof: 50000, payments: [] },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'failed',
          reference: 'prov_mtn_53',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      await expect(dSvc(prisma, paystack).verify('sp_53')).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            code: 'PAYMENT_VERIFICATION_MISMATCH',
          }),
        },
      );
      expect(store.updated[store.updated.length - 1]).toMatchObject({
        status: 'FAILED',
      });
    });

    it('double-clic : la seconde demande reutilise la charge, aucun second debit', async () => {
      const { prisma } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'pay_offline',
          reference: 'prov_mtn_1',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = dSvc(prisma, paystack);
      const premier = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(premier).toMatchObject({ status: 'PENDING' });
      const second = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      // Un seul POST /charge, meme reference, consigne conservee.
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
      expect(second).toMatchObject({
        status: 'PENDING',
        reference: premier.reference,
        displayText: 'Validez le paiement sur votre telephone.',
        chargeStatus: 'pay_offline',
      });
    });

    it('tentative payee entre-temps : la re-verification rend SUCCESS sans re-debiter', async () => {
      const { prisma } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'success',
          reference: 'prov_mtn_1',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      const svc = dSvc(prisma, paystack);
      const premier = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      const second = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
      expect(second).toMatchObject({
        status: 'SUCCESS',
        reference: premier.reference,
      });
    });

    it('operateur different : nouvelle charge (les canaux ne se melangent pas)', async () => {
      const { prisma } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack();
      (paystack.chargeMobileMoney as jest.Mock)
        .mockResolvedValueOnce({
          outcome: 'pending_user_action',
          providerReference: 'prov_mtn_1',
          displayText: 'Validez le paiement sur votre telephone.',
          rawStatus: 'pay_offline',
        })
        .mockResolvedValueOnce({
          outcome: 'pending_user_action',
          providerReference: 'prov_orange_1',
          displayText: 'Validez le paiement sur votre telephone.',
          rawStatus: 'pay_offline',
        });
      const svc = dSvc(prisma, paystack);
      const mtn = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      const orange = await svc.initialize(1, 10000, {
        provider: 'orange',
        phone: '2250701234987',
      });
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(2);
      expect(orange.reference).not.toBe(mtn.reference);
    });

    it('ancienne tentative echouee : une nouvelle charge part', async () => {
      const { prisma, store } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => ({
          status: 'failed',
          reference: 'prov_mtn_1',
          amount: 1000000,
          currency: 'XOF',
        })),
      });
      (paystack.chargeMobileMoney as jest.Mock)
        .mockResolvedValueOnce({
          outcome: 'pending_user_action',
          providerReference: 'prov_mtn_1',
          displayText: 'Validez le paiement sur votre telephone.',
          rawStatus: 'pay_offline',
        })
        .mockResolvedValueOnce({
          outcome: 'pending_user_action',
          providerReference: 'prov_mtn_2',
          displayText: 'Validez le paiement sur votre telephone.',
          rawStatus: 'pay_offline',
        });
      const svc = dSvc(prisma, paystack);
      const premier = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      const second = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(2);
      expect(second.reference).not.toBe(premier.reference);
      expect(
        store.payments.find(
          (p) =>
            (p as unknown as Record<string, unknown>)['reference'] ===
            premier.reference,
        ),
      ).toMatchObject({ status: 'FAILED' });
    });

    it('fournisseur injoignable a la re-verification : la reservation est gardee', async () => {
      const { prisma } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack({
        verifyTransaction: jest.fn(async () => {
          throw new Error('PAYSTACK_VERIFY_FAILED: timeout');
        }),
      });
      const svc = dSvc(prisma, paystack);
      const premier = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      const second = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
      expect(second).toMatchObject({
        status: 'PENDING',
        reference: premier.reference,
      });
    });

    it('charge expiree (> 10 min) : nouvelle charge, pas de reutilisation', async () => {
      const { prisma, store } = makePrisma({
        payments: [],
        enrollment: { ...enrollmentBase },
      });
      ajouteLigne(store, {
        id: 61,
        enrollmentId: 1,
        amountXof: 10000,
        currency: 'XOF',
        reference: 'sp_vieux',
        providerReference: 'prov_mtn_vieux',
        status: 'PENDING',
        authorizationUrl: null,
        providerResponse: { sanitized: true, provider: 'mtn' },
        createdAt: new Date(Date.now() - 2 * 3600_000),
        updatedAt: new Date(Date.now() - 2 * 3600_000),
      });
      const paystack = dPaystack();
      const svc = dSvc(prisma, paystack);
      const init = await svc.initialize(1, 10000, {
        provider: 'mtn',
        phone: '2250551234987',
      });
      expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
      expect(init.reference).not.toBe('sp_vieux');
    });

    it('initialize marque les PENDING abandonnes (expiration enfin appelee)', async () => {
      const { prisma, store } = makePrisma({
        payments: [],
        enrollment: { ...enrollmentBase },
      });
      ajouteLigne(store, {
        id: 71,
        enrollmentId: 1,
        amountXof: 5000,
        currency: 'XOF',
        reference: 'sp_perime',
        providerReference: null,
        status: 'PENDING',
        authorizationUrl: 'https://checkout.paystack.com/vieux',
        providerResponse: null,
        createdAt: new Date(Date.now() - 3 * 3600_000),
        updatedAt: new Date(Date.now() - 3 * 3600_000),
      });
      const svc = dSvc(prisma, dPaystack());
      await svc.initialize(1, 10000);
      const perime = store.payments.find(
        (p) =>
          (p as unknown as Record<string, unknown>)['reference'] ===
          'sp_perime',
      ) as unknown as Record<string, unknown>;
      expect(perime['status']).toBe('ABANDONED');
    });

    it('numero sans operateur : 400 PAYMENT_PROVIDER_INVALID, sans appel fournisseur', async () => {
      const { prisma } = makePrisma({
        enrollment: { ...enrollmentBase },
      });
      const paystack = dPaystack();
      await expect(
        dSvc(prisma, paystack).initialize(1, 10000, {
          phone: '2250551234987',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PAYMENT_PROVIDER_INVALID',
        }),
      });
      expect(paystack.chargeMobileMoney).not.toHaveBeenCalled();
      expect(paystack.initializeTransaction).not.toHaveBeenCalled();
    });
  });
});
