import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface PaystackInitParams {
  email: string;
  reference: string;
  currency: string;
  callbackUrl: string;
  /** Montant dans l'unite attendue par Paystack (voir toProviderAmount). */
  providerAmount: number;
}

export interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  gatewayResponse?: string;
  paidAt?: string;
  channel?: string;
}

/**
 * Hypothese documentee (CDC section 2) : pour XOF, Paystack attend le
 * montant en unite entiere (francs, sans sous-unite) — aucun facteur 100
 * arbitraire. Pour les devises a sous-unites (NGN/GHS/ZAR/KES), Paystack
 * attend les centimes (kobo/pesewas/cents), d'ou x100. Toute la conversion
 * est isolee ici via toProviderAmount/fromProviderAmount.
 */
export function toProviderAmount(amountXof: number, currency: string): number {
  const subUnitCurrencies = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'USD']);
  if (subUnitCurrencies.has(currency.toUpperCase())) return amountXof * 100;
  return amountXof;
}

export function fromProviderAmount(
  providerAmount: number,
  currency: string,
): number {
  const subUnitCurrencies = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'USD']);
  if (subUnitCurrencies.has(currency.toUpperCase()))
    return Math.round(providerAmount / 100);
  return providerAmount;
}

/** Expurge la reponse fournisseur avant stockage (RG10, RG16, logs surs). */
export function sanitizeProviderPayload(
  payload: unknown,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const p = payload as Record<string, unknown>;
  const data = (p['data'] ?? p) as Record<string, unknown>;
  const keep = [
    'status',
    'reference',
    'amount',
    'currency',
    'gateway_response',
    'paid_at',
    'channel',
  ];
  const out: Record<string, unknown> = { sanitized: true };
  for (const k of keep) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly baseUrl: string;
  readonly currency: string;
  readonly callbackUrl: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    this.baseUrl =
      config.get<string>('PAYSTACK_BASE_URL') ?? 'https://api.paystack.co';
    this.currency = config.get<string>('PAYSTACK_CURRENCY') ?? 'XOF';
    this.callbackUrl =
      config.get<string>('PAYSTACK_CALLBACK_URL') ??
      'http://localhost:5173/payment/callback';
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeTransaction(params: PaystackInitParams): Promise<{
    authorizationUrl: string;
    providerReference: string;
  }> {
    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        amount: params.providerAmount,
        reference: params.reference,
        currency: params.currency,
        callback_url: params.callbackUrl,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; reference: string };
    };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      this.logger.warn(
        `Paystack initialize refuse: ${res.status} ${json.message}`,
      );
      throw new Error(`PAYSTACK_INIT_FAILED: ${json.message ?? res.status}`);
    }
    // L'URL vient de Paystack, jamais inventee (RG08).
    return {
      authorizationUrl: json.data.authorization_url,
      providerReference: json.data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyData> {
    const res = await fetch(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } },
    );
    const json = (await res.json()) as {
      status: boolean;
      message: string;
      data?: PaystackVerifyData;
    };
    if (!res.ok || !json.status || !json.data) {
      throw new Error(`PAYSTACK_VERIFY_FAILED: ${json.message ?? res.status}`);
    }
    return json.data;
  }

  checkSignature(rawBody: Buffer, signature: string | undefined): boolean {
    return verifyWebhookSignature(rawBody, signature, this.secretKey);
  }
}
