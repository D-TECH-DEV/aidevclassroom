export interface EnvVars {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_PUBLIC_KEY?: string;
  PAYSTACK_BASE_URL: string;
  PAYSTACK_CALLBACK_URL: string;
  PAYSTACK_CURRENCY: string;
  /** Active le canal Charge mobile money (ancien flux conserve sinon). */
  PAYSTACK_CHARGE_ENABLED: boolean;
  /** Codes providers autorises pour la Charge (CSV, ex. mtn,orange,wave). */
  PAYSTACK_CHARGE_PROVIDERS: string;
  /** Fenetre de scrutation d'une charge en ms (defaut 180 s). */
  PAYSTACK_CHARGE_POLL_TIMEOUT_MS: number;
  /** Intervalle de scrutation d'une charge en ms. */
  PAYSTACK_CHARGE_POLL_INTERVAL_MS: number;
  /** Duree de reservation d'un PENDING en minutes (puis ABANDONED). */
  PAYSTACK_PENDING_RESERVE_MINUTES: number;
  /** Court-circuit verify d'un FAILED recent en minutes (0 = desactive). */
  PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES: number;
  /** Delai max d'un appel HTTP Paystack en ms (defaut 15 s). */
  PAYSTACK_HTTP_TIMEOUT_MS: number;
  FRONTEND_URL: string;
  SWAGGER_ENABLED: boolean;
  REDIS_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RECEIPT_SIGNING_SECRET?: string;
}

const FORBIDDEN_SECRET_FRAGMENTS = [
  'replace_me',
  'replace_with',
  'change_me',
  'dev_secret',
  'CLE_SECRETE_PRODUCTION_OBLIGATOIRE',
];

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const get = (k: string, d?: string): string => {
    const v = config[k];
    if (typeof v === 'string' && v !== '') return v;
    if (d !== undefined) return d;
    return required(k, undefined);
  };
  const optional = (k: string): string | undefined => {
    const v = config[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    return undefined;
  };

  const nodeEnv = get('NODE_ENV', 'development');
  const databaseUrl = get('DATABASE_URL');
  const jwtSecret = get('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caracteres.');
  }
  const receiptSigningSecret = optional('RECEIPT_SIGNING_SECRET');
  if (receiptSigningSecret && receiptSigningSecret.length < 32) {
    throw new Error(
      'RECEIPT_SIGNING_SECRET doit contenir au moins 32 caracteres.',
    );
  }
  const port = parseInt(get('PORT', '3000'), 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT invalide.');
  }
  const swaggerRaw = get('SWAGGER_ENABLED', 'false').toLowerCase();
  const chargeProviders = get('PAYSTACK_CHARGE_PROVIDERS', 'mtn,orange,wave')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (chargeProviders.length === 0) {
    throw new Error('PAYSTACK_CHARGE_PROVIDERS ne doit pas etre vide.');
  }

  const paystackSecret = get('PAYSTACK_SECRET_KEY', 'sk_test_replace_me');
  const paystackCallbackUrl = get(
    'PAYSTACK_CALLBACK_URL',
    'http://localhost:5173/payment/callback',
  );
  const frontendUrl = get('FRONTEND_URL', 'http://localhost:5173');
  const redisUrl = optional('REDIS_URL');
  const resendApiKey = optional('RESEND_API_KEY');
  const resendFromEmail = optional('RESEND_FROM_EMAIL');

  if (nodeEnv === 'production') {
    const lowerJwt = jwtSecret.toLowerCase();
    if (
      FORBIDDEN_SECRET_FRAGMENTS.some((f) =>
        lowerJwt.includes(f.toLowerCase()),
      )
    ) {
      throw new Error(
        'JWT_SECRET d exemple detecte en production : generez un vrai secret aleatoire.',
      );
    }
    if (
      !databaseUrl.startsWith('postgres://') &&
      !databaseUrl.startsWith('postgresql://')
    ) {
      throw new Error(
        'DATABASE_URL doit cibler PostgreSQL en production.',
      );
    }
    if (!paystackSecret.startsWith('sk_live_')) {
      throw new Error(
        'PAYSTACK_SECRET_KEY doit etre une cle live (sk_live_...) en production.',
      );
    }
    if (!paystackCallbackUrl.startsWith('https://')) {
      throw new Error(
        'PAYSTACK_CALLBACK_URL doit utiliser HTTPS en production.',
      );
    }
    const origins = frontendUrl
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (origins.length === 0 || origins.some((o) => !o.startsWith('https://'))) {
      throw new Error(
        'FRONTEND_URL doit contenir uniquement des origines HTTPS en production.',
      );
    }
    if (!redisUrl) {
      throw new Error('REDIS_URL est obligatoire en production.');
    }
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY est obligatoire en production.');
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PREFIX: get('API_PREFIX', 'api/v1'),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: get('JWT_EXPIRES_IN', '1h'),
    PAYSTACK_SECRET_KEY: paystackSecret,
    PAYSTACK_PUBLIC_KEY: get('PAYSTACK_PUBLIC_KEY', ''),
    PAYSTACK_BASE_URL: get('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
    PAYSTACK_CALLBACK_URL: paystackCallbackUrl,
    PAYSTACK_CURRENCY: get('PAYSTACK_CURRENCY', 'XOF'),
    PAYSTACK_CHARGE_ENABLED: ['1', 'true', 'yes'].includes(
      get('PAYSTACK_CHARGE_ENABLED', 'false').toLowerCase(),
    ),
    PAYSTACK_CHARGE_PROVIDERS: chargeProviders.join(','),
    PAYSTACK_CHARGE_POLL_TIMEOUT_MS: positiveIntFrom(
      'PAYSTACK_CHARGE_POLL_TIMEOUT_MS',
      get('PAYSTACK_CHARGE_POLL_TIMEOUT_MS', '180000'),
    ),
    PAYSTACK_CHARGE_POLL_INTERVAL_MS: positiveIntFrom(
      'PAYSTACK_CHARGE_POLL_INTERVAL_MS',
      get('PAYSTACK_CHARGE_POLL_INTERVAL_MS', '5000'),
    ),
    PAYSTACK_PENDING_RESERVE_MINUTES: positiveIntFrom(
      'PAYSTACK_PENDING_RESERVE_MINUTES',
      get('PAYSTACK_PENDING_RESERVE_MINUTES', '120'),
    ),
    PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES: nonNegativeIntFrom(
      'PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES',
      get('PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES', '15'),
    ),
    PAYSTACK_HTTP_TIMEOUT_MS: positiveIntFrom(
      'PAYSTACK_HTTP_TIMEOUT_MS',
      get('PAYSTACK_HTTP_TIMEOUT_MS', '15000'),
    ),
    FRONTEND_URL: frontendUrl,
    SWAGGER_ENABLED: ['1', 'true', 'yes'].includes(swaggerRaw),
    REDIS_URL: redisUrl,
    RESEND_API_KEY: resendApiKey,
    RESEND_FROM_EMAIL: resendFromEmail,
    RECEIPT_SIGNING_SECRET: receiptSigningSecret,
  };
}

function positiveIntFrom(name: string, raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} doit etre un entier strictement positif.`);
  }
  return n;
}

function nonNegativeIntFrom(name: string, raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} doit etre un entier positif ou nul.`);
  }
  return n;
}
