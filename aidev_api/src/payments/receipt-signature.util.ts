import { createHmac, timingSafeEqual } from 'crypto';

export const RECEIPT_QR_TTL_SECONDS = 180 * 24 * 3600;

export function signReceiptAccess(
  reference: string,
  expUnixSec: number,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`receipt-qr-v1:${reference}:${expUnixSec}`, 'utf8')
    .digest('hex');
}

export function verifyReceiptAccess(
  reference: string,
  sig: string | undefined,
  expRaw: string | undefined,
  secret: string,
  nowUnixSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || secret.length < 16) return false;
  if (!sig || !expRaw) return false;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  if (!/^\d+$/.test(expRaw)) return false;

  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp <= nowUnixSec) return false;

  const expectedHex = signReceiptAccess(reference, exp, secret);
  const given = Buffer.from(sig.toLowerCase(), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
