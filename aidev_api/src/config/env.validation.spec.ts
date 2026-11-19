import { validateEnv } from './env.validation';

describe('validateEnv (securite production)', () => {
  const baseProd = {
    NODE_ENV: 'production',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL: 'postgresql://user:pass@postgres:5432/aidev_db?schema=public',
    JWT_SECRET: 'a_very_strong_random_production_secret_over_32_chars_9988',
    PAYSTACK_SECRET_KEY: 'sk_live_real_secret_key_for_prod',
    PAYSTACK_CALLBACK_URL: 'https://ai-devclassroom.com/paiement/retour',
    FRONTEND_URL: 'https://ai-devclassroom.com',
    REDIS_URL: 'redis://:redispass@redis:6379',
    RESEND_API_KEY: 're_prod_api_key',
  };

  it('desactive Swagger par defaut', () => {
    const out = validateEnv(baseProd);
    expect(out.SWAGGER_ENABLED).toBe(false);
  });

  it('rejette les configurations dangereuses en production', () => {
    expect(() =>
      validateEnv({ ...baseProd, PAYSTACK_SECRET_KEY: 'sk_test_1234' }),
    ).toThrow(/sk_live_/);
    expect(() =>
      validateEnv({ ...baseProd, FRONTEND_URL: 'http://ai-devclassroom.com' }),
    ).toThrow(/HTTPS/);
    expect(() =>
      validateEnv({ ...baseProd, REDIS_URL: '' }),
    ).toThrow(/REDIS_URL/);
    expect(() =>
      validateEnv({ ...baseProd, RESEND_API_KEY: '' }),
    ).toThrow(/RESEND_API_KEY/);
  });
});
