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

  it('compte un dossier des que le total SUCCESS atteint le minimum', () => {
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'PENDING', payments: [{ status: 'SUCCESS', amountXof: 5000 }] },
        5000,
        null,
      ),
    ).toBe(true);
    expect(
      isEnrolled(
        { plan: 'SINGLE', status: 'PENDING', payments: [{ status: 'SUCCESS', amountXof: 4999 }] },
        5000,
        null,
      ),
    ).toBe(false);
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

  it('un dossier DUO qualifie compte 2 personnes, 1 dossier', () => {
    const resume = countEnrolled(
      [
        { plan: 'DUO', status: 'CONFIRMED', payments: [{ status: 'SUCCESS', amountXof: 10000 }] },
        { plan: 'SINGLE', status: 'PENDING', payments: [{ status: 'SUCCESS', amountXof: 5000 }] },
        { plan: 'SINGLE', status: 'PENDING', payments: [{ status: 'SUCCESS', amountXof: 1000 }] },
      ],
      5000,
      10000,
    );
    expect(resume).toEqual({ enrolledCount: 2, enrolledSeats: 3 });
  });
});
