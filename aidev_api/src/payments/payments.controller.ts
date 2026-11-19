import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Optional,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { ExportExcelService } from '../common/excel/export-excel.service';
import { ExportPdfService } from '../common/export/export-pdf.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TrackingTokenGuard } from '../common/guards/tracking-token.guard';
import { InitializePaymentDto } from './dto/payment.dto';
import { PaymentAccessGuard } from './payment-access.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly excel: ExportExcelService,
    private readonly pdf: ExportPdfService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Post('payments/enrollments/:id/initialize')
  @UseGuards(TrackingTokenGuard)
  initialize(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InitializePaymentDto,
    @Headers('origin') origin?: string,
  ) {
    let callbackUrl: string | undefined;
    const nodeEnv =
      this.config?.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    if (nodeEnv !== 'production' && origin) {
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      const allowed = (this.config?.get<string>('FRONTEND_URL') ?? '')
        .split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean);
      if (allowed.includes(cleanOrigin)) {
        callbackUrl = `${cleanOrigin}/paiement/retour`;
      }
    }
    return this.payments.initialize(id, dto.amountXof, {
      provider: dto.provider,
      phone: dto.phone,
      partialTermsAccepted: dto.partialTermsAccepted,
      callbackUrl,
    });
  }

  @Get('payments/:reference/verify')
  @UseGuards(PaymentAccessGuard)
  verify(@Param('reference') reference: string) {
    return this.payments.verify(reference);
  }

  @Post('payments/:reference/cancel')
  @UseGuards(PaymentAccessGuard)
  cancel(@Param('reference') reference: string) {
    return this.payments.cancelPending(reference);
  }

  @Get('payments/:reference/receipt')
  @UseGuards(PaymentAccessGuard)
  async receipt(
    @Param('reference') reference: string,
    @Res() res: Response,
  ) {
    const buffer = await this.payments.generateReceiptPdf(reference);
    const safeRef = reference.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recu-aidevclassroom-${safeRef}.pdf"`,
    );
    return res.send(buffer);
  }

  @Post('payments/:reference/receipt/email')
  @UseGuards(PaymentAccessGuard)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  sendReceiptEmail(@Param('reference') reference: string) {
    return this.payments.sendReceiptByEmail(reference);
  }

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('enrollmentId') enrollmentId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('reference') reference?: string,
  ) {
    const parsedSprintId = sprintId ? parseInt(sprintId, 10) : undefined;
    return this.payments.listAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      {
        enrollmentId: enrollmentId ? parseInt(enrollmentId, 10) : undefined,
        sprintId: Number.isFinite(parsedSprintId) ? parsedSprintId : undefined,
        status,
        reference,
      },
    );
  }

  @Get('admin/payments/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  async exportData(
    @Res() res: Response,
    @Query('enrollmentId') enrollmentId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('reference') reference?: string,
    @Query('format') format?: string,
  ) {
    const parsedEnrollmentId = enrollmentId
      ? parseInt(enrollmentId, 10)
      : undefined;
    const parsedSprintId = sprintId ? parseInt(sprintId, 10) : undefined;
    const rows = await this.payments.exportAdmin({
      enrollmentId: Number.isFinite(parsedEnrollmentId)
        ? parsedEnrollmentId
        : undefined,
      sprintId: Number.isFinite(parsedSprintId) ? parsedSprintId : undefined,
      status,
      reference,
    });
    const filtres = [
      Number.isFinite(parsedSprintId) ? `Sprint #${parsedSprintId}` : null,
      status ? `Statut : ${status}` : 'Tous les statuts',
      reference ? `Référence : ${reference}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const dateTag = new Date().toISOString().slice(0, 10);
    const isPdf = format?.toLowerCase() === 'pdf';
    const buffer = isPdf
      ? await this.pdf.exportPayments(rows, filtres)
      : await this.excel.exportPayments(rows, filtres);
    res.setHeader(
      'Content-Type',
      isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aidevclassroom-paiements-${dateTag}.${isPdf ? 'pdf' : 'xlsx'}"`,
    );
    return res.send(buffer);
  }

  @Get('admin/payments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.payments.detailAdmin(id);
  }

  @Post('admin/payments/:id/recheck')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  recheck(@Param('id', ParseIntPipe) id: number) {
    return this.payments.recheck(id);
  }
}

@ApiTags('payments-webhook')
@Controller()
export class PaystackWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/webhook/paystack')
  @SkipThrottle()
  async webhook(@Req() req: Request, @Res() res: Response) {
    const raw: Buffer =
      (req as unknown as { rawBody: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    try {
      const result = await this.payments.handleWebhook(raw, signature);
      return res.status(200).json({ data: result, meta: {} });
    } catch (e) {
      if (e instanceof HttpException) {
        const status = e.getStatus();
        const rawResp = e.getResponse();
        const response = (
          typeof rawResp === 'object' && rawResp !== null ? rawResp : {}
        ) as Record<string, unknown>;
        return res.status(status).json({
          statusCode: status,
          code: (response['code'] as string) ?? 'WEBHOOK_ERROR',
          message: (response['message'] as string) ?? 'Requete webhook invalide.',
        });
      }
      return res.status(500).json({
        statusCode: 500,
        code: 'WEBHOOK_PROCESSING_ERROR',
        message: 'Erreur interne de traitement du webhook.',
      });
    }
  }
}
