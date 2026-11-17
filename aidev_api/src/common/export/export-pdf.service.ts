import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  PDF_COLORS,
  formatDateAbidjan,
  formatXof,
  mapEnrollmentRow,
  mapPaymentRow,
  statusColorsHex,
  type EnrollmentExportRow,
  type PaymentExportRow,
} from './export-format.util';

type PdfColumn = {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'center' | 'right';
};

@Injectable()
export class ExportPdfService {
  async exportEnrollments(
    rows: EnrollmentExportRow[],
    filterSummary: string,
  ): Promise<Buffer> {
    const columns: PdfColumn[] = [
      { header: 'ID', key: 'id', width: 32, align: 'center' },
      { header: 'Participant', key: 'participant', width: 120 },
      { header: 'E-mail', key: 'email', width: 140 },
      { header: 'Session (Sprint)', key: 'sprint', width: 130 },
      { header: 'Forfait', key: 'plan', width: 55, align: 'center' },
      { header: 'Statut', key: 'statusLabel', width: 70, align: 'center' },
      { header: 'Total dû', key: 'totalFmt', width: 78, align: 'right' },
      { header: 'Payé', key: 'paidFmt', width: 78, align: 'right' },
      { header: 'Reste', key: 'remainFmt', width: 78, align: 'right' },
    ];

    const totalDue = rows.reduce((s, r) => s + r.totalAmountXof, 0);
    const totalPaid = rows.reduce((s, r) => s + r.totalPaidXof, 0);
    const totalRemain = rows.reduce((s, r) => s + r.remainingAmountXof, 0);

    const mapped = rows.map((r) => {
      const m = mapEnrollmentRow(r);
      return {
        ...m,
        totalFmt: formatXof(m.totalAmountXof),
        paidFmt: formatXof(m.totalPaidXof),
        remainFmt: formatXof(m.remainingAmountXof),
      };
    });

    return this.buildPdf({
      title: 'Export des Inscriptions',
      filterSummary,
      summaryText: `${rows.length} dossier(s) · Total dû : ${formatXof(totalDue)} · Payé : ${formatXof(totalPaid)} · Reste : ${formatXof(totalRemain)}`,
      columns,
      rows: mapped,
      statusKey: 'statusLabel',
    });
  }

  async exportPayments(
    rows: PaymentExportRow[],
    filterSummary: string,
  ): Promise<Buffer> {
    const columns: PdfColumn[] = [
      { header: 'ID', key: 'id', width: 32, align: 'center' },
      { header: 'Référence', key: 'reference', width: 135 },
      { header: 'Statut', key: 'statusLabel', width: 72, align: 'center' },
      { header: 'Montant', key: 'amountFmt', width: 85, align: 'right' },
      { header: 'Participant', key: 'participant', width: 125 },
      { header: 'E-mail', key: 'email', width: 140 },
      { header: 'Session (Sprint)', key: 'sprint', width: 120 },
      { header: 'Dossier', key: 'enrollmentId', width: 48, align: 'center' },
    ];

    const totalAmount = rows.reduce((s, r) => s + r.amountXof, 0);
    const mapped = rows.map((r) => {
      const m = mapPaymentRow(r);
      return { ...m, amountFmt: formatXof(m.amountXof) };
    });

    return this.buildPdf({
      title: 'Journal des Paiements',
      filterSummary,
      summaryText: `${rows.length} transaction(s) · Montant cumulé : ${formatXof(totalAmount)}`,
      columns,
      rows: mapped,
      statusKey: 'statusLabel',
    });
  }

  private buildPdf(opts: {
    title: string;
    filterSummary: string;
    summaryText: string;
    columns: PdfColumn[];
    rows: Array<Record<string, unknown> & { statusRaw: string }>;
    statusKey: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `AIDevClassroom - ${opts.title}`,
          Author: 'AIDevClassroom',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const startX = 28;
      const pageWidth = doc.page.width - 56;
      const rowHeight = 20;
      const headerHeight = 22;

      const drawBanner = (isFirstPage: boolean) => {
        const bannerH = isFirstPage ? 64 : 38;
        doc.rect(startX, 24, pageWidth, bannerH).fill(PDF_COLORS.bgDark);
        doc
          .fillColor(PDF_COLORS.accentGreen)
          .font('Helvetica-Bold')
          .fontSize(isFirstPage ? 15 : 11)
          .text('AIDevClassroom', startX + 12, 32, { lineBreak: false });

        if (isFirstPage) {
          doc
            .fillColor(PDF_COLORS.white)
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(opts.title, startX + 12, 50, { lineBreak: false });
          doc
            .fillColor(PDF_COLORS.muted)
            .font('Helvetica')
            .fontSize(8.5)
            .text(
              `Exporté le ${formatDateAbidjan(new Date())} · ${opts.filterSummary}`,
              startX + 12,
              66,
              { lineBreak: false },
            );
          doc
            .fillColor(PDF_COLORS.surfaceDark)
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(opts.summaryText, startX, 96, { width: pageWidth });
          return 114;
        }
        return 70;
      };

      const drawTableHeader = (y: number) => {
        doc.rect(startX, y, pageWidth, headerHeight).fill(PDF_COLORS.surfaceDark);
        doc
          .moveTo(startX, y + headerHeight)
          .lineTo(startX + pageWidth, y + headerHeight)
          .lineWidth(1.5)
          .strokeColor(PDF_COLORS.accentGreen)
          .stroke();

        let x = startX;
        for (const col of opts.columns) {
          doc
            .fillColor(PDF_COLORS.accentGreen)
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(col.header, x + 4, y + 7, {
              width: col.width - 8,
              align: col.align ?? 'left',
              ellipsis: true,
              lineBreak: false,
            });
          x += col.width;
        }
        return y + headerHeight;
      };

      let y = drawBanner(true);
      y = drawTableHeader(y);

      opts.rows.forEach((rowObj, idx) => {
        if (y + rowHeight > doc.page.height - 40) {
          doc.addPage();
          y = drawBanner(false);
          y = drawTableHeader(y);
        }

        if (idx % 2 === 1) {
          doc.rect(startX, y, pageWidth, rowHeight).fill(PDF_COLORS.rowAlt);
        }

        let x = startX;
        for (const col of opts.columns) {
          const val = String(rowObj[col.key] ?? '—');
          if (col.key === opts.statusKey) {
            const st = statusColorsHex(rowObj.statusRaw);
            doc.rect(x + 2, y + 3, col.width - 4, rowHeight - 6).fill(st.bg);
            doc.fillColor(st.fg).font('Helvetica-Bold');
          } else {
            doc.fillColor(PDF_COLORS.textDark).font('Helvetica');
          }
          doc.fontSize(7.5).text(val, x + 4, y + 6, {
            width: col.width - 8,
            align: col.align ?? 'left',
            ellipsis: true,
            lineBreak: false,
          });
          x += col.width;
        }

        doc
          .moveTo(startX, y + rowHeight)
          .lineTo(startX + pageWidth, y + rowHeight)
          .lineWidth(0.5)
          .strokeColor(PDF_COLORS.borderLight)
          .stroke();
        y += rowHeight;
      });

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc
          .fillColor(PDF_COLORS.muted)
          .font('Helvetica')
          .fontSize(8)
          .text(
            `AIDevClassroom · Page ${i + 1} / ${range.count}`,
            startX,
            doc.page.height - 22,
            { width: pageWidth, align: 'right', lineBreak: false },
          );
      }

      doc.end();
    });
  }
}
