import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExportExcelService } from '../common/excel/export-excel.service';
import { ExportPdfService } from '../common/export/export-pdf.service';
import { MailService } from '../common/mail/mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentAccessGuard } from './payment-access.guard';
import {
  PaymentsController,
  PaystackWebhookController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { ReceiptPdfService } from './receipt-pdf.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsController, PaystackWebhookController],
  providers: [
    PaymentsService,
    PaystackService,
    PaymentAccessGuard,
    ExportExcelService,
    ExportPdfService,
    MailService,
    ReceiptPdfService,
  ],
  exports: [PaymentsService, PaystackService],
})
export class PaymentsModule {}
