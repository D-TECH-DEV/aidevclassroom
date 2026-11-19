import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { TrackedRequest } from '../common/guards/tracking-token.guard';
import { PrismaService } from '../prisma/prisma.service';
import { verifyReceiptAccess } from './receipt-signature.util';

interface PaymentVerifyRequest {
  method?: string;
  params: { reference?: string };
  headers: TrackedRequest['headers'];
  query: TrackedRequest['query'];
  user?: { role: string; isActive: boolean } | null;
}

function readHeader(
  headers: TrackedRequest['headers'] | undefined,
  name: string,
): string | undefined {
  const val = headers?.[name];
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Acces a un paiement :
 * - Admin JWT actif : acces complet.
 * - Jeton de suivi (header x-tracking-token) : acces participant complet.
 * - Signature HMAC du QR code (headers x-receipt-sig + x-receipt-exp) :
 *   lecture seule uniquement sur les routes GET (verify et receipt).
 */
@Injectable()
export class PaymentAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PaymentVerifyRequest>();
    if (req.user?.role === 'ADMIN' && req.user?.isActive !== false) return true;
    const reference = req.params?.reference;
    if (!reference) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement introuvable.',
      });
    }
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      select: {
        enrollment: { select: { id: true, trackingTokenHash: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement introuvable.',
      });
    }

    const token = readHeader(req.headers, 'x-tracking-token');
    if (!token) {
      const sig = readHeader(req.headers, 'x-receipt-sig');
      const exp = readHeader(req.headers, 'x-receipt-exp');
      if (sig && exp && (req.method ?? '').toUpperCase() === 'GET') {
        const secret =
          this.config?.get<string>('RECEIPT_SIGNING_SECRET')?.trim() ||
          this.config?.get<string>('JWT_SECRET')?.trim() ||
          process.env.RECEIPT_SIGNING_SECRET?.trim() ||
          process.env.JWT_SECRET?.trim() ||
          '';
        if (verifyReceiptAccess(reference, sig, exp, secret)) {
          return true;
        }
        throw new UnauthorizedException({
          code: 'TRACKING_TOKEN_INVALID',
          message: 'Lien de recu invalide ou expire.',
        });
      }
      throw new UnauthorizedException({
        code: 'TRACKING_TOKEN_REQUIRED',
        message: 'Jeton de suivi requis.',
      });
    }

    const given = Buffer.from(
      createHash('sha256').update(token, 'utf8').digest('hex'),
      'hex',
    );
    const expected = Buffer.from(payment.enrollment.trackingTokenHash, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException({
        code: 'TRACKING_TOKEN_INVALID',
        message: 'Jeton de suivi invalide.',
      });
    }
    return true;
  }
}
