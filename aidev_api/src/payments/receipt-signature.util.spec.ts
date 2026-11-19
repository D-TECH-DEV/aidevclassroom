/* eslint-disable @typescript-eslint/require-await */
import { ExecutionContext } from '@nestjs/common';
import { createHash } from 'crypto';
import { PaymentAccessGuard } from './payment-access.guard';
import { signReceiptAccess, verifyReceiptAccess } from './receipt-signature.util';

describe('ReceiptSignatureUtil & PaymentAccessGuard', () => {
  const SECRET = 'super_secret_key_for_receipt_signing_32_chars';
  const REF = 'sp_test_12345';

  it('signe et verifie un acces lecture seule valide et rejette alteration ou expiration', () => {
    const now = 1_700_000_000;
    const exp = now + 3600;
    const sig = signReceiptAccess(REF, exp, SECRET);
    expect(verifyReceiptAccess(REF, sig, String(exp), SECRET, now)).toBe(true);
    const tamperedSig = `${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`;
    expect(verifyReceiptAccess(REF, tamperedSig, String(exp), SECRET, now)).toBe(
      false,
    );
    expect(verifyReceiptAccess('sp_other', sig, String(exp), SECRET, now)).toBe(
      false,
    );
    expect(verifyReceiptAccess(REF, sig, String(now - 1), SECRET, now)).toBe(
      false,
    );
    expect(verifyReceiptAccess(REF, sig, String(exp), 'short', now)).toBe(false);
  });

  function makeGuard(hashHex: string) {
    const prisma = {
      payment: {
        findUnique: jest.fn(async () => ({
          enrollment: { id: 1, trackingTokenHash: hashHex },
        })),
      },
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'RECEIPT_SIGNING_SECRET' ? SECRET : undefined,
      ),
    };
    return new PaymentAccessGuard(prisma as never, config as never);
  }

  function mockCtx(req: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  it('autorise signature HMAC sur GET uniquement et refuse sur POST ou query trackingToken', async () => {
    const guard = makeGuard(
      createHash('sha256').update('valid_token_0123456789').digest('hex'),
    );
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signReceiptAccess(REF, exp, SECRET);

    await expect(
      guard.canActivate(
        mockCtx({
          method: 'GET',
          params: { reference: REF },
          headers: { 'x-receipt-sig': sig, 'x-receipt-exp': String(exp) },
          query: {},
        }),
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        mockCtx({
          method: 'POST',
          params: { reference: REF },
          headers: { 'x-receipt-sig': sig, 'x-receipt-exp': String(exp) },
          query: {},
        }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TRACKING_TOKEN_REQUIRED' }),
    });

    await expect(
      guard.canActivate(
        mockCtx({
          method: 'GET',
          params: { reference: REF },
          headers: {},
          query: { trackingToken: 'valid_token_0123456789' },
        }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TRACKING_TOKEN_REQUIRED' }),
    });
  });
});
