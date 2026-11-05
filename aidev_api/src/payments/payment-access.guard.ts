import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { TrackedRequest } from '../common/guards/tracking-token.guard';
import { PrismaService } from '../prisma/prisma.service';

interface PaymentVerifyRequest {
  params: { reference?: string };
  headers: TrackedRequest['headers'];
  query: TrackedRequest['query'];
  user?: { role: string; isActive: boolean } | null;
}

/** Acces a la verification d'un paiement : admin JWT ou jeton de suivi de l'inscription. */
@Injectable()
export class PaymentAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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
    const h = req.headers['x-tracking-token'];
    const header = Array.isArray(h) ? h[0] : h;
    const q = req.query['trackingToken'];
    const token = header ?? (typeof q === 'string' ? q : undefined);
    if (!token) {
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
