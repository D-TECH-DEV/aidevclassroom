import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisUrl: string | undefined;
  private client: Redis | null = null;
  private readonly blockingConnections: Redis[] = [];

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('REDIS_URL')?.trim();
    this.redisUrl = raw && raw.length > 0 ? raw : undefined;
  }

  onModuleInit(): void {
    if (!this.redisUrl) {
      this.logger.warn('REDIS_URL absente : client Redis desactive.');
      return;
    }
    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    this.client.on('error', (err) => {
      this.logger.warn(`Erreur client Redis: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      ...this.blockingConnections.map((c) => c.quit().catch(() => undefined)),
      this.client
        ? this.client.quit().catch(() => undefined)
        : Promise.resolve(),
    ]);
    this.blockingConnections.length = 0;
    this.client = null;
  }

  isConfigured(): boolean {
    return Boolean(this.redisUrl);
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** Cree une connexion dediee avec maxRetriesPerRequest: null pour BullMQ. */
  createBlockingConnection(): Redis | null {
    if (!this.redisUrl) return null;
    const conn = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
    conn.on('error', (err) => {
      this.logger.warn(`Erreur connexion Redis BullMQ: ${err.message}`);
    });
    this.blockingConnections.push(conn);
    return conn;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    let timer: NodeJS.Timeout | undefined;
    try {
      const res = await Promise.race([
        this.client.ping(),
        new Promise<string>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 2000);
        }),
      ]);
      return res === 'PONG';
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
