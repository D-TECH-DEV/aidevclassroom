import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export function hashTrackingToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface TrackedRequest {
  params: { id?: string };
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  enrollmentId?: number;
}

function extractToken(req: TrackedRequest): string | undefined {
  const h = req.headers['x-tracking-token'];
  const header = Array.isArray(h) ? h[0] : h;
  const q = req.query['trackingToken'];
  const b = req.body['trackingToken'];
  const raw =
    header ??
    (typeof q === 'string' ? q : undefined) ??
    (typeof b === 'string' ? b : undefined);
  return raw;
}

/** Garde les routes participant : exige le jeton de suivi (header x-tracking-token). */
@Injectable()
export class TrackingTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TrackedRequest>();
    const id = parseInt(req.params?.id ?? '', 10);
    if (!Number.isInteger(id)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: "Identifiant d'inscription invalide.",
      });
    }
    const token = extractToken(req);
    if (!token || token.length < 16) {
      throw new UnauthorizedException({
        code: 'TRACKING_TOKEN_REQUIRED',
        message: 'Jeton de suivi requis.',
      });
    }
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      select: { id: true, trackingTokenHash: true },
    });
    if (!enrollment) {
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Inscription introuvable.',
      });
    }
    if (!safeEqualHex(hashTrackingToken(token), enrollment.trackingTokenHash)) {
      throw new UnauthorizedException({
        code: 'TRACKING_TOKEN_INVALID',
        message: 'Jeton de suivi invalide.',
      });
    }
    req.enrollmentId = id;
    return true;
  }
}
