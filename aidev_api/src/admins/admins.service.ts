import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeAdmin } from '../auth/auth.service';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user
      .findMany({
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map(sanitizeAdmin));
  }

  async detail(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Administrateur introuvable.',
      });
    }
    return sanitizeAdmin(user);
  }

  async create(name: string, email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ADMIN_EMAIL_EXISTS',
        message: 'Cet e-mail est deja utilise.',
      });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalized,
        passwordHash,
        role: 'ADMIN',
      },
    });
    return sanitizeAdmin(user);
  }

  async update(
    id: number,
    data: { name?: string; email?: string; isActive?: boolean },
    requesterId: number,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Administrateur introuvable.',
      });
    }
    if (data.email) {
      const normalized = data.email.trim().toLowerCase();
      const clash = await this.prisma.user.findUnique({
        where: { email: normalized },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException({
          code: 'ADMIN_EMAIL_EXISTS',
          message: 'Cet e-mail est deja utilise.',
        });
      }
      data.email = normalized;
    }
    if (id === requesterId && data.isActive === false) {
      throw new ForbiddenException({
        code: 'CANNOT_DISABLE_SELF',
        message: 'Vous ne pouvez pas desactiver votre propre compte.',
      });
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    return sanitizeAdmin(updated);
  }

  async disable(id: number, requesterId: number) {
    if (id === requesterId) {
      throw new ForbiddenException({
        code: 'CANNOT_DISABLE_SELF',
        message: 'Vous ne pouvez pas desactiver votre propre compte.',
      });
    }
    return this.update(id, { isActive: false }, requesterId);
  }
}
