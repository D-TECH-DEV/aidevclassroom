import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatDateAbidjan, formatXof } from '../export/export-format.util';
import { buildLogicalPaymentReference } from '../../payments/receipt-pdf.service';

export interface SprintNotificationChange {
  label: string;
  oldValue: string;
  newValue: string;
}

export type PriceChangeDirection = 'increase' | 'decrease' | 'mixed';

export interface SprintNotificationEmailParams {
  to: string;
  studentName: string;
  sprintName: string;
  kind:
    | 'SCHEDULE_OR_LOCATION_UPDATED'
    | 'PRICE_UPDATED'
    | 'POSTPONED_OR_SUSPENDED'
    | 'SESSION_REACTIVATED';
  changes?: SprintNotificationChange[];
  priceDirection?: PriceChangeDirection;
  newStatus?: 'DRAFT' | 'INACTIVE';
  note?: string;
  startAt?: Date;
  endAt?: Date;
  city?: string | null;
  location?: string | null;
}

export interface SelectionEmailParams {
  to: string;
  studentName: string;
  sprintName: string;
  kind: 'SELECTION_SELECTED' | 'SELECTION_WAITLIST';
  paidXof: number;
  remainingXof: number;
  refundableTwoThirdsXof: number;
  note?: string;
  startAt?: Date;
  city?: string | null;
  location?: string | null;
}

export interface PaymentReceiptEmailParams {
  to: string;
  studentName: string;
  sprintName: string;
  plan: string;
  paymentId: number;
  reference: string;
  channel?: string | null;
  amountXof: number;
  totalPaidXof: number;
  totalAmountXof: number;
  remainingAmountXof: number;
  paidAt: Date;
  pdfBuffer: Buffer;
}

