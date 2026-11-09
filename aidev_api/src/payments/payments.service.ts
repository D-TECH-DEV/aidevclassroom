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
  ChargeMobileMoneyResult,
  PaystackService,
  PaystackVerifyData,
  fromProviderAmount,
  isValidCiMobileMoneyPhone,
  sanitizeProviderPayload,
  toProviderAmount,
} from './paystack.service';

/** Options d'initialisation : canal Charge mobile money (optionnel). */
export interface InitializeOptions {
  provider?: string;
  phone?: string;
}

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

/** Delai court-circuit : un FAILED recent ne re-interroge pas le fournisseur. */
const DEFAULT_FAILED_SHORT_CIRCUIT_MINUTES = 15;

/**
 * Fenetre anti-double-clic serveur (minutes) : une charge PENDING recente
 * (meme dossier, meme montant, meme operateur) est reutilisee apres
 * re-verification au lieu de lancer une seconde demande de debit.
 */
const CHARGE_REUSE_MINUTES = 10;

/** Essais max de tirage de reference en cas de collision unique (P2002). */
const MAX_REFERENCE_ATTEMPTS = 5;

function pendingReserveCutoff(reserveMinutes: number): Date {
  return new Date(Date.now() - reserveMinutes * 60_000);
}

/** Lit le delai de reservation PENDING (minutes) depuis la config. */
function pendingReserveMinutes(config: ConfigService): number {
  const raw = config.get<string>('PAYSTACK_PENDING_RESERVE_MINUTES');
  if (raw == null || raw === '') return DEFAULT_PENDING_RESERVE_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PENDING_RESERVE_MINUTES;
  return n;
}

/** La Charge mobile money est-elle active derriere son flag ? */
function chargeEnabled(config: ConfigService): boolean {
  return ['1', 'true', 'yes'].includes(
    String(config.get<string>('PAYSTACK_CHARGE_ENABLED') ?? 'false')
      .trim()
      .toLowerCase(),
  );
}

