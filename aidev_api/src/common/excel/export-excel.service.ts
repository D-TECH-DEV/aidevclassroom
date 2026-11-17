import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  EXPORT_COLORS,
  formatDateAbidjan,
  mapEnrollmentRow,
  mapPaymentRow,
  statusColorsArgb,
  type EnrollmentExportRow,
  type PaymentExportRow,
} from '../export/export-format.util';

export type { EnrollmentExportRow, PaymentExportRow };

type ColumnSpec = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
};

type SummaryCellSpec =
  | { colIndex: number; label: string }
  | { colIndex: number; sumColLetter: string; numFmt: string };

@Injectable()
export class ExportExcelService {
  async exportEnrollments(
    rows: EnrollmentExportRow[],
    filterSummary: string,
  ): Promise<Buffer> {
    const columns: ColumnSpec[] = [
      { header: 'ID', key: 'id', width: 8, align: 'center' },
      { header: 'Participant', key: 'participant', width: 24 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 18 },
      { header: 'Session (Sprint)', key: 'sprint', width: 26 },
      { header: 'Forfait', key: 'plan', width: 12, align: 'center' },
      { header: 'Binôme (Duo)', key: 'partner', width: 22 },
      { header: 'Tél. Binôme', key: 'partnerPhone', width: 18 },
      { header: 'Statut', key: 'statusLabel', width: 15, align: 'center' },
      { header: 'Total dû (FCFA)', key: 'totalAmountXof', width: 18, numFmt: '#,##0 "FCFA"', align: 'right' },
      { header: 'Déjà payé (FCFA)', key: 'totalPaidXof', width: 18, numFmt: '#,##0 "FCFA"', align: 'right' },
      { header: 'Reste à payer (FCFA)', key: 'remainingAmountXof', width: 20, numFmt: '#,##0 "FCFA"', align: 'right' },
      { header: 'Date inscription', key: 'createdAt', width: 20, numFmt: 'dd/mm/yyyy hh:mm', align: 'center' },
    ];

    return this.buildWorkbook({
      sheetName: 'Inscriptions',
      title: 'Export des Inscriptions',
      filterSummary,
      columns,
      rows: rows.map(mapEnrollmentRow),
      statusKey: 'statusLabel',
      summaryCells: [
        { colIndex: 2, label: `${rows.length} dossier(s)` },
        { colIndex: 10, sumColLetter: 'J', numFmt: '#,##0 "FCFA"' },
        { colIndex: 11, sumColLetter: 'K', numFmt: '#,##0 "FCFA"' },
        { colIndex: 12, sumColLetter: 'L', numFmt: '#,##0 "FCFA"' },
      ],
    });
  }

  async exportPayments(
    rows: PaymentExportRow[],
    filterSummary: string,
  ): Promise<Buffer> {
    const columns: ColumnSpec[] = [
      { header: 'ID', key: 'id', width: 8, align: 'center' },
      { header: 'Référence', key: 'reference', width: 24 },
      { header: 'Statut', key: 'statusLabel', width: 15, align: 'center' },
      { header: 'Montant (FCFA)', key: 'amountXof', width: 18, numFmt: '#,##0 "FCFA"', align: 'right' },
      { header: 'Devise', key: 'currency', width: 10, align: 'center' },
      { header: 'Participant', key: 'participant', width: 24 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Session (Sprint)', key: 'sprint', width: 26 },
      { header: 'ID Dossier', key: 'enrollmentId', width: 12, align: 'center' },
      { header: 'Payé le', key: 'paidAt', width: 20, numFmt: 'dd/mm/yyyy hh:mm', align: 'center' },
      { header: 'Créé le', key: 'createdAt', width: 20, numFmt: 'dd/mm/yyyy hh:mm', align: 'center' },
    ];

    return this.buildWorkbook({
      sheetName: 'Paiements',
      title: 'Journal des Paiements',
      filterSummary,
      columns,
      rows: rows.map(mapPaymentRow),
      statusKey: 'statusLabel',
      summaryCells: [
        { colIndex: 2, label: `${rows.length} transaction(s)` },
        { colIndex: 4, sumColLetter: 'D', numFmt: '#,##0 "FCFA"' },
      ],
    });
  }

  private async buildWorkbook(opts: {
    sheetName: string;
    title: string;
    filterSummary: string;
    columns: ColumnSpec[];
    rows: Array<Record<string, unknown> & { statusRaw: string }>;
    statusKey: string;
    summaryCells: SummaryCellSpec[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIDevClassroom';
    workbook.created = new Date();

    const headerRowIdx = 6;
    const dataStartIdx = 7;
    const sheet = workbook.addWorksheet(opts.sheetName, {
      views: [{ state: 'frozen', ySplit: headerRowIdx }],
    });
    const lastColLetter = sheet.getColumn(opts.columns.length).letter;

    opts.columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = col.width;
    });

    this.renderBanner(sheet, lastColLetter, opts.title, opts.filterSummary);
    sheet.getRow(4).height = 8;
    this.renderSummary(sheet, dataStartIdx, opts.rows.length, opts.summaryCells);
    this.renderHeader(sheet, headerRowIdx, lastColLetter, opts.columns);
    this.renderRows(sheet, dataStartIdx, opts.columns, opts.rows, opts.statusKey);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private renderBanner(
    sheet: ExcelJS.Worksheet,
    lastColLetter: string,
    title: string,
    filterSummary: string,
  ) {
    for (let r = 1; r <= 3; r++) {
      sheet.mergeCells(`A${r}:${lastColLetter}${r}`);
      const row = sheet.getRow(r);
      row.height = r === 1 ? 26 : r === 2 ? 22 : 18;
      const cell = row.getCell(1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXPORT_COLORS.bgDark } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
    const brandCell = sheet.getRow(1).getCell(1);
    brandCell.value = 'AIDevClassroom';
    brandCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: EXPORT_COLORS.accentGreen } };

    const titleCell = sheet.getRow(2).getCell(1);
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: EXPORT_COLORS.white } };

