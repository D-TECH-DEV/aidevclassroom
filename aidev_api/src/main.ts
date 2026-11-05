import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';

  // Conserver le corps brut exact pour la signature webhook HMAC-SHA512 (RG10).
  app.use(
    json({
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
  app.enableCors({ origin: frontend.split(','), credentials: true });

  if (config.get<string>('SWAGGER_ENABLED') !== 'false') {
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

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`API ecoute sur :${port}/${prefix} — docs : /api/docs`);
}
void bootstrap();
