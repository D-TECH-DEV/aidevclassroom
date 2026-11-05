import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export function sanitizeAdmin<T extends { passwordHash?: unknown }>(u: T) {
  const rest = { ...u };
  delete rest.passwordHash;
  return rest;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async validateAdmin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides.',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides.',
      });
    }
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateAdmin(email, password);
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn =
      (this.config.get<string>('JWT_EXPIRES_IN') as string) ?? '1h';
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn,
    } as never);
    return { accessToken, expiresIn, admin: sanitizeAdmin(user) };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session invalide.',
      });
    }
    return sanitizeAdmin(user);
  }

  async changePassword(userId: number, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session invalide.',
      });
    }
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Mot de passe actuel incorrect.',
      });
    }
    const passwordHash = await bcrypt.hash(next, 12);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return sanitizeAdmin(updated);
  }
}
