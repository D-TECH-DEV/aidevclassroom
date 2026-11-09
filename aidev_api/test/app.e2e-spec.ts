import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, createHmac } from 'crypto';
import { json } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_FILTER)
      .useValue(new AllExceptionsFilter())
      .overrideProvider(APP_INTERCEPTOR)
      .useValue(new TransformInterceptor())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  it('/api/v1/health (GET) repond 200', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('routes admin interdites sans JWT (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/sprints').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/payments')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard/summary')
      .expect(401);
  });

  it('webhook sans signature invalide rejette sans effet (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/payments/webhook/paystack')
      .send({ event: 'charge.success', data: { reference: 'sp_x' } })
      .expect(400);
  });

  it('inscription avec corps invalide => 400, pas 500', () => {
    return request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .send({ sprintId: 'nan' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});

/**
 * Paiements Charge (LOT D) : Paystack est MOQUE au niveau HTTP (fetch),
 * aucune cle live n'est utilisee. Chaque test pilote les statuts
 * pay_offline / pending / success / failed via `scenario`. Prisma est
 * remplace par un stockage en memoire ; le corps brut du webhook est
 * conserve comme en production (voir `src/main.ts`) pour que la signature
 * HMAC-SHA512 soit verifiee sur les octets exacts.
 */
describe('Paiements Charge (Paystack moque, LOT D)', () => {
  let app: INestApplication<App>;

  const JETON_SUIVI = 'test_tracking_token_0123456789abcdef';
  const SECRET = process.env.PAYSTACK_SECRET_KEY as string;

  function hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  function signe(corps: Buffer): string {
    return createHmac('sha512', SECRET).update(corps).digest('hex');
  }

  type Ligne = {
    id: number;
    enrollmentId: number;
    amountXof: number;
    currency: string;
    reference: string;
    providerReference: string | null;
    status: string;
    authorizationUrl: string | null;
    providerResponse: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
  };

  // Scenario Paystack pilote par chaque test (jamais de cle live).
  const scenario = {
    chargeStatus: 'pay_offline',
    verifyStatus: 'success',
    verifyAmount: 1000000,
    verifyCurrency: 'XOF',
    checkoutUrl: 'https://checkout.paystack.com/e2e_checkout',
  };

  const appels = { charge: 0, verify: 0, initialize: 0 };

  // Dernier corps envoye a POST /charge : prouve le contrat montant x100 +
  // mobile_money { phone, provider } au niveau HTTP.
  const dernierCharge: { corps: Record<string, unknown> | null } = {
    corps: null,
  };

  function scenarioDefaut() {
    scenario.chargeStatus = 'pay_offline';
    scenario.verifyStatus = 'success';
    scenario.verifyAmount = 1000000;
    scenario.verifyCurrency = 'XOF';
    scenario.checkoutUrl = 'https://checkout.paystack.com/e2e_checkout';
    appels.charge = 0;
    appels.verify = 0;
    appels.initialize = 0;
    dernierCharge.corps = null;
  }

  async function fauxFetch(
    url: unknown,
    init?: { body?: unknown },
  ): Promise<unknown> {
    const u = String(url);
    const corps =
      init?.body != null
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
    if (u.endsWith('/charge')) {
      appels.charge += 1;
      dernierCharge.corps = corps;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Charge attempted',
          data: {
            status: scenario.chargeStatus,
            reference: corps['reference'],
            display_text:
              scenario.chargeStatus === 'success'
                ? undefined
                : 'Validez le paiement sur votre telephone.',
          },
        }),
      };
    }
    if (u.includes('/transaction/verify/')) {
      appels.verify += 1;
      const reference = decodeURIComponent(u.split('/transaction/verify/')[1]);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Verification successful',
          data: {
            status: scenario.verifyStatus,
            reference,
            amount: scenario.verifyAmount,
            currency: scenario.verifyCurrency,
            channel: 'mobile_money',
          },
        }),
      };
    }
    if (u.endsWith('/transaction/initialize')) {
      appels.initialize += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: scenario.checkoutUrl,
            reference: corps['reference'],
          },
        }),
      };
    }
    throw new Error(`appel Paystack inattendu en e2e : ${u}`);
  }

  const lignes: Ligne[] = [];
  let seq = 1;

  async function creerLigne({ data }: never) {
    const ligne: Ligne = {
      id: seq++,
      providerReference: null,
      authorizationUrl: null,
      providerResponse: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(data as Omit<Ligne, 'id' | 'createdAt' | 'updatedAt'>),
    };
    lignes.push(ligne);
    return { ...ligne };
  }

  async function majLigne({ where, data }: never) {
    const w = where as { id: number };
    const i = lignes.findIndex((l) => l.id === w.id);
    lignes[i] = {
      ...lignes[i],
      ...(data as Partial<Ligne>),
      updatedAt: new Date(),
    };
    return { ...lignes[i] };
  }

  function inscription() {
    return {
      id: 1,
      status: 'CONFIRMED',
      totalAmountXof: 50000,
      student: { email: 'amina@example.com' },
      sprint: {
        minimumPaymentXof: 5000,
        duoMinimumPaymentXof: null,
        status: 'ACTIVE',
      },
      plan: 'SINGLE',
      trackingTokenHash: hashToken(JETON_SUIVI),
      payments: lignes
        .filter((l) => l.enrollmentId === 1)
        .map((l) => ({ status: l.status, amountXof: l.amountXof })),
    };
  }

  function avecDossier(ligne: Ligne) {
    return { ...ligne, enrollment: inscription() };
  }

  const fauxPrisma = {
    enrollment: {
      findUnique: jest.fn(async ({ where }: never) => {
        const id = (where as { id?: number }).id;
        return id === 1 ? inscription() : null;
      }),
    },
    payment: {
      findUnique: jest.fn(async ({ where }: never) => {
        const w = where as { reference?: string; id?: number };
        const trouve = lignes.find(
          (l) => l.reference === w.reference || l.id === w.id,
        );
        return trouve ? avecDossier(trouve) : null;
      }),
      findFirst: jest.fn(async ({ where, orderBy }: never) => {
        const w = where as {
          OR?: { reference?: string; providerReference?: string }[];
          enrollmentId?: number;
          amountXof?: number;
          status?: string;
          createdAt?: { gte?: Date };
        };
        const filtrees = lignes.filter((l) => {
          if (w.OR) {
            return w.OR.some(
              (c) =>
                (c.reference && l.reference === c.reference) ||
                (c.providerReference &&
                  l.providerReference === c.providerReference),
            );
          }
          if (w.enrollmentId !== undefined && l.enrollmentId !== w.enrollmentId)
            return false;
          if (w.amountXof !== undefined && l.amountXof !== w.amountXof)
            return false;
          if (w.status !== undefined && l.status !== w.status) return false;
          const gte = w.createdAt?.gte;
          if (gte && !(l.createdAt >= gte)) return false;
          return true;
        });
        if (filtrees.length === 0) return null;
        const trouve = orderBy
          ? filtrees[filtrees.length - 1]
          : filtrees[0];
        return avecDossier(trouve);
      }),
      findMany: jest.fn(async () => lignes.map((l) => ({ ...l }))),
      create: jest.fn(creerLigne),
      update: jest.fn(majLigne),
      updateMany: jest.fn(async ({ where, data }: never) => {
        const w = where as { status?: string; createdAt?: { lt?: Date } };
        const d = data as { status: string };
        let count = 0;
        for (const ligne of lignes) {
          const statutOk = w.status === undefined || ligne.status === w.status;
          const dateOk =
            !w.createdAt?.lt || ligne.createdAt < (w.createdAt.lt as Date);
          if (statutOk && dateOk) {
            ligne.status = d.status;
            ligne.updatedAt = new Date();
            count += 1;
          }
        }
        return { count };
      }),
    },
    $transaction: jest.fn(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest.fn(async () => []),
          payment: {
            findMany: jest.fn(async () =>
              lignes.map((l) => ({ ...l })),
            ),
            findUnique: jest.fn(async ({ where }: never) => {
              const w = where as { id: number };
              return lignes.find((l) => l.id === w.id) ?? null;
            }),
            create: jest.fn(creerLigne),
            update: jest.fn(majLigne),
          },
        }),
    ),
    $queryRaw: jest.fn(async () => []),
  };

  const vraiFetch = globalThis.fetch;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_FILTER)
      .useValue(new AllExceptionsFilter())
      .overrideProvider(APP_INTERCEPTOR)
      .useValue(new TransformInterceptor())
      .overrideProvider(PrismaService)
      .useValue(fauxPrisma)
      .compile();

    // bodyParser desactive : le seul parseur JSON est celui ci-dessous,
    // qui conserve le corps brut exact comme en production (src/main.ts).
    // Sans cela, le parseur interne de Nest consommerait le corps avant
    // et la signature HMAC-SHA512 du webhook ne pourrait pas etre verifiee
    // sur les octets exacts.
    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api/v1');
    // Comme en production (src/main.ts) : le corps brut exact est conserve
    // pour la signature HMAC-SHA512 du webhook.
    app.use(
      json({
        verify: (req: unknown, _res: unknown, buf: Buffer) => {
          (req as Record<string, unknown>)['rawBody'] = Buffer.from(buf);
        },
      }),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => {
    lignes.length = 0;
    seq = 1;
    scenarioDefaut();
    globalThis.fetch = fauxFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = vraiFetch;
  });

  afterAll(async () => {
    await app.close();
  });

  function initCharge(
    corps: Record<string, unknown>,
    jeton: string = JETON_SUIVI,
  ) {
    const requete = request(app.getHttpServer()).post(
      '/api/v1/payments/enrollments/1/initialize',
    );
    if (jeton) requete.set('x-tracking-token', jeton);
    return requete.send(corps);
  }

  it('charge mtn pay_offline : PENDING + consigne, sans redirection', async () => {
    const reponse = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    expect(reponse.body.data).toMatchObject({
      status: 'PENDING',
      authorizationUrl: null,
      displayText: 'Validez le paiement sur votre telephone.',
      chargeStatus: 'pay_offline',
    });
    expect(typeof reponse.body.data.reference).toBe('string');
    expect(appels.charge).toBe(1);
    expect(appels.initialize).toBe(0);
    // Contrat POST /charge : montant en plus petite unite (x100, XOF
    // inclus) + mobile_money { phone, provider } + reference interne.
    expect(dernierCharge.corps).toMatchObject({
      amount: 1000000,
      currency: 'XOF',
      reference: reponse.body.data.reference,
      mobile_money: { phone: '2250551234987', provider: 'mtn' },
    });
  });

  it('charge orange succes : confirmation serveur puis SUCCESS', async () => {
    scenario.chargeStatus = 'success';
    const reponse = await initCharge({
      amountXof: 10000,
      provider: 'orange',
      phone: '2250701234987',
    }).expect(201);
    expect(reponse.body.data).toMatchObject({ status: 'SUCCESS' });
    expect(appels.charge).toBe(1);
    expect(appels.verify).toBe(1);
  });

  it('charge pending (operateur en cours) : 201 PENDING, re-verifiable', async () => {
    scenario.chargeStatus = 'pending';
    const init = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    expect(init.body.data).toMatchObject({
      status: 'PENDING',
      chargeStatus: 'pending',
      authorizationUrl: null,
    });
    expect(typeof init.body.data.reference).toBe('string');
  });

  it('charge failed : 422 PAYMENT_CHARGE_FAILED, ligne marquee, aucun debit', async () => {
    scenario.chargeStatus = 'failed';
    const reponse = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(422);
    expect(reponse.body.code).toBe('PAYMENT_CHARGE_FAILED');
    expect(appels.verify).toBe(0);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].status).toBe('FAILED');
  });

  it('charge wave pending : verify ulterieur passe a SUCCESS + soldes', async () => {
    const init = await initCharge({
      amountXof: 10000,
      provider: 'wave',
      phone: '2250102030405',
    }).expect(201);
    const reference = init.body.data.reference as string;
    expect(init.body.data.status).toBe('PENDING');
    const verif = await request(app.getHttpServer())
      .get(`/api/v1/payments/${reference}/verify`)
      .set('x-tracking-token', JETON_SUIVI)
      .expect(200);
    expect(verif.body.data).toMatchObject({
      status: 'SUCCESS',
      totalPaidXof: 10000,
      remainingAmountXof: 40000,
    });
  });

  it('verify transitoire (pay_offline) : 200 PENDING, jamais FAILED', async () => {
    const init = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    const reference = init.body.data.reference as string;
    scenario.verifyStatus = 'pay_offline';
    const verif = await request(app.getHttpServer())
      .get(`/api/v1/payments/${reference}/verify`)
      .set('x-tracking-token', JETON_SUIVI)
      .expect(200);
    expect(verif.body.data.status).toBe('PENDING');
    expect(
      lignes.every((l) => l.status !== 'FAILED'),
    ).toBe(true);
  });

  it('verify failed : 422 PAYMENT_VERIFICATION_MISMATCH, ligne marquee FAILED', async () => {
    const init = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    const reference = init.body.data.reference as string;
    scenario.verifyStatus = 'failed';
    const verif = await request(app.getHttpServer())
      .get(`/api/v1/payments/${reference}/verify`)
      .set('x-tracking-token', JETON_SUIVI)
      .expect(422);
    expect(verif.body.code).toBe('PAYMENT_VERIFICATION_MISMATCH');
    expect(
      lignes.find((l) => l.reference === reference)?.status,
    ).toBe('FAILED');
  });

  it('double-clic serveur : meme reference, un seul POST /charge', async () => {
    scenario.verifyStatus = 'pay_offline';
    const corps = {
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    };
    const premier = await initCharge(corps).expect(201);
    const second = await initCharge(corps).expect(201);
    expect(second.body.data.reference).toBe(premier.body.data.reference);
    expect(appels.charge).toBe(1);
  });

  it('webhook charge.success signe : SUCCESS, duplique idempotent', async () => {
    const init = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    const reference = init.body.data.reference as string;
    const brut = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { reference } }),
    );
    const envoie = () =>
      request(app.getHttpServer())
        .post('/api/v1/payments/webhook/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', signe(brut))
        .send(brut.toString('utf8'));
    const premier = await envoie().expect(200);
    expect(premier.body.data.status).toBe('SUCCESS');
    const verifyApresPremier = appels.verify;
    const second = await envoie().expect(200);
    expect(second.body.data.status).toBe('SUCCESS');
    // Le doublon ne re-interroge pas le fournisseur.
    expect(appels.verify).toBe(verifyApresPremier);
  });

  it('webhook sans signature : 400, sans ecriture financiere', async () => {
    const brut = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { reference: 'sp_x' } }),
    );
    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'fausse')
      .send(brut.toString('utf8'))
      .expect(400);
    expect(lignes).toHaveLength(0);
    expect(appels.verify).toBe(0);
  });

  it('webhook charge.failed : accuse reception, sans ecriture', async () => {
    const init = await initCharge({
      amountXof: 10000,
      provider: 'mtn',
      phone: '2250551234987',
    }).expect(201);
    const reference = init.body.data.reference as string;
    const brut = Buffer.from(
      JSON.stringify({ event: 'charge.failed', data: { reference } }),
    );
    const reponse = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signe(brut))
      .send(brut.toString('utf8'))
      .expect(200);
    expect(reponse.body.data).toMatchObject({
      received: true,
      processed: false,
    });
    expect(appels.verify).toBe(0);
    expect(
      lignes.find((l) => l.reference === reference)?.status,
    ).toBe('PENDING');
  });

  it('ancien flux conserve : sans provider, checkout + authorizationUrl', async () => {
    const reponse = await initCharge({ amountXof: 10000 }).expect(201);
    expect(reponse.body.data).toMatchObject({
      status: 'PENDING',
      authorizationUrl: scenario.checkoutUrl,
    });
    expect(appels.initialize).toBe(1);
    expect(appels.charge).toBe(0);
  });

  it('garde-fous requete : 400 telephone, 400 provider, 401 sans jeton, 404 ref inconnue', async () => {
    await initCharge({ amountXof: 10000, provider: 'mtn', phone: '0700' }).expect(
      400,
    );
    const providerInconnu = await initCharge({
      amountXof: 10000,
      provider: 'moov',
      phone: '2250551234987',
    }).expect(400);
    expect(providerInconnu.body.code).toBe('BAD_REQUEST');
    // 401 : reference existante mais jeton de suivi absent (le guard
    // controle le paiement d'abord : sans ligne, ce serait 404).
    const init = await initCharge({ amountXof: 10000 }).expect(201);
    const reference = init.body.data.reference as string;
    const sansJeton = await request(app.getHttpServer())
      .get(`/api/v1/payments/${reference}/verify`)
      .expect(401);
    expect(sansJeton.body.code).toBe('TRACKING_TOKEN_REQUIRED');
    // 404 : reference inconnue malgre un jeton valide.
    const inconnue = await request(app.getHttpServer())
      .get('/api/v1/payments/sp_inconnue/verify')
      .set('x-tracking-token', JETON_SUIVI)
      .expect(404);
    expect(inconnue.body.code).toBe('PAYMENT_NOT_FOUND');
  });

  it('expiration : un PENDING perime devient ABANDONED a la prochaine demande', async () => {
    lignes.push({
      id: seq++,
      enrollmentId: 1,
      amountXof: 5000,
      currency: 'XOF',
      reference: 'sp_perime_e2e',
      providerReference: null,
      status: 'PENDING',
      authorizationUrl: 'https://checkout.paystack.com/vieux',
      providerResponse: null,
      createdAt: new Date(Date.now() - 3 * 3600_000),
      updatedAt: new Date(Date.now() - 3 * 3600_000),
      paidAt: null,
    });
    await initCharge({ amountXof: 10000 }).expect(201);
    expect(
      lignes.find((l) => l.reference === 'sp_perime_e2e')?.status,
    ).toBe('ABANDONED');
  });
});
