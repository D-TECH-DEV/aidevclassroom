import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  PDF_COLORS,
  formatDateAbidjan,
  formatXof,
} from '../common/export/export-format.util';
import {
  RECEIPT_QR_TTL_SECONDS,
  signReceiptAccess,
} from './receipt-signature.util';

export interface ReceiptPdfData {
  paymentId: number;
  enrollmentId: number;
  reference: string;
  channel?: string | null;
  paidAt: Date;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  sprintName: string;
  plan: string;
  amountXof: number;
  totalPaidXof: number;
  totalAmountXof: number;
  remainingAmountXof: number;
}

/**
 * Construit une référence de paiement logique et lisible :
 * PRES{TO|PA}-{MM|CB|PS}-{FORMATION}-REC{NUM}
 */
export function buildLogicalPaymentReference(params: {
  paymentId: number;
  sprintName: string;
  remainingAmountXof: number;
  channel?: string | null;
}): string {
  const mode = params.remainingAmountXof <= 0 ? 'TO' : 'PA';
  const ch = (params.channel ?? '').toLowerCase();
  const type = ch.includes('card')
    ? 'CB'
    : ch.includes('mobile') ||
        ch.includes('wave') ||
        ch.includes('orange') ||
        ch.includes('mtn')
      ? 'MM'
      : 'PS';
  const sprintMatch = params.sprintName.match(/sprint\s*(\d+)/i);
  const formation = sprintMatch
    ? `SP${sprintMatch[1]}`
    : params.sprintName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 6)
        .toUpperCase() || 'FORM';
  const rec = `REC${String(params.paymentId).padStart(4, '0')}`;
  return `PRES${mode}-${type}-${formation}-${rec}`;
}

/**
 * Génère le reçu officiel de paiement AIDevClassroom au format PDF (A4, 1 page) avec QR Code.
 */
@Injectable()
export class ReceiptPdfService {
  constructor(@Optional() private readonly config?: ConfigService) {}

  async generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
    const logicalRef = buildLogicalPaymentReference({
      paymentId: data.paymentId,
      sprintName: data.sprintName,
      remainingAmountXof: data.remainingAmountXof,
      channel: data.channel,
    });
    const baseUrl = (
      this.config
        ?.get<string>('FRONTEND_URL')
        ?.split(',')[0]
        ?.trim() || 'https://ai-devclassroom.com'
    ).replace(/\/$/, '');
    const secret =
      this.config?.get<string>('RECEIPT_SIGNING_SECRET')?.trim() ||
      this.config?.get<string>('JWT_SECRET')?.trim() ||
      process.env.RECEIPT_SIGNING_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      '';
    const exp = Math.floor(Date.now() / 1000) + RECEIPT_QR_TTL_SECONDS;
    const verificationUrl =
      secret.length >= 16
        ? `${baseUrl}/paiement/retour?reference=${encodeURIComponent(data.reference)}&sig=${signReceiptAccess(data.reference, exp, secret)}&exp=${exp}`
        : `${baseUrl}/paiement/retour?reference=${encodeURIComponent(data.reference)}`;
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 240,
      margin: 1,
      color: { dark: '#010F06', light: '#FFFFFF' },
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const estSolde = data.remainingAmountXof <= 0;
      const pageW = doc.page.width;
      const contentW = pageW - 88;

      // En-tête sombre AIDevClassroom
      doc.rect(0, 0, pageW, 104).fill('#010F06');
      doc.rect(0, 100, pageW, 4).fill(PDF_COLORS.accentGreen);

      // Logo typographique AI (vert) + DevClassroom (blanc)
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(PDF_COLORS.accentGreen)
        .text('AI', 44, 24, { continued: true })
        .fillColor('#FFFFFF')
        .text('DevClassroom');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#94A3B8')
        .text('ATELIER INTENSIF · COTE D’IVOIRE · ai-devclassroom.com', 44, 52);

