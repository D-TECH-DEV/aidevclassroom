import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';

  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Conserver le corps brut exact pour la signature webhook HMAC-SHA512 (RG10).
  app.use(
    json({
      limit: '1mb',
      verify: (req: unknown, _res: unknown, buf: Buffer) => {
        (req as Record<string, unknown>)['rawBody'] = Buffer.from(buf);
      },
    }),
  );

  app.setGlobalPrefix(prefix, { exclude: ['/'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const frontend =
    config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  app.enableCors({
    origin: frontend
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tracking-token',
      'x-receipt-sig',
      'x-receipt-exp',
    ],
  });

  const swaggerEnabled =
    config.get<boolean>('SWAGGER_ENABLED') === true &&
    config.get<string>('NODE_ENV') !== 'production';
  if (swaggerEnabled) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('API Sprints de formation')
        .setDescription(
          'Inscriptions et versements partiels (Paystack, XOF). ' +
            'Les routes participant exigent le jeton de suivi (header x-tracking-token).',
        )
        .setVersion('1.0')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'jwt',
        )
        .addApiKey(
          { type: 'apiKey', name: 'x-tracking-token', in: 'header' },
          'tracking-token',
        )
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(
    swaggerEnabled
      ? `API ecoute sur :${port}/${prefix} -- docs : /api/docs`
      : `API ecoute sur :${port}/${prefix}`,
  );
}
void bootstrap();
