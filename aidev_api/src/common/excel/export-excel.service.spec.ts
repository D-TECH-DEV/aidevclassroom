import * as ExcelJS from 'exceljs';
import { ExportExcelService } from './export-excel.service';

describe('ExportExcelService', () => {
  const svc = new ExportExcelService();

  it('genere un classeur xlsx valide pour les inscriptions', async () => {
    const buffer = await svc.exportEnrollments(
      [
        {
          id: 1,
          status: 'CONFIRMED',
          plan: 'DUO',
          partnerFirstName: 'Awa',
          partnerLastName: 'Kouassi',
          partnerPhone: '+2250700000001',
          totalAmountXof: 80000,
          totalPaidXof: 20000,
          remainingAmountXof: 60000,
          createdAt: '2026-11-10T10:00:00.000Z',
          student: {
            firstName: 'Konan',
            lastName: 'Yao',
            email: 'konan@exemple.ci',
            phone: '+2250704921080',
          },
          sprint: { name: 'Sprint Dev Web Intensif' },
        },
      ],
      'Tous les statuts',
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Inscriptions');
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).getCell(1).value).toBe('AIDevClassroom');
    expect(sheet?.getRow(6).getCell(2).value).toBe('Participant');
    expect(sheet?.getRow(7).getCell(2).value).toBe('Konan Yao');
    expect(sheet?.getRow(7).getCell(9).value).toBe('Confirmée');
    expect(sheet?.getRow(5).getCell(10).value).toEqual({
      formula: 'SUM(J7:J7)',
    });
  });

  it('genere un classeur xlsx valide pour les paiements', async () => {
    const buffer = await svc.exportPayments(
      [
        {
          id: 10,
          reference: 'sp_test_123',
          status: 'SUCCESS',
          amountXof: 20000,
          currency: 'XOF',
          paidAt: '2026-11-10T11:00:00.000Z',
          createdAt: '2026-11-10T10:55:00.000Z',
          enrollmentId: 1,
          enrollment: {
            student: {
              firstName: 'Konan',
              lastName: 'Yao',
              email: 'konan@exemple.ci',
            },
            sprint: { name: 'Sprint Dev Web Intensif' },
          },
        },
      ],
      'Statut : Réussi',
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Paiements');
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(7).getCell(2).value).toBe('sp_test_123');
    expect(sheet?.getRow(7).getCell(3).value).toBe('Réussi');
    expect(sheet?.getRow(5).getCell(4).value).toEqual({
      formula: 'SUM(D7:D7)',
    });
  });
});