      // Badge Reçu à droite
      doc
        .roundedRect(pageW - 214, 22, 170, 56, 8)
        .fillAndStroke('#082012', PDF_COLORS.accentGreen);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(PDF_COLORS.accentGreen)
        .text('RECU OFFICIEL', pageW - 214, 33, { width: 170, align: 'center' });
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#FFFFFF')
        .text(`N° REC-${String(data.paymentId).padStart(4, '0')}`, pageW - 214, 50, {
          width: 170,
          align: 'center',
        });

      // Bandeau statut + Montant principal
      let y = 122;
      const statusBg = estSolde ? '#ECFDF5' : '#EFF6FF';
      const statusBorder = estSolde ? '#10B981' : '#3B82F6';
      const statusFg = estSolde ? '#065F46' : '#1E40AF';

      doc.roundedRect(44, y, contentW - 140, 82, 10).fillAndStroke(statusBg, statusBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(statusFg)
        .text(
          estSolde
            ? 'STATUT : INSCRIPTION CONFIRMEE (100 % REGLEE)'
            : 'STATUT : ACOMPTE ENREGISTRE (EN ATTENTE DE SOLDE)',
          60,
          y + 12,
          { width: contentW - 170 },
        );
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#0F172A')
        .text(formatXof(data.amountXof), 60, y + 31, { width: contentW - 170 });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text(`Payé le ${formatDateAbidjan(data.paidAt)}`, 60, y + 60);

      // Carte QR Code à droite
      const qrBoxX = pageW - 44 - 124;
      doc.roundedRect(qrBoxX, y, 124, 118, 10).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.image(qrBuffer, qrBoxX + 18, y + 8, { width: 88, height: 88 });
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#334155')
        .text(
          estSolde ? 'SCANNER POUR VERIFIER' : 'SCANNER : RECU & SOLDE',
          qrBoxX,
          y + 101,
          {
            width: 124,
            align: 'center',
          },
        );

      // Référence de paiement logique (sous le bandeau statut, à gauche du QR code)
      y += 94;
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0F172A')
        .text(`Référence de paiement : ${logicalRef}`, 44, y, {
          width: contentW - 140,
        });

      y += 34;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#0F172A')
        .text('DETAILS DE LA RESERVATION', 44, y);
      y += 18;

      const lignes: [string, string][] = [
        ['Participant', data.studentName],
        ['Adresse e-mail', data.studentEmail],
        ['Téléphone', data.studentPhone],
        ['Formation', data.sprintName],
        ['Forfait', data.plan === 'DUO' ? 'Duo (2 places)' : 'Solo (1 place)'],
        ['Montant de ce versement', formatXof(data.amountXof)],
        ['Total versé à ce jour', formatXof(data.totalPaidXof)],
        ['Montant total de la session', formatXof(data.totalAmountXof)],
        ['Reste à régler', formatXof(data.remainingAmountXof)],
      ];

      lignes.forEach(([label, valeur], idx) => {
        const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(44, y, contentW, 27).fillAndStroke(bg, '#E2E8F0');
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor('#475569')
          .text(label, 58, y + 8, { width: 210 });
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(idx === 8 && data.remainingAmountXof > 0 ? '#1E40AF' : '#0F172A')
          .text(valeur, 268, y + 8, { width: contentW - 238, align: 'right' });
        y += 27;
      });

      y += 18;
      doc
        .roundedRect(44, y, contentW, 56, 8)
        .fillAndStroke('#F1F5F9', '#CBD5E1');
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text(
          estSolde
            ? 'Ce reçu atteste du règlement intégral de votre inscription à AIDevClassroom. Présentez ce reçu (ou son QR code) le jour de la session.'
            : 'Rappel : votre place est confirmée uniquement après paiement à 100 %. Scannez le QR code pour accéder à votre reçu et régler le solde. Si le quota de places est atteint avant le solde, les 2/3 du montant versé sont remboursables.',
          58,
          y + 11,
          { width: contentW - 28, lineGap: 3 },
        );

      // Pied de page garanti sur la même page (lineBreak: false évite tout saut de page)
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(
          'AIDevClassroom · https://ai-devclassroom.com · contact@ai-devclassroom.com',
          44,
          doc.page.height - 48,
          { width: contentW, align: 'center', lineBreak: false },
        );

      doc.end();
    });
  }
}
