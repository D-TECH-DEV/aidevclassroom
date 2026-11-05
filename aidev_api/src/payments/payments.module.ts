import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentAccessGuard } from './payment-access.guard';
import {
  PaymentsController,
  PaystackWebhookController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsController, PaystackWebhookController],
  providers: [PaymentsService, PaystackService, PaymentAccessGuard],
  exports: [PaymentsService, PaystackService],
})
export class PaymentsModule {}