    const metaCell = sheet.getRow(3).getCell(1);
    metaCell.value = `Exporté le ${formatDateAbidjan(new Date())} · ${filterSummary}`;
    metaCell.font = { name: 'Calibri', size: 10, color: { argb: EXPORT_COLORS.muted } };
  }

  private renderSummary(
    sheet: ExcelJS.Worksheet,
    dataStartIdx: number,
    rowCount: number,
    summaryCells: SummaryCellSpec[],
  ) {
    const summaryRow = sheet.getRow(5);
    summaryRow.height = 22;
    const summaryLabel = summaryRow.getCell(1);
    summaryLabel.value = 'Total';
    summaryLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXPORT_COLORS.surfaceDark } };

    const dataEndIdx = dataStartIdx + Math.max(rowCount - 1, 0);
    for (const sc of summaryCells) {
      const cell = summaryRow.getCell(sc.colIndex);
      if ('label' in sc) {
        cell.value = sc.label;
        cell.font = { name: 'Calibri', size: 10, bold: true };
      } else {
        cell.value = rowCount > 0 ? { formula: `SUM(${sc.sumColLetter}${dataStartIdx}:${sc.sumColLetter}${dataEndIdx})` } : 0;
        cell.numFmt = sc.numFmt;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXPORT_COLORS.surfaceDark } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
  }

  private renderHeader(
    sheet: ExcelJS.Worksheet,
    headerRowIdx: number,
    lastColLetter: string,
    columns: ColumnSpec[],
  ) {
    const headerRow = sheet.getRow(headerRowIdx);
    headerRow.height = 24;
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXPORT_COLORS.accentGreen } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXPORT_COLORS.surfaceDark } };
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' };
      cell.border = { bottom: { style: 'medium', color: { argb: EXPORT_COLORS.accentGreen } } };
    });
    sheet.autoFilter = `A${headerRowIdx}:${lastColLetter}${headerRowIdx}`;
  }

  private renderRows(
    sheet: ExcelJS.Worksheet,
    dataStartIdx: number,
    columns: ColumnSpec[],
    rows: Array<Record<string, unknown> & { statusRaw: string }>,
    statusKey: string,
  ) {
    rows.forEach((rowObj, idx) => {
      const row = sheet.getRow(dataStartIdx + idx);
      row.height = 20;
      const isAlt = idx % 2 === 1;

      columns.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        const val = rowObj[col.key];
        cell.value = val as ExcelJS.CellValue;
        cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' };
        if (col.numFmt && (val instanceof Date || typeof val === 'number')) {
          cell.numFmt = col.numFmt;
        }
        if (col.key === statusKey) {
          const st = statusColorsArgb(rowObj.statusRaw);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.bg } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: st.fg } };
        } else {
          if (isAlt) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXPORT_COLORS.rowAlt } };
          }
          cell.font = { name: 'Calibri', size: 10, color: { argb: EXPORT_COLORS.textDark } };
        }
        cell.border = { bottom: { style: 'thin', color: { argb: EXPORT_COLORS.borderLight } } };
      });
    });
  }
}
