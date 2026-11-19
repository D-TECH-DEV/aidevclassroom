import * as ExcelJS from 'exceljs';
import { ExportExcelService } from '../excel/export-excel.service';
import { sanitizeSpreadsheetCell } from './export-format.util';

describe('sanitizeSpreadsheetCell & protection Excel', () => {
  it('neutralise les prefixes de formules Excel dangereux', () => {
    expect(sanitizeSpreadsheetCell('=CMD|"/C calc"!A0')).toBe("'=CMD|\"/C calc\"!A0");
    expect(sanitizeSpreadsheetCell('+2250704921080')).toBe("'+2250704921080");
    expect(sanitizeSpreadsheetCell('-1+1')).toBe("'-1+1");
    expect(sanitizeSpreadsheetCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(sanitizeSpreadsheetCell('\t=1+1')).toBe("'\t=1+1");
    expect(sanitizeSpreadsheetCell('\r=1+1')).toBe("'\r=1+1");
    expect(sanitizeSpreadsheetCell('Konan Yao')).toBe('Konan Yao');
  });

  it('echappe les champs utilisateur malveillants dans un export xlsx', async () => {
    const svc = new ExportExcelService();
    const buffer = await svc.exportEnrollments(
      [
        {
          id: 1,
          status: 'CONFIRMED',
          plan: 'SINGLE',
          totalAmountXof: 50000,
          totalPaidXof: 50000,
          remainingAmountXof: 0,
          createdAt: '2026-11-10T10:00:00.000Z',
          student: {
            firstName: '=cmd|"/C calc"!A0',
            lastName: 'Evil',
            email: 'evil@exemple.ci',
            phone: '+2250704921080',
          },
          sprint: { name: '@MALICIOUS_SPRINT' },
        },
      ],
      '=HYPERLINK("http://evil")',
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Inscriptions');
    expect(sheet?.getRow(7).getCell(2).value).toBe("'=cmd|\"/C calc\"!A0 Evil");
    expect(sheet?.getRow(7).getCell(4).value).toBe("'+2250704921080");
    expect(sheet?.getRow(7).getCell(5).value).toBe("'@MALICIOUS_SPRINT");
  });
});
