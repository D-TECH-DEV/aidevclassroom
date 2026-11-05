import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function createAdapter(): PrismaPg {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL manquante : renseignez .env (voir .env.example).',
    );
  }
  return new PrismaPg(url);
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: createAdapter() });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      // La connexion est etablie a la premiere requete ; on ne bloque
      // pas le demarrage (utile pour les tests avec mock).
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
