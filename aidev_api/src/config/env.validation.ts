export interface EnvVars {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PAYSTACK_SECRET_KEY: string;
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
}

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
  const jwtSecret = get('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caracteres.');
  }
  const port = parseInt(get('PORT', '3000'), 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT invalide.');
  }
  const swaggerRaw = get('SWAGGER_ENABLED', 'true').toLowerCase();
  const chargeProviders = get('PAYSTACK_CHARGE_PROVIDERS', 'mtn,orange,wave')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (chargeProviders.length === 0) {
    throw new Error('PAYSTACK_CHARGE_PROVIDERS ne doit pas etre vide.');
  }
  return {
    NODE_ENV: get('NODE_ENV', 'development'),
    PORT: port,
    API_PREFIX: get('API_PREFIX', 'api/v1'),
    DATABASE_URL: get(
      'DATABASE_URL',
      'mysql://sprint:sprint@localhost:3306/sprint_platform',
    ),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: get('JWT_EXPIRES_IN', '1h'),
    PAYSTACK_SECRET_KEY: get('PAYSTACK_SECRET_KEY', 'sk_test_replace_me'),
    PAYSTACK_BASE_URL: get('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
    PAYSTACK_CALLBACK_URL: get(
      'PAYSTACK_CALLBACK_URL',
      'http://localhost:5173/payment/callback',
    ),
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
    FRONTEND_URL: get('FRONTEND_URL', 'http://localhost:5173'),
    SWAGGER_ENABLED: ['1', 'true', 'yes'].includes(swaggerRaw),
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
