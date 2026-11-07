import { createHmac } from 'crypto';
import {
  fromProviderAmount,
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
});
