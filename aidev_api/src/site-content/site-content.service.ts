import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateFaqItemDto,
  UpdateSiteContentDto,
  UpdateTrainerItemDto,
} from './dto/site-content.dto';

export type PublicTrainer = {
  id: number;
  firstName: string;
  lastName: string | null;
  role: string;
  photoPath: string | null;
  badgePath: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  sortOrder: number;
};

export type PublicFaqItem = {
  id: number;
  question: string;
  answer: string | null;
  sortOrder: number;
};

export type SiteContentPayload = {
  whatsappDisplay: string;
  whatsappHref: string;
  trainers: PublicTrainer[];
  faqs: PublicFaqItem[];
};

const DEFAULT_WHATSAPP_DISPLAY = '07 04 92 10 80';
const DEFAULT_WHATSAPP_HREF = 'https://wa.me/2250704921080';

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeOptional(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private mapTrainer(row: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    photoPath: string | null;
    badgePath: string | null;
    bio: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    sortOrder: number;
  }): PublicTrainer {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: this.normalizeOptional(row.lastName),
      role: row.role,
      photoPath: this.normalizeOptional(row.photoPath),
      badgePath: this.normalizeOptional(row.badgePath),
      bio: this.normalizeOptional(row.bio),
      githubUrl: this.normalizeOptional(row.githubUrl),
      linkedinUrl: this.normalizeOptional(row.linkedinUrl),
      portfolioUrl: this.normalizeOptional(row.portfolioUrl),
      sortOrder: row.sortOrder,
    };
  }

  private mapFaq(row: {
    id: number;
    question: string;
    answer: string;
    sortOrder: number;
  }): PublicFaqItem {
    return {
      id: row.id,
      question: row.question,
      answer: this.normalizeOptional(row.answer),
      sortOrder: row.sortOrder,
    };
  }

  async getPublicContent(): Promise<SiteContentPayload> {
    const [settings, trainers, faqs] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { id: 1 } }),
      this.prisma.trainer.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.faqItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      whatsappDisplay:
        settings?.whatsappDisplay?.trim() || DEFAULT_WHATSAPP_DISPLAY,
      whatsappHref: settings?.whatsappHref?.trim() || DEFAULT_WHATSAPP_HREF,
      trainers: trainers.map((row) => this.mapTrainer(row)),
      faqs: faqs.map((row) => this.mapFaq(row)),
    };
  }

  private trainerWriteData(item: UpdateTrainerItemDto, index: number) {
    return {
      firstName: item.firstName.trim(),
      lastName: item.lastName?.trim() ?? '',
      role: item.role.trim(),
      photoPath: this.normalizeOptional(item.photoPath),
      badgePath: this.normalizeOptional(item.badgePath),
      bio: item.bio?.trim() ?? '',
      githubUrl: this.normalizeOptional(item.githubUrl),
      linkedinUrl: this.normalizeOptional(item.linkedinUrl),
      portfolioUrl: this.normalizeOptional(item.portfolioUrl),
      sortOrder: item.sortOrder ?? index + 1,
    };
  }

  private faqWriteData(item: UpdateFaqItemDto, index: number) {
    return {
      question: item.question.trim(),
      answer: item.answer?.trim() ?? '',
      sortOrder: item.sortOrder ?? index + 1,
    };
  }

  async updateContent(dto: UpdateSiteContentDto): Promise<SiteContentPayload> {
    const whatsappDisplay = dto.whatsappDisplay.trim();
    const whatsappHref = dto.whatsappHref.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { id: 1 },
        update: { whatsappDisplay, whatsappHref },
        create: { id: 1, whatsappDisplay, whatsappHref },
      });

      if (dto.trainers !== undefined) {
        const existingTrainers = await tx.trainer.findMany({
          select: { id: true },
        });
        const validIds = new Set(existingTrainers.map((t) => t.id));
        const keptIds: number[] = [];

        for (let i = 0; i < dto.trainers.length; i += 1) {
          const item = dto.trainers[i];
          const data = this.trainerWriteData(item, i);
          if (item.id && validIds.has(item.id)) {
            await tx.trainer.update({ where: { id: item.id }, data });
            keptIds.push(item.id);
          } else {
            const created = await tx.trainer.create({ data });
            keptIds.push(created.id);
          }
        }

        await tx.trainer.deleteMany({
          where: keptIds.length > 0 ? { id: { notIn: keptIds } } : {},
        });
      }

      if (dto.faqs !== undefined) {
        const existingFaqs = await tx.faqItem.findMany({
          select: { id: true },
        });
        const validIds = new Set(existingFaqs.map((f) => f.id));
        const keptIds: number[] = [];

        for (let i = 0; i < dto.faqs.length; i += 1) {
          const item = dto.faqs[i];
          const data = this.faqWriteData(item, i);
          if (item.id && validIds.has(item.id)) {
            await tx.faqItem.update({ where: { id: item.id }, data });
            keptIds.push(item.id);
          } else {
            const created = await tx.faqItem.create({ data });
            keptIds.push(created.id);
          }
        }

        await tx.faqItem.deleteMany({
          where: keptIds.length > 0 ? { id: { notIn: keptIds } } : {},
        });
      }
    });

    return this.getPublicContent();
  }
}
