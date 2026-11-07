import {
  remainingAmountXof,
  totalPaidXof,
  validatePaymentAmount,
} from './balance.util';

describe('Soldes et montants (RG03/RG05/RG06)', () => {
  it('calcule le solde avec plusieurs paiements SUCCESS', () => {
    const payments = [
      { status: 'SUCCESS', amountXof: 10000 },
      { status: 'SUCCESS', amountXof: 15000 },
    ];
    expect(totalPaidXof(payments)).toBe(25000);
    expect(remainingAmountXof(50000, payments)).toBe(25000);
  });

  it('exclut PENDING/FAILED/ABANDONED des recettes', () => {
    const payments = [
      { status: 'SUCCESS', amountXof: 10000 },
      { status: 'PENDING', amountXof: 40000 },
      { status: 'FAILED', amountXof: 5000 },
      { status: 'ABANDONED', amountXof: 7000 },
    ];
    expect(totalPaidXof(payments)).toBe(10000);
    expect(remainingAmountXof(50000, payments)).toBe(40000);
  });

  it('refuse montant nul, negatif ou non entier', () => {
    expect(validatePaymentAmount(0, 5000, 50000)).toBe(
      'PAYMENT_AMOUNT_INVALID',
    );
    expect(validatePaymentAmount(-100, 5000, 50000)).toBe(
      'PAYMENT_AMOUNT_INVALID',
    );
    expect(validatePaymentAmount(10.5, 5000, 50000)).toBe(
      'PAYMENT_AMOUNT_INVALID',
    );
    expect(validatePaymentAmount('10000', 5000, 50000)).toBe(
      'PAYMENT_AMOUNT_INVALID',
    );
  });

  it('refuse un montant sous le minimum', () => {
    expect(validatePaymentAmount(4999, 5000, 50000)).toBe(
      'PAYMENT_AMOUNT_BELOW_MINIMUM',
    );
    expect(validatePaymentAmount(5000, 5000, 50000)).toBeNull();
  });

  it('suit les versements partiels jusqu au solde : 10000 puis 15000 puis 25000', () => {
    // Prix fige de l inscription : 50 000 XOF.
    const total = 50000;
    let payments: { status: string; amountXof: number }[] = [];
    expect(remainingAmountXof(total, payments)).toBe(50000);
    // Premier versement partiel confirme.
    payments = [...payments, { status: 'SUCCESS', amountXof: 10000 }];
    expect(totalPaidXof(payments)).toBe(10000);
    expect(remainingAmountXof(total, payments)).toBe(40000);
    // Deuxieme versement partiel confirme.
    payments = [...payments, { status: 'SUCCESS', amountXof: 15000 }];
    expect(totalPaidXof(payments)).toBe(25000);
    expect(remainingAmountXof(total, payments)).toBe(25000);
    // Paiement du solde restant exact.
    payments = [...payments, { status: 'SUCCESS', amountXof: 25000 }];
    expect(totalPaidXof(payments)).toBe(50000);
    expect(remainingAmountXof(total, payments)).toBe(0);
    // Inscription soldee : tout nouveau versement est refuse.
    expect(
      validatePaymentAmount(5000, 5000, remainingAmountXof(total, payments)),
    ).toBe('ENROLLMENT_ALREADY_SETTLED');
  });

  it('refuse un montant superieur au solde et le solde ne devient jamais negatif', () => {
    expect(validatePaymentAmount(40001, 5000, 40000)).toBe(
      'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
    );
    expect(validatePaymentAmount(40000, 5000, 40000)).toBeNull();
    expect(
      remainingAmountXof(10000, [{ status: 'SUCCESS', amountXof: 10000 }]),
    ).toBe(0);
    expect(validatePaymentAmount(5000, 5000, 0)).toBe(
      'ENROLLMENT_ALREADY_SETTLED',
    );
  });
});