/** Liste des codes providers autorises pour la Charge (config CSV). */
function allowedChargeProviders(config: ConfigService): string[] {
  return String(
    config.get<string>('PAYSTACK_CHARGE_PROVIDERS') ?? 'mtn,orange,wave',
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
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
  async initialize(
    enrollmentId: number,
    amountXof: number,
    opts?: InitializeOptions,
  ) {
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

    // Canal Charge mobile money : uniquement si le flag est actif ET qu'un
    // provider mobile money est fourni. Sinon, l'ancien flux
    // transaction/initialize + checkout est conserve tel quel.
    const provider = opts?.provider?.trim().toLowerCase() ?? '';
    const phone = opts?.phone ?? '';
    const chargeActive = chargeEnabled(this.config);
    const useCharge = provider !== '' && chargeActive;
    if (chargeActive && provider === '' && phone !== '') {
      // Canal actif : un numero sans operateur serait ignore en silence
      // (l'ancien flux ne connait pas le debit direct). On refuse
      // franchement plutot que de reserver sans debiter le bon numero.
      // Flag inactif : l'ancien flux est conserve tel quel (repli).
      throw new BadRequestException({
        code: 'PAYMENT_PROVIDER_INVALID',
        message: "Un numero sans operateur est inutilisable : choisis MTN, Orange ou Wave.",
      });
    }
    if (useCharge) {
      if (!allowedChargeProviders(this.config).includes(provider)) {
        throw new BadRequestException({
          code: 'PAYMENT_PROVIDER_INVALID',
          message: "Le fournisseur doit etre l'un de : mtn, orange, wave.",
        });
      }
      if (!isValidCiMobileMoneyPhone(opts?.phone)) {
        throw new BadRequestException({
          code: 'PAYMENT_PHONE_INVALID',
          message:
            'Le numero mobile doit etre au format E.164 ivoirien : 225 suivi de 10 chiffres.',
        });
      }
    }

    // Les reservations abandonnees ne reservent plus : on les marque ici,
    // au moment ou une nouvelle reservation est demandee (voir
    // expireStalePendingPayments). Sans appel, la methode restait lettre
    // morte et les PENDING expiraient sans jamais devenir ABANDONED.
    await this.expireStaleSafely();

    // Anti-double-clic serveur : avant toute nouvelle charge, on re-verifie
    // la tentative en cours (meme dossier, montant, operateur). Payee, on
    // la rend ; encore en attente, on la rend sans re-debiter ; echouee,
    // on passe a une nouvelle charge. Injoignable, on garde la reservation.
    if (useCharge && opts?.phone) {
      const reusable = await this.findReusableChargePending(
        enrollmentId,
        amountXof,
        provider,
      );
      if (reusable) {
        const reverified = await this.reverifyChargeBeforeRecharge(reusable);
        if (reverified) return reverified;
      }
    }

    // Montant 100 % serveur : la reservation PENDING (SELECT ... FOR UPDATE)
    // est identique quel que soit le canal (RG03/RG06).
    const payment = await this.createPendingWithRetry(
      enrollmentId,
      enrollment.totalAmountXof,
      amountXof,
      currency,
    );
    if (useCharge && opts?.phone) {
      return this.initializeViaCharge(
        payment,
        enrollment.student.email,
        provider,
        opts.phone,
        currency,
      );
    }
    return this.initializeViaCheckout(
      payment,
      enrollment.student.email,
      currency,
    );
  }

  /**
   * Reservation PENDING avec boucle anti-collision : en cas de conflit de
   * reference unique (P2002), une nouvelle reference est tiree (borne a
   * MAX_REFERENCE_ATTEMPTS essais) au lieu d'echouer en 409 immediat.
   */
  private async createPendingWithRetry(
    enrollmentId: number,
    totalAmountXof: number,
    amountXof: number,
    currency: string,
  ): Promise<Payment> {
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = newReference();
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Verrouille l'inscription : deux initialisations concurrentes
          // se succedent ici au lieu de lire le meme solde (RG06).
          await tx.$queryRaw`
            SELECT "id" FROM "enrollments" WHERE "id" = ${enrollmentId} FOR UPDATE
          `;
          const fresh = await tx.payment.findMany({
            where: { enrollmentId },
            select: { status: true, amountXof: true, createdAt: true },
          });
          const cutoff = pendingReserveCutoff(
            pendingReserveMinutes(this.config),
          );
          const success = fresh
            .filter((p) => p.status === 'SUCCESS')
            .reduce((s, p) => s + p.amountXof, 0);
          const reserved = fresh
            .filter((p) => p.status === 'PENDING' && p.createdAt >= cutoff)
            .reduce((s, p) => s + p.amountXof, 0);
          const available = totalAmountXof - success - reserved;
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
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException({
      code: 'PAYMENT_REFERENCE_CONFLICT',
      message: 'Conflit de reference, veuillez reessayer.',
    });
  }

  /** Ancien flux conserve : transaction/initialize + checkout (RG08). */
  private async initializeViaCheckout(
    payment: Payment,
    email: string,
    currency: string,
  ) {
    const reference = payment.reference;
    try {
      const init = await this.paystack.initializeTransaction({
        email,
        reference,
        currency,
        callbackUrl: this.paystack.callbackUrl,
        providerAmount: toProviderAmount(payment.amountXof, currency),
      });
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          authorizationUrl: init.authorizationUrl,
          providerReference: init.providerReference,
        },
      });
      return {
        paymentId: updated.id,
        reference: updated.reference,
        status: updated.status,
        authorizationUrl: updated.authorizationUrl,
      };
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
  }

  /**
   * Nouveau flux Charge mobile money (POST /charge). Aucune carte n'est
   * collectee (decision produit). Les statuts pay_offline/pending/send_otp
   * gardent la reservation PENDING : l'utilisateur valide sur son
   * telephone, puis /verify ou le webhook charge.success finalise.
   */
  private async initializeViaCharge(
    payment: Payment,
    email: string,
    provider: string,
    phone: string,
    currency: string,
  ) {
    let charge: ChargeMobileMoneyResult;
    try {
      charge = await this.paystack.chargeMobileMoney({
        email,
        amountXof: payment.amountXof,
        phone,
        provider,
        reference: payment.reference,
      });
    } catch (e) {
      // Fournisseur injoignable : la reservation reste PENDING et
      // re-verifiable, comme pour l'ancien flux.
      this.logger.warn(
        `Echec charge Paystack pour ${payment.reference} : ${(e as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_UNAVAILABLE',
        message:
          'Fournisseur de paiement indisponible. La tentative reste en attente et pourra etre re-verifiee.',
      });
    }
    // L'operateur est conserve avec la reponse (jamais le numero : pas de
    // PII en base) pour l'anti-double-clic : une nouvelle demande avec le
    // meme dossier, montant et operateur retrouve cette tentative.
    const providerResponse = {
      ...sanitizeProviderPayload({
        data: {
          status: charge.rawStatus,
          reference: charge.providerReference,
          amount: toProviderAmount(payment.amountXof, currency),
          currency,
          display_text: charge.displayText,
        },
      }),
      provider,
    } as Prisma.InputJsonValue;
    if (charge.outcome === 'success') {
      // Succes annonce : confirmation serveur obligatoire (RG09) avant SUCCESS.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerReference: charge.providerReference,
          providerResponse,
        },
      });
      return this.verify(payment.reference);
    }
    if (charge.outcome === 'failed') {
      const failed = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          providerReference: charge.providerReference,
          providerResponse,
        },
      });
      throw new UnprocessableEntityException({
        code: 'PAYMENT_CHARGE_FAILED',
        message: "Le paiement mobile a echoue. Aucun montant n'a ete debite.",
        ...({ payment: failed } as object),
      });
    }
    // pay_offline / pending / send_otp : l'utilisateur valide sur son
    // telephone (aucun nouveau parcours cote API). La reservation reste
    // PENDING, re-verifiable via /verify ou le webhook (fenetre 180 s).
    const pending = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: charge.providerReference,
        providerResponse,
      },
    });
    return {
      paymentId: pending.id,
      reference: pending.reference,
      status: pending.status,
      authorizationUrl: pending.authorizationUrl ?? null,
      displayText: charge.displayText ?? null,
      chargeStatus: charge.rawStatus,
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
    // Meme point d'entree que initialize : une verification peut arriver
    // longtemps apres l'abandon du checkout, la reservation est marquee
    // ici. Un ABANDONED paye reste re-verifiable juste apres.
    await this.expireStaleSafely();
    if (payment.status === 'SUCCESS') {
      return this.withBalance(payment); // idempotence RG11
    }
    if (payment.status === 'FAILED' && this.isRecentlyFailed(payment)) {
      // Court-circuit : un echec recent ne re-interroge pas le fournisseur.
      throw new UnprocessableEntityException({
        code: 'PAYMENT_VERIFICATION_MISMATCH',
        message:
          'La transaction ne correspond pas (statut, reference, montant ou devise).',
        ...({ payment } as object),
      });
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
    const status = data.status.toLowerCase();
    const referenceOk =
      data.reference === payment.reference || data.reference === expectedRef;
    const ok =
      status === 'success' &&
      referenceOk &&
      amountXof === payment.amountXof &&
      (data.currency ?? payment.currency).toUpperCase() ===
        payment.currency.toUpperCase();
    if (!ok) {
      const terminal =
        status === 'failed' ||
        status === 'abandoned' ||
        status === 'success' ||
        !referenceOk;
      if (!terminal) {
        // Statut transitoire (pending, pay_offline, ongoing, send_otp...)
        // avec la bonne reference : ce n'est PAS un echec. L'utilisateur
        // valide sur son telephone, la reservation reste PENDING et
        // re-verifiable. Avant, chaque scrutation de la fenetre de 180 s
        // marquait la charge FAILED des la premiere reponse non-success.
        const pending = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerResponse: this.mergedProviderResponse(payment, data),
          },
        });
        return this.withBalance(pending);
      }
      // Echec terminal (failed/abandoned), succes incoherent (montant,
      // devise ou reference), ou reference inconnue : on marque FAILED
      // sans toucher l'inscription (RG07).
      const failed = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          providerResponse: this.mergedProviderResponse(payment, data),
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
          providerResponse: this.mergedProviderResponse(payment, data),
        },
      });
    });
    return this.withBalance(updated);
  }

  /**
   * Fusionne la derniere reponse fournisseur avec les cles locales
   * conservees a l'initialisation (operateur, consigne display_text) :
   * sans elle, chaque verify ecraserait la marque qui permet a
   * l'anti-double-clic de retrouver la tentative, et la consigne
   * operateur disparaîtrait des la premiere scrutation.
   */
  private mergedProviderResponse(
    payment: Payment,
    data: PaystackVerifyData,
  ): Prisma.InputJsonValue {
    const previous = (payment.providerResponse ?? {}) as unknown as Record<
      string,
      unknown
    >;
    const next = sanitizeProviderPayload(data) as Record<string, unknown>;
    if (typeof previous['provider'] === 'string') {
      next['provider'] = previous['provider'];
    }
    if (
      next['display_text'] === undefined &&
      typeof previous['display_text'] === 'string'
    ) {
      next['display_text'] = previous['display_text'];
    }
    return next as Prisma.InputJsonValue;
  }

  /** Un FAILED dont l'echec est recent (fenetre configurable) ? */
  private isRecentlyFailed(payment: Payment): boolean {
    const raw = this.config.get<string>(
      'PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES',
    );
    let minutes = DEFAULT_FAILED_SHORT_CIRCUIT_MINUTES;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) minutes = n;
    }
    if (minutes <= 0) return false;
    const updatedAt = new Date(payment.updatedAt).getTime();
    return Date.now() - updatedAt < minutes * 60_000;
  }

  /**
   * Expiration defensive : un marquage ABANDONED ne doit jamais faire
   * echouer une initialisation ou une verification (panne DB, autre).
   */
  private async expireStaleSafely(): Promise<void> {
    try {
      await this.expireStalePendingPayments();
    } catch (e) {
      this.logger.warn(
        `Expiration des PENDING impossible : ${(e as Error).message}`,
      );
    }
  }

  /**
   * Une charge PENDING recente (meme dossier, montant, operateur) qui
   * porte la marque d'une vraie Charge (provider stocke en base) ?
   * Les PENDING de l'ancien flux checkout (sans provider) ne sont jamais
   * reutilises ici : les deux canaux ne se melangent pas.
   */
  private async findReusableChargePending(
    enrollmentId: number,
    amountXof: number,
    provider: string,
  ): Promise<Payment | null> {
    const cutoff = new Date(Date.now() - CHARGE_REUSE_MINUTES * 60_000);
    const existing = await this.prisma.payment.findFirst({
      where: {
        enrollmentId,
        amountXof,
        status: 'PENDING',
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) return null;
    const stored = existing.providerResponse as unknown as Record<
      string,
      unknown
    > | null;
    if (!stored || typeof stored !== 'object' || stored['provider'] !== provider) {
      return null;
    }
    return existing;
  }

  /**
   * Re-verification avant re-charge (anti-double-clic serveur) : la
   * tentative en cours est interrogee avant d'en lancer une seconde.
   * Payee ou en attente, on la rend (aucun nouveau debit) ; echouee
   * (422), on rend null pour qu'une nouvelle charge parte ; fournisseur
   * injoignable (502), on garde la reservation existante.
   */
  private async reverifyChargeBeforeRecharge(existing: Payment) {
    try {
      const verified = await this.verify(existing.reference);
      const fresh =
        (await this.prisma.payment.findUnique({
          where: { id: existing.id },
        })) ?? existing;
      return {
        ...this.toChargeResponse(fresh),
        status: verified.status,
      };
    } catch (e) {
      if (e instanceof UnprocessableEntityException) return null;
      if (e instanceof BadGatewayException) {
        return this.toChargeResponse(existing);
      }
      throw e;
    }
  }

  /** Forme contrat de la Charge : meme cles que initializeViaCharge. */
  private toChargeResponse(payment: Payment) {
    const stored = (payment.providerResponse ?? {}) as unknown as Record<
      string,
      unknown
    >;
    const displayText =
      typeof stored['display_text'] === 'string'
        ? (stored['display_text'] as string)
        : null;
    const chargeStatus =
      typeof stored['status'] === 'string'
        ? (stored['status'] as string)
        : null;
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      authorizationUrl: payment.authorizationUrl ?? null,
      displayText,
      chargeStatus,
    };
  }

  /**
   * Expiration des reservations abandonnees : les PENDING plus anciens
   * que PAYSTACK_PENDING_RESERVE_MINUTES passent a ABANDONED et ne
   * reservent plus le solde (le statut ABANDONED est enfin utilise).
   * Un ABANDONED reste re-verifiable via /verify s'il a ete paye.
   */
  async expireStalePendingPayments(now: Date = new Date()) {
    const cutoff = new Date(
      now.getTime() - pendingReserveMinutes(this.config) * 60_000,
    );
    const res = await this.prisma.payment.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: { status: 'ABANDONED' },
    });
    return { expired: res.count };
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
      // Lecture seule : aucun appel fournisseur et aucune ecriture
      // financiere pour les evenements autres que charge.success.
      return { received: true, processed: false };
    }
    const payment = await this.prisma.payment.findFirst({
      where: { OR: [{ reference }, { providerReference: reference }] },
      orderBy: { createdAt: 'desc' },
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
