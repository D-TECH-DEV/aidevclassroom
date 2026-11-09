import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  fromProviderAmount,
  isValidCiMobileMoneyPhone,
  mapChargeStatus,
  PaystackService,
  sanitizeProviderPayload,
  toProviderAmount,
  verifyWebhookSignature,
} from './paystack.service';

const SECRET = 'whsec_test_1234567890';

function sign(body: Buffer): string {
  return createHmac('sha512', SECRET).update(body).digest('hex');
}

describe('Paystack : signature webhook (RG10)', () => {
  const body = Buffer.from(JSON.stringify({ event: 'charge.success' }));

  it('accepte une signature valide', () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejette une signature invalide, absente ou un corps altere', () => {
    expect(verifyWebhookSignature(body, 'deadbeef', SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(Buffer.from('{}'), sign(body), SECRET)).toBe(
      false,
    );
  });
});

describe('Paystack : conversion de devise isolee (CDC section 2)', () => {
  // Documentation officielle Paystack (API Reference, "Supported
  // currency") : tous les montants partent en plus petite unite, x100,
  // y compris le XOF qui n'a pas de sous-unite en circulation :
  // "While there is no subunit for XOF, developers must multiply the
  // amount by 100 regardless." L'ancienne attente (XOF sans facteur)
  // faisait debiter 100x moins que le prix reel : elle etait fausse.
  it('applique le facteur 100 au XOF, comme a toutes les devises', () => {
    expect(toProviderAmount(10000, 'XOF')).toBe(1000000);
    expect(fromProviderAmount(1000000, 'XOF')).toBe(10000);
  });

  it('convertit les devises a sous-unites (NGN/GHS x100)', () => {
    expect(toProviderAmount(10000, 'NGN')).toBe(1000000);
    expect(fromProviderAmount(1000000, 'NGN')).toBe(10000);
  });

  it('le round-trip conserve le montant exact en XOF', () => {
    for (const montant of [1, 5000, 15000, 50000, 250000]) {
      expect(fromProviderAmount(toProviderAmount(montant, 'XOF'), 'XOF')).toBe(
        montant,
      );
    }
  });

  it('refuse les montants non entiers ou negatifs', () => {
    expect(() => toProviderAmount(10.5, 'XOF')).toThrow(
      'PAYSTACK_AMOUNT_INVALID',
    );
    expect(() => toProviderAmount(0, 'XOF')).toThrow('PAYSTACK_AMOUNT_INVALID');
    expect(() => fromProviderAmount(-100, 'XOF')).toThrow(
      'PAYSTACK_AMOUNT_INVALID',
    );
  });

  it('expurge la reponse fournisseur avant stockage', () => {
    const clean = sanitizeProviderPayload({
      status: true,
      data: {
        status: 'success',
        reference: 'sp_abc',
        amount: 10000,
        currency: 'XOF',
        authorization: { authorization_code: 'SECRET' },
        customer: { email: 'a@b.c', card: '4111' },
      },
    });
    expect(JSON.stringify(clean)).not.toContain('authorization_code');
    expect(JSON.stringify(clean)).not.toContain('4111');
    expect(clean['reference']).toBe('sp_abc');
  });

  it('conserve le display_text de la Charge et expurge le reste', () => {
    const clean = sanitizeProviderPayload({
      status: true,
      data: {
        status: 'pay_offline',
        reference: 'sp_charge_1',
        amount: 1000000,
        currency: 'XOF',
        display_text: 'Validez le paiement sur votre telephone.',
        authorization: { authorization_code: 'SECRET' },
        customer: { phone: '2250551234987' },
      },
    });
    expect(clean['display_text']).toBe(
      'Validez le paiement sur votre telephone.',
    );
    expect(JSON.stringify(clean)).not.toContain('authorization_code');
    expect(JSON.stringify(clean)).not.toContain('2250551234987');
  });
});

describe('Charge mobile money : telephone et statuts (LOT B)', () => {
  it('valide le format E.164 ivoirien strict 225XXXXXXXXXX', () => {
    expect(isValidCiMobileMoneyPhone('2250551234987')).toBe(true);
    expect(isValidCiMobileMoneyPhone('2250102030405')).toBe(true);
  });

  it('rejette les numeros non E.164 strict', () => {
    expect(isValidCiMobileMoneyPhone('0551234987')).toBe(false);
    expect(isValidCiMobileMoneyPhone('+2250551234987')).toBe(false);
    expect(isValidCiMobileMoneyPhone('225 0551234987')).toBe(false);
    expect(isValidCiMobileMoneyPhone('22505512349')).toBe(false);
    expect(isValidCiMobileMoneyPhone('22505512349870')).toBe(false);
    expect(isValidCiMobileMoneyPhone('22505A123498')).toBe(false);
    expect(isValidCiMobileMoneyPhone('')).toBe(false);
    expect(isValidCiMobileMoneyPhone(undefined)).toBe(false);
    expect(isValidCiMobileMoneyPhone(null)).toBe(false);
    expect(isValidCiMobileMoneyPhone(2250551234987)).toBe(false);
  });

  it('normalise les statuts POST /charge (sandbox)', () => {
    expect(mapChargeStatus('success')).toBe('success');
    expect(mapChargeStatus('pay_offline')).toBe('pending_user_action');
    expect(mapChargeStatus('pending')).toBe('pending');
    expect(mapChargeStatus('send_otp')).toBe('otp_required');
    expect(mapChargeStatus('failed')).toBe('failed');
    expect(mapChargeStatus('timeout')).toBe('failed');
    expect(mapChargeStatus('abandoned')).toBe('failed');
    expect(mapChargeStatus('code inconnu')).toBe('failed');
    expect(mapChargeStatus(undefined)).toBe('failed');
  });

  it('est insensible a la casse', () => {
    expect(mapChargeStatus('PAY_OFFLINE')).toBe('pending_user_action');
    expect(mapChargeStatus('Success')).toBe('success');
  });
});

