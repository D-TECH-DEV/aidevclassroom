import { ExportPdfService } from './export-pdf.service';

describe('ExportPdfService', () => {
  const service = new ExportPdfService();

  it('génère un buffer PDF valide pour les inscriptions', async () => {
    const buffer = await service.exportEnrollments(
      [
        {
          id: 1,
          status: 'CONFIRMED',
          plan: 'SINGLE',
          totalAmountXof: 50000,
          totalPaidXof: 25000,
          remainingAmountXof: 25000,
          createdAt: new Date('2026-11-15T10:00:00Z'),
          student: {
            firstName: 'Kouadio',
            lastName: 'Yao',
            email: 'kouadio@example.com',
            phone: '+2250700000001',
          },
          sprint: { name: 'Sprint Dev Web' },
        },
      ],
      'Tous les statuts',
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('génère un buffer PDF valide pour les paiements', async () => {
    const buffer = await service.exportPayments(
      [
        {
          id: 10,
          reference: 'PAY_TEST_001',
          status: 'SUCCESS',
          amountXof: 50000,
          currency: 'XOF',
          paidAt: new Date('2026-11-15T12:00:00Z'),
          createdAt: new Date('2026-11-15T11:55:00Z'),
          enrollmentId: 1,
          enrollment: {
            student: {
              firstName: 'Awa',
              lastName: 'Koné',
              email: 'awa@example.com',
            },
            sprint: { name: 'Sprint Dev Web' },
          },
        },
      ],
      'Réussis',
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
