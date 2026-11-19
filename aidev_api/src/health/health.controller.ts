import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    let redis: 'up' | 'down' | 'disabled' = 'disabled';
    if (this.redis?.isConfigured()) {
      redis = (await this.redis.ping()) ? 'up' : 'down';
    }

    const payload = {
      status: db === 'up' && redis !== 'down' ? 'ok' : 'degraded',
      db,
      redis,
      time: new Date().toISOString(),
    };

    if (payload.status !== 'ok') {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
