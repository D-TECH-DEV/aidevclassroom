import {
  computeSprintSelection,
  type SelectionEnrollmentInput,
} from './sprint-selection.util';

function makeRow(
  overrides: Partial<SelectionEnrollmentInput> & { id: number },
): SelectionEnrollmentInput {
  return {
    plan: 'SINGLE',
    status: 'CONFIRMED',
    totalAmountXof: 50000,
    paidXof: 50000,
    firstPaidAt: new Date('2026-11-01T10:00:00Z'),
    createdAt: new Date('2026-11-01T09:00:00Z'),
    student: {
      id: overrides.id,
      firstName: `User${overrides.id}`,
      lastName: 'Test',
      email: `user${overrides.id}@example.com`,
      phone: '+2250700000000',
    },
    ...overrides,
  };
}

describe('computeSprintSelection', () => {
  it('classe par pourcentage paye decroissant puis anciennete et exclut CANCELLED', () => {
    const rows: SelectionEnrollmentInput[] = [
      makeRow({ id: 1, paidXof: 10000, status: 'PENDING' }), // 20%
      makeRow({
        id: 2,
        paidXof: 25000,
        firstPaidAt: new Date('2026-11-02T10:00:00Z'),
      }), // 50% plus recent
      makeRow({
        id: 3,
        paidXof: 25000,
        firstPaidAt: new Date('2026-11-01T10:00:00Z'),
      }), // 50% plus ancien
      makeRow({ id: 4, paidXof: 50000 }), // 100%
      makeRow({ id: 5, paidXof: 50000, status: 'CANCELLED' }), // ignore
      makeRow({ id: 6, paidXof: 0, status: 'PENDING' }), // unpaid
    ];

    const res = computeSprintSelection(rows, 3);
    expect(res.selected.map((s) => s.enrollmentId)).toEqual([4, 3, 2]);
    expect(res.waitlist.map((w) => w.enrollmentId)).toEqual([1]);
    expect(res.waitlist[0].refundableTwoThirdsXof).toBe(6667);
    expect(res.unpaid.map((u) => u.enrollmentId)).toEqual([6]);
    expect(res.seatsUsed).toBe(3);
    expect(res.seatsRemaining).toBe(0);
  });

  it('gere le forfait DUO (2 places) quand il ne reste qu 1 place libre', () => {
    const rows: SelectionEnrollmentInput[] = [
      makeRow({ id: 1, paidXof: 50000, plan: 'SINGLE' }), // 100%, 1 place -> 1/2
      makeRow({ id: 2, paidXof: 60000, totalAmountXof: 80000, plan: 'DUO' }), // 75%, 2 places -> ne rentre pas
      makeRow({ id: 3, paidXof: 25000, plan: 'SINGLE' }), // 50%, 1 place -> 2/2
    ];

    const res = computeSprintSelection(rows, 2);
    expect(res.selected.map((s) => s.enrollmentId)).toEqual([1, 3]);
    expect(res.waitlist.map((w) => w.enrollmentId)).toEqual([2]);
    expect(res.waitlist[0].seats).toBe(2);
    expect(res.waitlist[0].refundableTwoThirdsXof).toBe(40000);
    expect(res.seatsUsed).toBe(2);
    expect(res.seatsRemaining).toBe(0);
  });

  it('retient tous les eligibles lorsque capacity est null', () => {
    const rows: SelectionEnrollmentInput[] = [
      makeRow({ id: 1, paidXof: 5000 }),
      makeRow({ id: 2, paidXof: 50000, plan: 'DUO', totalAmountXof: 80000 }),
    ];

    const res = computeSprintSelection(rows, null);
    expect(res.selectedCount).toBe(2);
    expect(res.waitlistCount).toBe(0);
    expect(res.seatsUsed).toBe(3);
    expect(res.seatsRemaining).toBeNull();
  });
});
