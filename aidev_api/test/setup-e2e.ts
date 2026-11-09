// Valeurs de secours pour l'e2e local (jamais de vrais secrets).
// Charge AVANT les imports du spec via jest-e2e.json `setupFiles`.
process.env.JWT_SECRET ??= 'e2e_test_secret_0123456789abcdef_long';
process.env.DATABASE_URL ??=
  'mysql://sprint:sprint@localhost:3306/sprint_platform';
process.env.PAYSTACK_SECRET_KEY ??= 'sk_test_e2e_placeholder';
// Canal Charge actif en e2e : le fournisseur reste moque (fetch), aucune
// cle live n'est utilisee. Les statuts pay_offline/pending/success/failed
// sont pilotes par le mock de fetch de chaque test.
process.env.PAYSTACK_CHARGE_ENABLED ??= 'true';
process.env.PAYSTACK_CHARGE_PROVIDERS ??= 'mtn,orange,wave';
process.env.PAYSTACK_CURRENCY ??= 'XOF';
process.env.PAYSTACK_PENDING_RESERVE_MINUTES ??= '120';
process.env.PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES ??= '15';
process.env.PAYSTACK_CHARGE_POLL_TIMEOUT_MS ??= '180000';
process.env.PAYSTACK_CHARGE_POLL_INTERVAL_MS ??= '5000';
process.env.PAYSTACK_HTTP_TIMEOUT_MS ??= '15000';
