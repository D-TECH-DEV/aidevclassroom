// Valeurs de secours pour l'e2e local (jamais de vrais secrets).
// Charge AVANT les imports du spec via jest-e2e.json `setupFiles`.
process.env.JWT_SECRET ??= 'e2e_test_secret_0123456789abcdef_long';
process.env.DATABASE_URL ??=
  'mysql://sprint:sprint@localhost:3306/sprint_platform';
process.env.PAYSTACK_SECRET_KEY ??= 'sk_test_e2e_placeholder';