/**
 * Service d'envoi d'e-mails transactionnels via l'API REST Resend.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY')?.trim() || undefined;
    this.fromEmail =
      config.get<string>('RESEND_FROM_EMAIL')?.trim() ||
      'AIDevClassroom <no-reply@ai-devclassroom.com>';
  }

  async sendRecoveryOtpEmail(params: {
    to: string;
    code: string;
    expiresMinutes: number;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY absente : envoi du code de verification pour ${params.to} ignore.`,
      );
      return false;
    }

    const html = this.wrapEmailLayout({
      badgeText: 'Verification de dossier',
      badgeBg: '#ECFDF5',
      badgeColor: '#065F46',
      title: 'Votre code de verification',
      bodyHtml: `
        <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
          Bonjour,<br/>
          Voici votre code a usage unique pour retrouver votre dossier d'inscription AIDevClassroom :
        </p>
        <div style="margin:20px 0; padding:18px; background:#010F06; border-radius:10px; text-align:center;">
          <span style="font-family:monospace; font-size:28px; font-weight:bold; letter-spacing:0.3em; color:#2EE66B;">
            ${this.escapeHtml(params.code)}
          </span>
        </div>
        <p style="margin:0 0 12px; color:#475569; font-size:13px; line-height:1.6;">
          Ce code est valable pendant <strong>${params.expiresMinutes} minutes</strong> et ne doit etre partage avec personne.
        </p>
        <p style="margin:0; color:#64748B; font-size:12px; line-height:1.6;">
          Si vous n'etes pas a l'origine de cette demande, vous pouvez simplement ignorer cet e-mail.
        </p>
      `,
    });

    return this.postResendEmail(
      {
        from: this.fromEmail,
        to: [params.to],
        subject: 'Votre code de verification — AIDevClassroom',
        html,
      },
      `recovery-otp:${params.to}`,
    );
  }

  async sendPaymentReceiptEmail(
    params: PaymentReceiptEmailParams,
  ): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY absente : envoi du recu ${params.reference} ignore.`,
      );
      return false;
    }

    const estSolde = params.remainingAmountXof <= 0;
    const sujet = estSolde
      ? `Confirmation d'inscription — ${params.sprintName}`
      : `Recu de paiement partiel — ${params.sprintName}`;
    const forfaitLibelle = params.plan === 'DUO' ? 'Duo (2 places)' : 'Solo (1 place)';
    const dateFmt = formatDateAbidjan(params.paidAt);
    const logicalRef = buildLogicalPaymentReference({
      paymentId: params.paymentId,
      sprintName: params.sprintName,
      remainingAmountXof: params.remainingAmountXof,
      channel: params.channel,
    });
    const numeroRecu = `REC-${String(params.paymentId).padStart(4, '0')}`;

    const html = this.wrapEmailLayout({
      badgeText: estSolde ? 'Inscription confirmée' : 'Acompte enregistré',
      badgeBg: estSolde ? '#ECFDF5' : '#EFF6FF',
      badgeColor: estSolde ? '#065F46' : '#1E40AF',
      title: estSolde
        ? 'Votre place est confirmée'
        : 'Votre acompte est enregistré',
      bodyHtml: `
        <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
          Bonjour <strong style="color:#0F172A;">${this.escapeHtml(params.studentName)}</strong>,<br/>
          Nous confirmons la réception de votre paiement pour <strong>${this.escapeHtml(params.sprintName)}</strong> (${forfaitLibelle}).
        </p>
        <table role="presentation" style="width:100%; border-collapse:collapse; margin:20px 0; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden;">
          <tr style="background:#F8FAFC;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Reçu n°</td><td style="padding:10px 14px; text-align:right; font-family:monospace; font-weight:bold; color:#0F172A; font-size:13px; border-bottom:1px solid #E2E8F0;">${numeroRecu}</td></tr>
          <tr style="background:#FFFFFF;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Référence de paiement</td><td style="padding:10px 14px; text-align:right; font-family:monospace; font-weight:bold; color:#0F172A; font-size:13px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(logicalRef)}</td></tr>
          <tr style="background:#F8FAFC;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Date</td><td style="padding:10px 14px; text-align:right; color:#0F172A; font-size:13px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(dateFmt)}</td></tr>
          <tr style="background:#FFFFFF;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Montant payé</td><td style="padding:10px 14px; text-align:right; font-weight:bold; color:#059669; font-size:15px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(formatXof(params.amountXof))}</td></tr>
          <tr style="background:#F8FAFC;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Total versé</td><td style="padding:10px 14px; text-align:right; color:#0F172A; font-size:13px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(formatXof(params.totalPaidXof))} / ${this.escapeHtml(formatXof(params.totalAmountXof))}</td></tr>
          <tr style="background:#FFFFFF;"><td style="padding:10px 14px; color:#475569; font-size:13px;">Reste à payer</td><td style="padding:10px 14px; text-align:right; font-weight:bold; color:${estSolde ? '#059669' : '#1E40AF'}; font-size:14px;">${this.escapeHtml(formatXof(params.remainingAmountXof))}</td></tr>
        </table>
        <p style="margin:0 0 20px; color:#475569; font-size:13px; line-height:1.6;">
          ${
            estSolde
              ? 'Votre inscription est soldée à 100 %. Votre reçu officiel PDF est joint à cet e-mail.'
              : 'Votre place sera définitivement confirmée dès le règlement de 100 % du montant total. Votre reçu officiel PDF est joint à cet e-mail.'
          }
        </p>
        ${
          estSolde
            ? ''
            : `<p style="margin:0 0 8px;">
                 <a href="https://ai-devclassroom.com/paiement/reprendre" style="display:inline-block; background:#010F06; color:#2EE66B; text-decoration:none; font-weight:bold; font-size:13px; padding:11px 20px; border-radius:8px;">Compléter mon paiement</a>
               </p>`
        }
      `,
    });

    return this.postResendEmail(
      {
        from: this.fromEmail,
        to: [params.to],
        subject: sujet,
        html,
        attachments: [
          {
            filename: `recu-aidevclassroom-${params.reference}.pdf`,
            content: params.pdfBuffer.toString('base64'),
          },
        ],
      },
      params.reference,
    );
  }

  buildSprintNotificationEmailContent(
    params: Omit<SprintNotificationEmailParams, 'to'>,
  ): { subject: string; html: string } {
    const estReport = params.kind === 'POSTPONED_OR_SUSPENDED';
    const estReouverture = params.kind === 'SESSION_REACTIVATED';
    const estPrix = params.kind === 'PRICE_UPDATED';
    const directionPrix = params.priceDirection ?? 'mixed';

    const sujet = estReport
      ? `Information importante : report ou suspension — ${params.sprintName}`
      : estReouverture
        ? `Bonne nouvelle : session ouverte — ${params.sprintName}`
        : estPrix
          ? directionPrix === 'increase'
            ? `Information tarifaire (votre tarif reste garanti) — ${params.sprintName}`
            : `Ajustement tarifaire — ${params.sprintName}`
          : `Mise a jour de votre session — ${params.sprintName}`;

    const titre = estReport
      ? params.newStatus === 'INACTIVE'
        ? 'Session suspendue / reportée'
        : 'Session reportée (mise en attente)'
      : estReouverture
        ? 'Votre session est ouverte'
        : estPrix
          ? directionPrix === 'increase'
            ? 'Votre tarif reste intégralement garanti'
            : 'Ajustement tarifaire de la session'
          : 'Mise à jour des informations de formation';

    const introPrixHtml =
      directionPrix === 'increase'
        ? `Le tarif public des nouvelles inscriptions pour la session <strong>${this.escapeHtml(params.sprintName)}</strong> vient d'être révisé à la hausse.<br/><br/>
           <span style="display:block; padding:12px 14px; background:#ECFDF5; border-left:3px solid #10B981; border-radius:4px; color:#065F46; font-size:14px;">
             <strong>Rassurez-vous : votre inscription étant déjà enregistrée, votre tarif initial reste 100 % garanti et inchangé.</strong> Aucun supplément ne vous sera demandé.
           </span>`
        : directionPrix === 'decrease'
          ? `Afin de faciliter l'accès aux dernières places de la session <strong>${this.escapeHtml(params.sprintName)}</strong>, nous avons procédé à un ajustement à la baisse du tarif public des nouvelles inscriptions.<br/><br/>
             <span style="display:block; padding:12px 14px; background:#EFF6FF; border-left:3px solid #2563EB; border-radius:4px; color:#1E3A8A; font-size:14px;">
               Votre place reste pleinement réservée avec l'ensemble des avantages et du suivi prévus. Si vous avez la moindre question concernant votre dossier ou votre solde, n'hésitez pas à répondre à cet e-mail ou à nous écrire sur WhatsApp : notre équipe est à votre écoute.
             </span>`
          : `Les conditions tarifaires des nouvelles inscriptions pour la session <strong>${this.escapeHtml(params.sprintName)}</strong> ont été ajustées.<br/><br/>
             <span style="display:block; padding:12px 14px; background:#F8FAFC; border-left:3px solid #10B981; border-radius:4px; color:#1E293B; font-size:14px;">
               Votre place et votre suivi restent pleinement garantis. Pour toute question concernant votre dossier, notre équipe reste disponible par retour d'e-mail ou sur WhatsApp.
             </span>`;

    const changesRows = (params.changes ?? [])
      .map(
        (c, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'};">
          <td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(c.label)}</td>
          <td style="padding:10px 14px; text-align:right; font-size:13px; border-bottom:1px solid #E2E8F0;">
            <span style="color:#94A3B8; text-decoration:line-through; margin-right:8px;">${this.escapeHtml(c.oldValue)}</span>
            <span style="color:#059669; font-weight:bold;">${this.escapeHtml(c.newValue)}</span>
          </td>
        </tr>`,
      )
      .join('');

    const detailsActuels = [
      params.startAt ? `Début : ${formatDateAbidjan(params.startAt)}` : null,
      params.endAt ? `Fin : ${formatDateAbidjan(params.endAt)}` : null,
      params.city ? `Ville : ${params.city}` : null,
      params.location ? `Lieu : ${params.location}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .map((l) => `<li style="margin:4px 0;">${this.escapeHtml(l)}</li>`)
      .join('');

    const noteBloc = params.note?.trim()
      ? `<div style="margin:16px 0; padding:12px 14px; background:#F8FAFC; border-left:3px solid #10B981; border-radius:4px; color:#1E293B; font-size:13px; line-height:1.5;">
           <strong style="color:#0F172A;">Message de l'équipe :</strong><br/>
           ${this.escapeHtml(params.note.trim())}
         </div>`
      : '';

    const html = this.wrapEmailLayout({
      badgeText: estReport
        ? 'Information importante'
        : estReouverture
          ? 'Session ouverte'
          : estPrix
            ? 'Information tarifaire'
            : 'Mise à jour de session',
      badgeBg: estReport ? '#FEF3C7' : estReouverture ? '#ECFDF5' : '#EFF6FF',
      badgeColor: estReport ? '#92400E' : estReouverture ? '#065F46' : '#1E40AF',
      title: titre,
      bodyHtml: `
        <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
          Bonjour <strong style="color:#0F172A;">${this.escapeHtml(params.studentName)}</strong>,<br/>
          ${
            estReport
              ? `Nous vous informons que la session <strong>${this.escapeHtml(params.sprintName)}</strong> est actuellement reportée. Votre inscription et les versements déjà effectués restent intégralement conservés.`
              : estReouverture
                ? `Nous avons le plaisir de vous informer que la session <strong>${this.escapeHtml(params.sprintName)}</strong> est désormais ouverte. Retrouvez ci-dessous les informations pratiques de votre formation.`
                : estPrix
                  ? introPrixHtml
                  : `Des informations pratiques concernant votre session <strong>${this.escapeHtml(params.sprintName)}</strong> ont été mises à jour.`
          }
        </p>
        ${noteBloc}
        ${
          changesRows
            ? `<table role="presentation" style="width:100%; border-collapse:collapse; margin:20px 0; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden;">${changesRows}</table>`
            : ''
        }
        ${
          !estReport && detailsActuels
            ? `<div style="margin:16px 0; padding:14px 16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
                 <p style="margin:0 0 8px; font-size:12px; font-weight:bold; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Informations à retenir</p>
                 <ul style="margin:0; padding-left:18px; color:#0F172A; font-size:13px; line-height:1.6;">${detailsActuels}</ul>
               </div>`
            : ''
        }
        <p style="margin:20px 0 8px;">
          <a href="https://ai-devclassroom.com/paiement/reprendre" style="display:inline-block; background:#010F06; color:#2EE66B; text-decoration:none; font-weight:bold; font-size:13px; padding:11px 20px; border-radius:8px;">Consulter mon dossier</a>
        </p>
      `,
    });

    return { subject: sujet, html };
  }

  async sendSprintNotificationEmail(
    params: SprintNotificationEmailParams,
  ): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY absente : notification sprint "${params.sprintName}" ignoree.`,
      );
      return false;
    }

    const { subject, html } = this.buildSprintNotificationEmailContent(params);

    return this.postResendEmail(
      {
        from: this.fromEmail,
        to: [params.to],
        subject,
        html,
      },
      `sprint:${params.sprintName}:${params.to}`,
    );
  }

  /**
   * Construit le contenu HTML et l'objet pour les e-mails de sélection (retenus vs liste d'attente).
   */
  buildSelectionEmailContent(
    params: Omit<SelectionEmailParams, 'to'>,
  ): { subject: string; html: string } {
    const estRetenu = params.kind === 'SELECTION_SELECTED';
    const sujet = estRetenu
      ? `Place confirmée : vous êtes retenu(e) — ${params.sprintName}`
      : `Information sur votre inscription (liste d'attente) — ${params.sprintName}`;

    const noteBloc = params.note?.trim()
      ? `<div style="margin:16px 0; padding:12px 14px; background:#F8FAFC; border-left:3px solid #10B981; border-radius:4px; color:#1E293B; font-size:13px; line-height:1.5;">
           <strong style="color:#0F172A;">Message de l'équipe :</strong><br/>
           ${this.escapeHtml(params.note.trim())}
         </div>`
      : '';

    const infosRetenu = [
      params.startAt ? `Début : ${formatDateAbidjan(params.startAt)}` : null,
      params.city ? `Ville : ${params.city}` : null,
      params.location ? `Lieu : ${params.location}` : null,
      params.remainingXof > 0
        ? `Reste à régler avant le début : ${formatXof(params.remainingXof)}`
        : 'Inscription soldée à 100 %',
    ]
      .filter((v): v is string => Boolean(v))
      .map((l) => `<li style="margin:4px 0;">${this.escapeHtml(l)}</li>`)
      .join('');

    const html = this.wrapEmailLayout({
      badgeText: estRetenu ? 'Sélection confirmée' : "Liste d'attente",
      badgeBg: estRetenu ? '#ECFDF5' : '#FEF3C7',
      badgeColor: estRetenu ? '#065F46' : '#92400E',
      title: estRetenu
        ? 'Vous êtes retenu(e) pour la session'
        : 'Quota de places atteint pour cette session',
      bodyHtml: estRetenu
        ? `
          <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
            Bonjour <strong style="color:#0F172A;">${this.escapeHtml(params.studentName)}</strong>,<br/>
            Votre place est retenue pour la session <strong>${this.escapeHtml(params.sprintName)}</strong>.
          </p>
          ${noteBloc}
          <div style="margin:16px 0; padding:14px 16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
            <p style="margin:0 0 8px; font-size:12px; font-weight:bold; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Récapitulatif</p>
            <ul style="margin:0; padding-left:18px; color:#0F172A; font-size:13px; line-height:1.6;">${infosRetenu}</ul>
          </div>
          <p style="margin:20px 0 8px;">
            <a href="https://ai-devclassroom.com/paiement/reprendre" style="display:inline-block; background:#010F06; color:#2EE66B; text-decoration:none; font-weight:bold; font-size:13px; padding:11px 20px; border-radius:8px;">Consulter mon dossier</a>
          </p>
        `
        : `
          <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
            Bonjour <strong style="color:#0F172A;">${this.escapeHtml(params.studentName)}</strong>,<br/>
            Le quota de places pour la session <strong>${this.escapeHtml(params.sprintName)}</strong> est désormais atteint. Votre dossier n'a pas pu être retenu sur cette édition.
          </p>
          ${noteBloc}
          <table role="presentation" style="width:100%; border-collapse:collapse; margin:20px 0; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden;">
            <tr style="background:#F8FAFC;"><td style="padding:10px 14px; color:#475569; font-size:13px; border-bottom:1px solid #E2E8F0;">Montant déjà versé</td><td style="padding:10px 14px; text-align:right; font-weight:bold; color:#0F172A; font-size:13px; border-bottom:1px solid #E2E8F0;">${this.escapeHtml(formatXof(params.paidXof))}</td></tr>
            <tr style="background:#FFFFFF;"><td style="padding:10px 14px; color:#475569; font-size:13px;">Montant remboursable (2/3)</td><td style="padding:10px 14px; text-align:right; font-weight:bold; color:#059669; font-size:14px;">${this.escapeHtml(formatXof(params.refundableTwoThirdsXof))}</td></tr>
          </table>
          <p style="margin:0 0 16px; color:#475569; font-size:13px; line-height:1.6;">
            Conformément aux conditions, vous pouvez demander le remboursement des 2/3 de votre acompte ou reporter 100 % de ce montant sur la prochaine session en nous contactant.
          </p>
          <p style="margin:0 0 8px;">
            <a href="https://ai-devclassroom.com/paiement/reprendre" style="display:inline-block; background:#010F06; color:#2EE66B; text-decoration:none; font-weight:bold; font-size:13px; padding:11px 20px; border-radius:8px;">Voir mon dossier</a>
          </p>
        `,
    });

    return { subject: sujet, html };
  }

  /**
   * Envoie un lot d'e-mails via l'API batch de Resend (max 100 par appel).
   */
  async sendGenericBatch(
    items: Array<{ to: string; subject: string; html: string }>,
  ): Promise<{ sent: string[]; failed: string[] }> {
    if (items.length === 0) return { sent: [], failed: [] };
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY absente : lot de ${items.length} notification(s) ignore.`,
      );
      return { sent: [], failed: items.map((i) => i.to) };
    }

    const sent: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100);
      const payload = chunk.map((item) => ({
        from: this.fromEmail,
        to: [item.to],
        subject: item.subject,
        html: item.html,
      }));

      try {
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          this.logger.warn(
            `Echec batch Resend (${chunk.length} mails): ${res.status} ${body}`,
          );
          failed.push(...chunk.map((c) => c.to));
          continue;
        }
        sent.push(...chunk.map((c) => c.to));
      } catch (e) {
        this.logger.warn(
          `Erreur reseau batch Resend (${chunk.length} mails): ${(e as Error).message}`,
        );
        failed.push(...chunk.map((c) => c.to));
      }
    }

    return { sent, failed };
  }

  async sendSprintNotificationBatch(
    items: SprintNotificationEmailParams[],
  ): Promise<{ sent: string[]; failed: string[] }> {
    return this.sendGenericBatch(
      items.map((item) => {
        const { subject, html } = this.buildSprintNotificationEmailContent(item);
        return { to: item.to, subject, html };
      }),
    );
  }

  private async postResendEmail(
    payload: Record<string, unknown>,
    context: string,
  ): Promise<boolean> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Echec envoi Resend (${context}): ${res.status} ${body}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Erreur reseau Resend (${context}): ${(e as Error).message}`,
      );
      return false;
    }
  }

  async sendEnrollmentCancelledEmail(params: {
    to: string;
    studentName: string;
    sprintName: string;
    enrollmentId: number;
    paidXof: number;
    totalAmountXof: number;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY absente : e-mail d'annulation dossier #${params.enrollmentId} ignore.`,
      );
      return false;
    }

    const aPaye = params.paidXof > 0;
    const paidFmt = formatXof(params.paidXof);
    const totalFmt = formatXof(params.totalAmountXof);
    const subject = aPaye
      ? `Annulation de votre dossier #${params.enrollmentId} (versement trace) — ${params.sprintName}`
      : `Annulation de votre dossier #${params.enrollmentId} — ${params.sprintName}`;

    const blocStatutPaiement = aPaye
      ? `<div style="margin:18px 0; padding:14px 16px; background:#EFF6FF; border-left:3px solid #2563EB; border-radius:6px; color:#1E3A8A; font-size:14px; line-height:1.6;">
           <strong>Versement déjà effectué : ${this.escapeHtml(paidFmt)}</strong> (sur un total initial de ${this.escapeHtml(totalFmt)}).<br/><br/>
           Ce règlement reste intégralement tracé dans notre historique. Lors de votre <strong>prochaine inscription</strong>, il vous suffira de contacter notre équipe (par retour d'e-mail ou sur WhatsApp) avec la référence <strong>#${params.enrollmentId}</strong> afin que nous fassions la différence avec ce montant déjà versé (ou pour organiser un remboursement si vous le souhaitez).
         </div>`
      : `<div style="margin:18px 0; padding:14px 16px; background:#F8FAFC; border-left:3px solid #64748B; border-radius:6px; color:#334155; font-size:14px; line-height:1.6;">
           <strong>Aucun paiement n'avait été enregistré</strong> sur ce dossier.<br/><br/>
           Si vous souhaitez rejoindre cette session ou une prochaine édition, vous pourrez effectuer une nouvelle inscription directement sur notre site à tout moment, sans aucune formalité particulière.
         </div>`;

    const html = this.wrapEmailLayout({
      badgeText: aPaye ? 'Dossier annulé · Paiement tracé' : 'Dossier annulé',
      badgeBg: aPaye ? '#EFF6FF' : '#FEF3C7',
      badgeColor: aPaye ? '#1E40AF' : '#92400E',
      title: `Annulation de votre inscription (#${params.enrollmentId})`,
      bodyHtml: `
        <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
          Bonjour <strong style="color:#0F172A;">${this.escapeHtml(params.studentName)}</strong>,<br/>
          Nous vous confirmons que votre dossier d'inscription <strong>#${params.enrollmentId}</strong> pour la session <strong>${this.escapeHtml(params.sprintName)}</strong> a été annulé.
        </p>
        ${blocStatutPaiement}
        <p style="margin:20px 0 8px;">
          <a href="https://ai-devclassroom.com" style="display:inline-block; background:#010F06; color:#2EE66B; text-decoration:none; font-weight:bold; font-size:13px; padding:11px 20px; border-radius:8px;">Visiter ai-devclassroom.com</a>
        </p>
      `,
    });

    return this.postResendEmail(
      {
        from: this.fromEmail,
        to: [params.to],
        subject,
        html,
      },
      `cancel:${params.enrollmentId}`,
    );
  }

  private wrapEmailLayout(opts: {
    badgeText: string;
    badgeBg: string;
    badgeColor: string;
    title: string;
    bodyHtml: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body style="margin:0; padding:24px 12px; background-color:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <div style="max-width:600px; margin:0 auto; background-color:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; overflow:hidden;">
          <div style="background-color:#010F06; padding:20px 24px; border-bottom:4px solid #2EE66B;">
            <p style="margin:0; font-size:19px; font-weight:bold; letter-spacing:-0.01em;">
              <span style="color:#2EE66B;">AI</span><span style="color:#FFFFFF;">DevClassroom</span>
            </p>
            <p style="margin:4px 0 0; font-size:11px; color:#94A3B8; letter-spacing:0.08em;">
              ATELIER INTENSIF · CÔTE D'IVOIRE
            </p>
          </div>
          <div style="padding:24px;">
            <span style="display:inline-block; padding:4px 10px; border-radius:999px; background-color:${opts.badgeBg}; color:${opts.badgeColor}; font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">
              ${this.escapeHtml(opts.badgeText)}
            </span>
            <h1 style="margin:12px 0 16px; font-size:21px; line-height:1.25; color:#0F172A;">
              ${this.escapeHtml(opts.title)}
            </h1>
            ${opts.bodyHtml}
          </div>
          <div style="padding:16px 24px; background-color:#F8FAFC; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B; text-align:center;">
            AIDevClassroom ·
            <a href="https://ai-devclassroom.com" style="color:#0F172A; text-decoration:underline;">ai-devclassroom.com</a> ·
            <a href="mailto:contact@ai-devclassroom.com" style="color:#0F172A; text-decoration:underline;">contact@ai-devclassroom.com</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