describe('Paystack : timeouts reseau et scrutation bornee (LOT D)', () => {
  const secret = 'sk_test_timeout';
  const realFetch = globalThis.fetch;

  function service(extra: Record<string, string> = {}) {
    const values: Record<string, string> = {
      PAYSTACK_SECRET_KEY: secret,
      PAYSTACK_CURRENCY: 'XOF',
      ...extra,
    };
    const config = {
      get: (k: string) => values[k],
      getOrThrow: (k: string) => {
        const v = values[k];
        if (v == null) throw new Error(`manquante : ${k}`);
        return v;
      },
    } as unknown as ConfigService;
    return new PaystackService(config);
  }

  function reponseVerify(data: unknown) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: true, message: 'ok', data }),
    };
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('verify echoue vite quand le fournisseur ne repond jamais (delai borne)', async () => {
    const svc = service({ PAYSTACK_HTTP_TIMEOUT_MS: '50' });
    // Un fetch qui pend indefiniment mais respecte le signal d'annulation.
    globalThis.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    await expect(svc.verifyTransaction('sp_bloque')).rejects.toThrow();
  }, 10000);

  it('charge echoue vite quand le fournisseur ne repond jamais (delai borne)', async () => {
    const svc = service({ PAYSTACK_HTTP_TIMEOUT_MS: '50' });
    globalThis.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    await expect(
      svc.chargeMobileMoney({
        email: 'amina@example.com',
        amountXof: 10000,
        phone: '2250551234987',
        provider: 'mtn',
        reference: 'sp_bloque',
      }),
    ).rejects.toThrow(/PAYSTACK_CHARGE_FAILED/);
  }, 10000);

  it('scrutation : succes immediat, sans attente inutile', async () => {
    const svc = service();
    globalThis.fetch = jest.fn(async () =>
      reponseVerify({
        status: 'success',
        reference: 'sp_1',
        amount: 1000000,
        currency: 'XOF',
      }),
    ) as unknown as typeof fetch;
    const out = await svc.pollTransactionVerification('sp_1', {
      timeoutMs: 500,
      intervalMs: 5,
    });
    expect(out).toMatchObject({ status: 'success', reference: 'sp_1' });
  });

  it('scrutation : pending puis succes (fenetre 180 s)', async () => {
    const svc = service();
    globalThis.fetch = jest.fn(async () =>
      reponseVerify({
        status: 'pay_offline',
        reference: 'sp_2',
        amount: 1000000,
        currency: 'XOF',
      }),
    ) as unknown as typeof fetch;
    // Apres deux tours, le fournisseur confirme.
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
      reponseVerify({
        status: 'pending',
        reference: 'sp_2',
        amount: 1000000,
        currency: 'XOF',
      }),
    );
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
      reponseVerify({
        status: 'pending',
        reference: 'sp_2',
        amount: 1000000,
        currency: 'XOF',
      }),
    );
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      reponseVerify({
        status: 'success',
        reference: 'sp_2',
        amount: 1000000,
        currency: 'XOF',
      }),
    );
    const out = await svc.pollTransactionVerification('sp_2', {
      timeoutMs: 500,
      intervalMs: 5,
    });
    expect(out).toMatchObject({ status: 'success' });
    expect(globalThis.fetch as jest.Mock).toHaveBeenCalled();
  });

  it('scrutation : echec terminal leve PAYSTACK_CHARGE_FAILED', async () => {
    const svc = service();
    globalThis.fetch = jest.fn(async () =>
      reponseVerify({
        status: 'failed',
        reference: 'sp_3',
        amount: 1000000,
        currency: 'XOF',
      }),
    ) as unknown as typeof fetch;
    await expect(
      svc.pollTransactionVerification('sp_3', {
        timeoutMs: 500,
        intervalMs: 5,
      }),
    ).rejects.toThrow('PAYSTACK_CHARGE_FAILED');
  });

  it('scrutation : delai depasse leve PAYSTACK_VERIFY_TIMEOUT', async () => {
    const svc = service();
    globalThis.fetch = jest.fn(async () =>
      reponseVerify({
        status: 'pending',
        reference: 'sp_4',
        amount: 1000000,
        currency: 'XOF',
      }),
    ) as unknown as typeof fetch;
    await expect(
      svc.pollTransactionVerification('sp_4', {
        timeoutMs: 40,
        intervalMs: 5,
      }),
    ).rejects.toThrow('PAYSTACK_VERIFY_TIMEOUT');
  });
});
