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
 * Conversion isolee (CDC section 2 + RG08) : Paystack attend TOUS les
 * montants en plus petite unite, facteur x100, y compris pour les devises
 * sans sous-unite en circulation comme le XOF.
 *
 * Source : documentation officielle Paystack (API Reference, "Supported
 * currency") : "Sending an amount in subunits simply means multiplying
 * the base amount by 100. While there is no subunit for XOF, developers
 * must multiply the amount by 100 regardless."
 *
 * Sans ce facteur, Paystack debite 100x moins que le prix reel (ex. un
 * versement de 50 000 XOF n'est facture que 500 XOF) tandis que la
 * verification comparerait deux echelles incoherentes. Toute la
 * conversion passe par toProviderAmount/fromProviderAmount et nulle part
 * ailleurs.
 */
/** Fournisseurs mobile money supportes par la Charge (codes operateurs CI). */
export const MOBILE_MONEY_PROVIDERS = ['mtn', 'orange', 'wave'] as const;
export type MobileMoneyProvider =
  (typeof MOBILE_MONEY_PROVIDERS)[number];

export interface PaystackChargeParams {
  email: string;
  /** Montant en XOF (converti en x100 dans l'appel, voir toProviderAmount). */
  amountXof: number;
  /** Numero au format E.164 ivoirien strict : 225 suivi de 10 chiffres. */
  phone: string;
  provider: string;
  reference: string;
}

export type ChargeOutcome =
  | 'success'
  | 'pending_user_action'
  | 'pending'
  | 'otp_required'
  | 'failed';

/** Reponse normalisee d'un POST /charge (jamais de secret/OTP/PIN). */
export interface ChargeMobileMoneyResult {
  outcome: ChargeOutcome;
  providerReference: string;
  displayText?: string;
  rawStatus: string;
}

const CI_MOBILE_MONEY_PHONE_RE = /^225\d{10}$/;

/** Valide un numero mobile ivoirien E.164 strict (225XXXXXXXXXX). */
export function isValidCiMobileMoneyPhone(phone: unknown): boolean {
  return typeof phone === 'string' && CI_MOBILE_MONEY_PHONE_RE.test(phone);
}

/**
 * Normalise le statut brut de POST /charge. References sandbox : success
 * => debite (verifie via GET /transaction/verify) ; pay_offline =>
 * l'utilisateur valide sur son telephone puis notification via le webhook
 * charge.success (fenetre 180 s puis re-verifier) ; pending => en cours ;
 * send_otp => code operateur (non collecte : les cartes sont abandonnees,
 * aucun nouveau parcours) ; failed/timeout et tout statut inconnu => echec.
 */
export function mapChargeStatus(status: unknown): ChargeOutcome {
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (s === 'success') return 'success';
  if (s === 'pay_offline') return 'pending_user_action';
  if (s === 'pending') return 'pending';
  if (s === 'send_otp') return 'otp_required';
  return 'failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lit un entier strictement positif ou retourne le defaut (config). */
function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

export function toProviderAmount(amountXof: number, _currency: string): number {
  void _currency;
  if (!Number.isInteger(amountXof) || amountXof <= 0) {
    throw new Error('PAYSTACK_AMOUNT_INVALID');
  }
  return amountXof * 100;
}

export function fromProviderAmount(
  providerAmount: number,
  _currency: string,
): number {
  void _currency;
  if (!Number.isInteger(providerAmount) || providerAmount < 0) {
    throw new Error('PAYSTACK_AMOUNT_INVALID');
  }
  return Math.round(providerAmount / 100);
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
    'display_text',
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
  readonly chargePollTimeoutMs: number;
  readonly chargePollIntervalMs: number;
  readonly httpTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    this.baseUrl =
      config.get<string>('PAYSTACK_BASE_URL') ?? 'https://api.paystack.co';
    this.currency = config.get<string>('PAYSTACK_CURRENCY') ?? 'XOF';
    this.callbackUrl =
      config.get<string>('PAYSTACK_CALLBACK_URL') ??
      'http://localhost:5173/payment/callback';
    this.chargePollTimeoutMs = readPositiveInt(
      config.get<string>('PAYSTACK_CHARGE_POLL_TIMEOUT_MS'),
      180_000,
    );
    this.chargePollIntervalMs = readPositiveInt(
      config.get<string>('PAYSTACK_CHARGE_POLL_INTERVAL_MS'),
      5_000,
    );
    this.httpTimeoutMs = readPositiveInt(
      config.get<string>('PAYSTACK_HTTP_TIMEOUT_MS'),
      15_000,
    );
  }

  /**
   * Un signal d'annulation borne : sans lui, un fournisseur qui ne repond
   * jamais bloque la requete (et le client) indefiniment. L'annulation
   * remonte comme une erreur reseau classique, mappee par l'appelant vers
   * le code metier existant (PAYSTACK_UNAVAILABLE / PAYSTACK_VERIFY_FAILED).
   */
  private timeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this.httpTimeoutMs);
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
      signal: this.timeoutSignal(),
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

  /**
   * Debit mobile money direct (POST /charge) : MTN, Orange, Wave en XOF.
   * Le telephone part au format E.164 strict 225XXXXXXXXXX. En live, le
   * mobile money repond data.status=pay_offline + display_text :
   * l'utilisateur valide sur son telephone, notification via le webhook
   * charge.success, fenetre de 180 s puis re-verification. Aucune carte
   * (decision produit) : jamais de PAN/CVV/PIN, et jamais en logs.
   */
  async chargeMobileMoney(
    params: PaystackChargeParams,
  ): Promise<ChargeMobileMoneyResult> {
    if (!isValidCiMobileMoneyPhone(params.phone)) {
      throw new Error('PAYSTACK_PHONE_INVALID');
    }
    let res: Response;
    let json: {
      status: boolean;
      message: string;
      data?: { status: string; reference: string; display_text?: string };
    };
    try {
      res = await fetch(`${this.baseUrl}/charge`, {
        method: 'POST',
        headers: this.headers(),
        signal: this.timeoutSignal(),
        body: JSON.stringify({
          email: params.email,
          amount: toProviderAmount(params.amountXof, this.currency),
          currency: this.currency,
          reference: params.reference,
          mobile_money: { phone: params.phone, provider: params.provider },
        }),
      });
      json = (await res.json()) as typeof json;
    } catch {
      // Timeout reseau (AbortSignal) ou reponse illisible : echec de
      // charge, sans details sensibles en log ni a l'appelant.
      this.logger.warn('Paystack charge injoignable (timeout ou reponse illisible).');
      throw new Error('PAYSTACK_CHARGE_FAILED: timeout ou reponse illisible');
    }
    if (!res.ok || !json.status || !json.data) {
      // Logs surs : ni telephone, ni OTP/PIN, ni secret.
      this.logger.warn(
        `Paystack charge refuse: ${res.status} ${json.message}`,
      );
      throw new Error(`PAYSTACK_CHARGE_FAILED: ${json.message ?? res.status}`);
    }
    return {
      outcome: mapChargeStatus(json.data.status),
      providerReference: json.data.reference,
      displayText: json.data.display_text,
      rawStatus: json.data.status,
    };
  }

  /**
   * Scrutation bornee de la verification d'une charge (fenetre 180 s par
   * defaut) : success => donnees retournees ; failed/abandoned => erreur
   * PAYSTACK_CHARGE_FAILED ; delai depasse => PAYSTACK_VERIFY_TIMEOUT.
   */
  async pollTransactionVerification(
    reference: string,
    opts?: { timeoutMs?: number; intervalMs?: number },
  ): Promise<PaystackVerifyData> {
    const timeoutMs = opts?.timeoutMs ?? this.chargePollTimeoutMs;
    const intervalMs = opts?.intervalMs ?? this.chargePollIntervalMs;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const data = await this.verifyTransaction(reference).catch(
        async (e: unknown) => {
          if (Date.now() >= deadline) throw e;
          await sleep(intervalMs);
          return null;
        },
      );
      if (data === null) continue;
      const s = data.status.toLowerCase();
      if (s === 'success') return data;
      if (s === 'failed' || s === 'abandoned') {
        throw new Error(`PAYSTACK_CHARGE_FAILED: ${data.status}`);
      }
      if (Date.now() >= deadline) {
        throw new Error('PAYSTACK_VERIFY_TIMEOUT');
      }
      await sleep(intervalMs);
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyData> {
    const res = await fetch(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
        signal: this.timeoutSignal(),
      },
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
