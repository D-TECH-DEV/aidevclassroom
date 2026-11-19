import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';
import type { Response } from 'express';
import { ExportExcelService } from '../common/excel/export-excel.service';
import { ExportPdfService } from '../common/export/export-pdf.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TrackingTokenGuard } from '../common/guards/tracking-token.guard';
import {
  ChangeEnrollmentStatusDto,
  CreateEnrollmentDto,
  LookupByEmailDto,
  VerifyRecoveryOtpDto,
} from './dto/enrollment.dto';
import { EnrollmentRecoveryService } from './enrollment-recovery.service';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly recovery: EnrollmentRecoveryService,
    private readonly excel: ExportExcelService,
    private readonly pdf: ExportPdfService,
  ) {}

  @Post('enrollments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(dto.sprintId, dto.student, dto.plan, {
      firstName: dto.partnerFirstName,
      lastName: dto.partnerLastName,
      phone: dto.partnerPhone,
    });
  }

  @Post('enrollments/recovery/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestRecovery(@Body() dto: LookupByEmailDto) {
    return this.recovery.requestOtp(dto.email, dto.phone);
  }

  @Post('enrollments/recovery/verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyRecovery(@Body() dto: VerifyRecoveryOtpDto) {
    return this.recovery.verifyOtp(dto.email, dto.phone, dto.code);
  }

  @Get('admin/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sprintId') sprintId?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('search') search?: string,
  ) {
    return this.enrollments.listAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      {
        sprintId: sprintId ? parseInt(sprintId, 10) : undefined,
        status,
        search,
      },
    );
  }

  @Get('admin/enrollments/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  async exportData(
    @Res() res: Response,
    @Query('sprintId') sprintId?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('search') search?: string,
    @Query('format') format?: string,
  ) {
    const parsedSprintId = sprintId ? parseInt(sprintId, 10) : undefined;
    const rows = await this.enrollments.exportAdmin({
      sprintId: Number.isFinite(parsedSprintId) ? parsedSprintId : undefined,
      status,
      search,
    });
    const filtres = [
      Number.isFinite(parsedSprintId) ? `Sprint #${parsedSprintId}` : null,
      status ? `Statut : ${status}` : 'Tous les statuts',
      search ? `Recherche : ${search}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const dateTag = new Date().toISOString().slice(0, 10);
    const isPdf = format?.toLowerCase() === 'pdf';
    const buffer = isPdf
      ? await this.pdf.exportEnrollments(rows, filtres)
      : await this.excel.exportEnrollments(rows, filtres);
    res.setHeader(
      'Content-Type',
      isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aidevclassroom-inscriptions-${dateTag}.${isPdf ? 'pdf' : 'xlsx'}"`,
    );
    return res.send(buffer);
  }

  @Get('admin/enrollments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.detailAdmin(id);
  }

  @Get('enrollments/:id/status')
  @UseGuards(TrackingTokenGuard)
  status(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.statusForParticipant(id);
  }

  @Patch('admin/enrollments/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeEnrollmentStatusDto,
  ) {
    return this.enrollments.changeStatus(id, dto.status);
  }

  @Get('admin/enrollments/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  payments(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.paymentsOf(id);
  }
}
