import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AMOUNT_ERROR_MESSAGES,
  remainingAmountXof,
  totalPaidXof,
  validatePaymentAmount,
} from './balance.util';
import {
  PaystackService,
  PaystackVerifyData,
  fromProviderAmount,
  sanitizeProviderPayload,
  toProviderAmount,
} from './paystack.service';

function newReference(): string {
  return `sp_${Date.now().toString(36)}_${randomBytes(12).toString('hex')}`;
}

/**
 * Duree (minutes) pendant laquelle un paiement PENDING reserve le solde.
 * Au-dela, la reservation expire : un participant qui a abandonne son
 * checkout Paystack ne bloque plus les versements suivants (le PENDING
 * expire reste re-verifiable via /verify ou le webhook s'il a ete paye).
 * Surchargable via PAYSTACK_PENDING_RESERVE_MINUTES.
 */
const DEFAULT_PENDING_RESERVE_MINUTES = 120;

function pendingReserveCutoff(reserveMinutes: number): Date {
  return new Date(Date.now() - reserveMinutes * 60_000);
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly config: ConfigService,
  ) {}

  private balanceOf(
    total: number,
    payments: { status: string; amountXof: number }[],
  ) {
    return {
      totalPaid: totalPaidXof(payments),
      remaining: remainingAmountXof(total, payments),
    };
  }

  /**
   * Initialisation d'un versement (RG03/RG06/RG08).
   * Anti-depassement concurrent : la ligne d'inscription est verrouillee
   * (SELECT ... FOR UPDATE) puis la verification du solde et la creation
   * PENDING ont lieu dans la meme transaction. Les PENDING recents sont
   * comptes comme reserves pour empecher deux initialisations simultanees
   * de depasser le solde ; les PENDING expires (checkout abandonne) ne
   * reservent plus rien mais restent re-verifiables.
   */
  async initialize(enrollmentId: number, amountXof: number) {
    const errEarly =
      Number.isInteger(amountXof) && amountXof > 0
        ? null
        : ('PAYMENT_AMOUNT_INVALID' as const);
    if (errEarly) {
      throw new BadRequestException({
        code: errEarly,
        message: AMOUNT_ERROR_MESSAGES[errEarly],
      });
    }
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { email: true } },
        sprint: {
          select: {
            minimumPaymentXof: true,
            duoMinimumPaymentXof: true,
            status: true,
          },
        },
        payments: { select: { status: true, amountXof: true } },
      },
    });
    if (!enrollment) {
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Inscription introuvable.',
      });
    }
    if (enrollment.status === 'CANCELLED') {
      throw new UnprocessableEntityException({
        code: 'ENROLLMENT_CANCELLED',
        message: 'Inscription annulee : aucun versement possible.',
      });
    }
    const { remaining } = this.balanceOf(
      enrollment.totalAmountXof,
      enrollment.payments,
    );
    // Un dossier DUO utilise son minimum duo quand il est defini.
    const enrollmentPlan = enrollment.plan;
    const minimum =
      enrollmentPlan === 'DUO' && enrollment.sprint.duoMinimumPaymentXof != null
        ? enrollment.sprint.duoMinimumPaymentXof
        : enrollment.sprint.minimumPaymentXof;
    const err = validatePaymentAmount(amountXof, minimum, remaining);
    if (err) {
      const status =
        err === 'PAYMENT_AMOUNT_EXCEEDS_BALANCE' ||
        err === 'ENROLLMENT_ALREADY_SETTLED'
          ? 409
          : 400;
      const Ex = status === 409 ? ConflictException : BadRequestException;
      throw new Ex({ code: err, message: AMOUNT_ERROR_MESSAGES[err] });
    }

    const currency = this.config.get<string>('PAYSTACK_CURRENCY') ?? 'XOF';
    const reference = newReference();
    let payment: Payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        // Verrouille l'inscription : deux initialisations concurrentes
        // se succedent ici au lieu de lire le meme solde (RG06).
        await tx.$queryRaw`
          SELECT "id" FROM "enrollments" WHERE "id" = ${enrollmentId} FOR UPDATE
        `;
        const fresh = await tx.payment.findMany({
          where: { enrollmentId },
          select: { status: true, amountXof: true, createdAt: true },
        });
        const reserveMinutes =
          Number(this.config.get<string>('PAYSTACK_PENDING_RESERVE_MINUTES')) ||
          DEFAULT_PENDING_RESERVE_MINUTES;
        const cutoff = pendingReserveCutoff(reserveMinutes);
        const success = fresh
          .filter((p) => p.status === 'SUCCESS')
          .reduce((s, p) => s + p.amountXof, 0);
        const reserved = fresh
          .filter((p) => p.status === 'PENDING' && p.createdAt >= cutoff)
          .reduce((s, p) => s + p.amountXof, 0);
        const available = enrollment.totalAmountXof - success - reserved;
        if (amountXof > available) {
          throw new ConflictException({
            code: 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
            message: 'Solde insuffisant compte tenu des versements en cours.',
          });
        }
        return tx.payment.create({
          data: {
            enrollmentId,
            amountXof,
            currency,
            reference,
            status: 'PENDING',
          },
        });
      });
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PAYMENT_REFERENCE_CONFLICT',
          message: 'Conflit de reference, veuillez reessayer.',
        });
      }
      throw e;
    }

    // Appel Paystack cote serveur (RG08).
    try {
      const init = await this.paystack.initializeTransaction({
        email: enrollment.student.email,
        reference,
        currency,
        callbackUrl: this.paystack.callbackUrl,
        providerAmount: toProviderAmount(amountXof, currency),
      });
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          authorizationUrl: init.authorizationUrl,
          providerReference: init.providerReference,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Echec init Paystack pour ${reference} : ${(e as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_UNAVAILABLE',
        message:
          'Fournisseur de paiement indisponible. La tentative reste en attente et pourra etre re-verifiee.',
      });
    }
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      authorizationUrl: payment.authorizationUrl,
    };
  }

  /**
   * Verification serveur (RG09/RG11/RG12) : le retour navigateur ne prouve
   * rien ; on interroge Paystack puis on controle statut, reference,
   * montant et devise avant de passer a SUCCESS. Idempotent.
   */
  async verify(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: {
        enrollment: {
          include: { payments: { select: { status: true, amountXof: true } } },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement introuvable.',
      });
    }
    if (payment.status === 'SUCCESS') {
      return this.withBalance(payment); // idempotence RG11
    }
    let data: PaystackVerifyData;
    try {
      data = await this.paystack.verifyTransaction(
        payment.providerReference ?? payment.reference,
      );
    } catch {
      throw new BadGatewayException({
        code: 'PAYSTACK_VERIFY_FAILED',
        message: 'Verification impossible aupres du fournisseur.',
      });
    }
    return this.applyVerification(payment, data);
  }

  async applyVerification(
    payment: Payment & { enrollment?: { totalAmountXof: number } | null },
    data: PaystackVerifyData,
  ) {
    const expectedRef = payment.providerReference ?? payment.reference;
    const amountXof = fromProviderAmount(
      data.amount,
      data.currency ?? payment.currency,
    );
    const ok =
      data.status === 'success' &&
      (data.reference === payment.reference ||
        data.reference === expectedRef) &&
      amountXof === payment.amountXof &&
      (data.currency ?? payment.currency).toUpperCase() ===
        payment.currency.toUpperCase();
    if (!ok) {
      // Echec de controle : on marque FAILED sans toucher l'inscription (RG07).
      const failed = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          providerResponse: sanitizeProviderPayload(
            data,
          ) as Prisma.InputJsonValue,
        },
      });
      throw new UnprocessableEntityException({
        code: 'PAYMENT_VERIFICATION_MISMATCH',
        message:
          'La transaction ne correspond pas (statut, reference, montant ou devise).',
        // on retourne quand meme l'etat pour traçabilite
        ...({ payment: failed } as object),
      });
    }
    // Passage atomique a SUCCESS (idempotent : si deja SUCCESS, on ne recompte pas).
    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!fresh) {
        throw new NotFoundException({
          code: 'PAYMENT_NOT_FOUND',
          message: 'Paiement introuvable.',
        });
      }
      if (fresh.status === 'SUCCESS') return fresh;
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          providerResponse: sanitizeProviderPayload(
            data,
          ) as Prisma.InputJsonValue,
        },
      });
    });
    return this.withBalance(updated);
  }

  private async withBalance(payment: Payment) {
    const siblings = await this.prisma.payment.findMany({
      where: { enrollmentId: payment.enrollmentId },
      select: { status: true, amountXof: true },
    });
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: payment.enrollmentId },
      select: { totalAmountXof: true },
    });
    return {
      ...payment,
      totalPaidXof: totalPaidXof(siblings),
      remainingAmountXof: remainingAmountXof(
        enrollment?.totalAmountXof ?? payment.amountXof,
        siblings,
      ),
    };
  }

  /**
   * Webhook Paystack (RG10/RG11) : signature HMAC-SHA512 sur le corps brut
   * exact, comparaison en temps constant, puis re-verification serveur
   * avant toute ecriture financiere. Invalide => aucune modification.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.paystack.checkSignature(rawBody, signature)) {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'Signature webhook invalide.',
      });
    }
    let event: { event?: string; data?: { reference?: string } };
    try {
      const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('bad');
      event = parsed;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Corps webhook illisible.',
      });
    }
    const reference = event.data?.reference;
    if (!reference) {
      return { received: true, processed: false };
    }
    if (event.event !== 'charge.success') {
      // On accuse reception sans ecriture financiere.
      const existing = await this.prisma.payment.findFirst({
        where: {
          OR: [{ reference }, { providerReference: reference }],
        },
      });
      if (existing && existing.status !== 'SUCCESS') {
        // Re-verification prudente meme pour les evenements non success.
        return this.verify(existing.reference);
      }
      return { received: true, processed: false };
    }
    const payment = await this.prisma.payment.findFirst({
      where: { OR: [{ reference }, { providerReference: reference }] },
    });
    if (!payment) {
      return { received: true, processed: false };
    }
    if (payment.status === 'SUCCESS') {
      return this.withBalance(payment); // idempotence
    }
    return this.verify(payment.reference);
  }

  async listAdmin(
    page = 1,
    limit = 20,
    filters: {
      enrollmentId?: number;
      status?: PaymentStatus;
      reference?: string;
    } = {},
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: Prisma.PaymentWhereInput = {
      ...(filters.enrollmentId ? { enrollmentId: filters.enrollmentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.reference
        ? {
            OR: [
              { reference: { contains: filters.reference } },
              { providerReference: { contains: filters.reference } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          enrollment: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              sprint: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, limit: take };
  }

  async detailAdmin(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            student: true,
            sprint: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement introuvable.',
      });
    }
    return payment;
  }

  async recheck(id: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement introuvable.',
      });
    }
    return this.verify(payment.reference);
  }
}
