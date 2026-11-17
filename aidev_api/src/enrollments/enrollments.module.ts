import { Module } from '@nestjs/common';
import { ExportExcelService } from '../common/excel/export-excel.service';
import { ExportPdfService } from '../common/export/export-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [PrismaModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, ExportExcelService, ExportPdfService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
