import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_FILTER)
      .useValue(new AllExceptionsFilter())
      .overrideProvider(APP_INTERCEPTOR)
      .useValue(new TransformInterceptor())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  it('/api/v1/health (GET) repond 200', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('routes admin interdites sans JWT (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/sprints').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/payments')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard/summary')
      .expect(401);
  });

  it('webhook sans signature invalide rejette sans effet (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/payments/webhook/paystack')
      .send({ event: 'charge.success', data: { reference: 'sp_x' } })
      .expect(400);
  });

  it('inscription avec corps invalide => 400, pas 500', () => {
    return request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .send({ sprintId: 'nan' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
