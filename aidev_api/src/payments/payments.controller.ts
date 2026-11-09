import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import type { Request, Response } from 'express';
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
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/enrollments/:id/initialize')
  @UseGuards(TrackingTokenGuard)
  initialize(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.payments.initialize(id, dto.amountXof, {
      provider: dto.provider,
      phone: dto.phone,
    });
  }

  @Get('payments/:reference/verify')
  @UseGuards(PaymentAccessGuard)
  verify(@Param('reference') reference: string) {
    return this.payments.verify(reference);
  }

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('enrollmentId') enrollmentId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('reference') reference?: string,
  ) {
    return this.payments.listAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      {
        enrollmentId: enrollmentId ? parseInt(enrollmentId, 10) : undefined,
        status,
        reference,
      },
    );
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
  async webhook(@Req() req: Request, @Res() res: Response) {
    const raw: Buffer =
      (req as unknown as { rawBody: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    try {
      const result = await this.payments.handleWebhook(raw, signature);
      return res.status(200).json({ data: result, meta: {} });
    } catch (e) {
      const err = e as { status?: number; response?: unknown };
      const status = typeof err.status === 'number' ? err.status : 400;
      const response = (err.response ?? {}) as Record<string, unknown>;
      return res.status(status).json({
        statusCode: status,
        code: (response['code'] as string) ?? 'INVALID_WEBHOOK_SIGNATURE',
        message: (response['message'] as string) ?? 'Signature invalide.',
      });
    }
  }
}
