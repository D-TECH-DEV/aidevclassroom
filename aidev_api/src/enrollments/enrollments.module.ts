import { Module } from '@nestjs/common';
import { ExportExcelService } from '../common/excel/export-excel.service';
import { ExportPdfService } from '../common/export/export-pdf.service';
import { MailService } from '../common/mail/mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EnrollmentRecoveryService } from './enrollment-recovery.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [PrismaModule],
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    EnrollmentRecoveryService,
    MailService,
    ExportExcelService,
    ExportPdfService,
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
