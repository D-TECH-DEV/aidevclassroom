import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { MailService } from '../common/mail/mail.service';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from './enrollments.service';

const OTP_TTL_SECONDS = 600;
const MAX_OTP_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_SECONDS = 900;

interface StoredOtpRecord {
  hash: string;
  attempts: number;
  expiresAt: number;
}

@Injectable()
export class EnrollmentRecoveryService {
  private readonly fallbackStore = new Map<string, StoredOtpRecord>();
  private readonly fallbackRate = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    private readonly mail: MailService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private normalizeContact(
    email?: string,
    phone?: string,
  ): {
    contactKey: string;
    cleanEmail?: string;
    cleanPhone?: string;
  } {
    const cleanEmail = email?.trim().toLowerCase() || undefined;
    const cleanPhone = phone?.trim().replace(/[\s-]/g, '') || undefined;
    if (!cleanEmail && !cleanPhone) {
      throw new BadRequestException({
        code: 'CONTACT_REQUIRED',
        message: 'Adresse e-mail ou numero de telephone requis.',
      });
    }
    const contactKey = cleanEmail ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    return { contactKey, cleanEmail, cleanPhone };
  }

  private otpRedisKey(contactKey: string): string {
    const digest = createHash('sha256').update(contactKey, 'utf8').digest('hex');
    return `recovery:otp:${digest}`;
  }

  private rateRedisKey(contactKey: string): string {
    const digest = createHash('sha256').update(contactKey, 'utf8').digest('hex');
    return `recovery:rate:${digest}`;
  }

  private hashOtp(contactKey: string, code: string): string {
    return createHash('sha256')
      .update(`${contactKey}:${code}`, 'utf8')
      .digest('hex');
  }

  private isProduction(): boolean {
    return (
      (this.config?.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production'
    );
  }

  private async allowContactRequest(contactKey: string): Promise<boolean> {
    const key = this.rateRedisKey(contactKey);
    const client = this.redis?.getClient();
    if (client) {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, REQUEST_WINDOW_SECONDS);
      }
      return count <= MAX_REQUESTS_PER_WINDOW;
    }
    if (this.isProduction()) {
      throw new ServiceUnavailableException({
        code: 'RECOVERY_UNAVAILABLE',
        message: 'Service de verification temporairement indisponible.',
      });
    }
    const now = Date.now();
    const cur = this.fallbackRate.get(key);
    if (!cur || cur.expiresAt <= now) {
      this.fallbackRate.set(key, {
        count: 1,
        expiresAt: now + REQUEST_WINDOW_SECONDS * 1000,
      });
      return true;
    }
    cur.count += 1;
    return cur.count <= MAX_REQUESTS_PER_WINDOW;
  }

  private async saveOtp(contactKey: string, record: StoredOtpRecord): Promise<void> {
    const key = this.otpRedisKey(contactKey);
    const client = this.redis?.getClient();
    if (client) {
      const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
      await client.set(key, JSON.stringify(record), 'EX', ttl);
      return;
    }
    if (this.isProduction()) {
      throw new ServiceUnavailableException({
        code: 'RECOVERY_UNAVAILABLE',
        message: 'Service de verification temporairement indisponible.',
      });
    }
    this.fallbackStore.set(key, record);
  }

  private async readOtp(contactKey: string): Promise<StoredOtpRecord | null> {
    const key = this.otpRedisKey(contactKey);
    const client = this.redis?.getClient();
    if (client) {
      const raw = await client.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredOtpRecord;
      } catch {
        return null;
      }
    }
    if (this.isProduction()) {
      throw new ServiceUnavailableException({
        code: 'RECOVERY_UNAVAILABLE',
        message: 'Service de verification temporairement indisponible.',
      });
    }
    const rec = this.fallbackStore.get(key);
    if (!rec) return null;
    if (rec.expiresAt <= Date.now()) {
      this.fallbackStore.delete(key);
      return null;
    }
    return rec;
  }

  private async deleteOtp(contactKey: string): Promise<void> {
    const key = this.otpRedisKey(contactKey);
    const client = this.redis?.getClient();
    if (client) {
      await client.del(key);
      return;
    }
    this.fallbackStore.delete(key);
  }

  /**
   * Envoie un code OTP a 6 chiffres vers l'e-mail du dossier si un dossier
   * actif existe. Retourne toujours une reponse neutre pour empecher
   * toute enumeration de comptes.
   */
  async requestOtp(
    email?: string,
    phone?: string,
  ): Promise<{ sent: boolean; expiresInSeconds: number }> {
    const { contactKey, cleanEmail, cleanPhone } = this.normalizeContact(
      email,
      phone,
    );

    const allowed = await this.allowContactRequest(contactKey);
    if (!allowed) {
      return { sent: true, expiresInSeconds: OTP_TTL_SECONDS };
    }

    const students = await this.prisma.student.findMany({
      where: {
        ...(cleanEmail ? { email: cleanEmail } : { phone: cleanPhone }),
        enrollments: { some: { status: { not: 'CANCELLED' } } },
      },
      select: { email: true },
      take: 3,
    });

    if (students.length > 0) {
      const code = String(randomInt(100000, 1000000));
      const record: StoredOtpRecord = {
        hash: this.hashOtp(contactKey, code),
        attempts: 0,
        expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      };
      await this.saveOtp(contactKey, record);

      const uniqueEmails = [...new Set(students.map((s) => s.email.trim()))].filter(
        Boolean,
      );
      await Promise.all(
        uniqueEmails.map((to) =>
          this.mail.sendRecoveryOtpEmail({
            to,
            code,
            expiresMinutes: Math.round(OTP_TTL_SECONDS / 60),
          }),
        ),
      );
    }

    return { sent: true, expiresInSeconds: OTP_TTL_SECONDS };
  }

  async verifyOtp(email: string | undefined, phone: string | undefined, code: string) {
    const { contactKey, cleanEmail, cleanPhone } = this.normalizeContact(
      email,
      phone,
    );
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new UnauthorizedException({
        code: 'RECOVERY_OTP_INVALID',
        message: 'Code invalide ou expire. Demande un nouveau code.',
      });
    }

    const record = await this.readOtp(contactKey);
    if (!record || record.attempts >= MAX_OTP_ATTEMPTS || record.expiresAt <= Date.now()) {
      await this.deleteOtp(contactKey);
      throw new UnauthorizedException({
        code: 'RECOVERY_OTP_INVALID',
        message: 'Code invalide ou expire. Demande un nouveau code.',
      });
    }

    const candidateHash = Buffer.from(
      this.hashOtp(contactKey, cleanCode),
      'hex',
    );
    const expectedHash = Buffer.from(record.hash, 'hex');
    const valid =
      candidateHash.length === expectedHash.length &&
      timingSafeEqual(candidateHash, expectedHash);

    if (!valid) {
      const nextAttempts = record.attempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await this.deleteOtp(contactKey);
      } else {
        await this.saveOtp(contactKey, {
          ...record,
          attempts: nextAttempts,
        });
      }
      throw new UnauthorizedException({
        code: 'RECOVERY_OTP_INVALID',
        message: 'Code invalide ou expire. Verifie le code recu par e-mail.',
      });
    }

    await this.deleteOtp(contactKey);
    return this.enrollments.findByContact(cleanEmail, cleanPhone);
  }
}
