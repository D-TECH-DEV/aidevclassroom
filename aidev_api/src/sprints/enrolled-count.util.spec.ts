import {
  countEnrolled,
  isEnrolled,
  thresholdForEnrollment,
} from './enrolled-count.util';

describe('Comptage des inscrits (minimum verse du sprint)', () => {
  it('seuil solo : le minimum du sprint', () => {
    expect(thresholdForEnrollment('SINGLE', 5000, null)).toBe(5000);
    expect(thresholdForEnrollment(undefined, 5000, 10000)).toBe(5000);
  });

  it('seuil duo : le minimum duo quand il est defini, sinon le minimum solo', () => {
    expect(thresholdForEnrollment('DUO', 5000, 10000)).toBe(10000);
    expect(thresholdForEnrollment('DUO', 5000, null)).toBe(5000);
  });

  it('ne compte pas un dossier PENDING avec paiement partiel, mais compte un dossier CONFIRMED ou 100% solde', () => {
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'PENDING', totalAmountXof: 25000, payments: [{ status: 'SUCCESS', amountXof: 5000 }] },
        5000,
        null,
      ),
    ).toBe(false);
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'PENDING', totalAmountXof: 25000, payments: [{ status: 'SUCCESS', amountXof: 25000 }] },
        5000,
        null,
      ),
    ).toBe(true);
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'CONFIRMED', totalAmountXof: 25000, payments: [{ status: 'SUCCESS', amountXof: 5000 }] },
        5000,
        null,
      ),
    ).toBe(true);
  });

  it('seuls les paiements SUCCESS comptent', () => {
    expect(
      isEnrolled(
        {
          plan: 'SINGLE',
          status: 'PENDING',
          payments: [
            { status: 'PENDING', amountXof: 5000 },
            { status: 'FAILED', amountXof: 5000 },
          ],
        },
        5000,
        null,
      ),
    ).toBe(false);
  });

  it('un dossier CANCELLED ne compte jamais, meme solde', () => {
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'CANCELLED', payments: [{ status: 'SUCCESS', amountXof: 50000 }] },
        5000,
        null,
      ),
    ).toBe(false);
  });

  it('un dossier DUO qualifie compte 2 personnes, 1 dossier (et un PENDING partiel ne compte pas)', () => {
    const resume = countEnrolled(
      [
        { plan: 'DUO', status: 'CONFIRMED', totalAmountXof: 40000, payments: [{ status: 'SUCCESS', amountXof: 40000 }] },
        { plan: 'SINGLE', status: 'PENDING', totalAmountXof: 25000, payments: [{ status: 'SUCCESS', amountXof: 25000 }] },
        { plan: 'SINGLE', status: 'PENDING', totalAmountXof: 25000, payments: [{ status: 'SUCCESS', amountXof: 5000 }] },
      ],
      5000,
      10000,
    );
    expect(resume).toEqual({ enrolledCount: 2, enrolledSeats: 3 });
  });
});
