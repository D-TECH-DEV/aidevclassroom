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
    FRONTEND_URL: get('FRONTEND_URL', 'http://localhost:5173'),
    SWAGGER_ENABLED: ['1', 'true', 'yes'].includes(swaggerRaw),
  };
}
